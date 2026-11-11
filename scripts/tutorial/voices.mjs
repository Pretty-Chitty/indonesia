#!/usr/bin/env node
// Voice audition for the tutorial narration: renders the same two steps of the real script in each
// candidate ElevenLabs voice, so the narrator is picked by ear before the whole script is rendered.
//
//   node scripts/tutorial/voices.mjs [--out dir] [--steps <id>,<id>] [--speed 1.1] [--voices name:id,...]
//   node scripts/tutorial/voices.mjs --search [--gender male] [--language pt] [--accent portuguese] [--query text]
//
// --search lists voices in ElevenLabs' shared Voice Library that match (for a narrator with an accent the premade
// voices lack) and downloads each one's public preview clip: free, and none of the tutorial's text is sent. A
// library voice must be added to the account before it can render (ElevenLabs: Voice Library → Add), then
// audition it here with --voices name:id.
//
// Writes <out>/<voice>.mp3 and prints the files. The key is ELEVEN_LABS in .env (never printed).
// The defaults are ElevenLabs' premade voices, which every key can use (listing the account's own
// voices needs the voices_read permission). Only tutorial text is sent to ElevenLabs.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { elevenLabsKey, projectRoot, splitSentences, spoken } from "./narration.mjs";

const args = process.argv.slice(2);
const opt = (name, d) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : d;
};

/** Clear women's voices among ElevenLabs' premade ones, with what each is like (Excursions' narrator
 *  is a woman; for another persona pass `--voices name:id,...`). */
const CANDIDATES = [
  { name: "jessica", id: "cgSgspJ2msm6clMCkdW9", about: "American, bright and expressive" },
  { name: "matilda", id: "XrExE9yKIg1WjnnlVkGX", about: "American, warm and friendly" },
  { name: "sarah", id: "EXAVITQu4vr4xnSDxMaL", about: "American, clear and professional" },
  { name: "laura", id: "FGY2WhTYpPnrIDTdsKH5", about: "American, upbeat" },
  { name: "alice", id: "Xb7hH8MSUJpSbSDYk0k2", about: "British, crisp and confident" },
];
const voices = opt("voices")
  ? opt("voices").split(",").map((v) => {
      const [name, id] = v.split(":");
      return { name, id, about: "" };
    })
  : CANDIDATES;
const out = path.resolve(opt("out", path.join(tmpdir(), "tutorial-voice-samples")));
const speed = Number(opt("speed", "1.1")); // ElevenLabs allows 0.7–1.2
const model = opt("model", "eleven_multilingual_v2");

const strings = JSON.parse(readFileSync(path.join(projectRoot, "src/tutorial/strings.en.json"), "utf8"));
// Default: the first two steps. Pass two that sound like the script (a welcome and a busy move).
const stepIds = (opt("steps") ?? Object.keys(strings.steps).slice(0, 2).join(",")).split(",");
const text = stepIds
  .map((id) => {
    const t = strings.steps[id];
    if (!t) throw new Error(`no step "${id}" in strings.en.json`);
    return splitSentences(t).map((s) => spoken(s, strings.spoken ?? {})).join(" ");
  })
  .join("\n\n");

const key = elevenLabsKey();
mkdirSync(out, { recursive: true });
if (args.includes("--search")) {
  const q = new URLSearchParams({ page_size: opt("limit", "15") });
  for (const name of ["gender", "language", "accent", "age"]) if (opt(name)) q.set(name, opt(name));
  if (opt("query")) q.set("search", opt("query"));
  const res = await fetch(`https://api.elevenlabs.io/v1/shared-voices?${q}`, { headers: { "xi-api-key": key }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`voice search failed (${res.status}) ${(await res.text()).slice(0, 200)}`);
  const { voices: found = [] } = await res.json();
  console.log(`${found.length} voices (${q}):\n`);
  for (const v of found) {
    let preview = "";
    if (v.preview_url) {
      const clip = await fetch(v.preview_url, { signal: AbortSignal.timeout(30000) });
      if (clip.ok) {
        preview = path.join(out, `${v.name.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}.mp3`);
        writeFileSync(preview, Buffer.from(await clip.arrayBuffer()));
      }
    }
    console.log(`  ${v.name} — ${[v.gender, v.age, v.accent, v.language, v.locale].filter(Boolean).join(", ")}; ${v.descriptive ?? ""} ${v.use_case ?? ""}`);
    console.log(`    id ${v.voice_id}${preview ? `  preview ${preview}` : ""}`);
    if (v.description) console.log(`    ${String(v.description).replace(/\s+/g, " ").slice(0, 160)}`);
  }
  process.exit(0);
}
console.log(`Rendering ${stepIds.join(" + ")} at speed ${speed} with ${model}:\n`);
for (const v of voices) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${v.id}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify({
      text,
      model_id: model,
      voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true, speed },
    }),
    signal: AbortSignal.timeout(90000),
  });
  if (!res.ok) {
    console.log(`  ${v.name}: failed (${res.status}) ${(await res.text()).slice(0, 200)}`);
    continue;
  }
  const file = path.join(out, `${v.name}.mp3`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  console.log(`  ${file}  ${v.about}`);
}
