import { Chit, ChitRenderSpec, Ordered, OrderedOutlet } from "@pretty-chitty/core";
import { Group, Vector3 } from "three";
import { CountTagFace } from "../canvas/CountTagFace";
import { BOARD_PX_PER_UNIT, CITY_COLOR, CitySize } from "../consts";
import { TRACKS_RECT } from "../geometry/tracks";
import { galleryFit } from "../render";
import { SupplyRing } from "./SupplyRing";

/** C7: 12 markers of size 1, 8 of size 2, 3 of size 3. */
const SUPPLY: Record<CitySize, number> = { 1: 12, 2: 8, 3: 3 };

/** The unused city markers (C7), one stack per size beside the Tracks: running out is a rule (P1.9, P7.4, P7.5),
 *  so the stacks are on the table, each with the engine's pile counter. */
export class CitySupply extends Chit {
  @Ordered(new Vector3(0, 1.4, 0)) rings1 = new OrderedOutlet<SupplyRing>();
  @Ordered(new Vector3(0, 0, 0)) rings2 = new OrderedOutlet<SupplyRing>();
  @Ordered(new Vector3(0, -1.4, 0)) rings3 = new OrderedOutlet<SupplyRing>();

  private stack(size: CitySize): OrderedOutlet<SupplyRing> {
    return size === 1 ? this.rings1 : size === 2 ? this.rings2 : this.rings3;
  }
  /** Set up the full supply (S1). */
  fill() {
    for (const size of [1, 2, 3] as CitySize[]) {
      while (this.stack(size).length < SUPPLY[size]) this.put(size);
    }
  }
  count(size: CitySize): number {
    return this.stack(size).length;
  }
  take(size: CitySize): boolean {
    const s = this.stack(size);
    if (!s.length) return false;
    s.get(s.length - 1).removeFromParent();
    return true;
  }
  put(size: CitySize) {
    this.stack(size).add(new SupplyRing().set((r) => (r.size = size)));
  }

  override render(spec: ChitRenderSpec): void {
    spec.object = new Group();
    spec.childrenOffsetZ = 0;
    for (const size of [1, 2, 3] as CitySize[]) {
      spec.addCounterToOrderedOutlet(
        this.stack(size),
        new CountTagFace().set((f) => (f.border = CITY_COLOR[size])),
        1,
        200,
        "right",
        0.2,
      );
    }
    // to the right of the Tracks art
    spec.offsetX = (TRACKS_RECT[2] - TRACKS_RECT[0]) / BOARD_PX_PER_UNIT / 2 + 0.7;
    spec.offsetY = 0;
    spec.worthSlidingToPanelToShowChange = false;
    spec.showDetailsOnLongPress = true;
    galleryFit(spec, 1.6, 3.4, 300);
    spec.summary = "**City markers left**, by size. A city cannot be built or grow when no marker of the size is left.";
  }
}
