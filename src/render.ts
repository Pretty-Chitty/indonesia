// Shared rendering helpers: one place for the click colour, the invisible hit material, cardboard slabs, traced
// outlines and gallery sizing, so every chit's render() stays about the piece it draws.
import { ChitRenderSpec, ImageSpec, StaticImage } from "@pretty-chitty/core";
import {
  BoxGeometry,
  Color,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  Material,
  Mesh,
  MeshPhongMaterial,
  MeshPhongMaterialParameters,
  PlaneGeometry,
  RepeatWrapping,
  Shape,
  ShapeGeometry,
} from "three";
import { TABLE } from "./art";
import { CLICK_COLOR } from "./consts";

/** The one outline colour that means "you can click this". Set at the top of every render(). */
export function clickable(spec: ChitRenderSpec) {
  spec.highlight.clickColor = CLICK_COLOR;
}

/** The outline of a piece lifted off the map because its company is in a merger: white, unlike any player, good or
 *  status colour. */
export const RAISED_OUTLINE = "#ffffff";

/** How far pieces rise when they move (quality bar §4): cards arc, pieces hop, markers take off. */
export const LIFT = { card: 0.25, piece: 0.3, marker: 1.2 } as const;

const materialCache = new Map<string, Material>();
/** A lit, textured material for a sprite, cached per sprite so a board of pieces shares one texture. */
export function artMaterial(image: ImageSpec): Material {
  const key = `${image.primary.file}:${image.primary.bounds.x},${image.primary.bounds.y},${image.primary.bounds.width}`;
  let m = materialCache.get(key);
  if (!m) {
    m = new MeshPhongMaterial({ map: StaticImage.texture(image), shininess: 8 });
    materialCache.set(key, m);
  }
  return m;
}

const colorCache = new Map<string, MeshPhongMaterial>();
export function colorMaterial(hex: string, shininess = 20): MeshPhongMaterial {
  const key = `${hex}:${shininess}`;
  let m = colorCache.get(key);
  if (!m) {
    m = new MeshPhongMaterial({ color: new Color(hex), shininess });
    colorCache.set(key, m);
  }
  return m;
}

/** Invisible but hit-testable: no colour, no depth, so it hides nothing drawn after it. */
export function invisibleMaterial(): Material {
  return new MeshPhongMaterial({ transparent: true, opacity: 0, colorWrite: false, depthWrite: false, side: DoubleSide });
}

/** A cardboard piece: art on the top face, a sampled paper colour on the edges, real thickness, shadows. */
export function cardboard(w: number, h: number, thickness: number, top: Material, edgeHex: string, bottom?: Material): Mesh {
  const edge = colorMaterial(edgeHex, 4);
  const mesh = new Mesh(new BoxGeometry(w, h, thickness), [edge, edge, edge, edge, top, bottom ?? edge]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** A polygon in world units (already centred) as a flat shape, invisible unless a material is given. */
export function polygonShape(points: [number, number][]): Shape {
  const s = new Shape();
  points.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
  s.closePath();
  return s;
}

export function flatPolygon(points: [number, number][], material = invisibleMaterial()): Mesh {
  const mesh = new Mesh(new ShapeGeometry(polygonShape(points)), material);
  mesh.receiveShadow = true;
  return mesh;
}

/** A traced glyph (src/geometry/shapes.ts, unit box, y up) extruded into a wooden piece `height` tall and
 *  `depth` thick, lying flat, centred on its own middle. */
export function extrudedGlyph(points: [number, number][], aspect: number, height: number, depth: number, material: Material | Material[]): Mesh {
  const w = height * aspect;
  const shape = polygonShape(points.map(([x, y]) => [(x - 0.5) * w, (y - 0.5) * height]));
  const geom = new ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geom.translate(0, 0, -depth / 2);
  const mesh = new Mesh(geom, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** The outline a movable piece shows against what it sits on: its own colour halfway to black, or a little
 *  lighter when it is dark. */
export function outlineFor(hex: string): string {
  const c = new Color(hex);
  const l = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
  const t = l < 0.25 ? new Color(0xffffff) : new Color(0x000000);
  const k = l < 0.25 ? 0.2 : 0.5;
  return "#" + c.clone().lerp(t, k).getHexString();
}

/** Gallery / long-press sizing from the piece's own proportions: the longer side about `px` on screen. */
export function galleryFit(spec: ChitRenderSpec, w: number, h: number, px = 420) {
  const k = px / Math.max(w, h);
  spec.galleryPreferredWidth = Math.round(w * k);
  spec.galleryPreferredHeight = Math.round(h * k);
}

export function group(...children: (Mesh | Group)[]): Group {
  const g = new Group();
  children.forEach((c) => g.add(c));
  return g;
}


/** How far a gallery-only picture sits under its board's top surface: inside the opaque slab (boards are 0.06
 *  thick), so the board hides it on the table, while the gallery, which draws the chit's group alone, shows it. */
export const UNDER_BOARD = 0.034;

/** A gallery-only picture of a printed region: its outline filled in one colour, face up (so not mirrored), sunk
 *  UNDER_BOARD below the click target. The chit sets `spec.offsetZ = -UNDER_BOARD + 0.002` so the click target sits
 *  on the board and the picture inside it. */
export function underBoardShape(rings: [number, number][][], hex: string): Mesh {
  const mesh = new Mesh(new ShapeGeometry(rings.map((r) => polygonShape(r))), new MeshPhongMaterial({ color: new Color(hex), shininess: 5 }));
  mesh.position.z = -UNDER_BOARD;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

/** World units per repeat of the table texture: the planks are the same size on every panel. */
const TABLE_TILE = { x: 15, y: 7.5 };
/** The wooden table under a panel: a square `size` wide. Every panel shares one table texture, so the tiling is put in
 *  this plane's UVs and the texture's own repeat is never changed: a repeat set by one panel changed every other
 *  panel's planks whenever that panel drew again ("the scale of the table texture changes randomly"). */
export function tableTop(size: number, material: MeshPhongMaterialParameters = {}): Mesh {
  const tex = StaticImage.texture(TABLE);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  const geom = new PlaneGeometry(size, size);
  const uv = geom.getAttribute("uv");
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * size) / TABLE_TILE.x, (uv.getY(i) * size) / TABLE_TILE.y);
  uv.needsUpdate = true;
  const mesh = new Mesh(geom, new MeshPhongMaterial({ map: tex, shininess: 5, ...material }));
  mesh.receiveShadow = true;
  return mesh;
}
