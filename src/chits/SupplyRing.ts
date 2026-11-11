import { Chit, ChitRenderSpec } from "@pretty-chitty/core";
import { ExtrudeGeometry, Mesh, Path, Shape } from "three";
import { CITY_COLOR, CITY_RING_DIAMETER, CITY_RING_HEIGHT, CitySize } from "../consts";
import { colorMaterial } from "../render";

const geomCache = new Map<number, ExtrudeGeometry>();
function ringGeometry(): ExtrudeGeometry {
  let g = geomCache.get(0);
  if (!g) {
    const r = CITY_RING_DIAMETER / 2;
    const shape = new Shape();
    shape.absarc(0, 0, r, 0, Math.PI * 2, false);
    const hole = new Path();
    hole.absarc(0, 0, r * 0.58, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    g = new ExtrudeGeometry(shape, { depth: CITY_RING_HEIGHT, bevelEnabled: false, curveSegments: 24 });
    geomCache.set(0, g);
  }
  return g;
}

/** An unused city marker (C7) in the supply beside the Tracks, stacked with the others of its size. */
export class SupplyRing extends Chit {
  size: CitySize = 1;

  override render(spec: ChitRenderSpec): void {
    const m = new Mesh(ringGeometry(), colorMaterial(CITY_COLOR[this.size], 30));
    m.castShadow = true;
    m.receiveShadow = true;
    spec.object = m;
    spec.offsetZ = (this.parentOutletIndex ?? 0) * CITY_RING_HEIGHT;
    spec.worthSlidingToPanelToShowChange = false;
  }
}
