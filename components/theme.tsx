"use client";

import * as React from "react";

export type Theme = "light" | "dark" | "system";

const KEY = "pulse-theme";

function resolveTheme(t: Theme): "light" | "dark" {
  if (t !== "system") return t;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(t: Theme) {
  const dark = resolveTheme(t) === "dark";
  document.documentElement.classList.toggle("dark", dark);
}

export function useTheme() {
  const [theme, setThemeState] = React.useState<Theme>("system");
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(KEY) as Theme | null;
      const t: Theme = saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
      setThemeState(t);
      applyTheme(t);
    } catch {
      applyTheme("system");
    }
  }, []);

  const setTheme = React.useCallback((t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem(KEY, t);
    } catch {
      /* ignore */
    }
    applyTheme(t);
  }, []);

  return { theme, setTheme, mounted, isDark: mounted ? resolveTheme(theme) === "dark" : false };
}
