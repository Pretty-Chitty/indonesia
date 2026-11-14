// A text picture of the table for the tutorial harness: what a narrator needs to know (and what a replay
// comparison fingerprints). Plain words, so a trace reads like the board.
import type { Root } from "../../src/chits/Root";
import type { Player } from "../../src/chits/Player";
import { PHASES } from "../../src/consts";

export function describePlayer(root: Root, p: Player): string {
  const lines: string[] = [];
  const rnd = Object.entries(p.rnd)
    .map(([k, v]) => `${k} ${v}`)
    .join(", ");
  lines.push(`${p.name} (order ${p.order + 1}): cash ${p.cash}, bank ${p.bank}, earnings ${p.earnings}; research ${rnd}`);
  for (const c of p.companies.copy()) {
    const pieces =
      c.type === "shipping"
        ? root.board.shipsOf(c.key).map(({ sea }) => `ship in sea ${sea.areaId}`)
        : root.board.goodsOf(c.key).map((l) => `${l.good!.good} on ${l.province} ${l.areaId}`);
    lines.push(`  ${c.name} [${c.deeds.map((d) => d.name).join(" + ")}]${c.operated ? " (operated)" : ""}: ${pieces.join(", ") || "-"}`);
  }
  // another player's city cards are secret until played: their spec is not sent to this seat
  lines.push(`  city cards: ${p.cityHand.hand.map((c) => (c.spec ? `${c.spec.era}:${c.spec.provinces.join("/")}` : "(secret)")).join("; ") || "-"}`);
  return lines.join("\n");
}

export function describeTable(root: Root, me: Player): string {
  const lines: string[] = [];
  lines.push(`Year ${root.year}, era ${root.era}, phase ${root.phase + 1} (${PHASES[root.phase] ?? "?"}); order ${root.playersInOrder().map((p) => p.name).join(", ")}`);
  lines.push(`On offer: ${root.market.deeds.map((d) => d.name).join(", ") || "-"}`);
  const cities = root.board.cities().map(({ land, city }) => `${land.province} ${land.areaId} size ${city.size} (${city.display()?.heldText ?? "nothing yet"})`);
  lines.push(`Cities: ${cities.join("; ") || "-"}`);
  const t = root.market.merger;
  if (t.active) lines.push(`Merger on the table: ${t.title}; bid ${t.bid} by ${t.highId || "-"}`);
  for (const p of [me, ...root.players.filter((x) => x !== me)]) lines.push(describePlayer(root, p));
  return lines.join("\n");
}
