// v1: the first, hand-written bot (fixed numbers), frozen as the yardstick the tuned v2 is measured against
// (references/ai.md §6 in the board-game-port skill). Do not change it: change v2.
import { AiRule } from "@pretty-chitty/core";
import { City } from "../chits/City";
import { LandArea } from "../chits/LandArea";
import { Player } from "../chits/Player";
import { Root } from "../chits/Root";
import { SeaArea } from "../chits/SeaArea";
import { GOOD_VALUE, Good, RND_TABLE_ROW, RndTrack } from "../consts";
import { coastLands, coastSeas, landNeighbours } from "../geometry/mapIndex";
import { boardFacts, chitOf, landValue, Memory, ownsDeed, seaDistance } from "./common";

export const v1Rules: Record<string, AiRule<Player, Root, Memory>> = {
    // cities: next to plantations and shipping, with room around
    "city.site": (opt, { view, random }) => {
      const land = chitOf<LandArea>(opt);
      const f = boardFacts(view);
      const seas = coastSeas(land.areaId);
      const shipsNear = seas.filter((s) => f.shipSeas.has(s)).length;
      const goodsNear = seas.flatMap((s) => coastLands(s)).filter((l) => f.goodsLands.has(l)).length;
      return shipsNear * 2 + goodsNear + landNeighbours(land.areaId).length * 0.2 + random() * 0.3;
    },
    // turn order: a small bid early in the game, within a budget of a share of cash; never bid the purse away
    "bid.up": (opt, { me, view }) => {
      const d = opt.data as { n: number; amount: number };
      const budget = Math.floor(me.cash * (view.year <= 2 ? 0.06 : 0.025));
      return d.amount + d.n <= budget ? 1 : -5;
    },
    "bid.down": () => -10,
    "bid.confirm": () => 0.5,
    // mergers: only with a comfortable purse, preferring to fold own companies together (a slot back, cheap)
    "merger.first": (opt, { me }) => (me.cash > 300 ? (ownsDeed(me, opt) ? 2 : 0.5) : -1),
    "merger.pass": () => 0,
    "merger.second": (opt, { me }) => (ownsDeed(me, opt) ? 3 : 1),
    "auction.up": (opt, { me }) => {
      const k = (opt.data as { k: number }).k;
      return me.cash > 400 && k === 1 ? 0.2 : -2;
    },
    "auction.bid": (opt, { me }) => {
      const d = opt.data as { amount: number; nominal: number };
      return d.amount <= Math.max(d.nominal, me.cash * 0.5) ? 1 : -5;
    },
    "auction.pass": () => 0.5,
    "siapsaji.remove": () => 1,
    // acquisitions: a shipping line first, then the most valuable good whose province is near ships and cities
    "acquire.deed": (opt, { me, view }) => {
      const marker = chitOf<{ deedId: number }>(opt);
      const deed = view.market.deeds.find((d) => d.deedId === marker.deedId);
      if (!deed) return 0;
      const d = deed.spec;
      if (d.type === "shipping") return me.companies.some((c) => c.type === "shipping") ? 2 : 6;
      const best = Math.max(0, ...view.board.legalStartAreas(deed).map((l) => landValue(l, view)));
      return GOOD_VALUE[d.type as Good] / 20 + best;
    },
    "acquire.pass": (_o, { me }) => (me.companies.length >= 1 ? -0.5 : -5),
    "acquire.area": (opt, { view }) => landValue(chitOf<LandArea>(opt), view),
    "acquire.ship": (opt, { view }) => {
      const f = boardFacts(view);
      return 3 - seaDistance(chitOf<SeaArea>(opt).areaId, f.citySeas);
    },
    // research: slots first, expansion, hull for shippers, mergers once there is money
    "research.cell": (opt, { me }) => {
      const cell = chitOf<{ row: string }>(opt);
      const track = (Object.entries(RND_TABLE_ROW).find(([, row]) => row === cell.row)?.[0] ?? "slots") as RndTrack;
      const level = me.rnd[track];
      switch (track) {
        case "slots":
          return 6 - level;
        case "expansion":
          return 4 - level * 0.5;
        case "hull":
          return me.companies.some((x) => x.type === "shipping") ? 4 - level * 0.5 : 0.5;
        case "mergers":
          return me.cash > 200 ? 3 : 0.5;
        case "bid":
          return 0.3;
      }
    },
    "research.hull": () => -1,
    "research.pass": () => -3,
    // operations: ships toward cities and plantations; sell to the biggest city; expand toward the coast
    "operate.company": (opt) => (chitOf<{ type: string }>(opt).type === "shipping" ? 1 : 2),
    // the AI picks by company; a piece is the human's shortcut
    "operate.piece": () => -1,
    "ship.place": (opt, { view, random }) => {
      const sea = chitOf<SeaArea>(opt);
      const f = boardFacts(view);
      const touchesCity = f.citySeas.has(sea.areaId) ? 2 : 0;
      const touchesGoods = coastLands(sea.areaId).some((l) => f.goodsLands.has(l)) ? 1.5 : 0;
      return 1 + touchesCity + touchesGoods + Math.max(0, 2 - seaDistance(sea.areaId, f.citySeas)) * 0.5 + random() * 0.3;
    },
    "ship.done": () => -1,
    "deliver.city": (opt) => chitOf<City>(opt).size,
    // own ships cost nothing net (P6P.9)
    "deliver.line": (opt, { me }) => (chitOf<{ seat: number }>(opt).seat === me.seat ? 2 : 1),
    // the AI picks by city; a ship is the human's shortcut to a line
    "deliver.ship": () => -1,
    "deliver.all": () => 0.8,
    "expand.area": (opt, { view }) => landValue(chitOf<LandArea>(opt), view),
    "expand.done": (opt, { me }) => ((opt.data as { mode: string }).mode === "paid" && me.cash < 150 ? 2 : -1),
    "growth.choose": (opt) => chitOf<City>(opt).size,
};
