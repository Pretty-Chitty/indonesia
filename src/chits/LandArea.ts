import { Chit, ChildOutlet, ChitRenderSpec, Ordered, OrderedOutlet } from "@pretty-chitty/core";
import { GOODS_MARKER_THICKNESS } from "../consts";
import { Group, Vector3 } from "three";
import { CITY_CARDS, DEEDS, ERAS, GOOD_LABEL, Province } from "../consts";
import { landById, ringToWorld, toWorld } from "../geometry/mapIndex";
import { clickable, flatPolygon, galleryFit, UNDER_BOARD, underBoardShape } from "../render";
import { GoodsMarker } from "./GoodsMarker";
import { City } from "./City";
import { GoodsDisplay } from "./GoodsDisplay";

/** What each era brings to a province (M6): its city cards and its company deeds, read from the same tables the
 *  rules use. These are the symbols printed beside each province's name. */
function provinceOutlook(p: Province): string {
  return ERAS.map((era) => {
    const parts: string[] = [];
    if (CITY_CARDS.some((c) => c.era === era && c.provinces.includes(p))) parts.push("city");
    for (const d of DEEDS.filter((x) => x.era === era && x.province === p)) parts.push(GOOD_LABEL[d.type]);
    return `${era}: ${parts.length ? parts.join(", ") : "–"}`;
  }).join(" · ");
}

/** One printed land area (M1): an invisible click target in the exact shape of the print. A goods marker, a city
 *  or a company start marker sits on its pole. Long-press shows the area cut from the board and what it is for. */
export class LandArea extends Chit {
  areaId = 0;
  province: Province = "Aceh";
  coastal = false;

  /** at most one goods marker (P4.6, P6P.12) */
  @Ordered(new Vector3(0, 0, 0)) goods = new OrderedOutlet<GoodsMarker>();
  @ChildOutlet(new Vector3(0, 0, 0)) city?: City;
  /** the city's goods display while it is out (City.openDisplay): it stands at its own spot beside the city */
  @Ordered(new Vector3(0, 0, 0)) display = new OrderedOutlet<GoodsDisplay>();
  /** a piece on its way out of this area, on top of the goods marker: a sold good leaving for its ship, or a new
   *  goods marker on its way to a neighbouring area (P6P.6, P6P.12) */
  @Ordered(new Vector3(0, 0, GOODS_MARKER_THICKNESS)) transit = new OrderedOutlet<Chit>();

  /** every area is its own place: never merged with another in a gallery */
  override functionallyIdentical(): boolean {
    return false;
  }

  get geom() {
    return landById.get(this.areaId)!;
  }
  get good(): GoodsMarker | undefined {
    return this.goods.length ? this.goods.get(0) : undefined;
  }
  get isEmpty(): boolean {
    return !this.good && !this.city;
  }

  override render(spec: ChitRenderSpec): void {
    clickable(spec);
    // a clickable area outlines only itself: the pieces standing on it keep their own outlines
    spec.highlight.childrenInheritOutline = false;
    const g = this.geom;
    const rings = g.rings.map((ring) => ringToWorld(ring, g.pole));
    const grp = new Group();
    for (const ring of rings) grp.add(flatPolygon(ring));
    grp.add(underBoardShape(rings, "#9c7a52")); // what the tap chooser and long-press show
    spec.object = grp;
    const w = toWorld(g.pole);
    spec.offsetX = w.x;
    spec.offsetY = w.y;
    spec.offsetZ = -UNDER_BOARD + 0.002;
    spec.childrenOffsetZ = 0;
    spec.offsetSpeed = 0;
    spec.worthSlidingToPanelToShowChange = false;
    spec.showDetailsOnLongPress = true;
    const [x0, y0, x1, y1] = g.bbox;
    galleryFit(spec, (x1 - x0) / 100, (y1 - y0) / 100, 220);
    spec.summary = `**${this.province}** · ${this.coastal ? "coastal" : "inland"}\n${provinceOutlook(this.province)}`;
  }
}
