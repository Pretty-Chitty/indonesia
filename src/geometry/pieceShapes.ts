// The two ship pieces (C6), so one player's two shipping lines look nothing alike (P3.16). The first is a
// single-sail prahu after the DLC's ship drawing, an outline extruded into a standing piece. The second is a steamer,
// built from parts in Ship.ts: STEAMER_HULL is its hull. Outlines in a unit box: x 0..1 bow to stern, y 0..1
// waterline to masthead (y up). Hand-authored, not traced: the drawings are line art, and a traced silhouette came
// out ragged.
export const SHIP_SHAPES: Record<1, [number, number][]> = {
  // prahu: a crescent hull with an outrigger-style raised bow and stern, one tall lateen sail
  1: [
    [0.0, 0.26],
    [0.08, 0.12],
    [0.22, 0.03],
    [0.5, 0.0],
    [0.78, 0.03],
    [0.92, 0.12],
    [1.0, 0.28],
    [0.9, 0.2],
    [0.84, 0.19],
    [0.86, 0.3],
    [0.58, 1.0],
    [0.5, 0.9],
    [0.18, 0.4],
    [0.3, 0.19],
    [0.12, 0.19],
  ],
};

/** The steamer's hull: a raked straight bow with a raised forecastle, a flat deck, a rounded counter stern. Its
 *  deckhouse, funnel and masts stand on the deck (Ship.ts). */
export const STEAMER_HULL: [number, number][] = [
  [0.0, 0.34],
  [0.07, 0.04],
  [0.14, 0.0],
  [0.88, 0.0],
  [0.96, 0.07],
  [1.0, 0.27],
  [0.2, 0.27],
  [0.18, 0.34],
];

/** The rice marker: a tied rice sack, round and bulging, cinched at the neck with a flared tie on top. The player
 *  aid's rice glyph is a near-rectangular sack that read as a blank square at piece size. x 0..1, y 0..1, y up. */
export const RICE_SACK: { aspect: number; points: [number, number][] } = {
  aspect: 0.86,
  points: [
    [0.5, 0.0],
    [0.78, 0.03],
    [0.94, 0.14],
    [1.0, 0.32],
    [0.97, 0.5],
    [0.86, 0.63],
    [0.68, 0.71],
    [0.62, 0.75],
    [0.64, 0.79],
    [0.84, 0.9],
    [0.76, 1.0],
    [0.6, 0.9],
    [0.5, 0.99],
    [0.4, 0.9],
    [0.24, 1.0],
    [0.16, 0.9],
    [0.36, 0.79],
    [0.38, 0.75],
    [0.32, 0.71],
    [0.14, 0.63],
    [0.03, 0.5],
    [0.0, 0.32],
    [0.06, 0.14],
    [0.22, 0.03],
  ],
};
