// Shared headless harness for the testbed, the decision audit and the tuner: loads the production
// node bundle (yarn build first), plays matches with the game's AI in every seat, and forks a match
// from a saved history (the engine replays it, then play continues from the pending prompt).
import { readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { register } from "node:module";

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
globalThis.window ??= globalThis;

export const out = console.log.bind(console);
/** Engine and bot chatter is dropped; errors are kept for failure reports. */
export const errors = [];
export function silence() {
  console.log = () => {};
  console.warn = () => {};
  console.info = () => {};
  console.debug = () => {};
  console.error = (...a) => errors.push(a.map(String).join(" ").slice(0, 300));
  process.on("unhandledRejection", (e) => errors.push(String(e?.stack ?? e).slice(0, 300)));
}

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
export const projectRoot = root;

export async function loadEngine() {
  // PC_DIST points at another build (a shadow checkout building while this dist is in use).
  const dist = process.env.PC_DIST ?? path.join(root, "dist");
  const bundle = readdirSync(dist).find((f) => /^node\..*\.js$/.test(f));
  const mod = await import(pathToFileURL(path.join(dist, bundle)).href);
  const core = path.join(root, "node_modules/@pretty-chitty/core/dist/game");
  const imp = (f) => import(pathToFileURL(path.join(core, f)).href);
  const { EphemeralMatchStorage } = await imp("MatchStorage.js");
  const { connectAiPlayer } = await imp("ai/connectAiPlayer.js");
  await imp("PlayerPromptStatusChit.js");
  await imp("SparkChit.js");
  const { PlayerInfo } = await imp("PlayerInfo.js");
  return { ...mod, EphemeralMatchStorage, connectAiPlayer, PlayerInfo };
}

/** A copy of the match's decision history, safe to keep (forks are loaded from it). */
export const snapshot = (match) => JSON.parse(JSON.stringify(match.state));

/**
 * Plays one match to the end.
 * @param E        loadEngine() result
 * @param n        player count
 * @param seed     base seed for the bots
 * @param state    a snapshot to fork from (replayed, then play continues), or undefined for a new game
 * @param seat     (k, playerId) => extra connectAiPlayer options for seat k (params, choose, onDecision …)
 * @param onMatch  called with the match before it starts (to keep a handle for snapshots)
 */
/** A seeded replacement for Math.random (mulberry32). */
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function playMatch(E, { n, seed, state, seat = () => ({}), onMatch, timeoutSec = 120, stallSec = 30, id = "m", rngSeed }) {
  // The game's draws (turn.rng) come from Math.random. Seeding it per playout gives every option of
  // an audited decision the same future (common random numbers), which cuts the noise a lot.
  if (rngSeed !== undefined) Math.random = seededRandom(rngSeed);
  const game = new E.Game();
  const infos = Array.from({ length: n }, (_, k) => new E.PlayerInfo(`p${k}`, `Robot ${k + 1}`));
  const storage = new E.EphemeralMatchStorage(`${id}${seed}`, true);
  if (state) await storage.saveState(state, [], "active");
  // PC_MATCH_OPTIONS: the game's match options as JSON (Indonesia: {"money":"open"} or {"money":"secret"})
  const match = new E.Match(game, infos, storage, process.env.PC_MATCH_OPTIONS ? JSON.parse(process.env.PC_MATCH_OPTIONS) : {});
  match.immediateNotify = true;
  await match.load();
  const bots = infos.map((p, k) => E.connectAiPlayer(match, p.id, { thinkMs: 0, log: false, seed: seed * 10 + k, ...seat(k, p.id) }));
  onMatch?.(match);
  const started = Date.now();
  let lastChange = Date.now();
  match.onChange(() => (lastChange = Date.now()));
  match.start();
  const outcome = await new Promise((resolve) => {
    const tick = setInterval(() => {
      const fail = (why) => {
        clearInterval(tick);
        resolve({ ok: false, why });
      };
      if (match.result.value) {
        clearInterval(tick);
        resolve({ ok: true });
      } else if (match.errorState.value) fail(String(match.errorState.value).slice(0, 300));
      else if (Date.now() - lastChange > stallSec * 1000) fail("stalled");
      else if (Date.now() - started > timeoutSec * 1000) fail("timeout");
    }, 10);
  });
  // Per seat: prompts answered, rule errors (a throwing rule scores 0 silently), stuck prompts …
  const stats = bots.map((b) => ({ ...b.prompts.stats, untagged: undefined }));
  return { ...outcome, match, ms: Date.now() - started, stats };
}

/** Final standings: per playerId, score ("vp": Indonesia's total, cash + Bank, V2), rank (1 = best, ties share),
 *  won, and margin over the best other. */
export function standings(match) {
  const r = match.turn.value?.rootChit;
  if (!r || !match.result.value) return undefined;
  const ps = r.players.copy();
  const winners = match.result.value.winners.map((w) => w.playerId ?? w.id);
  const vps = ps.map((p) => p.cash + p.bank);
  const sorted = [...vps].sort((a, b) => b - a);
  const out = {};
  ps.forEach((p, k) => {
    const others = vps.filter((_, j) => j !== k);
    out[p.playerId] = {
      vp: vps[k],
      rank: sorted.indexOf(vps[k]) + 1,
      won: winners.includes(p.playerId) ? 1 / winners.length : 0,
      margin: vps[k] - Math.max(...others),
      order: k, // index in the (shuffled) turn order array
    };
  });
  return out;
}

/** An AI option's identity, stable across a replay: its key plus the response it sends. */
export const optionSig = (o) => `${o.key ?? "?"}|${JSON.stringify(o.response)}`;
