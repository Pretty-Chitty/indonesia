// Every image the game draws is looked up here by game data, never by file name. The maps are exhaustive over the
// data they are keyed by, so a deed or good without art fails at load instead of drawing a grey slab.
import { ImageSpec } from "@pretty-chitty/core";
import * as cards from "./assets/cards";
import * as icons from "./assets/icons";
import * as aid from "./assets/aid";
import * as boardArt from "./assets/board";
import * as tracksArt from "./assets/tracks";
import * as pieces from "./assets/pieces";
import * as displays from "./assets/displays";
import { table } from "./assets/environment";
import { CITY_CARDS, CitySize, CompanyType, DEEDS, Good, PLAYER_COLOR_NAMES } from "./consts";

function pick(mod: Record<string, unknown>, name: string): ImageSpec {
  const v = mod[name];
  if (!v) throw new Error(`art.ts: no sprite "${name}"`);
  return v as ImageSpec;
}

/** The mini-map crop printed on each deed (D4), by deed id. */
export const DEED_MAP: ImageSpec[] = DEEDS.map((d) => pick(cards, `deed${d.id}`));
/** The map printed on each city card (D3), by card id. */
export const CITY_MAP: ImageSpec[] = CITY_CARDS.map((c) => pick(cards, `city${c.id}`));
export const CARD_BACK = pick(cards, "cardback");
export const PAPER = pick(cards, "paper");

/** The goods alphabet, cut from the player aid: black glyphs with transparent backgrounds. */
export const ICON: Record<CompanyType | "transport", ImageSpec> = {
  rice: pick(icons, "rice"),
  spice: pick(icons, "spice"),
  rubber: pick(icons, "rubber"),
  siapsaji: pick(icons, "siapsaji"),
  oil: pick(icons, "oil"),
  shipping: pick(icons, "ship"),
  transport: pick(icons, "transport"),
};

/** The top face of each wooden goods marker: the rulebook's printed piece (scripts/art/rulebook_goods.py). */
export const PIECE: Record<Good, ImageSpec> = {
  rice: pick(pieces, "rice"),
  spice: pick(pieces, "spice"),
  rubber: pick(pieces, "rubber"),
  siapsaji: pick(pieces, "siapsaji"),
  oil: pick(pieces, "oil"),
};

/** The face of each city goods display (C7), turned so its point is on the left: the rulebook's printed card
 *  (scripts/art/rulebook_displays.py). */
export const DISPLAY: Record<CitySize, ImageSpec> = {
  1: pick(displays, "size1"),
  2: pick(displays, "size2"),
  3: pick(displays, "size3"),
};

export const PLAYER_COLOR_NAME_LIST = PLAYER_COLOR_NAMES;

/** The deed panel colour per company type, sampled from the deed sheet (art/build/deed_panels.json). */
export const DEED_PANEL: Record<CompanyType, string> = {
  spice: "#447e54",
  rice: "#a59284",
  oil: "#332e2b",
  rubber: "#787570",
  shipping: "#7e94a1",
  siapsaji: "#8a7a5a",
};

export const BOARD = pick(boardArt, "board");
/** The Turn Order track and R&D table cut from the board (scripts/art/extract_tts.py). */
export const TRACKS_ART = pick(tracksArt, "tracks");
export const PLAYER_AID = pick(aid, "playeraid");
/** The aid's two money boxes, "Bank" and "Cash", each with the paper below its title: each player's money mat. */
export const AID_BANK = pick(aid, "aidbank");
export const AID_CASH = pick(aid, "aidcash");
export const NOTES: ImageSpec[] = [pick(aid, "note1"), pick(aid, "note2"), pick(aid, "note3"), pick(aid, "note4")];
export const TABLE = table;
