import {
  ChildOutlet,
  DropdownChit,
  LayoutNode,
  RootChit,
  Selectable,
  Turn,
} from "@pretty-chitty/core";
import { Era, PHASES } from "../consts";
import { MainBoard } from "./MainBoard";
import { Market } from "./Market";
import { Player } from "./Player";
import { PlayerAid } from "./PlayerAid";
import { Tracks } from "./Tracks";
import { CityCardStore, DeedStore } from "./Stores";

/** The table. Game state that belongs to no player lives here: the era, the year, the phase, the order of play. */
export class Root extends RootChit<Player> {
  minPlayers = 2;
  maxPlayers = 5;

  era: Era = "A";
  year = 0;
  /** the year the current era began (phase 1) */
  eraStartYear = 1;
  /** index into PHASES of the phase in progress, for the player aid */
  phase = 0;
  /** player ids in the order of play this year (S5, P2.5) */
  turnOrder: string[] = [];
  /** set by phase 1 when era C ended (V1) */
  gameOver = false;

  /** S7: money open, or secret (the book's default: "If you forget to agree, the amount of money players have will be
   *  secret"). Secret: every player sees only their own cash, Bank and earnings until the game ends. */
  @Selectable({
    label: "Money",
    choices: [
      { id: "secret", label: "Secret" },
      { id: "open", label: "Open" },
    ],
  })
  public money: "secret" | "open" = "secret";

  /** Whether money is hidden right now: secret money, until the game is over. */
  moneyIsSecret(): boolean {
    return this.money === "secret" && !this.gameOver;
  }
  /** Tell every chit that shows money whether to hide it (at setup, and once the game is over). */
  syncMoneySecrecy() {
    const secret = this.moneyIsSecret();
    for (const p of this.players.copy()) {
      p.moneySecret = secret;
      p.mat.secret = secret;
      p.mat.ownerId = p.playerId;
      for (const sp of [p.cashSpark, p.bankSpark, p.earningsSpark]) {
        sp.secret = secret;
        sp.ownerId = p.playerId;
      }
    }
    this.playerAid.moneySecret = secret;
    this.playerAid.refresh(this); // the aid's money rows are current when they are revealed
  }

  @ChildOutlet public board = new MainBoard();
  @ChildOutlet public market = new Market();
  @ChildOutlet public tracks = new Tracks();
  @ChildOutlet public deedStore = new DeedStore();
  @ChildOutlet public cityCardStore = new CityCardStore();
  @ChildOutlet public playerAid = new PlayerAid();

  get turn(): Turn<any, Player, Root> {
    return this.currentTurn;
  }
  playersInOrder(): Player[] {
    return this.turnOrder.map(
      (id) => this.players.find((p) => p.playerId === id)!,
    );
  }
  player(id: string): Player {
    return this.players.find((p) => p.playerId === id)!;
  }
  /** The owner of a company (by the company chit's id), if anyone. */
  ownerOf(companyId: string): Player | undefined {
    return this.players.find((p) => !!p.companyById(companyId));
  }
  phaseName(): string {
    return PHASES[this.phase];
  }

  override getDropdowns(): DropdownChit[] {
    return [this.playerAid];
  }

  override setupDemoGame(): number {
    return 4;
  }

  override getLayout(
    width: number,
    _height: number,
    playerId: string,
  ): LayoutNode {
    const me = this.players.filter((p) => p.playerId === playerId);
    const others = this.players.filter((p) => p.playerId !== playerId);
    const board = { order: 1, chit: this.board, minWidth: 520, minHeight: 250 };
    const market = {
      order: 3,
      chit: this.market,
      minWidth: 300,
      minHeight: 120,
    };
    const tracks = {
      order: 4,
      chit: this.tracks,
      minWidth: 170,
      minHeight: 200,
    };
    const mine = me.map((p) => ({
      order: 2,
      chit: p,
      minWidth: 320,
      minHeight: 170,
    }));
    const theirs = others.map((p, i) => ({
      order: 10 + i,
      chit: p,
      minWidth: 260,
      minHeight: 140,
    }));
    // the map, the companies on offer and the tracks are tabs of one panel, the map first: the mats' sparks carry
    // every player's research, and each prompt brings its own tab forward (focus)
    const tabs = (w: number, h: number) => ({
      panels: [board, market, tracks].map((n) => ({
        ...n,
        minWidth: w,
        minHeight: h,
      })),
      minWidth: w,
      minHeight: h,
    });
    if (width < 700) {
      // phone: the tabbed table on top; under it one tab group of mats with the viewer's first, so a bid (tracks)
      // and the purse it is paid from (the mat) are on screen together
      return {
        direction: "vertical",
        collapseOrder: 30,
        splits: [
          tabs(300, 230),
          {
            direction: "optimizePreferVertical",
            collapseOrder: 1,
            splits: [...mine, ...theirs].map((m) => ({
              ...m,
              minWidth: 300,
              minHeight: 210,
            })),
          },
        ],
      };
    }
    // desktop: the tabbed table large at the left; the mats in a column at the right, the viewer's first (LAYOUT.md)
    const left = Math.max(520, Math.floor(width * 0.64));
    return {
      direction: "horizontal",
      collapseOrder: 30,
      splits: [
        tabs(left, 420),
        {
          direction: "vertical",
          collapseOrder: 2,
          splits: [
            ...mine,
            {
              direction: "optimizePreferVertical",
              collapseOrder: 1,
              splits: theirs,
            },
          ],
        },
      ],
    };
  }
}
