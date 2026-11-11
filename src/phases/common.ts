import { Picks, Turn } from "@pretty-chitty/core";
import { Player } from "../chits/Player";
import { Root } from "../chits/Root";

export type T = Turn<any, Player, Root>;

/** Every prompt goes through here: after the answer the player's decision counter changes, so an answer whose
 *  only effect is a local variable (Pass, Done) still changes state and the server returns. */
export async function ask(turn: T, player: Player, picks: Picks, message?: string, help?: string) {
  const root = player.parent as Root;
  root.playerAid.refresh(root);
  root.board.syncHuts();
  if (await autoplay(root, picks, message)) {
    player.decisions++;
    return;
  }
  if (message !== undefined) await turn.pick(message, help, picks);
  else await turn.pick(picks);
  player.decisions++;
}

/** Development only: with `?autoplay=N` in the playground's URL, every prompt up to year N is answered with its
 *  first option, so a mid-game table can be captured; `&stopAt=word` stops instead at the first prompt of year N
 *  mentioning `word` (a delivery late in the game, say). Inert outside a browser and without the switch. */
async function autoplay(root: Root, picks: Picks, message?: string): Promise<boolean> {
  const search = (globalThis as { window?: { location?: { search?: string } } }).window?.location?.search ?? "";
  const m = /autoplay=(\d+)/.exec(search);
  if (!m || root.year > Number(m[1])) return false;
  // `stopAt=word` halts at the first prompt of year N whose message contains the word (to capture that prompt)
  const stop = /stopAt=([a-z]+)/.exec(search)?.[1];
  const flatAll = (Array.isArray(picks) ? picks.flat(3) : [picks]).filter(Boolean) as unknown as { messageContents?: string }[];
  if (stop && root.year === Number(m[1]) && (message?.includes(stop) || flatAll.some((p) => p.messageContents?.includes(stop)))) return false;
  const flat = (Array.isArray(picks) ? picks.flat(3) : [picks]).filter(Boolean) as unknown as { chits?: unknown[]; cb?: (c: unknown) => unknown; button?: { cb?: () => unknown } }[];
  const chitPick = flat.find((p) => p.chits && p.chits.length > 0 && p.cb);
  if (chitPick) {
    // round-robin over the options by a running count, so the autoplayed game varies (deterministic, no rng)
    const n = (root as unknown as { autoplayCount?: number }).autoplayCount ?? 0;
    (root as unknown as { autoplayCount?: number }).autoplayCount = n + 1;
    await chitPick.cb!(chitPick.chits![(n * 7) % chitPick.chits!.length]);
    return true;
  }
  // the last button is the one that ends a loop (Bid, Done, Pass); an adjust button first would never finish
  const buttonPick = [...flat].reverse().find((p) => p.button?.cb);
  if (buttonPick) {
    await buttonPick.button!.cb!();
    return true;
  }
  return false;
}

/** Fisher-Yates with the turn's rng (OrderedOutlet.shuffle is not uniform). */
export function shuffle<X>(items: X[], rng: () => number): X[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function money(n: number): string {
  return `${n} rupiah`;
}
