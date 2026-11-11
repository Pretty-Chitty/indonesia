import { HiddenPropertySerializationRule } from "@pretty-chitty/core";

/** What a hidden amount shows: other players' money while it is secret (S7). */
export const HIDDEN = "–";

/** Secret money (S7): while `secret`, a chit's money `fields`, owned by `ownerId`, are sent to nobody else (other
 *  players and onlookers see HIDDEN). At the end the flag clears and the values, and their whole history (the end
 *  screen's chart reads every stored state), are everyone's. */
export function hideFromOthers(secret: boolean, ownerId: string, fields: string[], playerIds: string[]): HiddenPropertySerializationRule[] | undefined {
  if (!secret) return undefined;
  const others = playerIds.filter((id) => id !== ownerId);
  return others.length ? [{ fields, playerIds: others }] : undefined;
}

/** An amount as shown: the number, or HIDDEN when it was not sent to this viewer. */
export function shown(n: number | undefined): string {
  return n === undefined || n === null ? HIDDEN : String(n);
}
