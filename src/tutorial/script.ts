// The Indonesia tutorial: a first game for three (you, the Sultan and the Sumatran), from the deal through the merger
// you propose in year 2. Outline, voice and the game it plays: TUTORIAL.md. Tooling: scripts/tutorial (README).
import { checks, defineTutorial, ForcedDecision, splitSentences, TutorialSpec, TutorialStep } from "@pretty-chitty/core";
import type { AiOption, Checker, Chit, Cue as CueOf, Focus as FocusOf, TutorialContext } from "@pretty-chitty/core";
import type { Root } from "../chits/Root";
import type { Player } from "../chits/Player";
import type { Company } from "../chits/Company";
import { RND_TABLE_ROW, RndTrack } from "../consts";
import { CROP_RECT } from "../geometry/map";
import pinsJson from "./pins.json";
import en from "./strings.en.json";
import { narration } from "./audio/index";

/**
 * How the steps keep the bots in step with the narration: every bot move is recorded in the step that narrates it,
 * and the engine holds a bot until that step (`hold`), whatever the timing. How the board keeps in step: it plays
 * the game one moment at a time, and a step can stop it on a moment (`timeline`) so what the narrator describes is
 * on screen while it is said.
 */

/**
 * A bot move recorded by the tutorial harness (scripts/tutorial), replayed as a forced move so the
 * bots do exactly what the narration says, whatever the timing. `chit` and `target` are paths
 * (`chitPath`), not ids: chits that exist before the first turn are numbered by walking the tree,
 * and that order differs between builds (the game's webpack/babel build and the harness's esbuild).
 */
export type PinnedMove = { key: string; chit?: string; target?: string; button?: string };

/**
 * Everything random the script relies on, recorded from one headless run and replayed:
 * `setup` — the draws before the first step (the seating shuffle first, then the deal);
 * `steps` — per step, the draws made while it is live; `ai` — per step and bot, every bot move.
 * Regenerate with scripts/tutorial (see its README); never edit by hand.
 */
export type Pins = {
  setup: (number | number[])[];
  steps: { [stepId: string]: (number | number[])[] };
  ai: { [stepId: string]: { [playerId: string]: PinnedMove[] } };
};

/** One locale's texts: step texts (markdown with :tokens:), hints, and how tokens are read aloud. */
type Strings = typeof en;

type Step = TutorialStep<Player, Root>;
type Ctx = TutorialContext<Player, Root>;
type Focus = FocusOf<Player, Root>;
type Cue = CueOf<Player, Root>;

/**
 * Where a chit is, from the root: outlet names, with the index in ordered outlets
 * (`players[1].mat.smallShip`, `players[2].hand.cards[3]`). The same in every build of the game.
 */
export function chitPath(chit: Chit): string {
  const parts: string[] = [];
  for (let c: Chit | undefined = chit; c?.parent; c = c.parent) {
    const outlet = c.parentOutlet;
    if (!outlet) throw new Error(`chit ${c.id} has no outlet: it cannot be pinned by path`);
    const holder = (c.parent as unknown as Record<string, unknown>)[outlet] as { copy?: () => Chit[] } | undefined;
    const index = holder?.copy ? holder.copy().indexOf(c) : -1;
    parts.unshift(index >= 0 ? `${outlet}[${index}]` : outlet);
  }
  return parts.join(".");
}

/** The chit at a `chitPath`, or undefined. */
export function chitAt(root: Root, path: string): Chit | undefined {
  let c: unknown = root;
  for (const part of path.split(".")) {
    const m = /^([^[]+)(?:\[(\d+)\])?$/.exec(part);
    if (!m || !c) return undefined;
    const value = (c as Record<string, unknown>)[m[1]] as { get?: (i: number) => unknown } | undefined;
    c = m[2] !== undefined ? value?.get?.(Number(m[2])) : value;
  }
  return c as Chit | undefined;
}

function forced(moves: PinnedMove[]): ForcedDecision<Player, Root>[] {
  return moves.map((m) => ({
    key: m.key || undefined,
    chit: m.chit ? (root: Root) => chitAt(root, m.chit!) : undefined,
    target: m.target ? (root: Root) => chitAt(root, m.target!) : undefined,
    button: m.button,
  }));
}

// ---------------------------------------------------------------------------------- selectors ---
// The cast: seat 0 is you; the Sultan of Solo and the businessman from North Sumatra are the bots.
const sultan = (root: Root) => root.players.get(1)!;
const sumatran = (root: Root) => root.players.get(2)!;
// The companies of the lesson, by deed id (their keys are `c` + deed id, src/phases/phase4Acquisitions.ts)
const JB_RICE = 9;
const BALI_RICE = 7;
const LAMPUNG = 18;
const HALMAHERA_SPICE = 2;
const MALUKU_SPICE = 3;
const RIAU_RUBBER = 14;
const SB_RUBBER = 15;
const companyOf = (deedId: number) => (root: Root) => root.players.copy().flatMap((p) => p.companies.copy()).find((c) => c.key === `c${deedId}`);
const marker = (deedId: number) => (root: Root) => root.board.startMarkers.find((m) => m.deedId === deedId);
const deedOnOffer = (deedId: number) => (root: Root) => root.market.deeds.find((d) => d.deedId === deedId);
// The places of the lesson (src/geometry/map.ts). Jawa Barat's coast faces two seas of the Lampung line: the
// western Java Sea (127), which your city touches, and the Sunda strait side (126), which your first plantation
// touches, so your first rice rides two ships.
const CITY_AREA = 141;
const PLANT_AREA = 144;
const EXPAND_AREA = 136;
const LAMPUNG_CITY_AREA = 130; // your era B city: on both of the Lampung line's seas
const SS_EXPAND = [135, 139]; // where the siap saji company grows with Expansion 2
const SB_RUBBER_AREA = 45; // the Sumatran's rubber, which keeps Riau rubber off 39 and 48
const RIAU_BLOCKED = [39, 48];
const SEA_WEST = 126;
const JAVA_SEA = 127;
const SEA_SUMATRA = 100; // off the Sumatran's city: the Lampung line's third ship, in era B
const land = (id: number) => (root: Root) => root.board.land(id);
const lands = (ids: number[]) => (root: Root) => ids.map((id) => root.board.land(id));
const cityIn = (province: string) => (root: Root) => root.board.cities().find(({ land }) => land.province === province)?.city;
const yourCity = (root: Root) => root.board.land(CITY_AREA).city;
/** your city's goods display, out beside it while it holds goods (inside the city otherwise) */
const yourDisplay = (root: Root) => yourCity(root)?.display();
const plantations = (deedId: number) => (root: Root) => root.board.goodsOf(`c${deedId}`).map((l) => l.good!);
const ships = (deedId: number) => (root: Root) => root.board.shipsOf(`c${deedId}`).map((s) => s.ship);
/** a line's ship in one sea */
const shipIn = (deedId: number, sea: number) => (root: Root) => ships(deedId)(root).filter((x) => (x.parent as unknown as { areaId?: number } | undefined)?.areaId === sea);
const capacityMarkers = (deedId: number) => (root: Root) => ships(deedId)(root).flatMap((s) => s.capacity.copy());
/** your rice (then siap saji) company's plantation in a province */
const yourGoodIn = (province: string) => (root: Root) => root.board.goodsOf(`c${JB_RICE}`).find((l) => l.province === province)?.good;
const allCities = (root: Root) => root.board.cities().map(({ city }) => city);
const discOf = (root: Root, p: Player) =>
  root.tracks.cells.copy().flatMap((c) => c.pieces.copy()).find((x) => (x as unknown as { bidLabel?: string; seat?: number }).seat === p.seat && "bidLabel" in x) as
    | (Chit & { bidLabel: string })
    | undefined;
const discs = (root: Root) => root.players.copy().map((p) => discOf(root, p)!).filter(Boolean);
const rndCell = (track: RndTrack, step: number) => (root: Root) => root.tracks.cell(RND_TABLE_ROW[track], step);
const rndRow = (track: RndTrack) => (root: Root) => [1, 2, 3, 4, 5].map((s) => root.tracks.cell(RND_TABLE_ROW[track], s));
const rndSum = (p: Player) => Object.values(p.rnd).reduce((a, b) => a + b, 0);
/**
 * Something printed on the board, by its box in board pixels (src/geometry/map.ts): the board's slab spans the
 * shown crop exactly, and a ring is placed in units of the slab's box. For the era symbols beside a province's
 * name and the arrows that join land across water, which are print, not pieces.
 */
type PxBox = [number, number, number, number];
const printed = ([x0, y0, x1, y1]: PxBox) => {
  const [cx0, cy0, cx1, cy1] = CROP_RECT;
  return {
    chit: (root: Root) => root.board,
    offset: { x: ((x0 + x1) / 2 - (cx0 + cx1) / 2) / (cx1 - cx0), y: ((cy0 + cy1) / 2 - (y0 + y1) / 2) / (cy1 - cy0) },
    scale: { x: (x1 - x0) / (cx1 - cx0), y: (y1 - y0) / (cy1 - cy0) },
  };
};
const JB_SYMBOLS: PxBox = [905, 1415, 1135, 1460];
const LAMPUNG_SYMBOLS: PxBox = [855, 1160, 975, 1195];
const MADURA_ARROW: PxBox = [1540, 1318, 1595, 1350];

// ------------------------------------------------------------------------------------- checks ---
const hasButton = (ctx: Ctx, label: string) => !!ctx.prompt?.buttons.some((b) => b.label.toLowerCase() === label.toLowerCase());

/** The player pressed the engine's Confirm: one was showing during this step and is gone now. */
function confirmed(hint: string): Checker<Player, Root> {
  let seen: string | undefined;
  const check = ((ctx: Ctx) => {
    if (hasButton(ctx, "Confirm")) {
      seen = ctx.prompt!.id;
      return hint;
    }
    return seen !== undefined && ctx.prompt?.id !== seen ? true : hint;
  }) as Checker<Player, Root>;
  // A Confirm already showing when the step starts counts as seen: it can be answered before the
  // check is next read
  check.reset = (ctx) => {
    seen = hasButton(ctx as Ctx, "Confirm") ? ctx.prompt!.id : undefined;
  };
  return check;
}

/**
 * What the gallery buttons a step asks the player to tap would open, for headless runs (the harness taps them; in
 * the browser the player does). Indonesia's tutorial opens none.
 */
export const uiGalleries: { [ui: string]: { of: (root: Root, me: Player) => Chit } } = {};

/**
 * The bots that may move in a step, for recording a run (scripts/tutorial): any other bot waits. Replays need no
 * list: a bot waits for the step of its next scripted move.
 */
export const stepActors: Record<string, string[]> = {};

/**
 * While a run is recorded (scripts/tutorial), each bot's free choice is steered: the result is added to the
 * option's score, and -Infinity vetoes it. Replays follow the pins, so it only shapes what gets recorded. The game
 * the lesson needs is in TUTORIAL.md: where each bot builds and what it starts, bids and researches, where the
 * Lampung line's ships go, the Sultan's one raise and paid expansion, and nobody but you announcing a merger.
 */
export type Steer = (c: { step: string; bot: string; option: AiOption; view: Root; me: Player }) => number;
const WANT = 1e9;
/** per step, the company each bot starts (acquire.deed) */
const STARTS: Record<string, number> = {
  "others-sumatran-company": LAMPUNG,
  "others-sultan-company": BALI_RICE,
  "others-sumatran-spice": HALMAHERA_SPICE,
  "others-sultan-spice": MALUKU_SPICE,
  "others-sumatran-rubber": SB_RUBBER,
  "others-sultan-rubber": RIAU_RUBBER,
};
/** per step, the track each bot researches */
const RESEARCH: Record<string, RndTrack> = {
  "others-sumatran-research": "slots",
  "others-sultan-research": "slots",
  "others-sumatran-hull": "hull",
  "others-sultan-research-2": "slots",
  "others-sumatran-research-3": "slots",
  "others-sultan-research-3": "slots",
};
export const steer: Steer = ({ step, bot, option, view }) => {
  const key = option.key ?? "";
  const chit = (option as { chit?: unknown }).chit as Record<string, unknown> | undefined;
  const data = (option.data ?? {}) as Record<string, unknown>;
  const want = (yes: boolean) => (yes ? WANT : -Infinity);
  switch (key) {
    case "city.site": {
      const where = bot === "p1" ? (view.era === "A" ? "Bali" : "Maluku") : view.era === "A" ? "Sumatera Selatan" : "Sumatera Utara";
      return want((chit?.province as string) === where);
    }
    case "bid.up": // the Sumatran bids 10 in year 1, in fives; nobody else bids
      return want(step === "others-sumatran-bid" && data.n === 5 && (data.amount as number) + 5 <= 10);
    case "bid.confirm":
      return want((data.amount as number) === (step === "others-sumatran-bid" ? 10 : 0));
    case "merger.first": // only you announce mergers
      return -Infinity;
    case "acquire.deed":
      return want(chit?.deedId === STARTS[step]);
    case "acquire.pass": // after its company, the Sultan passes (years 2 and 3)
      return step === "others-sultan-spice" || step === "others-sultan-rubber" ? WANT / 10 : -Infinity;
    case "acquire.ship":
      return want(chit?.areaId === SEA_WEST);
    case "acquire.area":
      return step === "others-sumatran-rubber" ? want(chit?.areaId === SB_RUBBER_AREA) : 0;
    case "research.cell": {
      const track = RESEARCH[step];
      return want(!!track && (chit?.row as string) === RND_TABLE_ROW[track]);
    }
    case "research.hull":
    case "research.pass":
      return -Infinity;
    case "operate.company": // the Lampung line runs first in year 3, so its third ship is out before you sell
      return step === "others-sumatran-ship-3" ? want((chit as unknown as Company)?.key === `c${LAMPUNG}`) : 0;
    case "operate.piece":
      return step === "others-sumatran-ship-3" ? -Infinity : 0;
    case "ship.place":
      return want(chit?.areaId === (step === "others-sumatran-ship-3" ? SEA_SUMATRA : JAVA_SEA));
    case "expand.area": // only the Sultan's paid area for Maluku spice, in year 2
      return want(step === "others-sultan-pays");
    case "auction.up":
      return -Infinity;
    case "auction.bid": // the Sultan raises once, in year 2; otherwise the bots pass
      return want(step === "others-sultan-raises");
    case "siapsaji.remove":
      return -Infinity;
  }
  return 0;
};

/** Cue phrases that no sentence contains (see `beats`). */
export const cueProblems: string[] = [];
/** Steps with no narration recording (see `say`). */
export const narrationProblems: string[] = [];

// -------------------------------------------------------------------------------------- script ---
function intro(t: Strings, pins: Pins): TutorialSpec<Player, Root> {
  const text = (id: string) => (t.steps as Record<string, string>)[id] ?? `(missing text: ${id})`;
  const hint = (id: string) => (t.hints as Record<string, string>)[id];
  // Narration rendered by scripts/tutorial/audio.mjs (MP3 + exact sentence times). A step without a
  // recording stays silent and is reported by `narrationProblems` (scripts/tutorial `check` fails on it).
  const say = (id: string): Pick<Step, "id" | "text" | "audio" | "sentenceTimes"> => {
    const n = narration[t.locale]?.[id];
    if (!n) narrationProblems.push(`step "${id}" (${t.locale}) has no recording: run scripts/tutorial/audio.mjs`);
    return n ? { id, text: text(id), audio: n.url, sentenceTimes: n.sentenceTimes } : { id, text: text(id) };
  };
  /** A step that waits for the bots: they play, you watch. */
  const othersStep = (id: string, waitFor: Checker<Player, Root>, extra: Partial<Step> = {}): Step => ({
    ...say(id),
    allow: [],
    waitFor,
    hint: { after: 12, text: hint(id) ?? "Nova and Orion are still taking their turns." },
    timeline: "play", // what it waits for only shows once the board has caught up
    ...extra,
  });
  /** A step that asks you to do one thing. */
  const doIt = (id: string, allow: Step["allow"], waitFor: Checker<Player, Root>, extra: Partial<Step> = {}): Step => ({
    ...say(id),
    allow,
    waitFor,
    hint: { after: 8, text: hint(id) ?? "" },
    timeline: "play", // your prompt only shows once the board has caught up
    ...extra,
  });
  /**
   * Highlights that follow the narration, one beat per sentence: each beat starts at the sentence
   * that contains its phrase (the first beat, with phrase "", at the start). Phrases rather than
   * sentence numbers, so editing a text cannot silently shift its highlights; a phrase that is no
   * longer in the text is reported by `cueProblems` (scripts/tutorial `check` fails on it).
   */
  /** The sentence of step `id` that contains `phrase` (see `beats`). */
  const at = (id: string, phrase: string): { sentence: number } => {
    const i = splitSentences(text(id)).findIndex((x) => x.includes(phrase));
    if (i < 0) cueProblems.push(`step "${id}": no sentence contains "${phrase}"`);
    return { sentence: Math.max(0, i) };
  };
  /**
   * When `word` is spoken in step `id` (its `nth` occurrence, 0-based): the second it starts, from
   * the recording's word times, or else its sentence. For cues inside a sentence ("Launch, Advertise…").
   */
  const onWord = (id: string, word: string, nth = 0): number | { sentence: number } => {
    const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
    const hits = (narration[t.locale]?.[id]?.words ?? []).filter(([w]) => norm(w) === norm(word));
    if (hits[nth]) return hits[nth][1];
    return at(id, word);
  };
  const beats = (id: string, list: [string, Focus[], Partial<Cue>?][]): Pick<Step, "focus" | "cues"> => {
    const sentences = splitSentences(text(id));
    const cues: Cue[] = [];
    let focus: Focus[] | undefined;
    for (const [phrase, f, extra] of list) {
      if (phrase === "") {
        focus = f;
        continue;
      }
      const at = sentences.findIndex((x) => x.includes(phrase));
      if (at < 0) cueProblems.push(`step "${id}": no sentence contains "${phrase}"`);
      else if (at === 0 && !focus && !extra) focus = f;
      else cues.push({ at: { sentence: at }, focus: f, ...extra });
    }
    return { focus: focus ?? [], cues };
  };
  // No step pauses the bots: each waits for the step that scripts its next move (pins), and their
  // Confirms go through whenever they come, so a turn can end behind any step.
  const narrate = (id: string, extra: Partial<Step> = {}): Step => ({ ...say(id), ...extra });
  // ---- the board's timeline: show each thing while it is said ------------------------------------
  // The board plays the game one moment at a time; a step or a beat can play it up to a moment and
  // hold it there (`timeline`), so a bot's move, a ship's arrival or a guest's bonus is on screen,
  // and ringed, while Zoë explains it. Checks read the board as shown.
  /**
   * A log line the board has shown since the step (or the timeline command) began. Not for a bot's
   * last move before another player's part: a moment shows the latest line written before it, so
   * that line is replaced by the next part's first one and never shows (use `since`).
   */
  const logged = (re: RegExp) => checks.logged<Player, Root>(re);
  /** `done(before, now)` holds for a value read on the board, `before` read when the step (or the
   *  timeline command) began */
  const since = <T,>(read: (root: Root, me: Player) => T, done: (before: T, now: T) => boolean): Checker<Player, Root> => {
    let before: T | undefined;
    const check = ((ctx: Ctx) => before !== undefined && done(before, read(ctx.root, ctx.me))) as Checker<Player, Root>;
    check.reset = (ctx) => {
      before = read(ctx.root, ctx.me);
    };
    return check;
  };
  const grew = (read: (root: Root, me: Player) => number) => since(read, (b, n) => n > b);
  /** Play the board on to the first moment that passes `check`, and hold it there */
  const upTo = (check: Checker<Player, Root>) => ({ timeline: { until: check } });
  /**
   * A bot's part of the turn, watched as it happens: the board plays its moves and holds on the last
   * one (`last`) while the narration explains them. Only that bot moves meanwhile (`stepActors`:
   * recorded, its moves are pinned to this step, and a replay holds the others until their own).
   */
  const watch = (id: string, bot: "p1" | "p2", last: Checker<Player, Root>, extra: Partial<Step> = {}): Step => {
    stepActors[id] = [bot];
    const step = othersStep(id, last, { ...upTo(last), ...extra });
    // Whatever order the beats fire in, the board must end up on the moment the step waits for
    const commands = [step.timeline, ...(step.cues ?? []).map((c) => c.timeline)].filter(Boolean);
    const final = commands[commands.length - 1] as { until?: unknown } | undefined;
    if (final?.until !== last) cueProblems.push(`step "${id}": its last timeline command must play the board up to the moment it waits for`);
    return step;
  };

  const confirm = (id: string, extra: Partial<Step> = {}): Step =>
    doIt(id, { button: "Confirm" }, confirmed(hint(id) ?? "Tap Confirm."), { focus: [{ arrow: { ui: "button:Confirm" } }], box: { anchor: "top-right" }, ...extra });

  /** Several bots' turns watched as one step (their moves are not news): each may move while it is recorded */
  const watchAll = (id: string, last: Checker<Player, Root>, extra: Partial<Step> = {}): Step => {
    stepActors[id] = ["p1", "p2"];
    return othersStep(id, last, { ...upTo(last), ...extra });
  };
  const cashSpark = { arrow: { ui: (_root: Root, me: Player) => `spark:${me.cashSpark.id}` } };
  const bankSpark = { arrow: { ui: (_root: Root, me: Player) => `spark:${me.bankSpark.id}` } };
  const earningsSpark = { arrow: { ui: (_root: Root, me: Player) => `spark:${me.earningsSpark.id}` } };

  // The moments the bots' steps end on: absolute states, each built once (watch compares them by identity)
  const state = (f: (root: Root, me: Player) => boolean) => checks.state<Player, Root>(f);
  const inYear = (year: number, f: (root: Root, me: Player) => boolean) => state((root, me) => root.year === year && f(root, me));
  const sultanRevealed = inYear(1, (root) => !!sultan(root).cityHand.shown);
  const sumatranRevealed = inYear(1, (root) => !!sumatran(root).cityHand.shown);
  const yourRevealed = inYear(1, (_root, me) => !!me.cityHand.shown);
  const sultanCity = state((root) => !!cityIn("Bali")(root));
  const sumatranCity = state((root) => !!cityIn("Sumatera Selatan")(root));
  const sultanBid1 = inYear(1, (root) => !!discOf(root, sumatran(root))?.bidLabel);
  const sumatranBid1 = inYear(1, (root, me) => !!discOf(root, me)?.bidLabel);
  const sumatranCompany = state((root) => ships(LAMPUNG)(root).length === 1 && sumatran(root).companies.length === 1);
  const sultanCompany = state((root) => plantations(BALI_RICE)(root).length === 1 && sultan(root).companies.length === 1);
  const sumatranResearch = state((root) => rndSum(sumatran(root)) === 6);
  const sultanResearch = state((root) => rndSum(sultan(root)) === 6);
  const sumatranOperated = inYear(1, (root) => !!companyOf(LAMPUNG)(root)?.operated);
  const sultanOperated = inYear(1, (root) => !!companyOf(BALI_RICE)(root)?.operated);
  const cityGrew = state((root) => yourCity(root)?.size === 2);
  // year 2 has begun and last year's earnings have become cash (phase 1 counts the year before it settles)
  const year2 = inYear(2, (_root, me) => me.earnings === 0 && me.cash > 100);
  const sumatranBid2 = inYear(2, (root, me) => root.phase === 1 && !!discOf(root, me)?.bidLabel);
  const sultanBid2 = inYear(2, (root) => root.phase === 2);
  const sumatranPassed = state((root) => root.market.merger.row(sumatran(root))?.status === "passed");
  const sultanRaised = state((root) => root.market.merger.active && root.market.merger.highId === sultan(root).playerId);
  const yours = (root: Root, me: Player) => me.companies.find((c: Company) => c.key === `c${JB_RICE}`);
  const mergerDone = state((root, me) => !root.market.merger.active && yours(root, me)?.deedCount === 2);
  const sumatranSpice = state((root) => plantations(HALMAHERA_SPICE)(root).length === 1);
  const acquisitions2Done = inYear(2, (root) => root.phase === 4);
  const sumatranHull = state((root) => sumatran(root).rnd.hull === 2);
  const sultanResearch2 = inYear(2, (root) => rndSum(sultan(root)) === 7);
  const lampungFull = inYear(2, (root) => root.phase === 5 && !!companyOf(LAMPUNG)(root)?.operated);
  const sumatranSpiceRan = inYear(2, (root) => !!companyOf(HALMAHERA_SPICE)(root)?.operated);
  const sultanPaid = inYear(2, (root) => plantations(MALUKU_SPICE)(root).length === 2 && !!companyOf(MALUKU_SPICE)(root)?.operated);
  const growth2 = inYear(2, (root) => root.phase === 6);
  const eraB = inYear(3, (root) => root.era === "B");
  const sumatranRevealedB = inYear(3, (root) => !!sumatran(root).cityHand.shown);
  const sumatranCityB = state((root) => !!cityIn("Sumatera Utara")(root));
  const yourRevealedB = inYear(3, (_root, me) => !!me.cityHand.shown);
  const sultanRevealedB = inYear(3, (root) => !!sultan(root).cityHand.shown);
  const sultanCityB = state((root) => !!cityIn("Maluku")(root));
  const eraBOffer = inYear(3, (root) => root.market.deeds.some((d) => d.spec.era === "B"));
  const sumatranBid3 = inYear(3, (root, me) => root.phase === 1 && !!discOf(root, me)?.bidLabel);
  const sultanBid3 = inYear(3, (root) => root.phase === 2);
  const othersPassedSS = state((root, me) => !root.market.merger.active && yours(root, me)?.deedCount === 3);
  // the bids resolved and the new order laid out (year 1)
  const newOrder = inYear(1, (root, me) => root.phase >= 2 && me.order === 1);
  const siapSaji = state((root) => plantations(JB_RICE)(root).length === 2 && plantations(JB_RICE)(root).every((g) => g.good === "siapsaji"));
  const sumatranRubber = state((root) => plantations(SB_RUBBER)(root).length === 1);
  const acquisitions3Done = inYear(3, (root) => root.phase === 4 && plantations(RIAU_RUBBER)(root).length === 1);
  const sumatranResearch3 = inYear(3, (root) => rndSum(sumatran(root)) === 8);
  const sultanResearch3 = inYear(3, (root) => rndSum(sultan(root)) === 8);
  const lampungThird = inYear(3, (root) => ships(LAMPUNG)(root).length === 3 && !!companyOf(LAMPUNG)(root)?.operated);
  // year 3's growth, or later: growth asks nobody anything, so the live game runs straight on into year 4 (a check
  // read on the live table, as the engine's runTutorial does, would never see phase 7 itself)
  const growth3 = state((root) => root.year > 3 || (root.year === 3 && root.phase === 6));

  const steps: Step[] = [
    // =========================================================================== the table
    // the goal first, in the rulebook's words; the rivals are introduced when they first act
    narrate("welcome", { box: { anchor: "center" }, focus: [{ ring: (root) => root.board, reveal: true }] }),
    narrate(
      "goal",
      beats("goal", [
        ["", [{ ring: (_root, me) => me.mat, arrow: true, reveal: true }]],
        ["Cash is", [{ ring: (_root, me) => me.mat, arrow: true }, cashSpark]],
        ["The Bank is", [{ ring: (_root, me) => me.mat, arrow: true }, bankSpark]],
        ["In this lesson", [{ ring: (root) => [sultan(root).mat, sumatran(root).mat], arrow: true }]],
      ]),
    ),
    narrate("whole-game", { focus: [{ ring: (root) => root.board, reveal: true }] }),
    narrate(
      "map",
      beats("map", [
        ["", [{ ring: (root) => root.board, reveal: true }]],
        ["little arrow", [{ ring: printed(MADURA_ARROW), arrow: true }]],
        ["start here", [{ ring: (root) => root.board.lands.filter((l) => l.province === "Jawa Barat"), arrow: true }]],
      ]),
    ),
    narrate(
      "year",
      beats("year", [
        ["", []],
        ["player aid", [{ arrow: { ui: (root) => `dropdown:${root.playerAid.id}` } }]],
      ]),
    ),

    // =========================================================================== YEAR 1, phase 1: cities
    // the cards are shown while they are talked about: the hand opens full screen as the narrator describes them,
    // and closes as the Sultan's card turns face up
    narrate("city-cards", {
      ...beats("city-cards", [
        ["", []],
        ["three city cards", [{ ring: (_root, me) => me.cityHand, arrow: true }]],
        ["Each card names", [{ ring: { ui: "gallery:fullscreen" } }], { gallery: { of: (_root, me) => me.cityHand, mode: "fullscreen" } }],
      ]),
    }),
    // each bot's city card is shown face up, the board held on that moment, before the city is built (the card
    // leaves the table once it is used)
    watch("others-sultan-city", "p1", sultanCity, {
      gallery: "close",
      ...upTo(sultanRevealed),
      ...beats("others-sultan-city", [
        ["", [{ ring: (root) => sultan(root).cityHand.shown, arrow: true, reveal: true }]],
        ["the city goes in Bali", [{ ring: (root) => cityIn("Bali")(root), arrow: true, reveal: true }], upTo(sultanCity)],
      ]),
    }),
    watch("others-sumatran-city", "p2", sumatranCity, {
      ...upTo(sumatranRevealed),
      ...beats("others-sumatran-city", [
        ["", [{ ring: (root) => sumatran(root).cityHand.shown, arrow: true, reveal: true }]],
        ["a city in Sumatera Selatan", [{ ring: (root) => cityIn("Sumatera Selatan")(root), arrow: true, reveal: true }], upTo(sumatranCity)],
      ]),
    }),
    // your card turns face up a moment after the Sumatran's city: play to it, so it is on the table and ringed (a
    // card that is talked about but not ringed is fair game for the box to sit on)
    narrate("your-card", { ...upTo(yourRevealed), focus: [{ ring: (_root, me) => me.cityHand.shown, arrow: true, reveal: true }] }),
    doIt("build-city", { key: "city.site", chit: land(CITY_AREA) }, state((root) => !!yourCity(root)), {
      focus: [{ ring: land(CITY_AREA), arrow: true, dim: true }, { ring: (_root, me) => me.cityHand.shown }],
    }),
    narrate("city-built", { focus: [{ ring: yourCity, arrow: true }] }),
    confirm("confirm-city"),

    // =========================================================================== phase 2: the order of play
    narrate("order", { focus: [{ ring: discs, arrow: true, reveal: true }] }),
    narrate("bid-explain", { focus: [bankSpark] }),
    watch("others-sultan-bid", "p1", sultanBid1, { focus: [{ ring: (root) => discOf(root, sultan(root)), arrow: true }] }),
    watch("others-sumatran-bid", "p2", sumatranBid1, { focus: [{ ring: (root) => discOf(root, sumatran(root)), arrow: true }] }),
    doIt("bid-up", { key: "bid.up", button: "+5" }, state((root, me) => discOf(root, me)?.bidLabel === "5"), { focus: [{ arrow: { ui: "button:+5" } }] }),
    doIt("bid-confirm", { key: "bid.confirm", button: "Bid 5" }, state((_root, me) => me.bank === 5), { focus: [{ arrow: { ui: "button:Bid 5" } }] }),
    // held where the order is laid out: the game runs on into phase 4 with nobody to wait for
    confirm("confirm-bid", upTo(newOrder)),
    narrate("new-order", {
      ...upTo(newOrder),
      focus: [{ ring: discs, arrow: true }, bankSpark],
    }),

    // =========================================================================== phase 3: no mergers yet
    narrate("no-mergers", { focus: [{ ring: rndRow("mergers"), arrow: true }] }),

    // =========================================================================== phase 4: companies
    narrate(
      "companies",
      beats("companies", [
        ["", [{ ring: (root) => root.market.deeds.copy(), reveal: true }]],
        ["round marker", [{ ring: (root) => root.board.startMarkers.copy(), separate: true }]],
      ]),
    ),
    narrate(
      "symbols",
      beats("symbols", [
        ["", [{ ring: printed(JB_SYMBOLS), arrow: true }]],
        ["A hut means", [{ ring: printed(JB_SYMBOLS), arrow: true }]],
      ]),
    ),
    narrate("slots", { focus: [{ ring: rndRow("slots"), arrow: true }] }),
    watch("others-sumatran-company", "p2", sumatranCompany, {
      ...beats("others-sumatran-company", [
        ["", [{ ring: marker(LAMPUNG), arrow: true }]],
        ["Its first ship", [{ ring: ships(LAMPUNG), arrow: true }]],
        ["Look at the Lampung deed", [{ ring: companyOf(LAMPUNG), arrow: true }]],
      ]),
    }),
    doIt("pick-company", { key: "acquire.deed", chit: marker(JB_RICE) }, checks.promptMessage(/plantation of/), {
      focus: [{ ring: marker(JB_RICE), arrow: true, dim: true }, { ring: deedOnOffer(JB_RICE) }],
    }),
    doIt("place-plantation", { key: "acquire.area", chit: land(PLANT_AREA) }, state((_root, me) => me.companies.length === 1), {
      focus: [{ ring: land(PLANT_AREA), arrow: true, dim: true }, { ring: ships(LAMPUNG) }],
    }),
    narrate(
      "plantation-placed",
      beats("plantation-placed", [
        ["", [{ ring: plantations(JB_RICE), arrow: true }]],
        ["deed has moved", [{ ring: yours, arrow: true }]],
      ]),
    ),
    confirm("confirm-company"),
    watch("others-sultan-company", "p1", sultanCompany, { focus: [{ ring: plantations(BALI_RICE), arrow: true }] }),

    // =========================================================================== phase 5: research
    narrate("research", { focus: [{ ring: (root) => root.tracks, arrow: true, reveal: true }] }),
    watch("others-sumatran-research", "p2", sumatranResearch, { focus: [{ ring: rndRow("slots"), arrow: true }] }),
    doIt("research-mergers", { key: "research.cell", chit: rndCell("mergers", 2) }, state((_root, me) => me.rnd.mergers === 2), {
      focus: [{ ring: rndCell("mergers", 2), arrow: true, dim: true }],
    }),
    confirm("confirm-research"),
    watch("others-sultan-research", "p1", sultanResearch, { focus: [{ ring: rndRow("slots"), arrow: true }] }),

    // =========================================================================== phase 6: operations
    narrate("operations", { focus: [{ ring: discs, arrow: true }] }),
    watch("others-sumatran-operate", "p2", sumatranOperated, {
      ...beats("others-sumatran-operate", [
        ["", [{ ring: ships(LAMPUNG), arrow: true }]],
        ["That's two", [{ ring: companyOf(LAMPUNG), arrow: true }]],
      ]),
    }),
    doIt("operate-rice", [{ key: "operate.piece", chit: (root) => plantations(JB_RICE)(root)[0] }, { key: "operate.company", chit: yours }], checks.promptMessage(/to a city/), {
      focus: [{ ring: plantations(JB_RICE), arrow: true, dim: true }],
    }),
    narrate(
      "selling",
      beats("selling", [
        ["", [{ ring: plantations(JB_RICE), arrow: true }]],
        ["chain of ships", [{ ring: ships(LAMPUNG), arrow: true }]],
        ["Here:", [{ ring: plantations(JB_RICE), arrow: true }, { ring: ships(LAMPUNG), separate: true }, { ring: yourCity }]],
      ]),
    ),
    doIt("sell", { key: "deliver.city", chit: yourCity }, state((root) => (yourCity(root)?.deliveredGoods().length ?? 0) === 1), { focus: [{ ring: yourCity, arrow: true, dim: true }] }),
    narrate(
      "display",
      beats("display", [
        ["", [{ ring: yourCity, arrow: true }]],
        ["landed on the card", [{ ring: yourDisplay, arrow: true }]],
      ]),
    ),
    narrate(
      "sold",
      beats("sold", [
        ["", [{ ring: capacityMarkers(LAMPUNG), arrow: true }]],
        ["Rice sells for 20", [earningsSpark]],
      ]),
    ),
    narrate("forced", { focus: [{ ring: ships(LAMPUNG), arrow: true }, earningsSpark] }),
    narrate(
      "free-expansion",
      beats("free-expansion", [
        ["", [{ ring: plantations(JB_RICE), arrow: true }]],
        ["How many", [{ ring: rndRow("expansion"), arrow: true }]],
      ]),
    ),
    doIt("expand", { key: "expand.area", chit: land(EXPAND_AREA) }, state((root) => plantations(JB_RICE)(root).length === 2), { focus: [{ ring: land(EXPAND_AREA), arrow: true, dim: true }] }),
    narrate("expanded", { focus: [{ ring: plantations(JB_RICE), arrow: true }] }),
    confirm("confirm-operate", { focus: [{ ring: yours, arrow: true }, { arrow: { ui: "button:Confirm" } }] }),
    watch("others-sultan-operate", "p1", sultanOperated, { focus: [{ ring: plantations(BALI_RICE), arrow: true }] }),

    // =========================================================================== phase 7: cities grow
    narrate("growth", { ...upTo(cityGrew), focus: [{ ring: yourCity, arrow: true }] }),

    // =========================================================================== YEAR 2
    narrate(
      "year-2",
      beats("year-2", [
        ["", [cashSpark]],
        ["An era ends", [{ ring: (root) => root.market.deeds.copy(), arrow: true }]],
      ]),
      ),
    // (the year's moment is held in the step before: phase 1 settles as soon as the year begins)
    watch("others-sumatran-bid-2", "p2", sumatranBid2, {
      ...beats("others-sumatran-bid-2", [
        ["", [{ ring: discs, arrow: true }]],
        ["multiplies bids", [{ ring: rndRow("bid"), arrow: true }]],
        ["The Sumatran bids nothing", [{ ring: (root) => discOf(root, sumatran(root)), arrow: true }]],
      ]),
    }),
    doIt("bid-2", { key: "bid.confirm", button: "Bid 0" }, ((ctx: Ctx) => hasButton(ctx, "Confirm")) as Checker<Player, Root>, { focus: [{ arrow: { ui: "button:Bid 0" } }] }),
    confirm("confirm-bid-2"),
    watch("others-sultan-bid-2", "p1", sultanBid2, { focus: [{ ring: discs, arrow: true }] }),
    narrate("mergers-now", { focus: [{ ring: rndCell("mergers", 2), arrow: true }] }),
    narrate("merger-why", { focus: [{ ring: (root) => [...plantations(JB_RICE)(root), ...plantations(BALI_RICE)(root)], separate: true, arrow: true }] }),
    // the merger is picked where the companies are: their plantations on the map
    doIt("announce", { key: "merger.first", chit: plantations(JB_RICE) }, checks.promptMessage(/with another company/), {
      focus: [{ ring: plantations(JB_RICE), arrow: true, dim: true }],
    }),
    doIt("announce-second", { key: "merger.second", chit: plantations(BALI_RICE) }, state((root) => root.market.merger.active), {
      focus: [{ ring: plantations(BALI_RICE), arrow: true, dim: true }],
    }),
    narrate("merger-table", { focus: [{ ring: (root) => root.market.merger, arrow: true, reveal: true }] }),
    narrate("payout", { focus: [{ ring: (root) => root.market.merger.rows.copy(), arrow: true }] }),
    doIt("open-bid", { key: "auction.bid", button: "Bid 60" }, state((root, me) => root.market.merger.highId === me.playerId), { focus: [{ arrow: { ui: "button:Bid 60" } }] }),
    confirm("confirm-open"),
    watch("others-sultan-raises", "p1", sultanRaised, { focus: [{ ring: (root) => root.market.merger.rows.copy(), arrow: true }] }),
    watch("others-sumatran-passes", "p2", sumatranPassed, { focus: [{ ring: (root) => root.market.merger.row(sumatran(root)), arrow: true }] }),
    doIt("raise", { key: "auction.bid", button: "Bid 66" }, state((root, me) => root.market.merger.highId === me.playerId && root.market.merger.bid === 66), {
      focus: [{ arrow: { ui: "button:Bid 66" } }, cashSpark],
    }),
    confirm("confirm-raise"),
    watch("others-sultan-passes", "p1", mergerDone, { focus: [{ ring: (root) => root.market.merger.rows.copy(), arrow: true }] }),
    narrate(
      "won",
      beats("won", [
        ["", [cashSpark]],
        ["Bali deed", [{ ring: yours, arrow: true }]],
        ["Bali plantation", [{ ring: plantations(JB_RICE), arrow: true }]],
      ]),
    ),
    narrate("merger-rules", { focus: [{ ring: yours, arrow: true }, cashSpark] }),

    // ---- year 2, phase 4: spice
    narrate("acquisitions-2", { focus: [{ ring: (root) => root.market.deeds.copy(), arrow: true }, { ring: rndRow("slots") }] }),
    watch("others-sumatran-spice", "p2", sumatranSpice, { focus: [{ ring: plantations(HALMAHERA_SPICE), arrow: true }] }),
    watch("others-sultan-spice", "p1", acquisitions2Done, { focus: [{ ring: plantations(MALUKU_SPICE), arrow: true }] }),
    narrate(
      "spice-now",
      beats("spice-now", [
        ["", [{ ring: (root) => [...plantations(HALMAHERA_SPICE)(root), ...plantations(MALUKU_SPICE)(root)], arrow: true }]],
        ["every city wants spice", [{ ring: allCities, separate: true, arrow: true }]],
      ]),
    ),

    // ---- year 2, phase 5: Hull, and Mergers again
    watch("others-sumatran-hull", "p2", sumatranHull, {
      ...beats("others-sumatran-hull", [
        ["", [{ ring: rndRow("hull"), arrow: true }]],
        ["each Sumatran ship", [{ ring: ships(LAMPUNG), arrow: true }]],
        ["another player's Hull", [{ ring: rndRow("hull"), arrow: true }]],
      ]),
    }),
    doIt("research-mergers-3", { key: "research.cell", chit: rndCell("mergers", 3) }, state((_root, me) => me.rnd.mergers === 3), {
      focus: [{ ring: rndCell("mergers", 3), arrow: true, dim: true }],
    }),
    confirm("confirm-research-2"),
    watch("others-sultan-research-2", "p1", sultanResearch2, { focus: [{ ring: rndRow("slots"), arrow: true }] }),

    // ---- year 2, phase 6: a full line, a two-ship sale, unsold rice, paid growth
    narrate("lampung-full", { ...upTo(lampungFull), focus: [{ ring: ships(LAMPUNG), arrow: true }, { ring: companyOf(LAMPUNG) }] }),
    watch("others-sumatran-spice-run", "p2", sumatranSpiceRan, { focus: [{ ring: plantations(HALMAHERA_SPICE), arrow: true }] }),
    doIt("operate-rice-2", [{ key: "operate.piece", chit: plantations(JB_RICE) }, { key: "operate.company", chit: yours }], checks.promptMessage(/to a city/), {
      focus: [{ ring: plantations(JB_RICE), arrow: true, dim: true }],
    }),
    narrate(
      "selling-2",
      beats("selling-2", [
        ["", [{ ring: plantations(JB_RICE), separate: true, arrow: true }]],
        ["Your city wants two", [{ ring: yourCity, arrow: true }]],
        ["Bali", [{ ring: yourGoodIn("Bali"), arrow: true }]],
        ["thanks to Hull", [{ ring: shipIn(LAMPUNG, JAVA_SEA), arrow: true }]],
      ]),
    ),
    doIt("sell-2", { key: "deliver.city", chit: yourCity }, state((root) => (yourCity(root)?.deliveredGoods().length ?? 0) === 1), { focus: [{ ring: yourCity, arrow: true, dim: true }] }),
    doIt("sell-rest", { key: "deliver.all", button: "Deliver" }, state((root) => (yourCity(root)?.deliveredGoods().length ?? 0) === 2), { focus: [{ arrow: { ui: "button:Deliver" } }] }),
    narrate(
      "sold-2",
      beats("sold-2", [
        ["", [{ ring: yourCity, arrow: true }, { ring: shipIn(LAMPUNG, JAVA_SEA) }]],
        ["one group", [{ ring: (root) => plantations(JB_RICE)(root).filter((g) => (g.parent as unknown as { province?: string })?.province === "Jawa Barat"), arrow: true }]],
        ["40 rupiah", [earningsSpark]],
        ["Bali rice", [{ ring: yourGoodIn("Bali"), arrow: true }]],
      ]),
    ),
    narrate("paid-expansion", { focus: [{ ring: (root) => root.board.expansionTargets(companyOf(JB_RICE)(root)!), separate: true }, { ring: rndRow("expansion"), arrow: true }, cashSpark] }),
    doIt("decline", { key: "expand.done", button: "Done" }, ((ctx: Ctx) => hasButton(ctx, "Confirm")) as Checker<Player, Root>, { focus: [{ arrow: { ui: "button:Done" } }] }),
    confirm("confirm-operate-2"),
    watch("others-sultan-pays", "p1", sultanPaid, { focus: [{ ring: plantations(MALUKU_SPICE), arrow: true }] }),
    narrate("growth-2", { ...upTo(growth2), focus: [{ ring: allCities, separate: true, arrow: true }] }),

    // =========================================================================== YEAR 3: era B
    narrate(
      "year-3",
      beats("year-3", [
        ["", [cashSpark]],
        ["only shipping lines", [{ ring: (root) => root.market.deeds.copy(), arrow: true }]],
      ]),
    ),
    watch("others-sumatran-city-b", "p2", sumatranCityB, {
      ...upTo(sumatranRevealedB),
      ...beats("others-sumatran-city-b", [
        ["", [{ ring: (root) => sumatran(root).cityHand.shown, arrow: true, reveal: true }]],
        ["Sumatera Utara", [{ ring: (root) => cityIn("Sumatera Utara")(root), arrow: true, reveal: true }], upTo(sumatranCityB)],
      ]),
    }),
    narrate("your-card-b", { ...upTo(yourRevealedB), focus: [{ ring: (_root, me) => me.cityHand.shown, arrow: true, reveal: true }] }),
    doIt("build-city-b", { key: "city.site", chit: land(LAMPUNG_CITY_AREA) }, state((root) => !!root.board.land(LAMPUNG_CITY_AREA).city), {
      focus: [{ ring: land(LAMPUNG_CITY_AREA), arrow: true, dim: true }, { ring: ships(LAMPUNG) }],
    }),
    confirm("confirm-city-b"),
    watch("others-sultan-city-b", "p1", sultanCityB, {
      ...upTo(sultanRevealedB),
      ...beats("others-sultan-city-b", [
        ["", [{ ring: (root) => sultan(root).cityHand.shown, arrow: true, reveal: true }]],
        ["in Maluku", [{ ring: (root) => cityIn("Maluku")(root), arrow: true, reveal: true }], upTo(sultanCityB)],
      ]),
    }),
    narrate("era-b-companies", {
      ...upTo(eraBOffer),
      ...beats("era-b-companies", [
        ["", [{ ring: (root) => root.market.deeds.copy(), arrow: true }]],
        ["Remember the symbols", [{ ring: printed(JB_SYMBOLS), arrow: true }]],
        ["Lampung line", [{ ring: companyOf(LAMPUNG), arrow: true }, { ring: printed(LAMPUNG_SYMBOLS) }]],
      ]),
    }),
    watch("others-sumatran-bid-3", "p2", sumatranBid3, { focus: [{ ring: discs, arrow: true }] }),
    doIt("bid-3", { key: "bid.confirm", button: "Bid 0" }, ((ctx: Ctx) => hasButton(ctx, "Confirm")) as Checker<Player, Root>, { focus: [{ arrow: { ui: "button:Bid 0" } }] }),
    confirm("confirm-bid-3"),
    watch("others-sultan-bid-3", "p1", sultanBid3, { focus: [{ ring: discs, arrow: true }] }),

    // ---- year 3, phase 3: siap saji
    narrate(
      "siap-saji",
      beats("siap-saji", [
        ["", [{ ring: (root) => [...plantations(JB_RICE)(root), ...plantations(HALMAHERA_SPICE)(root)], separate: true, arrow: true }]],
        ["three deeds", [{ ring: rndCell("mergers", 3), arrow: true }]],
      ]),
    ),
    narrate("siap-saji-how", { focus: [{ ring: (root) => [...plantations(JB_RICE)(root), ...plantations(HALMAHERA_SPICE)(root)], separate: true }] }),
    doIt("announce-ss", { key: "merger.first", chit: plantations(JB_RICE) }, checks.promptMessage(/with another company/), {
      focus: [{ ring: plantations(JB_RICE), arrow: true, dim: true }],
    }),
    doIt("announce-ss-second", { key: "merger.second", chit: plantations(HALMAHERA_SPICE) }, state((root) => root.market.merger.active), {
      focus: [{ ring: plantations(HALMAHERA_SPICE), arrow: true, dim: true }],
    }),
    narrate("ss-table", { focus: [{ ring: (root) => root.market.merger, arrow: true, reveal: true }] }),
    doIt("open-ss", { key: "auction.bid", button: "Bid 100" }, state((root, me) => root.market.merger.highId === me.playerId), { focus: [{ arrow: { ui: "button:Bid 100" } }] }),
    confirm("confirm-open-ss"),
    watchAll("others-pass-ss", othersPassedSS, { focus: [{ ring: (root) => root.market.merger.rows.copy(), arrow: true }] }),
    narrate("give-up-why", { focus: [{ ring: plantations(JB_RICE), separate: true, arrow: true }, cashSpark] }),
    doIt("give-up", { key: "siapsaji.remove", chit: yourGoodIn("Halmahera") }, state((root) => plantations(JB_RICE)(root).length === 3), {
      focus: [{ ring: yourGoodIn("Halmahera"), arrow: true, dim: true }],
    }),
    doIt("give-up-2", { key: "siapsaji.remove", chit: yourGoodIn("Bali") }, state((root) => plantations(JB_RICE)(root).length === 2), {
      focus: [{ ring: yourGoodIn("Bali"), arrow: true, dim: true }],
    }),
    // held where the siap saji is made: nothing waits for anyone between your Confirm and phase 4, so a board left
    // playing runs into the next phase before "siap-saji-made" can hold it (in some timings)
    confirm("confirm-give-up", upTo(siapSaji)),
    narrate("siap-saji-made", { ...upTo(siapSaji), focus: [{ ring: plantations(JB_RICE), arrow: true }] }),

    // ---- year 3, phase 4: rubber, and the rule that keeps same goods apart
    narrate("acquisitions-3", { focus: [{ ring: (root) => root.market.deeds.copy(), arrow: true }] }),
    watch("others-sumatran-rubber", "p2", sumatranRubber, { focus: [{ ring: plantations(SB_RUBBER), arrow: true }] }),
    watch("others-sultan-rubber", "p1", acquisitions3Done, {
      ...beats("others-sultan-rubber", [
        ["", [{ ring: plantations(RIAU_RUBBER), arrow: true }]],
        ["Look where it can't go", [{ ring: lands(RIAU_BLOCKED), separate: true, arrow: true }, { ring: plantations(SB_RUBBER) }]],
        ["tell whose", [{ ring: (root) => [...plantations(RIAU_RUBBER)(root), ...plantations(SB_RUBBER)(root)], separate: true, arrow: true }]],
      ]),
    }),

    // ---- year 3, phase 5: Expansion
    watch("others-sumatran-research-3", "p2", sumatranResearch3, { focus: [{ ring: rndRow("slots"), arrow: true }] }),
    doIt("research-expansion", { key: "research.cell", chit: rndCell("expansion", 2) }, state((_root, me) => me.rnd.expansion === 2), {
      focus: [{ ring: rndCell("expansion", 2), arrow: true, dim: true }],
    }),
    confirm("confirm-research-3"),
    watch("others-sultan-research-3", "p1", sultanResearch3, { focus: [{ ring: rndRow("slots"), arrow: true }] }),

    // ---- year 3, phase 6: siap saji sells out, and grows by two
    watch("others-sumatran-ship-3", "p2", lampungThird, {
      ...beats("others-sumatran-ship-3", [
        ["", [{ ring: ships(LAMPUNG), arrow: true }]],
        ["new limit", [{ ring: companyOf(LAMPUNG), arrow: true }]],
      ]),
    }),
    doIt("operate-ss", [{ key: "operate.piece", chit: plantations(JB_RICE) }, { key: "operate.company", chit: yours }], checks.promptMessage(/to a city/), {
      focus: [{ ring: plantations(JB_RICE), arrow: true, dim: true }],
    }),
    doIt("sell-ss", { key: "deliver.all", button: "Deliver" }, checks.promptMessage(/for free/), {
      ...beats("sell-ss", [
        ["", [{ ring: allCities, separate: true, arrow: true }]],
        ["Deliver", [{ arrow: { ui: "button:Deliver" } }]],
      ]),
    }),
    narrate("ss-sold", { focus: [earningsSpark, { ring: plantations(JB_RICE), arrow: true }, { ring: rndCell("expansion", 2) }] }),
    doIt("expand-ss", { key: "expand.area", chit: land(SS_EXPAND[0]) }, state((root) => plantations(JB_RICE)(root).length === 3), {
      focus: [{ ring: land(SS_EXPAND[0]), arrow: true, dim: true }],
    }),
    doIt("expand-ss-2", { key: "expand.area", chit: land(SS_EXPAND[1]) }, state((root) => plantations(JB_RICE)(root).length === 4), {
      focus: [{ ring: land(SS_EXPAND[1]), arrow: true, dim: true }],
    }),
    confirm("confirm-operate-3"),
    watchAll("others-run-3", growth3, { focus: [{ ring: (root) => [...plantations(MALUKU_SPICE)(root), ...plantations(RIAU_RUBBER)(root), ...plantations(SB_RUBBER)(root)], separate: true, arrow: true }] }),
    narrate("growth-3", { focus: [{ ring: allCities, separate: true, arrow: true }] }),

    // =========================================================================== the end of the game, and the close
    narrate(
      "ending",
      beats("ending", [
        ["", [{ ring: (root) => root.market.pile, arrow: true }]],
        ["doubled", [earningsSpark]],
        ["richest player", [cashSpark, bankSpark]],
      ]),
    ),
    narrate("finish", { box: { anchor: "center" }, focus: [{ ring: (root) => root.board }], end: "continue" }),
  ];
  for (const s of steps) {
    if (pins.steps[s.id]) s.rng = pins.steps[s.id];
    const ai = pins.ai[s.id];
    if (ai) s.ai = Object.fromEntries(Object.entries(ai).map(([id, moves]) => [id, forced(moves)]));
  }
  return defineTutorial<Player, Root>({
    id: "tutorial",
    locale: t.locale,
    title: t.title,
    intro: t.intro,
    match: {
      players: [{ name: t.you }, { name: "Sultan", ai: {} }, { name: "Sumatran", ai: {} }],
      // open money: the lesson shows everyone's money moving (secret money is the game's default)
      options: { money: "open" },
      // the seating shuffle (zeros keep the order), then the deal (TUTORIAL.md; scripts/tutorial/objectives.ts)
      rng: pins.setup.length ? pins.setup : [[0, 0, 0, 0, 0, 0]],
      ai: { seed: 7, thinkMs: 700 },
    },
    steps,
  });
}

export function buildTutorial(locale: string, pins: Pins): TutorialSpec<Player, Root> {
  void locale; // one locale so far
  return intro(en, pins);
}

export const tutorials: TutorialSpec<Player, Root>[] = [buildTutorial("en", pinsJson as Pins)];
