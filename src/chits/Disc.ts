import { Chit, ChitRenderSpec, Ordered, OrderedOutlet } from "@pretty-chitty/core";
import { CylinderGeometry, Mesh, Vector3 } from "three";
import { BidTag } from "./BidTag";
import { BOARD_THICKNESS, DISC_DIAMETER, PLAYER_COLORS } from "../consts";
import { clickable, colorMaterial, galleryFit, LIFT, outlineFor } from "../render";

/** A player's turn-order disc (C5, S5): it stands on the Turn Order cell of their position this year (P2.5). While
 *  bids are made, a tag above it shows the player's bid. */
export class Disc extends Chit {
  seat = 0;
  ownerName = "";
  /** the running bid shown above the disc during phase 2 ("" when none) */
  bidLabel = "";
  /** this year's effective bid (cash x multiplier), read when the order is set (P2.5) */
  bid = 0;
  /** the bid tag lying on the table beyond the board edge, just above the disc while bids are made */
  // centred 1.05 above the disc: clear of the board's top edge (0.8 above a Turn Order disc), down on the table
  @Ordered(new Vector3(0, 1.05, -(BOARD_THICKNESS + 0.06))) tags = new OrderedOutlet<BidTag>();

  /** where a tag goes when bidding is done: into the disc, hidden once it gets there (shouldRenderChild) */
  @Ordered(new Vector3(0, 0, -0.1)) pocket = new OrderedOutlet<BidTag>();

  /** Show the running bid: the tag rises out of the disc (which brings the Tracks panel forward) and after that only
   *  its number changes; "" sends it back into the disc, and next year the same tag rises out again. */
  setBidLabel(label: string) {
    this.bidLabel = label;
    const tag = this.tags.length ? this.tags.get(0) : this.pocket.length ? this.pocket.get(0) : undefined;
    if (!label) {
      if (tag && tag.parentOutlet === "tags") this.pocket.add(tag);
    } else if (tag) {
      tag.label = label;
      if (tag.parentOutlet === "pocket") this.tags.add(tag);
    } else {
      this.tags.add(
        new BidTag().set((t) => {
          t.seat = this.seat;
          t.label = label;
          t.parentFallback = this; // its first entrance is out of the disc too
        }),
      );
    }
  }

  /** A tag in the pocket is inside the disc: drawn while it sinks in, hidden once it is there. */
  override shouldRenderChild(child: Chit): boolean {
    return child.parentOutlet !== "pocket";
  }

  override render(spec: ChitRenderSpec): void {
    clickable(spec);
    const geom = new CylinderGeometry(DISC_DIAMETER / 2, DISC_DIAMETER / 2, 0.12, 32);
    geom.rotateX(Math.PI / 2);
    const mesh = new Mesh(geom, colorMaterial(PLAYER_COLORS[this.seat], 30));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    spec.object = mesh;
    spec.highlight.color = outlineFor(PLAYER_COLORS[this.seat]);
    spec.zLiftRatio = LIFT.marker;
    spec.showDetailsOnLongPress = true;
    galleryFit(spec, 1, 1, 160);
    spec.summary = `**${this.ownerName}'s turn order disc**: its space is their place in the order of play this year, set by the turn-order bids.${this.bidLabel ? ` Bid this year: ${this.bidLabel}.` : ""}`;
  }
}
