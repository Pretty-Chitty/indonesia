// One testbed worker: plays Indonesia headlessly with the game's AI in every seat and prints one `RESULT {json}`
// line per game (see run.mjs). Uses the production node bundle (yarn build first). Adapted from the
// board-game-port skill's Excursions worker: the board and the game log give every number.
//   node scripts/testbed/worker.mjs <games> <playerCounts e.g. 2,3,4> <seedBase> <timeoutSec>
import { readdirSync, readFileSync } from "node:fs";
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
const out = console.log.bind(console);
// Silence the engine and the bots; only RESULT / PROGRESS lines leave this process.
console.log = () => {};
console.warn = () => {};
console.info = () => {};
console.debug = () => {};
const errors = [];
console.error = (...a) => errors.push(a.map(String).join(" ").slice(0, 300));
process.on("unhandledRejection", (e) => errors.push(String(e?.stack ?? e).slice(0, 300)));

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
// PC_DIST points at another build (a shadow checkout building while this dist is in use by a tuner)
const dist = process.env.PC_DIST ?? path.join(root, "dist");
const bundle = readdirSync(dist).find((f) => /^node\..*\.js$/.test(f));
const { Game, Match } = await import(pathToFileURL(path.join(dist, bundle)).href);
const core = path.join(root, "node_modules/@pretty-chitty/core/dist/game");
const { EphemeralMatchStorage } = await import(pathToFileURL(path.join(core, "MatchStorage.js")).href);
const { connectAiPlayer } = await import(pathToFileURL(path.join(core, "ai/connectAiPlayer.js")).href);
await import(pathToFileURL(path.join(core, "PlayerPromptStatusChit.js")).href);
await import(pathToFileURL(path.join(core, "SparkChit.js")).href);
const { PlayerInfo } = await import(pathToFileURL(path.join(core, "PlayerInfo.js")).href);

const [gamesArg = "1", countsArg = "4", seedArg = "0", timeoutArg = "400"] = process.argv.slice(2);
const games = +gamesArg, counts = countsArg.split(",").map(Number), seedBase = +seedArg, timeoutSec = +timeoutArg;

/** Every game-log line in order, walking flushes and sub-turns. */
function logLines(turn) {
  const lines = [];
  const walk = (t) => {
    for (const st of t?.clockSteps ?? []) {
      if (st.log) lines.push(st.log);
      for (const sub of st.turns ?? []) walk(sub);
    }
  };
  walk(turn);
  return lines;
}

const params = process.env.TB_WEIGHTS ? { version: "v2", weights: JSON.parse(readFileSync(process.env.TB_WEIGHTS, "utf8")).weights } : undefined;

/** What each player did, read from the log (":p2: starts the …"). Log keys are player ids. */
function fromLog(lines, n) {
  const per = Array.from({ length: n }, () => ({
    started: {}, mergersAnnounced: 0, mergersWon: 0, mergerPaid: 0, mergerReceived: 0, auctionBids: 0,
    orderBid: 0, research: {}, hullForOthers: 0, researchPasses: 0, acquirePasses: 0,
    freeExpansions: 0, paidExpansions: 0, paidDeclined: 0, paidUnaffordable: 0, sales: 0, saleValue: 0, feesPaid: 0, feesEarned: 0, ownShipping: 0,
    shipsAdded: 0, cities: 0, citiesSkipped: 0, firstStartYear: 0,
  }));
  let year = 0;
  let firstOrder = [];
  for (const l of lines) {
    let m;
    if ((m = l.match(/^Year (\d+)/))) year = +m[1];
    if ((m = l.match(/^Setup: .*Order of play: (.*)\.$/))) firstOrder = [...m[1].matchAll(/:p(\d+):/g)].map((x) => +x[1]);
    if ((m = l.match(/^:p(\d+): wins the merger for (\d+) rupiah: :p(\d+): receives (\d+) rupiah, :p(\d+): receives (\d+) rupiah/))) {
      per[+m[1]].mergersWon++;
      per[+m[1]].mergerPaid += +m[2];
      per[+m[3]].mergerReceived += +m[4];
      per[+m[5]].mergerReceived += +m[6];
    }
    if ((m = l.match(/, (\d+) rupiah to :p(\d+):\)\.$/))) per[+m[2]].feesEarned += +m[1];
    m = l.match(/^:p(\d+):(.*)$/);
    if (!m) continue;
    const p = per[+m[1]], rest = m[2];
    if (!p) continue;
    let k;
    if ((k = rest.match(/^ starts the .* (rice|spice|rubber|oil|shipping) company/))) {
      p.started[k[1]] = (p.started[k[1]] ?? 0) + 1;
      if (!p.firstStartYear) p.firstStartYear = year || 1;
    }
    if (/^ announces a merger/.test(rest)) p.mergersAnnounced++;
    if (/^ bids \d+ rupiah\.$/.test(rest)) p.auctionBids++;
    if ((k = rest.match(/^ bids (\d+) rupiah.* for turn order/))) p.orderBid += +k[1];
    if ((k = rest.match(/^ researches (.+) to \d+\.$/))) p.research[k[1]] = (p.research[k[1]] ?? 0) + 1;
    if (/^ advances :p\d+:'s Hull/.test(rest)) p.hullForOthers++;
    if ((k = rest.match(/^ sells .* for (\d+) via .*\((\d+) ships?(, their own line|, (\d+) rupiah to)/))) {
      p.sales++;
      p.saleValue += +k[1];
      if (k[3] === ", their own line") p.ownShipping++;
      else p.feesPaid += +k[4];
    }
    if (/^ adds a ship to/.test(rest)) p.shipsAdded++;
    if (/^ expands .* for free\.$/.test(rest)) p.freeExpansions++;
    else if (/^ expands .* for \d+ rupiah\.$/.test(rest)) p.paidExpansions++;
    if (/^ buys no areas for/.test(rest)) p.paidDeclined++;
    if (/^ cannot afford to expand/.test(rest)) p.paidUnaffordable++;
    if (/^ does no research/.test(rest)) p.researchPasses++;
    if (/^ starts no company this year/.test(rest)) p.acquirePasses++;
    if (/^ builds a city in/.test(rest)) p.cities++;
    if (/ cannot build a city /.test(rest)) p.citiesSkipped++;
  }
  return { per, firstOrder };
}

async function playOne(i) {
  const n = counts[i % counts.length];
  const seed = seedBase + i;
  const game = new Game();
  const infos = Array.from({ length: n }, (_, k) => new PlayerInfo(`p${k}`, `Robot ${k + 1}`));
  // PC_MATCH_OPTIONS: the game's match options as JSON ({"money":"open"}); TB_WEIGHTS: a weights file (results/…json)
  // every seat plays v2 with, instead of the shipped bot
  const match = new Match(game, infos, new EphemeralMatchStorage(`tb${seed}`, true), process.env.PC_MATCH_OPTIONS ? JSON.parse(process.env.PC_MATCH_OPTIONS) : {});
  match.immediateNotify = true; // headless: notify on setImmediate (engine default is a 0 ms debounce timer)
  await match.load();
  infos.forEach((p, k) => connectAiPlayer(match, p.id, { thinkMs: 0, seed: seed * 10 + k, ...(params ? { params } : {}) }));
  const started = Date.now();
  let lastChange = Date.now();
  match.onChange(() => (lastChange = Date.now()));
  match.start();
  const outcome = await new Promise((resolve) => {
    const tick = setInterval(() => {
      const fail = (why) => { clearInterval(tick); resolve({ ok: false, why }); };
      if (match.result.value) { clearInterval(tick); resolve({ ok: true }); }
      else if (match.errorState.value) fail(String(match.errorState.value).slice(0, 300));
      else if (Date.now() - lastChange > 30000) fail("stalled");
      else if (Date.now() - started > timeoutSec * 1000) fail("timeout");
    }, 20);
  });
  const r = match.turn.value?.rootChit;
  const rec = { seed, players: n, ok: outcome.ok, why: outcome.why, ms: Date.now() - started, years: r?.year ?? 0 };
  if (outcome.ok && r) {
    const lines = logLines(match.turn.value);
    const lg = fromLog(lines, n);
    const ps = r.players.copy();
    const winners = match.result.value.winners.map((w) => w.playerId ?? w.id);
    const totals = ps.map((p) => p.cash + p.bank);
    const sorted = [...totals].sort((a, b) => b - a);
    rec.tie = sorted[0] === sorted[1];
    rec.logLines = lines.length;
    rec.cities = r.board.cities().map(({ city }) => city.size);
    // log keys (":p3:") are player ids, not indices into the (shuffled) players: map through the id
    const idx = (p) => +p.playerId.replace(/^p/, "");
    rec.p = ps.map((p) => {
      const companies = p.companies.copy();
      const pieces = companies.reduce((s, c) => s + (c.type === "shipping" ? r.board.shipsOf(c.key).length : r.board.goodsOf(c.key).length), 0);
      return {
        seat: idx(p),
        order: lg.firstOrder.indexOf(idx(p)), // place in year 1's order of play (0 first)
        total: p.cash + p.bank,
        rank: sorted.indexOf(p.cash + p.bank) + 1,
        won: winners.includes(p.playerId),
        cash: p.cash, bank: p.bank,
        rnd: { ...p.rnd },
        companies: companies.map((c) => ({ type: c.type, deeds: c.deedCount })),
        pieces,
        ...lg.per[idx(p)],
      };
    });
  } else {
    rec.errors = errors.splice(0).slice(-5);
    // where a failed game stood: a stall shows as an old year, a market that never empties, full slots
    if (r) rec.stuckAt = { year: r.year, era: r.era, eraStartYear: r.eraStartYear, market: r.market.deeds.map((d) => `${d.name} (era ${d.spec.era})`), players: r.players.copy().map((p) => ({ name: p.name, slots: p.rnd.slots, companies: p.companies.copy().map((c) => ({ name: c.name, type: c.type, deeds: c.deeds.copy().map((d) => `${d.name} (era ${d.spec.era})`) })), rnd: { ...p.rnd }, cash: p.cash, bank: p.bank })) };
  }
  try { match.dispose(); } catch {}
  return rec;
}

for (let i = 0; i < games; i++) {
  const rec = await playOne(i);
  out("RESULT " + JSON.stringify(rec));
}
process.exit(0);
