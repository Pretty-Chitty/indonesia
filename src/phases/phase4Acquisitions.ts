import { Chit } from "@pretty-chitty/core";
import { PassButton } from "../ButtonLibrary";
import { Company } from "../chits/Company";
import { Deed } from "../chits/Deed";
import { GoodsMarker } from "../chits/GoodsMarker";
import { LandArea } from "../chits/LandArea";
import { Player } from "../chits/Player";
import { Root } from "../chits/Root";
import { SeaArea } from "../chits/SeaArea";
import { Ship } from "../chits/Ship";
import { Good, GOOD_LABEL } from "../consts";
import { landLayer } from "../geometry/mapIndex";
import { ask, T } from "./common";
import { removeUnstartable } from "./phase1NewEra";
import { removeStartMarker, startMarkerOf } from "./setup";
import { landed } from "../pieces";

/** Phase 4, Acquisitions (P4): rounds in order of play; one company per round; pass and you are out. */
export async function executeAcquisitions(root: Root) {
  root.phase = 3;
  root.playerAid.phase = 3;
  const passed = new Set<string>();
  let progress = true;
  while (progress) {
    progress = false;
    for (const p of root.playersInOrder()) {
      if (passed.has(p.playerId)) continue;
      if (p.freeSlots() <= 0) continue; // P4.5: no slot, nothing to do this round
      removeUnstartable(root); // P1.2
      const available = root.market.deeds.copy();
      if (!available.length) return; // P4.3
      const acquired = await root.turn.createTurn([root], p, async (turn) => {
        let deed: Deed | undefined;
        // the choice is made on the map: each available company's start marker stands in its province
        const markers = root.board.startMarkers.filter((m) => available.some((d) => d.deedId === m.deedId));
        await ask(turn, p, [
          Chit.pick(markers, (m) => {
            deed = available.find((d) => d.deedId === m.deedId);
          })
            .message("start a company")
            .help(`Tap a company's start marker on the map. Starting a company is free and takes one of your ${p.freeSlots()} free slots. A production company begins with one plantation in its province; a shipping line with one ship beside it.`)
            .focus(root.board)
            .ai("acquire.deed"),
          new PassButton(() => {}).pick().message("pass").ai("acquire.pass"),
        ]);
        if (!deed) {
          turn.log(`${p.logKey} starts no company this year.`);
          return false;
        }
        await acquire(root, turn, p, deed);
        return true;
      });
      if (acquired) progress = true;
      else passed.add(p.playerId); // P4.2
    }
  }
}

/** P4.4, P4.6, P4.7: take the deed, found the company, place its first plantation or ship. */
async function acquire(root: Root, turn: T, p: Player, deed: Deed) {
  const spec = deed.spec;
  // the company's identity, worked out before anything moves: its key and name ride on the piece placed first
  const key = `c${spec.id}`;
  const shipType: 1 | 2 = p.companies.filter((x) => x.type === "shipping").length % 2 === 0 ? 1 : 2;
  const name = deed.name;
  // 1. where: the player picks the spot on the map (P4.6, P4.7)
  if (spec.type === "shipping") {
    const seas = root.board.legalShipStarts(deed);
    let sea: SeaArea = seas[0];
    await ask(turn, p, [
      Chit.pick(seas, (s) => {
        sea = s;
      })
        .message(`place the first ship of ${name}`)
        .help(`A new shipping line starts with one ship in any sea area bordering ${spec.province}. Ships already there do not matter.`)
        .focus(root.board)
        .ai("acquire.ship"),
    ]);
    // 2. the piece goes down, in the player's colour, and the start marker comes off the map
    // the ship sets out from the company's start marker offshore; the marker then comes off the map
    const ship = new Ship().set((s) => {
      s.seat = p.seat;
      s.shipType = shipType;
      s.companyId = key;
      s.companyName = name;
      s.ownerName = p.name;
      s.parentFallback = startMarkerOf(root, spec.id);
    });
    sea.ships.add(ship);
    root.board.syncShipCapacity(root.players.copy());
    turn.flush();
    landed(ship);
    removeStartMarker(root, spec.id);
    turn.log(`${p.logKey} starts the ${name} company with a ship beside ${spec.province}.`);
  } else {
    const areas = root.board.legalStartAreas(deed);
    let land: LandArea = areas[0];
    await ask(turn, p, [
      Chit.pick(areas, (l) => {
        land = l;
      })
        .message(`place the first ${GOOD_LABEL[spec.type]} plantation of ${name}`)
        .help(`On any empty area of ${spec.province} that is not next to another ${GOOD_LABEL[spec.type]} plantation.`)
        .focus(root.board)
        .ai("acquire.area"),
    ]);
    // the plantation comes from the company's start marker offshore, with the owner's hut; the marker then
    // comes off the map
    const marker = new GoodsMarker().set((g) => {
      g.good = spec.type as Good;
      g.companyId = key;
      g.companyName = name;
      g.ownerName = p.name;
      g.ownerSeat = p.seat;
      g.layer = landLayer(land.areaId);
      g.parentFallback = startMarkerOf(root, spec.id);
    });
    land.goods.add(marker);
    root.board.syncHuts(); // the owner's hut goes up with the plantation
    turn.flush();
    landed(marker);
    removeStartMarker(root, spec.id);
    turn.log(`${p.logKey} starts the ${name} company, planting ${GOOD_LABEL[spec.type]} in ${spec.province}.`);
  }
  turn.flush();
  // 3. then the deed goes to the player's mat (P4.4)
  const company = new Company().set((c) => {
    c.key = key;
    c.type = spec.type;
    c.ownerName = p.name;
    c.shipType = shipType;
  });
  p.companies.add(company);
  company.deeds.add(deed);
  company.refreshName();
  p.layoutCompanies();
  turn.flush();
}
