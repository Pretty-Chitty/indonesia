import { ChitRenderSpec, Game, GameMetaData, GameResult, GameTheme, LightSpec, Turn } from "@pretty-chitty/core";
import "@fontsource/quicksand/400.css";
import "@fontsource/quicksand/700.css";
import "./fonts";

import * as ButtonLibrary from "./ButtonLibrary";
import { BOX_KHAKI, BOX_OLIVE, CLICK_COLOR } from "./consts";
import { ChitLibrary } from "./chits/ChitLibrary";
import { CanvasLibrary } from "./canvas/CanvasLibrary";

import { Root } from "./chits/Root";
import { Player } from "./chits/Player";
import { ICON, NOTES } from "./art";
import { executeGameSetup } from "./phases/setup";
import { executeNewEra } from "./phases/phase1NewEra";
import { executeBidForTurnOrder } from "./phases/phase2Bid";
import { executeMergers } from "./phases/phase3Mergers";
import { executeAcquisitions } from "./phases/phase4Acquisitions";
import { executeResearch } from "./phases/phase5Research";
import { executeOperations } from "./phases/phase6Operations";
import { executeCityGrowth } from "./phases/phase7CityGrowth";
import { ai } from "./ai";
import { tutorials } from "./tutorial/script";
import { DEFAULTS, RANGES } from "./bots/weights";

import boxArt from "../static/boxArt.jpg";
import screenshot from "../static/screenshot.jpg";

// the box's olive and khaki (its bars, menus and highlights), cream text; the click colour, which the tutorial's
// rings, arrows and buttons share, is set apart from them
const theme = GameTheme.withDefaults(BOX_OLIVE, BOX_KHAKI, "#f4eedb");
theme.fontFamily = "Quicksand, sans-serif";
theme.chitHighlightColor = CLICK_COLOR;
theme.chitOutlineWidth = 1; // a third of the engine default: a crisp edge, not a halo

export default class Indonesia implements Game<Player, Root> {
  metadata = {
    name: "Indonesia",
    licenseInformation: "Indonesia is © Splotter Spellen. This implementation is a fan port for personal use.",
    implementationNotes:
      "Implements the 2009 English rulebook for 2–5 players. Money is secret by default, as the book says: you see only your own cash, Bank and earnings, and everyone's amounts and their history are shown when the game ends. Set the Money option to Open to show every player's money throughout. The second-edition board's extra 'Hull Company' row is not used. Goods sold to a city are shown with the wooden goods markers on the city's goods display, as many tables play it, rather than the book's cardboard counters.",
    publisher: "Splotter Spellen",
    designer: "Jeroen Doumen, Joris Wiersinga",
    artist: "Jan Lipiński, Ynze Moedt, Jeroen Kesselaar",
    tutorialVideoUrl: "",
    rulesPdfUrl: "https://www.splotter.nl/games/indonesia/",
    purchaseUrl: "https://www.splotter.nl/games/indonesia/",
    publisherUrl: "https://www.splotter.nl",
    repositoryUrl: "",
    description:
      "Build the economy of the Indonesian archipelago: start rice, spice, rubber and oil plantations and shipping lines, sell goods to growing cities, and buy out your rivals in merger auctions. Whoever has the most money when era C ends wins.",
    boxArt,
    screenshot,
  } as GameMetaData;

  chitLibrary = ChitLibrary;
  canvasLibrary = CanvasLibrary;
  buttonLibrary = ButtonLibrary;
  theme = theme;
  ai = ai;
  /** the scripted first game (src/tutorial/script.ts, TUTORIAL.md) */
  tutorials = tutorials;
  /** for scripts/tune: the v2 bot's weights and the ranges the tuner may vary them in */
  public botTuning = { defaults: DEFAULTS, ranges: RANGES };

  tokenMap = {
    rice: { image: ICON.rice, text: "rice" },
    spice: { image: ICON.spice, text: "spice" },
    rubber: { image: ICON.rubber, text: "rubber" },
    siapsaji: { image: ICON.siapsaji, text: "siap saji" },
    oil: { image: ICON.oil, text: "oil" },
    ship: { image: ICON.shipping, text: "ship" },
    rupiah: { image: NOTES[0], text: "rupiah" },
  };

  async run(setup: Turn<GameResult<Player>, Player, Root>, root: Root) {
    await executeGameSetup(root, setup);
    while (!root.gameOver) {
      await executeNewEra(root); // 1
      if (root.gameOver) break;
      await executeBidForTurnOrder(root); // 2
      await executeMergers(root); // 3
      await executeAcquisitions(root); // 4
      await executeResearch(root); // 5
      await executeOperations(root); // 6
      await executeCityGrowth(root); // 7
    }
    // V2, V3: most money including the Bank; ties go to the earlier player in the order of play
    const order = root.playersInOrder();
    const best = Math.max(...order.map((p) => p.total()));
    const winner = order.find((p) => p.total() === best)!;
    setup.log(`Final totals: ${order.map((p) => `${p.logKey} ${p.total()}`).join(", ")}. ${winner.logKey} wins.`);
    setup.flush();
    return { winners: [winner] };
  }

  renderDefaultRootChit(spec: ChitRenderSpec): void {
    spec.lightSpec = LightSpec.realistic();
  }

  demoPickWeight(_picks: unknown[], pick: { message?: string; type?: string }): number {
    const m = pick.message ?? "";
    if (m === "pass" || m.startsWith("stop")) return 0.15;
    return 1;
  }
}
