"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { ACCENTS, accentById } from "@/lib/accent";
import { applyAccent } from "@/components/theme-accent";
import { cn } from "@/lib/utils";

/**
 * Swatch picker for the accent color. The FIRST option is always
 * "Default" — it follows the organization default set by the admin
 * (stored as no personal choice). `onPick` persists the choice
 * (null = default); the color is applied instantly for feedback.
 */
export function AccentPicker({
  initial,
  defaultId,
  onPick,
}: {
  /** The user's own choice; null = following the default. */
  initial: string | null;
  defaultId: string;
  onPick: (id: string | null) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [current, setCurrent] = React.useState<string | null>(initial);
  const [saving, setSaving] = React.useState<string | null | undefined>(undefined);
  const defaultDef = accentById(defaultId);

  async function pick(id: string | null) {
    if (id === current || saving !== undefined) return;
    setSaving(id);
    applyAccent(id ?? defaultId);
    const res = await onPick(id);
    setSaving(undefined);
    if (res.ok) {
      setCurrent(id);
    } else {
      applyAccent(current ?? defaultId);
    }
  }

  const busy = saving !== undefined;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5" role="radiogroup" aria-label="Accent color">
      {/* Default — always first; follows the organization default. */}
      <button
        type="button"
        role="radio"
        aria-checked={current === null}
        title={`Default (${defaultDef.name})`}
        aria-label={`Default (${defaultDef.name})`}
        disabled={busy}
        onClick={() => pick(null)}
        className={cn(
          "flex h-8 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold text-white transition-all duration-200",
          "hover:scale-105 active:scale-95",
          current === null && "ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900"
        )}
        style={
          {
            backgroundColor: defaultDef.swatch,
            ["--tw-ring-color" as string]: defaultDef.swatch,
            opacity: busy && saving !== null ? 0.5 : 1,
          } as React.CSSProperties
        }
      >
        {current === null && <Check className="h-3.5 w-3.5 drop-shadow" />}
        Default
      </button>
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
            disabled={busy}
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
                opacity: busy && saving !== a.id ? 0.5 : 1,
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
