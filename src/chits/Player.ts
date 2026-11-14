import { CameraSpec, ChildOutlet, ChitRenderSpec, HiddenPropertySerializationRule, Ordered, OrderedOutlet, PlayerChit, SparkChit } from "@pretty-chitty/core";
import { hideFromOthers } from "../secret";
import { Color, Group, Vector3 } from "three";
import { Company, COMPANY_ROW_GAP, COMPANY_SLOT_W, companyHeight } from "./Company";
import { CityCard } from "./CityCard";
import { BankSpark, CashSpark, EarningsSpark, ResearchSpark } from "./Sparks";
import { AID_H, AID_W, BID_MULTIPLIER, CITY_CARD_H, CITY_CARD_W, DEED_H, DEED_W, RndTrack } from "../consts";
import { CityHand } from "./CityHand";
import { MoneyMat } from "./MoneyMat";
import { tableTop } from "../render";

/** A player: their cash, Bank and this year's earnings (open or secret, S7), their R&D levels (the cubes on the board
 *  show them), their aid sheet with their money, their city card stack, and their companies. */
export class Player extends PlayerChit {
  /** colour index into PLAYER_COLORS */
  seat = 0;
  cash = 0;
  bank = 0;
  /** this year's operations income, kept separate until the year ends (P6L) */
  earnings = 0;
  /** R&D levels (S4, P5): the cubes on the board stand on these steps */
  rnd: Record<RndTrack, number> = { bid: 1, slots: 1, mergers: 1, expansion: 1, hull: 1 };
  /** position in the order of play this year, 0 first (P2.5) */
  order = 0;
  /** bumped after every answered prompt so every answer changes state */
  decisions = 0;
  /** money is secret (S7) and the game is not over: cash, Bank and earnings go to this player only (Root) */
  moneySecret = false;

  override hiddenPropertiesForSerialization(playerIds: string[]): HiddenPropertySerializationRule[] | undefined {
    return hideFromOthers(this.moneySecret, this.playerId, ["cash", "bank", "earnings"], playerIds);
  }

  /** left to right (LAYOUT.md): the player aid with their money, their city card stack, their companies */
  @ChildOutlet(new Vector3(0, 0, 0)) mat = new MoneyMat();
  // the city cards tucked under the aid sheet's bottom-left corner, a third of them sticking out
  @ChildOutlet(new Vector3(-AID_W / 2 + CITY_CARD_W / 2 + 0.25, -AID_H / 2 + CITY_CARD_H / 6, 0)) cityHand = new CityHand();
  @Ordered(new Vector3(AID_W / 2 + 0.6 + DEED_W / 2, AID_H / 2 - DEED_H / 2, 0)) companies = new OrderedOutlet<Company>();

  @ChildOutlet public cashSpark = new CashSpark().set((c) => c.bindToPlayer(this));
  @ChildOutlet public bankSpark = new BankSpark().set((c) => c.bindToPlayer(this));
  @ChildOutlet public earningsSpark = new EarningsSpark().set((c) => c.bindToPlayer(this));

  @ChildOutlet public bidSpark = new ResearchSpark().set((c) => (c.track = "bid"));
  @ChildOutlet public slotsSpark = new ResearchSpark().set((c) => (c.track = "slots"));
  @ChildOutlet public mergersSpark = new ResearchSpark().set((c) => (c.track = "mergers"));
  @ChildOutlet public expansionSpark = new ResearchSpark().set((c) => (c.track = "expansion"));
  @ChildOutlet public hullSpark = new ResearchSpark().set((c) => (c.track = "hull"));

  override getSparks(): SparkChit[] {
    return [this.cashSpark, this.bankSpark, this.earningsSpark, this.bidSpark, this.slotsSpark, this.mergersSpark, this.expansionSpark, this.hullSpark];
  }

  syncSparks() {
    this.cashSpark.value = this.cash;
    this.bankSpark.value = this.bank;
    this.earningsSpark.value = this.earnings;
    this.mat.cash = this.cash;
    this.mat.bank = this.bank;
    this.mat.earnings = this.earnings;
    // the money sparks are bound to the player, so each assignment above set the match score; it is cash + Bank (V2)
    (this as unknown as { matchScoreNumber: number }).matchScoreNumber = this.total(); // internal to the engine typings
    for (const sp of [this.bidSpark, this.slotsSpark, this.mergersSpark, this.expansionSpark, this.hullSpark]) {
      sp.value = sp.track === "bid" ? BID_MULTIPLIER[this.rnd.bid - 1] : this.rnd[sp.track];
      sp.color = this.color;
    }
  }
  addCash(n: number) {
    this.cash += n;
    this.syncSparks();
  }
  addEarnings(n: number) {
    this.earnings += n;
    this.syncSparks();
  }
  addBank(n: number) {
    this.bank += n;
    this.syncSparks();
  }
  /** Rows of three companies; a merged company's deeds run down its slot, so each row is as tall as its tallest
   *  company. Called whenever a company is founded, merged or merged away. */
  layoutCompanies() {
    const all = this.companies.copy();
    let y = 0;
    for (let r = 0; r < all.length; r += 3) {
      const row = all.slice(r, r + 3);
      row.forEach((c, k) => {
        c.slotX = k * COMPANY_SLOT_W;
        c.slotY = -y;
      });
      y += Math.max(...row.map((c) => companyHeight(c.deedCount))) + COMPANY_ROW_GAP;
    }
  }

  /** P4.5: companies owned against Slots research; a merged company counts once. */
  freeSlots(): number {
    return this.rnd.slots - this.companies.length;
  }
  /** V2: what counts at the end: cash and Bank (earnings have been settled into cash by then). */
  total(): number {
    return this.cash + this.bank;
  }
  /** By the company's key (the one its goods and ships carry), not the chit id. */
  companyById(key: string): Company | undefined {
    return this.companies.find((c) => c.key === key);
  }
  cityCard(era: string): CityCard | undefined {
    return this.cityHand.hand.find((c) => c.spec.era === era);
  }

  override render(spec: ChitRenderSpec): void {
    spec.object = new Group();
    spec.childrenOffsetZ = 0;
    // the wood tinted toward the player's colour: a straight multiply of the dark wood by a saturated colour is muddy,
    // so the tint is lifted toward white and a little of the colour is added back as glow
    const tint = new Color(this.color).lerp(new Color("#ffffff"), 0.35);
    const table = tableTop(120, { color: tint, emissive: new Color(this.color), emissiveIntensity: 0.22 });
    table.position.z = -0.02;
    spec.ornaments.push(table);
    spec.camera = new CameraSpec();
    spec.camera.paddingTop = 22;
    spec.camera.paddingBottom = 6;
    spec.camera.paddingLeft = 6;
    spec.camera.paddingRight = 6;
    spec.camera.maxZoom = 4;
    spec.worthSlidingToPanelToShowChange = false;
  }
}
