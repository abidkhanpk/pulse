"use client";

import * as React from "react";
import { Switch, FieldError } from "@/components/ui/input";
import { updateLabTodoPriority } from "@/app/(app)/labs/actions";

/**
 * Per-lab feature toggle: when ON, todos in this lab's projects get a
 * priority (Low/Medium/High) — shown in the todo form and as a pill on
 * kanban cards. When OFF, priorities are hidden everywhere (values are
 * kept in the database).
 */
export function LabPrioritySettings({
  labId,
  initialEnabled,
}: {
  labId: string;
  initialEnabled: boolean;
}) {
  const [enabled, setEnabled] = React.useState(initialEnabled);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  async function onToggle(next: boolean) {
    if (pending) return;
    setEnabled(next);
    setError(null);
    setSaved(false);
    setPending(true);
    try {
      const res = await updateLabTodoPriority(labId, next);
      if (!res.ok) {
        setError(res.error);
        setEnabled(!next);
      } else {
        setSaved(true);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/40">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Todo priority
      </p>
      <div className="flex items-start gap-2.5 px-1 py-1">
        <Switch checked={enabled} onChange={onToggle} label="Todo priority" />
        <span>
          <span className="block text-sm font-medium text-slate-800 dark:text-slate-200">
            Priority on todos {enabled ? "on" : "off"}
          </span>
          <span className="block text-xs text-slate-500 dark:text-slate-400">
            When on, todos in this lab&apos;s projects can be set to Low, Medium or High — shown in the todo form and
            as a pill on kanban cards. When off, priority is hidden everywhere.
          </span>
        </span>
      </div>
      <FieldError message={error ?? undefined} />
      {saved && <p className="text-xs text-emerald-600">Saved.</p>}
    </div>
  );
}
