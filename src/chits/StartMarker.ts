import { Chit, ChitRenderSpec } from "@pretty-chitty/core";
import { CylinderGeometry, Mesh } from "three";
import { StartMarkerFace } from "../canvas/StartMarkerFace";
import { DEEDS, GOOD_LABEL, START_MARKER_DIAMETER } from "../consts";
import { PROVINCE_MARKER_SPOT } from "../geometry/map";
import { toWorld } from "../geometry/mapIndex";
import { clickable, colorMaterial, galleryFit, LIFT } from "../render";

/** A company start marker (C10, S6, P1.10): a round token on the deed's province showing which company may start
 *  there this era. Removed when the company is acquired (P4.4). */
export class StartMarker extends Chit {
  deedId = 0;
  /** 0 or 1: two companies of one province in one era stand side by side */
  slot = 0;

  override render(spec: ChitRenderSpec): void {
    clickable(spec);
    const deed = DEEDS[this.deedId];
    const face = new StartMarkerFace().set((f) => {
      f.deedId = this.deedId;
    }).material;
    const geom = new CylinderGeometry(START_MARKER_DIAMETER / 2, START_MARKER_DIAMETER / 2, 0.05, 36);
    geom.rotateY(Math.PI / 2); // a cylinder cap's UVs run sideways: a quarter turn about its axis sets the print upright
    geom.rotateX(Math.PI / 2);
    const edge = colorMaterial("#3a2a18", 10);
    const mesh = new Mesh(geom, [edge, face, edge]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    spec.object = mesh;
    // in the sea just off its province (map.ts), never on a land area, so it is never mistaken for one
    const p = toWorld(PROVINCE_MARKER_SPOT[DEEDS[this.deedId].province]);
    spec.offsetX = p.x + this.slot * (START_MARKER_DIAMETER + 0.08);
    spec.offsetY = p.y;
    spec.zLiftRatio = LIFT.piece;
    // it sits on printed paper land: a dark edge so the token reads as a piece
    spec.highlight.color = "#2a1d10";
    spec.showDetailsOnLongPress = true;
    galleryFit(spec, 1, 1, 240);
    spec.summary = `**Start marker**: the ${deed.province} ${GOOD_LABEL[deed.type]} company (era ${deed.era}) may be started here this era. Starting a company costs nothing and takes a free slot.`;
  }
}
