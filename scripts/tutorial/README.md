# Tutorial tooling

The tutorial is `src/tutorial/script.ts` (steps), `strings.en.json` (what the narrator says, hints, the
voice), `pins.json` (every draw and bot move, recorded) and `audio/` (narration, generated).

## Installing it in a game

Everything a tutorial needs is in this folder; nothing has to come from another game.

| file | copy to | change |
|---|---|---|
| `run.mjs` | `scripts/tutorial/` | nothing (bundles `cli.ts` with esbuild and runs it) |
| `coverage.mjs` | `scripts/tutorial/` | nothing (every rule id in `RULES.md` against the `## Coverage` table in `TUTORIAL.md`) |
| `cli.ts`, `harness.ts` | `scripts/tutorial/` | the `ADAPT` imports: the game, `Root`, `Player` |
| `narration.mjs`, `audio.mjs`, `voices.mjs`, `kokoro-voices.mjs`, `align.py` | `scripts/tutorial/` | nothing (`align.py` runs in its own venv: see `audio.mjs --realign`) |
| `describe.example.ts` | `scripts/tutorial/describe.ts` | all of it: a plain-words picture of your table (`describeTable(root, me)`) |
| `objectives.example.ts` | `scripts/tutorial/objectives.ts` | all of it: what makes a good run of each stretch of your script |
| `script.example.ts` | `src/tutorial/script.ts` | keep the plumbing (pins, `chitPath`/`chitAt`, `say`, `narrate`, `doIt`, `confirm`, `othersStep`, `beats`, `at`, `onWord`, `since`/`grew`, `upTo`, `watch`, `buildTutorial`, the exported problem lists); replace the selectors, checks and steps |
| `strings.example.json` | `src/tutorial/strings.en.json` | all the text; the `narrator` block is the voice. Start with `"narrator": { "provider": "none" }` (no audio, reading clock) and record only after the developer approves the script |

The examples are a worked tutorial from another port (a space-cruise game: Zoë the narrator, bots Nova
and Orion, guests, ships, a rotating station), kept here so you can read the whole of a finished script.
Bot steps are named `others-*` (`cli.ts migrate` relies on it). Start with empty pins: `{"setup": [], "steps": {}, "ai": {}}`
in `src/tutorial/pins.json`, and `export const narration = {}` in `src/tutorial/audio/index.ts` until
`audio.mjs` writes it.

`package.json`:

```json
"tutorial:check": "node scripts/tutorial/coverage.mjs && node scripts/tutorial/run.mjs check",
"tutorial:coverage": "node scripts/tutorial/coverage.mjs",
"tutorial:trace": "node scripts/tutorial/run.mjs trace",
"tutorial:search": "node scripts/tutorial/run.mjs search",
"tutorial:cues": "node scripts/tutorial/run.mjs cues",
"tutorial:audio": "node scripts/tutorial/audio.mjs",
"tutorial:voices": "node scripts/tutorial/voices.mjs"
```

`run.mjs` needs `esbuild` (`yarn add -D esbuild` if the game doesn't already resolve it). The harness
imports a few engine internals by path from `node_modules/@pretty-chitty/core/dist/` (`Prompt.js`,
`Turn.js`, `ClockDetails.js`, `tutorial/allowed.js`, `tutorial/defineTutorial.js`); if an engine
upgrade moves them, the bundle fails to build and says which. Wire the tutorial into the game with
`tutorials = [buildTutorial("en", pins)]` on the `Game` class (the example's last line).

## Commands

| command | what it does |
|---|---|
| `yarn tutorial:check [--run-timeout s]` | Plays the whole script headlessly four ways (three timings and the engine's own `runTutorial`) and fails on anything a player would hit: a prompt the step's `allow` blocks, a stall, a warning, an unpinned draw, a board that differs between timings at a moment the narrator holds it on, a final table that differs, a missing recording (not while the narrator is `"none"`), a cue phrase not in its text. |
| `yarn tutorial:trace [--until step] [--show step,…] [--log] [--frames] [--answers] [--browser-like\|--fast-bots] [--step-timeout s] [--freeze file]` | Plays the script and prints the table (at the steps named, and at the end) and the game log. `--frames` lists every moment your board showed, with its step, its log line and `[held]` where the tutorial stopped it: where a hold can land. `--answers` lists every prompt the person answered, by step (the engine's Confirms and Follow passes inside bot steps included). `--browser-like`/`--fast-bots` use the check's timings; `--step-timeout s` lets a long step (a free-play measurement) run. `--freeze` writes the run's pins. |
| `yarn tutorial:trace --replay [--frames]` | The check's headless run on its own (pins replayed, the bots waiting for their scripted steps, seed 99): the one to reach for when the check's headless timing alone disagrees. `TUTORIAL_DEBUG_HELD=1` prints every held table as it is recorded (step and clock) and which one the end table was read from. |
| `yarn tutorial:search --objective name --from step --until step [--n 40]` | Plays the script many times with the draws and bot moves from `--from` on left random, scores each run with an objective (`objectives.ts`), and writes the best run's pins to `src/tutorial/pins.candidate.json`. |
| `yarn tutorial:coverage` | Lists every rule in `RULES.md` the `## Coverage` table of `TUTORIAL.md` doesn't say how the lesson teaches (shown, explained, or skip with a reason). `tutorial:check` runs it first. |
| `yarn tutorial:cues` | Every step's sentences, ● where a highlight changes and what it rings: read it as a viewer before anyone watches (every sentence naming a thing on the table needs its ●). |
| `yarn tutorial:voices` | Renders two steps in several ElevenLabs voices, to pick the narrator by ear. |
| `yarn tutorial:audio [--dry-run] [--only step,…] [--say] [--all --whole --seam step] [--retrim 0.1,0.2] [--realign]` | Renders the narration. `--whole` reads the whole script as one take (a request per ~10,000 characters, chained, a new take at `--seam`) and cuts a file per step: one voice throughout, where a request per step sounded like a different speaker each time. `--retrim` trims each file's silence (free). `--only step` patches one step alone. A `voicebox` narrator renders on a local Voicebox server instead (free, a take per step), then force-aligns every clip to its text with `align.py` for the sentence and word times; `--realign` re-times the existing clips without rendering. |

## Changing the script

1. Write or change the steps (`script.ts`) and their texts (`strings.en.json`). Highlights follow the
   narration by phrase (`beats`, `at`), so keep each sentence about one thing.
2. `yarn tutorial:trace --until <last new step> --log`: read the table and the log, and make the text
   say what actually happens (the bots' moves are real moves; narrate them only once frozen).
3. New stretch of game? `yarn tutorial:search --from <first new step> --until <last> --objective …`
   to pick a good run, then copy `pins.candidate.json` over `pins.json` (or `trace --freeze`).
   Changing a step before the frozen part changes everything after it: search again from there.
4. `yarn tutorial:audio --dry-run`, then `yarn tutorial:audio` (ElevenLabs bills by character).
5. `yarn tutorial:check` must pass. Restart `yarn start` after adding audio files.

## Showing things while they're said

The board plays the game one moment (clock) at a time, and a step or a beat can stop it on a moment
(`timeline: { until: check }`) so what the narrator is describing is on screen, ringed, while it is said: a
bot's move, a ship's arrival, a payout. The harness plays your view the same way (and only
shows your prompt once it has caught up), so `trace --frames` shows exactly where holds land.

- **Hold on state, not log lines.** A moment shows the latest line written before it, so a line can
  show a moment before its change, and a part's last line is replaced by the next player's first.
- **Set a hold before its moment can show.** Anything that happens without a scripted decision (a bot's
  ship advancing after your Confirm) needs the hold on the step before it.
- **A bot's step ends on an absolute condition, and its last hold is that condition** (`watch` checks
  this): beats can fire before the board reaches an earlier hold.
- **Steps that need your prompt play the board again** (`doIt` and `othersStep` default to `"play"`).

## Steering the bots

`steer` (exported by `src/tutorial/script.ts`) adjusts each bot's free choice while a run is recorded: its
result is added to the option's score, and `-Infinity` vetoes the option; a positive result also revives an option the bot's own rules veto (Indonesia's bots score passing an acquisition -Infinity, and the lesson needed the Sultan to pass). Use it for what the lesson needs the
bots not to do. Replays follow the pins and never consult it. A script with nothing to steer exports
`export const steer: Steer = () => 0`.

## How the script stays deterministic

Every bot move and every random draw is recorded per step and replayed, so the bots do what the
narration says whatever the timing; the engine holds a bot until the step that recorded its next move
(`hold`). Bots' Confirms are not scripted: the engine lets them through, so a turn ends whenever the
last one comes (draws are handed out in order, so the game is the same; the check treats a draw that
lands a step late as a note). No step pauses the bots. Each bot's part of a turn is its own step
(`watch`, with `stepActors` naming who may move while recording), so it plays while that step
narrates it. Bot moves are pinned by chit path, not id (ids of the chits built before the first turn
differ between builds). Steps wait for what your board shows, never for the bots' prompts.

In a simultaneous step (taking actions, advancing ships) **you go first and the bots after**: while
your own part is open you cannot see the others' moves at all, so a step waiting on them would never
pass in front of a player. The harness checks everything on the seat's own view (as the browser
does), so a step like that fails here too. While recording, draws the bots make at the same time
share one value, so the order in which they happen to draw cannot change what anyone gets.

Let the bots' parts play in seat order: while a simultaneous step is still running your board shows
the parts in the order they were created (yours first), and once all are done, in the order they
finished, so a held moment could change under the hold if those differ.

## Changing the order of steps without changing the game

`chronicle --out old.json` records every draw (tagged with the simultaneous step it was made in) and
every bot move of the current script; after re-ordering steps, `migrate --from old.json --out new.json`
replays the same game in the new order and refuses unless the final table is identical.
