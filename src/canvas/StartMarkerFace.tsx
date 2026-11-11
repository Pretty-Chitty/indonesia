import React from "react";
import { ParameterizedCanvas } from "@pretty-chitty/core";
import { Color, Image, Layered, Pad, Raw, Text } from "@pretty-chitty/core/ReactCanvas";
import { DEED_PANEL, ICON } from "../art";
import { DEEDS } from "../consts";
import { PRINT_SERIF } from "../fonts";
import { SHIP_SHAPES } from "../geometry/pieceShapes";

/** A company start marker (C10): what the company makes, as big as the disc allows, on the deed's own panel colour,
 *  with the era letter at the top centre. A shipping line shows the same ship outline as the ship pieces (the aid's ship glyph is a
 *  thin sliver at this size). */
export class StartMarkerFace extends ParameterizedCanvas {
  width = 256;
  height = 256;
  deedId = 0;

  protected render() {
    const d = DEEDS[this.deedId];
    const light = d.type === "oil";
    const ink = light ? "#f1e9d8" : "#111111";
    return (
      <Layered>
        <Color hex={DEED_PANEL[d.type]} />
        {d.type === "shipping" ? (
          <Raw
            cb={(ctx, x, y, w, h) => {
              const pts = SHIP_SHAPES[1];
              const s = w * 0.66;
              const ox = x + (w - s) / 2;
              const oy = y + h * 0.84;
              ctx.fillStyle = ink;
              ctx.beginPath();
              pts.forEach(([px, py], i) => (i ? ctx.lineTo(ox + px * s, oy - py * s * 0.9) : ctx.moveTo(ox + px * s, oy - py * s * 0.9)));
              ctx.closePath();
              ctx.fill();
            }}
          />
        ) : (
          <Pad left={42} right={42} top={62} bottom={30}>
            <Image image={ICON[d.type]} overlayColor={light ? ink : undefined} />
          </Pad>
        )}
        {/* the era letter at the top centre, inside the round token */}
        <Pad left={98} top={6} right={98} bottom={196}>
          <Text fontSize={46} fontWeight={700} fill={ink} fontFamily={PRINT_SERIF}>
            {d.era.toLowerCase()}
          </Text>
        </Pad>
      </Layered>
    );
  }
}
