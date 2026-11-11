import { Chit, ChitRenderSpec, Ordered, OrderedOutlet } from "@pretty-chitty/core";
import { ExtrudeGeometry, Mesh, Path, Shape, Vector3 } from "three";
import { CITY_COLOR, CITY_RING_DIAMETER, CITY_RING_HEIGHT, CitySize, GOODS_DISPLAY_RAISE } from "../consts";
import { DISPLAY_SPOTS } from "../geometry/displaySpots";
import { clickable, colorMaterial, galleryFit, LIFT, outlineFor } from "../render";
import { DeliveredGood } from "./DeliveredGood";
import { GoodsDisplay } from "./GoodsDisplay";

/** A city marker (C7): a wooden ring in the colour of its size, on the LandArea it was built in (P1.7). Its goods
 *  display (P1.6) lives inside it and comes out, floating beside it at its area's spot, while it holds the year's
 *  delivered goods (P6P.2). */
export class City extends Chit {
  size: CitySize = 1;
  /** the land area it stands in, for its display's spot (DISPLAY_SPOTS) */
  areaId = 0;
  /** the size its display came out at: the spot it stands on (a city grows while its display is still out) */
  displaySize: CitySize = 1;

  /** the goods display while it holds goods: at its area's spot for this size, raised off the board */
  @Ordered(new Vector3(0, 0, 0)) shown = new OrderedOutlet<GoodsDisplay>();
  /** where the display waits between years: inside the ring, hidden once it is there (shouldRenderChild) */
  @Ordered(new Vector3(0, 0, 0)) pocket = new OrderedOutlet<GoodsDisplay>();

  display(): GoodsDisplay {
    return this.shown.length ? this.shown.get(0) : this.pocket.get(0);
  }

  /** this year's goods sold to the city (P6P.2) */
  deliveredGoods(): DeliveredGood[] {
    return this.display().goods();
  }

  /** The display comes out of the city to its spot, at the city's size (the year's first good sold here). */
  openDisplay(): GoodsDisplay {
    const d = this.display();
    if (d.parentOutlet === "pocket") {
      // it changes size only here, out of sight inside the city (P7.3: "replace its goods display")
      d.size = this.size;
      d.angle = DISPLAY_SPOTS[this.areaId][this.size - 1].angle;
      this.displaySize = this.size;
      d.out = true;
      this.shown.add(d);
    }
    return d;
  }

  /** The year's goods are used up (P7.2): each sinks into the city and is gone; then the empty display follows. */
  clearGoods() {
    // a good's fallback is this city (set as it lands), which never draws it: removed, it slides into the ring
    for (const g of this.deliveredGoods()) g.removeFromParent();
    this.display().heldText = "nothing yet";
  }

  closeDisplay() {
    const d = this.display();
    if (d.parentOutlet === "shown") {
      d.out = false;
      this.pocket.add(d);
    }
  }

  /** The display in its pocket and the goods it held are inside the ring: drawn while they sink in, hidden once
   *  there. */
  override shouldRenderChild(child: Chit): boolean {
    return child.parentOutlet !== "pocket" && !(child instanceof DeliveredGood);
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
    const spot = DISPLAY_SPOTS[this.areaId]?.[this.displaySize - 1];
    if (spot) spec.outletPositions.shown = new Vector3(spot.dx, spot.dy, GOODS_DISPLAY_RAISE);
    spec.childrenOffsetZ = 0;
    spec.zLiftRatio = LIFT.piece;
    // amber ring on tan land, red ring on the red-brown islands: outline in its own colour, darkened
    spec.highlight.color = outlineFor(CITY_COLOR[this.size]);
    spec.showDetailsOnLongPress = true;
    galleryFit(spec, 1, 1, 260);
    spec.summary = `**Size ${this.size} city**. It buys ${this.size} of each good produced anywhere on the board, and grows one size at the end of a year in which it received all of them. Its goods display beside it shows what it has bought this year.`;
  }
}
