import { Chit, ChitRenderSpec, Ordered, OrderedOutlet } from "@pretty-chitty/core";
import { Vector3 } from "three";
import { BOARD_PX_PER_UNIT } from "../consts";
import { ringToWorld, seaById, toWorld } from "../geometry/mapIndex";
import { clickable, flatPolygon, galleryFit, UNDER_BOARD, underBoardShape } from "../render";
import { Group } from "three";
import { Ship } from "./Ship";

/** One printed sea area (M2): an invisible click target in the shape of the print, holding the ships in it. */
export class SeaArea extends Chit {
  areaId = 0;

  @Ordered(new Vector3(0, 0, 0)) ships = new OrderedOutlet<Ship>();

  override functionallyIdentical(): boolean {
    return false;
  }

  /** Stand each ship on the sea's next ship spot (packed on its own water by build_map.py, the first nearest the
   *  coast), on the ships' own fields (a render reads only its own chit); past the last spot they stack a little
   *  offset on the first ones. Called whenever ships arrive or leave (MainBoard.syncShipCapacity). */
  layoutShips() {
    const g = this.geom;
    this.ships.copy().forEach((ship, i) => {
      const [x, y] = g.slots[i % g.slots.length];
      const extra = Math.floor(i / g.slots.length) * 0.15;
      ship.slotX = (x - g.pole[0]) / BOARD_PX_PER_UNIT + extra;
      ship.slotY = (g.pole[1] - y) / BOARD_PX_PER_UNIT - extra;
    });
  }

  get geom() {
    return seaById.get(this.areaId)!;
  }

  override render(spec: ChitRenderSpec): void {
    clickable(spec);
    const g = this.geom;
    const ring = ringToWorld(g.ring, g.pole);
    const grp = new Group();
    grp.add(flatPolygon(ring));
    grp.add(underBoardShape([ring], "#9fb6c4")); // what the tap chooser shows
    spec.object = grp;
    const [x0, y0, x1, y1] = g.bbox;
    galleryFit(spec, (x1 - x0) / 100, (y1 - y0) / 100, 220);
    const w = toWorld(g.pole);
    spec.offsetX = w.x;
    spec.offsetY = w.y;
    spec.offsetZ = -UNDER_BOARD + 0.002;
    spec.childrenOffsetZ = 0;
    spec.offsetSpeed = 0;
    spec.worthSlidingToPanelToShowChange = false;
    // no long-press: a sea area has nothing to say that its ships don't
    spec.showDetailsOnLongPress = false;
  }
}
