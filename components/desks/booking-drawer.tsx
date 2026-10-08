"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label, Checkbox, FieldError } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Sheet, SheetHeader, SheetTitle, SheetBody, SheetFooter } from "@/components/ui/overlay";
import { createBookingAction, updateBookingAction } from "@/app/(app)/desks/actions";

export interface BookingFormDefaults {
  userId?: string;
  deskId?: string;
  date?: string; // YYYY-MM-DD
  timeStart?: string;
  timeEnd?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  bookingId?: string | null;
  defaults?: BookingFormDefaults;
  people: { id: string; name: string }[];
  desks: { id: string; label: string; status: string }[];
  projects: { id: string; name: string }[];
  initial?: {
    userId: string;
    type: "DESK" | "REMOTE";
    deskId: string | null;
    title: string | null;
    projectId: string | null;
    timeStart: string;
    timeEnd: string;
    isRecurring: boolean;
    daysOfWeek: number[];
    validFrom: string;
    validTo: string | null;
    trackAttendance: boolean | null;
    notes: string | null;
  } | null;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function BookingDrawer({ open, onClose, onSaved, bookingId, defaults, people, desks, projects, initial }: Props) {
  const [type, setType] = React.useState<"DESK" | "REMOTE">(initial?.type ?? "DESK");
  const [userId, setUserId] = React.useState(initial?.userId ?? defaults?.userId ?? people[0]?.id ?? "");
  const [deskId, setDeskId] = React.useState(initial?.deskId ?? defaults?.deskId ?? "");
  const [title, setTitle] = React.useState(initial?.title ?? "");
  const [projectId, setProjectId] = React.useState(initial?.projectId ?? "");
  const [timeStart, setTimeStart] = React.useState(initial?.timeStart ?? defaults?.timeStart ?? "08:00");
  const [timeEnd, setTimeEnd] = React.useState(initial?.timeEnd ?? defaults?.timeEnd ?? "16:00");
  const [isRecurring, setIsRecurring] = React.useState(initial?.isRecurring ?? false);
  const [daysOfWeek, setDaysOfWeek] = React.useState<number[]>(initial?.daysOfWeek ?? [1, 2, 3, 4, 5]);
  const [validFrom, setValidFrom] = React.useState(initial?.validFrom ?? defaults?.date ?? "");
  const [validTo, setValidTo] = React.useState(initial?.validTo ?? "");
  const [trackAttendance, setTrackAttendance] = React.useState(initial?.trackAttendance ?? true);
  const [notes, setNotes] = React.useState(initial?.notes ?? "");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const activeDesks = desks.filter((d) => d.status === "ACTIVE");

  function toggleDay(d: number) {
    setDaysOfWeek((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!userId) return setError("Choose a person.");
    if (type === "DESK" && !deskId) return setError("Choose a desk.");
    if (!validFrom) return setError("Choose a date.");
    if (isRecurring && daysOfWeek.length === 0) return setError("Pick at least one weekday.");
    if (timeStart >= timeEnd) return setError("End time must be after start time.");
    setPending(true);
    try {
      const payload = {
        userId,
        type,
        deskId: type === "DESK" ? deskId : null,
        title: title.trim() || null,
        projectId: projectId || null,
        timeStart,
        timeEnd,
        isRecurring,
        daysOfWeek: isRecurring ? daysOfWeek : [],
        validFrom,
        validTo: isRecurring && validTo ? validTo : null,
        trackAttendance,
        notes: notes.trim() || null,
      };
      const res = bookingId
        ? await updateBookingAction(bookingId, payload)
        : await createBookingAction(payload);
      if (!res.ok) {
        setError(res.error);
      } else {
        onSaved();
        onClose();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <SheetHeader>
        <SheetTitle>{bookingId ? "Edit booking" : "New booking"}</SheetTitle>
      </SheetHeader>
      <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
        <SheetBody className="space-y-4">
          <div>
            <Label>Booking type</Label>
            <div className="flex gap-2">
              {(["DESK", "REMOTE"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                    type === t
                      ? "border-accent-600 bg-accent-50 text-accent-700 dark:bg-accent-950 dark:text-accent-300"
                      : "border-slate-300 text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  {t === "DESK" ? "Desk" : "Remote / WFH"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="bk-person">Person</Label>
            <SearchableSelect
              id="bk-person"
              value={userId}
              onChange={setUserId}
              options={people.map((p) => ({ value: p.id, label: p.name }))}
              placeholder="Select a person…"
            />
          </div>

          {type === "DESK" && (
            <div>
              <Label htmlFor="bk-desk">Desk</Label>
              <SearchableSelect
                id="bk-desk"
                value={deskId}
                onChange={setDeskId}
                options={activeDesks.map((d) => ({ value: d.id, label: d.label }))}
                placeholder="Select a desk…"
              />
            </div>
          )}

          <div>
            <Label htmlFor="bk-title">Title (optional)</Label>
            <Input
              id="bk-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Project work, Focus time"
            />
          </div>

          {projects.length > 0 && (
            <div>
              <Label htmlFor="bk-project">Project (optional)</Label>
              <SearchableSelect
                id="bk-project"
                value={projectId}
                onChange={setProjectId}
                options={[{ value: "", label: "None" }, ...projects.map((p) => ({ value: p.id, label: p.name }))]}
                placeholder="None"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="bk-start">Start</Label>
              <Input id="bk-start" type="time" value={timeStart} onChange={(e) => setTimeStart(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="bk-end">End</Label>
              <Input id="bk-end" type="time" value={timeEnd} onChange={(e) => setTimeEnd(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="bk-recur"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
            />
            <Label htmlFor="bk-recur" className="!mb-0">
              Repeating booking
            </Label>
          </div>

          {isRecurring ? (
            <>
              <div>
                <Label>Repeat on</Label>
                <div className="flex gap-1.5">
                  {WEEKDAYS.map((d, i) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDay(i)}
                      className={`flex h-9 w-9 items-center justify-center rounded-lg border text-xs font-medium ${
                        daysOfWeek.includes(i)
                          ? "border-accent-600 bg-accent-600 text-white"
                          : "border-slate-300 text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                      }`}
                    >
                      {d[0]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="bk-from">From</Label>
                  <Input id="bk-from" type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="bk-to">Until</Label>
                  <Input id="bk-to" type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} />
                </div>
              </div>
            </>
          ) : (
            <div>
              <Label htmlFor="bk-date">Date</Label>
              <Input id="bk-date" type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
            </div>
          )}

          <div className="flex items-center gap-2">
            <Checkbox
              id="bk-track"
              checked={trackAttendance}
              onChange={(e) => setTrackAttendance(e.target.checked)}
            />
            <Label htmlFor="bk-track" className="!mb-0">
              Count toward attendance expectation
            </Label>
          </div>

          <div>
            <Label htmlFor="bk-notes">Notes (optional)</Label>
            <Textarea id="bk-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <FieldError message={error ?? undefined} />
        </SheetBody>
        <SheetFooter>
          <Button variant="outline" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : bookingId ? "Save changes" : "Create booking"}
          </Button>
        </SheetFooter>
      </form>
    </Sheet>
  );
}
