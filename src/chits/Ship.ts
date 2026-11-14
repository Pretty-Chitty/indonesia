import { Chit, ChitRenderSpec, Ordered, OrderedOutlet } from "@pretty-chitty/core";
import { Box3, BoxGeometry, BufferGeometry, Color, CylinderGeometry, ExtrudeGeometry, Group, Mesh, MeshPhongMaterial, Vector3 } from "three";
import { CAPACITY_R, CapacityMarker } from "./CapacityMarker";
import { DeliveredGood } from "./DeliveredGood";
import { PLAYER_COLORS } from "../consts";
import { SHIP_SHAPES, STEAMER_HULL } from "../geometry/pieceShapes";
import { clickable, colorMaterial, galleryFit, LIFT, polygonShape, RAISED_OUTLINE } from "../render";
import { discard } from "../pieces";

/** Ship length, mast height and thickness in world units: a chunky wooden piece standing in its sea area. */
const SHIP_LEN = 1.0;
const SHIP_TALL = 0.9;
const SHIP_DEPTH = 0.22;

/** An outline (x 0..1 bow to stern, y 0..1 waterline to masthead) extruded into a standing piece. */
function standingOutline(outline: [number, number][], depth: number): ExtrudeGeometry {
  const pts = outline.map(([x, y]) => [x * SHIP_LEN, y * SHIP_TALL] as [number, number]);
  const g = new ExtrudeGeometry(polygonShape(pts), { depth, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.015, bevelSegments: 1 });
  g.rotateX(Math.PI / 2); // stand it up: the outline faces the viewer, the thickness runs away from them
  g.translate(0, depth / 2, 0);
  return g;
}

/** A box or upright cylinder standing on the piece, in the same units: x along the ship, z up from the waterline. */
function block(x0: number, x1: number, z0: number, z1: number, depth: number): BoxGeometry {
  const g = new BoxGeometry((x1 - x0) * SHIP_LEN, depth, (z1 - z0) * SHIP_TALL);
  g.translate(((x0 + x1) / 2) * SHIP_LEN, 0, ((z0 + z1) / 2) * SHIP_TALL);
  return g;
}
function upright(x: number, r: number, z0: number, z1: number): CylinderGeometry {
  const g = new CylinderGeometry(r, r, (z1 - z0) * SHIP_TALL, 16);
  g.rotateX(Math.PI / 2); // three's cylinders run along y; the table's up is z
  g.translate(x * SHIP_LEN, 0, ((z0 + z1) / 2) * SHIP_TALL);
  return g;
}

type Part = "colour" | "deck" | "black" | "wood";
const geomCache = new Map<number, [Part, BufferGeometry][]>();
/** The ship's parts, centred together on the piece's middle. The prahu is one extruded outline in the owner's colour;
 *  the steamer is a hull and funnel in the owner's colour, a cream deckhouse, a black funnel top and two thin masts,
 *  so the two read as different ships at a glance, not as two shades of one. Both are SHIP_LEN long and SHIP_TALL
 *  high, so the capacity markers and a riding good stand the same on either. */
function shipParts(type: 1 | 2): [Part, BufferGeometry][] {
  let parts = geomCache.get(type);
  if (!parts) {
    parts =
      type === 1
        ? [["colour", standingOutline(SHIP_SHAPES[1], SHIP_DEPTH)]]
        : [
            ["colour", standingOutline(STEAMER_HULL, SHIP_DEPTH)],
            ["deck", block(0.34, 0.74, 0.27, 0.47, SHIP_DEPTH * 0.8)],
            ["colour", upright(0.55, 0.075, 0.47, 0.72)],
            ["black", upright(0.55, 0.08, 0.72, 0.8)],
            ["wood", block(0.25, 0.28, 0.3, 1.0, 0.03)],
            ["wood", block(0.84, 0.87, 0.27, 0.92, 0.03)],
          ];
    const box = new Box3();
    for (const [, g] of parts) {
      g.computeBoundingBox();
      box.union(g.boundingBox!);
    }
    const c = box.getCenter(new Vector3());
    for (const [, g] of parts) g.translate(-c.x, -c.y, -c.z);
    geomCache.set(type, parts);
  }
  return parts;
}

/** the steamer's other parts: a painted deckhouse, a black funnel top, dark wooden masts */
const PART_COLOR: Record<Exclude<Part, "colour">, string> = { deck: "#efe6d0", black: "#1c1a18", wood: "#4a3726" };

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

/** A ship (C6): a wooden piece in its shipping line's owner's colour, a prahu or a steamer so a player's two lines
 *  can be told apart (P3.16). It stands in a SeaArea; a merger recolours it (P3.16). */
export class Ship extends Chit {
  /** owner's seat (colour) index, or -1 for a neutral ship */
  seat = -1;
  /** 1 (prahu) or 2 (steamer), so one player's lines can be told apart (P3.16) */
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
    const piece = new Group();
    for (const [part, g] of shipParts(this.shipType)) {
      const mesh = new Mesh(g, part === "colour" ? shipMaterials(hex) : colorMaterial(PART_COLOR[part], 20));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      piece.add(mesh);
    }
    spec.object = piece;
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
