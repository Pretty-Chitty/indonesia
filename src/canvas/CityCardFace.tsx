import React from "react";
import { ParameterizedCanvas } from "@pretty-chitty/core";
import { Image, Layered } from "@pretty-chitty/core/ReactCanvas";
import { CITY_MAP } from "../art";
import { CITY_CARDS } from "../consts";

/** A city building card (D3): the printed map with its three provinces, and the era letter. */
export class CityCardFace extends ParameterizedCanvas {
  width = 512;
  height = 307;
  cardId = 0;

  protected render() {
    // the crop carries the printed era letter and province names; nothing is drawn over it
    void CITY_CARDS[this.cardId];
    return (
      <Layered>
        <Image image={CITY_MAP[this.cardId]} fill />
      </Layered>
    );
  }
}
