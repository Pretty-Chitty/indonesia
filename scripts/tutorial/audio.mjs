#!/usr/bin/env node
// Renders the tutorial narration (src/tutorial/strings.<locale>.json) to MP3, one file per step,
// with the start time of every sentence (`sentenceTimes`, for the cues and the emphasis).
//
//   node scripts/tutorial/audio.mjs                 # every locale; only steps whose text or voice changed
//   node scripts/tutorial/audio.mjs --all           # re-render everything
//   node scripts/tutorial/audio.mjs --only welcome  # just these steps
//   node scripts/tutorial/audio.mjs --dry-run       # list what would be rendered (and the characters billed)
//   node scripts/tutorial/audio.mjs --say           # draft with macOS `say` (the strings file's `draft` voice) instead of its narrator
//   node scripts/tutorial/audio.mjs --preview       # print what would be read aloud
//   node scripts/tutorial/audio.mjs --retrim 0.1,0.2 # trim each file's silence to 0.1 s before and 0.2 s after (free)
//   node scripts/tutorial/audio.mjs --realign       # re-time the Voicebox clips by forced alignment, without rendering (free)
//   node scripts/tutorial/audio.mjs --all --whole [--seam step]  # the whole script as one take (new take at --seam or every
//                                                    --chunk chars, each chained to the last), cut per step
//
// The narrator is the strings file's `narrator`:
//   { "provider": "elevenlabs", "voiceId": "...", "model": "...", "speed": 1.1, ... }  one request per
//     step with character timestamps, so the step reads as one take and each sentence's start comes
//     from the alignment. The key is ELEVEN_LABS in .env (see narration.mjs). Pick the voice first
//     with voices.mjs.
//   { "provider": "say", "voice": "Samantha", "rate": 205, "gap": 0.2 }  macOS text-to-speech, sentence by sentence
//     (free, for drafting).
//   { "provider": "voicebox", "engine": "kokoro", "voice": "am_michael", "gap": 0.3, "tempo": 1.05 }  a local
//     Voicebox server (voicebox.sh; VOICEBOX_URL, default http://127.0.0.1:17493), a take per step: free,
//     offline, fast with Kokoro. `profile` names an existing Voicebox profile (a cloned voice) instead of a preset.
//     Voicebox's "autoplay on generate" setting plays every clip aloud; turn it off first. Its sentence and word
//     times come from scripts/tutorial/align.py (WhisperX, in ~/.venvs/whisperx or $WHISPERX_PYTHON).
// Output: src/tutorial/audio/<locale>/<step>.mp3, audio/manifest.json (what each file was made from,
// and its timings) and audio/index.ts (imports + timings, generated). Needs ffmpeg/ffprobe on PATH.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { elevenLabsKey, splitSentences, spoken } from "./narration.mjs";

const here = path.dirname(new URL(import.meta.url).pathname);
const dir = path.resolve(here, "../../src/tutorial");
const audioDir = path.join(dir, "audio");
const args = process.argv.slice(2);
const all = args.includes("--all");
const dryRun = args.includes("--dry-run");
const useSay = args.includes("--say");
const onlyAt = args.indexOf("--only");
const only = onlyAt >= 0 ? new Set(args[onlyAt + 1].split(",")) : undefined; // e.g. --only welcome,liftoff

const locales = readdirSync(dir)
  .filter((f) => /^strings\.[a-z-]+\.json$/i.test(f))
  .map((f) => JSON.parse(readFileSync(path.join(dir, f), "utf8")));
// The strings file's `pronounce` respells words for the voice only ({ "mainline": "main line" }); the text on
// screen stays as written. Whole words, with their plural or possessive ("mainlines", "mainline's"), and a
// capital kept. A changed rule re-renders just the steps it touches (the hash is of what is read aloud).
const respell = (strings, s) => {
  for (const [from, to] of Object.entries(strings.pronounce ?? {}))
    s = s.replace(new RegExp(`\\b${from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=(?:s|'s|’s)?\\b)`, "gi"), (m) => (m[0] === m[0].toUpperCase() ? to[0].toUpperCase() + to.slice(1) : to));
  return s;
};
const sentencesOf = (strings, text) => splitSentences(text).map((s) => respell(strings, spoken(s, strings.spoken ?? {})));

if (args.includes("--preview")) {
  for (const st of locales) for (const [step, text] of Object.entries(st.steps)) console.log(`${step}:\n  ${sentencesOf(st, text).join("\n  ")}`);
  process.exit(0);
}

const probe = (file) =>
  parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { timeout: 30000 }).toString());
const round = (t) => Math.round(t * 1000) / 1000;

// ------------------------------------------------------------------------------------ narrators ---

/** macOS `say`, one sentence at a time, joined with a short gap: the timings are the clip lengths. */
async function renderSay(narrator, sentences, mp3) {
  const GAP = narrator.gap ?? 0.2; // a measured narrator wants longer pauses (the strings' draft `gap`)
  const tmp = mkdtempSync(path.join(tmpdir(), "narration-"));
  try {
    const clips = [];
    const times = [];
    let t = 0;
    sentences.forEach((sentence, i) => {
      times.push(round(t));
      if (!sentence) return; // an image-only "sentence" takes no time
      const clip = path.join(tmp, `${i}.aiff`);
      execFileSync("say", ["-v", narrator.voice ?? "Samantha", "-r", String(narrator.rate ?? 205), "-o", clip, sentence], { timeout: 60000 });
      clips.push(clip);
      t += probe(clip) + GAP;
    });
    const gap = path.join(tmp, "gap.aiff");
    execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=22050:cl=mono", "-t", String(GAP), gap], { timeout: 60000 });
    const list = path.join(tmp, "list.txt");
    writeFileSync(list, clips.map((c) => `file '${c}'\nfile '${gap}'`).join("\n") + "\n");
    execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", list, "-ar", "22050", "-ac", "1", "-codec:a", "libmp3lame", "-b:a", "48k", mp3], { timeout: 120000 });
    return { times };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/**
 * Voicebox (voicebox.sh), a local TTS server: free, offline, no key. The step as one take, its silence trimmed
 * and `gap` after it; each sentence starts at the pause that ends the one before. The voice is a
 * preset (`engine` + `voice`, its profile found or made here) or an existing profile by name (`profile`).
 * Kokoro rendered 10 s of speech in 2 s with no word slips; the cloning engines (Chatterbox Turbo, TADA,
 * LuxTTS) sounded livelier but doubled words ("Fast? Safe? Safe? Pretty?") or ran through the pauses.
 */
const VOICEBOX = process.env.VOICEBOX_URL ?? "http://127.0.0.1:17493";
const voiceboxProfiles = new Map();
async function voiceboxJson(route, init) {
  let res;
  try {
    res = await fetch(`${VOICEBOX}${route}`, { ...init, signal: AbortSignal.timeout(300000) });
  } catch (e) {
    throw new Error(`Voicebox is not reachable at ${VOICEBOX} (is the app open?): ${e.message}`);
  }
  const body = await res.text();
  if (!res.ok) throw new Error(`Voicebox ${route} ${res.status}: ${body.slice(0, 300)}`);
  return JSON.parse(body);
}
function voiceboxProfile(narrator) {
  const key = narrator.profile ?? `${narrator.engine}/${narrator.voice}`;
  if (!voiceboxProfiles.has(key)) {
    voiceboxProfiles.set(key, (async () => {
      const profiles = await voiceboxJson("/profiles");
      const found = narrator.profile
        ? profiles.find((p) => p.id === narrator.profile || p.name.toLowerCase() === narrator.profile.toLowerCase())
        : profiles.find((p) => p.voice_type === "preset" && p.preset_engine === narrator.engine && p.preset_voice_id === narrator.voice);
      if (found) return found.id;
      if (narrator.profile) throw new Error(`no Voicebox profile "${narrator.profile}"`);
      const made = await voiceboxJson("/profiles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: `${narrator.voice} (${narrator.engine})`, language: narrator.language ?? "en", voice_type: "preset", preset_engine: narrator.engine, preset_voice_id: narrator.voice, default_engine: narrator.engine }),
      });
      return made.id;
    })());
  }
  return voiceboxProfiles.get(key);
}
/**
 * Voicebox returns no timings, and matching pauses to where the sentences' lengths put them picked the wrong pause
 * whenever the voice's pace varied: the highlight moved at the end of a different sentence (FCM's am_santa,
 * 2026-11-08). So each clip is force-aligned to its own text (align.py: WhisperX's wav2vec2 model, never its
 * transcriber), in one batch so the model loads once. Without the aligner the pause times stand.
 */
const ALIGNER = process.env.WHISPERX_PYTHON ?? path.join(homedir(), ".venvs/whisperx/bin/python");
function alignClips(clips) {
  if (!clips.length) return;
  if (!existsSync(ALIGNER)) {
    console.log(`no aligner at ${ALIGNER}: sentence times stay on the pauses (see align.py)`);
    return;
  }
  const tmp = mkdtempSync(path.join(tmpdir(), "align-"));
  try {
    const input = path.join(tmp, "in.json"), output = path.join(tmp, "out.json");
    writeFileSync(input, JSON.stringify(clips.map((c) => ({ audio: c.mp3, sentences: c.sentences }))));
    console.log(`aligning ${clips.length} clip(s)…`);
    execFileSync(ALIGNER, [path.join(here, "align.py"), input, output], { stdio: ["ignore", "ignore", "pipe"], timeout: 3600000 });
    JSON.parse(readFileSync(output, "utf8")).forEach((r, i) => {
      const c = clips[i];
      if (r.error) return console.log(`  ${c.label}: not aligned, its pause times stand (${r.error})`);
      c.info.sentenceTimes = r.times;
      c.info.words = r.words;
    });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

async function renderVoicebox(narrator, sentences, mp3) {
  const GAP = narrator.gap ?? 0.3; // silence after the step (Kokoro's own pauses between sentences run about 0.3 s)
  const RATE = 24000;
  const profile_id = await voiceboxProfile(narrator);
  // The whole step in one request. Read alone, a sentence loses its phrasing ("Nobody knows yet what a horseless
  // carriage should be." became "Nobody knows. Yet what…?") and a word or two is mangled ("Fast? Safe? Pretty?"
  // was heard as "Vast, Zaef, Priti"); with the sentences around it, it reads as one take
  const said = sentences.map((s, k) => [s, k]).filter(([s]) => s); // an image-only "sentence" takes no time
  const tmp = mkdtempSync(path.join(tmpdir(), "narration-"));
  try {
    let gen = await voiceboxJson("/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        profile_id,
        // Kokoro reads a letter "A" as the article ("the A side" was heard as "the side"); quoted, it says the
        // letter. Mid-sentence a capital A is always the letter, the article being lowercase there; at a sentence's
        // start only "A is" is ("A is the structure" was read "uh is the structure"; quoted there it became "Oh, is
        // the structure?", and a dash after it reads right)
        text: said.map(([s]) => s.replace(/(\S\s)A(?![\w'’])/g, '$1"A"').replace(/^A(?= is\b)/, "A —")).join(" "),
        language: narrator.language ?? "en",
        engine: narrator.engine,
        seed: narrator.seed ?? 1755,
        ...(narrator.modelSize ? { model_size: narrator.modelSize } : {}),
      }),
    });
    while (!["completed", "failed", "error"].includes(gen.status)) {
      await new Promise((r) => setTimeout(r, 200));
      gen = await voiceboxJson(`/history/${gen.id}`);
    }
    if (gen.status !== "completed") throw new Error(`Voicebox: ${gen.error ?? gen.status}`);
    const raw = path.join(tmp, "raw.wav");
    const res = await fetch(`${VOICEBOX}/audio/${gen.id}`, { signal: AbortSignal.timeout(60000) });
    writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
    // Trim the take's own lead-in and tail; `tempo` speeds it up, pitch kept
    const trim = "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.02";
    const clip = path.join(tmp, "take.wav");
    const filter = [trim, "areverse", trim, "areverse", ...(narrator.tempo ? [`atempo=${narrator.tempo}`] : [])].join(",");
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", raw, "-af", filter, "-ar", String(RATE), "-ac", "1", "-c:a", "pcm_s16le", clip], { timeout: 60000 });
    const length = probe(clip);

    // Each sentence starts at the end of a pause. Where it should fall is estimated from the sentences' lengths;
    // the pauses are matched to those estimates in order, preferring long pauses (a sentence's end) over short
    // ones (a comma's)
    const out = (() => { try { return execFileSync("sh", ["-c", `ffmpeg -hide_banner -i "${clip}" -af silencedetect=noise=-45dB:d=0.08 -f null - 2>&1`], { timeout: 60000 }).toString(); } catch (e) { return String(e.stdout ?? ""); } })();
    const pauses = [...out.matchAll(/silence_end: ([\d.]+) \| silence_duration: ([\d.]+)/g)].map((m) => ({ end: Number(m[1]), length: Number(m[2]) }));
    const chars = said.map(([s]) => s.length + 1), total = chars.reduce((a, b) => a + b, 0);
    const expected = chars.slice(0, -1).map((_, j) => (chars.slice(0, j + 1).reduce((a, b) => a + b, 0) / total) * length);
    const n = expected.length, m = pauses.length;
    const times = sentences.map(() => -1);
    if (said.length) times[said[0][1]] = 0;
    if (n && m >= n) {
      const cost = (j, p) => Math.abs(pauses[p].end - expected[j]) - 4 * pauses[p].length;
      const best = Array.from({ length: n }, () => Array(m).fill(Infinity)), from = Array.from({ length: n }, () => Array(m).fill(-1));
      for (let p = 0; p < m; p++) best[0][p] = cost(0, p);
      for (let j = 1; j < n; j++)
        for (let p = j; p < m; p++)
          for (let q = j - 1; q < p; q++)
            if (best[j - 1][q] + cost(j, p) < best[j][p]) (best[j][p] = best[j - 1][q] + cost(j, p)), (from[j][p] = q);
      let p = best[n - 1].indexOf(Math.min(...best[n - 1]));
      for (let j = n - 1; j >= 0; j--) (times[said[j + 1][1]] = round(Math.max(0, pauses[p].end - 0.03))), (p = from[j][p]);
    } else expected.forEach((e, j) => (times[said[j + 1][1]] = round(e))); // too few pauses: by length alone
    // An image-only "sentence" starts where the next one does
    for (let k = times.length - 1; k >= 0; k--) if (times[k] < 0) times[k] = k + 1 < times.length ? times[k + 1] : round(length);
    times[0] = 0;
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", clip, "-af", `apad=pad_dur=${GAP}`, "-ar", String(RATE), "-ac", "1", "-codec:a", "libmp3lame", "-b:a", "64k", mp3], { timeout: 120000 });
    return { times };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/**
 * ElevenLabs, the whole step in one request (one take, natural flow between sentences), with
 * character timestamps: each sentence starts where its first character is spoken.
 */
async function renderElevenLabs(narrator, sentences, mp3, context = {}) {
  const key = elevenLabsKey();
  // Where each sentence starts in the text sent
  const starts = [];
  let text = "";
  for (const s of sentences) {
    if (text && s) text += " ";
    starts.push(s ? text.length : -1);
    text += s;
  }
  const body = JSON.stringify({
    text,
    model_id: narrator.model ?? "eleven_multilingual_v2",
    // Each step is its own request, so the voice is generated afresh every time: the neighbouring steps' text keeps
    // the read continuous, and a fixed seed keeps it repeatable (one request per step sounded like a different
    // take each time: "some are far away sounding, some are erratic")
    ...(context.previous ? { previous_text: context.previous } : {}),
    ...(context.next ? { next_text: context.next } : {}),
    seed: narrator.seed ?? 1755,
    voice_settings: {
      stability: narrator.stability ?? 0.7,
      similarity_boost: narrator.similarityBoost ?? 0.75,
      style: narrator.style ?? 0.1,
      use_speaker_boost: true,
      speed: narrator.speed ?? 1.0,
    },
  });
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${narrator.voiceId}/with-timestamps?output_format=${narrator.format ?? "mp3_44100_64"}`;
  let json;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json" },
      body,
      signal: AbortSignal.timeout(120000),
    });
    if (res.ok) {
      json = await res.json();
      break;
    }
    const detail = (await res.text()).slice(0, 300);
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      console.log(`  (ElevenLabs ${res.status}, retrying: ${detail.slice(0, 120)})`); // visible, so limits are noticed
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt)); // busy or rate-limited: back off
      continue;
    }
    throw new Error(`ElevenLabs ${res.status}: ${detail}`);
  }
  writeFileSync(mp3, Buffer.from(json.audio_base64, "base64"));
  const a = json.alignment;
  const at = (i) => {
    if (a.characters.length === text.length) return a.character_start_times_seconds[i];
    // The alignment should mirror the text sent; if it ever does not, find the sentence by its words
    const j = a.characters.join("").indexOf(text.slice(i, i + 24));
    return j >= 0 ? a.character_start_times_seconds[j] : 0;
  };
  const times = starts.map((i) => (i >= 0 ? round(at(i)) : -1));
  // An empty "sentence" (image only) starts where the next one does
  for (let i = times.length - 1; i >= 0; i--) if (times[i] < 0) times[i] = i + 1 < times.length ? times[i + 1] : round(probe(mp3));
  times[0] = 0;
  // When each word starts, for cues on a word inside a sentence ("Launch, Advertise, Upgrade, …")
  const words = [];
  const chars = a.characters;
  for (let i = 0; i < chars.length; i++) {
    if (/\s/.test(chars[i]) || (i > 0 && !/\s/.test(chars[i - 1]))) continue;
    let j = i;
    while (j < chars.length && !/\s/.test(chars[j])) j++;
    const word = chars.slice(i, j).join("").replace(/[^\p{L}\p{N}'-]/gu, "");
    if (word) words.push([word, round(a.character_start_times_seconds[i])]);
  }
  return { times, words };
}

// ---------------------------------------------------------------------------------------- render ---

const manifestFile = path.join(audioDir, "manifest.json");
const manifest = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, "utf8")) : {};
const jobs = [];
for (const strings of locales) {
  // --say drafts in the strings file's `draft` voice (a say voice that suits the narrator), else the default
  const narrator = useSay ? { ...(strings.draft ?? {}), provider: "say" } : (strings.narrator ?? { provider: "say" });
  const { locale } = strings;
  const outDir = path.join(audioDir, locale);
  mkdirSync(outDir, { recursive: true });
  const known = (manifest[locale] ??= {});
  const stepTexts = Object.entries(strings.steps).map(([, t]) => sentencesOf(strings, t).join(" "));
  for (const [index, [step, text]] of Object.entries(strings.steps).entries()) {
    const sentences = sentencesOf(strings, text);
    const context = { previous: stepTexts[index - 1], next: stepTexts[index + 1] };
    const hash = createHash("sha1").update(`${JSON.stringify(narrator)}\n${sentences.join("\n")}`).digest("hex").slice(0, 12);
    const mp3 = path.join(outDir, `${step}.mp3`);
    if (only && !only.has(step)) continue;
    if (!all && known[step]?.hash === hash && existsSync(mp3)) continue;
    jobs.push({ locale, step, sentences, hash, mp3, narrator, known, context });
  }
  // Steps no longer in the strings file: forget them and delete their files
  for (const step of Object.keys(known)) {
    if (step in strings.steps) continue;
    delete known[step];
    if (!dryRun && existsSync(path.join(outDir, `${step}.mp3`))) unlinkSync(path.join(outDir, `${step}.mp3`));
  }
}

const chars = jobs.reduce((n, j) => n + j.sentences.join(" ").length, 0);
console.log(`${jobs.length} step(s) to render, ${chars} characters${dryRun ? " (dry run)" : ""}`);
if (dryRun) {
  for (const j of jobs) console.log(`  ${j.locale}/${j.step} (${j.narrator.provider})`);
  process.exit(0);
}

// --retrim LEAD,TAIL: trim every rendered file's silence to LEAD seconds before the first word and TAIL after the
// last, shifting its timings to match (free: no request). The pauses that keep a whole take's cuts clean leave
// too much air between steps once each file also starts and ends with them.
if (args.includes("--retrim")) {
  const [lead, tail] = (args[args.indexOf("--retrim") + 1] ?? "0.1,0.2").split(",").map(Number);
  for (const strings of locales) {
    const { locale } = strings;
    const n = strings.narrator ?? {};
    const kbps = Number(/_(\d+)$/.exec(n.format ?? "")?.[1] ?? 128);
    for (const [step, info] of Object.entries(manifest[locale] ?? {})) {
      const mp3 = path.join(audioDir, locale, `${step}.mp3`);
      if (!existsSync(mp3)) continue;
      const dur = probe(mp3);
      const out = (() => { try { return execFileSync("sh", ["-c", `ffmpeg -hide_banner -i "${mp3}" -af silencedetect=noise=-45dB:d=0.05 -f null - 2>&1`], { timeout: 60000 }).toString(); } catch (e) { return String(e.stdout ?? ""); } })();
      const starts = [...out.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1]));
      const ends = [...out.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
      const speechFrom = starts[0] !== undefined && starts[0] < 0.02 && ends[0] !== undefined ? ends[0] : 0;
      // The speech ends with the sound that holds the last word. A later sound is kept only if it is a consonant's
      // tail (under 0.1 s, within 0.25 s); anything else is the take running on at the cut — a stray syllable at
      // the break, the next step's first sound — heard as "a gibberish word at the end" (Lisboa, 2026-10-31).
      const sounds = [];
      let at = speechFrom;
      starts.forEach((s, i) => { if (s > at + 0.01) sounds.push([at, s]); at = ends[i] ?? dur; });
      if (at < dur - 0.01) sounds.push([at, dur]);
      const lastWord = info.words?.length ? info.words[info.words.length - 1][1] : 0;
      let k = sounds.findIndex(([a, b]) => lastWord >= a - 0.05 && lastWord < b);
      if (k < 0) k = sounds.length - 1;
      while (k + 1 < sounds.length && sounds[k + 1][0] - sounds[k][1] < 0.25 && sounds[k + 1][1] - sounds[k + 1][0] < 0.1) k++;
      const lastStart = k >= 0 ? sounds[k][1] : dur;
      const from = Math.max(0, speechFrom - lead), to = Math.min(dur, lastStart + tail);
      if (from < 0.01 && to > dur - 0.01) continue;
      const tmpFile = mp3.replace(/\.mp3$/, ".trim.mp3");
      execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(from), "-to", String(to), "-i", mp3, "-ar", "44100", "-ac", "1", "-codec:a", "libmp3lame", "-b:a", `${kbps}k`, tmpFile], { timeout: 120000 });
      execFileSync("mv", [tmpFile, mp3]);
      info.sentenceTimes = info.sentenceTimes.map((t, i) => (i === 0 ? 0 : round(Math.max(0, t - from))));
      if (info.words) info.words = info.words.map(([w, t]) => [w, round(Math.max(0, t - from))]);
      info.duration = round(probe(mp3));
      console.log(`  ${locale}/${step}.mp3  ${round(dur)}s -> ${info.duration}s`);
    }
  }
  jobs.length = 0;
}

// --realign: re-time every Voicebox clip already rendered from the current text (free, nothing is rendered)
if (args.includes("--realign")) {
  const stale = new Set(jobs.map((j) => `${j.locale}/${j.step}`));
  const clips = [];
  for (const strings of locales) {
    if (strings.narrator?.provider !== "voicebox") continue;
    for (const [step, text] of Object.entries(strings.steps)) {
      const label = `${strings.locale}/${step}`, info = manifest[strings.locale]?.[step];
      const mp3 = path.join(audioDir, strings.locale, `${step}.mp3`);
      if (!info || stale.has(label) || !existsSync(mp3) || (only && !only.has(step))) continue;
      clips.push({ mp3, sentences: sentencesOf(strings, text), info, label });
    }
  }
  if (stale.size) console.log(`${stale.size} step(s) need rendering first; not re-timed`);
  alignClips(clips);
  jobs.length = 0;
}

// --whole: the whole script read as one take, cut into one file per step. Each step as its own request sounded
// like "a different guy every time"; one long request keeps the voice, the room and the energy. Requests hold up
// to `--chunk` characters (ElevenLabs' multilingual v2 takes 10,000), each chained to the one before it
// (previous_request_ids), and every step is cut at the middle of the pause on either side of it. A step patched
// later (--only, without --whole) is rendered alone, with its neighbours' text for context.
if (args.includes("--whole") && !useSay && locales.every((l) => l.narrator?.provider === "elevenlabs")) {
  const chunkMax = Number(args[args.indexOf("--chunk") + 1]) || 9000;
  // --seam step,step: start a new take at these steps (a natural pause, the start of a turn), so a seam between
  // takes never falls mid-scene
  const seams = new Set(args.includes("--seam") ? args[args.indexOf("--seam") + 1].split(",") : []);
  const ext = (fmt) => Number(/_(\d+)$/.exec(fmt ?? "")?.[1] ?? 128);
  const takes = []; // { locale, narrator, known, steps: [{ step, sentences, hash, mp3 }] }
  for (const j of jobs) {
    const last = takes[takes.length - 1];
    const len = j.sentences.join(" ").length + 2;
    if (last && last.locale === j.locale && last.chars + len <= chunkMax && !seams.has(j.step)) {
      last.steps.push(j);
      last.chars += len;
    } else takes.push({ locale: j.locale, narrator: j.narrator, known: j.known, steps: [j], chars: len });
  }
  console.log(`${takes.length} take(s): ${takes.map((t) => `${t.steps.length} steps, ${t.chars} chars`).join("; ")}`);
  const requestIds = [];
  const tmp = mkdtempSync(path.join(tmpdir(), "narration-take-"));
  try {
    for (const [ti, take] of takes.entries()) {
      const n = take.narrator;
      // the text: steps separated by a paragraph break; where each step and each sentence starts in it
      let text = "";
      const BREAK = `\n\n<break time="${n.stepPause ?? 1.0}s" />\n\n`;
      const marks = take.steps.map((j) => {
        if (text) text += BREAK;
        const from = text.length;
        const sentenceStarts = [];
        j.sentences.forEach((s, i) => {
          if (i > 0 && s) text += " ";
          sentenceStarts.push(s ? text.length : -1);
          text += s;
        });
        return { j, from, to: text.length, sentenceStarts };
      });
      const body = JSON.stringify({
        text,
        model_id: n.model ?? "eleven_multilingual_v2",
        seed: n.seed ?? 1755,
        ...(requestIds.length ? { previous_request_ids: requestIds.slice(-3) } : {}),
        voice_settings: { stability: n.stability ?? 0.7, similarity_boost: n.similarityBoost ?? 0.75, style: n.style ?? 0.1, use_speaker_boost: true, speed: n.speed ?? 1.0 },
      });
      const url = `https://api.elevenlabs.io/v1/text-to-speech/${n.voiceId}/with-timestamps?output_format=${n.format ?? "mp3_44100_128"}`;
      let json;
      for (let attempt = 0; ; attempt++) {
        const res = await fetch(url, { method: "POST", headers: { "xi-api-key": elevenLabsKey(), "content-type": "application/json" }, body, signal: AbortSignal.timeout(600000) });
        if (res.ok) {
          const id = res.headers.get("request-id");
          if (id) requestIds.push(id);
          json = await res.json();
          break;
        }
        const detail = (await res.text()).slice(0, 300);
        if ((res.status === 429 || res.status >= 500) && attempt < 5) {
          console.log(`  (ElevenLabs ${res.status}, retrying: ${detail.slice(0, 120)})`);
          await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
          continue;
        }
        throw new Error(`ElevenLabs ${res.status}: ${detail}`);
      }
      const whole = path.join(tmp, `take${ti}.mp3`);
      writeFileSync(whole, Buffer.from(json.audio_base64, "base64"));
      const a = json.alignment;
      const spoken = a.characters.join("");
      // text index → alignment index: each step's text is found in the alignment in order (break tags may be absent)
      const offsets = [];
      let cursor = 0;
      for (const m of marks) {
        const seg = text.slice(m.from, m.to);
        const at = spoken.indexOf(seg.slice(0, Math.min(40, seg.length)), cursor);
        if (at < 0) throw new Error(`take ${ti}: step ${m.j.step} not found in the alignment`);
        offsets.push(at - m.from);
        cursor = at + seg.length;
      }
      const shiftOf = (i) => offsets[Math.max(0, marks.findIndex((m) => i >= m.from && i < m.to + 1))] ?? 0;
      const startAt = (i) => a.character_start_times_seconds[i + shiftOf(i)];
      const endAt = (i) => a.character_end_times_seconds[i + shiftOf(i)];
      const lastChar = (from, to) => { let k = to - 1; while (k > from && /\s/.test(text[k])) k--; return k; };
      const total = probe(whole);
      console.log(`take ${ti + 1}/${takes.length}: ${take.steps.length} steps, ${round(total)}s`);
      marks.forEach((m, k) => {
        const prev = marks[k - 1], next = marks[k + 1];
        const cutIn = prev ? (endAt(lastChar(prev.from, prev.to)) + startAt(m.from)) / 2 : 0;
        const cutOut = next ? (endAt(lastChar(m.from, m.to)) + startAt(next.from)) / 2 : total;
        const pad = n.padding ?? 0.25;
        execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(cutIn), "-to", String(cutOut), "-i", whole, "-af", `adelay=${Math.round(pad * 1000)}:all=1,apad=pad_dur=${pad}`, "-ar", "44100", "-ac", "1", "-codec:a", "libmp3lame", "-b:a", `${ext(n.format)}k`, m.j.mp3], { timeout: 120000 });
        const times = m.sentenceStarts.map((i) => (i >= 0 ? round(startAt(i) - cutIn + pad) : -1));
        for (let i = times.length - 1; i >= 0; i--) if (times[i] < 0) times[i] = i + 1 < times.length ? times[i + 1] : round(cutOut - cutIn);
        times[0] = 0;
        const words = [];
        for (let i = m.from; i < m.to; i++) {
          if (/\s/.test(text[i]) || (i > m.from && !/\s/.test(text[i - 1]))) continue;
          let e = i;
          while (e < m.to && !/\s/.test(text[e])) e++;
          const word = text.slice(i, e).replace(/[^\p{L}\p{N}'-]/gu, "");
          if (word) words.push([word, round(startAt(i) - cutIn + pad)]);
        }
        const duration = round(probe(m.j.mp3));
        m.j.known[m.j.step] = { hash: m.j.hash, sentenceTimes: times, duration, words, take: ti };
        console.log(`  ${m.j.locale}/${m.j.step}.mp3  ${m.j.sentences.length} sentence(s)  ${duration}s`);
      });
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  jobs.length = 0; // rendered: the per-step workers below have nothing left to do
}

// ElevenLabs limits concurrent requests per plan (lower tiers: 2); requests over it are refused with
// a 429, retried above, but each refusal counts against you. `narrator.concurrency` raises it.
const concurrency = Math.max(1, ...locales.map((l) => (useSay ? 1 : (l.narrator?.concurrency ?? 2))));
let next = 0;
const failed = [];
const toAlign = [];
async function worker() {
  while (next < jobs.length) {
    const j = jobs[next++];
    try {
      const render = { elevenlabs: renderElevenLabs, voicebox: renderVoicebox }[j.narrator.provider] ?? renderSay;
      const { times, words } = await render(j.narrator, j.sentences, j.mp3, j.context);
      const duration = round(probe(j.mp3));
      j.known[j.step] = { hash: j.hash, sentenceTimes: times, duration, ...(words ? { words } : {}) };
      if (j.narrator.provider === "voicebox") toAlign.push({ mp3: j.mp3, sentences: j.sentences, info: j.known[j.step], label: `${j.locale}/${j.step}` });
      console.log(`${j.locale}/${j.step}.mp3  ${j.sentences.length} sentence(s)  ${duration}s`);
    } catch (e) {
      failed.push(`${j.locale}/${j.step}: ${e.message}`);
      console.log(`${j.locale}/${j.step}: FAILED ${e.message}`);
    }
  }
}
await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker));
alignClips(toAlign);
writeFileSync(manifestFile, JSON.stringify(manifest, null, 1) + "\n");

// Generated TypeScript: static imports, so the bundler ships the files and gives their URLs.
const lines = ["// GENERATED by scripts/tutorial/audio.mjs from strings.*.json — do not edit.", "/* eslint-disable */"];
const entries = [];
for (const [locale, steps] of Object.entries(manifest)) {
  for (const [step, info] of Object.entries(steps)) {
    const name = `${locale}_${step}`.replace(/[^a-zA-Z0-9_]/g, "_");
    entries.push({ locale, step, name, info });
    lines.push(`import ${name} from "./${locale}/${step}.mp3";`);
  }
}
lines.push(
  "",
  "/** `words`: each spoken word and when it starts (ElevenLabs, and Voicebox through align.py), for cues inside a sentence. */",
  "export type Narration = { url: string; sentenceTimes: number[]; duration: number; words?: [string, number][] };",
  "",
);
lines.push("export const narration: { [locale: string]: { [stepId: string]: Narration } } = {");
for (const locale of Object.keys(manifest)) {
  lines.push(`  ${JSON.stringify(locale)}: {`);
  for (const e of entries.filter((x) => x.locale === locale)) {
    const words = e.info.words ? `, words: ${JSON.stringify(e.info.words)}` : "";
    lines.push(`    ${JSON.stringify(e.step)}: { url: ${e.name}, sentenceTimes: ${JSON.stringify(e.info.sentenceTimes)}, duration: ${e.info.duration}${words} },`);
  }
  lines.push("  },");
}
lines.push("};", "");
writeFileSync(path.join(audioDir, "index.ts"), lines.join("\n"));
console.log(`wrote ${path.relative(process.cwd(), path.join(audioDir, "index.ts"))}`);
if (failed.length) {
  console.log(`\n${failed.length} step(s) failed; re-run to retry them:\n  ${failed.join("\n  ")}`);
  process.exit(1);
}
