import React from "react";
import { ParameterizedCanvas } from "@pretty-chitty/core";
import { Horizontal, Image, Layered, Pad, Text } from "@pretty-chitty/core/ReactCanvas";
import { AID_BANK, AID_CASH } from "../art";
import { PRINT_SERIF } from "../fonts";
import { shown } from "../secret";

/** A player's money mat: the player aid's printed "Bank" and "Cash" boxes (C4) side by side, each amount written
 *  under its title, and this year's earnings (kept apart until the year ends, P6L.1) under Cash. */
export class MoneyMatFace extends ParameterizedCanvas {
  width = 800;
  height = 323;
  /** undefined: kept secret from this viewer (S7), shown as "–" */
  cash?: number = 0;
  bank?: number = 0;
  earnings?: number = 0;

  protected render() {
    const ink = "#2a2016";
    const amount = (n: number | undefined) => (
      <Pad left={20} right={20} top={150} bottom={50}>
        <Text fontSize={112} fontWeight={700} fill={ink} fontFamily={PRINT_SERIF}>
          {shown(n)}
        </Text>
      </Pad>
    );
    return (
      <Layered>
        <Horizontal>
          <Layered>
            <Image image={AID_BANK} fill />
            {amount(this.bank)}
          </Layered>
          <Layered>
            <Image image={AID_CASH} fill />
            {amount(this.cash)}
            {this.earnings !== undefined && this.earnings !== 0 ? (
              <Pad left={20} right={20} top={270} bottom={10}>
                <Text fontSize={34} fontWeight={700} fill={this.earnings > 0 ? "#2f5d2f" : "#8a1f14"} fontFamily={PRINT_SERIF}>
                  {`${this.earnings > 0 ? "+" : ""}${this.earnings} earned this year`}
                </Text>
              </Pad>
            ) : null}
          </Layered>
        </Horizontal>
      </Layered>
    );
  }
}
