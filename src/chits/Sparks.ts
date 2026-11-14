import { HiddenPropertySerializationRule, SparkChit } from "@pretty-chitty/core";
import { SparkIcon } from "../canvas/Icons";
import { RND_LABEL, RndTrack } from "../consts";
import { HIDDEN, hideFromOthers } from "../secret";

/** One of a player's amounts of money. With secret money (S7) its value is sent to its owner only (`myValue` is the
 *  engine's field behind `value`); everyone else's spark shows "–" until the game ends. */
export abstract class MoneySpark extends SparkChit {
  ownerId = "";
  secret = false;

  constructor() {
    super();
    // a hidden field is simply not sent, so a viewer keeps whatever the chit started with: start unknown, not 0
    (this as unknown as { myValue?: number }).myValue = undefined;
  }

  override get value(): number {
    const v = super.value;
    // "–" only while the amount is secret and not sent to this viewer (the engine prints value as it is). Otherwise a
    // number: the end screen charts every stored state, starting from the spark as it was made (no value yet), and a
    // single "–" there made the whole chart NaN
    if (v === undefined || v === null) return (this.secret ? HIDDEN : 0) as number;
    return v;
  }
  override set value(v: number) {
    super.value = v;
  }
  override hiddenPropertiesForSerialization(playerIds: string[]): HiddenPropertySerializationRule[] | undefined {
    return hideFromOthers(this.secret, this.ownerId, ["myValue"], playerIds);
  }
  /** money moves on every sale and fee: never pull the view to its player's mat for it */
  override get worthSlidingToPanelToShowChange(): boolean {
    return false;
  }
}

/** Cash on hand: what a player may bid, pay and buy with (P2.7, P3.13, P6P.15). */
export class CashSpark extends MoneySpark {
  override get icon() {
    return new SparkIcon().set((i) => (i.kind = "cash")).get();
  }
  override get endGameLabel() {
    return "Cash";
  }
}
/** Money in the Bank box: spent on turn order, never usable again, but counted at the end (P2.3, V2). */
export class BankSpark extends MoneySpark {
  override get icon() {
    return new SparkIcon().set((i) => (i.kind = "bank")).get();
  }
  override get endGameLabel() {
    return "Bank";
  }
}
/** This year's operations earnings, kept apart until the year ends (P6L.1). */
export class EarningsSpark extends MoneySpark {
  override get icon() {
    return new SparkIcon().set((i) => (i.kind = "earnings")).get();
  }
  override get endGameLabel() {
    return "Earnings";
  }
}

/** A research level (P5), shown beside the money so every player's research reads without opening the Tracks
 *  panel. `track` picks the icon; the value is the step, except Turn Order Bid, which shows its multiplier. Not
 *  bound to the player, so it never becomes the match score. */
export class ResearchSpark extends SparkChit {
  track: RndTrack = "slots";
  override get icon() {
    const kind = this.track;
    return new SparkIcon().set((i) => (i.kind = kind)).get();
  }
  override get endGameLabel() {
    return RND_LABEL[this.track];
  }
  /** research shows on the Tracks panel too: never pull the view to the player's mat for it */
  override get worthSlidingToPanelToShowChange(): boolean {
    return false;
  }
}
