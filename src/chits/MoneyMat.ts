import { Chit, ChitRenderSpec, HiddenPropertySerializationRule } from "@pretty-chitty/core";
import { hideFromOthers, shown } from "../secret";
import { MoneyMatFace } from "../canvas/MoneyMatFace";
import { AID_H, AID_W } from "../consts";
import { cardboard, galleryFit } from "../render";

const MAT_THICKNESS = 0.16;

/** A player's aid sheet (C4) lying on their side of the table, its Bank and Cash boxes showing their money. The
 *  amounts are this chit's own fields, set by Player.syncSparks whenever money moves; with secret money (S7) only
 *  their owner is sent them, and everyone else sees "–". */
export class MoneyMat extends Chit {
  // undefined until set: a hidden field is not sent, so a viewer keeps the starting value ("–", not 0)
  cash?: number = undefined;
  bank?: number = undefined;
  earnings?: number = undefined;
  ownerId = "";
  secret = false;

  override hiddenPropertiesForSerialization(playerIds: string[]): HiddenPropertySerializationRule[] | undefined {
    return hideFromOthers(this.secret, this.ownerId, ["cash", "bank", "earnings"], playerIds);
  }

  override render(spec: ChitRenderSpec): void {
    const face = new MoneyMatFace().set((f) => {
      f.cash = this.cash;
      f.bank = this.bank;
      f.earnings = this.earnings;
    }).material;
    // thick board, so it has depth on the table and the city cards tucked under its corner (Player) hide inside it;
    // its bottom stays where the old thin sheet's was
    const board = cardboard(AID_W, AID_H, MAT_THICKNESS, face, "#c9b48f");
    board.position.z = MAT_THICKNESS / 2 - 0.015;
    spec.object = board;
    spec.childrenOffsetZ = 0;
    spec.worthSlidingToPanelToShowChange = false;
    spec.showDetailsOnLongPress = true;
    galleryFit(spec, AID_W, AID_H, 520);
    spec.summary =
      this.cash === undefined
        ? "**Money kept secret**: cash, Bank and this year's earnings are shown to their owner only, until the game ends."
        : `**Cash ${this.cash}**: what you may bid, pay and buy with. **Bank ${this.bank}**: turn-order bids, never spendable again but counted at the end.${this.earnings ? ` **${this.earnings}** earned this year: it becomes cash when the year ends (doubled if the game ends).` : ""}`;
  }
}
