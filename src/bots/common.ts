// Board readings shared by the bots (v1 and v2): what a chit option is, who owns what, where ships and cities are.
import { AiOption } from "@pretty-chitty/core";
import { LandArea } from "../chits/LandArea";
import { Player } from "../chits/Player";
import { Root } from "../chits/Root";
import { coastSeas, seaNeighbours } from "../geometry/mapIndex";

export type Memory = Record<string, never>;

/** The chit of a chit option (every key below that reads one is only ever tagged on a Chit.pick). */
export function chitOf<X>(opt: AiOption): X {
  return (opt as { chit?: unknown }).chit as X;
}

/** The option is one of my companies: the company itself, a deed, or one of its plantations or ships on the map. */
export function ownsDeed(me: Player, opt: AiOption): boolean {
  const x = chitOf<{ deedId?: number; companyId?: string }>(opt);
  return me.companies.some((c) => (c as object) === x || c.key === x.companyId || c.deeds.some((d) => d.deedId === x.deedId));
}

/** Sea areas holding any ship, the seas and lands of every city, and the lands with goods, read off the board. */
export function boardFacts(view: Root) {
  const shipSeas = new Set<number>();
  view.board.seas.forEach((s) => {
    if (s.ships.length) shipSeas.add(s.areaId);
  });
  const citySeas = new Set<number>();
  const cityLands = new Set<number>();
  const goodsLands = new Set<number>();
  view.board.lands.forEach((l) => {
    if (l.city) {
      cityLands.add(l.areaId);
      coastSeas(l.areaId).forEach((s) => citySeas.add(s));
    }
    if (l.good) goodsLands.add(l.areaId);
  });
  return { shipSeas, citySeas, cityLands, goodsLands };
}

/** Sea-area steps from `from` to the nearest sea in `targets` (BFS over sea adjacency), or 99. */
export function seaDistance(from: number, targets: Set<number>): number {
  if (targets.has(from)) return 0;
  const seen = new Set([from]);
  let frontier = [from];
  for (let d = 1; d < 8 && frontier.length; d++) {
    const next: number[] = [];
    for (const s of frontier) {
      for (const n of seaNeighbours(s)) {
        if (seen.has(n)) continue;
        if (targets.has(n)) return d;
        seen.add(n);
        next.push(n);
      }
    }
    frontier = next;
  }
  return 99;
}

/** How well a land area is served: it touches a sea with ships (goods can leave) and is near a city's sea. */
export function landValue(land: LandArea, view: Root): number {
  const f = boardFacts(view);
  const seas = coastSeas(land.areaId);
  if (!seas.length) return 0.2;
  const served = seas.some((s) => f.shipSeas.has(s)) ? 2 : 0;
  const near = Math.min(...seas.map((s) => seaDistance(s, f.citySeas)));
  return 1 + served + Math.max(0, 3 - near);
}

