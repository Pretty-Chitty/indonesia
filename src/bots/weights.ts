// v2's every constant, in one object the tuner varies (scripts/tune, references/ai.md §6 in the board-game-port
// skill). Values are in rupiah or plain factors; RANGES bounds the tuner's mutations. The values are tuning round 3's
// c104 (2026-11-01: 20 generations × 450 self-play games from round 2's champion, after the game clock, the
// city-growth model and the conceding bot were added; it then finished ahead of 64% of opposing seats against v1,
// its own starting weights and the runner-up over 1200 games, with four-player games back to ~7 years). Still open:
// Expansion research stays rare (cities buy one of each good, so a new plantation seldom sells), and demandShare,
// bidShade and mergerResearch ended at the top of their ranges.
export const DEFAULTS = {
  /** the game clock: companies a player starts a year once their free slots are used (researched slots, merged
   *  ones freed); with the companies left to start, it gives the years left (econ.ts) */
  takeRate: 0.387,
  /** a factor on the years left the clock gives */
  clockScale: 1.211,
  /** next year's income counts this much of this year's (uncertainty, and money now compounds) */
  decay: 0.872,
  /** the share of a company's sellable goods it actually sells, other companies competing for the same demand */
  demandShare: 1,
  /** income growth per Expansion step per year for a company that sells everything, as a share of a good's value */
  growth: 0.476,
  /** a new plantation that no line can serve yet: its expected yearly income, as a share of its good's value */
  unservedIncome: 0.373,
  /** what a ship of a line earns a year in fees, per Hull step */
  shipFee: 7.127,
  /** a line's yearly value per production company its owner has (their goods ride free on it) */
  shipSynergy: 7.246,
  /** what an empty company slot is worth a year (the next company it can hold) */
  slotYear: 11.682,
  /** the share of its worth a player bids up to in a merger auction */
  bidShade: 1.1,
  /** a merger is announced when it is expected to gain at least this much */
  announceMin: 31.244,
  /** research: a step of Slots when every slot is full, as a share of the best company it lets one start */
  slotUse: 1.244,
  /** research: a step of Slots with a slot still free, as a share of the same */
  slotSpare: 0,
  /** research: Hull, per ship of one's own lines, as a share of a year's fees over the years left */
  hullUse: 1.395,
  /** research: Mergers, per newly possible merger of one's own companies, per year left */
  mergerResearch: 20,
  /** research: Turn Order Bid, as a share of what going first is worth a year, over the years left */
  bidResearch: 0.322,
  /** turn-order bid: up to this share of what going first is worth this year (the bid is not lost: it goes to the
   *  Bank, which counts at the end; what it costs is cash to spend) */
  orderShade: 0.514,
  /** turn-order bid: never more than this share of cash */
  orderCashMax: 0.445,
  /** research: Expansion, as a share of what one more area a year would sell for every company that can use it */
  expansionK: 0.194,
  /** acquisitions: keeping the last slot for the next era's best company, as a share of its worth */
  passFuture: 0.261,
  /** what a rival's gain counts against mine (advancing another player's Hull helps them too) */
  rivalGain: 0.666,
  /** a delivery that brings a city nearer to growing without completing it: that share of the growth's worth, by
   *  the share of its needs then met */
  growthPartial: 0.044,
  /** era C, slots full: what the leader gains by freeing a slot to take the last companies and end the game */
  closeOut: 384.44,
  /** operating: how much a shipping line is preferred to go before production (its new ships carry this year) */
  shipFirst: -1.693,
};
export type Weights = typeof DEFAULTS;

export const RANGES: Record<keyof Weights, [number, number]> = {
  takeRate: [0.1, 1.2],
  clockScale: [0.5, 2],
  decay: [0.7, 1],
  demandShare: [0.3, 1],
  growth: [0, 1.5],
  unservedIncome: [0, 1],
  shipFee: [1, 15],
  shipSynergy: [0, 15],
  slotYear: [0, 40],
  bidShade: [0.5, 1.1],
  announceMin: [0, 100],
  slotUse: [0, 1.5],
  slotSpare: [0, 0.5],
  hullUse: [0, 2],
  mergerResearch: [0, 20],
  bidResearch: [0, 1],
  orderShade: [0, 1.5],
  orderCashMax: [0, 0.8],
  expansionK: [0, 3],
  passFuture: [0, 1.5],
  rivalGain: [0, 1.5],
  closeOut: [50, 1000],
  growthPartial: [0, 1],
  shipFirst: [-2, 2],
};
