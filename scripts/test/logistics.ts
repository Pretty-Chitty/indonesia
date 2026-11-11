// Checks of the delivery network on the real map (run: npx tsx scripts/test/logistics.ts)
import { coastLands, coastSeas, landById, seaNeighbours } from "../../src/geometry/mapIndex";
import { legalDeliveryChoices, maximumDeliveries, DeliveryProblem } from "../../src/logistics";

function expect(what: string, got: unknown, want: unknown) {
  if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`);
  console.log("ok:", what, "=", JSON.stringify(got));
}
// a coastal land A, a sea s touching it, another land B on the same sea
const A = [...landById.values()].find((l) => l.coastal && coastSeas(l.id).some((s) => coastLands(s).length >= 2))!;
const s = coastSeas(A.id).find((x) => coastLands(x).length >= 2)!;
const B = coastLands(s).find((l) => l !== A.id)!;
const line = (ships: number[], hull = 1) => ({ companyId: "L", ownerId: "p9", hull, ships: new Map(ships.map((x) => [x, 1])), used: new Map<number, number>() });
const p1: DeliveryProblem = { good: "rice", zones: [{ areas: [A.id], goods: 1 }], lines: [line([s])], cities: [{ landArea: B, size: 1, delivered: 0 }] };
expect("one ship between zone and city", maximumDeliveries(p1).count, 1);
expect("fee for one ship", maximumDeliveries(p1).fee, 5);
expect("legal choices", legalDeliveryChoices(p1).choices.length, 1);
// two-sea chain: s -> t, city on t
const t = seaNeighbours(s).find((x) => coastLands(x).some((l) => l !== A.id && l !== B));
if (t) {
  const C = coastLands(t).find((l) => l !== A.id && l !== B)!;
  const p2: DeliveryProblem = { good: "rice", zones: [{ areas: [A.id], goods: 2 }], lines: [line([s, t])], cities: [{ landArea: C, size: 1, delivered: 0 }, { landArea: B, size: 1, delivered: 0 }] };
  expect("chain of two ships, two cities, hull 1: the first ship carries one good in all", maximumDeliveries(p2).count, 1);
  const p3 = { ...p2, lines: [line([s, t], 2)] };
  expect("hull 2: one to each city", maximumDeliveries(p3).count, 2);
  const p4 = { ...p2, zones: [{ areas: [A.id], goods: 3 }], cities: [{ landArea: C, size: 2, delivered: 0 }, { landArea: B, size: 1, delivered: 0 }] };
  expect("hull 1 caps the first ship at one good", maximumDeliveries(p4).count, 1);
  expect("hull 2 lets two through, hull 3 three", [maximumDeliveries({ ...p4, lines: [line([s, t], 2)] }).count, maximumDeliveries({ ...p4, lines: [line([s, t], 3)] }).count], [2, 3]);
}
// the cheapest sale uses the seller's own ships before an opponent's in the same sea (P6P.9)
const mine = { ...line([s]), companyId: "M", ownerId: "me" };
const theirs = { ...line([s]), companyId: "T", ownerId: "them" };
for (const lines of [[theirs, mine], [mine, theirs]]) {
  const pm: DeliveryProblem = { ...p1, sellerId: "me", lines };
  const best = maximumDeliveries(pm);
  expect("own line preferred", pm.lines[best.deliveries[0].line].ownerId, "me");
  expect("nothing paid away", best.fee, 0);
  expect("both lines offered", legalDeliveryChoices(pm).choices.length, 2);
}
// demand exhausted
expect("city already supplied", maximumDeliveries({ ...p1, cities: [{ landArea: B, size: 1, delivered: 1 }] }).count, 0);
console.log("all logistics checks passed");
