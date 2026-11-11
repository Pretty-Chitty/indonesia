#!/usr/bin/env node
// Voice audition on a local Voicebox server: the same steps of the real script in every English Kokoro voice
// (28 of them), with a page to compare them side by side. Free and offline; about 7 s per voice for a minute of
// speech. Turn off Voicebox's "autoplay on generate" first, or every clip plays aloud.
//
//   node scripts/tutorial/kokoro-voices.mjs [--steps <id>,<id>] [--out dir] [--voices am_santa,bm_daniel]
//
// Writes <out>/<voice>.mp3 and <out>/index.html. Pick by ear: FCM's developer found most of them "very flat" and
// chose am_santa, which "has real personality".
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { projectRoot, splitSentences, spoken } from "./narration.mjs";

const args = process.argv.slice(2);
const opt = (name, d) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : d);
const VB = process.env.VOICEBOX_URL ?? "http://127.0.0.1:17493";
const json = async (route, init) => {
  const res = await fetch(VB + route, init);
  const body = await res.text();
  if (!res.ok) throw new Error(`Voicebox ${route} ${res.status}: ${body.slice(0, 200)}`);
  return JSON.parse(body);
};
const strings = JSON.parse(readFileSync(path.join(projectRoot, "src/tutorial/strings.en.json"), "utf8"));
// Default: the first two steps. Pass two that sound like the script (a welcome and a busy one).
const stepIds = opt("steps", Object.keys(strings.steps).slice(0, 2).join(",")).split(",");
const text = stepIds
  .map((id) => {
    if (!strings.steps[id]) throw new Error(`no step "${id}" in strings.en.json`);
    return splitSentences(strings.steps[id]).map((s) => spoken(s, strings.spoken ?? {})).join(" ");
  })
  .join(" ");
const out = path.resolve(opt("out", path.join(tmpdir(), "kokoro-voices")));
mkdirSync(out, { recursive: true });
const only = opt("voices")?.split(",");
const { voices } = await json("/profiles/presets/kokoro");
const profiles = await json("/profiles");
const done = [];
for (const v of voices.filter((v) => v.language === "en" && (!only || only.includes(v.voice_id)))) {
  const found = profiles.find((p) => p.voice_type === "preset" && p.preset_engine === "kokoro" && p.preset_voice_id === v.voice_id);
  const profile = found ?? (await json("/profiles", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: `${v.voice_id} (kokoro)`, language: "en", voice_type: "preset", preset_engine: "kokoro", preset_voice_id: v.voice_id, default_engine: "kokoro" }) }));
  let gen = await json("/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ profile_id: profile.id, text, language: "en", engine: "kokoro", seed: 1755 }) });
  while (!["completed", "failed", "error"].includes(gen.status)) {
    await new Promise((r) => setTimeout(r, 200));
    gen = await json(`/history/${gen.id}`);
  }
  if (gen.status !== "completed") {
    console.log(`${v.voice_id}: FAILED ${gen.error ?? gen.status}`);
    continue;
  }
  const wav = path.join(out, `${v.voice_id}.wav`);
  writeFileSync(wav, Buffer.from(await (await fetch(`${VB}/audio/${gen.id}`)).arrayBuffer()));
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", wav, "-codec:a", "libmp3lame", "-q:a", "4", path.join(out, `${v.voice_id}.mp3`)]);
  unlinkSync(wav);
  done.push(v);
  console.log(`${v.voice_id.padEnd(12)} ${v.gender}`);
}
// a = American, b = British; f/m. Playing one pauses the others.
const rows = done.map((v) => `<div class=r><b>${v.voice_id}</b><audio controls preload=none src="${v.voice_id}.mp3"></audio></div>`).join("\n");
writeFileSync(path.join(out, "index.html"), `<!doctype html><meta charset=utf-8><title>Kokoro voices</title><style>body{font:15px system-ui;max-width:760px;margin:24px auto;padding:0 16px}.r{display:flex;align-items:center;gap:12px;margin:4px 0}.r b{width:110px}audio{flex:1;height:32px}</style><h1>Kokoro voices</h1><p>Steps: ${stepIds.join(", ")}</p>\n${rows}\n<script>document.addEventListener("play",e=>document.querySelectorAll("audio").forEach(a=>a!==e.target&&a.pause()),true)</script>`);
console.log(`\n${path.join(out, "index.html")}`);
