#!/usr/bin/env node
// Bundles scripts/layout/check.ts (the game's Root and one copy of the engine) with esbuild and runs it: the
// panel layout the client would compute (RootChit.getFlatLayout) at a set of screen sizes, checked against
// what each size should show. No browser needed.
//   node scripts/layout/run.mjs            check every size (exit 1 on a failure)
//   node scripts/layout/run.mjs --print    also print every size's panels
import { build } from "esbuild";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const here = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(tmpdir(), `${path.basename(path.resolve(here, "../.."))}-layout`, "check.mjs");
mkdirSync(path.dirname(out), { recursive: true });

await build({
  entryPoints: [path.join(here, "check.ts")],
  outfile: out,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  keepNames: true,
  logLevel: "warning",
  tsconfig: path.join(here, "../../tsconfig.json"),
  loader: { ".png": "file", ".jpg": "file", ".jpeg": "file", ".svg": "file", ".webp": "file", ".glb": "file", ".mp3": "file", ".css": "empty", ".woff": "file", ".woff2": "file", ".ttf": "file" },
  assetNames: "assets/[name]-[hash]",
  // Some dependencies are CommonJS and call require(); give the ESM bundle one.
  banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url); globalThis.window ??= globalThis;" },
});

await import(pathToFileURL(out).href);
