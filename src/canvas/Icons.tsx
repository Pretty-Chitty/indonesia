import React from "react";
import { ParameterizedCanvas } from "@pretty-chitty/core";
import { Color, Image, Layered, Pad, Raw, RoundedRect } from "@pretty-chitty/core/ReactCanvas";
import { DEED_PANEL, PAPER } from "../art";
import { DEED_H, DEED_W, Good, PLAYER_COLORS } from "../consts";
import { GOODS_PIECES } from "../geometry/goodsPieces";
import { LAND_AREAS } from "../geometry/map";
import { SHIP_SHAPES } from "../geometry/pieceShapes";

type Kind = "cash" | "bank" | "earnings" | "bid" | "slots" | "mergers" | "expansion" | "hull";

/** Spark icons: one bold, simple symbol each, legible at 20 px. Cash is a gold coin marked Rp, the Bank a pillared
 *  bank front, this year's earnings a green coin with a plus. */
export class SparkIcon extends ParameterizedCanvas {
  width = 96;
  height = 96;
  kind: Kind = "cash";

  protected render() {
    const kind = this.kind;
    return (
      <Raw
        cb={(ctx, x, y, w, h) => {
          const cx = x + w / 2;
          const cy = y + h / 2;
          const r = Math.min(w, h) * 0.46;
          if (kind === "bid" || kind === "slots" || kind === "mergers" || kind === "expansion" || kind === "hull") {
            drawResearch(ctx, kind, cx, cy, r);
            return;
          }
          if (kind === "bank") {
            ctx.fillStyle = "#f3ead6";
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#3b2a17";
            const s = r * 1.25;
            const left = cx - s / 2;
            const top = cy - s / 2;
            // pediment
            ctx.beginPath();
            ctx.moveTo(left - s * 0.04, top + s * 0.3);
            ctx.lineTo(cx, top);
            ctx.lineTo(left + s * 1.04, top + s * 0.3);
            ctx.closePath();
            ctx.fill();
            // four columns
            for (let i = 0; i < 4; i++) ctx.fillRect(left + s * (0.06 + i * 0.25), top + s * 0.36, s * 0.13, s * 0.42);
            // base
            ctx.fillRect(left - s * 0.04, top + s * 0.82, s * 1.08, s * 0.14);
            return;
          }
          const gold = kind === "cash";
          ctx.fillStyle = gold ? "#d7a82a" : "#3f8f3f";
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.lineWidth = r * 0.14;
          ctx.strokeStyle = gold ? "#8a6410" : "#1f5a1f";
          ctx.beginPath();
          ctx.arc(cx, cy, r * 0.84, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = gold ? "#4a3306" : "#ffffff";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.font = `700 ${Math.round(r * (gold ? 0.95 : 1.4))}px Georgia, serif`;
          ctx.fillText(gold ? "Rp" : "+", cx, cy + r * 0.05);
        }}
      />
    );
  }
}

/** The five research sparks (P5): a white symbol on a coloured disc, one colour per track.
 *  Bid: a turn-order disc marked ×. Slots: two company deeds side by side. Mergers: two arrows joining into one.
 *  Expansion: four arrows outward. Hull: a ship. */
function drawResearch(ctx: CanvasRenderingContext2D, kind: "bid" | "slots" | "mergers" | "expansion" | "hull", cx: number, cy: number, r: number) {
  const bg = { bid: "#3d5a8a", slots: "#7a5230", mergers: "#6b3f7d", expansion: "#b5651d", hull: "#2f6f78" }[kind];
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#ffffff";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const arrow = (x0: number, y0: number, x1: number, y1: number, head: number) => {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    const a = Math.atan2(y1 - y0, x1 - x0);
    ctx.beginPath();
    ctx.moveTo(x1 + Math.cos(a) * head * 0.6, y1 + Math.sin(a) * head * 0.6);
    ctx.lineTo(x1 + Math.cos(a + 2.3) * head, y1 + Math.sin(a + 2.3) * head);
    ctx.lineTo(x1 + Math.cos(a - 2.3) * head, y1 + Math.sin(a - 2.3) * head);
    ctx.closePath();
    ctx.fill();
  };
  if (kind === "bid") {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${Math.round(r * 1.5)}px Georgia, serif`;
    ctx.fillText("×", cx, cy + r * 0.02);
  } else if (kind === "slots") {
    const w = r * 0.62;
    const h = r * 0.9;
    for (const dx of [-0.36, 0.36]) {
      ctx.fillRect(cx + dx * r - w / 2, cy - h / 2, w, h);
      ctx.fillStyle = bg;
      ctx.fillRect(cx + dx * r - w / 2 + r * 0.1, cy - h / 2 + r * 0.1, w - r * 0.2, h * 0.45);
      ctx.fillStyle = "#ffffff";
    }
  } else if (kind === "mergers") {
    ctx.lineWidth = r * 0.2;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.5, cy + r * 0.5);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + r * 0.5, cy + r * 0.5);
    ctx.stroke();
    arrow(cx, cy, cx, cy - r * 0.45, r * 0.32);
  } else if (kind === "expansion") {
    ctx.lineWidth = r * 0.16;
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4;
      arrow(cx + Math.cos(a) * r * 0.12, cy + Math.sin(a) * r * 0.12, cx + Math.cos(a) * r * 0.5, cy + Math.sin(a) * r * 0.5, r * 0.26);
    }
  } else {
    const pts = SHIP_SHAPES[1];
    const s = r * 1.4;
    const ox = cx - s / 2;
    const oy = cy + s * 0.42;
    ctx.beginPath();
    pts.forEach(([px, py], i) => (i ? ctx.lineTo(ox + px * s, oy - py * s * 0.9) : ctx.moveTo(ox + px * s, oy - py * s * 0.9)));
    ctx.closePath();
    ctx.fill();
  }
}

/** The board's brown land, a little deeper so a white line reads on it (sampled from the printed provinces). */
export const LAND_BROWN = "#8f6f52";

/** Borneo's outline for the board's tab: its provinces' land areas (islets under 2% of the largest ring dropped),
 *  in a unit box, y down. */
const BORNEO: [number, number][][] = (() => {
  const provinces = ["Sarawak", "Kalimantan Barat", "Kalimantan Tengah", "Kalimantan Timur", "Kalimantan Selatan"];
  const area = (r: [number, number][]) => Math.abs(r.reduce((s, [x1, y1], i) => s + x1 * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * y1, 0)) / 2;
  let rings = LAND_AREAS.filter((a) => provinces.includes(a.province)).flatMap((a) => a.rings);
  const biggest = Math.max(...rings.map(area));
  rings = rings.filter((r) => area(r) > biggest * 0.02);
  const xs = rings.flat().map((p) => p[0]);
  const ys = rings.flat().map((p) => p[1]);
  const [x0, y0, x1, y1] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  const size = Math.max(x1 - x0, y1 - y0);
  return rings.map((r) => r.map(([x, y]) => [(x - x0 + (size - (x1 - x0)) / 2) / size, (y - y0 + (size - (y1 - y0)) / 2) / size] as [number, number]));
})();

/** Panel tab: the board. An island, Borneo, outlined in white on the board's brown land. */
export class BoardTabIcon extends ParameterizedCanvas {
  width = 128;
  height = 128;
  protected render() {
    return (
      <RoundedRect radius={18}>
        <Layered>
          <Color hex={LAND_BROWN} />
          <Raw
            cb={(ctx, x, y, w) => {
              const pad = w * 0.12;
              const s = w - 2 * pad;
              const path = (r: [number, number][]) => {
                ctx.beginPath();
                r.forEach(([px, py], i) => (i ? ctx.lineTo(x + pad + px * s, y + pad + py * s) : ctx.moveTo(x + pad + px * s, y + pad + py * s)));
                ctx.closePath();
              };
              ctx.lineJoin = "round";
              // a wide white line round every ring, then the land filled back in: only the outer half of the line
              // shows, so the province borders inside the island leave no trace (the thin fill stroke seals the seams)
              ctx.strokeStyle = "#ffffff";
              ctx.lineWidth = w * 0.17;
              for (const r of BORNEO) {
                path(r);
                ctx.stroke();
              }
              ctx.fillStyle = LAND_BROWN;
              ctx.strokeStyle = LAND_BROWN;
              ctx.lineWidth = w * 0.015;
              for (const r of BORNEO) {
                path(r);
                ctx.fill();
                ctx.stroke();
              }
            }}
          />
        </Layered>
      </RoundedRect>
    );
  }
}

/** Panel tab: the companies on offer. Two deeds fanned out, cream cards with dark edges and a shadow, each with its
 *  coloured panel (the front one with its good), so they read as cards on the tab's green. */
export class CompaniesTabIcon extends ParameterizedCanvas {
  width = 128;
  height = 128;
  protected render() {
    return (
      <RoundedRect radius={18}>
        <Layered>
          <Color hex={DEED_PANEL.spice} />
          <Raw
            cb={(ctx, x, y, w, h) => {
              const cw = w * 0.8;
              const ch = cw * (DEED_H / DEED_W);
              drawDeedCard(ctx, x + w * 0.44, y + h * 0.35, cw, ch, -0.24, DEED_PANEL.shipping);
              drawDeedCard(ctx, x + w * 0.56, y + h * 0.64, cw, ch, 0.08, DEED_PANEL.rice, "rice");
            }}
          />
        </Layered>
      </RoundedRect>
    );
  }
}

function drawDeedCard(ctx: CanvasRenderingContext2D, cx: number, cy: number, cw: number, ch: number, angle: number, panel: string, good?: Good) {
  const r = cw * 0.08;
  const card = (dx: number, dy: number) => {
    ctx.beginPath();
    ctx.roundRect(-cw / 2 + dx, -ch / 2 + dy, cw, ch, r);
  };
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  card(cw * 0.03, cw * 0.05);
  ctx.fill();
  ctx.fillStyle = "#f3ead6";
  card(0, 0);
  ctx.fill();
  ctx.lineWidth = cw * 0.035;
  ctx.strokeStyle = "#2b2416";
  ctx.stroke();
  // the coloured panel down the left, as the deeds print it
  const inset = cw * 0.08;
  ctx.fillStyle = panel;
  ctx.beginPath();
  ctx.roundRect(-cw / 2 + inset, -ch / 2 + inset, cw * 0.36, ch - 2 * inset, r * 0.5);
  ctx.fill();
  if (good) {
    // the good, in the ink of its printed piece
    const g = GOODS_PIECES[good];
    const gh = ch * 0.62;
    const gw = gh * g.aspect;
    const ox = cw * 0.2 - gw / 2;
    const oy = -gh / 2;
    ctx.fillStyle = g.ink;
    ctx.beginPath();
    g.points.forEach(([px, py], i) => (i ? ctx.lineTo(ox + px * gw, oy + (1 - py) * gh) : ctx.moveTo(ox + px * gw, oy + (1 - py) * gh)));
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** Panel tab: the Turn Order track and R&D table. A grid on paper with player cubes on it. */
export class TracksTabIcon extends ParameterizedCanvas {
  width = 128;
  height = 128;
  protected render() {
    return (
      <RoundedRect radius={18}>
        <Layered>
          <Image image={PAPER} fill />
          <Raw
            cb={(ctx, x, y, w, h) => {
              const pad = w * 0.12;
              const cols = 3;
              const rows = 3;
              const cw = (w - 2 * pad) / cols;
              const ch = (h - 2 * pad) / rows;
              ctx.strokeStyle = "#3a3127";
              ctx.lineWidth = Math.max(2, w * 0.03);
              for (let i = 0; i <= cols; i++) {
                ctx.beginPath();
                ctx.moveTo(x + pad + i * cw, y + pad);
                ctx.lineTo(x + pad + i * cw, y + h - pad);
                ctx.stroke();
              }
              for (let j = 0; j <= rows; j++) {
                ctx.beginPath();
                ctx.moveTo(x + pad, y + pad + j * ch);
                ctx.lineTo(x + w - pad, y + pad + j * ch);
                ctx.stroke();
              }
              const cubes: [number, number, number][] = [
                [0, 0, 0],
                [1, 1, 2],
                [2, 0, 3],
                [0, 2, 1],
              ];
              for (const [c, r, seat] of cubes) {
                ctx.fillStyle = PLAYER_COLORS[seat];
                const s = Math.min(cw, ch) * 0.56;
                ctx.fillRect(x + pad + c * cw + (cw - s) / 2, y + pad + r * ch + (ch - s) / 2, s, s);
              }
            }}
          />
        </Layered>
      </RoundedRect>
    );
  }
}
