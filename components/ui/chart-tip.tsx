"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Shared chart tooltip: one bubble style for every chart in the app.
 * Placement is adaptive — above the point by default, below when there
 * is no room above, and left/right when neither fits — and the notch
 * (the little pointer) always aims at the hovered point.
 */

export const TIP_W = 118;
export const TIP_H = 54;
const GAP = 10;

export type TipPlacement = "above" | "below" | "left" | "right";

export interface TipBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface TipPos {
  left: number;
  top: number;
  placement: TipPlacement;
  /** px offset of the notch along the bubble edge, measured from its top-left. */
  notch: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/**
 * Compute the bubble position for a point (cx, cy) inside bounds `b`
 * (all in the same coordinate space — the positioning container's).
 */
export function placeTip(cx: number, cy: number, b: TipBounds, bw = TIP_W, bh = TIP_H): TipPos {
  // Above (default)
  if (cy - GAP - bh >= b.top + 2) {
    const left = clamp(cx - bw / 2, b.left + 2, b.right - bw - 2);
    return { left, top: cy - GAP - bh, placement: "above", notch: clamp(cx - left, 14, bw - 14) };
  }
  // Below
  if (cy + GAP + bh <= b.bottom - 2) {
    const left = clamp(cx - bw / 2, b.left + 2, b.right - bw - 2);
    return { left, top: cy + GAP, placement: "below", notch: clamp(cx - left, 14, bw - 14) };
  }
  // Left or right — whichever side has more room
  const top = clamp(cy - bh / 2, b.top + 2, b.bottom - bh - 2);
  if (cx - b.left >= b.right - cx) {
    return { left: cx - GAP - bw, top, placement: "left", notch: clamp(cy - top, 14, bh - 14) };
  }
  return { left: cx + GAP, top, placement: "right", notch: clamp(cy - top, 14, bh - 14) };
}

const NOTCH_BASE =
  "absolute h-2.5 w-2.5 rotate-45 border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800";

export function ChartTipBubble({
  title,
  sub,
  pos,
}: {
  title: React.ReactNode;
  sub: string;
  pos: TipPos;
}) {
  const notchStyle: React.CSSProperties =
    pos.placement === "above" || pos.placement === "below"
      ? { left: pos.notch }
      : { top: pos.notch };
  const notchClass =
    pos.placement === "above"
      ? "top-full -translate-x-1/2 -translate-y-[5px] border-b border-r"
      : pos.placement === "below"
        ? "bottom-full -translate-x-1/2 translate-y-[5px] border-l border-t"
        : pos.placement === "left"
          ? "left-full -translate-y-1/2 -translate-x-[5px] border-r border-t"
          : "right-full -translate-y-1/2 translate-x-[5px] border-b border-l";
  return (
    <div
      className="pointer-events-none absolute z-30"
      style={{ left: pos.left, top: pos.top, width: TIP_W }}
      aria-hidden
    >
      <div className="relative rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-xs shadow-pop dark:border-slate-700 dark:bg-slate-800">
        <p className="font-bold leading-tight text-slate-800 dark:text-slate-100">{title}</p>
        <p className="leading-tight text-slate-400">{sub}</p>
        <span aria-hidden style={notchStyle} className={cn(NOTCH_BASE, notchClass)} />
      </div>
    </div>
  );
}
