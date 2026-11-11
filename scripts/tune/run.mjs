// Self-play tuner: evolves the v2 bot's weights (src/bots/weights.ts) by playing candidates against
// each other — and against the frozen v1 baseline — and keeping what wins.
//
// Each generation plays `games` games; every game seats a random draw of the population (the engine
// shuffles turn order, so seats rotate). A candidate's fitness is the share of opponents it finished
// ahead of, averaged over every game it has played in any generation (survivors keep their record,
// so the best are measured most). The top `elite` survive; the rest of the population is refilled
// with mutations (and some crossovers) of them. Writes results/tune-<stamp>/: one JSON per
// generation, leaderboard.md, and best.json (the champion's weights). `yarn build` first.
//
//   node scripts/tune/run.mjs [generations=30] [games=720] [population=10] [players=2,3,4,5] [temperature=0.75] [workers]
//   node scripts/tune/run.mjs resume results/tune-<stamp>     (continue from the last generation)
import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { runPool } from "../lib/pool.mjs";
import { loadEngine, silence, out } from "../lib/harness.mjs";

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(here, "../..");
const args = process.argv.slice(2);
const resumeDir = args[0] === "resume" ? path.resolve(args[1]) : undefined;
const [genArg = "30", gamesArg = "720", popArg = "10", countsArg = "2,3,4,5", tempArg = "0.75", workersArg] = resumeDir ? [] : args;

silence();
const E = await loadEngine();
const T = new E.Game().botTuning;
const DEFAULTS = T.defaults, RANGES = T.ranges;

const cfg = resumeDir
  ? JSON.parse(readFileSync(path.join(resumeDir, "config.json"), "utf8"))
  : { generations: +genArg, games: +gamesArg, population: +popArg, counts: countsArg.split(",").map(Number), temperature: tempArg === "default" ? undefined : +tempArg, elite: 3, prior: 40, mutateP: 0.3, mutateSigma: 0.12, seed: Date.now() % 1e6 };
const workers = workersArg ? +workersArg : os.cpus().length - 1;
const dir = resumeDir ?? path.join(root, "results", `tune-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}`);
mkdirSync(dir, { recursive: true });
writeFileSync(path.join(dir, "config.json"), JSON.stringify(cfg, null, 2));

// --------------------------------------------------------------------------- randomness ---
let rs = cfg.seed >>> 0;
const rand = () => {
  rs = (rs + 0x6d2b79f5) >>> 0;
  let t = rs;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const gauss = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());

// --------------------------------------------------------------------------- population ---
let nextId = 1;
const mk = (version, weights, parent, note) => ({ id: `c${nextId++}`, version, weights, parent, note, n: 0, beaten: 0, wins: 0, vp: 0, born: gen });
const clamp = (k, v) => Math.max(RANGES[k][0], Math.min(RANGES[k][1], v));
const round = (v) => Math.round(v * 1000) / 1000;
function mutate(w, p = cfg.mutateP, sigma = cfg.mutateSigma) {
  const out = { ...w };
  let changed = 0;
  for (const k of Object.keys(RANGES)) {
    if (rand() < p) {
      const [lo, hi] = RANGES[k];
      out[k] = round(clamp(k, out[k] + gauss() * sigma * (hi - lo)));
      changed++;
    }
  }
  if (!changed) {
    const ks = Object.keys(RANGES), k = ks[Math.floor(rand() * ks.length)];
    const [lo, hi] = RANGES[k];
    out[k] = round(clamp(k, out[k] + gauss() * sigma * (hi - lo)));
  }
  return out;
}
const crossover = (a, b) => Object.fromEntries(Object.keys(a).map((k) => [k, rand() < 0.5 ? a[k] : b[k]]));
const fitness = (c) => (c.beaten + 0.5 * cfg.prior) / (c.n + cfg.prior); // shrunk toward 0.5 until measured
const se = (c) => (c.n ? Math.sqrt(0.09 / c.n) : NaN); // beaten-share sd ≈ 0.3 per seat

let gen = 0;
let pop;
let history = [];
if (resumeDir) {
  const gens = readdirSync(dir).filter((f) => /^gen-\d+\.json$/.test(f)).sort();
  const last = JSON.parse(readFileSync(path.join(dir, gens[gens.length - 1]), "utf8"));
  gen = last.gen + 1;
  pop = last.next;
  history = last.history ?? [];
  nextId = Math.max(...pop.map((c) => +c.id.slice(1)), ...history.map((h) => +h.id.slice(1))) + 1;
  out(`resuming ${path.relative(root, dir)} at generation ${gen}`);
} else {
  // v1 is kept out by default: v2 beat it in 87% of pairings, so it only pads everyone's score.
  pop = [...(process.env.TUNE_WITH_V1 ? [mk("v1", undefined, undefined, "v1 baseline (frozen)")] : []), mk("v2", { ...DEFAULTS }, undefined, "v2 defaults")];
  while (pop.length < cfg.population) pop.push(mk("v2", mutate(DEFAULTS, 0.5, 0.2), pop.find((c) => c.note === "v2 defaults").id, "random start"));
}

const paramsOf = (c) => (c.version === "v1" ? { version: "v1" } : { version: "v2", weights: c.weights });

function leaderboard() {
  const rows = [...pop].sort((a, b) => fitness(b) - fitness(a));
  const diff = (w) =>
    w
      ? Object.keys(RANGES)
          .filter((k) => Math.abs(w[k] - DEFAULTS[k]) > 1e-9)
          .map((k) => `${k} ${DEFAULTS[k]}→${w[k]}`)
          .join(", ")
      : "";
  const lines = [
    `# Tuner leaderboard (after generation ${gen})`,
    "",
    `Fitness = share of opponents finished ahead of (0.5 = average), over every game played; ± is one standard error. Temperature ${cfg.temperature}; ${cfg.games} games per generation at ${cfg.counts.join("/")} players.`,
    "",
    "| id | version | games | fitness | ± | win rate | VP | born | note | weights changed from defaults |",
    "|---|---|---|---|---|---|---|---|---|---|",
    ...rows.map((c) => `| ${c.id} | ${c.version} | ${c.n} | ${(c.beaten / Math.max(1, c.n)).toFixed(3)} | ${se(c).toFixed(3)} | ${((100 * c.wins) / Math.max(1, c.n)).toFixed(1)}% | ${(c.vp / Math.max(1, c.n)).toFixed(1)} | ${c.born} | ${c.note ?? ""} | ${diff(c.weights)} |`),
    "",
    "## Champion by generation",
    "",
    "| gen | champion | fitness | games | v1 baseline fitness | v2 defaults fitness |",
    "|---|---|---|---|---|---|",
    ...history.map((h) => `| ${h.gen} | ${h.id} | ${h.fitness.toFixed(3)} | ${h.n} | ${h.v1 ?? "–"} | ${h.v2d ?? "–"} |`),
  ];
  writeFileSync(path.join(dir, "leaderboard.md"), lines.join("\n"));
}

for (; gen < cfg.generations; gen++) {
  const started = Date.now();
  // Games: random player count, seats a random draw of distinct candidates.
  const games = [];
  for (let i = 0; i < cfg.games; i++) {
    const n = cfg.counts[Math.floor(rand() * cfg.counts.length)];
    const idx = pop.map((_, j) => j).sort(() => rand() - 0.5).slice(0, n);
    while (idx.length < n) idx.push(Math.floor(rand() * pop.length));
    games.push({ seed: cfg.seed * 1000 + gen * 10000 + i, seats: idx });
  }
  const params = pop.map(paramsOf);
  const chunk = Math.ceil(games.length / (workers * 4));
  const jobs = [];
  for (let i = 0; i < games.length; i += chunk) jobs.push({ params, games: games.slice(i, i + chunk), temperature: cfg.temperature });
  let failed = 0, played = 0, turns = 0, ruleErrors = 0;
  await runPool(path.join(here, "worker.mjs"), jobs, {
    workers,
    onRecord: (r) => {
      if (!r.ok) {
        failed++;
        return;
      }
      played++;
      turns += r.turns ?? 0;
      const n = r.seats.length;
      r.seats.forEach((ci, k) => {
        const c = pop[ci], s = r.res[k];
        c.n++;
        c.beaten += r.res.filter((o, j) => j !== k && o.vp < s.vp).length / (n - 1) + (0.5 * r.res.filter((o, j) => j !== k && o.vp === s.vp).length) / (n - 1);
        c.wins += s.won;
        c.vp += s.vp;
        c.ruleErrors = (c.ruleErrors ?? 0) + (r.ruleErrors?.[k] ?? 0);
        ruleErrors += r.ruleErrors?.[k] ?? 0;
      });
    },
  });

  const v2s = pop.filter((c) => c.version === "v2");
  const ranked = [...v2s].sort((a, b) => fitness(b) - fitness(a));
  const champ = ranked[0];
  const v1 = pop.find((c) => c.version === "v1");
  const v2d = pop.find((c) => c.note === "v2 defaults");
  history.push({ gen, id: champ.id, fitness: champ.beaten / champ.n, n: champ.n, v1: v1 ? (v1.beaten / v1.n).toFixed(3) : undefined, v2d: v2d ? (v2d.beaten / v2d.n).toFixed(3) : undefined, weights: champ.weights });
  leaderboard();
  writeFileSync(path.join(dir, "best.json"), JSON.stringify({ gen, id: champ.id, fitness: champ.beaten / champ.n, games: champ.n, weights: champ.weights }, null, 2));

  // Next population: v1 baseline, the v2 defaults (kept as a yardstick), the elite, and children.
  const elite = ranked.slice(0, cfg.elite);
  const next = [...(v1 ? [v1] : []), ...(v2d && !elite.includes(v2d) ? [v2d] : []), ...elite];
  while (next.length < cfg.population) {
    const a = elite[Math.floor(rand() ** 1.5 * elite.length)];
    let w = a.weights;
    let note = `mutant of ${a.id}`;
    if (rand() < 0.25 && elite.length > 1) {
      const b = elite.find((e) => e !== a);
      w = crossover(a.weights, b.weights);
      note = `cross ${a.id}×${b.id}`;
    }
    next.push(mk("v2", mutate(w), a.id, note));
  }
  writeFileSync(path.join(dir, `gen-${String(gen).padStart(3, "0")}.json`), JSON.stringify({ gen, pop, next, history, failed, played }, null, 1));
  out(
    `gen ${gen}: ${played} games (${failed} failed, ${ruleErrors} rule errors, ${(turns / Math.max(1, played)).toFixed(0)} turns avg) in ${((Date.now() - started) / 1000).toFixed(0)}s — ` +
      `champion ${champ.id} ${(champ.beaten / champ.n).toFixed(3)} over ${champ.n} games; v1 ${v1 ? (v1.beaten / v1.n).toFixed(3) : "–"}, v2 defaults ${v2d ? (v2d.beaten / v2d.n).toFixed(3) : "–"}`,
  );
  pop = next;
}
out(`done: ${path.relative(root, dir)}/leaderboard.md, best.json`);
process.exit(0);
