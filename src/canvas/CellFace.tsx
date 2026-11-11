import React from "react";
import { ParameterizedCanvas } from "@pretty-chitty/core";
import { Color, Layered, MultiLineText } from "@pretty-chitty/core/ReactCanvas";
import { PRINT_SERIF } from "../fonts";

/** The picture of a Turn Order or R&D space in the tap chooser: the track's name and the step, on the table's paper. */
export class CellFace extends ParameterizedCanvas {
  width = 256;
  height = 256;
  label = "Slots\n2";

  protected render() {
    return (
      <Layered>
        <Color hex="#e9e4da" />
        <MultiLineText fontSize={52} color="#1e160c" fontFamily={PRINT_SERIF} align="center" verticalAlign="middle">
          {this.label}
        </MultiLineText>
      </Layered>
    );
  }
}
