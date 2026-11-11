// Prints one game's log with every seat on the given bot (v1 | v2 | <weights JSON>), to read as a player.
//   node scripts/tune/log.mjs [players=4] [seed=1] [bot=v2]
import { readFileSync } from "node:fs";
import { loadEngine, playMatch, silence, out } from "../lib/harness.mjs";

silence();
const [n = "4", seed = "1", bot = "v2"] = process.argv.slice(2);
const params = bot === "v1" || bot === "v2" ? { version: bot } : { version: "v2", weights: JSON.parse(readFileSync(bot, "utf8")).weights };
const E = await loadEngine();
const r = await playMatch(E, { n: +n, seed: +seed, rngSeed: +seed, seat: () => ({ params }) });
const lines = [];
const walk = (t, d) => {
  for (const st of t?.clockSteps ?? []) {
    if (st.log) lines.push("  ".repeat(d) + st.log);
    for (const s of st.turns ?? []) walk(s, d + 1);
  }
};
walk(r.match.turn.value, 0);
out(lines.join("\n"));
process.exit(0);
