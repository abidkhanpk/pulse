"use client";

import * as React from "react";
import { isAccentId } from "@/lib/accent";

/**
 * Applies the server-resolved accent to <html data-accent> and persists it
 * for the pre-paint blocking script on subsequent loads.
 */
export function AccentRoot({ accent }: { accent: string }) {
  React.useEffect(() => {
    const id = isAccentId(accent) ? accent : "indigo";
    document.documentElement.setAttribute("data-accent", id);
    try {
      localStorage.setItem("pulse-accent", id);
    } catch {
      /* ignore */
    }
  }, [accent ]);
  return null;
}

/** Imperatively switch accent (used by the picker for instant feedback). */
export function applyAccent(id: string) {
  if (!isAccentId(id)) return;
  document.documentElement.setAttribute("data-accent", id);
  try {
    localStorage.setItem("pulse-accent", id);
  } catch {
    /* ignore */
  }
}
