import React from "react";
import { ParameterizedCanvas, PlayerChit } from "@pretty-chitty/core";
import { Color, Horizontal, Layered, Pad, Player, RoundedRect, Spacer, Text, Vertical } from "@pretty-chitty/core/ReactCanvas";
import { PRINT_SERIF } from "../fonts";

/** One player's line on the merger table: their photo in their colour, their name, where they stand in the auction
 *  and what the standing bid means for them. Out of the auction, the line is greyed. */
export class MergerRowFace extends ParameterizedCanvas {
  width = 760;
  height = 110;
  player?: PlayerChit;
  border = "#000000";
  name = "";
  status = "";
  money = "";
  out = false;

  protected render() {
    const ink = this.out ? "#8a8170" : "#1e160c";
    return (
      <RoundedRect radius={22}>
        <Layered>
          <Color hex={this.border} />
          <Pad amount={7}>
            <RoundedRect radius={16}>
              <Layered>
                <Color hex={this.out ? "#ddd5c4" : "#f6efe0"} />
                <Pad amount={8}>
                  <Horizontal>
                    {this.player ? (
                      <Layered size={80}>
                        <RoundedRect radius={12}>
                          <Player player={this.player} />
                        </RoundedRect>
                      </Layered>
                    ) : (
                      <Spacer size={80} />
                    )}
                    <Spacer size={16} />
                    <Vertical size={300}>
                      <Text size={46} fontSize={40} fontWeight={700} fill={ink} fontFamily={PRINT_SERIF} align="left">
                        {this.name}
                      </Text>
                      <Text fontSize={30} fill={ink} fontFamily={PRINT_SERIF} align="left">
                        {this.status}
                      </Text>
                    </Vertical>
                    <Spacer />
                    <Text size={300} fontSize={this.money.length > 22 ? 28 : 36} fontWeight={700} fill={ink} fontFamily={PRINT_SERIF} align="right">
                      {this.money}
                    </Text>
                  </Horizontal>
                </Pad>
              </Layered>
            </RoundedRect>
          </Pad>
        </Layered>
      </RoundedRect>
    );
  }
}

/** The merger table's heading: which two companies, the opening value and the raise. */
export class MergerHeadFace extends ParameterizedCanvas {
  width = 1740;
  height = 110;
  title = "";
  terms = "";

  protected render() {
    return (
      <Pad amount={6}>
        <Vertical>
          <Text size={58} fontSize={50} fontWeight={700} fill="#f6efe0" fontFamily={PRINT_SERIF}>
            {this.title}
          </Text>
          <Text fontSize={34} fill="#e8dcc0" fontFamily={PRINT_SERIF}>
            {this.terms}
          </Text>
        </Vertical>
      </Pad>
    );
  }
}
