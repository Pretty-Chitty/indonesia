import { Chit, ChitRenderSpec } from "@pretty-chitty/core";
import { Good, GOOD_COLOR, GOOD_LABEL, GOODS_MARKER_THICKNESS } from "../consts";
import { GOODS_PIECES } from "../geometry/goodsPieces";
import { clickable, galleryFit, LIFT, outlineFor } from "../render";
import { goodsPiece } from "./GoodsMarker";

/** A good sold to a city (P6P.2): one of the wooden goods markers (C9), as the developer's table plays it rather than
 *  the rulebook's cardboard counter. It rises out of a plantation of its zone, rides a ship in each sea of its route,
 *  and lands on the city's goods display, where it stays until City Growth (P7.2). */
export class DeliveredGood extends Chit {
  good: Good = "rice";
  /** how many goods lie under it on its display's lobe (set as it lands) */
  level = 0;

  override render(spec: ChitRenderSpec): void {
    clickable(spec);
    spec.object = goodsPiece(this.good);
    spec.offsetZ = this.level * GOODS_MARKER_THICKNESS;
    spec.zLiftRatio = LIFT.piece;
    spec.highlight.color = outlineFor(GOOD_COLOR[this.good]);
    spec.showDetailsOnLongPress = true;
    galleryFit(spec, GOODS_PIECES[this.good].aspect, 1, 220);
    spec.summary = `**${GOOD_LABEL[this.good]}** sold to a city this year. It leaves the city's goods display in the City Growth phase.`;
  }
}
