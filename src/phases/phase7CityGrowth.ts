import { Chit } from "@pretty-chitty/core";
import { Root } from "../chits/Root";
import { CitySize } from "../consts";
import { ask } from "./common";

/** Phase 7, City Growth (P7): cities that received every produced good up to their size grow; delivered goods
 *  are discarded; the first player chooses when markers run short (P7.5). */
export async function executeCityGrowth(root: Root) {
  root.phase = 6;
  root.playerAid.phase = 6;
  const turn = root.turn;
  const all = root.board.cities();
  const candidates = all.filter(({ city }) => root.board.cityCanGrow(city));
  for (const size of [2, 1] as CitySize[]) {
    // larger cities first: a size 2 city that grows returns its marker to the supply, where a size 1 city growing
    // after it may take it (P7.4)
    let group = candidates.filter(({ city }) => city.size === size);
    const next = (size + 1) as CitySize;
    const available = root.tracks.supply.count(next);
    if (group.length > available) {
      const first = root.playersInOrder()[0];
      turn.log(`${group.length} size ${size} cities could grow but only ${available} size ${next} markers are left: ${first.logKey} chooses.`);
      const chosen: typeof group = [];
      await turn.createTurn([root], first, async (sub) => {
        while (chosen.length < available) {
          const rest = group.filter((g) => !chosen.includes(g));
          await ask(sub, first, [
            Chit.pick(rest.map((g) => g.city), (c) => {
              chosen.push(group.find((g) => g.city === c)!);
            })
              .message(`choose a city to grow (${chosen.length} of ${available})`)
              .help("More cities qualify than markers remain; the first player in order of play decides which grow.")
              .focus(root.board)
              .ai("growth.choose"),
          ]);
        }
      });
      group = chosen;
    }
    for (const { land, city } of group) {
      root.tracks.supply.take(next);
      root.tracks.supply.put(size);
      city.size = next;
      turn.log(`The city in ${land.province} grows to size ${next}.`);
      turn.flush();
    }
  }
  // P7.2: every delivered good is discarded: the goods sink into their cities, then the empty displays follow, to
  // come out next year at the city's size (P7.3)
  for (const { city } of all) city.clearGoods();
  turn.flush();
  for (const { city } of all) city.closeDisplay();
  turn.flush();
}
