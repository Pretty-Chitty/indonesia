import { Chit, ChitRenderSpec } from "@pretty-chitty/core";
import { BoxGeometry, Mesh } from "three";
import { CUBE_HEIGHT, PLAYER_COLORS, RND_LABEL, RndTrack } from "../consts";
import { clickable, colorMaterial, galleryFit, LIFT } from "../render";

/** A player's R&D cube (C5, S4): it stands on the TableCell of its track's current step (P5.1). Drawn smaller than
 *  the real cube so five players' cubes fit one printed cell, in a 3 x 2 grid whose first place is the centre. */
export class Cube extends Chit {
  seat = 0;
  track: RndTrack = "slots";
  ownerName = "";

  override render(spec: ChitRenderSpec): void {
    clickable(spec);
    const size = 0.25;
    const mesh = new Mesh(new BoxGeometry(size, size, CUBE_HEIGHT), colorMaterial(PLAYER_COLORS[this.seat], 30));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    spec.object = mesh;
    spec.splay.enabled = true;
    spec.splay.columns = 3;
    spec.splay.rows = 2;
    spec.splay.rowOrientation = "center";
    spec.splay.columnOrientation = "center";
    spec.splay.spacingMultiplier = 1.08;
    spec.zLiftRatio = LIFT.marker;
    spec.showDetailsOnLongPress = true;
    galleryFit(spec, 1, 1, 160);
    spec.summary = `**${this.ownerName}'s ${RND_LABEL[this.track]} marker**: it stands on their current step of this research track.`;
  }
}
