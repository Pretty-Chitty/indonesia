// Static rulebook data for Indonesia (Splotter). Every table here is a literal transcription; the RULES.md id
// it was read from is cited beside it. Nothing in this file is a formula standing in for a printed table.

import { GOODS_PIECES } from "./geometry/goodsPieces";

/** One world unit = 100 px of the printed board band (3912 x 1858 px, see src/geometry/map.ts). */
export const BASE_SIZE = 1;
export const BOARD_PX_PER_UNIT = 100;

export const ERAS = ["A", "B", "C"] as const;
export type Era = (typeof ERAS)[number];

export const GOODS = ["rice", "spice", "rubber", "siapsaji", "oil"] as const;
export type Good = (typeof GOODS)[number];
export const COMPANY_TYPES = [...GOODS, "shipping"] as const;
export type CompanyType = (typeof COMPANY_TYPES)[number];

export const GOOD_LABEL: Record<CompanyType, string> = {
  rice: "rice",
  spice: "spice",
  rubber: "rubber",
  siapsaji: "siap saji",
  oil: "oil",
  shipping: "shipping",
};

/** D1: the value of a good when sold, and the unit value in a merger's nominal price. Player aid. */
export const GOOD_VALUE: Record<Good, number> = { rice: 20, spice: 25, rubber: 30, siapsaji: 35, oil: 40 };
/** D1: a ship counts 10 in a merger's nominal value. */
export const SHIP_VALUE = 10;
/** P6P.9: paid to the ship's owner per ship use. */
export const TRANSPORT_FEE = 5;
/** P3S.3: a siap saji merger values every rice and spice good at 25. */
export const SIAP_SAJI_MERGER_UNIT = 25;
/** S1 */
export const STARTING_CASH = 100;

/** P5: the five R&D tracks. "bid" is the Turn Order Bid multiplier (board, D2). */
export const RND_TRACKS = ["bid", "slots", "mergers", "expansion", "hull"] as const;
export type RndTrack = (typeof RND_TRACKS)[number];
export const RND_STEPS = 5; // P5.7
/** D2: step n of the Turn Order Bid track multiplies the bid by this (board). */
export const BID_MULTIPLIER = [1, 5, 25, 100, 400] as const;
export const RND_LABEL: Record<RndTrack, string> = {
  bid: "Turn Order Bid",
  slots: "Slots",
  mergers: "Mergers",
  expansion: "Expansion",
  hull: "Hull",
};
/** Which printed row of the R&D table (src/geometry/map.ts TABLE_CELLS) each track's cubes stand on. The DLC
 *  board prints two Hull rows ("Hull Player", "Hull Company"); the 2009 rulebook has one Hull track (Q-hull). */
export const RND_TABLE_ROW: Record<RndTrack, string> = {
  bid: "bid",
  slots: "slots",
  mergers: "mergers",
  expansion: "expansion",
  hull: "hullPlayer",
};

/** D5: the 26 provinces as printed on the board. */
export const PROVINCES = [
  "Aceh", "Sumatera Utara", "Riau", "Sumatera Barat", "Jambi", "Bengkulu", "Sumatera Selatan", "Lampung",
  "Jawa Barat", "Jawa Tengah", "Jawa Timur", "Bali", "Nusa Tenggara Barat", "Nusa Tenggara Timur",
  "Sarawak", "Kalimantan Barat", "Kalimantan Tengah", "Kalimantan Timur", "Kalimantan Selatan",
  "Sulawesi Utara", "Sulawesi Tengah", "Sulawesi Selatan", "Sulawesi Tenggara",
  "Halmahera", "Maluku", "Papua",
] as const;
export type Province = (typeof PROVINCES)[number];

export interface DeedSpec {
  /** index on the DLC deed sheet (row-major, 4 per row); the mini-map crop is cards/deed<id>.jpg */
  id: number;
  era: Era;
  type: CompanyType;
  province: Province;
  /** shipping deeds only: the ship limit in eras A, B, C (null = the company cannot exist yet, P6S.2) */
  ships?: readonly [number | null, number, number];
}

/** D4: the 24 company deeds, transcribed from the DLC deed sheet and checked against the board's era icons. */
export const DEEDS: readonly DeedSpec[] = [
  { id: 0, era: "C", type: "spice", province: "Sumatera Selatan" },
  { id: 1, era: "B", type: "spice", province: "Jawa Tengah" },
  { id: 2, era: "A", type: "spice", province: "Halmahera" },
  { id: 3, era: "A", type: "spice", province: "Maluku" },
  { id: 4, era: "B", type: "spice", province: "Sulawesi Tengah" },
  { id: 5, era: "B", type: "rice", province: "Kalimantan Timur" },
  { id: 6, era: "B", type: "rice", province: "Aceh" },
  { id: 7, era: "A", type: "rice", province: "Bali" },
  { id: 8, era: "C", type: "rice", province: "Sulawesi Tenggara" },
  { id: 9, era: "A", type: "rice", province: "Jawa Barat" },
  { id: 10, era: "C", type: "oil", province: "Sarawak" },
  { id: 11, era: "C", type: "oil", province: "Kalimantan Selatan" },
  { id: 12, era: "C", type: "oil", province: "Papua" },
  { id: 13, era: "C", type: "oil", province: "Maluku" },
  { id: 14, era: "B", type: "rubber", province: "Riau" },
  { id: 15, era: "B", type: "rubber", province: "Sumatera Barat" },
  { id: 16, era: "C", type: "rubber", province: "Papua" },
  { id: 17, era: "B", type: "rubber", province: "Kalimantan Barat" },
  { id: 18, era: "A", type: "shipping", province: "Lampung", ships: [2, 3, 4] },
  { id: 19, era: "A", type: "shipping", province: "Sulawesi Selatan", ships: [3, 3, 4] },
  { id: 20, era: "A", type: "shipping", province: "Halmahera", ships: [3, 4, 5] },
  { id: 21, era: "A", type: "shipping", province: "Jawa Timur", ships: [2, 3, 3] },
  { id: 22, era: "B", type: "shipping", province: "Sumatera Utara", ships: [null, 4, 5] },
  { id: 23, era: "B", type: "shipping", province: "Jawa Barat", ships: [null, 4, 5] },
];

export interface CityCardSpec {
  /** index on the DLC city card sheet (row-major, 3 per row); the crop is cards/city<id>.jpg */
  id: number;
  era: Era;
  provinces: readonly [Province, Province, Province];
}

/** D3: the 15 city cards, transcribed from the DLC city card sheet. */
export const CITY_CARDS: readonly CityCardSpec[] = [
  { id: 0, era: "B", provinces: ["Sumatera Utara", "Kalimantan Selatan", "Maluku"] },
  { id: 1, era: "B", provinces: ["Sumatera Barat", "Kalimantan Selatan", "Lampung"] },
  { id: 2, era: "A", provinces: ["Sumatera Selatan", "Jawa Barat", "Jawa Tengah"] },
  { id: 3, era: "C", provinces: ["Sarawak", "Sulawesi Tengah", "Papua"] },
  { id: 4, era: "B", provinces: ["Aceh", "Sumatera Utara", "Bengkulu"] },
  { id: 5, era: "B", provinces: ["Aceh", "Lampung", "Maluku"] },
  { id: 6, era: "A", provinces: ["Sumatera Selatan", "Sulawesi Selatan", "Jawa Timur"] },
  { id: 7, era: "C", provinces: ["Halmahera", "Jawa Barat", "Nusa Tenggara Timur"] },
  { id: 8, era: "B", provinces: ["Sumatera Barat", "Bengkulu", "Jawa Barat"] },
  { id: 9, era: "C", provinces: ["Halmahera", "Nusa Tenggara Barat", "Papua"] },
  { id: 10, era: "C", provinces: ["Jambi", "Sulawesi Tengah", "Nusa Tenggara Timur"] },
  { id: 11, era: "C", provinces: ["Sarawak", "Jambi", "Nusa Tenggara Barat"] },
  { id: 12, era: "A", provinces: ["Jawa Tengah", "Sulawesi Utara", "Bali"] },
  { id: 13, era: "A", provinces: ["Jawa Barat", "Sulawesi Utara", "Sulawesi Selatan"] },
  { id: 14, era: "A", provinces: ["Jawa Barat", "Bali", "Jawa Timur"] },
];

/** C7: city markers by size. Finite: running out matters (P1.9, P7.4). */
export const CITY_SUPPLY: Record<CitySize, number> = { 1: 12, 2: 8, 3: 3 };
export type CitySize = 1 | 2 | 3;
/** P1.6, P7.3: amber, green, red. */
export const CITY_COLOR: Record<CitySize, string> = { 1: "#d9961e", 2: "#4f9a3c", 3: "#c0392b" };

/** G2: the seven phases of a year, as printed on the player aid. */
export const PHASES = [
  "New Era",
  "Bid for Turn Order",
  "Mergers",
  "Acquisitions",
  "Research & Development",
  "Operations",
  "City Growth",
] as const;

/** The DLC's five player sets (C5, C6). Status colours (click, selected, invalid) stay clear of these. */
/** The DLC's player colours (its save file), the purple lifted a little so it reads on the brown land. */
export const PLAYER_COLORS = ["#0d4fb9", "#7048a8", "#ff8814", "#eb3a25", "#ffe405"] as const;
export const PLAYER_COLOR_NAMES = ["blue", "purple", "orange", "red", "yellow"] as const;
export type PlayerColorName = (typeof PLAYER_COLOR_NAMES)[number];

/** Wooden goods markers (C9): the colours of the rulebook's printed pieces (rules.pdf p.2), the print's ink aside. */
export const GOOD_COLOR: Record<Good, string> = {
  rice: GOODS_PIECES.rice.wood,
  spice: GOODS_PIECES.spice.wood,
  rubber: GOODS_PIECES.rubber.wood,
  siapsaji: GOODS_PIECES.siapsaji.wood,
  oil: GOODS_PIECES.oil.wood,
};

/** The box's colours (static/boxArt.jpg, the rulebook's cover): its olive ground and the khaki of its print. */
export const BOX_OLIVE = "#3c361a";
export const BOX_KHAKI = "#9e8b52";
/** The one click colour, clearly distinct from every player and good colour, and calm on the box's olive: a rose.
 *  The tutorial's rings, arrows and buttons share it. */
export const CLICK_COLOR = "#e5739f";
/** Status colours: a selected piece, and an invalid arrangement. */
export const SELECTED_COLOR = "#00d6ff";
export const INVALID_COLOR = "#ff2020";

// --- sizes in world units (ASSETS.md, Sizes) -----------------------------------------------------------------
export const BOARD_THICKNESS = 0.06;
export const SHIP_W = 1.1;
export const SHIP_H = 0.55;
export const SHIP_THICKNESS = 0.04;
/** A city goods display (C7): the rulebook's lobed card, a little taller than a goods marker so the card shows round
 *  the marker on each lobe. While it holds goods it floats this far above the board beside its city, at its area's
 *  spot (DISPLAY_SPOTS). */
export const GOODS_DISPLAY_H = 0.78;
export const GOODS_DISPLAY_THICKNESS = 0.05;
export const GOODS_DISPLAY_RAISE = 0.18;
export const CITY_RING_DIAMETER = 0.53;
export const CITY_RING_HEIGHT = 0.09;
export const CUBE_SIZE = 0.77;
export const CUBE_HEIGHT = 0.22;
export const DISC_DIAMETER = 0.6;
export const START_MARKER_DIAMETER = 0.72;
export const DEED_W = 2.56;
export const DEED_H = 1.71;
/** In a merged company each further deed lies under the one before, this much lower: just its bottom strip (era,
 *  ship limits, good) shows, 190 of the face's 342 px, so every deed's attributes read in one column (P3.16). */
export const DEED_STACK_STEP = (DEED_H * 190) / 342;
export const CITY_CARD_W = 2.1;
/** Each player's money mat: the player aid's Bank and Cash boxes (C4) side by side, about a third of the sheet. */
export const AID_W = 5.4;
export const AID_H = 2.18;
export const CITY_CARD_H = 1.26;
/** The wooden goods markers (C9), 10% smaller than first drawn (the developer, 2026-11-02: a touch too big). The rice
 *  sack stands taller than the rest. */
export const GOODS_MARKER_H = 0.56;
export const GOODS_MARKER_H_RICE = 0.65;
export const GOODS_MARKER_THICKNESS = 0.234;
/** the widest a goods marker may be (board units): no wider than the spice marker, as the median land area is only
 *  ~0.7 across */
export const GOODS_MARKER_MAX_W = 0.63;
/** The wooden ownership hut (C5): a small house in the player's colour. */
export const HUT_W = 0.28;
export const HUT_WALL = 0.17;
export const HUT_H = 0.29;
export const HUT_DEPTH = 0.22;

// --- load-time assertions against the component list (rules-as-code: assert at load) -------------------------
function assert(cond: boolean, what: string) {
  if (!cond) throw new Error(`consts.ts: ${what}`);
}
assert(DEEDS.length === 24, "24 company deeds (C3)");
assert(DEEDS.filter((d) => d.type === "rice").length === 5, "5 rice deeds (C3)");
assert(DEEDS.filter((d) => d.type === "spice").length === 5, "5 spice deeds (C3)");
assert(DEEDS.filter((d) => d.type === "rubber").length === 4, "4 rubber deeds (C3)");
assert(DEEDS.filter((d) => d.type === "oil").length === 4, "4 oil deeds (C3)");
assert(DEEDS.filter((d) => d.type === "shipping").length === 6, "6 shipping deeds (C3)");
assert(DEEDS.filter((d) => d.era === "A").length === 8, "8 era A deeds (C3)");
assert(DEEDS.filter((d) => d.era === "B").length === 9, "9 era B deeds (C3)");
assert(DEEDS.filter((d) => d.era === "C").length === 7, "7 era C deeds (C3)");
assert(DEEDS.every((d) => (d.type === "shipping") === !!d.ships), "ship limits on shipping deeds only");
assert(DEEDS.every((d, i) => d.id === i), "deed ids are sheet positions");
assert(CITY_CARDS.length === 15 && ERAS.every((e) => CITY_CARDS.filter((c) => c.era === e).length === 5), "15 city cards, 5 per era (C2)");
assert(CITY_CARDS.every((c, i) => c.id === i), "city card ids are sheet positions");
assert(PROVINCES.length === 26, "26 provinces (D5)");
assert(CITY_SUPPLY[1] + CITY_SUPPLY[2] + CITY_SUPPLY[3] === 23, "23 city markers (C7)");
assert(BID_MULTIPLIER.length === RND_STEPS, "a bid multiplier per R&D step (D2)");
