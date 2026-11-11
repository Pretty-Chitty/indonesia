// v2: options valued in rupiah from the board (references/ai.md §6 in the board-game-port skill). Companies, new
// deeds, mergers and research are worth their income over the years left (econ.ts); a merger auction is bid up to
// what the merged company is worth to the bidder, so announcing no longer wins a merger for its opening value.
// The tactical picks (where to place, where to sell) are still v1's. Every constant is in weights.ts.
import { AiContext, AiOption, AiRule } from "@pretty-chitty/core";
import { Company } from "../chits/Company";
import { Player } from "../chits/Player";
import { Root } from "../chits/Root";
import { ERAS, GOOD_VALUE, Good, RND_TABLE_ROW, RndTrack } from "../consts";
import { LandArea } from "../chits/LandArea";
import { City } from "../chits/City";
import { CitySize } from "../consts";
import { legalMergers, MergerTerms } from "../phases/phase3Mergers";
import { chitOf, landValue, Memory } from "./common";
import { Env, envOf } from "./econ";
import { v1Rules } from "./v1";
import { DEFAULTS, Weights } from "./weights";

type Ctx = AiContext<Player, Root, Memory>;

function weights(ctx: Ctx): Weights {
  return { ...DEFAULTS, ...(ctx.params?.weights ?? {}) };
}
function env(ctx: Ctx): Env {
  return envOf(ctx.options, ctx.view, ctx.me, weights(ctx));
}

/** The company an option stands for: a company, or one of its plantations or ships. */
function companyOf(e: Env, x: unknown): Company | undefined {
  if (x instanceof Company) return x;
  const id = (x as { companyId?: string })?.companyId;
  return id ? e.company(id) : undefined;
}

/** Whether I hold the most money (cash + Bank, V2), as far as I know it (secret money: estimated, S7). */
function leading(e: Env): boolean {
  const mine = e.totalOf(e.me);
  return e.players().every((q) => q === e.me || e.totalOf(q) <= mine);
}

/** A bot that has lost unblocks the game rather than stall it: with its slots full and companies still on offer, once
 *  it trails the leader by more than CONCEDE_MARGIN or the game has reached CONCEDE_YEAR, it merges two of its own
 *  companies and starts one on offer. Any era: an era ends only when its companies are taken (P1.1), and two-player
 *  tables with every slot full stalled in era B too (year 421). No house rule: both are ordinary moves. */
const CONCEDE_MARGIN = 10000;
const CONCEDE_YEAR = 30;
const CONCEDE = 1e6;
function concedes(e: Env): boolean {
  const { view, me } = e;
  if (me.freeSlots() > 0 || !view.market.deeds.length) return false;
  const best = Math.max(...e.players().filter((q) => q !== me).map((q) => e.totalOf(q)));
  return best - e.totalOf(me) > CONCEDE_MARGIN || view.year >= CONCEDE_YEAR;
}

/** What announcing this merger is expected to gain me (P3.10–P3.15): each player bids up to its reservation, so the
 *  price is about the second-highest reservation; owners are paid by their pieces whoever wins. */
function announceGain(e: Env, t: MergerTerms): number {
  const { a, b, siapSaji, nominal, unit, piecesA, piecesB } = t;
  const me = e.me;
  const ownerA = e.ownerOf(a);
  const ownerB = e.ownerOf(b);
  const share = (q: Player, price: number) => (price * ((q === ownerA ? piecesA : 0) + (q === ownerB ? piecesB : 0))) / Math.max(1, unit);
  const ownLost = (ownerA === me ? e.value(a) : 0) + (ownerB === me ? e.value(b) : 0);
  const owns = ownerA === me || ownerB === me;
  const others = e.players().filter((q) => q !== me && (q === ownerA || q === ownerB || q.freeSlots() > 0));
  const rOther = others.length ? Math.max(...others.map((q) => e.reservation(a, b, siapSaji, q))) : -Infinity;
  const rMe = e.reservation(a, b, siapSaji, me);
  // folding two of my own companies into one frees a slot: worth the best company it lets me start while my slots
  // are full and companies are on offer. In era C it can also end the game (P1.1, V1): taking the last companies
  // ends era C, and with every slot full nobody can until someone merges. The leader wants that (`closeOut`); a bot
  // that has lost concedes and makes the merger itself (two-player tables ran to year 300 when only the trailer
  // could merge and never would).
  const freed =
    ownerA === me && ownerB === me && me.freeSlots() <= 0 && e.view.market.deeds.length
      ? Math.max(0, ...e.view.market.deeds.map((d) => e.deedValue(d))) + (e.view.era === "C" && leading(e) ? e.w.closeOut : 0) + (concedes(e) ? CONCEDE : 0)
      : 0;
  const winAt = (price: number) => e.mergedValue(a, b, siapSaji, me) - (owns ? 0 : e.w.slotYear * e.H) - price + share(me, price) - ownLost + freed;
  // nobody else reaches the opening value: I win at it (the announcer must open)
  if (rOther < nominal) return winAt(nominal);
  if (rMe >= rOther + unit) return winAt(Math.max(nominal, rOther + unit));
  // someone outbids me: I am paid my share of their price, and lose my companies
  return share(me, Math.max(nominal, Math.min(rOther, rMe + unit))) - ownLost;
}

/** The merger being auctioned, read off the merger table (Market panel). */
function auction(ctx: Ctx) {
  const e = env(ctx);
  const t = ctx.view.market.merger;
  const a = e.company(t.keyA);
  const b = e.company(t.keyB);
  if (!a || !b) return undefined;
  return { e, reserve: e.reservation(a, b, t.siapSaji, ctx.me) };
}

/** The amount the bid button would bid now (its data), from this prompt's options. */
function offered(ctx: Ctx): number {
  const bid = ctx.options.find((o) => o.key === "auction.bid");
  return (bid?.data as { amount?: number } | undefined)?.amount ?? 0;
}

function track(opt: AiOption): RndTrack {
  const cell = chitOf<{ row: string }>(opt);
  return (Object.entries(RND_TABLE_ROW).find(([, row]) => row === cell.row)?.[0] ?? "slots") as RndTrack;
}

/** What one more step of a research track is worth to me now (P5), in rupiah over the years left. */
function researchValue(e: Env, t: RndTrack): number {
  const { me, w } = e;
  const mine = me.companies.copy();
  switch (t) {
    case "slots": {
      const best = Math.max(w.slotYear * e.H, ...e.view.market.deeds.map((d) => e.deedValue(d)));
      return best * (me.freeSlots() <= 0 ? w.slotUse : w.slotSpare);
    }
    case "expansion":
      // one more area or ship each operation: for every company, what its best next area would sell a year (or a
      // ship's fees, for a line below its limit), growing year on year
      return (
        mine.reduce((s, c) => {
          if (c.type !== "shipping") return s + e.bestAreaGain(c, me);
          const room = c.shipLimit(e.view.era) - e.view.board.shipsOf(c.key).length;
          return s + (room > me.rnd.expansion ? me.rnd.hull * w.shipFee : 0);
        }, 0) *
        e.G *
        w.expansionK
      );
    case "hull": {
      // the fees my lines would earn and the goods I would sell with one more Hull step, against now
      const now = e.lineFees();
      const up = e.lineFees(me);
      const mineKeys = mine.filter((c) => c.type === "shipping").map((c) => c.key);
      const fees = (m: Map<string, number>) => mineKeys.reduce((s, k) => s + (m.get(k) ?? 0), 0);
      return (fees(up.fees) - fees(now.fees) + up.sold - now.sold) * w.demandShare * e.H * w.hullUse;
    }
    case "mergers": {
      const level = me.rnd.mergers + 1;
      let pairs = 0;
      for (let i = 0; i < mine.length; i++)
        for (let j = i + 1; j < mine.length; j++) {
          const same = mine[i].type === mine[j].type || (["rice", "spice"].includes(mine[i].type) && ["rice", "spice"].includes(mine[j].type));
          if (same && mine[i].deedCount + mine[j].deedCount === level) pairs++;
        }
      return w.mergerResearch * e.H * (pairs + 0.3);
    }
    case "bid":
      // a bigger multiplier wins the order of play for less cash, every year
      return w.bidResearch * e.orderValue(me) * e.H;
  }
}

export const v2Rules: Record<string, AiRule<Player, Root, Memory>> = {
  ...v1Rules,

  // acquisitions: a deed is worth its income over the years left. With a slot free, never pass: an era only ends
  // once its companies are taken (P1.1), so bots that wait for a better one can stall the game for ever (tuned
  // weights did, in year 601). Whether a slot is worth having is the Slots research's question.
  "acquire.deed": (opt, ctx) => {
    const e = env(ctx);
    const marker = chitOf<{ deedId: number }>(opt);
    const deed = ctx.view.market.deeds.find((d) => d.deedId === marker.deedId);
    return deed ? e.deedValue(deed) : 0;
  },
  // passing keeps a last free slot for the next era's best company, but only early in an era and never in era C, so
  // the era still ends (P1.1)
  "acquire.pass": (_o, ctx) => {
    const e = env(ctx);
    const { view, me } = ctx;
    // never past an era's second year, whatever the clock says: if every bot kept passing, the era would never end
    if (view.era === "C" || me.freeSlots() !== 1 || e.eraYearsLeft < 2 || view.year - view.eraStartYear >= 2) return -Infinity;
    const next = ERAS[ERAS.indexOf(view.era) + 1];
    const later = view.market.pile.filter((d) => d.spec.era === next);
    return later.length ? e.w.passFuture * Math.max(...later.map((d) => e.deedValue(d))) : -Infinity;
  },

  // mergers: announce the merger expected to gain the most, if it gains enough
  "merger.first": (opt, ctx) => {
    const e = env(ctx);
    const c = companyOf(e, chitOf(opt));
    const pairs = legalMergers(ctx.view, ctx.me).filter((t) => t.a === c || t.b === c);
    return pairs.length ? Math.max(...pairs.map((t) => announceGain(e, t))) : -Infinity;
  },
  "merger.pass": (_o, ctx) => weights(ctx).announceMin,
  "merger.second": (opt, ctx) => {
    const e = env(ctx);
    const first = opt.pick.context as Company | undefined;
    const c = companyOf(e, chitOf(opt));
    const t = legalMergers(ctx.view, ctx.me).find((x) => (x.a === first && x.b === c) || (x.b === first && x.a === c));
    return t ? announceGain(e, t) : -Infinity;
  },
  // the auction: bid the least that leads, up to my reservation; never jump
  "auction.up": () => -20,
  "auction.bid": (_o, ctx) => {
    const r = auction(ctx);
    return r && offered(ctx) <= r.reserve ? 10 : -5;
  },
  "auction.pass": () => 0,

  // research: the step worth the most now
  "research.cell": (opt, ctx) => researchValue(env(ctx), track(opt)),
  // another player's Hull: worth it when my goods ride their ships and their capacity limits my sales (P5.8)
  "research.hull": (opt, ctx) => {
    const e = env(ctx);
    const cube = chitOf<{ seat: number }>(opt);
    const them = ctx.view.players.find((p) => p.seat === cube.seat);
    if (!them) return -Infinity;
    const now = e.lineFees();
    const up = e.lineFees(them);
    const sold = (m: Map<string, number>, p: Player) => m.get(p.playerId) ?? 0;
    const theirFees = (m: Map<string, number>) => them.companies.filter((c) => c.type === "shipping").reduce((s, c) => s + (m.get(c.key) ?? 0), 0);
    const mine = sold(up.soldBy, ctx.me) - sold(now.soldBy, ctx.me);
    const theirs = sold(up.soldBy, them) - sold(now.soldBy, them) + theirFees(up.fees) - theirFees(now.fees);
    return (mine - e.w.rivalGain * theirs) * e.w.demandShare * e.H;
  },
  "research.pass": () => -100,

  // turn order (P2): bid up to what going first is worth this year, within a share of cash. The bid goes to the Bank
  // and still counts at the end; it only costs spending money.
  "bid.up": (opt, ctx) => {
    const e = env(ctx);
    const d = opt.data as { n: number; amount: number };
    const budget = Math.min(ctx.me.cash * e.w.orderCashMax, e.w.orderShade * e.orderValue(ctx.me));
    return d.amount + d.n <= budget ? 1 : -5;
  },

  // selling (P6P.10, P7.1): every offered city pays the same for the good, so the choice is which city to bring
  // nearer to growing. A city that grows buys one more of every produced good each year after, for everyone who can
  // reach it; a delivery that completes its needs is worth that, one that only brings it nearer a share of it.
  "deliver.city": (opt, ctx) => {
    const e = env(ctx);
    const city = chitOf<City>(opt);
    const land = city.parent as LandArea | undefined;
    if (!land || city.size >= 3 || ctx.view.tracks.supply.count((city.size + 1) as CitySize) === 0) return 0;
    const produced = ctx.view.board.producedGoods();
    const good = (opt.pick.context as Company | undefined)?.type as Good | undefined;
    const have = (g: Good) => city.deliveredGoods().filter((d) => d.good === g).length + (g === good ? 1 : 0);
    const met = produced.reduce((s, g) => s + Math.min(city.size, have(g)), 0);
    const needed = produced.length * city.size;
    const worth = e.cityGrowthWorth(land.areaId);
    return met >= needed ? worth : worth * e.w.growthPartial * (met / Math.max(1, needed));
  },
  // the bots choose city by city; "sell the rest" is the human's shortcut
  "deliver.all": () => -Infinity,

  // expansions (P6P.11–P6P.15): an area is worth what it adds to next year's sales over the years left, less its price
  // when bought; a free one is taken wherever it sells most
  "expand.area": (opt, ctx) => {
    const e = env(ctx);
    const c = opt.pick.context as Company | undefined;
    const land = chitOf<LandArea>(opt);
    const mode = (opt.data as { mode: string }).mode;
    if (!c) return 0;
    const price = mode === "paid" ? GOOD_VALUE[c.type as Good] : 0;
    return e.areaGain(c, land.areaId, ctx.me) * e.H - price + 0.01 * landValue(land, ctx.view);
  },
  "expand.done": (opt) => ((opt.data as { mode: string }).mode === "paid" ? 0 : -1),

  // operations: a shipping line first when its new ships can carry this year's goods
  "operate.company": (opt, ctx) => (chitOf<{ type: string }>(opt).type === "shipping" ? 1 + weights(ctx).shipFirst : 1),
};
