"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * THE app-wide tooltip: one flat bubble with a notch, used by charts,
 * desk booking views, and any element that needs a hover explanation.
 * Placement is adaptive — above by default, then below, then left/right
 * of the anchor, whichever fits the viewport — and the notch always
 * aims at the anchor.
 */

export type TipPlacement = "above" | "below" | "left" | "right";

const NOTCH_BASE =
  "absolute h-2.5 w-2.5 rotate-45 border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800";

export function notchClass(placement: TipPlacement): string {
  return placement === "above"
    ? "top-full -translate-x-1/2 -translate-y-[5px] border-b border-r"
    : placement === "below"
      ? "bottom-full -translate-x-1/2 translate-y-[5px] border-l border-t"
      : placement === "left"
        ? "left-full -translate-y-1/2 -translate-x-[5px] border-r border-t"
        : "right-full -translate-y-1/2 translate-x-[5px] border-b border-l";
}

/** The shared bubble surface. `notch` is the px offset of the pointer along the bubble's edge. */
export function TipSurface({
  children,
  placement,
  notch,
  className,
  style,
}: {
  children: React.ReactNode;
  placement: TipPlacement;
  notch: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const notchStyle: React.CSSProperties =
    placement === "above" || placement === "below" ? { left: notch } : { top: notch };
  return (
    <div
      style={style}
      className={cn(
        "relative rounded-sm border border-slate-200 bg-white px-3 py-2 text-xs shadow-xl dark:border-slate-700 dark:bg-slate-800",
        className
      )}
    >
      {children}
      <span aria-hidden style={notchStyle} className={cn(NOTCH_BASE, notchClass(placement))} />
    </div>
  );
}

const GAP = 8;
const EDGE = 4;

interface FixedPos {
  left: number;
  top: number;
  placement: TipPlacement;
  notch: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/** Adaptive placement in viewport coordinates for a bubble of size (bw, bh) anchored to rect. */
export function placeInViewport(rect: DOMRect, bw: number, bh: number): FixedPos {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  // Above
  if (rect.top - GAP - bh >= EDGE) {
    const left = clamp(cx - bw / 2, EDGE, vw - bw - EDGE);
    return { left, top: rect.top - GAP - bh, placement: "above", notch: clamp(cx - left, 12, bw - 12) };
  }
  // Below
  if (rect.bottom + GAP + bh <= vh - EDGE) {
    const left = clamp(cx - bw / 2, EDGE, vw - bw - EDGE);
    return { left, top: rect.bottom + GAP, placement: "below", notch: clamp(cx - left, 12, bw - 12) };
  }
  // Left or right — whichever side has more room
  const top = clamp(cy - bh / 2, EDGE, vh - bh - EDGE);
  if (rect.left >= vw - rect.right) {
    return { left: rect.left - GAP - bw, top, placement: "left", notch: clamp(cy - top, 12, bh - 12) };
  }
  return { left: rect.right + GAP, top, placement: "right", notch: clamp(cy - top, 12, bh - 12) };
}

/**
 * Wrap any element with the shared tooltip. The trigger element is left
 * untouched in the layout (handlers + ref are cloned onto it); the bubble
 * renders in a portal so overflow-hidden ancestors can't clip it.
 */
export function Tooltip({
  content,
  children,
  disabled,
}: {
  content: React.ReactNode;
  children: React.ReactElement;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState<FixedPos | null>(null);
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const bubbleRef = React.useRef<HTMLDivElement | null>(null);

  const show = React.useCallback(() => {
    if (!disabled) setOpen(true);
  }, [disabled]);
  const hide = React.useCallback(() => {
    setOpen(false);
    setPos(null);
  }, []);

  React.useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const bubble = bubbleRef.current;
    if (!trigger || !bubble) return;
    const rect = trigger.getBoundingClientRect();
    setPos(placeInViewport(rect, bubble.offsetWidth, bubble.offsetHeight));
  }, [open, content ]);

  if (disabled) return children;

  const child = React.Children.only(children) as React.ReactElement<Record<string, unknown>>;
  const trigger = React.cloneElement(child, {
    ref: triggerRef,
    onMouseEnter: (e: React.MouseEvent) => {
      show();
      (child.props.onMouseEnter as ((e: React.MouseEvent) => void) | undefined)?.(e);
    },
    onMouseLeave: (e: React.MouseEvent) => {
      hide();
      (child.props.onMouseLeave as ((e: React.MouseEvent) => void) | undefined)?.(e);
    },
    onFocus: (e: React.FocusEvent) => {
      show();
      (child.props.onFocus as ((e: React.FocusEvent) => void) | undefined)?.(e);
    },
    onBlur: (e: React.FocusEvent) => {
      hide();
      (child.props.onBlur as ((e: React.FocusEvent) => void) | undefined)?.(e);
    },
  });

  return (
    <>
      {trigger}
      {open &&
        createPortal(
          <div
            ref={bubbleRef}
            className="pointer-events-none fixed z-[100]"
            style={{
              left: pos?.left ?? -9999,
              top: pos?.top ?? -9999,
              visibility: pos ? "visible" : "hidden",
            }}
          >
            <TipSurface placement={pos?.placement ?? "above"} notch={pos?.notch ?? 24}>
              {content}
            </TipSurface>
          </div>,
          document.body
        )}
    </>
  );
}
