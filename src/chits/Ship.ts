import { Chit, ChitRenderSpec, Ordered, OrderedOutlet } from "@pretty-chitty/core";
import { Color, ExtrudeGeometry, Mesh, MeshPhongMaterial, Vector3 } from "three";
import { CAPACITY_R, CapacityMarker } from "./CapacityMarker";
import { DeliveredGood } from "./DeliveredGood";
import { PLAYER_COLORS } from "../consts";
import { SHIP_SHAPES } from "../geometry/pieceShapes";
import { clickable, galleryFit, LIFT, polygonShape, RAISED_OUTLINE } from "../render";
import { discard } from "../pieces";

/** Ship length, mast height and thickness in world units: a chunky wooden piece standing in its sea area. */
const SHIP_LEN = 1.0;
const SHIP_TALL = 0.9;
const SHIP_DEPTH = 0.22;

const geomCache = new Map<number, ExtrudeGeometry>();
/** The ship's outline extruded into a standing wooden piece, centred on its own middle. */
function shipGeometry(type: 1 | 2): ExtrudeGeometry {
  let g = geomCache.get(type);
  if (!g) {
    const pts = SHIP_SHAPES[type].map(([x, y]) => [(x - 0.5) * SHIP_LEN, y * SHIP_TALL] as [number, number]);
    g = new ExtrudeGeometry(polygonShape(pts), { depth: SHIP_DEPTH, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.015, bevelSegments: 1 });
    g.rotateX(Math.PI / 2); // stand it up: the outline faces the viewer, the thickness runs away from them
    g.computeBoundingBox();
    const b = g.boundingBox!;
    g.translate(-(b.min.x + b.max.x) / 2, -(b.min.y + b.max.y) / 2, -(b.min.z + b.max.z) / 2);
    geomCache.set(type, g);
  }
  return g;
}

const matCache = new Map<string, MeshPhongMaterial[]>();
function shipMaterials(hex: string): MeshPhongMaterial[] {
  let m = matCache.get(hex);
  if (!m) {
    const face = new MeshPhongMaterial({ color: new Color(hex), shininess: 25 });
    const side = new MeshPhongMaterial({ color: new Color(hex).multiplyScalar(0.72), shininess: 15 });
    m = [face, side];
    matCache.set(hex, m);
  }
  return m;
}

/** A ship (C6): a wooden piece in its shipping line's owner's colour, one of two shapes so a player's lines can be
 *  told apart (P3.16). It stands in a SeaArea; a merger recolours it (P3.16). */
export class Ship extends Chit {
  /** owner's seat (colour) index, or -1 for a neutral ship */
  seat = -1;
  /** 1 or 2: which shape, so one player's lines can be told apart (P3.16) */
  shipType: 1 | 2 = 1;
  companyId = "";
  companyName = "";
  ownerName = "";
  /** where it stands in its sea (board units from the sea's centre), set by SeaArea.layoutShips */
  slotX = 0;
  slotY = 0;
  /** lifted off the map, outlined in white, while its company is in a merger being announced or auctioned */
  raised = false;
  /** its capacity markers, one per good it can carry per operation (the owner's Hull), in a row on the water in
   *  front of it; the outlet's z is measured from the top of the ship, so it reaches down to the sea (P6P.6) */
  @Ordered(new Vector3(0, -(SHIP_DEPTH / 2 + CAPACITY_R + 0.06), -(SHIP_TALL + 0.03))) capacity = new OrderedOutlet<CapacityMarker>();

  /** a good being carried, riding on top of the ship (the outlet's z is measured from the top of the ship) */
  @Ordered(new Vector3(0, 0, 0.02)) cargo = new OrderedOutlet<DeliveredGood>();

  /** Match the markers to the owner's Hull (a ship placed, Hull researched, a merger changing the owner). */
  syncCapacity(hull: number) {
    while (this.capacity.length > hull) discard(this.capacity.get(this.capacity.length - 1));
    while (this.capacity.length < hull) this.capacity.add(
        new CapacityMarker().set((m) => {
          m.seat = this.seat;
          m.parentFallback = this; // laid down by the ship, not in from the edge of the table
        }),
      );
    this.capacity.copy().forEach((m, i) => {
      m.seat = this.seat;
      m.row = Math.floor(i / 3);
      m.col = i % 3;
      m.rowSize = Math.min(3, hull - m.row * 3);
    });
  }
  freeCapacity(): number {
    return this.capacity.filter((m) => !m.used).length;
  }

  override render(spec: ChitRenderSpec): void {
    clickable(spec);
    const hex = this.seat >= 0 ? PLAYER_COLORS[this.seat] : "#e8e2d4";
    const mesh = new Mesh(shipGeometry(this.shipType), shipMaterials(hex));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    spec.object = mesh;
    spec.childrenOffsetZ = 0;
    // its place among the sea's ship spots, packed on the sea's own water by build_map.py
    spec.offsetX = this.slotX;
    spec.offsetY = this.slotY;
    spec.zLiftRatio = LIFT.piece;
    spec.offsetZ = this.raised ? 0.5 : 0;
    if (this.raised) spec.highlight.color = RAISED_OUTLINE;
    spec.galleryRotateX = -Math.PI / 2; // lay it on its side in the gallery so its outline faces up
    spec.showDetailsOnLongPress = true;
    galleryFit(spec, SHIP_LEN, SHIP_TALL, 300);
    spec.summary = `**Ship** of ${this.companyName || "a shipping company"}${this.ownerName ? ` (${this.ownerName})` : ""}. Each ship carries one good per production company per operation, more with the owner's Hull research; the shipper is paid 5 per use.`;
  }
}
