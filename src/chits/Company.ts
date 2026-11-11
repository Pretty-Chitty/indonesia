import { Chit, ChitRenderSpec, Ordered, OrderedOutlet } from "@pretty-chitty/core";
import { Mesh, PlaneGeometry, Vector3 } from "three";
import { CompanyType, DEED_H, DEED_STACK_STEP, DEED_W, Era, ERAS, GOOD_LABEL, GOOD_VALUE, SHIP_VALUE } from "../consts";
import { clickable, invisibleMaterial } from "../render";
import { Deed } from "./Deed";

/** The slot grid on a player's mat: three companies per row (LAYOUT.md). */
export const COMPANY_SLOT_W = DEED_W + 0.45;
/** the gap between rows of companies */
export const COMPANY_ROW_GAP = 0.4;
/** how far a company's column of deeds runs down the mat */
export function companyHeight(deeds: number): number {
  return DEED_H + Math.max(0, deeds - 1) * DEED_STACK_STEP;
}

/** A company a player owns: one deed, or several after mergers (P3.16, P3.18). It takes one slot (P4.5) and
 *  operates as one entity (P6.3). Its goods and ships on the board carry its id. */
export class Company extends Chit {
  type: CompanyType = "rice";
  /** a stable key the company's goods and ships carry (set when the company is founded, kept through mergers) */
  key = "";
  /** which of the two ship drawings this line uses (P3.16), for shipping companies */
  shipType: 1 | 2 = 1;
  /** turned face down once operated this year (P6.1) */
  operated = false;
  /** formed by a merger this year, so it cannot merge again until next year (P3.7) */
  mergedThisYear = false;
  /** the name shown everywhere, refreshed from the deeds when they change (a render reads only this chit) */
  name = "";
  ownerName = "";
  /** its slot on the mat (Player.layoutCompanies): rows of three, each row as tall as its tallest column of deeds */
  slotX = 0;
  slotY = 0;
  /** how many deeds it holds (set by refreshName): the size of the column it is picked by */
  deedsShown = 1;

  @Ordered(new Vector3(0, 0, 0)) deeds = new OrderedOutlet<Deed>();

  get deedCount(): number {
    return this.deeds.length;
  }
  /** Merged shipping lines add their deeds' limits for the era (P3.17); null in era A for a B-only line. */
  shipLimit(era: Era): number {
    let total = 0;
    for (const d of this.deeds.copy()) {
      const s = d.spec.ships;
      if (!s) continue;
      const v = s[ERAS.indexOf(era)];
      total += v ?? 0;
    }
    return total;
  }
  /** The unit value of this company's pieces in a merger (P3.11, P3S.3). */
  unitValue(siapSajiMerger = false): number {
    if (this.type === "shipping") return SHIP_VALUE;
    if (siapSajiMerger) return 25;
    return GOOD_VALUE[this.type];
  }
  refreshName() {
    const deeds = this.deeds.copy();
    if (!deeds.length) return;
    const provinces = deeds.map((d) => d.spec.province);
    this.name = `${provinces.join(" & ")} ${GOOD_LABEL[this.type]}`;
    this.deedsShown = deeds.length;
    this.deeds.forEach((d) => {
      d.faceDown = this.operated;
      d.stackSize = deeds.length;
    });
  }
  setOperated(v: boolean) {
    this.operated = v;
    this.deeds.forEach((d) => (d.faceDown = v));
  }

  override render(spec: ChitRenderSpec): void {
    clickable(spec);
    // the company is its whole column of deeds: an invisible sheet just above them is what a prompt picks and
    // outlines (the deeds keep their own long-press details)
    const n = this.deedsShown;
    const h = companyHeight(n);
    const sheet = new Mesh(new PlaneGeometry(DEED_W, h), invisibleMaterial());
    sheet.position.set(0, DEED_H / 2 - h / 2, (n - 1) * 0.025 + 0.04);
    spec.object = sheet;
    spec.childrenOffsetZ = 0;
    spec.offsetX = this.slotX;
    spec.offsetY = this.slotY;
    spec.worthSlidingToPanelToShowChange = false;
    spec.showDetailsOnLongPress = false; // its deeds carry the long-press
    spec.summary = `**${this.name}** (${this.ownerName}). ${this.operated ? "Has operated this year." : "Not yet operated this year."}${this.mergedThisYear ? " Formed by a merger this year, so it cannot merge again until next year." : ""}`;
  }
}
