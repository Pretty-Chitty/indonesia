import { Chit, ChitRenderSpec, Ordered, OrderedOutlet, StaticImage } from "@pretty-chitty/core";
import { MeshPhongMaterial, Vector3 } from "three";
import { DISPLAY } from "../art";
import { CitySize, GOOD_LABEL, GOODS_DISPLAY_H, GOODS_DISPLAY_THICKNESS } from "../consts";
import { CITY_DISPLAYS } from "../geometry/cityDisplays";
import { clickable, colorMaterial, extrudedGlyph, galleryFit, LIFT } from "../render";
import { DeliveredGood } from "./DeliveredGood";

/** A city goods display (C7, P1.6): the rulebook's lobed card in the colour of its city's size, pointing at the city,
 *  with one lobe per size. Each lobe holds one set of goods sold to the city this year, one of each good (P6P.2), so
 *  a city that still buys a good has a lobe without it. It lives inside its city (City.pocket) and rises out to its
 *  area's spot when the year's first good is sold there; at City Growth the goods and then the display sink back into
 *  the city (P7.2), and it comes out next time at the city's new size (P7.3). */
export class GoodsDisplay extends Chit {
  size: CitySize = 1;
  /** the direction it lies away from its city (radians, y up), set as it comes out: its point is at its origin */
  angle = 0;
  /** out beside its city (true) or inside it. Changing it re-renders the display as it comes out: a texture made
   *  while it waited hidden in the city may have been reclaimed by the engine meanwhile (faceMaterial) */
  out = false;
  /** what it holds, kept as text so the summary reads only this chit (set as goods arrive and leave) */
  heldText = "nothing yet";

  @Ordered(new Vector3(0, 0, 0)) lobe0 = new OrderedOutlet<DeliveredGood>();
  @Ordered(new Vector3(0, 0, 0)) lobe1 = new OrderedOutlet<DeliveredGood>();
  @Ordered(new Vector3(0, 0, 0)) lobe2 = new OrderedOutlet<DeliveredGood>();

  private lobes(): OrderedOutlet<DeliveredGood>[] {
    return [this.lobe0, this.lobe1, this.lobe2].slice(0, this.size);
  }

  goods(): DeliveredGood[] {
    return [this.lobe0, this.lobe1, this.lobe2].flatMap((l) => l.copy());
  }

  /** Lay a good on the first lobe (from the point) without one of its kind, on top of what is there. */
  place(good: DeliveredGood) {
    const lobes = this.lobes();
    const lobe = lobes.find((l) => !l.some((g) => g.good === good.good)) ?? lobes[lobes.length - 1];
    good.level = lobe.length;
    lobe.add(good);
    this.heldText = describe(this.goods());
  }

  override render(spec: ChitRenderSpec): void {
    clickable(spec);
    const d = CITY_DISPLAYS[this.size];
    const h = GOODS_DISPLAY_H;
    const w = h * d.aspect;
    const mesh = extrudedGlyph(d.points, d.aspect, h, GOODS_DISPLAY_THICKNESS, [faceMaterial(this.size), colorMaterial(d.edge, 20)]);
    // the face image spans the outline's bounding box (as the goods markers' prints do)
    const pos = mesh.geometry.getAttribute("position");
    const uv = mesh.geometry.getAttribute("uv");
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h + 0.5);
    uv.needsUpdate = true;
    // the point at the origin, the lobes running away from the city along `angle`
    const tip = { x: (d.tip[0] - 0.5) * w, y: (d.tip[1] - 0.5) * h };
    mesh.geometry.translate(-tip.x, -tip.y, 0);
    mesh.geometry.rotateZ(this.angle);
    spec.object = mesh;
    // the goods stand on the lobes, upright to the table whichever way the display lies
    const c = Math.cos(this.angle);
    const s = Math.sin(this.angle);
    d.lobes.forEach(([lx, ly], i) => {
      const x = (lx - 0.5) * w - tip.x;
      const y = (ly - 0.5) * h - tip.y;
      spec.outletPositions[`lobe${i}`] = new Vector3(x * c - y * s, x * s + y * c, GOODS_DISPLAY_THICKNESS);
    });
    spec.childrenOffsetZ = 0;
    spec.zLiftRatio = LIFT.piece;
    spec.showDetailsOnLongPress = true;
    galleryFit(spec, d.aspect, 1, 320);
    spec.summary = `**Goods display of a size ${this.size} city**. It holds the goods sold to the city this year, one of each good on each lobe: the city buys ${this.size} of each good produced on the board. Holding: ${this.heldText}.`;
  }
}

function describe(goods: DeliveredGood[]): string {
  const counts = new Map<string, number>();
  for (const g of goods) counts.set(GOOD_LABEL[g.good], (counts.get(GOOD_LABEL[g.good]) ?? 0) + 1);
  return counts.size ? [...counts].map(([label, n]) => `${n} ${label}`).join(", ") : "nothing yet";
}

const faceCache = new Map<CitySize, MeshPhongMaterial>();
/** The printed face. The engine reclaims the texture of a piece out of sight (a display inside its city) and hands
 *  out a new one when asked again, so the material is rebuilt whenever the texture it was made with has gone. */
function faceMaterial(size: CitySize): MeshPhongMaterial {
  const map = StaticImage.texture(DISPLAY[size]);
  let m = faceCache.get(size);
  if (!m || m.map !== map) {
    m = new MeshPhongMaterial({ map, shininess: 6 });
    faceCache.set(size, m);
  }
  return m;
}
