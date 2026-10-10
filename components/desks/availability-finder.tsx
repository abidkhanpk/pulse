"use client";

import * as React from "react";
import { Search, Armchair, CalendarClock, AlertTriangle, Sparkles } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { fmtDayMonth, fmtFullDate } from "@/lib/dates";
import {
  findAvailability,
  type AvailabilityDesk,
  type AvailabilityInput,
  type AvailabilityResult,
} from "@/app/(app)/desks/actions";
import { BookingDrawer } from "./booking-drawer";

const WEEKDAY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

const TOLERANCES: { value: number; label: string }[] = [
  { value: 0, label: "No tolerance" },
  { value: 30, label: "30 min" },
  { value: 60, label: "1 hour" },
  { value: 120, label: "2 hours" },
  { value: 180, label: "3 hours" },
  { value: 240, label: "4 hours" },
  { value: 300, label: "5 hours" },
];

const HORIZONS: { value: number; label: string }[] = [
  { value: 1, label: "1 month" },
  { value: 3, label: "3 months" },
  { value: 6, label: "6 months" },
  { value: 12, label: "12 months" },
];

/** Minutes-of-day → "9:00 AM". */
export function fmtMinutes(min: number): string {
  const h24 = Math.floor(min / 60);
  const m = min % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(m).padStart(2, "0")} ${suffix}`;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function AvailabilityFinder({
  labId,
  today,
  amenityOptions,
  people,
  desks,
  projects,
  canBook,
  aiPanel,
}: {
  labId: string;
  today: string;
  amenityOptions: { id: string; label: string }[];
  people: { id: string; name: string }[];
  desks: { id: string; label: string; status: string }[];
  projects: { id: string; name: string }[];
  canBook: boolean;
  /** Phase 4: AI planning panel, rendered under the results when a
   *  search context exists. Receives the last search + result. */
  aiPanel?: (ctx: { input: AvailabilityInput; result: AvailabilityResult } | null) => React.ReactNode;
}) {
  const [from, setFrom] = React.useState(today);
  const [to, setTo] = React.useState(addDays(today, 6));
  const [pattern, setPattern] = React.useState<"all" | "weekdays">("all");
  const [weekdays, setWeekdays] = React.useState<number[]>([1, 2, 3, 4, 5]);
  const [startTime, setStartTime] = React.useState("08:00");
  const [endTime, setEndTime] = React.useState("16:00");
  const [toleranceMin, setToleranceMin] = React.useState(60);
  const [amenityIds, setAmenityIds] = React.useState<string[]>([]);
  const [horizonMonths, setHorizonMonths] = React.useState(6);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<AvailabilityResult | null>(null);
  const [lastInput, setLastInput] = React.useState<AvailabilityInput | null>(null);
  const [bookDesk, setBookDesk] = React.useState<AvailabilityDesk | null>(null);

  function toggleWeekday(v: number) {
    setWeekdays((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  }
  function toggleAmenity(id: string) {
    setAmenityIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const input: AvailabilityInput = {
      labId,
      from,
      to,
      weekdays: pattern === "weekdays" ? weekdays : null,
      startTime,
      endTime,
      toleranceMin,
      amenityIds,
      horizonMonths,
    };
    setPending(true);
    try {
      const res = await findAvailability(input);
      if (!res.ok) {
        setError(res.error);
        setResult(null);
        setLastInput(null);
      } else {
        setResult(res.data);
        setLastInput(input);
      }
    } finally {
      setPending(false);
    }
  }

  const deskRow = (d: AvailabilityDesk, extra?: React.ReactNode) => (
    <div
      key={d.id}
      className="flex flex-wrap items-start gap-x-3 gap-y-1.5 rounded-sm border border-slate-200 px-3 py-2 dark:border-slate-800"
    >
      <div className="min-w-40">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {d.label}
          {d.layoutLabel && <span className="ml-1.5 text-xs font-normal text-slate-400">({d.layoutLabel})</span>}
        </p>
        {d.amenities.length > 0 && (
          <p className="mt-0.5 flex flex-wrap gap-1">
            {d.amenities.map((a) => (
              <span key={a.id} className="rounded-sm bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {a.label}
              </span>
            ))}
          </p>
        )}
      </div>
      <div className="ml-auto flex flex-col items-end gap-1">{extra}</div>
    </div>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-4 w-4 text-accent-600" /> Find an available desk
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSearch} className="space-y-3">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div>
                <Label htmlFor="av-from">From</Label>
                <Input id="av-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="av-to">To</Label>
                <Input id="av-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="av-start">Needed from</Label>
                <Input id="av-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="av-end">Needed until</Label>
                <Input id="av-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              <div>
                <Label>Days needed</Label>
                <div className="flex gap-1">
                  <Button type="button" size="sm" variant={pattern === "all" ? "primary" : "outline"} onClick={() => setPattern("all")}>
                    Every day
                  </Button>
                  <Button type="button" size="sm" variant={pattern === "weekdays" ? "primary" : "outline"} onClick={() => setPattern("weekdays")}>
                    Specific weekdays
                  </Button>
                </div>
                {pattern === "weekdays" && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {WEEKDAY_OPTIONS.map((w) => (
                      <button
                        key={w.value}
                        type="button"
                        onClick={() => toggleWeekday(w.value)}
                        className={`rounded-sm px-2 py-1 text-xs font-medium ${
                          weekdays.includes(w.value)
                            ? "bg-accent-600 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        {w.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <Label htmlFor="av-tol">Start-time tolerance</Label>
                <Select id="av-tol" value={String(toleranceMin)} onChange={(e) => setToleranceMin(Number(e.target.value))}>
                  {TOLERANCES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </Select>
                <p className="mt-1 text-xs text-slate-400">
                  A desk that frees up within the tolerance after your start time still counts — its actual start is shown.
                </p>
              </div>
              <div>
                <Label htmlFor="av-horizon">“Next available” looks ahead</Label>
                <Select id="av-horizon" value={String(horizonMonths)} onChange={(e) => setHorizonMonths(Number(e.target.value))}>
                  {HORIZONS.map((h) => (
                    <option key={h.value} value={h.value}>{h.label}</option>
                  ))}
                </Select>
              </div>
            </div>

            {amenityOptions.length > 0 && (
              <div>
                <Label>Required amenities</Label>
                <div className="flex flex-wrap gap-1.5">
                  {amenityOptions.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => toggleAmenity(a.id)}
                      className={`rounded-sm px-2 py-1 text-xs font-medium ${
                        amenityIds.includes(a.id)
                          ? "bg-accent-600 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <div>
              <Button type="submit" disabled={pending}>
                {pending ? "Searching…" : "Search availability"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {result && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Armchair className="h-4 w-4 text-emerald-600" /> Fully available — {result.full.length}
                <span className="text-xs font-normal text-slate-400">
                  free for the whole request ({result.requestedDays} day{result.requestedDays === 1 ? "" : "s"})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {result.full.length === 0 ? (
                <EmptyState title="No desk is free for the whole request" description="Try a shorter range, fewer required days, or a larger tolerance — or check the near matches below." />
              ) : (
                result.full.map((d) =>
                  deskRow(
                    d,
                    <>
                      {d.lateFromMin !== null && (
                        <span className="rounded-sm bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                          Available from {fmtMinutes(d.lateFromMin)} on some days
                        </span>
                      )}
                      {canBook && (
                        <Button size="sm" variant="outline" onClick={() => setBookDesk(d)}>
                          Book this desk
                        </Button>
                      )}
                    </>
                  )
                )
              )}
            </CardContent>
          </Card>

          {result.near.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-4 w-4 text-amber-500" /> Nearly available — {result.near.length}
                  <span className="text-xs font-normal text-slate-400">blocked on 3 days or fewer — here is exactly what blocks them</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {result.near.map((d) =>
                  deskRow(
                    d,
                    <div className="max-w-md space-y-1 text-right">
                      {d.blockedDays.map((bd) => (
                        <p key={bd.date} className="text-xs text-slate-500 dark:text-slate-400">
                          <span className="font-medium text-slate-700 dark:text-slate-200">{fmtDayMonth(bd.date)}:</span>{" "}
                          {bd.bookings.map((b) => `${b.person}${b.title ? ` (${b.title})` : ""} ${fmtMinutes(b.startMin)}–${fmtMinutes(b.endMin)}`).join("; ")}
                        </p>
                      ))}
                    </div>
                  )
                )}
              </CardContent>
            </Card>
          )}

          {result.next.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarClock className="h-4 w-4 text-sky-600" /> Next available
                  <span className="text-xs font-normal text-slate-400">first window where the same request fits completely</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {result.next.map((n) => (
                  <div key={n.desk.id}>
                    {deskRow(
                      n.desk,
                      <span className="rounded-sm bg-sky-100 px-1.5 py-0.5 text-xs font-medium text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                        {fmtDayMonth(n.fromDate)} → {fmtDayMonth(n.toDate)} ({fmtFullDate(n.fromDate)})
                      </span>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {aiPanel ? aiPanel(lastInput && result ? { input: lastInput, result } : null) : null}

      {bookDesk && lastInput && (
        <BookingDrawer
          key={bookDesk.id}
          open={!!bookDesk}
          onClose={() => setBookDesk(null)}
          onSaved={() => setBookDesk(null)}
          defaults={{
            deskId: bookDesk.id,
            date: lastInput.from,
            timeStart: lastInput.startTime,
            timeEnd: lastInput.endTime,
          }}
          people={people}
          desks={desks}
          projects={projects}
          initial={null}
        />
      )}

      {!result && (
        <p className="flex items-center gap-2 px-1 text-xs text-slate-400">
          <Sparkles className="h-3.5 w-3.5" />
          Example: a new team needs a desk with a personal computer, every weekday for the next two weeks, 8 to 4 — set the range, pick Mon–Fri, choose the PC amenity, and search.
        </p>
      )}
    </div>
  );
}
