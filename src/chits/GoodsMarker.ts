import { Chit, ChitRenderSpec, StaticImage } from "@pretty-chitty/core";
import { ExtrudeGeometry, Mesh, MeshPhongMaterial, Shape } from "three";
import { PIECE } from "../art";
import { Good, GOOD_COLOR, GOOD_LABEL, GOODS_MARKER_H, GOODS_MARKER_H_RICE, GOODS_MARKER_MAX_W, GOODS_MARKER_THICKNESS, HUT_DEPTH, HUT_H, HUT_W, HUT_WALL, PLAYER_COLORS } from "../consts";
import { GOODS_PIECES } from "../geometry/goodsPieces";
import { clickable, colorMaterial, extrudedGlyph, galleryFit, LIFT, outlineFor, RAISED_OUTLINE } from "../render";

/** A wooden goods marker (C9): a plantation of one company on one land area. The piece is the rulebook's own
 *  (rules.pdf p.2): its silhouette in coloured wood, screen-printed on top with its good. */
export class GoodsMarker extends Chit {
  good: Good = "rice";
  /** the Company chit that owns this plantation (P6P.1) */
  companyId = "";
  companyName = "";
  ownerName = "";
  /** the owner's seat (colour), for the ownership hut beside the plantation (C5); -1 for none */
  ownerSeat = -1;
  /** this marker carries its zone's ownership hut: one per connected area, set by MainBoard.syncHuts */
  hut = false;
  /** lifted off the map, outlined in white, while its company is in a merger being announced or auctioned */
  raised = false;
  /** marked for removal during a siap saji merger (P3S.5) */
  marked = false;
  /** its area's depth layer (landLayer): where it overlaps a neighbour's marker, the higher layer's print is drawn */
  layer = 0;

  override render(spec: ChitRenderSpec): void {
    clickable(spec);
    const g = GOODS_PIECES[this.good];
    spec.object = goodsPiece(this.good, this.layer);
    if (this.hut && this.ownerSeat >= 0) {
      // the owner's wooden hut (C5: "a wooden player hut may be used to denote player ownership"), one per connected
      // area; it rides along with the marker and is never clicked
      const hut = hutMesh(PLAYER_COLORS[this.ownerSeat]);
      // standing on top of the marker, so there is no doubt which plantation it marks
      hut.position.set(0, 0, GOODS_MARKER_THICKNESS / 2);
      spec.ornaments.push(hut);
    }
    spec.zLiftRatio = LIFT.piece;
    spec.offsetZ = this.raised ? 0.5 : 0;
    // every goods marker sits on printed land (paper white, browns, area lines, era icons): all five are outlined in
    // their own colour so each reads as a piece
    spec.highlight.color = outlineFor(GOOD_COLOR[this.good]);
    if (this.raised) spec.highlight.color = RAISED_OUTLINE;
    if (this.marked) {
      spec.highlight.color = "#ff2020";
      spec.highlight.clickColor = "#ff2020";
    }
    spec.showDetailsOnLongPress = true;
    galleryFit(spec, g.aspect, 1, 240);
    spec.summary = `**${GOOD_LABEL[this.good]}** of ${this.companyName || "a company"}${this.ownerName ? `, owned by ${this.ownerName} (their hut marks the area)` : ""}.${this.marked ? " Marked to be given up in the siap saji merger." : ""}`;
  }
}

/** A wooden goods marker's piece, as it stands on the map and as a good sold rides to its city (the same pieces: the
 *  developer's table uses the plantation markers for goods in transit too). `layer` pulls its print toward the viewer
 *  where it may overlap a neighbour's (landLayer). */
export function goodsPiece(good: Good, layer = 0): Mesh {
  // every marker fits the same box: the pieces run from a tall sack (0.83 wide per unit of height) to the wide siap
  // saji tray (1.75), and a wide piece drawn at the common height covered two land areas
  const height = Math.min(good === "rice" ? GOODS_MARKER_H_RICE : GOODS_MARKER_H, GOODS_MARKER_MAX_W / GOODS_PIECES[good].aspect);
  return printedPiece(good, height, layer);
}

/** The piece's silhouette extruded in its wood colour, with the printed face on top: the face image spans the
 *  silhouette's bounding box, so the caps' UVs (by default the shape's own coordinates) are mapped onto it. */
function printedPiece(good: Good, height: number, layer: number): Mesh {
  const g = GOODS_PIECES[good];
  const w = height * g.aspect;
  const mesh = extrudedGlyph(g.points, g.aspect, height, GOODS_MARKER_THICKNESS, [printMaterial(good, layer), colorMaterial(g.wood, 25)]);
  const pos = mesh.geometry.getAttribute("position");
  const uv = mesh.geometry.getAttribute("uv");
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / height + 0.5);
  uv.needsUpdate = true;
  return mesh;
}

const printCache = new Map<string, MeshPhongMaterial>();
/** The printed face, pulled toward the viewer in depth by its layer so overlapping tops never z-fight. */
function printMaterial(good: Good, layer: number): MeshPhongMaterial {
  const key = `${good}:${layer}`;
  let m = printCache.get(key);
  if (!m) {
    m = new MeshPhongMaterial({ map: StaticImage.texture(PIECE[good]), shininess: 8, polygonOffset: true, polygonOffsetFactor: -2 * layer, polygonOffsetUnits: -2 * layer });
    printCache.set(key, m);
  }
  return m;
}

const hutCache = new Map<string, Mesh>();
/** A wooden hut standing upright: a house-shaped profile (walls and a gabled roof) extruded front to back. Its base
 *  is at z = 0. */
function hutMesh(hex: string): Mesh {
  let m = hutCache.get(hex);
  if (!m) {
    const w = HUT_W / 2;
    const shape = new Shape();
    shape.moveTo(-w, 0);
    shape.lineTo(w, 0);
    shape.lineTo(w, HUT_WALL);
    shape.lineTo(0, HUT_H);
    shape.lineTo(-w, HUT_WALL);
    shape.closePath();
    const geom = new ExtrudeGeometry(shape, { depth: HUT_DEPTH, bevelEnabled: false });
    geom.rotateX(Math.PI / 2); // profile up out of the board; the extrusion runs away from the viewer
    geom.translate(0, HUT_DEPTH / 2, 0);
    m = new Mesh(geom, colorMaterial(hex, 30));
    m.castShadow = true;
    m.receiveShadow = true;
    hutCache.set(hex, m);
  }
  return m.clone();
}
