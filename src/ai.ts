// The AI (references/ai.md in the board-game-port skill): every pick key scored by the bot a seat runs. Two
// versions sit side by side so a new one can be measured against the old in the same build: ctx.params.version
// picks one per seat ("v1" frozen, "v2" with ctx.params.weights over weights.ts); a seat with no params runs
// SHIPPED.
import { AiRule, defineAi } from "@pretty-chitty/core";
import { Player } from "./chits/Player";
import { Root } from "./chits/Root";
import { Memory } from "./bots/common";
import { v1Rules } from "./bots/v1";
import { v2Rules } from "./bots/v2";

const BOTS: Record<string, Record<string, AiRule<Player, Root, Memory>>> = { v1: v1Rules, v2: v2Rules };
/** the version a seat runs when nothing says otherwise (demo, Playground, live games) */
const SHIPPED = "v2";

const keys = [...new Set([...Object.keys(v1Rules), ...Object.keys(v2Rules)])];
const rules = Object.fromEntries(
  keys.map((key) => [
    key,
    ((opt, ctx) => {
      const bot = BOTS[ctx.params?.version ?? SHIPPED] ?? BOTS[SHIPPED];
      const rule = bot[key] ?? BOTS[SHIPPED][key];
      return rule ? rule(opt, ctx) : 0;
    }) as AiRule<Player, Root, Memory>,
  ]),
);

export const ai = defineAi<Player, Root, Memory>({
  initialMemory: () => ({}),
  rules,
});
