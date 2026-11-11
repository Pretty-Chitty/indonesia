import React from "react";
import { ParameterizedCanvas } from "@pretty-chitty/core";
import { Color, Layered, Pad, RoundedRect, Text } from "@pretty-chitty/core/ReactCanvas";
import { PRINT_SERIF } from "../fonts";

/** The engine's pile counter for a stack of city markers (spec.addCounterToOrderedOutlet sets `value`): "×n" on
 *  cream paper edged in the markers' colour. */
export class CountTagFace extends ParameterizedCanvas {
  width = 160;
  height = 80;
  value = 0;
  border = "#000000";

  protected render() {
    return (
      <RoundedRect radius={18}>
        <Layered>
          <Color hex={this.border} />
          <Pad left={8} right={8} top={8} bottom={8}>
            <RoundedRect radius={12}>
              <Layered>
                <Color hex="#f6efe0" />
                <Text fontSize={46} fontWeight={700} fill="#1e160c" fontFamily={PRINT_SERIF}>
                  {`×${this.value}`}
                </Text>
              </Layered>
            </RoundedRect>
          </Pad>
        </Layered>
      </RoundedRect>
    );
  }
}
