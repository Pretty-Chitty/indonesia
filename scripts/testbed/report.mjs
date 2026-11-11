// Aggregates testbed records (results/testbed-*.jsonl) into a markdown report: pacing and scores by player count,
// win rate by place in year 1's order, what winners do differently, research and company choices, and the paths the
// bots never take. It measures the AI's game: a choice the bot misplays looks weak.
//   node scripts/testbed/report.mjs results/testbed-….jsonl [more files…]
import { readFileSync } from "node:fs";

const recs = process.argv.slice(2).flatMap((f) => readFileSync(f, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)));
const ok = recs.filter((r) => r.ok);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : "–");
const pct = (x) => (Number.isFinite(x) ? `${(100 * x).toFixed(1)}%` : "–");
const ci = (k, n) => (n ? `±${(196 * Math.sqrt((k / n) * (1 - k / n) / n)).toFixed(1)}` : "");
const counts = [...new Set(ok.map((r) => r.players))].sort();
const out = [];
const table = (head, rows) => {
  out.push(`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.join(" | ")} |`), "");
};

out.push(`# Indonesia AI testbed`, "", `${recs.length} games, ${recs.length - ok.length} failed${recs.length - ok.length ? ` (${[...new Set(recs.filter((r) => !r.ok).map((r) => r.why))].join("; ")})` : ""}.`, "");

out.push("## Pacing and scores (total = cash + Bank)", "");
table(
  ["players", "games", "years", "s/game", "winner", "2nd", "last", "mean", "margin 1st–2nd", "ties"],
  counts.map((n) => {
    const g = ok.filter((r) => r.players === n);
    const by = (k) => mean(g.map((r) => [...r.p].sort((a, b) => b.total - a.total)[k]?.total));
    return [n, g.length, f1(mean(g.map((r) => r.years))), f1(mean(g.map((r) => r.ms / 1000))), f1(by(0)), f1(by(1)), f1(mean(g.map((r) => Math.min(...r.p.map((p) => p.total))))), f1(mean(g.flatMap((r) => r.p.map((p) => p.total)))), f1(mean(g.map((r) => { const s = r.p.map((p) => p.total).sort((a, b) => b - a); return s[0] - s[1]; }))), pct(mean(g.map((r) => (r.tie ? 1 : 0))))];
  }),
);

out.push("## Win rate by place in year 1's order of play (95% interval)", "");
table(
  ["players", ...[0, 1, 2, 3, 4].map((k) => `place ${k + 1}`)],
  counts.map((n) => {
    const g = ok.filter((r) => r.players === n);
    return [n, ...[0, 1, 2, 3, 4].map((k) => {
      if (k >= n) return "";
      const ps = g.flatMap((r) => r.p.filter((p) => p.order === k));
      const w = ps.filter((p) => p.won).length;
      return `${pct(w / ps.length)} ${ci(w, ps.length)} (fair ${pct(1 / n)})`;
    })];
  }),
);

const all = ok.flatMap((r) => r.p.map((p) => ({ ...p, n: r.players })));
const W = all.filter((p) => p.won), O = all.filter((p) => !p.won);
const TRACKS = ["Turn Order Bid", "Slots", "Mergers", "Expansion", "Hull"];
const TYPES = ["rice", "spice", "rubber", "oil", "shipping"];
const stat = (label, fn) => [label, f1(mean(W.map(fn))), f1(mean(O.map(fn))), f1(mean(W.map(fn)) - mean(O.map(fn)))];
out.push("## Winners vs everyone else (per player, all counts)", "");
table(
  ["", "winners", "others", "difference"],
  [
    stat("total", (p) => p.total),
    stat("cash", (p) => p.cash),
    stat("Bank (turn-order bids)", (p) => p.bank),
    stat("companies at the end", (p) => p.companies.length),
    stat("deeds at the end", (p) => p.companies.reduce((s, c) => s + c.deeds, 0)),
    stat("pieces on the map at the end", (p) => p.pieces),
    ...TYPES.map((t) => stat(`started ${t}`, (p) => p.started[t] ?? 0)),
    stat("first company started (year)", (p) => p.firstStartYear || 99),
    stat("mergers announced", (p) => p.mergersAnnounced),
    stat("mergers won", (p) => p.mergersWon),
    stat("paid for mergers", (p) => p.mergerPaid),
    stat("received from mergers", (p) => p.mergerReceived),
    stat("goods sold", (p) => p.sales),
    stat("sales value", (p) => p.saleValue),
    stat("fees paid to others' ships", (p) => p.feesPaid),
    stat("fees earned by own ships", (p) => p.feesEarned),
    stat("sales on own ships", (p) => p.ownShipping),
    stat("ships added", (p) => p.shipsAdded),
    stat("free expansions (areas)", (p) => p.freeExpansions),
    stat("paid expansions (areas)", (p) => p.paidExpansions),
    stat("paid expansions declined", (p) => p.paidDeclined),
    stat("paid expansions unaffordable", (p) => p.paidUnaffordable),
    stat("acquisition passes", (p) => p.acquirePasses),
    stat("research passes", (p) => p.researchPasses),
    stat("turn-order Rp bid (total)", (p) => p.orderBid),
    stat("cities built", (p) => p.cities),
    ...TRACKS.map((t) => stat(`research steps: ${t}`, (p) => p.research[t] ?? 0)),
    stat("Hull advanced for others", (p) => p.hullForOthers),
  ],
);

out.push("## Companies by type", "");
table(
  ["type", "started per game", "players who started one: win rate", "held at the end per game"],
  [...TYPES, "siapsaji"].map((t) => {
    const starters = all.filter((p) => (p.started[t] ?? 0) > 0);
    return [t, f1(mean(ok.map((r) => r.p.reduce((s, p) => s + (p.started[t] ?? 0), 0)))), starters.length ? `${pct(starters.filter((p) => p.won).length / starters.length)} of ${starters.length}` : "–", f1(mean(ok.map((r) => r.p.reduce((s, p) => s + p.companies.filter((c) => c.type === t).length, 0))))];
  }),
);

out.push("## Research", "");
const steps = Object.fromEntries(TRACKS.map((t) => [t, all.reduce((s, p) => s + (p.research[t] ?? 0), 0)]));
const totalSteps = Object.values(steps).reduce((a, b) => a + b, 0);
table(["track", "share of research steps", "players who never took it"], TRACKS.map((t) => [t, pct(steps[t] / totalSteps), pct(all.filter((p) => !(p.research[t] ?? 0)).length / all.length)]));

out.push("## Cities at the end", "");
const sizes = ok.flatMap((r) => r.cities);
table(["size 1", "size 2", "size 3", "cities per game"], [[pct(sizes.filter((s) => s === 1).length / sizes.length), pct(sizes.filter((s) => s === 2).length / sizes.length), pct(sizes.filter((s) => s === 3).length / sizes.length), f1(sizes.length / ok.length)]]);

out.push("## Paths the bots rarely or never take", "");
const rare = [
  ["research Turn Order Bid", all.filter((p) => p.research["Turn Order Bid"]).length / all.length],
  ["advance another player's Hull", all.filter((p) => p.hullForOthers).length / all.length],
  ["announce a merger", all.filter((p) => p.mergersAnnounced).length / all.length],
  ["start an oil company", all.filter((p) => p.started.oil).length / all.length],
  ["research Expansion", all.filter((p) => p.research["Expansion"]).length / all.length],
  ["research Hull", all.filter((p) => p.research["Hull"]).length / all.length],
  ["buy a paid expansion", all.filter((p) => p.paidExpansions).length / all.length],
  ["pass an acquisition", all.filter((p) => p.acquirePasses).length / all.length],
  ["pass research", all.filter((p) => p.researchPasses).length / all.length],
  ["bid more than 0 for turn order (over the game)", all.filter((p) => p.orderBid > 0).length / all.length],
  ["games with a siap saji company at the end", ok.filter((r) => r.p.some((p) => p.companies.some((c) => c.type === "siapsaji"))).length / ok.length],
];
table(["", "share of players (or games)"], rare.map(([k, v]) => [k, pct(v)]));
console.log(out.join("\n"));
