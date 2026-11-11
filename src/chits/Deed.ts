import { CardMesh, Chit, ChitRenderSpec } from "@pretty-chitty/core";
import { DeedBackFace, DeedFace } from "../canvas/DeedFace";
import { DEED_H, DEED_STACK_STEP, DEED_W, DEEDS, GOOD_LABEL } from "../consts";
import { clickable, galleryFit, LIFT } from "../render";

/** A company deed (C3, D4). In the Market it lies in the row of available companies; in a Company it is one of the
 *  deeds the company consists of (P3.16); operated companies turn their deeds face down (P6.1). */
export class Deed extends Chit {
  deedId = 0;
  faceDown = false;
  /** how many deeds its company has (set by Company.refreshName): the first lies on top of the column */
  stackSize = 1;

  get spec() {
    return DEEDS[this.deedId];
  }
  get name(): string {
    const d = this.spec;
    return `${d.province} ${GOOD_LABEL[d.type]}`;
  }

  override render(spec: ChitRenderSpec): void {
    clickable(spec);
    const front = new DeedFace().set((f) => {
      f.deedId = this.deedId;
    }).material;
    const back = new DeedBackFace().set((f) => {
      f.deedId = this.deedId;
    }).material;
    spec.object = new CardMesh(DEED_W, DEED_H, front, back, { castShadow: true, receiveShadow: true, zDifference: 0.02 });
    spec.rotateY = this.faceDown ? Math.PI : 0;
    spec.rotationSpeed = 600;
    // a deed never pulls the view to a panel: leaving the Companies panel, landing on a mat or flipping when its
    // company operates would each slide every viewer away from the board, where the action is shown
    spec.worthSlidingToPanelToShowChange = false;
    spec.zLiftRatio = LIFT.card;
    const i = this.parentOutletIndex ?? 0;
    const column = (this.parentOutlet === "deeds" && this.parent?.constructor.name === "Company") || this.parentOutlet === "dealA" || this.parentOutlet === "dealB";
    if (column) {
      // a merged company (P3.16): one column, each deed under the one before and lower by its bottom strip, so the
      // era, ship limits and good of every deed show
      spec.offsetY = -i * DEED_STACK_STEP;
      spec.offsetZ = (this.stackSize - 1 - i) * 0.025;
    } else if (this.parentOutlet === "deeds") {
      // the Market: a grid four deeds wide, so seven to nine deeds make a block that fits its panel (LAYOUT.md)
      spec.offsetX = (i % 4) * (DEED_W + 0.3);
      spec.offsetY = -Math.floor(i / 4) * (DEED_H + 0.3);
    } else if (this.parentOutlet === "pile") {
      spec.splay.enabled = true;
      spec.splay.rows = 1;
      spec.splay.columns = 1;
    }
    spec.showDetailsOnLongPress = true;
    galleryFit(spec, DEED_W, DEED_H, 440);
    const d = this.spec;
    spec.summary =
      d.type === "shipping"
        ? `**${this.name}** (era ${d.era}). A shipping line: up to ${d.ships![0] ?? "–"} / ${d.ships![1]} / ${d.ships![2]} ships in eras A / B / C. It starts with one ship in a sea area bordering ${d.province}.`
        : `**${this.name}** (era ${d.era}). A production company: it starts with one ${GOOD_LABEL[d.type]} plantation on an empty area of ${d.province}, not next to another ${GOOD_LABEL[d.type]} plantation.`;
  }
}
