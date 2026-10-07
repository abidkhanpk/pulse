"use client";

import * as React from "react";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTitle } from "@/components/ui/overlay";
import { Input, Label, Textarea } from "@/components/ui/input";
import {
  listOccurrences,
  cancelOccurrenceAction,
  cancelBookingAction,
  getBooking,
} from "@/app/(app)/desks/actions";
import { BookingDrawer, type BookingFormDefaults } from "./booking-drawer";

export interface Occurrence {
  id: string;
  date: string;
  startsAt: string;
  endsAt: string;
  deskId: string | null;
  desk: { id: string; label: string } | null;
  booking: {
    id: string;
    type: "DESK" | "REMOTE";
    title: string | null;
    user: { id: string; name: string };
  };
}

interface Props {
  desks: { id: string; label: string; status: string; lab: { id: string; name: string } }[];
  people: { id: string; name: string }[];
  projects: { id: string; name: string }[];
  initialOccurrences: Occurrence[];
  weekStart: string; // YYYY-MM-DD (Monday)
  canManage: boolean;
  canManageDesks: boolean;
  onManageDesks: () => void;
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function fmtTime(iso: string): string {
  // occurrences are timestamptz; display in PKT
  return new Date(iso).toLocaleTimeString("en-PK", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Karachi",
  });
}

const TYPE_COLORS: Record<string, string> = {
  DESK: "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800",
  REMOTE: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300",
};

export function WeekGrid({
  desks,
  people,
  projects,
  initialOccurrences,
  weekStart,
  canManage,
  canManageDesks,
  onManageDesks,
}: Props) {
  const [start, setStart] = React.useState(weekStart);
  const [occurrences, setOccurrences] = React.useState<Occurrence[]>(initialOccurrences);
  const [loading, setLoading] = React.useState(false);
  const [drawer, setDrawer] = React.useState<{ open: boolean; defaults?: BookingFormDefaults; bookingId?: string | null }>({
    open: false,
  });
  const [editInitial, setEditInitial] = React.useState<React.ComponentProps<typeof BookingDrawer>["initial"]>(null);
  const [selected, setSelected] = React.useState<Occurrence | null>(null);
  const [cancelNote, setCancelNote] = React.useState("");
  const [cancelling, setCancelling] = React.useState<"one" | "series" | null>(null);

  const days = React.useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(start, i)), [start]);

  const refresh = React.useCallback(
    async (s: string) => {
      setLoading(true);
      try {
        const occs = await listOccurrences({ from: s, to: addDays(s, 6) });
        setOccurrences(
          occs.map((o) => ({
            id: o.id,
            date: o.date instanceof Date ? o.date.toISOString().slice(0, 10) : String(o.date).slice(0, 10),
            startsAt: o.startsAt instanceof Date ? o.startsAt.toISOString() : String(o.startsAt),
            endsAt: o.endsAt instanceof Date ? o.endsAt.toISOString() : String(o.endsAt),
            deskId: o.deskId,
            desk: o.desk,
            booking: o.booking,
          }))
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  function shiftWeek(n: number) {
    const s = addDays(start, n * 7);
    setStart(s);
    refresh(s);
  }

  const byDeskDay = React.useMemo(() => {
    const m = new Map<string, Occurrence[]>();
    for (const o of occurrences) {
      if (!o.deskId) continue;
      const key = `${o.deskId}|${o.date}`;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(o);
    }
    for (const list of m.values()) list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return m;
  }, [occurrences]);

  const remoteByDay = React.useMemo(() => {
    const m = new Map<string, Occurrence[]>();
    for (const o of occurrences) {
      if (o.deskId) continue;
      if (!m.has(o.date)) m.set(o.date, []);
      m.get(o.date)!.push(o);
    }
    return m;
  }, [occurrences]);

  async function openEdit(bookingId: string) {
    const b = await getBooking(bookingId);
    if (!b) return;
    setEditInitial({
      userId: b.userId,
      type: b.type,
      deskId: b.deskId,
      title: b.title,
      projectId: b.projectId,
      timeStart: b.timeStart,
      timeEnd: b.timeEnd,
      isRecurring: b.isRecurring,
      daysOfWeek: b.daysOfWeek,
      validFrom: b.validFrom instanceof Date ? b.validFrom.toISOString().slice(0, 10) : String(b.validFrom).slice(0, 10),
      validTo: b.validTo ? (b.validTo instanceof Date ? b.validTo.toISOString().slice(0, 10) : String(b.validTo).slice(0, 10)) : null,
      trackAttendance: b.trackAttendance,
      notes: b.notes,
    });
    setSelected(null);
    setDrawer({ open: true, bookingId });
  }

  async function doCancel(kind: "one" | "series") {
    if (!selected) return;
    setCancelling(kind);
    try {
      const res =
        kind === "one"
          ? await cancelOccurrenceAction(selected.id, cancelNote.trim() || undefined)
          : await cancelBookingAction(selected.booking.id, cancelNote.trim() || undefined);
      if (!res.ok) {
        alert(res.error);
      } else {
        setSelected(null);
        setCancelNote("");
        refresh(start);
      }
    } finally {
      setCancelling(null);
    }
  }

  const weekLabel = `${new Date(days[0] + "T00:00:00Z").toLocaleDateString("en-PK", { day: "numeric", month: "short", timeZone: "Asia/Karachi" })} – ${new Date(days[6] + "T00:00:00Z").toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Karachi" })}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => shiftWeek(-1)}>← Prev</Button>
        <Button variant="outline" size="sm" onClick={() => { setStart(weekStart); refresh(weekStart); }}>
          This week
        </Button>
        <Button variant="outline" size="sm" onClick={() => shiftWeek(1)}>Next →</Button>
        <span className="ml-2 text-sm font-medium text-slate-700 dark:text-slate-300">{weekLabel}</span>
        {loading && <span className="text-xs text-slate-400">Loading…</span>}
        <div className="ml-auto flex gap-2">
          {canManageDesks && (
            <Button variant="outline" size="sm" onClick={onManageDesks}>
              Manage desks
            </Button>
          )}
          {canManage && (
            <Button size="sm" onClick={() => { setEditInitial(null); setDrawer({ open: true, bookingId: null }); }}>
              New booking
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white scroll-thin dark:bg-slate-900 dark:border-slate-700">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800">
              <th className="sticky left-0 z-10 w-40 border-b border-r border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                Desk
              </th>
              {days.map((d) => {
                const dt = new Date(d + "T00:00:00Z");
                const isToday = d === new Date().toISOString().slice(0, 10);
                return (
                  <th key={d} className={`border-b border-slate-200 px-2 py-2 text-center text-xs font-semibold ${isToday ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300" : "text-slate-500 dark:text-slate-400"}`}>
                    <div>{dt.toLocaleDateString("en-PK", { weekday: "short", timeZone: "Asia/Karachi" })}</div>
                    <div className="text-base">{dt.toLocaleDateString("en-PK", { day: "numeric", timeZone: "Asia/Karachi" })}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {desks.map((desk) => (
              <tr key={desk.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                <td className="sticky left-0 z-10 border-r border-slate-200 bg-white px-3 py-2 dark:bg-slate-900 dark:border-slate-700">
                  <div className="font-medium text-slate-800 dark:text-slate-200">{desk.label}</div>
                  <div className="text-xs text-slate-400">{desk.lab.name}</div>
                  {desk.status === "MAINTENANCE" && <Badge color="warning">Maintenance</Badge>}
                </td>
                {days.map((day) => {
                  const cell = byDeskDay.get(`${desk.id}|${day}`) ?? [];
                  return (
                    <td
                      key={day}
                      className={`border-l border-slate-100 px-1 py-1 align-top ${canManage && desk.status === "ACTIVE" ? "cursor-pointer hover:bg-indigo-50/50" : ""}`}
                      onClick={() =>
                        canManage && desk.status === "ACTIVE" && cell.length === 0
                          ? (setEditInitial(null), setDrawer({ open: true, bookingId: null, defaults: { deskId: desk.id, date: day } }))
                          : undefined
                      }
                    >
                      <div className="min-h-[44px] space-y-1">
                        {cell.map((o) => (
                          <button
                            key={o.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelected(o);
                            }}
                            className={`block w-full rounded-md border px-1.5 py-1 text-left text-xs ${TYPE_COLORS[o.booking.type]}`}
                            title={`${o.booking.user.name} — ${fmtTime(o.startsAt)}–${fmtTime(o.endsAt)}`}
                          >
                            <div className="truncate font-medium">{o.booking.user.name}</div>
                            <div className="text-[11px] opacity-80">
                              {fmtTime(o.startsAt)}–{fmtTime(o.endsAt)}
                            </div>
                          </button>
                        ))}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            {/* Remote / WFH row */}
            <tr className="bg-emerald-50/40">
              <td className="sticky left-0 z-10 border-r border-slate-200 bg-emerald-50/60 px-3 py-2 dark:border-slate-700">
                <div className="font-medium text-emerald-800 dark:text-emerald-300">Remote / WFH</div>
                <div className="text-xs text-emerald-600">no desk needed</div>
              </td>
              {days.map((day) => {
                const cell = remoteByDay.get(day) ?? [];
                return (
                  <td
                    key={day}
                    className={`border-l border-slate-100 px-1 py-1 align-top ${canManage ? "cursor-pointer hover:bg-emerald-100/50" : ""}`}
                    onClick={() =>
                      canManage && cell.length === 0
                        ? (setEditInitial(null), setDrawer({ open: true, bookingId: null, defaults: { date: day } }))
                        : undefined
                    }
                  >
                    <div className="min-h-[44px] space-y-1">
                      {cell.map((o) => (
                        <button
                          key={o.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelected(o);
                          }}
                          className={`block w-full rounded-md border px-1.5 py-1 text-left text-xs ${TYPE_COLORS.REMOTE}`}
                        >
                          <div className="truncate font-medium">{o.booking.user.name}</div>
                          <div className="text-[11px] opacity-80">
                            {fmtTime(o.startsAt)}–{fmtTime(o.endsAt)}
                          </div>
                        </button>
                      ))}
                    </div>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Booking detail dialog */}
      <Dialog open={!!selected} onClose={() => { setSelected(null); setCancelNote(""); }}>
        {selected && (
          <div className="space-y-4">
            <DialogTitle>Booking</DialogTitle>
            <div className="space-y-1 text-sm">
              <p><span className="font-medium">Person:</span> {selected.booking.user.name}</p>
              <p><span className="font-medium">When:</span> {selected.date} · {fmtTime(selected.startsAt)}–{fmtTime(selected.endsAt)}</p>
              <p><span className="font-medium">Where:</span> {selected.desk ? selected.desk.label : "Remote / WFH"}</p>
              {selected.booking.title && <p><span className="font-medium">Title:</span> {selected.booking.title}</p>}
            </div>
            <div>
              <Label htmlFor="cancel-note">Cancellation note (optional)</Label>
              <Textarea id="cancel-note" value={cancelNote} onChange={(e) => setCancelNote(e.target.value)} rows={2} />
            </div>
            {canManage && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => openEdit(selected.booking.id)}>
                  Edit series
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={!!cancelling}
                  onClick={() => doCancel("one")}
                >
                  {cancelling === "one" ? "Cancelling…" : "Cancel this day"}
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={!!cancelling}
                  onClick={() => doCancel("series")}
                >
                  {cancelling === "series" ? "Cancelling…" : "Cancel whole series"}
                </Button>
              </div>
            )}
          </div>
        )}
      </Dialog>

      {/* Create / edit drawer */}
      <BookingDrawer
        open={drawer.open}
        onClose={() => { setDrawer({ open: false }); setEditInitial(null); }}
        onSaved={() => refresh(start)}
        bookingId={drawer.bookingId}
        defaults={drawer.defaults}
        people={people}
        desks={desks}
        projects={projects}
        initial={editInitial}
      />
    </div>
  );
}
