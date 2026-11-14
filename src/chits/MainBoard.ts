import { CameraSpec, ChildOutlet, Chit, ChitRenderSpec, Ordered, OrderedOutlet, PanelTab } from "@pretty-chitty/core";
import { BoxGeometry, Mesh, Vector3 } from "three";
import { StaticImage } from "@pretty-chitty/core";
import { BOARD } from "../art";
import { BoardTabIcon, LAND_BROWN } from "../canvas/Icons";
import { BOARD_THICKNESS, CitySize, Good, Province } from "../consts";
import { LAND_AREAS, SEA_AREAS } from "../geometry/map";
import { coastSeas, landNeighbours, provinceAreas, SHOWN_H, SHOWN_W } from "../geometry/mapIndex";
import { DeliveryProblem, seasBorderingAreas, shipExpansionSeas, zonesOf } from "../logistics";
import { artMaterial, colorMaterial, tableTop } from "../render";
import { City } from "./City";
import { StartMarker } from "./StartMarker";
import { Company } from "./Company";
import { Deed } from "./Deed";
import { GoodsMarker } from "./GoodsMarker";
import { LandArea } from "./LandArea";
import { Player } from "./Player";
import { SeaArea } from "./SeaArea";
import { Ship } from "./Ship";

/** The board (C1): the map with every land and sea area, plus the city marker supply beside it. The Turn Order
 *  track and R&D table printed on it are their own panel (Tracks). Every geometric rule (adjacency, coasts, zones, legal placements)
 *  is answered here, once. */
export class MainBoard extends Chit {
  @Ordered(new Vector3(0, 0, 0)) lands = new OrderedOutlet<LandArea>();
  @Ordered(new Vector3(0, 0, 0)) seas = new OrderedOutlet<SeaArea>();
  @Ordered(new Vector3(0, 0, 0)) startMarkers = new OrderedOutlet<StartMarker>();

  /** Fills the board with its printed areas. Called once at setup, before the first flush. */
  build() {
    if (this.lands.length) return;
    for (const a of LAND_AREAS) {
      this.lands.add(
        new LandArea().set((l) => {
          l.areaId = a.id;
          l.province = a.province as Province;
          l.coastal = a.coastal;
        }),
      );
    }
    for (const s of SEA_AREAS) this.seas.add(new SeaArea().set((x) => (x.areaId = s.id)));
  }

  land(id: number): LandArea {
    const l = this.lands.find((x) => x.areaId === id);
    if (!l) throw new Error(`no land area ${id}`);
    return l;
  }
  sea(id: number): SeaArea {
    const s = this.seas.find((x) => x.areaId === id);
    if (!s) throw new Error(`no sea area ${id}`);
    return s;
  }
  cities(): { land: LandArea; city: City }[] {
    return this.lands.copy().flatMap((l) => (l.city ? [{ land: l, city: l.city }] : []));
  }
  cityIn(province: Province): LandArea | undefined {
    return this.lands.find((l) => l.province === province && !!l.city);
  }
  /** Land areas holding this company's goods (P6P.1). */
  goodsOf(companyId: string): LandArea[] {
    return this.lands.filter((l) => l.good?.companyId === companyId);
  }
  /** This company's ships, by sea area. */
  shipsOf(companyId: string): { sea: SeaArea; ship: Ship }[] {
    return this.seas.copy().flatMap((sea) => sea.ships.filter((s) => s.companyId === companyId).map((ship) => ({ sea, ship })));
  }
  /** Every ship shows as many capacity markers as its owner's Hull (P6P.6), and each sea lays out its ships. */
  syncShipCapacity(players: { seat: number; rnd: { hull: number } }[]) {
    for (const sea of this.seas.copy()) {
      for (const ship of sea.ships.copy()) {
        // by colour: a ship always shows its owner's colour (P3.16), even before the new company is on the mat
        const owner = players.find((p) => p.seat === ship.seat);
        ship.syncCapacity(owner?.rnd.hull ?? 1);
      }
      sea.layoutShips();
    }
  }
  zonesOf(companyId: string): number[][] {
    return zonesOf(this.goodsOf(companyId).map((l) => l.areaId));
  }
  /** One ownership hut per connected area of each company (C5): the marker that already carries one keeps it,
   *  otherwise the zone's lowest-numbered area takes it. Call after goods are placed, removed or change hands. */
  syncHuts() {
    const byCompany = new Map<string, number[]>();
    this.lands.forEach((l) => {
      if (l.good) byCompany.set(l.good.companyId, [...(byCompany.get(l.good.companyId) ?? []), l.areaId]);
    });
    for (const areas of byCompany.values()) {
      for (const zone of zonesOf(areas)) {
        const markers = zone.map((id) => this.land(id).good!);
        const keeper = markers.find((m) => m.hut) ?? markers[0];
        for (const m of markers) {
          const want = m === keeper;
          if (m.hut !== want) m.hut = want;
        }
      }
    }
  }

  /** The goods types produced anywhere on the board right now (P6P.2, P7.6). */
  producedGoods(): Good[] {
    const set = new Set<Good>();
    this.lands.forEach((l) => {
      if (l.good) set.add(l.good.good);
    });
    return [...set];
  }

  /** P1.7, P1.8: empty coastal land areas of these provinces, in provinces that have no city yet. */
  legalCitySites(provinces: readonly Province[]): LandArea[] {
    return this.lands.filter((l) => provinces.includes(l.province) && l.coastal && l.isEmpty && !this.cityIn(l.province));
  }

  /** P4.6: empty land areas of the deed's province not adjacent to a goods marker of the same type. */
  legalStartAreas(deed: Deed): LandArea[] {
    const d = deed.spec;
    if (d.type === "shipping") return [];
    return this.lands.filter(
      (l) => l.province === d.province && l.isEmpty && !landNeighbours(l.areaId).some((n) => this.land(n).good?.good === d.type),
    );
  }
  /** P4.7: sea areas bordering the deed's province. Existing ships never hinder placement. */
  legalShipStarts(deed: Deed): SeaArea[] {
    return seasBorderingAreas(provinceAreas(deed.spec.province)).map((id) => this.sea(id));
  }
  /** P1.2: a deed that can no longer start anywhere. */
  canStart(deed: Deed): boolean {
    return deed.spec.type === "shipping" ? this.legalShipStarts(deed).length > 0 : this.legalStartAreas(deed).length > 0;
  }

  /** P6P.12, P6P.13: empty land areas next to one of the company's zones (arrows count), not touching another
   *  company's zone of the same good. A city or any company's goods block. */
  expansionTargets(company: Company): LandArea[] {
    const own = new Set(this.goodsOf(company.key).map((l) => l.areaId));
    const good = company.type as Good;
    const out: LandArea[] = [];
    for (const l of this.lands.copy()) {
      if (!l.isEmpty || own.has(l.areaId)) continue;
      const neighbours = landNeighbours(l.areaId);
      if (!neighbours.some((n) => own.has(n))) continue;
      const touchesRival = neighbours.some((n) => {
        const g = this.land(n).good;
        return g && g.good === good && g.companyId !== company.key;
      });
      if (!touchesRival) out.push(l);
    }
    return out;
  }
  /** P6S.4: sea areas holding one of the company's ships, or adjacent to one. */
  shipExpansionTargets(company: Company): SeaArea[] {
    return shipExpansionSeas(this.shipsOf(company.key).map((s) => s.sea.areaId)).map((id) => this.sea(id));
  }

  /** A company's pieces on the map: its plantations, or its ships. */
  piecesOf(c: Company): (GoodsMarker | Ship)[] {
    return c.type === "shipping" ? this.shipsOf(c.key).map((s) => s.ship) : this.goodsOf(c.key).map((l) => l.good!);
  }
  /** Lift a company's pieces off the map, outlined in white, while it is operated or in a merger (or set them down). */
  raise(c: Company, raised: boolean) {
    for (const x of this.piecesOf(c)) x.raised = raised;
  }

  /** The delivery network for a production company's operation (P6P), as plain data. */
  deliveryProblem(company: Company, players: Player[]): DeliveryProblem {
    const good = company.type as Good;
    const zones = this.zonesOf(company.key).map((areas) => ({ areas, goods: areas.length }));
    const lines = players.flatMap((p) =>
      p.companies
        .filter((c) => c.type === "shipping")
        .map((c) => {
          const ships = new Map<number, number>();
          for (const { sea } of this.shipsOf(c.key)) ships.set(sea.areaId, (ships.get(sea.areaId) ?? 0) + 1);
          return { companyId: c.key, ownerId: p.playerId, hull: p.rnd.hull, ships, used: new Map<number, number>() };
        })
        .filter((l) => l.ships.size > 0),
    );
    const cities = this.cities().map(({ land, city }) => ({
      landArea: land.areaId,
      size: city.size,
      delivered: city.deliveredGoods().filter((d) => d.good === good).length,
    }));
    const sellerId = players.find((p) => p.companies.copy().includes(company))?.playerId;
    return { good, sellerId, zones, lines, cities };
  }

  /** P7.1: a city grows if it received its full demand of every good produced on the board. */
  cityCanGrow(city: City): boolean {
    if (city.size >= 3) return false;
    const produced = this.producedGoods();
    // a city needs only the goods produced on the board: with nothing produced it lacks nothing, and grows
    // (Q-growth-empty)
    if (!produced.length) return true;
    return produced.every((g) => city.deliveredGoods().filter((d) => d.good === g).length >= city.size);
  }

  /** Sea areas touching a land area (for summaries and the AI). */
  coastOf(land: LandArea): SeaArea[] {
    return coastSeas(land.areaId).map((id) => this.sea(id));
  }

  public get panelTab(): PanelTab {
    return { icon: new BoardTabIcon().get(), color: LAND_BROWN }; // the icon's ground
  }

  override render(spec: ChitRenderSpec): void {
    // the board: a cardboard slab with the print on top, its edge in the paper frame's colour
    const edge = colorMaterial("#cfc2ae", 4);
    // the shown board: the land plus a margin (the art is cropped to the same rectangle)
    const slab = new Mesh(new BoxGeometry(SHOWN_W, SHOWN_H, BOARD_THICKNESS), [edge, edge, edge, edge, artMaterial(BOARD), edge]);
    slab.castShadow = true;
    slab.receiveShadow = true;
    spec.object = slab;
    spec.childrenOffsetZ = 0;
    // the DLC's wooden table under everything
    const table = tableTop(200);
    table.position.z = -BOARD_THICKNESS - 0.02;
    spec.ornaments.push(table);
    spec.camera = new CameraSpec();
    spec.camera.paddingTop = 4;
    spec.camera.paddingBottom = 4;
    spec.camera.paddingLeft = 4;
    spec.camera.paddingRight = 4;
    spec.camera.maxZoom = 12; // the map has small islets and crowded coasts: let players zoom right in
    spec.worthSlidingToPanelToShowChange = false;
  }
}

export type { CitySize };
