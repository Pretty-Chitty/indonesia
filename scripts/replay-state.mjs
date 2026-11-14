// Replay a saved match headlessly and print where it stands. The developer exports the match from the playground
// (a JSON with name, numPlayers, options, players and state) when something looks wrong; this rebuilds the whole
// game from its decisions with the production node bundle (run `yarn build` first) and prints the board.
//   node scripts/replay-state.mjs problemState.json
// If the replay stops with a "Mismatch" error, the code now asks a prompt the save has no answer for (a rules fix
// added or removed a prompt before that point): the save cannot load past it.
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
const root = process.cwd(); // run from the game folder
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

import { readFileSync } from "node:fs";
const saved = JSON.parse(readFileSync(process.argv[2] ?? "problemState.json", "utf8"));
const log = console.log;
// keep the engine's chatter, print only what matters (the last lines on an error)
const LOGS = [];
console.log = (...a) => LOGS.push(a.map((x) => (typeof x === "string" ? x : JSON.stringify(x)?.slice(0, 600))).join(" "));
console.warn = console.log;
console.error = console.log;

const storage = new EphemeralMatchStorage("replay");
storage.state = JSON.stringify(saved.state);
const infos = Object.values(saved.players).map((p) => new PlayerInfo(p.id, p.name));
const match = new Match(new Game(), infos, storage, saved.options ?? {});
match.immediateNotify = true;
await match.load();
match.start(); // replays every saved decision, then waits at the open prompt
await new Promise((r) => setTimeout(r, Number(process.env.REPLAY_WAIT_MS ?? 4000)));
const r = match.turn.value?.rootChit;
if (!r) { log("no match running"); log(LOGS.slice(-30).join("\n")); process.exit(1); }

// GAME-SPECIFIC: what to print about the board. Edit per port (phase, round, each player's money, tracks, holdings).
const summarise = (root) => {
  const lines = [`year ${root.year} era ${root.era} phase ${root.phase + 1}`];
  for (const p of root.players.copy()) lines.push(`${p.playerId} ${p.name}: cash ${p.cash} bank ${p.bank} earnings ${p.earnings}`);
  // every city and its goods display: where the display is, whether it is out, and what it holds
  for (const { land, city } of root.board.cities()) {
    const d = city.display();
    lines.push(`city ${city.id} in ${land.province} (area ${land.areaId}) size ${city.size}: ${d ? `display ${d.id} size ${d.size} goods [${d.goods().map((g) => g.good).join(", ")}]` : "no display out"}`);
  }
  return lines.join("\n");
};
if (process.env.TRACE_CHITS) {
  // each named chit's saved fields, at every clock where they change, as a viewer is sent them
  const t = match.turn.value;
  const pid = process.env.TRACE_VIEWER ?? r.players.copy()[0].playerId;
  const max = t.clockDetails(pid).clock;
  const ids = process.env.TRACE_CHITS.split(",");
  const last = {};
  for (let c = 1; c <= max; c++) {
    const chits = t.serialize(pid, c).chits;
    for (const id of ids) {
      const st = chits[id];
      if (st && st !== last[id]) {
        last[id] = st;
        const j = JSON.parse(st);
        const keep = Object.fromEntries(Object.entries(j).filter(([k]) => !k.startsWith("__") || k === "__chitType"));
        log(`clock ${c} ${id}: ${JSON.stringify(keep).slice(0, 400)}`);
      }
    }
  }
}
try { log(summarise(r)); } catch (e) { log("summarise failed: " + e); }
const err = match.errorState.value;
if (err) { log("ERROR " + String(err?.stack ?? err)); log(LOGS.slice(-30).join("\n")); }
process.exit(0);
