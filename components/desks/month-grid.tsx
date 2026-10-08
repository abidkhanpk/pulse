"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTitle } from "@/components/ui/overlay";
import { Label, Textarea } from "@/components/ui/input";
import {
  listOccurrences,
  cancelOccurrenceAction,
  cancelBookingAction,
  getBooking,
} from "@/app/(app)/desks/actions";
import { BookingDrawer, type BookingFormDefaults } from "./booking-drawer";
import type { Occurrence } from "./week-grid";

interface Props {
  desks: { id: string; label: string; status: string; lab: { id: string; name: string } }[];
  people: { id: string; name: string }[];
  projects: { id: string; name: string }[];
  today: string; // YYYY-MM-DD
  labId: string;
  canManage: boolean;
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function monthStartOf(iso: string): string {
  return iso.slice(0, 7) + "-01";
}

function shiftMonth(monthStart: string, n: number): string {
  const [y, m] = monthStart.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 10);
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-PK", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Karachi",
  });
}

const TYPE_STYLES: Record<string, string> = {
  DESK: "bg-accent-100 text-accent-800 hover:bg-accent-200 dark:bg-accent-950 dark:text-accent-300",
  REMOTE: "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-300",
};

const MAX_CHIPS = 3;

export function MonthGrid({ desks, people, projects, today, labId, canManage }: Props) {
  const [monthStart, setMonthStart] = React.useState(() => monthStartOf(today));
  const [occurrences, setOccurrences] = React.useState<Occurrence[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [drawer, setDrawer] = React.useState<{ open: boolean; defaults?: BookingFormDefaults; bookingId?: string | null }>({
    open: false,
  });
  const [editInitial, setEditInitial] = React.useState<React.ComponentProps<typeof BookingDrawer>["initial"]>(null);
  const [selected, setSelected] = React.useState<Occurrence | null>(null);
  const [dayList, setDayList] = React.useState<string | null>(null); // date ISO for "+N more" dialog
  const [cancelNote, setCancelNote] = React.useState("");
  const [cancelling, setCancelling] = React.useState<"one" | "series" | null>(null);

  // 6-week grid starting Monday of the week containing the 1st.
  const cells = React.useMemo(() => {
    const first = new Date(monthStart + "T00:00:00Z");
    const dow = (first.getUTCDay() + 6) % 7; // Monday = 0
    const gridStart = addDays(monthStart, -dow);
    return Array.from({ length: 42 }, (_, i) => {
      const date = addDays(gridStart, i);
      return {
        date,
        inMonth: date.slice(0, 7) === monthStart.slice(0, 7),
        isToday: date === today,
      };
    });
  }, [monthStart, today]);

  const gridEnd = cells[cells.length - 1].date;

  const refresh = React.useCallback(
    async (ms: string) => {
      setLoading(true);
      try {
        const first = new Date(ms + "T00:00:00Z");
        const dow = (first.getUTCDay() + 6) % 7;
        const from = addDays(ms, -dow);
        const to = addDays(from, 41);
        const occs = await listOccurrences({ from, to, labId: labId || undefined });
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
    [labId]
  );

  React.useEffect(() => {
    refresh(monthStart);
  }, [monthStart, refresh]);

  function shift(n: number) {
    setMonthStart((ms) => shiftMonth(ms, n));
  }

  const byDay = React.useMemo(() => {
    const m = new Map<string, Occurrence[]>();
    for (const o of occurrences) {
      if (!m.has(o.date)) m.set(o.date, []);
      m.get(o.date)!.push(o);
    }
    for (const list of m.values()) list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
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
    setDayList(null);
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
        refresh(monthStart);
      }
    } finally {
      setCancelling(null);
    }
  }

  const monthLabel = new Date(monthStart + "T00:00:00Z").toLocaleDateString("en-PK", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Karachi",
  });

  const dayListOccs = dayList ? byDay.get(dayList) ?? [] : [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => shift(-1)}>← Prev</Button>
        <Button variant="outline" size="sm" onClick={() => setMonthStart(monthStartOf(today))}>
          This month
        </Button>
        <Button variant="outline" size="sm" onClick={() => shift(1)}>Next →</Button>
        <span className="ml-2 text-sm font-medium text-slate-700 dark:text-slate-300">{monthLabel}</span>
        {loading && <span className="text-xs text-slate-400">Loading…</span>}
        <div className="ml-auto">
          {canManage && (
            <Button size="sm" onClick={() => { setEditInitial(null); setDrawer({ open: true, bookingId: null }); }}>
              New booking
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-700">
        {/* Weekday header */}
        <div className="grid grid-cols-7 bg-slate-50 dark:bg-slate-800">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="border-b border-slate-200 px-2 py-2 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 dark:border-slate-700">
              {d}
            </div>
          ))}
        </div>
        {/* Day cells */}
        <div className="grid grid-cols-7">
          {cells.map((cell) => {
            const occs = byDay.get(cell.date) ?? [];
            const visible = occs.slice(0, MAX_CHIPS);
            const extra = occs.length - visible.length;
            return (
              <div
                key={cell.date}
                onClick={() =>
                  canManage
                    ? (setEditInitial(null), setDrawer({ open: true, bookingId: null, defaults: { date: cell.date } }))
                    : undefined
                }
                className={`min-h-[104px] border-b border-r border-slate-100 p-1.5 align-top transition [&:nth-child(7n)]:border-r-0 ${
                  cell.inMonth ? "bg-white dark:bg-slate-900" : "bg-slate-50/60"
                } ${canManage ? "cursor-pointer hover:bg-accent-50/40" : ""}`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                      cell.isToday
                        ? "bg-accent-600 font-bold text-white"
                        : cell.inMonth
                          ? "text-slate-700 dark:text-slate-300"
                          : "text-slate-300"
                    }`}
                  >
                    {Number(cell.date.slice(8, 10))}
                  </span>
                  {occs.length > 0 && (
                    <span className="text-[10px] text-slate-400">{occs.length}</span>
                  )}
                </div>
                <div className="space-y-1">
                  {visible.map((o) => (
                    <button
                      key={o.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelected(o);
                      }}
                      className={`block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium ${TYPE_STYLES[o.booking.type]}`}
                      title={`${o.booking.user.name} · ${o.desk ? o.desk.label : "WFH"} · ${fmtTime(o.startsAt)}–${fmtTime(o.endsAt)}`}
                    >
                      {o.booking.user.name} · {o.desk ? o.desk.label : "WFH"}
                    </button>
                  ))}
                  {extra > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDayList(cell.date);
                      }}
                      className="block w-full rounded px-1.5 py-0.5 text-left text-[11px] font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                    >
                      +{extra} more
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-xs text-slate-400">
        Click a day to book · click a booking for details. Blue = desk, green = remote/WFH.
      </p>

      {/* Day list dialog ("+N more") */}
      <Dialog open={!!dayList} onClose={() => setDayList(null)}>
        {dayList && (
          <div className="space-y-3">
            <DialogTitle>
              {new Date(dayList + "T00:00:00Z").toLocaleDateString("en-PK", {
                weekday: "long",
                day: "numeric",
                month: "long",
                timeZone: "Asia/Karachi",
              })}
            </DialogTitle>
            <div className="max-h-80 space-y-1.5 overflow-y-auto">
              {dayListOccs.map((o) => (
                <button
                  key={o.id}
                  onClick={() => {
                    setDayList(null);
                    setSelected(o);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg border border-slate-100 px-3 py-2 text-left text-sm hover:border-accent-200 hover:bg-accent-50/40 dark:border-slate-800"
                >
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${o.booking.type === "DESK" ? "bg-accent-500" : "bg-emerald-500"}`} />
                  <span className="min-w-0 flex-1 truncate font-medium text-slate-800 dark:text-slate-200">{o.booking.user.name}</span>
                  <span className="shrink-0 text-xs text-slate-400">{o.desk ? o.desk.label : "WFH"}</span>
                  <span className="shrink-0 text-xs text-slate-400">
                    {fmtTime(o.startsAt)}–{fmtTime(o.endsAt)}
                  </span>
                </button>
              ))}
            </div>
            {canManage && (
              <Button
                size="sm"
                onClick={() => {
                  setDayList(null);
                  setEditInitial(null);
                  setDrawer({ open: true, bookingId: null, defaults: { date: dayList } });
                }}
              >
                Book this day
              </Button>
            )}
          </div>
        )}
      </Dialog>

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
              <Label htmlFor="m-cancel-note">Cancellation note (optional)</Label>
              <Textarea id="m-cancel-note" value={cancelNote} onChange={(e) => setCancelNote(e.target.value)} rows={2} />
            </div>
            {canManage && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => openEdit(selected.booking.id)}>
                  Edit series
                </Button>
                <Button variant="danger" size="sm" disabled={!!cancelling} onClick={() => doCancel("one")}>
                  {cancelling === "one" ? "Cancelling…" : "Cancel this day"}
                </Button>
                <Button variant="danger" size="sm" disabled={!!cancelling} onClick={() => doCancel("series")}>
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
        onSaved={() => refresh(monthStart)}
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
