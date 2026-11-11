import React from "react";
import { ParameterizedCanvas } from "@pretty-chitty/core";
import { Raw } from "@pretty-chitty/core/ReactCanvas";

/** A ship's capacity marker, one face. Free: a cream disc ringed in the owner's colour, an open place for a good.
 *  Used: a gold coin reading "Rp 5", the transport fee the seller pays for the ship (P6P.9). */
export class CapacityFace extends ParameterizedCanvas {
  width = 128;
  height = 128;
  used = false;
  ring = "#000000";

  protected render() {
    const used = this.used;
    const ring = this.ring;
    return (
      <Raw
        cb={(ctx, x, y, w, h) => {
          const cx = x + w / 2;
          const cy = y + h / 2;
          const r = Math.min(w, h) / 2;
          ctx.fillStyle = used ? "#d7a82a" : "#f3ead6";
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.lineWidth = r * 0.16;
          ctx.strokeStyle = used ? "#8a6410" : ring;
          ctx.beginPath();
          ctx.arc(cx, cy, r * 0.9, 0, Math.PI * 2);
          ctx.stroke();
          if (!used) return;
          ctx.fillStyle = "#3d2a05";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.font = `700 ${Math.round(r * 0.42)}px Georgia, serif`;
          ctx.fillText("Rp", cx, cy - r * 0.36);
          ctx.font = `700 ${Math.round(r * 1.0)}px Georgia, serif`;
          ctx.fillText("5", cx, cy + r * 0.2);
        }}
      />
    );
  }
}
