import { CardMesh, Chit, ChitRenderSpec, HiddenPropertySerializationRule, StaticImage } from "@pretty-chitty/core";
import { CARD_BACK } from "../art";
import { CityCardFace } from "../canvas/CityCardFace";
import { CITY_CARD_H, CITY_CARD_W, CITY_CARDS } from "../consts";
import { clickable, galleryFit, LIFT } from "../render";

/** A city building card (C2, D3): the three provinces a player may build their city in when its era starts (P1.5).
 *  Secret: only its holder sees its face until its era begins, when it is turned face up for everyone and then
 *  discarded (P1.9). Cards not dealt are never seen. */
export class CityCard extends Chit {
  /** -1 (or absent) when this viewer may not see which card it is */
  cardId = -1;
  /** turned face up for everyone when its era begins */
  revealed = false;

  get spec() {
    return CITY_CARDS[this.cardId];
  }

  override hiddenPropertiesForSerialization(playerIds: string[]): HiddenPropertySerializationRule[] | undefined {
    if (this.revealed) return undefined;
    if (this.parentOutlet === "hand") {
      // in a player's stack: only the holder sees the face
      const holder = (this.parent as { holderId?: string } | undefined)?.holderId;
      return [{ fields: ["cardId"], playerIds: playerIds.filter((id) => id !== holder) }];
    }
    // undealt, or discarded unseen: nobody sees it
    return [{ fields: ["cardId"], playerIds }];
  }

  override render(spec: ChitRenderSpec): void {
    clickable(spec);
    const known = typeof this.cardId === "number" && this.cardId >= 0;
    const back = StaticImage.material(CARD_BACK);
    const front = known
      ? new CityCardFace().set((f) => {
          f.cardId = this.cardId;
        }).material
      : back;
    spec.object = new CardMesh(CITY_CARD_W, CITY_CARD_H, front, back, { castShadow: true, receiveShadow: true, zDifference: 0.02 });
    spec.rotationSpeed = 600;
    spec.worthSlidingToPanelToShowChange = false; // a card moving or flipping never pulls the view to its panel
    spec.zLiftRatio = LIFT.card;
    if (this.parentOutlet === "hand") {
      // one face-down stack on the mat; the gallery turns them face up for the holder
      spec.rotateY = Math.PI;
      spec.splay.enabled = true;
      spec.splay.rows = 1;
      spec.splay.columns = 1;
    } else {
      spec.rotateY = known ? 0 : Math.PI;
    }
    spec.showDetailsOnLongPress = true;
    galleryFit(spec, CITY_CARD_W, CITY_CARD_H, 440);
    if (!known) {
      spec.summary = "**City card**: secret until its era begins. Then its holder builds a city in one of the three provinces it names.";
      return;
    }
    const c = this.spec;
    spec.summary = `**Era ${c.era} city card**${this.revealed ? "" : " (only you can see it)"}: when era ${c.era} begins, build a size 1 city on an empty coastal area of ${c.provinces[0]}, ${c.provinces[1]} or ${c.provinces[2]} (one city per province).`;
  }
}
