// Tuner worker: plays the games it is given, each seat with its own bot params, and prints one
// `RESULT {json}` per game with every seat's outcome.
//   node scripts/tune/worker.mjs '{"params":[{…},{…}],"games":[{"seed":1,"seats":[0,1,1]}],"temperature":0.6}'
import { readFileSync } from "node:fs";
import { loadEngine, playMatch, standings, silence, out, errors } from "../lib/harness.mjs";

silence();
const job = JSON.parse(process.argv[2] ?? "{}");
const E = await loadEngine();
// A bot's params may name a model file (modelPath): load it here and hand it over as params.model,
// so models can be compared without rebuilding (and without putting megabytes on the command line).
for (const p of job.params ?? []) if (p?.modelPath) p.model = JSON.parse(readFileSync(p.modelPath, "utf8"));

for (const g of job.games) {
  const n = g.seats.length;
  const r = await playMatch(E, {
    n,
    seed: g.seed,
    rngSeed: g.seed,
    timeoutSec: 60, // real games take seconds; a stalled era (RULES.md Q-stall) fails here before it runs out of memory
    stallSec: 20,
    seat: (k) => ({ params: job.params[g.seats[k]], ...(job.temperature !== undefined ? { temperature: job.temperature } : {}) }),
  });
  const st = r.ok ? standings(r.match) : undefined;
  out(
    "RESULT " +
      JSON.stringify({
        seed: g.seed,
        seats: g.seats,
        ok: !!st,
        why: r.why,
        ms: r.ms,
        turns: r.match.turn.value?.rootChit?.turnNumber,
        // per seat k (player id pk): rank, vp, won share, margin, turn-order position
        res: st ? g.seats.map((_, k) => st[`p${k}`]) : undefined,
        ruleErrors: r.stats?.map((x) => x.ruleErrors ?? 0),
        stuck: r.stats?.map((x) => (x.stuck ?? 0) + (x.stalls ?? 0)),
        errors: st ? undefined : errors.splice(0).slice(-3),
      }),
  );
}
process.exit(0);
