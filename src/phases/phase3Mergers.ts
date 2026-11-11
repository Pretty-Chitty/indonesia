import { Chit } from "@pretty-chitty/core";
import { AdjustButton, ConfirmPassButton, PassButton, RaiseButton } from "../ButtonLibrary";
import { Company } from "../chits/Company";
import { Deed } from "../chits/Deed";
import { GoodsMarker } from "../chits/GoodsMarker";
import { Player } from "../chits/Player";
import { Root } from "../chits/Root";
import { Ship } from "../chits/Ship";
import { GOOD_LABEL, SIAP_SAJI_MERGER_UNIT } from "../consts";
import { zonesOf } from "../logistics";
import { ask, money, T } from "./common";
import { discard } from "../pieces";

export interface MergerTerms {
  a: Company;
  b: Company;
  piecesA: number;
  piecesB: number;
  /** raise increment (P3.12): the total number of goods/ships of the two companies */
  unit: number;
  nominal: number;
  siapSaji: boolean;
}

/** Phase 3, Mergers (P3, P3S). Rounds in order of play until a whole round passes with no announcement (P3.4). */
export async function executeMergers(root: Root) {
  root.phase = 2;
  root.playerAid.phase = 2;
  if (!root.players.some((p) => p.rnd.mergers >= 2)) {
    root.turn.log("Mergers: nobody has researched Mergers yet, so the phase is skipped.");
    return;
  }
  let announcedInRound = true;
  while (announcedInRound) {
    announcedInRound = false;
    for (const p of root.playersInOrder()) {
      if (p.rnd.mergers < 2) continue; // P3.1
      const pairs = legalMergers(root, p);
      if (!pairs.length) {
        // with secret money (S7), skipping a player whose mergers they merely cannot afford would show the table
        // their cash: they are asked, and pass, like anyone else
        if (root.moneyIsSecret() && legalMergers(root, p, true).length) await confirmPass(root, root.turn, p, "announce no merger", "You cannot afford the nominal value of any merger you could announce, so you pass.", "merger.pass");
        continue;
      }
      const announced = await root.turn.createTurn([root], p, async (turn) => {
        let first: Company | undefined;
        const firsts = [...new Set(pairs.flatMap((t) => [t.a, t.b]))];
        // a company is picked where it is: its column of deeds on its owner's mat, or any of its plantations or
        // ships on the map (no gallery: what matters is where the pieces are and whose they are)
        const handles = (cs: Company[]) => cs.flatMap((c) => [c as Chit, ...root.board.piecesOf(c)]);
        const companyOf = (cs: Company[], x: Chit) => cs.find((c) => c === x || (root.board.piecesOf(c) as Chit[]).includes(x));
        await ask(turn, p, [
          Chit.pick(handles(firsts), (x) => {
            first = companyOf(firsts, x);
          })
            .message("announce a merger")
            .help(
              `Pick the first of two companies to merge (same type, or rice with spice for siap saji from era B): tap one of its plantations or ships on the map, or its deed. Your Mergers research of ${p.rnd.mergers} limits the result to ${p.rnd.mergers} deeds. You must open the bidding at the nominal value and be able to pay it.`,
            )
            .focus(root.board)
            .ai("merger.first"),
          new PassButton(() => {}).pick().message("pass").ai("merger.pass"),
        ]);
        if (!first) return false;
        const f = first;
        // the chosen company's pieces lift off the map, so everyone sees what is being merged
        setRaised(root.board.piecesOf(f), true);
        const partners = pairs.filter((t) => t.a === f || t.b === f).map((t) => (t.a === f ? t.b : t.a));
        let second = partners[0];
        await ask(turn, p, [
          Chit.pick(handles(partners), (x) => {
            second = companyOf(partners, x)!;
          })
            .message(`merge ${f.name} with another company`)
            .context(f)
            .focus(root.board)
            .ai("merger.second"),
        ]);
        const terms = pairs.find((t) => (t.a === f && t.b === second) || (t.b === f && t.a === second))!;
        // both companies' pieces stay up through the auction (and, for siap saji, while half the goods are given up)
        const lifted = [...root.board.piecesOf(terms.a), ...root.board.piecesOf(terms.b)];
        setRaised(lifted, true);
        // and the two companies' deeds go to the merger table on the Market panel, with a line for every player
        root.market.merger.begin(
          terms.a,
          terms.b,
          root.playersInOrder(),
          `Merger: ${terms.a.name} + ${terms.b.name}`,
          `Opens at ${money(terms.nominal)}, raises of ${terms.unit}. The winner pays the bid to the owners, ${terms.piecesA} : ${terms.piecesB} by their pieces.`,
          Math.ceil(root.market.deeds.length / 4), // the market's grid is four deeds wide
          terms,
        );
        turn.log(`${p.logKey} announces a merger of ${terms.a.name} and ${terms.b.name}: nominal value ${money(terms.nominal)}, raises in multiples of ${terms.unit}.`);
        turn.flush();
        await runAuction(root, turn, p, terms);
        setRaised(lifted.filter((x) => x.parent), false);
        turn.flush();
        return true;
      });
      if (announced) announcedInRound = true;
    }
  }
}

/** A turn (inside `parent`) in which the player's only choice is to pass, and they press it (secret money, S7). */
export async function confirmPass(root: Root, parent: T, p: Player, message: string, help: string, ai: string, focus?: Chit) {
  await parent.createTurn([root], p, async (sub) => {
    const pass = new ConfirmPassButton(() => {}).pick().message(message).ai(ai);
    await ask(sub, p, [focus ? pass.focus(focus) : pass], message, help);
  });
}

/** Lift pieces off the map, outlined in white (or set them down). */
function setRaised(pieces: (GoodsMarker | Ship)[], raised: boolean) {
  for (const x of pieces) x.raised = raised;
}

/** Every merger the announcer may legally announce (P3.5–P3.13, P3S.1–P3S.2, P3S.8–P3S.9). */
export function legalMergers(root: Root, announcer: Player, ignoreCash = false): MergerTerms[] {
  const all = root.players.copy().flatMap((p) => p.companies.copy());
  const out: MergerTerms[] = [];
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i];
      const b = all[j];
      if (a.mergedThisYear || b.mergedThisYear) continue; // P3.7
      const siapSaji = (a.type === "rice" && b.type === "spice") || (a.type === "spice" && b.type === "rice");
      if (siapSaji && root.era === "A") continue; // P3S.2
      if (!siapSaji && a.type !== b.type) continue; // P3.8, P3S.9
      if (a.deedCount + b.deedCount > announcer.rnd.mergers) continue; // P3.6
      const mine = announcer.companies.copy();
      const ownsOne = mine.includes(a) || mine.includes(b);
      if (!ownsOne && announcer.freeSlots() <= 0) continue; // P3.9
      const terms = mergerTerms(root, a, b, siapSaji);
      if (!ignoreCash && terms.nominal > announcer.cash) continue; // P3.10, P3.13
      out.push(terms);
    }
  }
  return out;
}

export function mergerTerms(root: Root, a: Company, b: Company, siapSaji: boolean): MergerTerms {
  const pieces = (c: Company) => (c.type === "shipping" ? root.board.shipsOf(c.key).length : root.board.goodsOf(c.key).length);
  const piecesA = pieces(a);
  const piecesB = pieces(b);
  const unit = piecesA + piecesB;
  // P3.11: pieces x unit value; P3S.3: every rice and spice good at 25
  const nominal = siapSaji ? unit * SIAP_SAJI_MERGER_UNIT : piecesA * a.unitValue() + piecesB * b.unitValue();
  return { a, b, piecesA, piecesB, unit, nominal, siapSaji };
}

/** P3.10–P3.15: the announcer opens at the nominal value or above; the others raise or pass in order of play. */
async function runAuction(root: Root, turn: T, announcer: Player, terms: MergerTerms) {
  const owners = [root.ownerOf(terms.a.key), root.ownerOf(terms.b.key)].filter((x): x is Player => !!x);
  // P3.2: every player with a free slot, and both owners, may bid; Mergers research does not matter
  const eligible = root.players.filter((p) => owners.includes(p) || p.freeSlots() > 0);
  let bid = terms.nominal;
  let high = announcer;
  let opened = false;
  const passed = new Set<string>();
  const ownerA = owners[0];
  const ownerB = root.ownerOf(terms.b.key);
  // the merger table (Market panel): every player's standing and what the bid pays or costs them, and the marker on
  // the line of whoever is bidding, showing their offer. While someone is bidding the split follows their offer as
  // they raise it; between bids, the standing bid, and the marker stays on the last bidder's line (their bid, or
  // "pass") until the next bidder takes it.
  const table = root.market.merger;
  const show = (bidder?: Player, offer = 0) => {
    const price = bidder ? offer : bid;
    const shareA = Math.round((price * terms.piecesA) / terms.unit);
    const shareB = price - shareA;
    for (const p of root.players.copy()) {
      const row = table.row(p);
      if (!row) continue;
      const mayBid = eligible.includes(p);
      const out = !mayBid || passed.has(p.playerId);
      row.out = out;
      row.status = !mayBid
        ? "may not bid: no free slot"
        : passed.has(p.playerId)
          ? "passed"
          : p === bidder
            ? opened
              ? "bidding"
              : "opening the bidding"
            : opened && p === high
              ? `high bid, ${money(bid)}`
              : "in";
      const gets = (p === ownerA ? shareA : 0) + (p === ownerB ? shareB : 0);
      const pays = bidder ? (p === bidder ? offer : 0) : opened && p === high ? bid : 0;
      row.money = pays && gets ? `pays ${money(pays)}, gets ${money(gets)}` : pays ? `pays ${money(pays)}` : gets ? `receives ${money(gets)}` : "";
    }
    if (bidder) table.showBidder(bidder, String(offer));
  };

  const takeBid = async (bidder: Player, opening: boolean) => {
    let amount = opening ? terms.nominal : bid + terms.unit;
    let done = false;
    let pass = false;
    turn.markZipStartPoint();
    await turn.createTurn([root], bidder, async (sub) => {
      while (!done && !pass) {
        show(bidder, amount);
        const canRaise = (k: number) => amount + k * terms.unit <= bidder.cash;
        await ask(
          sub,
          bidder,
          [
            // no minus buttons: Undo takes back a raise that went too far
            ...[1, 2, 5, 10].map(
              (k) =>
                canRaise(k) &&
                new AdjustButton(() => {
                  amount += k * terms.unit;
                })
                  .config(k * terms.unit)
                  .pick()
                  .focus(root.market)
                  .ai("auction.up", { k }),
            ),
            new RaiseButton(() => {
              done = true;
            })
              .config(amount)
              .pick()
              .focus(root.market)
              .ai("auction.bid", { amount, nominal: terms.nominal }),
            !opening &&
              new PassButton(() => {
                pass = true;
              })
                .pick()
                .message("pass")
                .focus(root.market)
                .ai("auction.pass"),
          ],
          opening ? `open the bidding for ${terms.a.name} + ${terms.b.name} at ${amount}` : `raise the bid for ${terms.a.name} + ${terms.b.name} to ${amount}, or pass`,
          `Bids rise in multiples of ${terms.unit} (the companies' ${terms.unit} goods and ships). The winner pays the whole bid, split between the former owners in proportion to their pieces. You cannot bid more than your cash (${money(bidder.cash)}). Once you pass you are out of this auction. Undo takes back a raise.`,
        );
        sub.flush();
        sub.zip();
      }
      if (pass) {
        passed.add(bidder.playerId);
        table.showBidder(bidder, "pass");
        sub.log(`${bidder.logKey} passes.`);
      } else {
        bid = amount;
        high = bidder;
        opened = true;
        table.bid = bid;
        table.highId = bidder.playerId;
        sub.log(`${bidder.logKey} bids ${money(amount)}.`);
      }
      show();
      sub.flush();
    });
  };

  await takeBid(announcer, true);
  const order = root.playersInOrder();
  let idx = (order.indexOf(announcer) + 1) % order.length;
  let guard = 0;
  while (guard++ < 1000) {
    const stillIn = eligible.filter((p) => !passed.has(p.playerId) && p !== high);
    if (!stillIn.length) break;
    const bidder = order[idx];
    idx = (idx + 1) % order.length;
    if (bidder === high || passed.has(bidder.playerId) || !eligible.includes(bidder)) continue;
    if (bidder.cash < bid + terms.unit) {
      passed.add(bidder.playerId);
      // with secret money (S7) a pass made for them, or its reason, would tell everyone their cash is below the next
      // bid: they confirm the pass themselves, and the log says only that they passed
      if (root.moneyIsSecret()) {
        show(bidder, bid + terms.unit);
        await confirmPass(root, turn, bidder, `pass on ${terms.a.name} + ${terms.b.name}`, `You cannot afford the next bid (${money(bid + terms.unit)}), so you pass.`, "auction.pass", root.market);
        turn.log(`${bidder.logKey} passes.`);
      } else turn.log(`${bidder.logKey} cannot afford to raise and passes.`);
      table.showBidder(bidder, "pass");
      show();
      continue;
    }
    await takeBid(bidder, false);
  }
  await resolveMerger(root, turn, high, bid, terms);
}

/** P3.15–P3.17, P3S.4–P3S.7: pay the former owners, combine the deeds, recolour ships, give up half the goods
 *  for siap saji. */
async function resolveMerger(root: Root, turn: T, winner: Player, bid: number, terms: MergerTerms) {
  const ownerA = root.ownerOf(terms.a.key)!;
  const ownerB = root.ownerOf(terms.b.key)!;
  const shareA = (bid * terms.piecesA) / terms.unit;
  const shareB = bid - shareA;
  winner.addCash(-bid);
  ownerA.addCash(shareA);
  ownerB.addCash(shareB);
  turn.log(`${winner.logKey} wins the merger for ${money(bid)}: ${ownerA.logKey} receives ${money(shareA)}, ${ownerB.logKey} receives ${money(shareB)}.`);
  turn.flush();

  const ownsA = winner.companies.copy().includes(terms.a);
  const ownsB = winner.companies.copy().includes(terms.b);
  const result = ownsA ? terms.a : ownsB ? terms.b : new Company().set((c) => (c.key = `${terms.a.key}+${terms.b.key}`));
  const absorbed = result === terms.a ? terms.b : result === terms.b ? terms.a : undefined;
  if (!absorbed) {
    // neither was the winner's: both former companies fold into a new one in the winner's free slot
    winner.companies.add(result);
    result.shipType = winner.companies.filter((c) => c.type === "shipping").length % 2 === 0 ? 2 : 1;
  }
  // the deeds come off the merger table to the result, its own first
  const table = root.market.merger;
  const deals = new Map<Company, Deed[]>([
    [terms.a, table.dealA.copy()],
    [terms.b, table.dealB.copy()],
  ]);
  for (const c of result === terms.b ? [terms.b, terms.a] : [terms.a, terms.b]) for (const d of deals.get(c)!) result.deeds.add(d);
  for (const c of [terms.a, terms.b]) {
    if (c === result) continue;
    for (const land of root.board.goodsOf(c.key)) land.good!.companyId = result.key;
    for (const { ship } of root.board.shipsOf(c.key)) {
      ship.companyId = result.key;
      ship.shipType = result.shipType;
    }
    c.removeFromParent();
  }
  result.type = terms.siapSaji ? "siapsaji" : terms.a.type;
  result.mergedThisYear = true; // P3.7
  result.ownerName = winner.name;
  result.refreshName();
  for (const pl of root.players.copy()) pl.layoutCompanies(); // the absorbed companies' slots close up
  for (const land of root.board.goodsOf(result.key)) {
    land.good!.companyName = result.name;
    land.good!.ownerName = winner.name;
    land.good!.ownerSeat = winner.seat;
  }
  for (const { ship } of root.board.shipsOf(result.key)) {
    ship.seat = winner.seat; // P3.16: ships show the new owner's colour
    ship.companyName = result.name;
    ship.ownerName = winner.name;
  }
  root.board.syncHuts();
  root.board.syncShipCapacity(root.players.copy());
  turn.flush();
  table.end();
  turn.flush();

  if (terms.siapSaji) await giveUpHalf(root, turn, winner, result);
  turn.log(`${result.name} is now ${winner.logKey}'s, with ${result.deedCount} deeds.`);
  turn.flush();
}

/** P3S.5–P3S.7: the new owner removes half the goods (rounded up), only from the edges of zones, then the rest
 *  become siap saji. */
async function giveUpHalf(root: Root, turn: T, winner: Player, company: Company) {
  const total = root.board.goodsOf(company.key).length;
  const toRemove = Math.ceil(total / 2);
  turn.log(`${winner.logKey} must give up ${toRemove} of the ${total} rice and spice plantations; the rest become siap saji.`);
  await turn.createTurn([root], winner, async (sub) => {
    for (let k = 0; k < toRemove; k++) {
      const lands = root.board.goodsOf(company.key);
      const areas = lands.map((l) => l.areaId);
      const zoneCount = zonesOf(areas).length;
      // a marker may go only if every remaining zone stays contiguous (a zone may vanish entirely)
      const candidates = lands.filter((l) => {
        const rest = areas.filter((a) => a !== l.areaId);
        return zonesOf(rest).length <= zoneCount;
      });
      const markers = candidates.map((l) => l.good!);
      let chosen: GoodsMarker = markers[0];
      await ask(sub, winner, [
        Chit.pick(markers, (m) => {
          chosen = m;
        })
          .message(`give up a plantation (${toRemove - k} to go)`)
          .help("Half the merged company's goods, rounded up, are removed. Only goods at the edge of a zone may go: no zone may be broken in two.")
          .focus(root.board)
          .ai("siapsaji.remove"),
      ]);
      const where = chosen.parent as { province?: string } | undefined;
      discard(chosen);
      root.board.syncHuts();
      sub.log(`${winner.logKey} gives up the ${GOOD_LABEL[chosen.good]} plantation in ${where?.province ?? "?"}.`);
      sub.flush();
    }
  });
  for (const land of root.board.goodsOf(company.key)) land.good!.good = "siapsaji";
  turn.log(`The remaining ${root.board.goodsOf(company.key).length} plantations now produce siap saji.`);
  turn.flush();
}
