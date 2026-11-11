import { Chit, Ordered, OrderedOutlet } from "@pretty-chitty/core";
import { Vector3 } from "three";
import { CityCard } from "./CityCard";
import { Deed } from "./Deed";

/** Deeds out of the game (P1.2, P1.10): never rendered, off every panel. */
export class DeedStore extends Chit {
  @Ordered(new Vector3(0, 0, 0)) deeds = new OrderedOutlet<Deed>();
  override shouldRenderChild(): boolean {
    return false;
  }
}

/** City cards not dealt (fewer than five players) or already used (P1.9): never rendered. */
export class CityCardStore extends Chit {
  @Ordered(new Vector3(0, 0, 0)) cards = new OrderedOutlet<CityCard>();
  override shouldRenderChild(): boolean {
    return false;
  }
}
