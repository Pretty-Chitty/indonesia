import { CameraSpec, ChildOutlet, Chit, ChitRenderSpec, Ordered, OrderedOutlet, PanelTab } from "@pretty-chitty/core";
import { StaticImage } from "@pretty-chitty/core";
import { Group, Vector3 } from "three";
import { CompaniesTabIcon } from "../canvas/Icons";
import { DEED_H, DEED_W, Era } from "../consts";
import { MergerTable } from "./MergerTable";
import { Deed } from "./Deed";
import { tableTop } from "../render";

/** The companies available this era (S6, P1.10): the unacquired deeds in a row, with the later eras' deeds in a
 *  face-down pile beside them. A start marker on the board marks each one's province. */
export class Market extends Chit {
  era: Era = "A";

  @Ordered(new Vector3(0, 0, 0)) deeds = new OrderedOutlet<Deed>();
  @Ordered(new Vector3(-(DEED_W + 0.6), 0, 0)) pile = new OrderedOutlet<Deed>();
  /** a merger being auctioned, laid out for everyone just below the deeds on offer (MergerTable.top) */
  @ChildOutlet(new Vector3(0, -(DEED_H / 2 + 0.3), 0)) merger = new MergerTable();

  public get panelTab(): PanelTab {
    return { icon: new CompaniesTabIcon().get(), color: "#447e54" };
  }

  override render(spec: ChitRenderSpec): void {
    spec.object = new Group();
    spec.childrenOffsetZ = 0;
    const table = tableTop(120);
    table.position.z = -0.02;
    spec.ornaments.push(table);
    spec.camera = new CameraSpec();
    spec.camera.paddingTop = 6;
    spec.camera.paddingBottom = 6;
    spec.camera.paddingLeft = 6;
    spec.camera.paddingRight = 6;
    spec.camera.maxZoom = 4;
    spec.summary = `Companies available in era ${this.era}.`;
    // deeds leaving or the pile changing never pull the view here (the action shows on the board)
    spec.worthSlidingToPanelToShowChange = false;
  }
}
