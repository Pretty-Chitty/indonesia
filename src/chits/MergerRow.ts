import { Chit, ChitRenderSpec, Ordered, OrderedOutlet } from "@pretty-chitty/core";
import { Mesh, PlaneGeometry, Vector3 } from "three";
import { MergerRowFace } from "../canvas/MergerRowFace";
import { PLAYER_COLORS } from "../consts";
import { BidTag } from "./BidTag";
import type { Player } from "./Player";

export const MERGER_ROW_W = 4.9;
export const MERGER_ROW_H = MERGER_ROW_W * (110 / 760);

/** One player's line on the merger table (MergerTable): photo, name, standing in the auction and what the standing
 *  bid means for them. The bid marker sits on the line of whoever is bidding. Its fields are set by the table. */
export class MergerRow extends Chit {
  seat = 0;
  player?: Player;
  name = "";
  status = "";
  money = "";
  /** passed, or may not bid at all */
  out = false;

  /** the bid marker, at the line's right end, while this player bids */
  @Ordered(new Vector3(MERGER_ROW_W / 2 + 0.5, 0, 0.02)) marker = new OrderedOutlet<BidTag>();

  override render(spec: ChitRenderSpec): void {
    const face = new MergerRowFace().set((f) => {
      f.player = this.player;
      f.border = PLAYER_COLORS[this.seat];
      f.name = this.name;
      f.status = this.status;
      f.money = this.money;
      f.out = this.out;
    }).material;
    const plane = new Mesh(new PlaneGeometry(MERGER_ROW_W, MERGER_ROW_H), face);
    plane.position.z = 0.005;
    plane.receiveShadow = true;
    spec.object = plane;
    spec.childrenOffsetZ = 0;
    spec.offsetY = -(this.parentOutletIndex ?? 0) * (MERGER_ROW_H + 0.1);
    spec.summary = `**${this.name}**: ${this.status}${this.money ? `; ${this.money}` : ""}.`;
  }
}
