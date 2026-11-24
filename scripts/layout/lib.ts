// Panel layout checks: what RootChit.getFlatLayout (the client's own layout code) gives at a screen size, as
// tab groups of named panels, and assertions about them. Sizes are the panel area in CSS px: the screen less
// the top bar, bottom bar and action log line.
import type { RootChit } from "@pretty-chitty/core";

export const SIZES = {
  /** an iPhone SE-sized or short phone in portrait */
  phoneShort: { w: 375, h: 420 },
  /** a regular iPhone in portrait */
  phone: { w: 390, h: 500 },
  /** a tall phone in portrait */
  phoneTall: { w: 430, h: 640 },
  /** a phone on its side */
  phoneLandscape: { w: 780, h: 300 },
  /** an unfolded foldable (iPhone Duo open), with more or less browser chrome */
  foldShort: { w: 830, h: 400 },
  fold: { w: 830, h: 500 },
  foldTall: { w: 830, h: 650 },
  /** a small tablet / small laptop window */
  tablet: { w: 1000, h: 650 },
  /** a laptop */
  laptop: { w: 1440, h: 780 },
} as const;
export type SizeName = keyof typeof SIZES;

export type Group = { panels: string[]; x: number; y: number; w: number; h: number };

/** The tab groups at a size, each panel named by `name` (unnamed chits by their class) */
export function layoutAt(root: RootChit<any>, size: { w: number; h: number }, viewer: string, name: (chit: unknown) => string | undefined): Group[] {
  return root.getFlatLayout(size.w, size.h, 1, 1, viewer).map((r) => ({
    panels: (Array.isArray(r.chit) ? r.chit : [r.chit]).map((c) => name(c) ?? (c as any).constructor.name),
    x: r.x,
    y: r.y,
    w: r.w,
    h: r.h,
  }));
}

const failures: string[] = [];
let checks = 0;

/** Assertions about one size's layout */
export class Layout {
  constructor(public readonly size: SizeName, public readonly groups: Group[]) {}
  toString() {
    return this.groups.map((g) => `[${g.panels.join("|")} ${Math.round(g.w)}x${Math.round(g.h)}@${Math.round(g.x)},${Math.round(g.y)}]`).join(" ");
  }
  private expect(ok: boolean, what: string) {
    checks++;
    if (!ok) failures.push(`${this.size} (${SIZES[this.size].w}x${SIZES[this.size].h}): expected ${what}\n    got ${this}`);
    return this;
  }
  group(panel: string): Group {
    const g = this.groups.find((g) => g.panels.includes(panel));
    if (!g) throw new Error(`${this.size}: no panel "${panel}" in ${this}`);
    return g;
  }
  groupCount(min: number, max = min) {
    return this.expect(this.groups.length >= min && this.groups.length <= max, max === min ? `${min} groups` : `${min}-${max} groups`);
  }
  together(...panels: string[]) {
    return this.expect(panels.every((p) => this.group(p) === this.group(panels[0])), `${panels.join(", ")} in one tab group`);
  }
  apart(a: string, b: string) {
    return this.expect(this.group(a) !== this.group(b), `${a} and ${b} in different groups`);
  }
  /** `panel` is its group's first tab */
  first(panel: string) {
    return this.expect(this.group(panel).panels[0] === panel, `${panel} first in its group`);
  }
  leftOf(a: string, b: string) {
    const ga = this.group(a), gb = this.group(b);
    return this.expect(ga.x + ga.w <= gb.x + 1, `${a} left of ${b}`);
  }
  above(a: string, b: string) {
    const ga = this.group(a), gb = this.group(b);
    return this.expect(ga.y + ga.h <= gb.y + 1, `${a} above ${b}`);
  }
  /** `panel`'s group takes `share` of the width (within 2%) */
  widthShare(panel: string, share: number) {
    const w = this.group(panel).w / SIZES[this.size].w;
    return this.expect(Math.abs(w - share) <= 0.02, `${panel}'s group ${Math.round(share * 100)}% wide (is ${Math.round(w * 100)}%)`);
  }
  heightShare(panel: string, share: number) {
    const h = this.group(panel).h / SIZES[this.size].h;
    return this.expect(Math.abs(h - share) <= 0.02, `${panel}'s group ${Math.round(share * 100)}% tall (is ${Math.round(h * 100)}%)`);
  }
}

/** Lays out every size, prints them with --print, and runs `expectations` on each */
export function checkLayouts(game: string, root: RootChit<any>, viewer: string, name: (chit: unknown) => string | undefined, expectations: Partial<Record<SizeName, (l: Layout) => void>>) {
  const print = process.argv.includes("--print");
  for (const size of Object.keys(SIZES) as SizeName[]) {
    const l = new Layout(size, layoutAt(root, SIZES[size], viewer, name));
    if (print) console.log(`${size.padEnd(15)} ${SIZES[size].w}x${SIZES[size].h}  ${l}`);
    try {
      expectations[size]?.(l);
    } catch (e) {
      failures.push(String(e));
    }
  }
  if (failures.length) {
    console.error(`${game} layout: ${failures.length} of ${checks} checks failed\n  ${failures.join("\n  ")}`);
    process.exit(1);
  }
  console.log(`${game} layout: ok (${checks} checks over ${Object.keys(SIZES).length} sizes)`);
}
