// Indonesia's panel layout at each screen size (scripts/layout/lib.ts). `yarn layout:check`; `--print` lists them.
import { Root } from "../../src/chits/Root";
import { Player } from "../../src/chits/Player";
import { checkLayouts, Layout } from "./lib";

const root = new Root();
for (const id of ["me", "p2", "p3", "p4"]) {
  const p = new Player();
  p.playerId = id;
  p.id = id;
  root.players.add(p);
}
const names = new Map<unknown, string>([
  [root.board, "board"],
  [root.market, "market"],
  [root.tracks, "tracks"],
  ...root.players.map((p) => [p, p.playerId === "me" ? "me" : "them:" + p.playerId] as [unknown, string]),
]);
const TABLE = ["board", "market", "tracks"];
const OPPONENTS = ["them:p2", "them:p3", "them:p4"];

/** phone: the table's tab group on top, the mats (the viewer's first) in one group below */
const phone = (l: Layout) => l.groupCount(2).together(...TABLE).together("me", ...OPPONENTS).above("board", "me").first("me").heightShare("board", 0.52);
/** wide and short (a phone on its side, a foldable): the table at the left (65%), the viewer's mat over the opponents' at the right */
const side = (l: Layout) => l.together(...TABLE).first("board").leftOf("board", "me").leftOf("board", "them:p2").apart("me", "them:p2").above("me", "them:p2").widthShare("board", 0.65);

checkLayouts("Indonesia", root, "me", (c) => names.get(c), {
  phoneShort: phone,
  phone,
  phoneTall: phone,
  // too short for the viewer's mat over the opponents': the mats are one tab group at the right, the viewer's first
  phoneLandscape: (l) => l.groupCount(2).together(...TABLE).together("me", ...OPPONENTS).first("me").leftOf("board", "me").widthShare("board", 0.65),
  foldShort: (l) => side(l).groupCount(3),
  fold: (l) => side(l).groupCount(3),
  foldTall: (l) => side(l).groupCount(3, 5),
  tablet: (l) => l.groupCount(5).together(...TABLE).leftOf("board", "me").above("me", "them:p2"),
  laptop: (l) => l.groupCount(5).together(...TABLE).leftOf("board", "me").above("me", "them:p2"),
});
