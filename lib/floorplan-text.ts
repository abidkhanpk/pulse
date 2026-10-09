import type * as React from "react";

/** Font choices for floorplan text annotations. */
export const FONT_OPTIONS: { id: string; label: string; css: string }[] = [
  { id: "SANS", label: "Sans-serif", css: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif" },
  { id: "SERIF", label: "Serif", css: "Georgia, 'Times New Roman', serif" },
  { id: "MONO", label: "Monospace", css: "ui-monospace, 'Cascadia Mono', 'Courier New', monospace" },
  { id: "CURSIVE", label: "Cursive", css: "'Segoe Script', 'Bradley Hand', 'Comic Sans MS', cursive" },
];

export function fontFamilyCss(id: string | null | undefined): string {
  return FONT_OPTIONS.find((f) => f.id === id)?.css ?? FONT_OPTIONS[0].css;
}

/** Shared style for a floorplan text annotation (fontSize is in cqw units). */
export function textShapeStyle(s: {
  xPct: number;
  yPct: number;
  fontSize?: number | null;
  fontFamily?: string | null;
  bold?: boolean | null;
  italic?: boolean | null;
  color?: string | null;
}): React.CSSProperties {
  return {
    left: `${s.xPct}%`,
    top: `${s.yPct}%`,
    fontSize: `${s.fontSize ?? 2.2}cqw`,
    fontFamily: fontFamilyCss(s.fontFamily),
    fontWeight: s.bold ? 700 : 400,
    fontStyle: s.italic ? "italic" : "normal",
    color: s.color ?? "#0f172a",
    lineHeight: 1.15,
  };
}
