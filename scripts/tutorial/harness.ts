// Headless driver for the tutorial (src/tutorial). Bundled with esbuild by scripts/tutorial/run.mjs
// so the game, the tutorial and the engine share one copy of @pretty-chitty/core.
//
// It plays the tutorial like the engine's `runTutorial` — a stand-in for the person answers only
// while a "do it" step is waiting, only with moves its `allow` accepts, and taps the gallery buttons
// a step asks for (`uiGalleries` in the script) — with these differences:
//  - the person plays the first option the step's `allow` list accepts (entries in order), and a
//    prompt that `allow` would block (the guard would drop every option) is reported and stops the run;
//  - every random draw and every bot decision is recorded with the step it landed in, so a run can
//    be frozen into pins (src/tutorial/pins.json) that replay it exactly, whatever the timing;
//  - while recording, every draw the bots make inside one simultaneous step (an "others" step, where
//    they play at once) gets the same value, so the order in which they happen to draw cannot change
//    what anyone gets. Your own draws come after theirs, with the bots holding, so they stay random.
// ADAPT: the game, its Root and Player. Nothing else in this file is game-specific.
import Game from "../../src/Indonesia";
import { buildTutorial, chitPath, Pins, PinnedMove, steer, stepActors, uiGalleries } from "../../src/tutorial/script";
import { connectAiPlayer, createDemoMatch, TutorialController } from "@pretty-chitty/core";
import type { TutorialSpec, TutorialStep } from "@pretty-chitty/core";
import { PickPrompt } from "../../node_modules/@pretty-chitty/core/dist/game/Prompt.js";
import { Turn } from "../../node_modules/@pretty-chitty/core/dist/game/Turn.js";
import { samePasses } from "../../node_modules/@pretty-chitty/core/dist/game/ClockDetails.js";
import { isAllowed, shapeOfAiOption } from "../../node_modules/@pretty-chitty/core/dist/game/tutorial/allowed.js";
import { selectChits } from "../../node_modules/@pretty-chitty/core/dist/game/tutorial/defineTutorial.js";
import type { Root } from "../../src/chits/Root";
import type { Player } from "../../src/chits/Player";
import { describeTable } from "./describe";

export type RunOptions = {
  pins?: Pins;
  /** Stop after this step completes (the spec is cut there). Default: the whole script */
  until?: string;
  /** Seed for the draws the pins do not cover */
  seed?: number;
  /** Bot think time per seat (fixed values, so the bots' own random stream does not depend on them). Default 5 */
  thinkMs?: number | { [playerId: string]: number };
  /** How long the person takes to answer. Default 0 */
  humanMs?: number;
  /** The controller's pause between a passed check and the next step (the browser uses 900). Default 0 */
  satisfiedDelayMs?: number;
  /** How long a narration step lasts (the browser: its audio). Default 0 */
  narrationMs?: number;
  /** Words per second of the controller's reading clock, which a passed "do it" step waits out.
   *  Default: infinite (no wait); the browser reads at 3 or plays the audio. */
  readingSpeed?: number;
  /** Print the table at the start of every step */
  trace?: boolean | ((step: string, table: string) => void);
  /** Give up on a step after this long. Default 8000 */
  stepTimeoutMs?: number;
  /** Give up on the whole run after this long (a hang anywhere, not just in a step). Default 90000 */
  runTimeoutMs?: number;
  /**
   * Recording (default): a bot whose next scripted move belongs to a later step plays freely until
   * then, and everything it does is recorded. Off, the bots behave exactly as in the browser: they
   * wait for the step that scripts their next move (`check` replays this way).
   */
  recording?: boolean;
};

/** One moment the person's board showed: its clock, the step on screen, and its log line if any. */
export type Frame = { clock: number; step?: string; log?: string; held?: boolean };

export type RunResult = {
  outcome: "completed" | "stuck" | "blocked" | "error" | "timeout";
  /** Every moment the person's board showed, in order */
  frames: Frame[];
  /** Who was being asked what when the run ended */
  endPrompts?: string[];
  /** The person's board at each held moment (by "step@held") */
  heldTables?: { [stepAtHeld: string]: string };
  visited: string[];
  stuckOn?: string;
  /** Who was being asked what when it got stuck */
  stuckDetail?: string;
  error?: string;
  /** Prompts the person could not have answered (the browser's guard drops every option) */
  blocked: string[];
  warnings: string[];
  /** Draws as they happened, with the step that was live and the simultaneous step they were made in */
  draws: { step: string; values: number[]; source: string; parallel?: string }[];
  /** Pins that reproduce this run */
  frozen: Pins;
  root?: Root;
  me?: Player;
  /** A text picture of the table at the end, as the person's board shows it */
  table: string;
  /** For each step entered, a fingerprint of the table (replays must match it) */
  fingerprints: { step: string; hash: string }[];
  /** The table as each step was entered */
  tables: { [step: string]: string };
  /** The game log, as you see it */
  log: string[];
  /** Every prompt the person answered: the step, the prompt, the option taken */
  answers: { step: string; prompt: string; option: string }[];
};

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function waitUntil(pred: () => boolean, timeoutMs: number): Promise<boolean> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    if (pred()) return true;
    await sleep(2);
  }
  return pred();
}

// One value per simultaneous step. Keyed by the turn and its decision index when the step began,
// which a rerun of the same turn reproduces.
let parallelKey: string | undefined;
let parallelSalt = 0;
/** Ids of the steps in which the bots play (allow: []), and the step now live. */
let othersSteps = new Set<string>();
let liveStep = () => "";
let patched = false;
function patchParallelTurns() {
  if (patched) return;
  patched = true;
  const proto = (Turn as any).prototype;
  const original = proto.runParallelTurns;
  proto.runParallelTurns = async function (this: any, ...args: unknown[]) {
    const outer = parallelKey;
    parallelKey = `${this.id}@${this.decisionIndex}`;
    try {
      return await original.apply(this, args);
    } finally {
      parallelKey = outer;
    }
  };
}

export async function runScript(opts: RunOptions = {}): Promise<RunResult> {
  patchParallelTurns();
  const realRandom = Math.random;
  const seed = opts.seed ?? 1;
  const prng = mulberry32(seed);
  parallelSalt = seed;
  Math.random = () =>
    parallelKey !== undefined && othersSteps.has(liveStep()) ? mulberry32(hash(`${parallelSalt}:${parallelKey}:${liveStep()}`))() : prng();
  const limit = opts.runTimeoutMs ?? 90000;
  const progress: { step?: string } = {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  const watchdog = new Promise<RunResult>((resolve) => {
    timer = setTimeout(
      () =>
        resolve({
          outcome: "timeout",
          frames: [],
          visited: [],
          stuckOn: progress.step,
          stuckDetail: `the run did not finish within ${limit / 1000}s (last step entered: ${progress.step ?? "none"})`,
          blocked: [],
          warnings: [],
          draws: [],
          frozen: { setup: [], steps: {}, ai: {} },
          table: "(timed out)",
          fingerprints: [],
          tables: {},
          log: [],
          answers: [],
        }),
      limit,
    );
  });
  try {
    return await Promise.race([run(opts, progress), watchdog]);
  } finally {
    clearTimeout(timer);
    Math.random = realRandom;
  }
}

async function run(opts: RunOptions, progress: { step?: string }): Promise<RunResult> {
  const full = buildTutorial("en", opts.pins ?? { setup: [], steps: {}, ai: {} });
  const cut = opts.until ? full.steps.findIndex((s) => s.id === opts.until) : -1;
  if (opts.until && cut < 0) throw new Error(`no step "${opts.until}"`);
  const spec: TutorialSpec<Player, Root> = cut >= 0 ? { ...full, steps: full.steps.slice(0, cut + 1) } : full;

  const game = new Game();
  const demo = await createDemoMatch<Player, Root>(game as any, spec, { immediateNotify: true, ai: { thinkMs: 5, log: false } });
  const { match, playerId, runtime } = demo;
  // Which simultaneous step (if any) each draw happened in, for re-ordering a recording (cli `migrate`)
  const drawKeys: (string | undefined)[] = [];
  runtime.rngLog.on((log: unknown[]) => {
    while (drawKeys.length < log.length) drawKeys.push(parallelKey);
  }, false);
  othersSteps = new Set(spec.steps.filter((s) => s.waitFor && Array.isArray(s.allow) && s.allow.length === 0).map((s) => s.id));
  liveStep = () => runtime.activeStep.value;

  const recording = opts.recording ?? true;
  // A bot a step does not name as an actor waits (its Confirms excepted, as the engine lets them through)
  const confirmOnly = (prompt: any) => {
    const picks: any[] = prompt?.details?.picks ?? [];
    return picks.length > 0 && picks.every((k) => k.type === "ButtonPick" && k.details?.__buttonType === "Confirm");
  };
  // (the script pauses no bot: replays hold them by the step of their next scripted move, so
  // recording keeps every move in a step that is about the bots: an "others" step, or the bot's own)
  const gatedOut = (bot: string, prompt?: unknown) => {
    if (confirmOnly(prompt)) return false;
    const step = runtime.activeStep.value;
    const actors = stepActors[step];
    return actors ? !actors.includes(bot) : !othersSteps.has(step);
  };
  // Re-seat the bots: same options as createDemoMatch, plus per-seat think time and a decision log.
  const decisions: { step: string; playerId: string; move: PinnedMove }[] = [];
  for (const b of demo.bots) b.dispose();
  const bots = demo.players
    .filter((p) => p.ai)
    .map((p) => {
      const base = runtime.aiOptionsFor(p.id);
      // While recording, the bots think a little (30 ms): long enough that a step whose check has just
      // passed moves on (and holds them) before they answer the next prompt, so each move is recorded
      // in the step it belongs to. Replays hold them by step anyway (`hold`), so speed is free there.
      const fallback = recording ? 30 : 5;
      const think = typeof opts.thinkMs === "object" ? (opts.thinkMs[p.id] ?? fallback) : (opts.thinkMs ?? fallback);
      return connectAiPlayer(match, p.id, {
        temperature: 0,
        ...(spec.match?.ai ?? {}),
        thinkMs: think,
        log: false,
        ...base, // choose (forced moves), hold (wait for the step that scripts the next move)
        // While recording, a step that names its actors (`stepActors`) holds every other bot, so each
        // bot's moves land in its own step; replays hold them the same way, by the step of their next
        // scripted move.
        hold: recording ? (prompt) => gatedOut(p.id, prompt) : base.hold,
        // The engine's own Confirm is answered at once (index 0, so the bot's random stream is never
        // touched) and not scripted: the engine lets a bot's Confirm through whatever step is on screen.
        choose: (scored, ctx) => {
          const onlyConfirms = scored.every((o: any) => o.option.kind === "button" && o.option.pick?.buttonType === "Confirm");
          // Looked at again once it has thought: the step may have moved on meanwhile
          if (recording && !onlyConfirms && gatedOut(p.id)) return null;
          // While recording, a free choice is steered by the script (`steer`): the bots play their own game
          // except where the lesson needs them not to; the steered moves are then frozen into the pins.
          const steered = () => {
            if (!recording || onlyConfirms) return undefined;
            const step = runtime.activeStep.value;
            const adjusted = scored.map((o: any) => {
              const v = steer({ step, bot: p.id, option: o.option, view: ctx.view as Root, me: ctx.me as Player });
              if (v === Number.NEGATIVE_INFINITY) return v;
              // a positive steer overrides the bot's own veto: an option its rules never pick (a pass it scores
              // -Infinity) may be just what the lesson needs, and -Infinity plus anything is still -Infinity
              return Number.isFinite(o.score) ? o.score + v : v > 0 ? v : o.score;
            });
            let best = -1;
            adjusted.forEach((v, i) => {
              if (v > Number.NEGATIVE_INFINITY && (best < 0 || v > adjusted[best])) best = i;
            });
            return best < 0 ? undefined : best; // every option vetoed: the bot's own choice (an objective can reject the run)
          };
          if (recording && runtime.waitingForStep(p.id)) return onlyConfirms ? 0 : steered(); // free until its scripted step
          const forced = base.choose?.(scored, ctx);
          return forced === undefined ? (onlyConfirms ? 0 : steered()) : forced;
        },
        onDecision: (d) => {
          base.onDecision?.(d);
          if (d.scored.every((o: any) => o.option.kind === "button" && o.option.pick?.buttonType === "Confirm")) return;
          const option = d.scored[d.chosen].option as any;
          const shape = shapeOfAiOption(option);
          const move: PinnedMove = { key: shape.key ?? "" };
          // By path, not id (see PinnedMove): taken in the bot's own view, where it will be replayed
          if (option.chit) move.chit = chitPath(option.chit);
          if (option.target) move.target = chitPath(option.target);
          if (shape.buttonLabel) move.button = shape.buttonLabel;
          decisions.push({ step: runtime.activeStep.value, playerId: p.id, move });
        },
      });
    });
  runtime.attachBots(bots);

  // The match's own state, for the tables and fingerprints
  const rootOf = () => match.turn.value?.rootChit as Root | undefined;
  const meOf = () => rootOf()?.players.find((p) => p.id === playerId) as Player | undefined;
  // What the person sees, for every check, cue and selector — as the browser has it. In a
  // simultaneous step a player cannot see the others' moves until their own part is finished, so a
  // step that waits on something they cannot see must fail here as it would in front of them.
  const eyes = () => (human?.prompts as any)?.view as { root?: Root; sync(clock?: number): Promise<void> } | undefined;
  const seenRoot = () => eyes()?.root as Root | undefined;
  const seenMe = () => seenRoot()?.players.find((p) => p.id === playerId) as Player | undefined;
  const visited: string[] = [];
  // The person's board plays the game one moment (clock) at a time, as the browser does, up to the
  // latest the seat may see or the tutorial's hold (`timeline`), whichever is lower. Their prompt only
  // shows once the board has caught up (ClientPrompts inflates it at the latest clock only).
  let shown = 0;
  let hold: number | undefined;
  let seenMax: any = { clock: 0, pass: -1 };
  const frames: Frame[] = [];
  const maxClock = () => ((eyes() as any)?.maxClock?.clock ?? 0) as number;
  const playable = () => Math.min(hold ?? Number.POSITIVE_INFINITY, maxClock());
  const caughtUp = () => shown >= maxClock();
  // A prompt appears once the board has caught up, and then stays until it is answered, as in the browser
  let inflated: unknown;
  const promptShown = (prompt: unknown) => {
    if (prompt && prompt === inflated) return true;
    if (!prompt || !caughtUp()) return false;
    inflated = prompt;
    return true;
  };
  // The log line the server sends with the moment on screen (the browser's active log line)
  let shownLog: string | undefined;
  let loadMoment: (clock: number) => Promise<void> = async () => {};
  let pumping: Promise<void> = Promise.resolve();
  const pump = () =>
    (pumping = pumping.then(async () => {
      const v = eyes() as any;
      if (!v) return;
      // As ClientTime.newMaxClock: a board behind steps one moment on; one already caught up that
      // learns of a new pass (history rewritten, e.g. zipped) reloads the latest moment, even if it
      // is lower than the shown one (zipping folds moments together).
      let newPass = !samePasses(seenMax, v.maxClock);
      seenMax = v.maxClock;
      for (;;) {
        if (shown < playable()) shown++;
        else if (newPass) shown = playable();
        else break;
        newPass = false;
        await loadMoment(shown);
        frames.push({ clock: shown, step: controller?.step?.id, log: shownLog });
        if (process.env.TUTORIAL_DEBUG_FRAMES) frames[frames.length - 1].log = `[hold ${hold}] ${shownLog ?? ""}`;
        uiListeners.forEach((l) => l());
      }
      recordHeld();
      human?.prompts.recheck();
    }).catch((e) => {
      // the run may end (and the connection close) mid-load, so errors are expected here; but a view that cannot
      // load at all (a chit type missing from the library) looks like a stall: TUTORIAL_DEBUG_LOAD=1 prints them
      if (process.env.TUTORIAL_DEBUG_LOAD) process.stderr.write(`LOAD FAILED ${e?.stack ?? e}\n`);
    }));
  const blocked: string[] = [];
  const answers: RunResult["answers"] = [];
  const fingerprints: RunResult["fingerprints"] = [];
  const heldTables: { [stepAtHeld: string]: string } = {};
  /** A moment the board is held on: what the person looks at while the narrator explains it, so it must be the
   *  same in every timing (see `fingerprints`). Called as frames load, and once more before Finish is pressed: the
   *  last hold can land on the same tick the run completes, before the frame loop has seen it. */
  const heldLoaded = () => hold !== undefined && shown >= hold && frames.length > 0 && frames[frames.length - 1].clock === shown;
  const recordHeld = () => {
    // `shown` moves before its moment has loaded (the frame is pushed after the load): record only a loaded one
    if (!heldLoaded() || frames[frames.length - 1].held) return;
    const r = seenRoot(), me = seenMe();
    if (!r || !me) return; // mid-load: a later call records it
    frames[frames.length - 1].held = true;
    const t = describeTable(r, me);
    fingerprints.push({ step: `${controller?.step?.id}@held`, hash: hash(t).toString(16) });
    heldTables[`${controller?.step?.id}@held`] = t;
    if (process.env.TUTORIAL_DEBUG_HELD) process.stderr.write(`  held: ${controller?.step?.id} @ ${shown} (hold ${hold})\n`);
  };
  const tables: RunResult["tables"] = {};
  let error: string | undefined;

  // Galleries, as the browser would have them open (the engine's runTutorial simulates them the same way)
  let galleries: { mode: "inline" | "fullscreen"; of?: string; chitIds: string[] }[] = [];
  let uiListeners: (() => void)[] = [];
  const simulateGallery = (command: any): boolean => {
    if (command === "close") {
      galleries = [];
      return false;
    }
    const root = seenRoot(), me = seenMe();
    let state: (typeof galleries)[number] | undefined;
    let opened = false;
    if (command.of) {
      const container = selectChits(command.of, root, me)[0] as any;
      if (container) {
        state = { mode: "inline", of: container.id, chitIds: container.children.map((c: any) => c.id ?? "") };
        opened = true;
      }
    } else if (command.items) {
      const chits = selectChits(command.items, root, me);
      if (chits.length) {
        state = { mode: "inline", chitIds: chits.map((c: any) => c.id ?? "") };
        opened = true;
      }
    } else if (galleries[0]) state = { ...galleries[0] };
    if (!state) return false;
    if (command.mode === "fullscreen" || command.mode === "inline") state.mode = command.mode;
    galleries = [state];
    return opened;
  };

  const view = {
    root: seenRoot,
    me: seenMe,
    prompt: () => {
      const prompt = meOf()?.promptStatus.latestPrompt.value;
      return prompt instanceof PickPrompt && promptShown(prompt) ? prompt : undefined;
    },
    clock: () => shown,
    find: (id: string) => {
      let found: any;
      (seenRoot() as any)?.walk((c: any) => {
        if (c.id === id) found = c;
        return !found;
      });
      return found;
    },
    latestLog: () => shownLog,
    timeline: {
      at: () => shown,
      hold: (clock: number | undefined) => {
        if (process.env.TUTORIAL_DEBUG_FRAMES) frames.push({ clock: shown, step: controller?.step?.id, log: `>> hold ${clock} (max ${maxClock()})` });
        hold = clock;
        void pump();
      },
    },
    live: () => true,
    onChange: (cb: () => void) => {
      uiListeners.push(cb);
      // The person's view moves when the server tells this seat it may see a later moment (see
      // the newMaxClock hook below); prompts change with the match itself.
      const unsub = match.onChange(cb, false);
      return () => {
        unsub();
        uiListeners = uiListeners.filter((l) => l !== cb);
      };
    },
    galleries: () => galleries,
    setGallery: (command: any) => {
      const opened = simulateGallery(command);
      uiListeners.forEach((l) => l());
      return opened;
    },
  };

  const allowList = (step?: TutorialStep<Player, Root>) => {
    const a = step?.allow;
    return a === undefined ? [] : Array.isArray(a) ? a : [a];
  };
  let finished = false;
  let pendingBlock: { step?: string; msg: string; since: number } | undefined;
  let human: ReturnType<typeof connectAiPlayer> | undefined;
  const controller: TutorialController<Player, Root> = new TutorialController<Player, Root>({
    spec,
    view: view as any,
    runtime,
    ai: match.ai,
    satisfiedDelayMs: opts.satisfiedDelayMs ?? 0,
    readingSpeed: opts.readingSpeed ?? Number.POSITIVE_INFINITY,
    onEvent: (e: any) => {
      if (e.type === "step") {
        visited.push(e.stepId);
        progress.step = e.stepId;
        const step = controller.step as TutorialStep<Player, Root> | undefined;
        // The person taps the gallery buttons the step asks for
        for (const a of allowList(step)) {
          const command = a !== "any" && a.ui ? uiGalleries[a.ui as string] : undefined;
          if (command) setTimeout(() => view.setGallery(command), opts.humanMs ?? 0);
        }
        const r = rootOf(), me = meOf();
        if (r && me) {
          const t = describeTable(r, me);
          tables[e.stepId] = t;
          if (typeof opts.trace === "function") opts.trace(e.stepId, t);
          else if (opts.trace) console.log(`\n=== step ${e.stepId} ===\n${t}`);
        }
      }
      if (e.type === "completed" || e.type === "skipped") finished = true;
      human?.prompts.recheck();
    },
  });

  if (process.env.TUTORIAL_DEBUG_FRAMES) {
    const c = controller as any;
    const apply = c.applyTimeline.bind(c);
    c.applyTimeline = (command: any) => {
      frames.push({ clock: shown, step: controller.step?.id, log: `>> timeline ${typeof command === "string" ? command : Object.keys(command)[0]}` });
      return apply(command);
    };
  }

  // The person: while a "do it" step waits, the first option its `allow` accepts (entries in order).
  // null leaves the prompt for later (the stand-in looks again at every step change).
  let relisted = "";
  const policy = (options: any[], message: string | undefined, root: Root | undefined, me: Player | undefined): number | null => {
    const step = controller.step as TutorialStep<Player, Root> | undefined;
    if (!step?.waitFor || controller.status.value !== "waiting") return null;
    if (!promptShown(meOf()?.promptStatus.latestPrompt.value)) return null; // not on their board yet
    const list = allowList(step);
    if (list.every((a) => a !== "any" && !!a.ui)) return null; // waiting for the bots or a UI control
    for (const entry of list) {
      const i = options.findIndex((o) => isAllowed(entry as any, shapeOfAiOption(o), root, me));
      if (i >= 0) {
        const sh = shapeOfAiOption(options[i]);
        answers.push({ step: step.id, prompt: message ?? "", option: `${sh.key ?? ""}${sh.buttonLabel ? `[${sh.buttonLabel}]` : ""}` });
        return i;
      }
    }
    const what = options.map((o) => {
      const sh = shapeOfAiOption(o);
      return `${sh.key ?? "?"}${sh.buttonLabel ? `[${sh.buttonLabel}]` : sh.chitId ? ` ${sh.chitId}` : ""}`;
    });
    // Not necessarily blocked yet: the view may be a beat behind and the step about to move on.
    // It is blocked if the step is still the same a moment later (see the main loop).
    const msg = `step "${step?.id}": "${message ?? ""}" has no allowed option among: ${what.join(", ")}`;
    if (!pendingBlock || pendingBlock.step !== step?.id) pendingBlock = { step: step?.id, msg, since: Date.now() };
    // The options may be from a moment the board has since left (it moved on while the stand-in thought, and that
    // recheck came before this prompt was held): look once more at the moment it shows now
    if (relisted !== `${message}@${shown}`) {
      relisted = `${message}@${shown}`;
      setTimeout(() => human?.prompts.recheck(), 10);
    }
    return null;
  };
  human = connectAiPlayer(match, playerId, {
    view: "serialized", // the seat's own view (see `eyes`)
    thinkMs: Math.max(5, opts.humanMs ?? 0), // a person never answers before the tutorial has seen the prompt
    log: false,
    temperature: 0,
    choose: (scored, ctx) => policy(scored.map((s) => s.option), ctx.prompt?.message, ctx.view as Root, ctx.me as Player) as any,
  });
  // Follow the server like a client: each time it says this seat may see a later moment, load it.
  {
    const v = eyes() as any;
    // (the view's server handle is a Proxy, so wrap it rather than patch it)
    const server = v.serverTime;
    v.serverTime = {
      serializeDelta: async (clock: number) => {
        const response = await server.serializeDelta(clock);
        shownLog = response?.log?.message;
        return response;
      },
    };
    // Only the board's playback moves the view: the stand-in's own AI reloads it to the latest moment
    // when it looks at a prompt, which would show the checks a moment the board has not reached
    const sync = v.sync.bind(v);
    // The stand-in listed its options when the prompt arrived, from the moment the board showed then; once the
    // board reaches a later moment (chits created just before the prompt), it has to look again
    loadMoment = async (clock: number) => {
      await sync(clock);
      human?.prompts.recheck();
    };
    v.sync = () => sync(shown);
    const original = v.newMaxClock.bind(v);
    v.newMaxClock = async (clock: unknown) => {
      await original(clock);
      await pump();
    };
  }
  // The stand-in for the person is not a bot: keep `pauseAi` from switching it.
  (match.ai as any).unregister(human);
  human.prompts.setEnabled(true);

  const started = match.start().catch((e: unknown) => {
    error = e instanceof Error ? `${e.message}\n${e.stack}` : String(e);
  });
  await waitUntil(() => !!rootOf() || !!error, 5000);
  await waitUntil(() => !!error || !!match.errorState.value || !!rootOf()?.players.some((p) => !!p.promptStatus.latestPrompt.value), 10000);
  await pump();
  controller.start();

  const stepTimeout = opts.stepTimeoutMs ?? 8000;
  let stuckOn: string | undefined;
  let stuckDetail: string | undefined;
  while (!finished && !error && !match.errorState.value && blocked.length === 0) {
    const index = controller.index.value;
    const step = controller.step;
    if (!step) break;
    if (!step.waitFor) {
      await waitUntil(() => controller.status.value === "narrating" || finished, 1000);
      if (opts.narrationMs) await sleep(opts.narrationMs);
      if (controller.index.value === index && !finished) {
        // Next on a narration step comes after its narration: time an `until` still pending needs to land (the
        // browser's goodbye takes seconds; here it is instant, and Finish clears a pending hold for good). Then,
        // since Finish releases the hold and the end table is the held one, let the held moment finish loading.
        await waitUntil(() => !(controller as any).timelineUntil || finished, 5000);
        if (hold !== undefined) await waitUntil(() => heldLoaded() || hold === undefined, 3000);
        recordHeld();
        controller.next();
      }
      continue;
    }
    const moved = await waitUntil(() => {
      if (pendingBlock && pendingBlock.step === step.id && Date.now() - pendingBlock.since > 1500 && !blocked.includes(pendingBlock.msg)) blocked.push(pendingBlock.msg);
      return controller.index.value !== index || finished || !!error || blocked.length > 0;
    }, stepTimeout);
    if (!moved) {
      stuckOn = step.id;
      const r = rootOf();
      const pending = r?.players.map((p: any) => {
        const pr = p.promptStatus.latestPrompt.value;
        const held = p.id === playerId ? "" : ` hold=${runtime.waitingForStep(p.id)}`;
        return `${p.name}: ${pr ? `"${pr.message ?? ""}"` : "no prompt"}${held}`;
      });
      // The simultaneous step in progress, as this seat sees it: whose parts, finished or not, how long
      const steps = (match.turn.value as any)?.clockSteps ?? [];
      const sub = [...steps].reverse().find((st: any) => Array.isArray(st.turns));
      const parts = sub
        ? sub.turns.map((t: any) => `${t.player?.id}${t.completed ? " done" : ""} ${t.playerVisibleClockTime?.(playerId)}`).join(", ")
        : "none";
      stuckDetail = `${pending?.join("; ")}; ai.enabled=${match.ai.enabled}; check=${JSON.stringify(controller.check.value)}; parts: ${parts}; shown ${shown}/${maxClock()} hold ${hold} (controller ${controller.timelineHold.value}, until pending ${!!(controller as any).timelineUntil})`;
      break;
    }
  }
  // Let the bots' last Confirms land (the script never waits on them), so the final table is settled
  const confirming = () =>
    rootOf()?.players.some((pl: any) => {
      const pr = pl.id !== playerId ? pl.promptStatus.latestPrompt.value : undefined;
      return /^confirm /.test(pr?.message ?? ""); // "confirm turn end", "confirm draw or roll"
    }) ?? false;
  if (finished) await waitUntil(() => !confirming(), 2000);
  // Who is still being asked what, for a run that ends somewhere unexpected
  const endPrompts = (rootOf()?.players ?? []).map((pl: any) => {
    const pr = pl.promptStatus.latestPrompt.value;
    return `${pl.name}: ${pr ? `"${pr.message}"` : "no prompt"}${pl.id === playerId ? "" : ` hold=${runtime.waitingForStep(pl.id)}`}`;
  });
  await sleep(5);

  const frozen: Pins = { setup: [], steps: {}, ai: {} };
  for (const d of runtime.rngLog.value as any[]) {
    if (d.activeStep === "setup") frozen.setup.push(d.values);
    else (frozen.steps[d.activeStep] ??= []).push(d.values);
  }
  for (const d of decisions) ((frozen.ai[d.step] ??= {})[d.playerId] ??= []).push(d.move);
  const draws = runtime.rngLog.value.map((d: any, i: number) => ({ step: d.activeStep, values: d.values, source: d.source, parallel: drawKeys[i] }));
  const r = rootOf(), me = meOf();
  // The table at the end as the person sees it: the last step (end: "continue") lets the bots play on behind it,
  // so the match itself is wherever their timing got to; what the person's board shows (held, if the step holds it)
  // is what every timing must agree on.
  // The last held moment is the one the person was shown; the view may have caught up with the bots since (a
  // board that learns of a rewritten history reloads the latest moment), so read it from the hold, not the view
  const sr = seenRoot(), sm = seenMe();
  const lastHeld = Object.keys(heldTables).slice(-1)[0];
  if (process.env.TUTORIAL_DEBUG_HELD) process.stderr.write(`held tables, in order: ${Object.keys(heldTables).join(" ")}; end: ${lastHeld}; shown ${shown}, hold ${hold}\n`);
  const table = lastHeld ? heldTables[lastHeld] : sr && sm ? describeTable(sr, sm) : r && me ? describeTable(r, me) : "(no table)";
  const log = (match.turn.value?.gameLog(playerId) ?? []).map((l: any) => String(l.message));
  controller.dispose();
  human.dispose();
  for (const b of bots) b.dispose();
  match.dispose();
  void started;

  const outcome: RunResult["outcome"] = error || match.errorState.value ? "error" : blocked.length ? "blocked" : stuckOn ? "stuck" : "completed";
  return { outcome, endPrompts, heldTables, frames, visited, stuckOn, stuckDetail, error: error ?? (match.errorState.value as any), blocked, warnings: runtime.warnings.value, draws, frozen, root: r, me, table, fingerprints, tables, log, answers };
}
