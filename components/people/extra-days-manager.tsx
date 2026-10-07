"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import {
  listWorkingDayExceptions,
  addWorkingDayException,
  deleteWorkingDayException,
} from "@/app/(app)/people/actions";
import type { Recurrence } from "@prisma/client";

interface ExtraDay {
  id: string;
  date: Date;
  recurrence: Recurrence;
  note: string | null;
}

const RECURRENCE_LABELS: Record<Recurrence, string> = {
  ONCE: "Once",
  WEEKLY: "Weekly",
  BIWEEKLY: "Every 2 weeks",
  MONTHLY: "Monthly",
};

function fmtDate(d: Date): string {
  return new Date(d).toISOString().slice(0, 10);
}

export function ExtraDaysManager({ userId, userName }: { userId: string; userName: string }) {
  const [days, setDays] = React.useState<ExtraDay[]>([]);
  const [date, setDate] = React.useState("");
  const [recurrence, setRecurrence] = React.useState<Recurrence>("ONCE");
  const [note, setNote] = React.useState("");
  const [pending, setPending] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setDays(await listWorkingDayExceptions(userId));
  }, [userId]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  async function onAdd() {
    if (!date) return;
    setPending(true);
    try {
      const res = await addWorkingDayException({ userId, date, recurrence, note: note || null });
      if (!res.ok) alert(res.error);
      else {
        setDate("");
        setNote("");
        setRecurrence("ONCE");
        refresh();
      }
    } finally {
      setPending(false);
    }
  }

  async function onDelete(id: string) {
    const res = await deleteWorkingDayException(id);
    if (!res.ok) alert(res.error);
    else refresh();
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/40">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Extra working days — {userName}
      </p>
      <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
        Days beyond desk bookings that count as working days (industrial visits, presentation days, …).
      </p>
      {days.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {days.map((d) => (
            <span key={d.id} className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 py-1 pl-2.5 pr-1.5 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:ring-indigo-800">
              {fmtDate(d.date)} · {RECURRENCE_LABELS[d.recurrence]}
              {d.note ? ` · ${d.note}` : ""}
              <button
                onClick={() => onDelete(d.id)}
                className="rounded-full px-1.5 text-indigo-400 hover:bg-indigo-100 hover:text-indigo-700 dark:hover:bg-indigo-900"
                title="Remove"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="exd-date">Date</Label>
          <Input id="exd-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="exd-rec">Repeats</Label>
          <Select id="exd-rec" value={recurrence} onChange={(e) => setRecurrence(e.target.value as Recurrence)}>
            {(Object.keys(RECURRENCE_LABELS) as Recurrence[]).map((r) => (
              <option key={r} value={r}>
                {RECURRENCE_LABELS[r]}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="mt-2 flex gap-2">
        <Input
          placeholder="Note (optional) — e.g. Industrial visit"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={120}
        />
        <Button size="sm" onClick={onAdd} disabled={pending || !date} className="shrink-0">
          {pending ? "Adding…" : "Add day"}
        </Button>
      </div>
    </div>
  );
}
