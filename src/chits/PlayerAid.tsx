import React from "react";
import { DropdownChit, HiddenPropertySerializationRule } from "@pretty-chitty/core";
import {
  BOX_OLIVE,
  BID_MULTIPLIER,
  CITY_CARDS,
  DEEDS,
  Era,
  ERAS,
  GOOD_LABEL,
  GOOD_VALUE,
  GOODS,
  PHASES,
  RND_LABEL,
  RND_TRACKS,
  SHIP_VALUE,
  SIAP_SAJI_MERGER_UNIT,
  STARTING_CASH,
  TRANSPORT_FEE,
} from "../consts";
import type { Root } from "./Root";
import { HIDDEN } from "../secret";

const MONEY_FIELDS = ["money0", "money1", "money2", "money3", "money4"] as const;
type MoneyField = (typeof MONEY_FIELDS)[number];

interface CompanyFact {
  name: string;
  type: string;
  pieces: number;
  limit: number | null;
  operated: boolean;
}
interface PlayerFact {
  name: string;
  color: string;
  order: number;
  /** which money field holds this player's cash, Bank and earnings (money0…money4: hidden per viewer, S7) */
  moneyField: string;
  slots: number;
  rnd: Record<string, number>;
  companies: CompanyFact[];
}
interface Facts {
  era: Era;
  year: number;
  phase: number;
  players: PlayerFact[];
  market: string[];
  supply: [number, number, number];
  produced: string[];
  cities: { province: string; size: number; delivered: string }[];
}

/** The player aid (C4) made live: the phase sequence, every player's money, research and companies as the table
 *  shows them, the companies on offer, the city supply, and the printed values. Nothing in it is clickable. The
 *  body renders only from `facts`, a digest refreshed at every prompt, so it never shows a stale table. */
export class PlayerAid extends DropdownChit {
  era: Era = "A";
  year = 0;
  phase = 0;
  facts = "";
  /** each seat's money as "cash|bank|earnings", in its own field so secret money (S7) can go to its owner only */
  money0?: string = undefined;
  money1?: string = undefined;
  money2?: string = undefined;
  money3?: string = undefined;
  money4?: string = undefined;
  /** the player id each money field belongs to */
  moneyOwners: string[] = [];
  moneySecret = false;

  override hiddenPropertiesForSerialization(playerIds: string[]): HiddenPropertySerializationRule[] | undefined {
    if (!this.moneySecret) return undefined;
    // one rule per viewer (the engine applies the first that names them): every seat's money but their own
    return playerIds.map((id) => ({ fields: MONEY_FIELDS.filter((_, k) => this.moneyOwners[k] !== id), playerIds: [id] }));
  }

  refresh(root: Root) {
    const f: Facts = {
      era: root.era,
      year: root.year,
      phase: root.phase,
      players: root.playersInOrder().map((p) => ({
        name: p.name,
        color: p.color,
        order: p.order + 1,
        moneyField: MONEY_FIELDS[root.players.copy().indexOf(p)],
        slots: p.rnd.slots,
        rnd: { ...p.rnd },
        companies: p.companies.map((c) => ({
          name: c.name,
          type: c.type,
          pieces: c.type === "shipping" ? root.board.shipsOf(c.key).length : root.board.goodsOf(c.key).length,
          limit: c.type === "shipping" ? c.shipLimit(root.era) : null,
          operated: c.operated,
        })),
      })),
      market: root.market.deeds.map((d) => d.name),
      supply: [root.tracks.supply.count(1), root.tracks.supply.count(2), root.tracks.supply.count(3)],
      produced: root.board.producedGoods(),
      cities: root.board.cities().map(({ land, city }) => ({ province: land.province, size: city.size, delivered: city.display()?.heldText ?? "nothing yet" })),
    };
    const json = JSON.stringify(f);
    if (json !== this.facts) this.facts = json;
    const players = root.players.copy();
    this.moneyOwners = players.map((p) => p.playerId);
    MONEY_FIELDS.forEach((field, k) => {
      const p = players[k];
      const v = p ? `${p.cash}|${p.bank}|${p.earnings}` : undefined;
      if (this[field] !== v) this[field] = v;
    });
    this.era = root.era;
    this.year = root.year;
    this.phase = root.phase;
  }

  renderLabel() {
    return this.year === 0 ? "Indonesia" : `Era ${this.era}, year ${this.year}: ${PHASES[this.phase]}`;
  }

  renderBody() {
    const f: Facts | undefined = this.facts ? (JSON.parse(this.facts) as Facts) : undefined;
    const css = `
      .aid { font-family: 'EB Garamond', Georgia, serif; font-size: 14px; line-height: 1.3; color: #2a2420; padding: 6px 10px; container-type: inline-size; }
      .aid h3 { font-family: 'Dancing Script', cursive; font-size: 20px; margin: 0 0 4px; color: ${BOX_OLIVE}; }
      .aid .stacks { display: flex; gap: 14px; align-items: flex-start; }
      .aid .stack { display: flex; flex-direction: column; gap: 12px; flex: 1 1 0; min-width: 0; }
      .aid section { background: #f1e9d8; border: 1px solid #c9bca4; border-radius: 6px; padding: 8px 10px; }
      .aid table { border-collapse: collapse; width: 100%; }
      .aid td, .aid th { padding: 1px 6px 1px 0; text-align: left; vertical-align: top; }
      .aid th { font-weight: 700; border-bottom: 1px solid #c9bca4; }
      .aid .num { text-align: right; }
      .aid .chip { display: inline-block; background: #e3d6bd; border-radius: 10px; padding: 1px 8px; margin: 2px 4px 2px 0; }
      .aid .now { background: ${BOX_OLIVE}; color: #fff; }
      .aid .dot { display: inline-block; width: 10px; height: 10px; border-radius: 5px; margin-right: 4px; vertical-align: middle; }
      .aid .wide { margin-top: 12px; }
      .aid .cols { columns: 3; column-gap: 16px; }
      @container (max-width: 1000px) { .aid .cols { columns: 2; } }
      @container (max-width: 640px) { .aid .stacks { display: block; } .aid .stack { margin-bottom: 12px; } .aid .cols { columns: 1; } }
    `;
    return (
      <div className="aid">
        <style>{css}</style>
        <div className="stacks">
          <div className="stack">
            <section>
              <h3>Game sequence</h3>
              {PHASES.map((p, i) => (
                <span key={p} className={"chip" + (f && i === f.phase ? " now" : "")}>
                  {i + 1} {p}
                </span>
              ))}
              <div style={{ marginTop: 6 }}>
                A year is seven phases. The era changes (and cities are built) in phase 1 when no company of the era is left to start, or only one type is. The game ends when era C ends; last year's earnings are doubled.
              </div>
            </section>
            <section>
              <h3>Values</h3>
              <table>
                <tbody>
                  {GOODS.map((g) => (
                    <tr key={g}>
                      <td>{GOOD_LABEL[g]}</td>
                      <td className="num">{GOOD_VALUE[g]}</td>
                    </tr>
                  ))}
                  <tr>
                    <td>ship (in a merger)</td>
                    <td className="num">{SHIP_VALUE}</td>
                  </tr>
                  <tr>
                    <td>transport, per ship used</td>
                    <td className="num">{TRANSPORT_FEE}</td>
                  </tr>
                  <tr>
                    <td>siap saji merger, per rice or spice</td>
                    <td className="num">{SIAP_SAJI_MERGER_UNIT}</td>
                  </tr>
                  <tr>
                    <td>turn order bid multiplier</td>
                    <td className="num">{BID_MULTIPLIER.map((m) => `×${m}`).join(" ")}</td>
                  </tr>
                  <tr>
                    <td>starting cash</td>
                    <td className="num">{STARTING_CASH}</td>
                  </tr>
                </tbody>
              </table>
            </section>
          </div>
          <div className="stack">
            <section>
              <h3>Players</h3>
              {f ? (
                <table>
                  <thead>
                    <tr>
                      <th>order</th>
                      <th className="num">cash</th>
                      <th className="num">bank</th>
                      <th className="num">earned</th>
                      <th className="num">slots</th>
                      {RND_TRACKS.filter((t) => t !== "slots").map((t) => (
                        <th key={t} className="num">
                          {RND_LABEL[t].replace("Turn Order Bid", "bid")}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {f.players.map((p) => (
                      <tr key={p.name}>
                        <td>
                          <span className="dot" style={{ background: p.color }} />
                          {p.order}. {p.name}
                        </td>
                        {(this[p.moneyField as MoneyField]?.split("|") ?? [HIDDEN, HIDDEN, HIDDEN]).map((v, k) => (
                          <td key={k} className="num">
                            {v}
                          </td>
                        ))}
                        <td className="num">
                          {p.companies.length}/{p.slots}
                        </td>
                        {RND_TRACKS.filter((t) => t !== "slots").map((t) => (
                          <td key={t} className="num">
                            {t === "bid" ? `×${BID_MULTIPLIER[p.rnd[t] - 1]}` : p.rnd[t]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div>The table is being set up.</div>
              )}
            </section>
            <section>
              <h3>Companies</h3>
              {f ? (
                <table>
                  <tbody>
                    {f.players.map((p) =>
                      p.companies.map((c, i) => (
                        <tr key={p.name + i}>
                          <td>{i === 0 ? <span className="dot" style={{ background: p.color }} /> : null}</td>
                          <td>
                            {c.name}
                            {c.operated ? " (operated)" : ""}
                          </td>
                          <td className="num">{c.type === "shipping" ? `${c.pieces} / ${c.limit} ships` : `${c.pieces} ${GOOD_LABEL[c.type as keyof typeof GOOD_LABEL]}`}</td>
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
              ) : null}
              {f ? <div style={{ marginTop: 6 }}>On offer this era: {f.market.length ? f.market.join(", ") : "nothing"}.</div> : null}
            </section>
          </div>
          <div className="stack">
            <section>
              <h3>Cities</h3>
              {f ? (
                <>
                  <div>
                    Goods produced now: {f.produced.length ? f.produced.map((g) => GOOD_LABEL[g as keyof typeof GOOD_LABEL]).join(", ") : "none"}. A city grows at the end of a year in which it received its size in every one of them.
                  </div>
                  <div>
                    Markers left: {f.supply[0]} size 1, {f.supply[1]} size 2, {f.supply[2]} size 3.
                  </div>
                  <table style={{ marginTop: 4 }}>
                    <tbody>
                      {f.cities.map((c) => (
                        <tr key={c.province}>
                          <td>{c.province}</td>
                          <td className="num">size {c.size}</td>
                          <td>{c.delivered}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : null}
            </section>
            <section>
              <h3>How money moves</h3>
              <div>
                Selling a good pays its value to the producer, who pays {TRANSPORT_FEE} per ship used to the line's owner (nothing for their own ships). Income is kept as earnings until the year ends. A merger's opening bid is the companies' goods and ships at their values; raises are multiples of that count; the winner pays the former owners in proportion. Paid expansion costs the good's value per area, from cash. Turn-order bids go to the Bank for good.
              </div>
            </section>
          </div>
        </div>
        <section className="wide">
          <h3>Company deeds</h3>
          <div className="cols">
            {ERAS.map((era) => (
              <div key={era}>
                <b>Era {era}</b>
                <table>
                  <tbody>
                    {DEEDS.filter((d) => d.era === era).map((d) => (
                      <tr key={d.id}>
                        <td>{d.province}</td>
                        <td>{GOOD_LABEL[d.type]}</td>
                        <td className="num">{d.ships ? d.ships.map((s) => (s === null ? "–" : s)).join(" / ") : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </section>
        <section className="wide">
          <h3>City cards</h3>
          <div className="cols">
            {ERAS.map((era) => (
              <div key={era}>
                <b>Era {era}</b>
                <table>
                  <tbody>
                    {CITY_CARDS.filter((c) => c.era === era).map((c) => (
                      <tr key={c.id}>
                        <td>{c.provinces.join(", ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }
}
