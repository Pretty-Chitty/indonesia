import { Chit } from "@pretty-chitty/core";
import { PassButton } from "../ButtonLibrary";
import { Cube } from "../chits/Cube";
import { Root } from "../chits/Root";
import { RND_LABEL, RND_STEPS, RND_TABLE_ROW, RND_TRACKS, RndTrack } from "../consts";
import { ask } from "./common";

/** Phase 5, Research & Development (P5): each player, in order, advances one cube one step, or another player's
 *  Hull cube (P5.8). */
export async function executeResearch(root: Root) {
  root.phase = 4;
  root.playerAid.phase = 4;
  const cubes = root.tracks.cells.copy().flatMap((c) => c.pieces.filter((x) => x instanceof Cube) as Cube[]);
  for (const p of root.playersInOrder()) {
    // your own research: the next space on each track you have not finished (P5.1, P5.7)
    const nextCells = RND_TRACKS.filter((t) => p.rnd[t] < RND_STEPS).map((t) => ({ track: t, cell: root.tracks.cell(RND_TABLE_ROW[t], p.rnd[t] + 1) }));
    // or another player's Hull marker (P5.8)
    const otherHulls = cubes.filter((c) => c.track === "hull" && c.seat !== p.seat && root.players.find((x) => x.seat === c.seat)!.rnd.hull < RND_STEPS);
    if (!nextCells.length && !otherHulls.length) continue;
    await root.turn.createTurn([root], p, async (turn) => {
      let mine: RndTrack | undefined;
      let theirs: Cube | undefined;
      await ask(
        turn,
        p,
        [
          Chit.pick(
            nextCells.map((n) => n.cell),
            (cell) => {
              mine = nextCells.find((n) => n.cell === cell)!.track;
            },
          )
            .message("advance one of their tracks")
            .focus(root.tracks)
            .ai("research.cell"),
          otherHulls.length > 0 &&
            Chit.pick(otherHulls, (c) => {
              theirs = c;
            })
              .message("advance another player's Hull")
              .focus(root.tracks)
              .ai("research.hull"),
          new PassButton(() => {}).pick().message("pass").ai("research.pass"),
        ],
        "advance a research marker",
        "Tap the next space on one of your tracks (Slots, Mergers, Expansion, Hull or Turn Order Bid), or tap another player's Hull marker to advance theirs instead.",
      );
      const owner = theirs ? root.players.find((x) => x.seat === theirs!.seat)! : p;
      const track: RndTrack | undefined = theirs ? "hull" : mine;
      if (!track) {
        turn.log(`${p.logKey} does no research.`);
        return;
      }
      const cube = cubes.find((c) => c.seat === owner.seat && c.track === track)!;
      owner.rnd[track] += 1;
      owner.syncSparks();
      if (track === "hull") root.board.syncShipCapacity(root.players.copy());
      root.tracks.cell(RND_TABLE_ROW[track], owner.rnd[track]).pieces.add(cube);
      turn.log(owner === p ? `${p.logKey} researches ${RND_LABEL[track]} to ${owner.rnd[track]}.` : `${p.logKey} advances ${owner.logKey}'s Hull to ${owner.rnd.hull}.`);
      turn.flush();
    });
  }
}
