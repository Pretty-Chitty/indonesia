// Delivering goods (P6P.2–P6P.10) as a flow problem over a plain snapshot of the board, so one piece of code
// answers "what is the most this company can sell?" for the rule, for each prompt's legal set, and for the AI.
//
// Network for one production company (one goods type): source -> each production zone (capacity = goods in the
// zone, P6P.1) -> the sea areas touching the zone that hold ships of some shipping line -> along that line's ships
// through adjacent sea areas (a sea area with k ships of the line passes k x hull goods, P6P.7, less the uses already
// spent this operation) -> a city whose land touches a sea holding a ship of the line (P6P.3) -> sink (capacity =
// the city's remaining demand for this good, P6P.2). Goods never change line mid-route (P6P.6): sea nodes are per
// line. Every ship use costs the transport fee (P6P.9), so the min-cost max-flow is the cheapest maximal sale.
import { coastLands, coastSeas, landNeighbours, seaNeighbours } from "./geometry/mapIndex";
import { CitySize, Good, TRANSPORT_FEE } from "./consts";

export interface ZoneSnap {
  /** the land area ids of one contiguous production zone */
  areas: number[];
  /** goods still unsold in the zone */
  goods: number;
}
export interface LineSnap {
  companyId: string;
  ownerId: string;
  /** hull level of the line's owner: goods per ship per production company (P5.4, P6P.7) */
  hull: number;
  /** sea area id -> number of this line's ships there */
  ships: Map<number, number>;
  /** sea area id -> ship uses already spent there by this production company this operation */
  used: Map<number, number>;
}
export interface CitySnap {
  landArea: number;
  size: CitySize;
  /** goods of this type already delivered this year */
  delivered: number;
}
export interface DeliveryProblem {
  good: Good;
  /** the producing company's owner: their own ships cost them nothing net (P6P.9), so the cheapest sale uses them
   *  before anyone else's */
  sellerId?: string;
  zones: ZoneSnap[];
  lines: LineSnap[];
  cities: CitySnap[];
}
/** One good delivered: from zone `zone`, via line `line`, to city `city`, through the sea areas `route` (one ship
 *  use in each). Indices are into the problem's arrays. */
export interface Delivery {
  zone: number;
  line: number;
  city: number;
  route: number[];
}

/** Contiguous zones of one company's goods (P6P.1): land adjacency, arrows included. */
export function zonesOf(areas: number[]): number[][] {
  const left = new Set(areas);
  const zones: number[][] = [];
  while (left.size) {
    const start = left.values().next().value as number;
    const zone: number[] = [];
    const stack = [start];
    left.delete(start);
    while (stack.length) {
      const a = stack.pop()!;
      zone.push(a);
      for (const n of landNeighbours(a)) {
        if (left.has(n)) {
          left.delete(n);
          stack.push(n);
        }
      }
    }
    zones.push(zone.sort((x, y) => x - y));
  }
  return zones;
}

// --- a small min-cost max-flow (unit augmentations; the graphs here have a few hundred edges) --------------------
interface Edge {
  to: number;
  cap: number;
  cost: number;
  rev: number;
  /** flow carried, kept only on forward edges, for the decomposition */
  flow: number;
  forward: boolean;
}
class Flow {
  g: Edge[][] = [];
  constructor(n: number) {
    for (let i = 0; i < n; i++) this.g.push([]);
  }
  add(a: number, b: number, cap: number, cost = 0) {
    this.g[a].push({ to: b, cap, cost, rev: this.g[b].length, flow: 0, forward: true });
    this.g[b].push({ to: a, cap: 0, cost: -cost, rev: this.g[a].length - 1, flow: 0, forward: false });
  }
  /** Augments one unit at a time along the cheapest residual path (Bellman-Ford: costs can go negative). */
  run(s: number, t: number, maxUnits = Infinity): { flow: number; cost: number } {
    let flow = 0;
    let cost = 0;
    const n = this.g.length;
    while (flow < maxUnits) {
      const dist = new Array<number>(n).fill(Infinity);
      const prevNode = new Array<number>(n).fill(-1);
      const prevEdge = new Array<number>(n).fill(-1);
      dist[s] = 0;
      let changed = true;
      for (let iter = 0; iter < n && changed; iter++) {
        changed = false;
        for (let u = 0; u < n; u++) {
          if (dist[u] === Infinity) continue;
          this.g[u].forEach((e, i) => {
            if (e.cap > 0 && dist[u] + e.cost < dist[e.to]) {
              dist[e.to] = dist[u] + e.cost;
              prevNode[e.to] = u;
              prevEdge[e.to] = i;
              changed = true;
            }
          });
        }
      }
      if (dist[t] === Infinity) break;
      for (let v = t; v !== s; v = prevNode[v]) {
        const e = this.g[prevNode[v]][prevEdge[v]];
        e.cap -= 1;
        this.g[v][e.rev].cap += 1;
        if (e.forward) e.flow += 1;
        else this.g[v][e.rev].flow -= 1; // cancelling flow on the forward edge
      }
      flow += 1;
      cost += dist[t];
    }
    return { flow, cost };
  }
  /** Peels the final flow into unit source->sink paths (node lists). */
  decompose(s: number, t: number): number[][] {
    const paths: number[][] = [];
    for (;;) {
      const path = [s];
      let v = s;
      const seen = new Set([s]);
      while (v !== t) {
        const e = this.g[v].find((x) => x.forward && x.flow > 0 && !seen.has(x.to));
        if (!e) break;
        e.flow -= 1;
        v = e.to;
        seen.add(v);
        path.push(v);
      }
      if (v !== t) break;
      paths.push(path);
    }
    return paths;
  }
}

type Meta = { kind: "zone" | "city" | "seaIn" | "seaOut"; zone?: number; city?: number; line?: number; sea?: number };
interface Net {
  flow: Flow;
  source: number;
  sink: number;
  meta: Map<number, Meta>;
}

const OWN_SHIP_COST = 1;
/** an opponent's ship use always costs more than any route of the seller's own ships */
const OTHER_SHIP_WEIGHT = 100;

/** With `forced`, the network only admits one unit from that zone, along that line, to that city. */
function buildNet(p: DeliveryProblem, forced?: { zone: number; line: number; city: number }): Net {
  const meta = new Map<number, Meta>();
  let n = 2;
  const source = 0;
  const sink = 1;
  const zoneNode = p.zones.map((_, i) => {
    meta.set(n, { kind: "zone", zone: i });
    return n++;
  });
  const cityNode = p.cities.map((_, i) => {
    meta.set(n, { kind: "city", city: i });
    return n++;
  });
  const seaIn = new Map<string, number>();
  const seaOut = new Map<string, number>();
  p.lines.forEach((l, li) => {
    for (const sea of l.ships.keys()) {
      meta.set(n, { kind: "seaIn", line: li, sea });
      seaIn.set(`${li}:${sea}`, n++);
      meta.set(n, { kind: "seaOut", line: li, sea });
      seaOut.set(`${li}:${sea}`, n++);
    }
  });
  const flow = new Flow(n);
  p.zones.forEach((z, zi) => {
    if (forced && forced.zone !== zi) return;
    flow.add(source, zoneNode[zi], forced ? Math.min(1, z.goods) : z.goods);
  });
  p.lines.forEach((l, li) => {
    if (forced && forced.line !== li) return;
    for (const [sea, count] of l.ships) {
      const a = seaIn.get(`${li}:${sea}`)!;
      const b = seaOut.get(`${li}:${sea}`)!;
      const capacity = count * l.hull - (l.used.get(sea) ?? 0);
      // what a ship use costs the seller: an opponent's ship 5 paid away; their own nothing, counted as a token 1
      // per ship so a shorter route of their own still beats a longer one
      flow.add(a, b, Math.max(0, capacity), l.ownerId === p.sellerId ? OWN_SHIP_COST : TRANSPORT_FEE * OTHER_SHIP_WEIGHT);
      for (const next of seaNeighbours(sea)) {
        if (l.ships.has(next)) flow.add(b, seaIn.get(`${li}:${next}`)!, 1e9);
      }
      const lands = new Set(coastLands(sea));
      p.zones.forEach((z, zi) => {
        if (forced && forced.zone !== zi) return;
        if (z.areas.some((area) => lands.has(area))) flow.add(zoneNode[zi], a, 1e9);
      });
      p.cities.forEach((c, ci) => {
        if (forced && forced.city !== ci) return;
        if (lands.has(c.landArea)) flow.add(b, cityNode[ci], 1e9);
      });
    }
  });
  p.cities.forEach((c, ci) => {
    if (forced && forced.city !== ci) return;
    const demand = Math.max(0, c.size - c.delivered);
    flow.add(cityNode[ci], sink, forced ? Math.min(1, demand) : demand);
  });
  return { flow, source, sink, meta };
}

function pathToDelivery(net: Net, path: number[]): Delivery {
  const d: Delivery = { zone: -1, line: -1, city: -1, route: [] };
  for (const v of path) {
    const m = net.meta.get(v);
    if (!m) continue;
    if (m.kind === "zone") d.zone = m.zone!;
    if (m.kind === "city") d.city = m.city!;
    if (m.kind === "seaIn") {
      d.line = m.line!;
      d.route.push(m.sea!);
    }
  }
  return d;
}

/** The most goods the company can sell now (P6P.10) and the cheapest set of deliveries for the seller that does it;
 *  `fee` is what they pay to other players' lines. */
export function maximumDeliveries(p: DeliveryProblem): { count: number; fee: number; deliveries: Delivery[] } {
  const net = buildNet(p);
  const r = net.flow.run(net.source, net.sink);
  const deliveries = net.flow.decompose(net.source, net.sink).map((path) => pathToDelivery(net, path));
  return { count: r.flow, fee: deliveries.reduce((sum, d) => sum + feePaid(p, d), 0), deliveries };
}

/** What the seller pays other players for one delivery: 5 per ship use on a line that is not theirs (P6P.9). */
export function feePaid(p: DeliveryProblem, d: Delivery): number {
  return p.lines[d.line].ownerId === p.sellerId ? 0 : d.route.length * TRANSPORT_FEE;
}

/** The problem after one delivery: one less good in the zone, one more delivered at the city, one more ship use
 *  in every sea of the route. */
export function applyDelivery(p: DeliveryProblem, d: Delivery): DeliveryProblem {
  return {
    good: p.good,
    sellerId: p.sellerId,
    zones: p.zones.map((z, i) => (i === d.zone ? { ...z, goods: z.goods - 1 } : z)),
    cities: p.cities.map((c, i) => (i === d.city ? { ...c, delivered: c.delivered + 1 } : c)),
    lines: p.lines.map((l, i) => {
      if (i !== d.line) return l;
      const used = new Map(l.used);
      for (const sea of d.route) used.set(sea, (used.get(sea) ?? 0) + 1);
      return { ...l, used };
    }),
  };
}

/** Every (zone, line, city) the player may choose next: one that is reachable, taken by its cheapest route, and
 *  that still leaves the rest of the maximum sellable (P6P.10). */
export function legalDeliveryChoices(p: DeliveryProblem): { max: number; choices: (Delivery & { fee: number })[] } {
  const max = maximumDeliveries(p).count;
  const choices: (Delivery & { fee: number })[] = [];
  if (max === 0) return { max, choices };
  p.zones.forEach((_, zone) =>
    p.lines.forEach((_, line) =>
      p.cities.forEach((_, city) => {
        const forcedNet = buildNet(p, { zone, line, city });
        const one = forcedNet.flow.run(forcedNet.source, forcedNet.sink, 1);
        if (one.flow < 1) return;
        const path = forcedNet.flow.decompose(forcedNet.source, forcedNet.sink)[0];
        const d = pathToDelivery(forcedNet, path);
        const rest = buildNet(applyDelivery(p, d));
        if (rest.flow.run(rest.source, rest.sink).flow >= max - 1) choices.push({ ...d, fee: feePaid(p, d) });
      }),
    ),
  );
  return { max, choices };
}

/** Sea areas a shipping company may add a ship to (P6S.4): any sea holding one of its ships, or adjacent to one. */
export function shipExpansionSeas(ships: Iterable<number>): number[] {
  const out = new Set<number>();
  for (const s of ships) {
    out.add(s);
    seaNeighbours(s).forEach((n) => out.add(n));
  }
  return [...out];
}

/** Sea areas a new shipping company may start in (P4.7): those bordering the deed's province. */
export function seasBorderingAreas(areas: number[]): number[] {
  const out = new Set<number>();
  areas.forEach((a) => coastSeas(a).forEach((s) => out.add(s)));
  return [...out];
}
