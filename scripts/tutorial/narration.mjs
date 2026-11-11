// Shared by the narration scripts (audio.mjs, voices.mjs): the engine's sentence splitter, the
// markdown/:token: → speech conversion, and the ElevenLabs key from .env.
import { readFileSync } from "node:fs";
import { register } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const here = path.dirname(new URL(import.meta.url).pathname);
export const projectRoot = path.resolve(here, "../..");

// The engine's own sentence splitter, so the clips line up with the cues and the emphasis. Its dist
// uses extension-less relative imports; let Node resolve them as `.js`.
register(
  "data:text/javascript," +
    encodeURIComponent(`export async function resolve(spec, ctx, next) {
      try { return await next(spec, ctx); } catch (e) {
        if ((e.code === "ERR_MODULE_NOT_FOUND" || e.code === "ERR_UNSUPPORTED_DIR_IMPORT") && (spec.startsWith(".") || spec.startsWith("/")) && !spec.endsWith(".js")) {
          try { return await next(spec + ".js", ctx); } catch { return await next(spec + "/index.js", ctx); }
        }
        throw e;
      }
    }`),
);
globalThis.window ??= globalThis;
export const { splitSentences } = await import(
  pathToFileURL(path.resolve(here, "../../node_modules/@pretty-chitty/core/dist/game/tutorial/defineTutorial.js")).href
);

/**
 * Markdown and :tokens: to words a voice reads. A token is read as its word ("1 :money:" → "1 money",
 * "2 :ad:" → "2 ads"), except where the text already says the word beside it (":family: Family").
 */
export function spoken(markdown, words) {
  let s = markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links
    .replace(/^#+\s*/gm, "")
    .replace(/\n\s*[-*]\s+/g, ", ") // list items read as a list
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/[*_`>]/g, "")
    // A zero-width space keeps the engine's splitter from ending a sentence at an abbreviation ("Inc.\u200b Burgers")
    .replace(/\u200b/g, "");
  const clean = (w) => (w ?? "").replace(/[^a-z]/gi, "").toLowerCase();
  s = s.replace(/:([a-zA-Z0-9_-]+):/g, (m, name, at, all) => {
    const forms = words[name];
    if (!forms) return "";
    const [one, many] = Array.isArray(forms) ? forms : [forms, forms];
    const before = all.slice(0, at).trim().split(/\s+/).pop() ?? "";
    const after = all.slice(at + m.length).trim().split(/\s+/)[0] ?? "";
    const heads = [clean(one.split(" ")[0]), clean(many.split(" ")[0])];
    if (heads.includes(clean(after)) || heads.includes(clean(before))) return ""; // the text already says it
    const n = Number(before.replace(/[^0-9.]/g, ""));
    return before !== "" && /^\d/.test(before) && n !== 1 ? many : one;
  });
  return s.replace(/\s+/g, " ").replace(/\s+([,.!?:;])/g, "$1").replace(/:,/g, ":").trim();
}


/** The ElevenLabs API key: ELEVEN_LABS in the environment or in the project's .env. Never printed. */
export function elevenLabsKey() {
  if (process.env.ELEVEN_LABS) return process.env.ELEVEN_LABS.trim();
  try {
    const m = readFileSync(path.join(projectRoot, ".env"), "utf8").match(/^ELEVEN_LABS=(.*)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  } catch {
    // no .env
  }
  throw new Error("Set ELEVEN_LABS (an ElevenLabs API key) in .env or the environment.");
}
