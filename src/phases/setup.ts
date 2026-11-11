import { CITY_CARDS, DEEDS, ERAS, PLAYER_COLORS, RND_TABLE_ROW, RND_TRACKS, STARTING_CASH } from "../consts";
import { CityCard } from "../chits/CityCard";
import { Cube } from "../chits/Cube";
import { Deed } from "../chits/Deed";
import { Disc } from "../chits/Disc";
import { Root } from "../chits/Root";
import { StartMarker } from "../chits/StartMarker";
import { shuffle, T } from "./common";

/** Preparation (S1–S7), all on the setup turn so the first frame shows the whole table. */
export async function executeGameSetup(root: Root, turn: T) {
  const players = root.players.copy();
  // S7: open or secret money, decided before any amount is first sent (a viewer keeps what it was first sent)
  root.syncMoneySecrecy();
  players.forEach((p, i) => {
    p.seat = i;
    p.color = PLAYER_COLORS[i];
    p.cash = STARTING_CASH; // S1
    p.cityHand.holderId = p.playerId;
    p.syncSparks();
  });
  root.board.build();
  root.tracks.build();
  root.tracks.supply.fill();

  // S6: deeds sorted into eras; era A on the table, B and C face down in the pile
  for (const d of DEEDS) {
    const deed = new Deed().set((x) => (x.deedId = d.id));
    if (d.era === "A") root.market.deeds.add(deed);
    else {
      deed.faceDown = true;
      root.market.pile.add(deed);
    }
  }
  layOutStartMarkers(root);

  const rng = await turn.takeRng(60);
  // S2 / T1: one city card per era each; two per era with two players
  const perPlayer = players.length === 2 ? 2 : 1;
  for (const era of ERAS) {
    const cards = shuffle(
      CITY_CARDS.filter((c) => c.era === era).map((c) => new CityCard().set((x) => (x.cardId = c.id))),
      rng,
    );
    for (const p of players) for (let k = 0; k < perPlayer; k++) p.cityHand.hand.add(cards.pop()!);
    cards.forEach((c) => root.cityCardStore.cards.add(c));
  }

  // S4: a cube on the first step of every R&D track
  for (const p of players) {
    for (const track of RND_TRACKS) {
      root.tracks.cell(RND_TABLE_ROW[track], 1).pieces.add(
        new Cube().set((c) => {
          c.seat = p.seat;
          c.track = track;
          c.ownerName = p.name;
        }),
      );
    }
  }

  // S5: random order of play, shown by the discs on the Turn Order track
  const order = shuffle(players, rng);
  root.turnOrder = order.map((p) => p.playerId);
  order.forEach((p, i) => {
    p.order = i;
    root.tracks.cell("turnOrder", i + 1).pieces.add(
      new Disc().set((d) => {
        d.seat = p.seat;
        d.ownerName = p.name;
      }),
    );
  });

  root.era = "A";
  root.market.era = "A";
  root.year = 0;
  root.playerAid.era = "A";
  turn.log(`Setup: each player has 100 rupiah and three city cards (one per era). Order of play: ${order.map((p) => p.logKey).join(", ")}.`);
}

/** S6, P1.10: a start marker for each available deed, in the sea just off its province (two in one province stand
 *  side by side). */
export function layOutStartMarkers(root: Root) {
  const perProvince = new Map<string, number>();
  for (const deed of root.market.deeds.copy()) {
    const slot = perProvince.get(deed.spec.province) ?? 0;
    perProvince.set(deed.spec.province, slot + 1);
    root.board.startMarkers.add(
      new StartMarker().set((m) => {
        m.deedId = deed.deedId;
        m.slot = slot;
      }),
    );
  }
}
/** The start marker of a deed, still on the map (new pieces of the company come from it). */
export function startMarkerOf(root: Root, deedId: number) {
  return root.board.startMarkers.find((m) => m.deedId === deedId);
}
export function removeStartMarker(root: Root, deedId: number) {
  for (const m of root.board.startMarkers.copy()) if (m.deedId === deedId) m.removeFromParent();
}
