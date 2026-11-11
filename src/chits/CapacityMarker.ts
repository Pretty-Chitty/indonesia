import { Chit, ChitRenderSpec } from "@pretty-chitty/core";
import { CircleGeometry, CylinderGeometry, Group, Mesh } from "three";
import { CapacityFace } from "../canvas/CapacityFace";
import { PLAYER_COLORS } from "../consts";
import { colorMaterial, LIFT } from "../render";

export const CAPACITY_R = 0.17;
const CAPACITY_T = 0.04;
/** gap between neighbouring markers */
export const CAPACITY_GAP = 0.03;

/** One good's worth of a ship's capacity (P6P.6): a ship carries as many goods per production company operation as
 *  its owner's Hull, and shows that many markers on the water in front of it. A marker flips to its "Rp 5" face as a
 *  good it carried moves on (the fee the seller pays, P6P.9) and flips back when the operation ends. */
export class CapacityMarker extends Chit {
  seat = -1;
  used = false;
  /** place in the rows in front of the ship, set by Ship.syncCapacity */
  col = 0;
  row = 0;
  rowSize = 1;

  override render(spec: ChitRenderSpec): void {
    const ring = this.seat >= 0 ? PLAYER_COLORS[this.seat] : "#8a8378";
    const g = new Group();
    const side = new CylinderGeometry(CAPACITY_R, CAPACITY_R, CAPACITY_T, 12, 1, true);
    side.rotateX(Math.PI / 2);
    const edge = new Mesh(side, colorMaterial("#b89a5c", 20));
    edge.castShadow = true;
    g.add(edge);
    const face = (used: boolean) =>
      new CapacityFace().set((f) => {
        f.used = used;
        f.ring = ring;
      }).material;
    const top = new Mesh(new CircleGeometry(CAPACITY_R, 12), face(false));
    top.position.z = CAPACITY_T / 2;
    top.castShadow = true;
    top.receiveShadow = true;
    const bottom = new Mesh(new CircleGeometry(CAPACITY_R, 12), face(true));
    bottom.rotation.y = Math.PI; // reads the right way round once the marker is flipped
    bottom.position.z = -CAPACITY_T / 2;
    bottom.castShadow = true;
    g.add(top, bottom);
    spec.object = g;
    spec.rotateY = this.used ? Math.PI : 0;
    spec.rotationSpeed = 600;
    // rows of up to three, each row centred in front of the ship (up to Hull 5); the ship sets col, row and
    // rowSize when the markers change, so this render reads only its own fields
    const pitch = CAPACITY_R * 2 + CAPACITY_GAP;
    spec.offsetX = (this.col - (this.rowSize - 1) / 2) * pitch;
    spec.offsetY = -this.row * pitch;
    spec.zLiftRatio = LIFT.piece;
    spec.worthSlidingToPanelToShowChange = false;
    spec.summary = this.used ? "**Used**: this ship has carried a good this operation; the seller pays its owner 5." : "**Free**: this ship can still carry a good this operation.";
  }
}
