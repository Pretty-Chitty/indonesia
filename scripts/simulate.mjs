// Play whole games headlessly with every seat driven by the engine's demo AI, using the
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
        if (e.code === "ERR_MODULE_NOT_FOUND" && (spec.startsWith(".") || spec.startsWith("/")) && !spec.endsWith(".js")) {
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
const { BadAIClientPrompts } = await import(pathToFileURL(path.join(core, "badAiTransport/BadAIClientPrompts.js")).href);
const { PlayerInfo } = await import(pathToFileURL(path.join(core, "PlayerInfo.js")).href);

// The engine's demo AI awaits each reply, and the server's resolvePrompt only returns once the
// match changes. A reply that changes nothing (the engine's own "confirm turn end" at the end
// of a parallel sub-turn can be one) therefore never returns, and that robot never answers
// again. Answer without awaiting, so one stuck reply cannot freeze a seat.
class NonBlockingAI extends BadAIClientPrompts {
  setPromptForPlayer(...args) {
    super.setPromptForPlayer(...args).catch((e) => console.error("AI reply failed", e));
    return Promise.resolve();
  }
}

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
  const match = new Match(game, infos, new EphemeralMatchStorage(`sim${n}`), {});
  await match.load();
  for (const p of infos) {
    const remote = new LocalConnectionTransport();
    const conn = new Connection(new LocalConnectionTransport());
    conn.register(new NonBlockingAI(p.id, conn, match), "ClientPrompts");
    conn.transport.connect(remote);
    const serverConn = match.connect(remote, p.id);
    // Diagnostics: report any reply the server is still processing after 5 s (a reply that
    // changed nothing waits forever for a change and blocks every later reply from that seat).
    // Found by its method: the production bundle minifies the class name it is registered under.
    const sp = (serverConn?.actualConnectionObjects ?? []).find((o) => typeof o?.resolvePrompt === "function");
    if (sp && !sp.__wrapped) {
      const orig = sp.resolvePrompt.bind(sp);
      sp.resolvePrompt = (promptId, response) => {
        const t = setTimeout(() => origError(`  [stuck reply] ${p.id} ${promptId} ${JSON.stringify(response).slice(0, 200)}`), 5000);
        return orig(promptId, response).finally(() => clearTimeout(t));
      };
      sp.__wrapped = true;
    } else if (!sp) quiet("  (could not reach ServerPrompts for diagnostics)");
  }
  const started = Date.now();
  let lastChange = Date.now();
  let changes = 0;
  match.onChange(() => { lastChange = Date.now(); changes++; });
  // GAME-SPECIFIC: a one-line summary of where the game is. Edit it per port. It is guarded,
  // so a summary that has gone stale after a refactor cannot crash the run.
  const summarise = (r) => {
    const ps = r.players.copy();
    return `year ${r.year} phase ${r.playerAid.phase}, timecard ${r.clock.timecardValue()}${r.clock.timecardFlipped() ? " (flipped)" : ""}, ${changes} changes, tiles ${ps.map((p) => p.factory.placedTiles().length).join("/")}, $ ${ps.map((p) => p.wealth.value).join("/")}`;
  };
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
      const done = (r) => { clearInterval(tick); clearInterval(report); r.at = progress(); match.dispose(); resolve(r); };
      if (res) return done({ ok: true, winners: res.winners.map((w) => `${w.name} $${w.wealth?.value}`), secs: (Date.now() - started) / 1000, scores: match.turn.value?.rootChit?.players?.copy?.().map((p) => p.wealth.value) });
      if (err) return done({ ok: false, error: err });
      if (Date.now() - lastChange > 30000) return done({ ok: false, error: "stalled: no state change for 30s" });
      if (Date.now() - started > timeoutSec * 1000) return done({ ok: false, error: `timeout after ${timeoutSec}s` });
    }, 250);
  });
}

let failures = 0;
for (let i = 1; i <= games; i++) {
  const r = await playOne(i);
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
  quiet(`game ${i}: ${r.ok ? `finished in ${r.secs.toFixed(1)}s — winner ${r.winners.join(", ")}` : `FAILED — ${r.error}`} [${r.at}]`);
}
quiet(`${games - failures}/${games} games finished`);
process.exit(failures ? 1 : 0);
