import { Chit, ChitRenderSpec, Ordered, OrderedOutlet } from "@pretty-chitty/core";
import { Mesh, PlaneGeometry, Vector3 } from "three";
import { BOARD_PX_PER_UNIT, BID_MULTIPLIER } from "../consts";
import { TABLE_CELLS } from "../geometry/map";
import { TRACKS_RECT } from "../geometry/tracks";
import { clickable, invisibleMaterial, UNDER_BOARD } from "../render";
import { CellFace } from "../canvas/CellFace";
import { Group } from "three";

/** One printed cell of the Turn Order track or the R&D table (M7), on the Tracks panel: a click target over the
 *  print, holding the player cubes or discs that stand on it. */
export class TableCell extends Chit {
  row = "slots";
  step = 1;

  @Ordered(new Vector3(0, 0, 0)) pieces = new OrderedOutlet<Chit>();

  override functionallyIdentical(): boolean {
    return false;
  }

  /** Short name and step, for the tap chooser. */
  chooserLabel(): string {
    const names: Record<string, string> = { turnOrder: "Turn order", bid: "Bid", slots: "Slots", mergers: "Mergers", expansion: "Expansion", hullPlayer: "Hull", hullCompany: "Hull Co." };
    return `${names[this.row] ?? this.row}\n${this.row === "bid" ? `×${BID_MULTIPLIER[this.step - 1]}` : this.step}`;
  }

  get geom() {
    return TABLE_CELLS.find((c) => c.row === this.row && c.step === this.step)!;
  }

  override render(spec: ChitRenderSpec): void {
    clickable(spec);
    const [x0, y0, x1, y1] = this.geom.bbox;
    const w = (x1 - x0) / BOARD_PX_PER_UNIT;
    const h = (y1 - y0) / BOARD_PX_PER_UNIT;
    const [rx0, ry0, rx1, ry1] = TRACKS_RECT;
    const grp = new Group();
    grp.add(new Mesh(new PlaneGeometry(w * 0.94, h * 0.94), invisibleMaterial()));
    // what the tap chooser shows: the track and step, on a tile sunk inside the Tracks slab (hidden on the table)
    const pic = new Mesh(
      new PlaneGeometry(w * 0.94, h * 0.94),
      new CellFace().set((f) => {
        f.label = this.chooserLabel();
      }).material,
    );
    pic.position.z = -UNDER_BOARD;
    grp.add(pic);
    spec.object = grp;
    spec.galleryPreferredWidth = 180;
    spec.galleryPreferredHeight = 180;
    // board-band pixels -> world units on the Tracks panel, whose art is the same rectangle at the same scale
    spec.offsetX = ((x0 + x1) / 2 - (rx0 + rx1) / 2) / BOARD_PX_PER_UNIT;
    spec.offsetY = ((ry0 + ry1) / 2 - (y0 + y1) / 2) / BOARD_PX_PER_UNIT;
    spec.offsetZ = -UNDER_BOARD + 0.002;
    spec.childrenOffsetZ = 0;
    spec.offsetSpeed = 0;
    spec.worthSlidingToPanelToShowChange = false;
    spec.showDetailsOnLongPress = true;
    spec.summary = this.describe();
  }

  describe(): string {
    const n = this.step;
    switch (this.row) {
      case "turnOrder":
        return `**Turn order ${n}**. The disc here plays ${n === 1 ? "first" : `${n}${n === 2 ? "nd" : n === 3 ? "rd" : "th"}`} in every phase this year.`;
      case "bid":
        return `**Turn Order Bid ×${BID_MULTIPLIER[n - 1]}**. Cash bid for turn order is multiplied by this; the cash itself goes to the Bank for good.`;
      case "slots":
        return `**Slots ${n}**. A player may own up to ${n} compan${n === 1 ? "y" : "ies"} at once; a merged company counts as one.`;
      case "mergers":
        return n === 1
          ? "**Mergers 1**. Cannot announce mergers (anyone may still bid in one)."
          : `**Mergers ${n}**. May announce mergers whose result has up to ${n} deeds.`;
      case "expansion":
        return `**Expansion ${n}**. Each company operated may add up to ${n} areas or ships.`;
      case "hullPlayer":
        return `**Hull ${n}**. Each ship of this player's shipping companies carries ${n} good${n === 1 ? "" : "s"} per production company. Another player may advance this track for you.`;
      case "hullCompany":
        return "**Hull Company** (second-edition board row, not used by the 2009 rules).";
    }
    return "";
  }
}
