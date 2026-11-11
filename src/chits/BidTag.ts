import { Chit, ChitRenderSpec } from "@pretty-chitty/core";
import { Mesh, PlaneGeometry } from "three";
import { BidTagFace } from "../canvas/BidTagFace";
import { PLAYER_COLORS } from "../consts";

/** The tag beside a turn-order disc while bids are made (P2): the player's running bid, lying flat on the table just
 *  above the disc. It is laid once when bidding starts (a piece entering brings the Tracks panel forward for every
 *  viewer); after that only its number changes. */
export class BidTag extends Chit {
  seat = 0;
  label = "0";

  override render(spec: ChitRenderSpec): void {
    const tag = new Mesh(
      new PlaneGeometry(0.8, 0.4),
      new BidTagFace().set((f) => {
        f.label = this.label;
        f.border = PLAYER_COLORS[this.seat];
      }).material,
    );
    tag.position.z = 0.005;
    spec.object = tag;
    spec.zLiftRatio = 0.4;
    spec.summary = `Bid: ${this.label}`;
  }
}
