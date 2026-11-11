// v2's money model: what a company, a new deed or a merger is worth to a player, in rupiah over the years left,
// read from the board. One Env per prompt (cached on the prompt's options), so the delivery solver runs once per
// company however many options ask.
import { Company } from "../chits/Company";
import { Deed } from "../chits/Deed";
import { Player } from "../chits/Player";
import { Root } from "../chits/Root";
import { DEEDS, ERAS, GOOD_VALUE, Good, TRANSPORT_FEE } from "../consts";
import { DeliveryProblem, maximumDeliveries, zonesOf } from "../logistics";
import { Weights } from "./weights";

/** How many companies must still be started before an era of these types ends: an era ends once what is left on
 *  offer is all one type (P1.1), so the largest group of one type never needs taking. */
function toTake(types: string[]): number {
  const count = new Map<string, number>();
  for (const t of types) count.set(t, (count.get(t) ?? 0) + 1);
  return types.length - Math.max(0, ...count.values());
}

/** A company's money: this year's income and how much it grows each year. */
interface Flow {
  annual: number;
  growth: number;
}

export class Env {
  /** years of income still to come, this one included */
  readonly years: number;
  /** years until this era ends, by the game clock (see the constructor) */
  readonly eraYearsLeft: number;
  /** what a rupiah a year is worth over those years, and a rupiah of growth (t rupiah in year t) */
  readonly H: number;
  readonly G: number;
  private flows = new Map<string, Flow>();
  private fees?: Map<string, number>;
  private memo = new Map<string, number>();
  private memoReach = new Map<string, Set<number>>();
  private memoSales = new Map<string, ReturnType<typeof maximumDeliveries>>();

  constructor(
    readonly view: Root,
    readonly me: Player,
    readonly w: Weights,
  ) {
    // The game clock (P1.1, V1): an era ends once the companies left on offer are all one type, and the game when
    // era C does. So the years left are the companies still to be started, era by era, over how fast the table
    // starts them: this year, every free slot; after that, `takeRate` a player a year (slots researched, merged
    // free). A table that fills its slots fast ends the game fast, and every investment is worth less.
    const players = view.players.copy();
    const free = players.reduce((s, p) => s + Math.max(0, p.freeSlots()), 0);
    const rate = Math.max(0.1, players.length * w.takeRate);
    const now = toTake(view.market.deeds.map((d) => d.spec.type));
    const thisEra = 1 + Math.max(0, now - free) / rate;
    const later = ERAS.slice(ERAS.indexOf(view.era) + 1).reduce((s, era) => s + toTake(DEEDS.filter((d) => d.era === era).map((d) => d.type)) / rate, 0);
    this.eraYearsLeft = thisEra * w.clockScale;
    this.years = (thisEra + later) * w.clockScale;
    let H = 0;
    let G = 0;
    for (let t = 0; t < Math.ceil(this.years); t++) {
      const part = Math.min(1, this.years - t); // the last year may be partial
      H += part * w.decay ** t;
      G += part * t * w.decay ** t;
    }
    this.H = H;
    this.G = G;
  }

  /** A flow's worth over the years left. */
  worth(f: Flow): number {
    return f.annual * this.H + f.growth * this.G;
  }

  players(): Player[] {
    return this.view.players.copy();
  }
  ownerOf(c: Company): Player | undefined {
    return this.players().find((p) => p.companies.copy().includes(c));
  }
  company(key: string): Company | undefined {
    for (const p of this.players()) {
      const c = p.companies.find((x) => x.key === key);
      if (c) return c;
    }
    return undefined;
  }

  /** The delivery network for `good` with `zones`, sold by `seller` (whose own ships cost nothing); `fresh`: next
   *  year's demand (every city's delivered goods are discarded in phase 7). */
  private problem(good: Good, zones: DeliveryProblem["zones"], seller: Player, fresh = false): DeliveryProblem {
    const base = this.view.board.deliveryProblem({ type: good, key: "\u0000" } as unknown as Company, this.players());
    return { ...base, good, zones, sellerId: seller.playerId, cities: fresh ? base.cities.map((c) => ({ ...c, delivered: 0 })) : base.cities };
  }
  private zonesOfCompany(c: Company, extra?: number): DeliveryProblem["zones"] {
    const areas = this.view.board.goodsOf(c.key).map((l) => l.areaId);
    if (extra !== undefined) areas.push(extra);
    return zonesOf(areas).map((zone) => ({ areas: zone, goods: zone.length }));
  }

  /** What one more plantation of `c` on `area` (P6P.12) would sell next year that it does not now, in rupiah a year:
   *  the delivery solver on next year's demand, with and without it. */
  areaGain(c: Company, area: number, owner: Player): number {
    const good = c.type as Good;
    const key = `area|${c.key}|${area}|${owner.playerId}`;
    let g = this.memo.get(key);
    if (g === undefined) {
      const base = this.salesNext(c, owner);
      const more = maximumDeliveries(this.problem(good, this.zonesOfCompany(c, area), owner, true));
      g = (more.count - base.count) * GOOD_VALUE[good] - (more.fee - base.fee);
      this.memo.set(key, g);
    }
    return g * this.w.demandShare;
  }
  private salesNext(c: Company, owner: Player) {
    const key = `next|${c.key}|${owner.playerId}`;
    let r = this.memoSales.get(key);
    if (!r) {
      r = maximumDeliveries(this.problem(c.type as Good, this.zonesOfCompany(c), owner, true));
      this.memoSales.set(key, r);
    }
    return r;
  }
  /** The best area `c` could expand into now, by what it would add a year (0 when nowhere sells more). */
  bestAreaGain(c: Company, owner: Player): number {
    if (c.type === "shipping") return 0;
    let best = 0;
    for (const land of this.view.board.expansionTargets(c)) best = Math.max(best, this.areaGain(c, land.areaId, owner));
    return best;
  }

  /** The cities one of a player's production companies can deliver to at all (a line's chain from a zone to the
   *  city's coast, P6P.3), by land area: the delivery solver with every city wanting plenty. */
  private reachable(c: Company, owner: Player): Set<number> {
    const key = `reach|${c.key}`;
    let r = this.memoReach.get(key);
    if (!r) {
      const zones = this.zonesOfCompany(c).map((z) => ({ ...z, goods: 99 }));
      const prob = this.problem(c.type as Good, zones, owner, true);
      prob.cities = prob.cities.map((city) => ({ ...city, size: 3 as const, delivered: 0 }));
      r = new Set(maximumDeliveries(prob).deliveries.map((d) => prob.cities[d.city].landArea));
      this.memoReach.set(key, r);
    }
    return r;
  }

  /** What a city growing a size is worth to me a year (P7.1, P6P.2): one more of every produced good it then buys,
   *  for each of my production companies that can reach it, less what the same gives my rivals. */
  cityGrowthWorth(landArea: number): number {
    const key = `grow|${landArea}`;
    let v = this.memo.get(key);
    if (v === undefined) {
      let mine = 0;
      let theirs = 0;
      for (const q of this.players()) {
        for (const c of q.companies.filter((x) => x.type !== "shipping")) {
          if (!this.reachable(c, q).has(landArea)) continue;
          if (q === this.me) mine += GOOD_VALUE[c.type as Good];
          else theirs += GOOD_VALUE[c.type as Good];
        }
      }
      v = (mine - this.w.rivalGain * theirs) * this.w.demandShare * this.H;
      this.memo.set(key, v);
    }
    return v;
  }

  /** What going first in the order of play is worth to `p` this year (P6.2): each city buys only so many of a good,
   *  and whoever operates first takes it. Their production's sales with fresh demand, against their sales after
   *  everyone else's companies have sold first. */
  orderValue(p: Player): number {
    const key = `order|${p.playerId}`;
    let v = this.memo.get(key);
    if (v === undefined) {
      v = 0;
      for (const c of p.companies.filter((x) => x.type !== "shipping")) {
        const good = c.type as Good;
        const alone = this.salesNext(c, p).count;
        let prob = this.problem(good, this.zonesOfCompany(c), p, true);
        // everyone else's companies of the same good sell first, taking demand
        for (const q of this.players()) {
          if (q === p) continue;
          for (const o of q.companies.filter((x) => x.type === c.type)) {
            const theirs = maximumDeliveries({ ...prob, zones: this.zonesOfCompany(o), sellerId: q.playerId });
            for (const d of theirs.deliveries) prob = { ...prob, cities: prob.cities.map((cc, i) => (i === d.city ? { ...cc, delivered: cc.delivered + 1 } : cc)) };
          }
        }
        const after = maximumDeliveries(prob).count;
        v += Math.max(0, alone - after) * GOOD_VALUE[good];
      }
      this.memo.set(key, v);
    }
    return v * this.w.demandShare;
  }

  /** What production zones sell in a year for `seller`: goods sold at their value, less fees to others' lines. */
  private produce(good: Good, zones: DeliveryProblem["zones"], seller: Player): Flow {
    const goods = zones.reduce((s, z) => s + z.goods, 0);
    if (!goods) return { annual: 0, growth: 0 };
    const r = maximumDeliveries(this.problem(good, zones, seller));
    const value = GOOD_VALUE[good];
    const annual = (r.count * value - r.fee) * this.w.demandShare + (r.count ? 0 : value * this.w.unservedIncome);
    // a company that sells everything expands for free each year (P6P.11): its income grows by its expansions
    const growth = r.count >= goods ? value * seller.rnd.expansion * this.w.growth * this.w.demandShare : 0;
    return { annual, growth };
  }

  /** Fees every line earns a year from other players' goods (P6P.9): each production company's best sale this year,
   *  as the delivery solver routes it, pays 5 per use of a ship that is not the seller's. `hullFor` raises one
   *  player's Hull by a step (to value researching it). */
  lineFees(hullFor?: Player): { fees: Map<string, number>; sold: number; soldBy: Map<string, number> } {
    const fees = new Map<string, number>();
    const soldBy = new Map<string, number>();
    let sold = 0;
    for (const p of this.players()) {
      for (const c of p.companies.copy()) {
        if (c.type === "shipping") continue;
        const zones = this.view.board.zonesOf(c.key).map((areas) => ({ areas, goods: areas.length }));
        if (!zones.length) continue;
        const prob = this.problem(c.type as Good, zones, p);
        if (hullFor) prob.lines = prob.lines.map((l) => (l.ownerId === hullFor.playerId ? { ...l, hull: l.hull + 1 } : l));
        const r = maximumDeliveries(prob);
        if (p === (hullFor ?? this.me)) sold += r.count * GOOD_VALUE[c.type as Good];
        soldBy.set(p.playerId, (soldBy.get(p.playerId) ?? 0) + r.count * GOOD_VALUE[c.type as Good]);
        for (const d of r.deliveries) {
          const line = prob.lines[d.line];
          if (line.ownerId === p.playerId) continue;
          fees.set(line.companyId, (fees.get(line.companyId) ?? 0) + d.route.length * TRANSPORT_FEE);
        }
      }
    }
    return { fees, sold, soldBy };
  }
  private feesNow(): Map<string, number> {
    return (this.fees ??= this.lineFees().fees);
  }

  /** What a line of `ships` (allowed `limit` this era) earns a year for `owner`: the fees it takes now (`key`), or for
   *  a line not yet on the map a ship's worth per Hull step; and growth while it may add ships. */
  private ship(ships: number, limit: number, owner: Player, key?: string): Flow {
    const productions = owner.companies.filter((c) => c.type !== "shipping").length;
    const fees = key !== undefined ? (this.feesNow().get(key) ?? 0) : ships * owner.rnd.hull * this.w.shipFee;
    const annual = fees * this.w.demandShare + productions * this.w.shipSynergy;
    const growth = ships < limit ? Math.min(owner.rnd.expansion, limit - ships) * owner.rnd.hull * this.w.shipFee * this.w.growth : 0;
    return { annual, growth };
  }

  /** An existing company's yearly money, for its owner (or `as`). */
  flow(c: Company, as?: Player): Flow {
    const owner = as ?? this.ownerOf(c) ?? this.me;
    const key = `${c.key}|${owner.playerId}`;
    let f = this.flows.get(key);
    if (!f) {
      f =
        c.type === "shipping"
          ? this.ship(this.view.board.shipsOf(c.key).length, c.shipLimit(this.view.era), owner, c.key)
          : this.produce(c.type as Good, this.view.board.zonesOf(c.key).map((areas) => ({ areas, goods: areas.length })), owner);
      this.flows.set(key, f);
    }
    return f;
  }
  value(c: Company, as?: Player): number {
    return this.worth(this.flow(c, as));
  }

  /** A deed on offer, started by me now: its best start, served or not. */
  deedValue(deed: Deed): number {
    const d = deed.spec;
    if (d.type === "shipping") {
      const limit = d.ships?.[ERAS.indexOf(this.view.era)] ?? 0;
      return this.worth(this.ship(1, Math.max(1, limit), this.me));
    }
    const areas = this.view.board.legalStartAreas(deed);
    let best = 0;
    for (const a of areas) best = Math.max(best, this.worth(this.produce(d.type as Good, [{ areas: [a.areaId], goods: 1 }], this.me)));
    return best;
  }

  /** The company two companies would make, worth to `winner` (P3.16, P3S: siap saji keeps half the goods). */
  mergedValue(a: Company, b: Company, siapSaji: boolean, winner: Player): number {
    if (a.type === "shipping") {
      const ships = this.view.board.shipsOf(a.key).length + this.view.board.shipsOf(b.key).length;
      const limit = a.shipLimit(this.view.era) + b.shipLimit(this.view.era);
      // both lines' fees now, one line's free carriage for the winner's goods, and growth to the summed limit
      const f = this.ship(ships, Math.max(ships, limit), winner, a.key);
      return this.worth({ annual: f.annual + (this.feesNow().get(b.key) ?? 0) * this.w.demandShare, growth: f.growth });
    }
    let zones = [...this.view.board.zonesOf(a.key), ...this.view.board.zonesOf(b.key)].map((areas) => ({ areas, goods: areas.length }));
    if (siapSaji) {
      // half the rice and spice goods, rounded up, are given up; the rest produce siap saji
      const total = zones.reduce((s, z) => s + z.goods, 0);
      const keep = Math.floor(total / 2);
      let left = keep;
      zones = zones.map((z) => {
        const g = Math.min(z.goods, Math.max(0, Math.round((z.goods * keep) / Math.max(1, total))));
        left -= g;
        return { ...z, goods: g };
      });
      if (left > 0 && zones.length) zones[0].goods += left;
    }
    return this.worth(this.produce(siapSaji ? "siapsaji" : (a.type as Good), zones, winner));
  }

  /** The most `bidder` would pay for a merger: its worth to them, less a slot if it takes one, shaded, and cash. */
  reservation(a: Company, b: Company, siapSaji: boolean, bidder: Player): number {
    const owns = bidder.companies.copy().some((c) => c === a || c === b);
    const slot = owns ? 0 : this.w.slotYear * this.H;
    return Math.min(this.cashOf(bidder), (this.mergedValue(a, b, siapSaji, bidder) - slot) * this.w.bidShade);
  }

  /** A player's money as I know it (S7): exact for me, and for everyone while money is open. With secret money the
   *  bots read only what a player at the table could: the board. Another player's money is estimated as mine,
   *  scaled by the size of their economy (their companies' yearly income) against mine. */
  cashOf(p: Player): number {
    return this.known(p) ? p.cash : this.me.cash * this.economyRatio(p);
  }
  totalOf(p: Player): number {
    return this.known(p) ? p.cash + p.bank : (this.me.cash + this.me.bank) * this.economyRatio(p);
  }
  private known(p: Player): boolean {
    return p === this.me || !this.view.moneyIsSecret();
  }
  private economyRatio(p: Player): number {
    const economy = (q: Player) => 50 + q.companies.copy().reduce((s, c) => s + Math.max(0, this.flow(c, q).annual), 0);
    return Math.min(4, Math.max(0.25, economy(p) / economy(this.me)));
  }
}

const envs = new WeakMap<object, Env>();
/** The Env of this prompt (one per options array, so per prompt and per player). */
export function envOf(options: object, view: Root, me: Player, w: Weights): Env {
  let e = envs.get(options);
  if (!e) {
    e = new Env(view, me, w);
    envs.set(options, e);
  }
  return e;
}
