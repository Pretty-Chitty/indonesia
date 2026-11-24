# Table layout

Scale: one world unit = 100 px of the board print (the board is 39.1 × 18.6 units). Every other component is
sized from the DLC's real proportions (ASSETS.md, *Sizes*), so a ship tile on the board is the size of a ship
tile in the box.

## Panels

| panel | chit | holds | tab icon | min size | camera padding |
|---|---|---|---|---|---|
| Board | `MainBoard` | the map with every land area, sea area, city (ring, with its goods display floating beside it while it holds goods), goods marker with its owner's hut, ship, company start marker | Borneo outlined in white on the board's land brown | 520 × 250 (board aspect 2.1:1) | 4 px all round |
| Tracks | `Tracks` | the Turn Order track (discs) and the R&D table (cubes), cut from the board's lower left with its own art; the board shows sea paper where it was | a grid with player cubes on paper | 170 × 200 | 4 px |
| Companies | `Market` | the current era's unacquired deeds in a row, face up, plus the three era decks as face-down piles (A at the front) | two fanned deeds on the spice deeds' green | 300 × 120 | 4 px |
| Player (viewer) | `Player` | their companies: each a `Company` chit of 1–5 deeds splayed; their three city cards (A, B, C) face up at the right; operated companies lie face down | the player's avatar (engine) | 320 × 170 | top 20 (sparks bar), others 4 |
| Player (others) | `Player` | the same, smaller | | 260 × 140 | |

Sparks (player bar): **Cash** (hidden from opponents under closed money: shows "–"), **Bank** (public), and
**Slots** used/available (e.g. `2/3`). Nothing else: the R&D cubes are on the board.

Dropdown: the player aid (Phase 11).

Gallery-only chits (no table position): the five R&D track choices are picked on the board cells themselves,
with an inline gallery of the five tracks (plus "another player's Hull"); the operation and merger prompts
pick companies on the mats.

## Split tree

Desktop (1440 × 900):

```
┌──────────────────────────────────────────────┬────────────────────┐
│                                              │  Viewer's mat      │
│                 Board (order 1)              │  (order 2)         │
│                                              ├────────────────────┤
├───────────────────────────────┬──────────────┤  opponents         │
│  Companies (3)                │  Tracks (4)  │  (order 10+)       │
└───────────────────────────────┴──────────────┴────────────────────┘
```

`{ direction: "optimizePreferHorizontal", splits: [ board, { direction: "vertical", splits: [viewer, market] },
{ direction: "horizontal", collapseOrder: 1, splits: opponents } ] }`. The opponent strip folds into tabs
first; then the right column folds; the board is last.

Phone (400 × 800):

```
┌──────────────┐
│    Board     │   full width, 2.1:1 → 400 × 190
├──────────────┤
│  Viewer mat  │
├──────────────┤
│ tabs: mine | Tracks | Companies | P2 | P3 │
└──────────────┘
```

All non-board panels fold into one tab group with the viewer's mat first and the opponents behind it. The two groups
split the height 52 : 48 at any phone height (2026-11-23; fixed minimums had folded a shorter phone into one group).

Mid-size (panel area under ~890 wide, or ~950 when under 600 tall; added 2026-11-23, an unfolded foldable,
~830×400–550): the desktop tree's 520-wide table beside 320–400-wide mats no longer fit, so everything folded into
one tab group. Now the table takes 65% of the width at the left and the mat column 35% at the right (developer, 2026-11-23). The column holds the viewer's mat over a tab group of opponents. Between 600 and 700 wide the phone stack is used
only from 450 tall; shorter windows take the side-by-side tree.

## Inside each panel

**Board.** The board art is a 39.1 × 18.6 cardboard slab (thickness 0.06, edge in the frame's paper colour,
`receiveShadow`). Every land and sea area is a `LandArea` / `SeaArea` chit, an invisible click target shaped
from its detected ring, placed at its pole; pieces parent to the area and sit at the pole (goods marker at the
pole; a city ring at the pole, and while it holds the year's goods its goods display, raised 0.18 and pointing
at the ring from its area's spot (`displaySpots.ts`), the goods stacked one set per lobe; ships in a sea area splayed
in a 2-column grid about the pole). Company start markers (round 0.72-unit tokens with the deed's icon) sit on
the province's largest land area's pole, lifted a little. The R&D cubes sit in the detected table cell for
(track, step), staggered by seat index inside the cell (5 cubes × 0.7 fit in an 0.84-wide cell only staggered
in two rows). The turn-order discs sit in the Turn Order cells.

**Companies.** Deeds are 2.56 × 1.71 cards (3:2, from the sheet) laid in a row with a 0.4 gap, era pile(s)
at the left as a stack. The row is the staging area for the acquisition prompt; a start marker on the board is
picked by clicking the deed (the deed is the thing).

**Player mat.** A `Company` chit per company; its deeds splay with a 0.5 offset; an operated company turns
face down (`rotateY = π` on each deed). Companies lie in a row (gap 0.4) with the three city cards (2.1 ×
1.0, from the sheet's 2.4:1.15 scale) in a column at the right. The mat has no printed board of its own (the
real game has only the player aid, a screen, and money), so the panel is the player's tinted table surface.

## Prompts and focus

| decision | shape | picks | focus |
|---|---|---|---|
| build a city (P1.5) | pick on the board; position is the decision | the legal coastal `LandArea`s of the three provinces | board |
| turn-order bid (P2) | adjust a number: ±1 / ±5 / ±25 / Bid | buttons; the running bid on the player's chit | viewer's mat |
| announce a merger (P3) | pick a company (any mat), then a second compatible company; Pass | `Company` chits on all mats, with an inline gallery | all mats |
| bid in a merger (P3.14) | raise by N / ×k, or Pass | buttons | the two companies |
| give up siap saji areas (P3S.5) | pick a border goods marker, repeatedly | goods markers on the board | board |
| acquire a company (P4) | pick a deed in the Companies row, or Pass | deeds | market + board |
| place the first goods / ship (P4.6, P4.7) | pick on the board | legal `LandArea`s / `SeaArea`s | board |
| research (P5) | pick the next cell on one of your tracks, or another player's Hull cell; or Pass | table cells, inline gallery of the tracks | board |
| operate: choose a company (P6.1) | pick on own mat | un-operated `Company` chits | viewer's mat |
| shipping: expand (P6S) | pick a sea area, repeatedly, Done | legal `SeaArea`s | board |
| production: deliver (P6P.10) | pick a (city, line) for each good, offered only where the maximum stays reachable; "deliver the rest at least cost" button | city rings on the board, each labelled with the line and fee in its summary | board |
| production: expand (P6P.11/15) | pick a land area, repeatedly, Done / Buy | legal `LandArea`s | board |
| city growth tiebreak (P7.5) | pick cities to grow | city rings | board |

Every pick that changes the viewer's own holdings also focuses their mat.

## 2026-10-31 revision

- The Map, the Companies and the Tracks are three tabs of one panel (a declared tab group in `Root.getLayout`), the
  Map first. Each prompt's focus brings its tab forward. Desktop: that panel at the left, the mats in a column at
  the right. Phone: that panel on top, the mats as tabs below with the viewer's first.
- Every mat's spark bar carries the player's research beside their money: Turn Order Bid (as its multiplier),
  Slots, Mergers, Expansion, Hull. So the Tracks tab is only needed while bidding and researching.
- The table under each mat is the wood tinted toward the player's colour, lifted toward white with a little glow.
- The colours are the box's (static/boxArt.jpg, the rulebook cover): olive bars, menus and tutorial box
  (`BOX_OLIVE`), khaki highlights (`BOX_KHAKI`), cream text, and the table wood stained the same olive. The click
  colour, shared by the tutorial's rings, arrows and buttons, is a rose (`CLICK_COLOR`), apart from every player
  and good colour (the developer, 2026-11-01: the brown chrome was not Indonesia's, the neon pink "too crazy").

## Checking the layout

`yarn layout:check` builds a Root and runs the engine's own layout code (`RootChit.getFlatLayout`) at phone, foldable,
tablet and laptop panel sizes, and checks what each should show (`scripts/layout/check.ts`). `--print` lists every size.
