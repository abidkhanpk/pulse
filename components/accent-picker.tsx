"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { ACCENTS } from "@/lib/accent";
import { applyAccent } from "@/components/theme-accent";
import { cn } from "@/lib/utils";

/**
 * Swatch picker for the accent color. `onPick` persists the choice;
 * the color is applied to the document instantly for feedback.
 */
export function AccentPicker({
  initial,
  onPick,
}: {
  initial: string;
  onPick: (id: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [current, setCurrent] = React.useState(initial);
  const [saving, setSaving] = React.useState<string | null>(null);

  async function pick(id: string) {
    if (id === current || saving) return;
    setSaving(id);
    applyAccent(id);
    const res = await onPick(id);
    setSaving(null);
    if (res.ok) {
      setCurrent(id);
    } else {
      applyAccent(current);
    }
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5" role="radiogroup" aria-label="Accent color">
      {ACCENTS.map((a) => {
        const active = a.id === current;
        return (
          <button
            key={a.id}
            type="button"
            role="radio"
            aria-checked={active}
            title={a.name}
            aria-label={a.name}
            disabled={saving !== null}
            onClick={() => pick(a.id)}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200",
              "hover:scale-110 active:scale-95",
              active && "ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900"
            )}
            style={
              {
                backgroundColor: a.swatch,
                ["--tw-ring-color" as string]: a.swatch,
                opacity: saving !== null && saving !== a.id ? 0.5 : 1,
              } as React.CSSProperties
            }
          >
            {active && <Check className="h-4 w-4 text-white drop-shadow" />}
          </button>
        );
      })}
    </div>
  );
}
