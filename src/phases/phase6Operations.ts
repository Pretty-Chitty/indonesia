import { Chit } from "@pretty-chitty/core";
import { ConfirmDoneButton, DeliverAllButton, DoneButton } from "../ButtonLibrary";
import { City } from "../chits/City";
import { Company } from "../chits/Company";
import { DeliveredGood } from "../chits/DeliveredGood";
import { GoodsMarker } from "../chits/GoodsMarker";
import { LandArea } from "../chits/LandArea";
import { Player } from "../chits/Player";
import { Root } from "../chits/Root";
import { SeaArea } from "../chits/SeaArea";
import { Ship } from "../chits/Ship";
import { Good, GOOD_LABEL, GOOD_VALUE } from "../consts";
import { applyDelivery, Delivery, DeliveryProblem, legalDeliveryChoices, maximumDeliveries } from "../logistics";
import { ask, money, T } from "./common";
import { coastLands, landLayer, landNeighbours, seaNeighbours } from "../geometry/mapIndex";
import { landed } from "../pieces";

/** Phase 6, Operations (P6): rounds in order of play; each player operates one company per round until every
 *  company has operated (P6.1–P6.4). */
export async function executeOperations(root: Root) {
  root.phase = 5;
  root.playerAid.phase = 5;
  // a shipping line that cannot add a ship (at the era's limit, no sea to grow into, or no Expansion) has nothing to
  // do: it operates without asking anyone. Nothing in this phase changes that, so it is settled up front.
  for (const p of root.playersInOrder()) {
    for (const c of p.companies.filter((x) => x.type === "shipping" && !x.operated)) {
      const ships = root.board.shipsOf(c.key).length;
      const limit = c.shipLimit(root.era);
      if (ships < limit && p.rnd.expansion > 0 && root.board.shipExpansionTargets(c).length) continue;
      c.setOperated(true);
      root.turn.log(`${c.name} has nothing to do: ${ships >= limit ? `its ${ships} ships are the most it may float in era ${root.era}` : "no sea to add a ship to"}.`);
    }
  }
  root.turn.flush();
  let progress = true;
  while (progress) {
    progress = false;
    for (const p of root.playersInOrder()) {
      const pending = p.companies.filter((c) => !c.operated);
      if (!pending.length) continue;
      progress = true;
      await root.turn.createTurn([root], p, async (turn) => {
        let company = pending[0];
        await ask(turn, p, [
          // picked by its column of deeds on the player's own mat (no gallery: picking on the board is quicker)...
          Chit.pick(pending, (c) => {
            company = c;
          })
            .message("operate a company")
            .help("Tap one of your companies that has not operated this year: one of its plantations or ships on the map, or its deeds. You must operate one each round, even if it can do nothing useful.")
            .focus(p)
            .ai("operate.company"),
          // ...or by any of its plantations or ships on the map
          Chit.pick(pending.flatMap((c) => root.board.piecesOf(c)) as Chit[], (x) => {
            company = pending.find((c) => (root.board.piecesOf(c) as Chit[]).includes(x))!;
          })
            .message("operate the company of this piece")
            .focus(root.board)
            .ai("operate.piece"),
        ]);
        // its pieces lift off the map, outlined in white, while it operates, so everyone sees which they are
        root.board.raise(company, true);
        turn.flush();
        if (company.type === "shipping") await operateShipping(root, turn, p, company);
        else await operateProduction(root, turn, p, company);
        root.board.raise(company, false); // new pieces from an expansion included
        company.setOperated(true);
        turn.flush();
      });
    }
  }
}

/** P6S: a shipping company may add ships up to its era limit, at most Expansion per operation (P6S.2–P6S.4). */
async function operateShipping(root: Root, turn: T, p: Player, company: Company) {
  const limit = company.shipLimit(root.era);
  let placed = 0;
  turn.log(`${p.logKey} operates ${company.name} (${root.board.shipsOf(company.key).length} of ${limit} ships).`);
  while (placed < p.rnd.expansion && root.board.shipsOf(company.key).length < limit) {
    const targets = root.board.shipExpansionTargets(company);
    if (!targets.length) break;
    let sea: SeaArea | undefined;
    let done = false;
    await ask(turn, p, [
      Chit.pick(targets, (s) => {
        sea = s;
      })
        .message(`add a ship to ${company.name} (${placed} of ${p.rnd.expansion} this operation)`)
        .help(`A new ship goes in a sea area that already holds one of the line's ships, or next to one. The line may float ${limit} ships this era and has ${root.board.shipsOf(company.key).length}.`)
        .focus(root.board)
        .context(company)
        .ai("ship.place"),
      new DoneButton(() => {
        done = true;
      })
        .pick()
        .message("stop expanding")
        .ai("ship.done"),
    ]);
    if (done || !sea) break;
    // the new ship sets out from one of the line's ships, in that sea or the next one, and sails to its sea
    const target: SeaArea = sea;
    const fleet = root.board.shipsOf(company.key);
    const from = fleet.find((x) => x.sea === target) ?? fleet.find((x) => seaNeighbours(target.areaId).includes(x.sea.areaId)) ?? fleet[0];
    const ship = new Ship().set((s) => {
      s.seat = p.seat;
      s.shipType = company.shipType;
      s.companyId = company.key;
      s.companyName = company.name;
      s.ownerName = p.name;
      s.parentFallback = from?.ship;
      s.raised = true; // with the rest of the operating line
    });
    target.ships.add(ship);
    root.board.syncShipCapacity(root.players.copy());
    placed++;
    turn.log(`${p.logKey} adds a ship to ${company.name}.`);
    turn.flush();
    landed(ship);
  }
}

/** P6P: sell as much as possible (mandatory), take the income less fees, then expand: free after a sell-out,
 *  bought otherwise (P6P.8–P6P.16). */
async function operateProduction(root: Root, turn: T, p: Player, company: Company) {
  const good = company.type as Good;
  const goodsOnBoard = root.board.goodsOf(company.key).length;
  turn.log(`${p.logKey} operates ${company.name} (${goodsOnBoard} ${GOOD_LABEL[good]}).`);
  root.board.syncShipCapacity(root.players.copy());
  let problem = root.board.deliveryProblem(company, root.players.copy());
  const max = maximumDeliveries(problem).count;
  let sold = 0;
  if (max === 0) turn.log(`${company.name} can reach no city that still wants ${GOOD_LABEL[good]}: nothing is sold.`);
  while (sold < max) {
    const { choices } = legalDeliveryChoices(problem);
    if (!choices.length) break;
    const cityChits = new Map<City, typeof choices>();
    for (const ch of choices) {
      const city = root.board.land(problem.cities[ch.city].landArea).city!;
      if (!cityChits.has(city)) cityChits.set(city, []);
      cityChits.get(city)!.push(ch);
    }
    // or the line, by any of its ships a delivery can sail on: every one of them, not one per sea, since a player
    // zoomed in on part of the map taps the ship in front of them
    const shipLines = shipsOnRoutes(root, problem, choices);
    let chosen: Delivery | undefined;
    let all = false;
    await ask(turn, p, [
      Chit.pick([...shipLines.keys()], async (ship) => {
        const line = problem.lines[shipLines.get(ship)![0].line];
        // the cheapest delivery through that ship to each city it can still serve
        const byCity = new Map<City, (typeof choices)[number]>();
        for (const o of shipLines.get(ship)!) {
          const city = root.board.land(problem.cities[o.city].landArea).city!;
          const cur = byCity.get(city);
          if (!cur || cheaper(o, cur)) byCity.set(city, o);
        }
        if (byCity.size === 1) {
          chosen = [...byCity.values()][0];
          return;
        }
        await ask(turn, p, [
          Chit.pick([...byCity.keys()], (city) => {
            chosen = byCity.get(city);
          })
            .message(`choose the city to ship to with ${line.ownerId === p.playerId ? "your" : "that"} line`)
            .context(ship)
            .focus(root.board)
            .ai("deliver.city"),
        ]);
      })
        .message(`ship ${GOOD_LABEL[good]} with this line`)
        .focus(root.board)
        .ai("deliver.ship"),
      Chit.pick([...cityChits.keys()], async (city) => {
        const options = cityChits.get(city)!;
        // the same city by several lines or from several zones: the cheapest of each line, chosen by its ship
        const byLine = new Map<number, (typeof options)[number]>();
        for (const o of options) {
          const cur = byLine.get(o.line);
          if (!cur || o.fee < cur.fee) byLine.set(o.line, o);
        }
        if (byLine.size === 1) {
          chosen = [...byLine.values()][0];
          return;
        }
        // every ship of those lines on a route to the city, each standing for the cheapest delivery through it
        const reps = new Map<Ship, (typeof options)[number]>();
        for (const [ship, through] of shipsOnRoutes(root, problem, options)) reps.set(ship, through.reduce((a, b) => (cheaper(b, a) ? b : a)));
        await ask(turn, p, [
          Chit.pick([...reps.keys()], (ship) => {
            chosen = reps.get(ship);
          })
            .message("choose the shipping line to use")
            .help("Several lines reach that city. Each ship used is paid 5 by the seller; the line's owner earns it.")
            .focus(root.board)
            .ai("deliver.line"),
        ]);
      })
        .message(`sell ${GOOD_LABEL[good]} to a city (${sold} of ${max} sold)`)
        .help("A production company must sell as many goods as it can. Tap the city to supply, or a ship of the line to use (your own cost nothing; others' cost 5 per ship); only choices that still allow the full sale are offered. A size 1 city buys one of each good produced, size 2 two, size 3 three.")
        .focus(root.board)
        .context(company)
        .ai("deliver.city"),
      new DeliverAllButton(() => {
        all = true;
      }).pick().message("sell the rest at the lowest fees").ai("deliver.all"),
    ]);
    if (all) {
      for (const d of maximumDeliveries(problem).deliveries) {
        deliverOne(root, turn, p, company, problem, d);
        problem = applyDelivery(problem, d);
        sold++;
      }
      break;
    }
    if (!chosen) break;
    deliverOne(root, turn, p, company, problem, chosen);
    problem = applyDelivery(problem, chosen);
    sold++;
  }

  if (sold > 0 && sold === goodsOnBoard) {
    // P6P.11: sold everything: must expand for free, by the full Expansion level while there is room (Q-free-expansion)
    await expand(root, turn, p, company, "free");
  } else {
    // P6P.15: may buy expansions at the good's value each, from cash (Q-earnings)
    await expand(root, turn, p, company, "paid");
  }

  // the markers flip back once the operation is over, so the fees paid stay in view while the company expands: ship
  // capacity is per production company operation (P6P.7)
  const usedMarkers = root.board.seas.copy().flatMap((sea) => sea.ships.copy().flatMap((ship) => ship.capacity.filter((m) => m.used)));
  if (usedMarkers.length) {
    for (const m of usedMarkers) m.used = false;
    turn.flush();
  }
}

type DeliveryChoice = ReturnType<typeof legalDeliveryChoices>["choices"][number];

/** Lower fee first, then the shorter route. */
function cheaper(a: DeliveryChoice, b: DeliveryChoice): boolean {
  return a.fee < b.fee || (a.fee === b.fee && a.route.length < b.route.length);
}

/** Every ship a delivery among `options` could sail on (a ship of its line in a sea of its route), with those
 *  deliveries. */
function shipsOnRoutes(root: Root, problem: DeliveryProblem, options: DeliveryChoice[]): Map<Ship, DeliveryChoice[]> {
  const out = new Map<Ship, DeliveryChoice[]>();
  for (const o of options) {
    const companyId = problem.lines[o.line].companyId;
    for (const sea of new Set(o.route)) {
      for (const ship of root.board.sea(sea).ships.filter((s) => s.companyId === companyId)) {
        if (!out.has(ship)) out.set(ship, []);
        out.get(ship)!.push(o);
      }
    }
  }
  return out;
}

/** One good from a zone to a city along a line's ships: the counter on the city, the value to the seller's
 *  earnings, the fee to the line's owner (P6P.8, P6P.9). */
function deliverOne(root: Root, turn: T, p: Player, company: Company, problem: DeliveryProblem, d: Delivery) {
  const good = problem.good;
  const land = root.board.land(problem.cities[d.city].landArea);
  const city = land.city!;
  const line = problem.lines[d.line];
  const lineOwner = root.player(line.ownerId);
  const lineCompany = lineOwner.companyById(line.companyId) ?? lineOwner.companies.find((c) => c.key === line.companyId);
  const fee = d.route.length * 5;
  // the good appears on a producing area of its zone, beside the first sea of its route
  const zone = problem.zones[d.zone].areas;
  const shore = new Set(coastLands(d.route[0]));
  const from = root.board.land(zone.find((a) => shore.has(a)) ?? zone[0]);
  const counter = new DeliveredGood().set((g) => {
    g.good = good;
    g.parentFallback = from.good; // it rises out of the goods marker, not in from the edge of the table
  });
  from.transit.add(counter);
  // as the city's goods display rises out of it, if this is the first good sold there this year (P6P.2)
  const display = city.openDisplay();
  turn.flush();
  landed(counter); // the goods marker it rose from may later be given up in a merger
  // then it boards one of the line's ships in each sea of the route, the one with the most room; as it moves off a
  // ship, that ship's capacity marker flips to its Rp 5 face (P6P.7, P6P.9)
  const useOne = (ship: Ship) => (ship.capacity.find((m) => !m.used)!.used = true);
  let carrier: Ship | undefined;
  for (const sea of d.route) {
    const ships = root.board.sea(sea).ships.filter((s) => s.companyId === line.companyId && s.freeCapacity() > 0);
    const ship = ships.reduce((a, b) => (b.freeCapacity() > a.freeCapacity() ? b : a));
    ship.cargo.add(counter);
    if (carrier) useOne(carrier);
    carrier = ship;
    turn.flush();
  }
  // and lands on the city's display, on the first lobe without one of its kind; at City Growth it sinks into the city
  // (City.clearGoods), which it now names as where it goes
  counter.parentFallback = city;
  display.place(counter);
  if (carrier) useOne(carrier);
  p.addEarnings(GOOD_VALUE[good]);
  if (lineOwner !== p) {
    p.addEarnings(-fee);
    lineOwner.addEarnings(fee);
  }
  turn.log(
    `${p.logKey} sells ${GOOD_LABEL[good]} to the city in ${land.province} for ${GOOD_VALUE[good]} via ${lineCompany?.name ?? "a line"} (${d.route.length} ship${d.route.length === 1 ? "" : "s"}${lineOwner === p ? ", their own line" : `, ${money(fee)} to ${lineOwner.logKey}`}).`,
  );
  turn.flush();
}

/** P6P.11–P6P.15: expand into empty areas next to the company's zones. */
async function expand(root: Root, turn: T, p: Player, company: Company, mode: "free" | "paid") {
  const good = company.type as Good;
  const price = mode === "paid" ? GOOD_VALUE[good] : 0;
  let placed = 0;
  while (placed < p.rnd.expansion) {
    const targets = root.board.expansionTargets(company);
    if (!targets.length) {
      if (placed === 0) turn.log(`${company.name} has no room to expand.`);
      break;
    }
    if (mode === "paid" && p.cash < price) {
      // with secret money (S7) skipping the offer, or saying why, would tell everyone their cash is below the price:
      // they are offered it and decline, and the log says only that
      if (root.moneyIsSecret()) {
        if (placed === 0) {
          await ask(turn, p, [
            new ConfirmDoneButton(() => {})
              .pick()
              .message(`buy no areas for ${company.name}`)
              .ai("expand.done", { mode }),
          ], `buy areas for ${company.name}`, `Areas cost ${money(price)} each and you cannot afford one, so you buy none.`);
          turn.log(`${p.logKey} buys no areas for ${company.name}.`);
        }
      } else if (placed === 0) turn.log(`${p.logKey} cannot afford to expand ${company.name} (${money(price)} per area).`);
      break;
    }
    let land: LandArea | undefined;
    let done = false;
    // a free expansion is not optional: it stops only at the Expansion level or when no area is left (P6P.11)
    const mustPlace = mode === "free";
    await ask(turn, p, [
      Chit.pick(targets, (l) => {
        land = l;
      })
        .message(mode === "free" ? `expand ${company.name} for free (${placed} of ${p.rnd.expansion})` : `buy an area for ${company.name} at ${money(price)} (${placed} of ${p.rnd.expansion})`)
        .help(
          mode === "free"
            ? "The company sold everything, so it must expand for free: one area for each step of your Expansion research, while there is room. An area must touch one of the company's zones (arrows count), be empty, and not touch another company's zone of the same good."
            : `The company did not sell everything, so it may buy areas at the good's value each, up to your Expansion level. They are paid from the cash you had before this year's earnings: ${money(p.cash)} (earnings can be spent once the year ends).`,
        )
        .focus(root.board)
        .context(company)
        .ai("expand.area", { mode }),
      !mustPlace &&
        new DoneButton(() => {
          done = true;
        })
          .pick()
          .message("stop expanding")
          .ai("expand.done", { mode }),
    ]);
    if (done || !land) {
      if (mode === "paid" && placed === 0) turn.log(`${p.logKey} buys no areas for ${company.name}.`);
      break;
    }
    // the new marker comes from a neighbouring plantation of the company, not in from the edge of the table
    const target: LandArea = land;
    const from = landNeighbours(target.areaId)
      .map((id) => root.board.land(id))
      .find((l) => l.good?.companyId === company.key);
    const marker = new GoodsMarker().set((g) => {
      g.good = good;
      g.companyId = company.key;
      g.companyName = company.name;
      g.ownerName = p.name;
      g.ownerSeat = p.seat;
      g.layer = landLayer(target.areaId);
      g.parentFallback = from?.good; // a neighbour that may later be given up in a merger: forgotten once it lands
      g.raised = true; // with the rest of the operating company
    });
    target.goods.add(marker);
    root.board.syncHuts();
    if (price) p.addCash(-price);
    placed++;
    turn.log(`${p.logKey} expands ${company.name} into ${land.province}${price ? ` for ${money(price)}` : " for free"}.`);
    turn.flush();
    landed(marker);
  }
}
