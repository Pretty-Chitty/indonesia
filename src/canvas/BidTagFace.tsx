import React from "react";
import { ParameterizedCanvas } from "@pretty-chitty/core";
import { Color, Layered, Pad, RoundedRect, Text } from "@pretty-chitty/core/ReactCanvas";
import { PRINT_SERIF } from "../fonts";

/** The tag over a turn-order disc while bids are made: the player's cash bid (and multiplier) on cream paper with a
 *  border in their colour. */
export class BidTagFace extends ParameterizedCanvas {
  width = 256;
  height = 128;
  label = "0";
  border = "#000000";

  protected render() {
    return (
      <RoundedRect radius={28}>
        <Layered>
          <Color hex={this.border} />
          <Pad left={12} right={12} top={12} bottom={12}>
            <RoundedRect radius={18}>
              <Layered>
                <Color hex="#f6efe0" />
                <Text fontSize={this.label.length > 6 ? 54 : 74} fontWeight={700} fill="#1e160c" fontFamily={PRINT_SERIF}>
                  {this.label}
                </Text>
              </Layered>
            </RoundedRect>
          </Pad>
        </Layered>
      </RoundedRect>
    );
  }
}
