// Accent color system: the app's primary brand color is user-choosable.
// Palettes are defined as CSS variables (see app/globals.css) and exposed to
// Tailwind as `accent-*` utilities via `@theme inline`, so components write
// `bg-accent-600` instead of `bg-indigo-600` and the color resolves at runtime
// from the active `[data-accent="…"]` palette.

export const ACCENT_STOPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

export type AccentStop = (typeof ACCENT_STOPS)[number];

export interface AccentDef {
  id: string;
  name: string;
  /** Hex per stop, used to emit the CSS variables. */
  stops: Record<AccentStop, string>;
  /** Swatch color shown in the picker. */
  swatch: string;
}

const def = (id: string, name: string, stops: Record<AccentStop, string>): AccentDef => ({
  id,
  name,
  stops,
  swatch: stops[600],
});

export const ACCENTS: AccentDef[] = [
  def("indigo", "Indigo", {
    50: "#eef2ff", 100: "#e0e7ff", 200: "#c7d2fe", 300: "#a5b4fc", 400: "#818cf8",
    500: "#6366f1", 600: "#4f46e5", 700: "#4338ca", 800: "#3730a3", 900: "#312e81", 950: "#1e1b4b",
  }),
  def("blue", "Blue", {
    50: "#eff6ff", 100: "#dbeafe", 200: "#bfdbfe", 300: "#93c5fd", 400: "#60a5fa",
    500: "#3b82f6", 600: "#2563eb", 700: "#1d4ed8", 800: "#1e40af", 900: "#1e3a8a", 950: "#172554",
  }),
  def("teal", "Teal", {
    50: "#f0fdfa", 100: "#ccfbf1", 200: "#99f6e4", 300: "#5eead4", 400: "#2dd4bf",
    500: "#14b8a6", 600: "#0d9488", 700: "#0f766e", 800: "#115e59", 900: "#134e4a", 950: "#042f2e",
  }),
  def("green", "Green", {
    50: "#f0fdf4", 100: "#dcfce7", 200: "#bbf7d0", 300: "#86efac", 400: "#4ade80",
    500: "#22c55e", 600: "#16a34a", 700: "#15803d", 800: "#166534", 900: "#14532d", 950: "#052e16",
  }),
  def("violet", "Violet", {
    50: "#f5f3ff", 100: "#ede9fe", 200: "#ddd6fe", 300: "#c4b5fd", 400: "#a78bfa",
    500: "#8b5cf6", 600: "#7c3aed", 700: "#6d28d9", 800: "#5b21b6", 900: "#4c1d95", 950: "#2e1065",
  }),
  def("rose", "Rose", {
    50: "#fff1f2", 100: "#ffe4e6", 200: "#fecdd3", 300: "#fda4af", 400: "#fb7185",
    500: "#f43f5e", 600: "#e11d48", 700: "#be123c", 800: "#9f1239", 900: "#881337", 950: "#4c0519",
  }),
];

export const DEFAULT_ACCENT_ID = "indigo";

export function isAccentId(id: string): boolean {
  return ACCENTS.some((a) => a.id === id);
}

export function accentById(id: string): AccentDef {
  return ACCENTS.find((a) => a.id === id) ?? ACCENTS[0];
}
