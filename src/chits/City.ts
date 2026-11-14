import { Chit, ChitRenderSpec } from "@pretty-chitty/core";
import { ExtrudeGeometry, Mesh, Path, Shape } from "three";
import { CITY_COLOR, CITY_RING_DIAMETER, CITY_RING_HEIGHT, CitySize } from "../consts";
import { DISPLAY_SPOTS } from "../geometry/displaySpots";
import { clickable, colorMaterial, galleryFit, LIFT, outlineFor } from "../render";
import { DeliveredGood } from "./DeliveredGood";
import { GoodsDisplay } from "./GoodsDisplay";
import type { LandArea } from "./LandArea";

/** A city marker (C7): a wooden ring in the colour of its size, on the LandArea it was built in (P1.7). Its goods
 *  display (P1.6) rises out of it to its area's spot while it holds the year's delivered goods (P6P.2), and sinks
 *  back into it at City Growth. */
export class City extends Chit {
  size: CitySize = 1;
  /** the land area it stands in, for its display's spot (DISPLAY_SPOTS) */
  areaId = 0;

  private get land(): LandArea {
    return this.parent as LandArea;
  }

  /** the goods display, while it is out (it stands on the city's land area, LandArea.display) */
  display(): GoodsDisplay | undefined {
    const d = this.land?.display;
    return d?.length ? d.get(0) : undefined;
  }

  /** this year's goods sold to the city (P6P.2) */
  deliveredGoods(): DeliveredGood[] {
    return this.display()?.goods() ?? [];
  }

  /** The display comes out of the city to its spot, at the city's size (the year's first good sold here). It is a
   *  new piece each year, made inside the city (its fallback, which never draws it), so it is seen rising out of
   *  the ring; at City Growth it is taken away and slides back in (P7.3: "replace its goods display"). Moving one
   *  display between a hidden outlet of the city and a shown one did not work: on other players' screens it often
   *  stayed invisible, and the goods landing on it with it. */
  openDisplay(): GoodsDisplay {
    const out = this.display();
    if (out) return out;
    const spot = DISPLAY_SPOTS[this.areaId]?.[this.size - 1] ?? { dx: 0, dy: 0, angle: 0 };
    const d = new GoodsDisplay().set((x) => {
      x.parentFallback = this;
      x.size = this.size;
      x.angle = spot.angle;
      x.dx = spot.dx;
      x.dy = spot.dy;
    });
    this.land.display.add(d);
    return d;
  }

  /** The year's goods are used up (P7.2): each sinks into the city and is gone. */
  clearGoods() {
    // a good's fallback is this city (set as it lands), which never draws it: removed, it slides into the ring
    for (const g of this.deliveredGoods()) g.removeFromParent();
  }

  /** Then the empty display follows them into the city. */
  closeDisplay() {
    this.display()?.removeFromParent();
  }

  /** The display and the goods it held go into the ring: drawn while they move, hidden once there. */
  override shouldRenderChild(child: Chit): boolean {
    return !(child instanceof DeliveredGood) && !(child instanceof GoodsDisplay);
  }

  override render(spec: ChitRenderSpec): void {
    clickable(spec);
    const r = CITY_RING_DIAMETER / 2;
    const shape = new Shape();
    shape.absarc(0, 0, r, 0, Math.PI * 2, false);
    const hole = new Path();
    hole.absarc(0, 0, r * 0.58, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const geom = new ExtrudeGeometry(shape, { depth: CITY_RING_HEIGHT, bevelEnabled: false, curveSegments: 24 });
    const mesh = new Mesh(geom, colorMaterial(CITY_COLOR[this.size], 30));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    spec.object = mesh;
    spec.childrenOffsetZ = 0;
    spec.zLiftRatio = LIFT.piece;
    // amber ring on tan land, red ring on the red-brown islands: outline in its own colour, darkened
    spec.highlight.color = outlineFor(CITY_COLOR[this.size]);
    // the display and goods rising out of it or sinking back keep their own outlines, not the city's
    spec.highlight.childrenInheritOutline = false;
    spec.showDetailsOnLongPress = true;
    galleryFit(spec, 1, 1, 260);
    spec.summary = `**Size ${this.size} city**. It buys ${this.size} of each good produced anywhere on the board, and grows one size at the end of a year in which it received all of them. Its goods display beside it shows what it has bought this year.`;
  }
}
