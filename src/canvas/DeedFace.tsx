import React from "react";
import { ImageSpec, ParameterizedCanvas } from "@pretty-chitty/core";
import { Color, Horizontal, Image, Layered, Pad, Spacer, Text, Vertical } from "@pretty-chitty/core/ReactCanvas";
import { DEED_MAP, DEED_PANEL, ICON } from "../art";
import { DEEDS } from "../consts";
import { PRINT_SCRIPT, PRINT_SERIF } from "../fonts";

/** The map side of a company deed (D4): the panel colour of its type, the mini-map of its province, the era letter,
 *  the goods icon and, for a shipping line, its ship limits. Drawn from the same DEEDS record the rules read. */
export class DeedFace extends ParameterizedCanvas {
  width = 512;
  height = 342;
  deedId = 0;

  protected render() {
    const d = DEEDS[this.deedId];
    const ships = d.ships ? d.ships.map((s) => (s === null ? "–" : String(s))).join(" ") : "";
    // the bottom strip (era, ship limits, good) is the face's lowest 190 px: in a merged company each further deed
    // lies under the one before with only that strip showing (DEED_STACK_STEP), so it is big enough to read alone
    return (
      <Layered>
        <Color hex={DEED_PANEL[d.type]} />
        <Pad amount={20}>
          <Vertical>
            <Image size={118} image={DEED_MAP[this.deedId]} fill />
            <Spacer size={14} />
            <DeedStrip era={d.era} ships={ships} icon={ICON[d.type]} />
          </Vertical>
        </Pad>
      </Layered>
    );
  }
}

/** The name side of a deed: the province in the print's script over a faint icon, the era letter, the icon. */
export class DeedBackFace extends ParameterizedCanvas {
  width = 512;
  height = 342;
  deedId = 0;

  protected render() {
    const d = DEEDS[this.deedId];
    return (
      <Layered>
        <Color hex={DEED_PANEL[d.type]} />
        <Pad amount={120}>
          <Image image={ICON[d.type]} overlayColor="#00000033" />
        </Pad>
        <Pad amount={20}>
          <Vertical>
            <Spacer size={14} />
            <Text size={104} fontSize={d.province.length > 16 ? 44 : 56} fill="#111" fontFamily={PRINT_SCRIPT}>
              {d.province}
            </Text>
            <Spacer size={14} />
            <DeedStrip era={d.era} ships="" icon={ICON[d.type]} />
          </Vertical>
        </Pad>
      </Layered>
    );
  }
}

/** The bottom strip of either face, 170 px tall: the era letter, a shipping line's limits for eras A / B / C, and
 *  the good. */
function DeedStrip(props: { era: string; ships: string; icon: ImageSpec }) {
  return (
    <Horizontal>
      <Text size={70} fontSize={110} fill="#111" fontFamily={PRINT_SERIF} align="left">
        {props.era.toLowerCase()}
      </Text>
      <Spacer />
      {props.ships ? (
        <Text size={210} fontSize={76} fill="#111" fontFamily={PRINT_SERIF} align="right">
          {props.ships}
        </Text>
      ) : null}
      <Spacer size={12} />
      <Image size={140} image={props.icon} />
    </Horizontal>
  );
}
