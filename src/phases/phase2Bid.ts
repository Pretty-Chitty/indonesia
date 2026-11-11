import { AdjustButton, BidButton } from "../ButtonLibrary";
import { Disc } from "../chits/Disc";
import { Root } from "../chits/Root";
import { BID_MULTIPLIER } from "../consts";
import { ask, money } from "./common";

/** Phase 2, Bid for Turn Order (P2). Bids are made one at a time in last year's order and are public. */
export async function executeBidForTurnOrder(root: Root) {
  root.phase = 1;
  root.playerAid.phase = 1;
  const previous = root.playersInOrder();
  const discOf = (seat: number) =>
    root.tracks.cells.copy().flatMap((c) => c.pieces.filter((x) => x instanceof Disc) as Disc[]).find((d) => d.seat === seat)!;
  for (const p of previous) {
    const mult = BID_MULTIPLIER[p.rnd.bid - 1]; // P2.4: a researched multiplier must be used
    const disc = discOf(p.seat);
    await root.turn.createTurn([root], p, async (turn) => {
      let amount = 0;
      let done = false;
      // the running bid is shown on a tag over the player's turn-order disc as it grows
      const show = () => {
        disc.setBidLabel(mult > 1 ? `${amount} ×${mult}` : String(amount));
      };
      show();
      turn.markZipStartPoint();
      while (!done) {
        const steps = [1, 5, 25, 100];
        await ask(
          turn,
          p,
          [
            // no minus buttons: Undo takes back a raise that went too far
            ...steps.map(
              (n) =>
                amount + n <= p.cash &&
                new AdjustButton(() => {
                  amount += n;
                  show();
                })
                  .config(n)
                  .pick()
                  .focus([root.tracks, p])
                  .ai("bid.up", { n, amount }),
            ),
            new BidButton(() => {
              done = true;
            })
              .config(amount)
              .pick()
              .focus([root.tracks, p])
              .ai("bid.confirm", { amount }),
          ],
          `bid ${amount} for turn order${mult > 1 ? ` (×${mult} = ${amount * mult})` : ""}`,
          `Raise your bid, then confirm. Cash bid goes to your Bank: it can never be spent again but counts at the end. Highest bid (times your Turn Order Bid multiplier) plays first; ties keep last year's order. You have ${money(p.cash)}. Undo takes back a raise.`,
        );
        turn.flush();
        turn.zip();
      }
      p.addCash(-amount);
      p.addBank(amount); // P2.3
      disc.bid = amount * mult;
      show();
      turn.log(`${p.logKey} bids ${money(amount)}${mult > 1 ? ` (×${mult} = ${amount * mult})` : ""} for turn order.`);
      turn.flush();
    });
  }
  // P2.5, P2.6: highest effective bid first; a stable sort keeps tied players in last year's relative order
  const order = previous.slice().sort((a, b) => discOf(b.seat).bid - discOf(a.seat).bid);
  root.turnOrder = order.map((p) => p.playerId);
  order.forEach((p, i) => {
    p.order = i;
    root.tracks.cell("turnOrder", i + 1).pieces.add(discOf(p.seat));
  });
  root.turn.log(`Order of play this year: ${order.map((p) => p.logKey).join(", ")}.`);
  root.turn.flush();
  // the bids have done their work: take the tags off
  for (const p of order) {
    const d = discOf(p.seat);
    d.setBidLabel("");
    d.bid = 0;
  }
  root.turn.flush();
}
