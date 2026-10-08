"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Label, FieldError } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { ATTENDANCE_MODES, type AttendanceMode } from "@/lib/attendance";
import {
  updateLabAttendanceSettings,
  labMarkerCandidates,
} from "@/app/(app)/labs/actions";

export function LabAttendanceSettings({
  labId,
  initialMode,
  initialMarker,
}: {
  labId: string;
  initialMode: AttendanceMode;
  initialMarker: { id: string; name: string } | null;
}) {
  const [mode, setMode] = React.useState<AttendanceMode>(initialMode);
  const [markerId, setMarkerId] = React.useState(initialMarker?.id ?? "");
  const [candidates, setCandidates] = React.useState<{ id: string; name: string }[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    labMarkerCandidates(labId).then(setCandidates);
  }, [labId]);

  async function onSave() {
    setError(null);
    setSaved(false);
    setPending(true);
    try {
      const res = await updateLabAttendanceSettings(labId, {
        mode,
        markerId: mode === "MANUAL" && markerId ? markerId : null,
      });
      if (!res.ok) setError(res.error);
      else setSaved(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/40">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Attendance settings
      </p>
      <div className="space-y-2">
        {ATTENDANCE_MODES.map((m) => (
          <label key={m.id} className="flex cursor-pointer items-start gap-2.5 rounded-lg px-1 py-1 hover:bg-slate-100 dark:hover:bg-slate-700/50">
            <input
              type="radio"
              name={`att-mode-${labId}`}
              checked={mode === m.id}
              onChange={() => setMode(m.id)}
              className="mt-1 h-4 w-4 accent-accent-600"
            />
            <span>
              <span className="block text-sm font-medium text-slate-800 dark:text-slate-200">{m.label}</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">{m.hint}</span>
            </span>
          </label>
        ))}
      </div>
      {mode === "MANUAL" && (
        <div className="mt-2">
          <Label htmlFor={`att-marker-${labId}`}>Designated person (marks attendance with incharges)</Label>
          <SearchableSelect
            id={`att-marker-${labId}`}
            value={markerId}
            onChange={setMarkerId}
            options={[{ value: "", label: "None — incharges only" }, ...candidates.map((c) => ({ value: c.id, label: c.name }))]}
            placeholder="None — incharges only"
          />
        </div>
      )}
      <FieldError message={error ?? undefined} />
      {saved && <p className="text-xs text-emerald-600">Saved.</p>}
      <Button size="sm" variant="outline" className="mt-2" onClick={onSave} disabled={pending}>
        {pending ? "Saving…" : "Save attendance settings"}
      </Button>
    </div>
  );
}
