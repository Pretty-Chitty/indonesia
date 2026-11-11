// AI testbed: plays many games in parallel (one worker process per core) and writes every game's
// record to results/testbed-<stamp>.jsonl, then a report (report.mjs). Run `yarn build` first.
//   node scripts/testbed/run.mjs [games=200] [players=2,3,4,5,6] [workers=cores-1] [timeoutSec=400]
import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(here, "../..");
const [gamesArg = "200", countsArg = "2,3,4,5,6", workersArg, timeoutArg = "400"] = process.argv.slice(2);
const total = +gamesArg;
const workers = Math.max(1, Math.min(total, workersArg ? +workersArg : os.cpus().length - 1));
mkdirSync(path.join(root, "results"), { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const file = path.join(root, "results", `testbed-${stamp}.jsonl`);
const sink = createWriteStream(file);
const started = Date.now();
let done = 0, failed = 0;

console.log(`testbed: ${total} games, players ${countsArg}, ${workers} workers → ${path.relative(root, file)}`);
const jobs = [];
for (let w = 0; w < workers; w++) {
  const n = Math.floor(total / workers) + (w < total % workers ? 1 : 0);
  if (!n) continue;
  // Rotate the player-count list per worker so every count is played about equally often.
  const counts = countsArg.split(",");
  const rotated = [...counts.slice(w % counts.length), ...counts.slice(0, w % counts.length)].join(",");
  jobs.push(
    new Promise((resolve) => {
      const child = spawn(process.execPath, [path.join(here, "worker.mjs"), String(n), rotated, String(100000 * (w + 1) + (Date.now() % 100000)), timeoutArg], { stdio: ["ignore", "pipe", "ignore"] });
      let buf = "";
      child.stdout.on("data", (d) => {
        buf += d;
        let i;
        while ((i = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, i);
          buf = buf.slice(i + 1);
          if (!line.startsWith("RESULT ")) continue;
          sink.write(line.slice(7) + "\n");
          done++;
          if (!JSON.parse(line.slice(7)).ok) failed++;
          if (done % Math.max(1, Math.round(total / 40)) === 0 || done === total) {
            const s = (Date.now() - started) / 1000;
            console.log(`  ${done}/${total} games (${failed} failed), ${s.toFixed(0)}s elapsed, ~${((s / done) * (total - done)).toFixed(0)}s left`);
          }
        }
      });
      child.on("exit", resolve);
    }),
  );
}
await Promise.all(jobs);
sink.end();
await new Promise((r) => sink.on("finish", r));
console.log(`done: ${done} games in ${((Date.now() - started) / 1000).toFixed(0)}s`);
const rep = spawn(process.execPath, [path.join(here, "report.mjs"), file], { stdio: "inherit" });
await new Promise((r) => rep.on("exit", r));
