"use client";

import * as React from "react";
import { Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/card";

export interface DependencyCandidate {
  id: string;
  title: string;
  status: string;
}

/**
 * Checkbox list for picking Finish-to-Start prerequisites.
 * Shows each candidate's status so users can see what's done vs pending.
 */
export function DependencyPicker({
  label,
  candidates,
  selected,
  onChange,
  disabled,
}: {
  label: string;
  candidates: DependencyCandidate[];
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  }

  return (
    <div>
      <Label>{label}</Label>
      <p className="mb-1 text-xs text-slate-400">Finish-to-Start: this item starts after each selected item finishes.</p>
      {candidates.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 px-3 py-2 text-sm text-slate-400 dark:border-slate-700">
          No other items to depend on yet.
        </p>
      ) : (
        <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-slate-700">
          {candidates.map((c) => {
            const done = c.status === "DONE";
            return (
              <label
                key={c.id}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(c.id)}
                  onChange={() => toggle(c.id)}
                  disabled={disabled}
                  className="h-4 w-4 accent-indigo-600"
                />
                <span className="min-w-0 flex-1 truncate text-slate-800 dark:text-slate-200">{c.title}</span>
                <Badge color={done ? "success" : "default"}>{c.status.replace("_", "")}</Badge>
              </label>
            );
          })}
        </div>
      )}
      {selected.length > 0 && (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Depends on {selected.length} item{selected.length === 1 ? "" : "s"}.
        </p>
      )}
    </div>
  );
}
