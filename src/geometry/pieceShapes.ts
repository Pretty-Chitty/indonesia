// The two ship pieces (C6), drawn after the DLC's two ship drawings: a single-sail prahu and a two-masted schooner.
// Outlines in a unit box: x 0..1 bow to stern, y 0..1 waterline to masthead (y up). Hand-authored, not traced: the
// drawings are line art, and a traced silhouette came out ragged.
export const SHIP_SHAPES: Record<1 | 2, [number, number][]> = {
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
  // schooner: a long hull with a bowsprit, a jib, and two gaff sails
  2: [
    [0.0, 0.36],
    [0.12, 0.2],
    [0.16, 0.06],
    [0.45, 0.0],
    [0.82, 0.02],
    [0.98, 0.17],
    [0.92, 0.17],
    [0.92, 0.22],
    [0.86, 0.74],
    [0.66, 0.94],
    [0.62, 0.24],
    [0.58, 0.24],
    [0.56, 0.68],
    [0.4, 0.98],
    [0.36, 0.22],
    [0.3, 0.2],
  ],
};

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
