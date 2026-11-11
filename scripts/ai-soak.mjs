// Play whole games headlessly with every seat driven by the game's AI (src/ai.ts), using the
// production node bundle (run `yarn build` first). Reports the result, or the first error,
// or "stalled" if no prompt resolves for a while.
//   node scripts/simulate.mjs [games=1] [players=4] [timeoutSec=240]
import { readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { register } from "node:module";

// The engine's dist uses extension-less relative imports; let Node resolve them as `.js`.
register(
  "data:text/javascript," +
    encodeURIComponent(`export async function resolve(spec, ctx, next) {
      try { return await next(spec, ctx); } catch (e) {
        if ((e.code === "ERR_MODULE_NOT_FOUND" || e.code === "ERR_UNSUPPORTED_DIR_IMPORT") && (spec.startsWith(".") || spec.startsWith("/")) && !spec.endsWith(".js")) {
          try { return await next(spec + ".js", ctx); } catch { return await next(spec + "/index.js", ctx); }
        }
        throw e;
      }
    }`),
);

// A few browser globals the engine touches outside rendering (avatar URLs, timers).
globalThis.window ??= globalThis;
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const bundle = readdirSync(path.join(root, "dist")).find((f) => /^node\..*\.js$/.test(f));
const { Game, Match, Connection } = await import(pathToFileURL(path.join(root, "dist", bundle)).href);
const core = path.join(root, "node_modules/@pretty-chitty/core/dist/game");
const { EphemeralMatchStorage } = await import(pathToFileURL(path.join(core, "MatchStorage.js")).href);
const { LocalConnectionTransport } = await import(pathToFileURL(path.join(core, "ConnectionTransport.js")).href);
const { connectAiPlayer } = await import(pathToFileURL(path.join(core, "ai/connectAiPlayer.js")).href);
// The bots decode the board with this package copy of the engine, whose registry of built-in chit
// types is separate from the copy bundled into the game: load those modules so they register here.
await import(pathToFileURL(path.join(core, "PlayerPromptStatusChit.js")).href);
await import(pathToFileURL(path.join(core, "SparkChit.js")).href);
const { PlayerInfo } = await import(pathToFileURL(path.join(core, "PlayerInfo.js")).href);

const [games = 1, players = 4, timeoutSec = 240] = process.argv.slice(2).map(Number);
const quiet = console.log;
// The engine and AI are chatty: keep the most recent lines and show them if a game fails.
const recent = [];
const lastPrompt = new Map(); // player id -> JSON of their latest prompt (or "" when cleared)
const remember = (kind) => (...args) => {
  if (kind === "log" && args[0] === "Setting prompt for player") lastPrompt.set(args[1], args[2] ? JSON.stringify(args[2]) : "");
  recent.push(`[${kind}] ` + args.map((a) => (typeof a === "string" ? a : (() => { try { return JSON.stringify(a)?.slice(0, 200000); } catch { return String(a); } })())).join(" "));
  if (recent.length > 200) recent.shift();
};
console.log = remember("log");
let warnings = [];
console.warn = (...a) => { remember("warn")(...a); warnings.push(a.map(String).join(" ").slice(0, 300)); };
const origError = console.error;
console.error = (...a) => { remember("error")(...a); origError(...a); };
process.on("unhandledRejection", (e) => remember("unhandledRejection")(String(e?.stack ?? e)));
// If the game's promise can never settle (an exception swallowed inside a turn, no timers
// left), Node exits with code 13 and no output. Show what happened last instead.
process.on("beforeExit", () => {
  if (process.exitCode) return;
  origError("The game stopped with nothing left to run: an error inside a turn was probably swallowed. Recent output:");
  origError(recent.slice(-40).join("\n"));
});
process.on("uncaughtException", (e) => remember("uncaughtException")(String(e?.stack ?? e)));

async function playOne(n) {
  const game = new Game();
  const infos = Array.from({ length: players }, (_, i) => new PlayerInfo(`p${i}`, `Robot ${i + 1}`));
  const match = new Match(game, infos, new EphemeralMatchStorage(`sim${n}`, true), {});
  match.immediateNotify = true; // headless: notify on setImmediate (engine default is a 0 ms debounce timer)
  await match.load();
  // Every seat is the game's rule-based AI (src/ai.ts), connected like a client.
  const bots = infos.map((p) => connectAiPlayer(match, p.id, { thinkMs: 0, seed: 1000 * n + infos.indexOf(p), log: !!process.env.AI_LOG }));
  const started = Date.now();
  let lastChange = Date.now();
  let changes = 0;
  match.onChange(() => { lastChange = Date.now(); changes++; });
  // GAME-SPECIFIC: a one-line summary of where the game is. Edit it per port. It is guarded,
  // so a summary that has gone stale after a refactor cannot crash the run.
  const summarise = (r) => {
    const ps = r.players.copy();
    return `year ${r.year} era ${r.era} phase ${r.phase + 1}, ${changes} changes, cash ${ps.map((p) => p.cash).join("/")}, bank ${ps.map((p) => p.bank).join("/")}, companies ${ps.map((p) => p.companies.length).join("/")}`;
  };
  // GAME-SPECIFIC (Indonesia): every ship shows as many capacity markers as its owner's Hull
  let capReported = false;
  if (process.env.CAP_CHECK) match.onChange(() => {
    const r = match.turn.value?.rootChit;
    if (!r || capReported) return;
    try {
      for (const sea of r.board.seas.copy()) for (const ship of sea.ships.copy()) {
        const owner = r.players.copy().find((p) => p.seat === ship.seat);
        if (owner && ship.capacity.length !== owner.rnd.hull && r.phase !== 4) {
          capReported = true;
          quiet(`  capacity mismatch: year ${r.year} phase ${r.phase + 1} ${ship.companyName}: ${ship.capacity.length} markers, Hull ${owner.rnd.hull}`);
        }
      }
    } catch (e) { quiet("cap check failed " + e.message); capReported = true; }
  });
  // Every 10 turns: what each bot is holding, to see why a plan stalls.
  let lastDump = 0;
  match.onChange(() => {
    const r = match.turn.value?.rootChit;
    if (!r || !process.env.AI_DUMP || r.year === lastDump) return;
    lastDump = r.year;
    try {
      for (const p of r.players.copy()) {
        const cos = p.companies.map((c) => `${c.name}[${c.type} ${c.deedCount}d]`).join(" ");
        quiet(`  Y${r.year} ${p.name}: cash ${p.cash} bank ${p.bank} earn ${p.earnings} rnd ${JSON.stringify(p.rnd)} ${cos}`);
      }
    } catch (e) { quiet("dump failed " + e.message); }
  });
  const progress = () => {
    const r = match.turn.value?.rootChit;
    if (!r) return "starting";
    try { return summarise(r); } catch (e) { return `${changes} changes (progress summary failed: ${e.message})`; }
  };
  const report = setInterval(() => quiet(`  … ${((Date.now() - started) / 1000).toFixed(0)}s: ${progress()}`), 15000);
  match.start();
  return await new Promise((resolve) => {
    const tick = setInterval(() => {
      const res = match.result.value;
      const err = match.errorState.value;
      const done = (r) => { clearInterval(tick); clearInterval(report); r.at = progress(); if (r.ok) r.refs = missingRefs(match); match.dispose(); resolve(r); };
      if (res && process.env.AI_LOG_DUMP && !globalThis.__logDumped) {
        globalThis.__logDumped = 1;
        // Every game-log line, in order, walking flushes and sub-turns (Turn.clockSteps).
        const lines = [];
        const walk = (turn, depth) => {
          for (const st of turn?.clockSteps ?? []) {
            if (st.log) lines.push("  ".repeat(depth) + st.log);
            for (const t of st.turns ?? []) walk(t, depth + 1);
          }
        };
        walk(match.turn.value, 0);
        quiet(lines.slice(0, +process.env.AI_LOG_DUMP).join("\n"));
      }
      if (res) return done({ ok: true, stats: bots.map((b) => b.prompts.stats), winners: res.winners.map((w) => `${w.name} ${w.cash + w.bank} rupiah`), secs: (Date.now() - started) / 1000, scores: match.turn.value?.rootChit?.players?.copy?.().map((p) => `${p.name} ${p.cash + p.bank}`) });
      if (err) return done({ ok: false, error: err, stats: bots.map((b) => b.prompts.stats) });
      if (Date.now() - lastChange > 30000) return done({ ok: false, error: "stalled: no state change for 30s", stats: bots.map((b) => b.prompts.stats) });
      if (Date.now() - started > timeoutSec * 1000) return done({ ok: false, error: `timeout after ${timeoutSec}s` });
    }, 250);
  });
}

// Every clock of a finished game, as a client loading the board fresh at that clock is sent it: each chit's saved
// fields may only name chits on the table at that same clock. A field naming a piece that has since left (a company
// folded in a merger, kept on another chit) never shows while the board is watched live, as the client remembers the
// piece, but a reload, a reconnect or a tutorial's step jump past that clock cannot build the board and stops there.
function missingRefs(match, limit = 8) {
  const turn = match.turn.value;
  const pid = turn.rootChit.players.copy()[0].id;
  const max = turn.clockDetails(pid).clock;
  const problems = [];
  const seen = new Set();
  for (let c = 1; c <= max && problems.length < limit; c++) {
    const chits = turn.serialize(pid, c).chits;
    const live = (id) => chits[id] !== undefined && !JSON.parse(chits[id]).____deleted;
    for (const [id, s] of Object.entries(chits)) {
      const j = JSON.parse(s);
      if (j.____deleted) continue;
      const walk = (v, field) => {
        if (!v || typeof v !== "object") return;
        if (Array.isArray(v)) return v.forEach((x) => walk(x, field));
        if (v.__chit_id) {
          const key = `${j.__chitType}.${field} -> ${v.__chit_id}`;
          if (!live(v.__chit_id) && !seen.has(key) && problems.length < limit) {
            seen.add(key);
            problems.push(`clock ${c}: ${j.__chitType} ${id}, field "${field}", names ${v.__chit_id}`);
          }
          return;
        }
        for (const [k, x] of Object.entries(v)) walk(x, field ?? k);
      };
      for (const [k, v] of Object.entries(j)) walk(v, k);
    }
  }
  return problems;
}

let failures = 0;
for (let i = 1; i <= games; i++) {
  const r = await playOne(i);
  if (r.refs?.length) {
    r.ok = false;
    r.error = "saved state names pieces that are not on the table (a board loaded fresh there, by a reload or a reconnect, fails with \"Cannot find chit\"):\n    " + r.refs.join("\n    ");
  }
  if (!r.ok) {
    failures++;
    quiet("  last engine messages:\n    " + recent.slice(-60).map((l) => l.slice(0, 220)).join("\n    "));
    const counts = new Map();
    for (const w of warnings) { const k = w.replace(/"[^"]*"/g, '"…"'); counts.set(k, (counts.get(k) ?? 0) + 1); }
    for (const [k, n] of counts) quiet(`  warning ×${n}: ${k}`);
    quiet("  last warnings:\n    " + warnings.slice(-5).join("\n    "));
    // Each player's pending prompt at the moment of failure, pick by pick.
    for (const [pid, line] of lastPrompt) {
      if (!line) { quiet(`  ${pid}: no prompt pending`); continue; }
      try {
        const json = JSON.parse(line);
        quiet(`  ${pid}: ${json.type} ${json.id} "${json.details?.message ?? ""}"`);
        for (const pk of json.details?.picks ?? []) quiet(`      ${pk.type} "${pk.message ?? ""}" chits=${pk.details?.c?.length ?? "-"} targetGroups=${pk.details?.d?.map((g) => g.length).join("/") ?? "-"}`);
      } catch (e) { quiet(`  ${pid}: (unparsed) ${line.slice(0, 200)}`); }
    }
    lastPrompt.clear();
  }
  recent.length = 0;
  warnings = [];
  if (r.stats) {
    const sum = (f) => r.stats.reduce((n, st) => n + (f(st) ?? 0), 0);
    const untagged = {};
    r.stats.forEach((st) => Object.entries(st?.untagged ?? {}).forEach(([k, v]) => (untagged[k] = (untagged[k] ?? 0) + v)));
    quiet(`  ai: prompts ${sum((s) => s?.promptsAnswered)}, stepBacks ${sum((s) => s?.stepBacks)}, rejections ${sum((s) => s?.rejections)}, stalls ${sum((s) => s?.stalls)}, stuck ${sum((s) => s?.stuck)}, ruleErrors ${sum((s) => s?.ruleErrors)}, untagged ${JSON.stringify(untagged)}`);
  }
  quiet(`game ${i}: ${r.ok ? `finished in ${r.secs.toFixed(1)}s — winner ${r.winners.join(", ")}` : `FAILED — ${r.error}`} [${r.at}]`);
}
quiet(`${games - failures}/${games} games finished`);
process.exit(failures ? 1 : 0);

