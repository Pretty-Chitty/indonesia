// The board graph, built once from the generated geometry (map.ts): adjacency between land areas (shared border or
// arrow, M3/M4), between sea areas (M2), and the coast contacts (M5). Pure data; the chits and the AI both read it.
import { ARROWS, COAST, CROP_RECT, LAND_ADJACENT, LAND_AREAS, SEA_ADJACENT, SEA_AREAS, LandAreaGeom, Px, SeaAreaGeom } from "./map";
import { BOARD_PX_PER_UNIT, Province, PROVINCES } from "../consts";

export const landById = new Map<number, LandAreaGeom>(LAND_AREAS.map((a) => [a.id, a]));
export const seaById = new Map<number, SeaAreaGeom>(SEA_AREAS.map((a) => [a.id, a]));

function addEdge(m: Map<number, Set<number>>, a: number, b: number) {
  if (!m.has(a)) m.set(a, new Set());
  if (!m.has(b)) m.set(b, new Set());
  m.get(a)!.add(b);
  m.get(b)!.add(a);
}

const landAdj = new Map<number, Set<number>>();
LAND_ADJACENT.forEach(([a, b]) => addEdge(landAdj, a, b));
ARROWS.forEach(([a, b]) => addEdge(landAdj, a, b));
const seaAdj = new Map<number, Set<number>>();
SEA_ADJACENT.forEach(([a, b]) => addEdge(seaAdj, a, b));
const coastSeasByLand = new Map<number, Set<number>>();
const coastLandsBySea = new Map<number, Set<number>>();
COAST.forEach(([land, sea]) => {
  if (!coastSeasByLand.has(land)) coastSeasByLand.set(land, new Set());
  if (!coastLandsBySea.has(sea)) coastLandsBySea.set(sea, new Set());
  coastSeasByLand.get(land)!.add(sea);
  coastLandsBySea.get(sea)!.add(land);
});

/** A depth layer per land area, different for any two areas whose goods markers could overlap (poles closer than
 *  two markers' half-diagonals, 0.95: they are at most 0.7 x 0.72): the markers' printed tops sit at the same
 *  height, and where two overlap they would flicker (z-fight). The higher layer's print is drawn over the lower
 *  one's. Greedy colouring, by area id: five layers. */
const LAND_LAYER = (() => {
  const near = 0.95 * BOARD_PX_PER_UNIT;
  const layer = new Map<number, number>();
  for (const a of LAND_AREAS) {
    const taken = new Set(LAND_AREAS.filter((b) => layer.has(b.id) && Math.hypot(a.pole[0] - b.pole[0], a.pole[1] - b.pole[1]) < near).map((b) => layer.get(b.id)));
    let k = 0;
    while (taken.has(k)) k++;
    layer.set(a.id, k);
  }
  return layer;
})();
export function landLayer(id: number): number {
  return LAND_LAYER.get(id) ?? 0;
}

/** Land areas adjacent to a land area: shared border, or an arrow across water (M3, M4). */
export function landNeighbours(id: number): number[] {
  return [...(landAdj.get(id) ?? [])];
}
/** Sea areas sharing a border with a sea area (M2). */
export function seaNeighbours(id: number): number[] {
  return [...(seaAdj.get(id) ?? [])];
}
/** Sea areas touching a land area (M5). */
export function coastSeas(land: number): number[] {
  return [...(coastSeasByLand.get(land) ?? [])];
}
/** Land areas touching a sea area. */
export function coastLands(sea: number): number[] {
  return [...(coastLandsBySea.get(sea) ?? [])];
}

const byProvince = new Map<string, number[]>();
LAND_AREAS.forEach((a) => {
  if (!byProvince.has(a.province)) byProvince.set(a.province, []);
  byProvince.get(a.province)!.push(a.id);
});
/** The land areas of a province (M1). */
export function provinceAreas(p: Province): number[] {
  return byProvince.get(p) ?? [];
}

/** The shown board (CROP_RECT) in world units: its size, and its centre is the world origin. */
export const SHOWN_W = (CROP_RECT[2] - CROP_RECT[0]) / BOARD_PX_PER_UNIT;
export const SHOWN_H = (CROP_RECT[3] - CROP_RECT[1]) / BOARD_PX_PER_UNIT;
/** Board pixels (y down) -> world units (y up), centred on the shown board. */
export function toWorld([px, py]: Px): { x: number; y: number } {
  return {
    x: (px - (CROP_RECT[0] + CROP_RECT[2]) / 2) / BOARD_PX_PER_UNIT,
    y: ((CROP_RECT[1] + CROP_RECT[3]) / 2 - py) / BOARD_PX_PER_UNIT,
  };
}
/** A ring of board pixels as world points relative to an origin pixel. */
export function ringToWorld(ring: Px[], origin: Px): [number, number][] {
  return ring.map(([x, y]) => [(x - origin[0]) / BOARD_PX_PER_UNIT, (origin[1] - y) / BOARD_PX_PER_UNIT]);
}

// load-time checks against the rulebook (M1: 26 provinces, every province has a coastal area for a city)
if (byProvince.size !== 26) throw new Error(`mapIndex: ${byProvince.size} provinces in map.ts, expected 26`);
for (const p of PROVINCES) {
  const areas = provinceAreas(p);
  if (!areas.length) throw new Error(`mapIndex: province ${p} has no land areas`);
  if (!areas.some((a) => landById.get(a)!.coastal)) throw new Error(`mapIndex: province ${p} has no coastal area`);
}
