# Indonesia

Splotter Spellen's *Indonesia* (2005; 2009 English rules) on the Pretty Chitty engine, for 2–5 players, with
bots, a live player aid and a voiced tutorial. Players start rice, spice, rubber and oil plantations and shipping
lines, sell goods to growing cities, and buy each other out in merger auctions. Whoever has the most money when
era C ends wins.

Indonesia is © Splotter Spellen. This is a fan port for personal use.

## Running it

```bash
yarn install        # yarn, not npm: the CLI comes from a local folder (below)
yarn start          # the playground on http://localhost:8080 (the next free port if that one is taken)
```

- `/demo` plays you against the bots. Add `?autoplay=N` to answer your own prompts automatically through year N,
  and `&stopAt=<word>` to stop instead at the first prompt in year N that mentions the word. Both are for
  captures and work only in the browser (`src/phases/common.ts`).
- The tutorial is under the playground's demos as "How to play".

**The engine dependency.** `@pretty-chitty/core` comes from npm. `@pretty-chitty/cli` points at the sibling checkout
`../pretty-chitty-cli`, so clone that beside this repo. To try an unpublished engine change:
1. Run `yarn pack` in `../pretty-chitty`.
2. Copy the `.tgz` to a new temp path.
3. Point `package.json` at that copy and run `yarn install`.
4. Restart `yarn start`: webpack keeps the old engine while the version number is the same.

Go back to the npm version once the change is published. Don't use `pretty-chitty-cli link`, which can pick up a
stale tarball.

## Where things are

| | |
|---|---|
| `RULES.md` | The rulebook as numbered rules (C, S, P1–P7, V…) and the open questions with the defaults in force. Code comments cite these ids. |
| `AUDIT.md` | Every rule id, with the code that implements it and any reading taken. |
| `LAYOUT.md`, `MAP.md`, `ASSETS.md` | The table plan, how the board's areas and arrows were made, and where every image comes from. |
| `TUTORIAL.md` | The tutorial's lesson plan and its coverage table: every rule id, shown or explained. |
| `src/Indonesia.ts` | The game: metadata (including the notes players see), theme, and the phase loop. |
| `src/phases/` | One file per phase of the year (`phase1NewEra.ts` … `phase7CityGrowth.ts`) and setup. |
| `src/chits/` | The state tree: board, areas, companies, cities, ships, mats, mergers, the player aid. |
| `src/consts.ts` | The rulebook's tables (cards, deeds, R&D tracks, unit values), colours and sizes. |
| `src/geometry/` | Generated from the board image: land and sea areas, arrows, ship places, display spots. Don't edit these by hand; rerun the scripts. |
| `src/bots/`, `src/ai.ts` | The bots. `v2` is shipped and values every choice in rupiah (`econ.ts`, weights in `weights.ts`). `v1` is the frozen baseline. |
| `src/tutorial/` | The tutorial script, its narration text, the pinned draws and bot moves, and the recorded audio. |
| `src/secret.ts` | Secret money: who may see which amounts. |

The rulebook (`rules.pdf`), the extracted Tabletop Simulator textures (`art/`) and captures (`shots/`,
`results/`) are not in the repo. The art and geometry scripts read them.

## Scripts

Most scripts load the production bundle, so run `yarn build` first.

| Command | What it does |
|---|---|
| `node scripts/ai-soak.mjs [games] [players] [timeoutSec]` | Whole games with every seat on the shipped bot. It fails a game on any error, a stall, or saved state naming a piece that is no longer on the table. Run it after every rules change. |
| `yarn tutorial:check` | Checks that every `RULES.md` id is in `TUTORIAL.md`'s coverage table. Then plays the tutorial at four paces (headless, browser-like, bots, a slow person) and checks the narration timing. |
| `yarn tutorial:audio` | Records the narration (Kokoro voice `bf_isabella` through Voicebox). See `scripts/tutorial/README.md`. |
| `node scripts/replay-state.mjs <save.json>` | Rebuilds a match exported from the playground and prints where it stands, for chasing a bug report. |
| `node scripts/screenshot.mjs <url> <out.png> <w> <h> <waitMs> [--click TEXT] [--frames N:MS]` | Captures in headless Chrome. `--frames` takes a sequence, to check a move. |
| `node scripts/testbed/run.mjs`, `scripts/tune/*.mjs` | AI work: many games in parallel, the weight tuner, head-to-head validation, one game's log. Results go to `results/`. Use 4 workers. |
| `npx tsx scripts/test/logistics.ts` | Checks of the delivery network on the real map. |
| `python3 scripts/geometry/*.py`, `scripts/art/*.py` | Rebuild the map geometry, the goods display spots and shapes, and the art cut from the TTS textures and the rulebook. |

`yarn deploy` builds, bumps the patch version and uploads over FTP, using `.ftpSettings.json` (gitignored; never
commit it). It publishes the game, so only the developer runs it or approves it.

## Rulings

The port follows the 2009 rulebook. Where the book is silent or the port reads it one way, `RULES.md`'s open
questions table records the default in force, and `AUDIT.md` marks every reading with ⚠️ or 🎨. The ones a player
will notice are listed in `implementationNotes` in `src/Indonesia.ts`.
