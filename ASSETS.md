# Assets

Source: the official Tabletop Simulator DLC (Steam app 468721, Splotter's second edition), extracted from the
developer's local DLC bundle with `scripts/art/extract_tts.py` into `art/` (not shipped), then cut and shipped
by `scripts/art/ship_art.py` into `src/assets/`. Rulebook: `rules.pdf` (English, 2009 printing). BGG id 19777.

## Inventory

| family | count | kind | status | source / note |
|---|---|---|---|---|
| main board | 1 | one-off image | have | `Indonesia_Board_Diffuse` 4096² (board band 3912×1858); shipped at 70% as JPG |
| land / sea areas | 127 + 31 | **data** | have | `src/geometry/map.ts` (MAP.md) |
| R&D table, Turn Order track | 35 cells | **data** | have | detected lattice in `map.ts` |
| company deeds | 24 | drawn face (`DeedFace`): colour panel + mini-map crop + era letter + goods icon + ship counts | have | mini-maps cropped per deed from `company_deeds_front` (4096², 4×6 cells of 1024×683); the back sheet (province name over the icon) is the deed's other face |
| city cards | 15 | drawn face (`CityCardFace`): paper + mini-map crop + era letter | have | `city_cards` sheet 4096² (3×5 cells of 1365×819); back = the oval logo on olive |
| goods icons (rice, spice, rubber, siap saji, oil, ship, transport) | 7 | icon | have | cut from the player aid (black on paper) |
| goods markers (wooden) | 5 shapes | geometry + printed face | have | the rulebook's pieces (rules.pdf p.2, `scripts/art/rulebook_goods.py`): each silhouette traced and extruded in its wood colour, its screen print on top (`src/assets/pieces/`, `src/geometry/goodsPieces.ts`). Replaced the DLC's plain-coloured meshes at the developer's request (2026-11-01) |
| delivered-goods counters | 5 (+ "2" variants) | not used | — | a good sold is shown with the wooden goods marker, as the developer's table plays it (2026-11-02); the DLC's `cardboard_goods_marker_*` textures stay in `art/` only |
| ships | 2 types × 5 colours + neutral | cardboard tile 1.57×0.78 with the ship drawing | have | `ships_<colour>_<1\|2>` 512² (top half = face, bottom half = back) |
| city rings | 3 sizes | geometry + colour | have | `city_ring` mesh 0.48 ⌀ × 0.08; amber / green / red |
| city goods displays | 3 sizes | geometry + printed face | have | the rulebook's displays (rules.pdf p.2, `scripts/art/rulebook_displays.py`): each outline traced and extruded as card, its face on top, moved to its city ring's colour (`src/assets/displays/`, `src/geometry/cityDisplays.ts`). Where each stands beside its city, per coastal area and size: `scripts/geometry/build_display_spots.py` → `src/geometry/displaySpots.ts` (check renders `art/build/display_spots*.png`) |
| player markers (cubes, disc) | 5 colours | geometry + colour | have | `marker_player` mesh 0.7×0.2×0.7; colours from the DLC player set (blue, purple, orange, red, yellow) |
| company start markers | 16 | drawn: round token with the goods icon | have | no DLC art (the DLC puts the deed on the map); drawn as a 0.72 ⌀ cardboard token |
| money | coins 1, 5; notes 10, 50, 100, 500 | not on the table | — | money is a number (Cash / Bank sparks); the note faces are kept in `art/` for the player aid and the tutorial |
| player aid | 1 | one-off image | have | `player_aid_2048_diffuse` 2048²: Bank / Cash boxes, Game Sequence, goods values; used for the dropdown art |
| table | 1 | one-off image | have | `indonesia_table_background` 4096×2048 (the DLC's wooden table), stained the box's olive with its grain kept (`extract_tts.py`, `olive_stain`) |
| panel tab icons | 3 | drawn | have | board: Borneo's outline in white on the board's land brown (from the map geometry); companies: two fanned deeds, cream with dark edges, on the spice deeds' green; tracks: a grid with cubes on paper |
| box art | 1 | one-off image | have | the second-edition lid cut from the DLC's game-box texture (`art/box.png`), 600×431 JPG, 73 KB; BGG's main image is the third edition and was not used |
| screenshot | 1 | capture | have | `static/screenshot.jpg`, the demo after four autoplayed years at 1800×1050, 215 KB |

Nothing is missing. Nothing needs the developer's scanner. Built sprite sheets (`src/assets/output/`): 1.7 MB.

## Sizes (DLC meshes, in TTS units at scale 1; the board is 35.46 × 16.41 at scale 1.5)

| piece | mesh size | on-board scale | world units (board = 39.1 wide) |
|---|---|---|---|
| board | 35.46 × 16.41 × 0.105 | 1.5 | 39.1 × 18.6 × 0.06 |
| ship tile | 1.57 × 0.78 × 0.05 | 0.95 | 1.10 × 0.55 × 0.04 |
| goods marker (rice) | 0.95 × 1.15 × 0.2 | 0.83 | 0.54 × 0.65 × 0.234 (all goods markers 10% smaller than first drawn, 2026-11-02) |
| goods marker (spice) | 1.18 × 1.06 × 0.2 | 0.83 | 0.72 × 0.65 |
| goods marker (rubber) | 1.22 × 0.83 × 0.2 | 0.83 | 0.74 × 0.50 |
| goods marker (siap saji) | 1.42 × 0.62 × 0.2 | 0.83 | 0.87 × 0.38 |
| goods marker (oil) | 0.86 × 1.06 × 0.2 | 0.83 | 0.52 × 0.65 |
| city goods display | rules.pdf p.2 drawing | — | 0.78 tall × 1.0 / 1.7 / 2.4 long (size 1 / 2 / 3), 0.05 thick, floating 0.18 above the board |
| city ring | 0.48 ⌀ × 0.08 | 1.5 | 0.53 ⌀ × 0.09 |
| player cube | 0.7 × 0.7 × 0.2 | 1.5 | 0.77 × 0.77 × 0.22 |
| deed | card 1024 × 683 px | 1.29 × 0.65 | 2.56 × 1.71 |
| city card | card 1365 × 819 px | 2.4 × 1.15 | 2.1 × 1.26 (the TTS scale is a thumbnail; use the deed's aspect family) |
| coin 1 / 5 | 0.52 / 0.70 ⌀ | 1.5 | not on the table |
| note | 3.5 × 1.76 | 1.5 | not on the table |

## Shipped files (`src/assets/`, budget ≤ 4 MB)

| folder | files | sprite.json |
|---|---|---|
| `board/` | `board.jpg` (2738×1300, the printed band at 70%) | jpg |
| `cards/` | 24 deed mini-maps (`deed_<id>.jpg`, 600 px wide), 15 city-card mini-maps (`city_<era><n>.jpg`, 600 px), `card_back.jpg` | jpg |
| `icons/` | `rice.png spice.png rubber.png siapsaji.png oil.png ship.png transport.png` (palette PNG, ~160 px), `logo.png` | palette png |
| `ships/` | `ship_<colour>_<1\|2>.jpg` (face + back strips), `ship_neutral_1.jpg` | jpg |
| `aid/` | `player_aid.jpg` (1024 wide) | jpg |
| `environment/` | `table.jpg` (1024 wide, seamless crop of the DLC table wood, stained olive) | jpg |
| `pieces/` | `oil.png rubber.png siapsaji.png rice.png spice.png` (the rulebook's printed goods pieces, 2x, opaque) | palette png |
| `displays/` | `size1.png size2.png size3.png` (the rulebook's city goods displays, 3x, in the ring colours) | palette png |
