import { AddCircleOutline, Check, Description, Gavel, NotInterested, Sailing, ShoppingCart, ViewModule } from "@mui/icons-material";
import { DynamicGameButton, GameButton, ToggleGalleryButton } from "@pretty-chitty/core";

// Every button carries an icon that says what it does (the engine's default is a generic flip icon). Buttons that
// do the same kind of thing share an icon (every "+n" raise); the button that commits a decision has its own.

export { ToggleGalleryButton } from "@pretty-chitty/core";

export class PassButton extends GameButton {
  override label = "Pass";
  override icon = NotInterested;
}
/** A Pass the player must press even when it is their only choice. With secret money (S7) a pass made for them
 *  the moment they could not afford anything would tell the table their cash was short. */
export class ConfirmPassButton extends PassButton {
  canAutoResolve = false;
}
export class DoneButton extends GameButton {
  override label = "Done";
  override icon = Check;
}
/** A Done the player must press even when it is their only choice (secret money, S7: see ConfirmPassButton). */
export class ConfirmDoneButton extends DoneButton {
  canAutoResolve = false;
}
export class BidButton extends DynamicGameButton<number> {
  override label = "Bid";
  override icon = Gavel;
  process(n: number) {
    this.label = `Bid ${n}`;
  }
}
export class AdjustButton extends DynamicGameButton<number> {
  override label = "+1";
  override icon = AddCircleOutline;
  process(n: number) {
    this.label = n > 0 ? `+${n}` : `${n}`;
  }
}
export class RaiseButton extends DynamicGameButton<number> {
  override label = "Raise";
  override icon = Gavel;
  process(n: number) {
    this.label = `Bid ${n}`;
  }
}
export class BuyButton extends DynamicGameButton<number> {
  override label = "Buy";
  override icon = ShoppingCart;
  process(n: number) {
    this.label = `Buy ${n}`;
  }
}
export class DeliverAllButton extends GameButton {
  override label = "Deliver";
  override icon = Sailing;
}
export class ChoicesButton extends ToggleGalleryButton {
  override label = "Choices";
  override icon = ViewModule;
  override toggleSmallSize = 120;
}
export class CompaniesButton extends ToggleGalleryButton {
  override label = "Companies";
  override icon = Description;
  override toggleSmallSize = 150;
}
