// What makes a good recorded run of each stretch of the tutorial (scripts/tutorial search). An objective scores a
// finished run (higher is better; -Infinity rejects it) and may `prepare` the pins before the run (forcing the deal).
import type { RunResult } from "./harness";
import type { Pins } from "../../src/tutorial/script";

export type Objective = {
  prepare?: (pins: Pins, random: () => number) => Pins;
  score: (r: RunResult) => number;
};

export const objectives: { [name: string]: Objective } = {
  // placeholder until the stretches are written: any run that completes
  any: { score: () => 0 },
};
