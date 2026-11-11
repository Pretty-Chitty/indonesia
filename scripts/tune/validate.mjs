// Head-to-head check: plays a fixed set of bots against each other (seats drawn at random from the
// set every game; the engine shuffles turn order) and reports each one's fitness — share of
// opponents finished ahead of — with a 95% interval, overall and per player count.
//   node scripts/tune/validate.mjs [games=1500] [players=2,3,4,5] [temperature=0.75|default] <bot>…
// A bot is: v1 | v2 | v3 | <weights JSON> (v2 with those weights) | v3:<weights JSON>
import { readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { runPool } from "../lib/pool.mjs";

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(here, "../..");
const [gamesArg = "1500", countsArg = "2,3,4,5", tempArg = "0.75", ...botArgs] = process.argv.slice(2);
const bots = (botArgs.length ? botArgs : ["v1", "v2"]).map((b) => {
  if (b === "v1") return { name: "v1", params: { version: "v1" } };
  if (b === "v2") return { name: "v2 defaults", params: { version: "v2" } };
  if (b === "v3") return { name: "v3 defaults", params: { version: "v3" } };
  // "v3:<file>" = v3 with that file's weights; "<file>" = v2 with them.
  const [version, file] = b.startsWith("v3:") ? ["v3", b.slice(3)] : ["v2", b];
  const j = JSON.parse(readFileSync(file, "utf8"));
  return { name: `${version} ${path.basename(file).replace(/\.json$/, "")}`, params: { version, weights: j.weights, ...(j.modelGroups ? { modelGroups: j.modelGroups } : {}), ...(j.modelBlend !== undefined ? { modelBlend: j.modelBlend } : {}), ...(j.modelPath ? { modelPath: path.resolve(j.modelPath) } : {}) } };
});
const counts = countsArg.split(",").map(Number);
const temperature = tempArg === "default" ? undefined : +tempArg;
let s = 12345;
const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
const games = Array.from({ length: +gamesArg }, (_, i) => {
  const n = counts[i % counts.length];
  const seats = [];
  // Every bot as evenly as possible: cycle through a shuffled list.
  const order = bots.map((_, j) => j).sort(() => rand() - 0.5);
  for (let k = 0; k < n; k++) seats.push(order[k % order.length]);
  return { seed: 900000 + i, seats };
});
const workers = process.env.WORKERS ? +process.env.WORKERS : os.cpus().length - 1; // WORKERS=4 leaves the machine room
const chunk = Math.ceil(games.length / (workers * 4));
const jobs = [];
for (let i = 0; i < games.length; i += chunk) jobs.push({ params: bots.map((b) => b.params), games: games.slice(i, i + chunk), temperature });

const stat = () => ({ n: 0, beaten: 0, sq: 0, wins: 0, vp: 0 });
const all = bots.map(stat);
const byCount = new Map(counts.map((c) => [c, bots.map(stat)]));
let failed = 0, done = 0;
const whyFailed = {};
const started = Date.now();
await runPool(path.join(here, "worker.mjs"), jobs, {
  workers,
  onRecord: (r) => {
    if (!r.ok) {
      whyFailed[r.why ?? "?"] = (whyFailed[r.why ?? "?"] ?? 0) + 1;
      return failed++;
    }
    done++;
    const n = r.seats.length;
    r.seats.forEach((bi, k) => {
      const me = r.res[k];
      // Seats of the same bot don't count against each other.
      const opp = r.res.filter((_, j) => j !== k && r.seats[j] !== bi);
      if (!opp.length) return;
      const b = (opp.filter((o) => o.vp < me.vp).length + 0.5 * opp.filter((o) => o.vp === me.vp).length) / opp.length;
      for (const t of [all[bi], byCount.get(n)[bi]]) {
        t.n++;
        t.beaten += b;
        t.sq += b * b;
        t.wins += me.won;
        t.vp += me.vp;
      }
    });
  },
});
const ci = (t) => {
  const m = t.beaten / t.n;
  const v = t.sq / t.n - m * m;
  return 1.96 * Math.sqrt(Math.max(v, 1e-9) / t.n);
};
const row = (b, t) => `| ${b.name} | ${t.n} | ${(t.beaten / t.n).toFixed(3)} ± ${ci(t).toFixed(3)} | ${((100 * t.wins) / t.n).toFixed(1)}% | ${(t.vp / t.n).toFixed(1)} |`;
const lines = [
  `# Head-to-head: ${bots.map((b) => b.name).join(" vs ")}`,
  "",
  `${done} games (${failed} failed${failed ? `: ${Object.entries(whyFailed).map(([k, v]) => `${v} ${k}`).join(", ")}` : ""}) at ${counts.join("/")} players, temperature ${temperature ?? "engine default"}, ${((Date.now() - started) / 1000).toFixed(0)}s. ` +
    "Fitness = share of *other bots'* seats finished ahead of (0.5 = even); ± is a 95% interval.",
  "",
  "| bot | seats | fitness | win rate | VP |",
  "|---|---|---|---|---|",
  ...bots.map((b, i) => row(b, all[i])),
  "",
  ...counts.flatMap((c) => [`### ${c} players`, "", "| bot | seats | fitness | win rate | VP |", "|---|---|---|---|---|", ...bots.map((b, i) => row(b, byCount.get(c)[i])), ""]),
];
const dest = path.join(root, "results", `validate-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.md`);
writeFileSync(dest, lines.join("\n"));
console.log(lines.join("\n"));
console.log(`\nwrote ${dest}`);
