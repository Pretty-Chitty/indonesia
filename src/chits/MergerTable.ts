import { Chit, ChitRenderSpec, Ordered, OrderedOutlet } from "@pretty-chitty/core";
import { Group, Mesh, PlaneGeometry, Vector3 } from "three";
import { MergerHeadFace } from "../canvas/MergerRowFace";
import { DEED_H, DEED_W } from "../consts";
import { discard } from "../pieces";
import { BidTag } from "./BidTag";
import type { Company } from "./Company";
import { Deed } from "./Deed";
import { MERGER_ROW_H, MergerRow } from "./MergerRow";
import type { Player } from "./Player";

const COL = DEED_W + 0.35;
const HEAD_H = 0.75;
const ROWS_X = 2 * COL + 0.25;

/** The merger being auctioned (P3.10–P3.15), laid out on the Market panel for everyone: the two companies' deeds
 *  side by side (they go to the winner's mat when it resolves), and a line per player showing who is still in, who
 *  has passed, who may not bid, and what the standing bid pays or costs them. One bid marker serves the whole auction:
 *  it sits on the line of whoever bid last and slides down to the next bidder. Empty, and invisible, between mergers. */
export class MergerTable extends Chit {
  active = false;
  title = "";
  terms = "";
  /** how far below the first row of deeds on offer it starts: under the last row (set by begin) */
  top = 0;
  /** the deal, for anyone reading the board (the bots): the two companies' keys, their pieces, the opening value
   *  and the raise, and whether it makes siap saji */
  keyA = "";
  keyB = "";
  piecesA = 0;
  piecesB = 0;
  nominal = 0;
  unit = 1;
  siapSaji = false;
  /** the standing bid and who holds it ("" before the opening bid) */
  bid = 0;
  highId = "";

  @Ordered(new Vector3(0, -(HEAD_H + DEED_H / 2), 0)) dealA = new OrderedOutlet<Deed>();
  @Ordered(new Vector3(COL, -(HEAD_H + DEED_H / 2), 0)) dealB = new OrderedOutlet<Deed>();
  @Ordered(new Vector3(ROWS_X + 4.9 / 2 - DEED_W / 2, -(HEAD_H + MERGER_ROW_H / 2), 0)) rows = new OrderedOutlet<MergerRow>();

  /** Lay the two companies' deeds on the table and a line for every player. */
  begin(a: Company, b: Company, players: Player[], title: string, terms: string, rowsOnOffer: number, deal: { piecesA: number; piecesB: number; nominal: number; unit: number; siapSaji: boolean }) {
    this.active = true;
    this.keyA = a.key;
    this.keyB = b.key;
    // only the deal's numbers: the terms also carry the two companies, which would be saved here and name pieces
    // that are gone once the merger folds them (a board loading after that could not be built)
    const { piecesA, piecesB, nominal, unit, siapSaji } = deal;
    Object.assign(this, { piecesA, piecesB, nominal, unit, siapSaji });
    this.bid = 0;
    this.highId = "";
    this.top = Math.max(0, rowsOnOffer - 1) * (DEED_H + 0.3);
    this.title = title;
    this.terms = terms;
    for (const [company, deal] of [[a, this.dealA], [b, this.dealB]] as const) {
      const deeds = company.deeds.copy();
      for (const d of deeds) {
        d.stackSize = deeds.length;
        deal.add(d);
      }
    }
    for (const p of players) {
      this.rows.add(
        new MergerRow().set((r) => {
          r.seat = p.seat;
          r.player = p;
          r.name = p.name;
        }),
      );
    }
  }

  row(p: Player): MergerRow | undefined {
    return this.rows.find((r) => r.seat === p.seat);
  }

  private bidMarker(): BidTag | undefined {
    return this.rows.copy().flatMap((r) => r.marker.copy())[0];
  }

  /** Put the bid marker on the bidder's line, showing their offer (or "pass"). It stays there until the next bidder
   *  takes it, so it moves from line to line and never leaves the table mid-auction. */
  showBidder(bidder: Player, label: string) {
    const row = this.row(bidder)!;
    const marker = this.bidMarker();
    if (marker) {
      marker.seat = bidder.seat;
      marker.label = label;
      if (marker.parent !== row) row.marker.add(marker);
    } else {
      row.marker.add(
        new BidTag().set((t) => {
          t.seat = bidder.seat;
          t.label = label;
          // it rises out of the opener's line, not in from the edge of the table (the line stays until the auction
          // ends, and end() takes the marker first)
          t.parentFallback = row;
        }),
      );
    }
  }

  /** Clear the table: the lines and the marker go; the deeds have gone to the winner already. */
  end() {
    const marker = this.bidMarker();
    if (marker) discard(marker);
    for (const r of this.rows.copy()) discard(r);
    this.active = false;
  }

  override render(spec: ChitRenderSpec): void {
    spec.childrenOffsetZ = 0;
    spec.offsetY = -this.top;
    spec.worthSlidingToPanelToShowChange = true; // a merger announced brings everyone to the table
    if (!this.active) {
      spec.object = new Group();
      return;
    }
    const head = new Mesh(
      new PlaneGeometry(ROWS_X + 4.9 + 0.9, HEAD_H),
      new MergerHeadFace().set((f) => {
        f.title = this.title;
        f.terms = this.terms;
      }).material,
    );
    head.position.set((ROWS_X + 4.9 + 0.9) / 2 - DEED_W / 2, -HEAD_H / 2 + 0.1, 0.005);
    spec.object = head;
    spec.summary = `**${this.title}**. ${this.terms}`;
  }
}
