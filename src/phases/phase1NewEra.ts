import { Chit } from "@pretty-chitty/core";
import { City } from "../chits/City";
import { GoodsDisplay } from "../chits/GoodsDisplay";
import { Player } from "../chits/Player";
import { Root } from "../chits/Root";
import { Era, ERAS } from "../consts";
import { ask, money } from "./common";
import { layOutStartMarkers, removeStartMarker } from "./setup";

/** Phase 1, New Era (P1, V1). Also the year boundary: last year's earnings become cash (P6L.1), or are doubled
 *  and settled when the game ends here (V2). */
export async function executeNewEra(root: Root) {
  const turn = root.turn;
  root.phase = 0;
  root.year++;
  root.playerAid.year = root.year;
  root.playerAid.phase = 0;

  // P1.2: companies that can no longer start leave the game before the era is judged
  removeUnstartable(root);
  const left = root.market.deeds.copy();
  const eraOver = root.year > 1 && (left.length === 0 || new Set(left.map((d) => d.spec.type)).size === 1);
  const ending = eraOver && root.era === "C";

  for (const p of root.players.copy()) {
    if (p.earnings !== 0) {
      const settled = ending ? p.earnings * 2 : p.earnings;
      turn.log(`${p.logKey} ${ending ? "doubles their last earnings and " : ""}moves ${money(settled)} of earnings to cash.`);
      p.addCash(settled);
      p.earnings = 0;
      p.syncSparks();
    }
    for (const c of p.companies.copy()) {
      c.setOperated(false);
      c.mergedThisYear = false;
    }
  }
  turn.flush();

  if (ending) {
    // V1: era C has ended
    root.gameOver = true;
    root.syncMoneySecrecy(); // secret money is everyone's again: the amounts and their whole history (S7)
    turn.log(`Era C has ended: ${left.length === 0 ? "every era C company was acquired" : "only one type of era C company is left"}. The game is over.`);
    return;
  }

  if (root.year === 1 || eraOver) {
    root.eraStartYear = root.year;
    if (eraOver) {
      root.era = ERAS[ERAS.indexOf(root.era) + 1] as Era;
      root.market.era = root.era;
      root.playerAid.era = root.era;
      turn.log(`Era ${root.era} begins.`);
    } else turn.log(`Year 1: era A begins.`);
    turn.flush();
    await buildCities(root);
    if (eraOver) layOutEra(root);
  } else {
    turn.log(`Year ${root.year} (era ${root.era}).`);
  }
}

/** P1.2: a deed with no valid starting area is discarded. */
export function removeUnstartable(root: Root) {
  for (const deed of root.market.deeds.copy()) {
    if (!root.board.canStart(deed)) {
      removeStartMarker(root, deed.deedId);
      root.deedStore.deeds.add(deed);
      root.turn.log(`The ${deed.name} company cannot start anywhere and is discarded.`);
    }
  }
}

/** P1.10: discard the previous era's unacquired deeds and lay out the new era's. */
function layOutEra(root: Root) {
  for (const deed of root.market.deeds.copy()) {
    removeStartMarker(root, deed.deedId);
    root.deedStore.deeds.add(deed);
    root.turn.log(`The ${deed.name} company was never started and is discarded.`);
  }
  for (const deed of root.market.pile.copy()) {
    if (deed.spec.era === root.era) {
      deed.faceDown = false;
      root.market.deeds.add(deed);
    }
  }
  layOutStartMarkers(root);
  root.turn.log(`Available this era: ${root.market.deeds.map((d) => d.name).join(", ")}.`);
  root.turn.flush();
}

/** P1.5–P1.9, T2: in order of play, each player builds a city from their card for this era. */
async function buildCities(root: Root) {
  const order = root.playersInOrder();
  const rounds = order.length === 2 ? 2 : 1; // T2: two players build two cities each, alternating
  for (let r = 0; r < rounds; r++) {
    for (const p of order) await buildCity(root, p);
  }
}

async function buildCity(root: Root, p: Player) {
  const card = p.cityCard(root.era);
  if (!card) return;
  // the card was secret until now: lay it face up beside the stack for everyone (P1.5)
  card.revealed = true;
  p.cityHand.shown = card;
  root.turn.log(`${p.logKey} reveals their era ${root.era} city card: ${card.spec.provinces.join(", ")}.`);
  root.turn.flush();
  const sites = root.board.legalCitySites(card.spec.provinces);
  const supplyLeft = root.tracks.supply.count(1) > 0;
  if (!sites.length || !supplyLeft) {
    root.cityCardStore.cards.add(card);
    root.turn.log(`${p.logKey} cannot build a city in ${card.spec.provinces.join(", ")}${supplyLeft ? "" : " (no size 1 markers left)"} and discards the card.`);
    root.turn.flush();
    return;
  }
  await root.turn.createTurn([root], p, async (turn) => {
    let site = sites[0];
    await ask(turn, p, [
      Chit.pick(sites, (l) => {
        site = l;
      })
        .message("build a city")
        .help(`Your era ${root.era} card names ${card.spec.provinces.join(", ")}. A city goes on an empty coastal area; each province holds at most one city.`)
        .focus([root.board, card])
        .ai("city.site"),
    ]);
    root.tracks.supply.take(1);
    const city = new City().set((c) => (c.areaId = site.areaId));
    site.city = city;
    // with its size 1 goods display (P1.6), which waits inside the city until a good is first sold there
    city.pocket.add(new GoodsDisplay().set((d) => (d.parentFallback = city)));
    root.cityCardStore.cards.add(card);
    turn.log(`${p.logKey} builds a city in ${site.province}.`);
    turn.flush();
  });
}
