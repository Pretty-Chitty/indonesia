import { ChildOutlet, Chit, ChitRenderSpec, Ordered, OrderedOutlet } from "@pretty-chitty/core";
import { Mesh, PlaneGeometry, Vector3 } from "three";
import { CITY_CARD_H, CITY_CARD_W } from "../consts";
import { clickable, galleryFit, invisibleMaterial } from "../render";
import { CityCard } from "./CityCard";

/** A player's city cards (C2): one face-down stack on their mat. Its holder opens it to read the faces; everyone
 *  else sees only backs. When a card's era begins it is laid face up beside the stack, used, then discarded. */
export class CityHand extends Chit {
  /** the player who may read these cards */
  holderId = "";

  @Ordered(new Vector3(0, 0, 0)) hand = new OrderedOutlet<CityCard>();
  /** the card of a new era, laid face up just below the tucked stack, clear of the aid sheet */
  @ChildOutlet(new Vector3(0, -(CITY_CARD_H + 0.2), 0)) shown?: CityCard;

  override render(spec: ChitRenderSpec): void {
    clickable(spec);
    // the stack is tucked under the aid sheet with its lowest third showing: that third is the tap area that opens it
    const tap = new Mesh(new PlaneGeometry(CITY_CARD_W, CITY_CARD_H / 3), invisibleMaterial());
    tap.position.y = -CITY_CARD_H / 3;
    spec.object = tap;
    spec.childrenOffsetZ = 0;
    spec.showChildrenAsGallery();
    spec.showDetailsOnLongPress = false;
    spec.worthSlidingToPanelToShowChange = false;
    galleryFit(spec, CITY_CARD_W, CITY_CARD_H, 440);
    spec.summary = "City cards: secret until their era begins.";
  }
}
