import { CameraSpec, ChildOutlet, Chit, ChitRenderSpec, Ordered, OrderedOutlet, PanelTab } from "@pretty-chitty/core";
import { CitySupply } from "./CitySupply";
import { BoxGeometry, Mesh, Vector3 } from "three";
import { TRACKS_ART } from "../art";
import { TracksTabIcon } from "../canvas/Icons";
import { BOARD_PX_PER_UNIT, BOARD_THICKNESS } from "../consts";
import { TABLE_CELLS } from "../geometry/map";
import { TRACKS_RECT } from "../geometry/tracks";
import { artMaterial, colorMaterial, tableTop } from "../render";
import { TableCell } from "./TableCell";

/** The Turn Order track and the Research & Development table (M7, S4, S5), cut from the board's lower left into
 *  their own panel so the cubes and discs read at any size. Same print, same scale as the board. */
export class Tracks extends Chit {
  @Ordered(new Vector3(0, 0, 0)) cells = new OrderedOutlet<TableCell>();
  /** the unused city markers, beside the table: running out is a rule (P1.9, P7.4) */
  @ChildOutlet(new Vector3(0, 0, 0)) supply = new CitySupply();

  build() {
    if (this.cells.length) return;
    for (const c of TABLE_CELLS) {
      this.cells.add(
        new TableCell().set((t) => {
          t.row = c.row;
          t.step = c.step;
        }),
      );
    }
  }
  cell(row: string, step: number): TableCell {
    const c = this.cells.find((x) => x.row === row && x.step === step);
    if (!c) throw new Error(`no table cell ${row} ${step}`);
    return c;
  }

  public get panelTab(): PanelTab {
    return { icon: new TracksTabIcon().get(), color: "#8a8f96" };
  }

  override render(spec: ChitRenderSpec): void {
    const [x0, y0, x1, y1] = TRACKS_RECT;
    const w = (x1 - x0) / BOARD_PX_PER_UNIT;
    const h = (y1 - y0) / BOARD_PX_PER_UNIT;
    const edge = colorMaterial("#cfc2ae", 4);
    const slab = new Mesh(new BoxGeometry(w, h, BOARD_THICKNESS), [edge, edge, edge, edge, artMaterial(TRACKS_ART), edge]);
    slab.castShadow = true;
    slab.receiveShadow = true;
    spec.object = slab;
    spec.childrenOffsetZ = 0;
    const table = tableTop(120);
    table.position.z = -BOARD_THICKNESS - 0.02;
    spec.ornaments.push(table);
    spec.camera = new CameraSpec();
    spec.camera.paddingTop = 4;
    spec.camera.paddingBottom = 4;
    spec.camera.paddingLeft = 4;
    spec.camera.paddingRight = 4;
    spec.camera.maxZoom = 4;
    spec.worthSlidingToPanelToShowChange = false;
  }
}
