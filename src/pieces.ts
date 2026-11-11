import { Chit } from "@pretty-chitty/core";

/** Take a piece off the table for good. A piece laid with a `parentFallback` (so it rises out of the disc, ship or
 *  plantation it came from) would otherwise be drawn back at that source once it has no parent, as if returned to a
 *  bag, and sit there for the rest of the game. */
export function discard(piece: Chit) {
  piece.parentFallback = undefined;
  piece.removeFromParent();
}

/** A piece laid with a `parentFallback` has made its entrance once it has been flushed: forget the source. Its saved
 *  state would otherwise name the source for the rest of the game, and a source that later leaves the table (a start
 *  marker, a plantation given up in a merger) cannot be found when the game is replayed. */
export function landed(piece: Chit) {
  piece.parentFallback = undefined;
}
