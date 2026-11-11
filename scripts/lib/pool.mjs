// Runs a worker script over a list of jobs, one process per core, and streams the lines each job
// prints with a given prefix ("RESULT {json}") to a callback. Workers take their job as JSON argv.
import { spawn } from "node:child_process";
import os from "node:os";

/**
 * @param script   worker path; called as `node script '<job json>'`, prints `<prefix> {json}` lines
 * @param jobs     list of job objects (one process each, run `workers` at a time)
 * @param onRecord called with each parsed record and its job
 */
export async function runPool(script, jobs, { workers = os.cpus().length - 1, prefix = "RESULT ", onRecord = () => {}, onExit = () => {} } = {}) {
  let next = 0;
  const runOne = () =>
    new Promise((resolve) => {
      if (next >= jobs.length) return resolve(false);
      const job = jobs[next++];
      const child = spawn(process.execPath, [script, JSON.stringify(job)], { stdio: ["ignore", "pipe", "pipe"] });
      let buf = "", err = "";
      child.stdout.on("data", (d) => {
        buf += d;
        let i;
        while ((i = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, i);
          buf = buf.slice(i + 1);
          if (line.startsWith(prefix)) {
            try {
              onRecord(JSON.parse(line.slice(prefix.length)), job);
            } catch (e) {
              console.error("bad record", e.message);
            }
          }
        }
      });
      child.stderr.on("data", (d) => (err = (err + d).slice(-2000)));
      child.on("exit", (code) => {
        onExit(job, code, err);
        resolve(true);
      });
    });
  const lane = async () => {
    while (await runOne());
  };
  await Promise.all(Array.from({ length: Math.min(workers, jobs.length) }, lane));
}
