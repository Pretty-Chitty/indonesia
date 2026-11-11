#!/usr/bin/env node
// Bundles scripts/tutorial/cli.ts (the game, its tutorial and one copy of the engine) with esbuild
// and runs it with the given arguments. See cli.ts for the commands.
//   node scripts/tutorial/run.mjs trace [--until step] [--seed n]
//   node scripts/tutorial/run.mjs search --from step --until step --n 200 --objective name
//   node scripts/tutorial/run.mjs check
import { build } from "esbuild";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const here = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(process.env.TUTORIAL_BUILD_DIR ?? path.join(tmpdir(), `${path.basename(path.resolve(here, "../.."))}-tutorial`), "cli.mjs");
mkdirSync(path.dirname(out), { recursive: true });

await build({
  entryPoints: [path.join(here, "cli.ts")],
  outfile: out,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  sourcemap: "inline",
  // Chits are serialized by class name (the player's view rebuilds them from it): keep names that
  // bundling would rename to avoid collisions, as the game's own build does (terser keep_classnames).
  keepNames: true,
  logLevel: "warning",
  tsconfig: path.join(here, "../../tsconfig.json"),
  loader: { ".png": "file", ".jpg": "file", ".glb": "file", ".mp3": "file", ".css": "empty", ".woff": "file", ".woff2": "file" },
  assetNames: "assets/[name]-[hash]",
  // Some dependencies are CommonJS and call require(); give the ESM bundle one.
  banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url); globalThis.window ??= globalThis;" },
});

process.env.TUTORIAL_PROJECT_ROOT = path.resolve(here, "../..");
process.argv = [process.argv[0], out, ...process.argv.slice(2)];
await import(pathToFileURL(out).href);
