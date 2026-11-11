// Commands for the tutorial harness (run through scripts/tutorial/run.mjs):
//   trace  [--until step] [--seed n] [--pins file] [--log] [--frames] [--answers] [--step-timeout s] [--replay]   play the script, print the table at every step
//          (--frames: every moment your board showed, with its step and log line)
//   search --objective name [--from step] [--until step] [--n 100] [--out file]
//                                                     random runs; the best one's pins go to --out
//   cues                                              each step's sentences and where its highlights change
//   check  [--pins file] [--run-timeout s]                              play the whole script with the shipped pins; fail on
//                                                     any block, stall, warning or unused pin, and replay it
//                                                     with browser-like timings to prove it is deterministic
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runScript } from "./harness";
import { buildTutorial, chitAt, cueProblems, narrationProblems, Pins, uiGalleries } from "../../src/tutorial/script";
import { runTutorial } from "@pretty-chitty/core";
// ADAPT: the game
import Game from "../../src/Indonesia";
import { objectives } from "./objectives";

const args = process.argv.slice(2);
const cmd = args[0];
const opt = (name: string, d?: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : d;
};
const root = process.env.TUTORIAL_PROJECT_ROOT ?? process.cwd(); // set by run.mjs (this file runs from a bundle elsewhere)
const shippedPins = path.join(root, "src/tutorial/pins.json");
const pinsFile = opt("pins", shippedPins)!;
const loadPins = (file = pinsFile): Pins => {
  let p: Partial<Pins> = {};
  try {
    p = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    // no pins yet: everything random
  }
  return { setup: p.setup?.length ? p.setup : [[0, 0, 0, 0, 0, 0]], steps: p.steps ?? {}, ai: p.ai ?? {} };
};

// The engine and the bots are chatty; keep our own output.
const out = console.log.bind(console);
const quiet = () => {
  console.log = () => {};
  console.error = () => {};
  console.warn = () => {};
  console.info = () => {};
  console.debug = () => {};
};

// Nothing here may run forever: each run has its own watchdog (harness), and the command as a whole
// gives up after --timeout seconds (default: 5 minutes; a search, 20).
const totalSeconds = Number(opt("timeout", cmd === "search" ? "1200" : cmd === "check" ? "1500" : "300"));
// One run of the whole script (check): long scripts under the slow timings take minutes
const runSeconds = Number(opt("run-timeout", "300"));
setTimeout(() => {
  out(`\n${cmd} timed out after ${totalSeconds}s`);
  process.exit(124);
}, totalSeconds * 1000).unref();

async function main() {
  if (cmd === "trace") {
    const seed = Number(opt("seed", "1"));
    quiet();
    // --replay: the check's headless run (pins replayed, the bots waiting for their scripted steps, seed 99)
    const like = args.includes("--browser-like") ? { ...BROWSER_LIKE, recording: false } : args.includes("--fast-bots") ? { ...FAST_BOTS, recording: false } : args.includes("--replay") ? { recording: false, seed: 99 } : {};
    const stepTimeoutMs = opt("step-timeout") ? Number(opt("step-timeout")) * 1000 : undefined;
    // --reading N: cues on a reading clock of N words per second (the browser's is 3 without audio), so holds
    // land where a person would see them; the run then takes real time
    const reading = opt("reading") ? { readingSpeed: Number(opt("reading")), narrationMs: 50, satisfiedDelayMs: 200 } : {};
    const r = await runScript({ pins: loadPins(), until: opt("until"), seed, trace: false, stepTimeoutMs, runTimeoutMs: Math.max(90000, (stepTimeoutMs ?? 0) * 2), ...like, ...reading });
    for (const [i, id] of r.visited.entries()) out(`step ${i}: ${id}`);
    out(`\noutcome ${r.outcome}${r.stuckOn ? ` (stuck on ${r.stuckOn}: ${r.stuckDetail})` : ""}${r.error ? `\n${r.error}` : ""}`);
    for (const b of r.blocked) out(`BLOCKED ${b}`);
    for (const w of r.warnings) out(`WARN ${w}`);
    for (const id of (opt("show") ?? "").split(",").filter(Boolean)) out(`\n--- at ${id} ---\n${r.tables[id] ?? "(not reached)"}`);
    out(`\n--- at the end ---\n${r.table}`);
    if (args.includes("--log")) out(`\n--- log ---\n${r.log.join("\n")}`);
    if (args.includes("--answers")) out(`\n--- your answers ---\n${r.answers.map((x) => `${x.step.padEnd(24)} ${x.option.padEnd(22)} "${x.prompt}"`).join("\n")}`);
    if (args.includes("--frames")) {
      // Every moment your board showed, with the step on screen: where a \`timeline\` hold can stop
      out(`\n--- frames (clock, step, log) ---`);
      for (const f of r.frames) out(`${String(f.clock).padStart(4)}  ${(f.step ?? "").padEnd(24)} ${f.held ? "[held] " : ""}${f.log ?? ""}`);
    }
    out(`\ndraws: ${r.draws.length} (${r.draws.filter((d) => d.source === "random").length} unpinned)`);
    if (opt("freeze")) {
      writeFileSync(opt("freeze")!, JSON.stringify(r.frozen));
      out(`froze pins to ${opt("freeze")}`);
    }
    return;
  }
  if (cmd === "cues") {
    // Every step's sentences, with where its highlights change: a sentence that names something on the table and
    // shows no change is a highlight missing (one thing per sentence, one highlight per thing).
    quiet();
    const { splitSentences } = await import("@pretty-chitty/core");
    const describe = (f: any[] | undefined) =>
      (f ?? []).map((x) => [x.ring && "ring", x.arrow && "arrow", x.separate && "each"].filter(Boolean).join("+") || "?").join(", ") || "nothing";
    for (const st of buildTutorial("en", loadPins()).steps) {
      const sentences = splitSentences(st.text ?? "");
      const at = new Map<number, string>();
      at.set(0, describe(st.focus as any[]));
      for (const c of (st.cues ?? []) as any[]) {
        const n = typeof c.at === "object" && "sentence" in c.at ? c.at.sentence : -1;
        const what = [c.focus && describe(c.focus), c.gallery && "gallery", c.pose && "pose", c.timeline && "timeline"].filter(Boolean).join("; ");
        at.set(n, n >= 0 && at.has(n) && n > 0 ? `${at.get(n)} | ${what}` : what);
      }
      out(`${st.id}${st.waitFor ? " (do it)" : ""}`);
      sentences.forEach((x, i) => out(`  ${at.has(i) ? "●" : " "} ${x}${at.has(i) ? `   [${at.get(i)}]` : ""}`));
      const timed = [...at.keys()].filter((k) => k < 0).length;
      if (timed) out(`  (+${timed} cue(s) on spoken words)`);
    }
    return;
  }
  if (cmd === "chronicle") {
    // Every draw of the pinned script in the order it happened, tagged (for re-ordering a recording
    // after the script's step order changes), plus every bot move, in order, per bot.
    quiet();
    const r = await runScript({ pins: loadPins(), seed: 1, recording: false });
    if (r.outcome !== "completed") throw new Error(`${r.outcome} ${r.stuckOn ?? ""} ${r.stuckDetail ?? ""}`);
    const moves: { [bot: string]: unknown[] } = {};
    for (const [, byBot] of Object.entries(loadPins().ai)) for (const [bot, list] of Object.entries(byBot)) (moves[bot] ??= []).push(...list);
    writeFileSync(opt("out")!, JSON.stringify({ setup: loadPins().setup, draws: r.draws, moves, table: r.table }));
    out(`${r.draws.length} draws, final table recorded -> ${opt("out")}`);
    return;
  }
  if (cmd === "migrate") {
    // Re-record after the script's step order changed, keeping the game itself: the same draws and
    // the same bot moves, in the order the new script makes them. --from is a `chronicle` of the old
    // script. Within each simultaneous step your draws now come before the bots' (the bots play in
    // an "others" step after yours); every other draw keeps its place. The new run must end on the
    // same table as the old one.
    quiet();
    const old = JSON.parse(readFileSync(opt("from")!, "utf8"));
    const draws: { values: number[]; step: string; parallel?: string }[] = old.draws;
    const ordered: number[][] = [];
    for (let i = 0; i < draws.length; ) {
      if (draws[i].step === "setup") {
        i++;
        continue;
      }
      const key = draws[i].parallel;
      let j = i + 1;
      while (key && j < draws.length && draws[j].parallel === key) j++;
      const run = draws.slice(i, j);
      const bots = (d: { step: string }) => d.step.startsWith("others-");
      ordered.push(...run.filter((d) => !bots(d)).map((d) => d.values), ...run.filter(bots).map((d) => d.values));
      i = j;
    }
    // Every draw and move is queued up front (so nothing waits on a step), and the scripted moves the
    // steps declare are switched off: the recorded queue already holds them.
    const steps = buildTutorial("en", { setup: [], steps: {}, ai: {} }).steps;
    const ai: Pins["ai"] = Object.fromEntries(steps.filter((st) => st.ai).map((st) => [st.id, {}]));
    // Bots' Confirms are no longer scripted (the engine lets them through): drop any old ones
    const isConfirm = (m: any) => m.button?.toLowerCase() === "confirm";
    ai[steps[0].id] = Object.fromEntries(Object.entries(old.moves as Record<string, any[]>).map(([bot, list]) => [bot, list.filter((m) => !isConfirm(m))]));
    const pins: Pins = { setup: old.setup, steps: { [steps[0].id]: ordered }, ai };
    const r = await runScript({ pins, seed: 1, recording: true, runTimeoutMs: 180000 });
    out(`migrated run: ${r.outcome}${r.stuckOn ? ` on ${r.stuckOn}: ${r.stuckDetail}` : ""} ${r.blocked.join(" ")}`);
    if (r.outcome !== "completed") {
      out(`--- last frames ---\n${r.frames.slice(-12).map((f) => `${f.clock} ${f.step ?? ""} ${f.held ? "[held] " : ""}${f.log ?? ""}`).join("\n")}`);
      out(`--- last log ---\n${r.log.slice(-12).join("\n")}`);
    }
    const unused = ordered.length - r.draws.filter((d) => d.step !== "setup").length;
    out(`draws: ${r.draws.length} (${r.draws.filter((d) => d.source === "random").length} unpinned, ${unused} unused)`);
    const same = r.table === old.table;
    out(same ? "final table identical to the old script's" : `FINAL TABLE DIFFERS\n--- old ---\n${old.table}\n--- new ---\n${r.table}`);
    if (!same) out(`at the end: ${(r.endPrompts ?? []).join("; ")}`);
    if (r.outcome === "completed" && same) {
      writeFileSync(opt("out")!, JSON.stringify(r.frozen));
      out(`pins -> ${opt("out")}`);
    } else process.exitCode = 1;
    return;
  }
  if (cmd === "ids") {
    // The id of every chit the pins name by path, at the end of the script, to compare this build
    // with the game's webpack build (pins by id froze the bots in the browser; see PinnedMove)
    quiet();
    const pins = loadPins();
    const r = await runScript({ pins, seed: 1 });
    const paths = new Set<string>();
    for (const byBot of Object.values(pins.ai)) for (const list of Object.values(byBot)) for (const m of list) for (const p of [m.chit, m.target]) if (p) paths.add(p);
    out(JSON.stringify(Object.fromEntries([...paths].map((p) => [p, r.root ? (chitAt(r.root, p)?.id ?? null) : null])), null, 1));
    return;
  }
  if (cmd === "search") {
    // Play the script to --until N times, the pins of --from and every later step dropped (so
    // those draws and bot moves are random), score each run, and write the best one's pins.
    const name = opt("objective")!;
    const objective = objectives[name];
    if (!objective) throw new Error(`no objective "${name}" (have: ${Object.keys(objectives).join(", ")})`);
    const n = Number(opt("n", "100"));
    const base = dropFrom(loadPins(), opt("from"));
    const target = opt("out", path.join(root, "src/tutorial/pins.candidate.json"))!;
    quiet();
    let best: { score: number; seed: number; r: Awaited<ReturnType<typeof runScript>> } | undefined;
    const tally: { [k: string]: number } = {};
    for (let i = 0; i < n; i++) {
      const seed = Number(opt("seed", "1000")) + i;
      const prng = mulberry(seed * 7919);
      const pins = objective.prepare ? objective.prepare(base, prng) : base;
      const r = await runScript({ pins, until: opt("until"), seed, runTimeoutMs: 60000 });
      const score = r.warnings.length ? -Infinity : objective.score(r);
      const k = r.outcome === "completed" ? (Number.isFinite(score) ? "scored" : "rejected") : r.outcome;
      tally[k] = (tally[k] ?? 0) + 1;
      if (k === "rejected" && r.warnings.length && tally[k] <= 2) out(`  seed ${seed}: rejected for warnings: ${r.warnings.join(" | ")}`);
      if (r.outcome !== "completed" && tally[k] <= 2) out(`  seed ${seed}: ${r.outcome} ${r.stuckOn ?? ""} ${r.blocked.join(" ")} ${r.error ?? ""} ${r.warnings.join(" | ")}`);
      if (Number.isFinite(score) && (!best || score > best.score)) {
        best = { score, seed, r };
        out(`  seed ${seed}: score ${score}`);
      }
    }
    out(`${n} runs: ${Object.entries(tally).map(([k, v]) => `${v} ${k}`).join(", ")}`);
    if (!best) {
      process.exitCode = 1;
      return;
    }
    writeFileSync(target, JSON.stringify(best.r.frozen));
    out(`best: seed ${best.seed} score ${best.score} -> ${target}\n\n${best.r.table}`);
    return;
  }
  if (cmd === "check") {
    // The shipped script must play to the end with every draw and bot move pinned, and replay the
    // same under browser-like timings (slower bots, each seat at its own pace, a slow person).
    quiet();
    const pins = loadPins();
    const runs = [
      { label: "headless", opts: {} },
      { label: "browser-like", opts: BROWSER_LIKE },
      { label: "bots fast, person slow", opts: FAST_BOTS },
    ];
    // A narration that holds the board on a moment, straight after a step where the person acts with the board
    // playing live: their move can run the board past that moment before the hold applies, in some timings and not
    // others (the timing runs below catch it only now and then). The acting step needs the same hold. (A bot's step
    // is safe: the moves it holds on wait for the step. So is a step the person acts in: their own prompt waits.)
    const holdProblems: string[] = [];
    const steps = buildTutorial("en", pins).steps;
    const holds = (st: (typeof steps)[number]) => typeof st.timeline === "object" && st.timeline !== null && "until" in st.timeline;
    const acts = (st: (typeof steps)[number]) => (Array.isArray(st.allow) ? st.allow.length > 0 : st.allow !== undefined);
    steps.forEach((st, i) => {
      if (!holds(st) || st.allow !== undefined) return;
      for (let j = i - 1; j >= 0 && !holds(steps[j]); j--) {
        if (!acts(steps[j])) continue;
        holdProblems.push(`step "${st.id}" holds the board on a moment, but "${steps[j].id}" before it lets the person act with the board playing live: give "${steps[j].id}" the same hold (upTo)`);
        break;
      }
    });
    let failed = cueProblems.length + narrationProblems.length + holdProblems.length > 0;
    for (const c of cueProblems) out(`cue: ${c}`);
    for (const c of narrationProblems) out(`narration: ${c}`);
    for (const c of holdProblems) out(`hold: ${c}`);
    // What has to be the same in every timing: the board at each moment the narrator holds it on, and the
    // table at the end. (The game's own state at a step's start may differ: the bots run freely
    // within their steps, and their Confirms end a turn whenever they come.)
    let referenceHolds: Map<string, string> | undefined;
    let referenceTable: string | undefined;
    let referenceHeld: { [k: string]: string } | undefined;
    // A draw or bot move that lands a step later than recorded (a Confirm that came later, ending the
    // turn later) is only a note: the pinned draws are handed out in order, so the game is the same.
    const drift = (w: string) => /was declared by step .* but (consumed|used) during/.test(w);
    for (const { label, opts } of runs) {
      const r = await runScript({ pins, seed: 99, stepTimeoutMs: 20000, runTimeoutMs: runSeconds * 1000, recording: false, ...opts });
      // A random draw before the script's last pinned one is a hole in the pins. After it, the bots are playing on past
      // the script (end: "continue": nothing holds a bot with no scripted move left), which is theirs to draw.
      const lastPinned = r.draws.map((d) => d.source !== "random").lastIndexOf(true);
      const unpinned = r.draws.filter((d, i) => d.source === "random" && i < lastPinned).length;
      // The moment each step rests on (the last it held). A run with no time for narration fires a
      // step's beats at once, so it may skip a hold or move on before one: compare the steps both held.
      const last = new Map<string, string>();
      for (const f of r.fingerprints) last.set(f.step, f.hash);
      const differs = referenceHolds ? [...last].find(([step, h]) => referenceHolds!.has(step) && referenceHolds!.get(step) !== h)?.[0] : undefined;
      const problems = [
        r.outcome !== "completed" && `${r.outcome}${r.stuckOn ? ` on ${r.stuckOn}` : ""}${r.stuckDetail ? ` (${r.stuckDetail})` : ""}${r.error ? `: ${r.error}` : ""}`,
        ...r.blocked.map((b) => `blocked: ${b}`),
        ...r.warnings.filter((w) => !drift(w)).map((w) => `warning: ${w}`),
        unpinned > 0 && `${unpinned} unpinned draw(s)`,
        differs && `the board differs from the headless run at ${differs}`,
        referenceTable !== undefined && r.table !== referenceTable && "the final table differs from the headless run",
      ].filter(Boolean);
      if (differs) {
        const a = (referenceHeld?.[differs] ?? "").split("\n"), b = (r.heldTables?.[differs] ?? "").split("\n");
        for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) out(`    ${differs}: headless "${a[i] ?? ""}"\n    ${" ".repeat(differs.length)}  this run "${b[i] ?? ""}"`);
      }
      if (referenceTable !== undefined && r.table !== referenceTable) {
        // say which lines, or the fix is a guess
        const a = referenceTable.split("\n"), b = r.table.split("\n");
        for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) out(`    end: headless "${a[i] ?? ""}"\n         this run "${b[i] ?? ""}"`);
      }
      if (referenceTable !== undefined && r.table !== referenceTable) {
        // which lines of the final table differ, and what the person was being asked (the end is a race if the
        // bots play on behind the last step without a hold)
        const a = referenceTable.split("\n"), b = r.table.split("\n");
        for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) out(`    end: headless "${a[i] ?? ""}"\n         this run "${b[i] ?? ""}"`);
        out(`    at the end: ${(r.endPrompts ?? []).join("; ")}; last frames: ${r.frames.slice(-3).map((fr) => `${fr.clock}${fr.held ? "[held]" : ""}`).join(" ")}`);
      }
      referenceHolds ??= last;
      referenceTable ??= r.table;
      referenceHeld ??= r.heldTables;
      out(`${label}: ${problems.length ? "FAIL" : "ok"} (${r.visited.length} steps)`);
      for (const p of problems) out(`  - ${p}`);
      failed ||= problems.length > 0;
    }
    // And the engine's own test runner, as the tutorial guide asks (its stand-in follows `allow` too)
    const engine = await runTutorial(new Game() as any, buildTutorial("en", pins) as any, {
      stepTimeoutMs: 20000,
      ui: (step: any, ui: any) => {
        const list = step.allow === undefined ? [] : Array.isArray(step.allow) ? step.allow : [step.allow];
        for (const a of list) if (a !== "any" && a.ui && uiGalleries[a.ui]) ui.gallery(uiGalleries[a.ui]);
      },
    } as any);
    const engineProblems = [
      engine.outcome !== "completed" && `${engine.outcome}${engine.stuckOn ? ` on ${engine.stuckOn}` : ""}${engine.error ? `: ${engine.error}` : ""}`,
      ...engine.warnings.filter((w: string) => !drift(w)).map((w: string) => `warning: ${w}`),
      engine.rngRemaining > 0 && `${engine.rngRemaining} pinned draw(s) never used`,
    ].filter(Boolean);
    out(`engine runTutorial: ${engineProblems.length ? "FAIL" : "ok"} (${engine.visited.length} steps)`);
    for (const p of engineProblems) out(`  - ${p}`);
    failed ||= engineProblems.length > 0;
    process.exitCode = failed ? 1 : 0;
    return;
  }
  out(`unknown command ${cmd}`);
  process.exitCode = 2;
}

/** Pins with `from` and every later step's draws and bot moves removed. */
function dropFrom(pins: Pins, from?: string): Pins {
  if (!from) return pins;
  const ids = buildTutorial("en", pins).steps.map((s) => s.id);
  const at = ids.indexOf(from);
  if (at < 0) throw new Error(`no step "${from}"`);
  const later = new Set(ids.slice(at));
  const keep = <T>(o: { [k: string]: T }) => Object.fromEntries(Object.entries(o).filter(([k]) => !later.has(k)));
  return { setup: from === ids[0] ? [] : pins.setup, steps: keep(pins.steps), ai: keep(pins.ai) };
}

/** The bots answering at once and the person slowly (a draw or a bot's Confirm landing in a different step) */
const FAST_BOTS = { thinkMs: { p1: 1, p2: 3 }, humanMs: 60, satisfiedDelayMs: 10, narrationMs: 5, readingSpeed: 200 };
/** Timings like a browser's, scaled down: bots at their own pace, a person who takes a moment */
const BROWSER_LIKE = { thinkMs: { p1: 40, p2: 65 }, humanMs: 25, satisfiedDelayMs: 30, narrationMs: 20, readingSpeed: 60 };

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

main().then(
  () => process.exit(process.exitCode ?? 0),
  (e) => {
    out(e?.stack ?? e);
    process.exit(1);
  },
);
