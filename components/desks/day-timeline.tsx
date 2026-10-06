"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/card";
import { listOccurrences } from "@/app/(app)/desks/actions";
import type { Occurrence } from "./week-grid";

const DAY_START_MIN = 7 * 60; // 07:00
const DAY_END_MIN = 19 * 60; // 19:00

function pktMinutes(iso: string): number {
  const d = new Date(iso);
  // convert to PKT wall time
  const pkt = new Date(d.getTime() + 5 * 60 * 60 * 1000);
  return pkt.getUTCHours() * 60 + pkt.getUTCMinutes();
}

function fmtRange(o: Occurrence): string {
  const f = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Karachi" });
  return `${f(o.startsAt)}–${f(o.endsAt)}`;
}

export function DayTimeline({
  desks,
  initialOccurrences,
  initialDate,
}: {
  desks: { id: string; label: string; status: string; lab: { id: string; name: string } }[];
  initialOccurrences: Occurrence[];
  initialDate: string;
}) {
  const [date, setDate] = React.useState(initialDate);
  const [occurrences, setOccurrences] = React.useState<Occurrence[]>(initialOccurrences);
  const [loading, setLoading] = React.useState(false);

  async function load(d: string) {
    setLoading(true);
    try {
      const occs = await listOccurrences({ from: d, to: d });
      setOccurrences(
        occs.map((o) => ({
          id: o.id,
          date: d,
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
  }

  function changeDate(d: string) {
    setDate(d);
    load(d);
  }

  const hours = Array.from({ length: DAY_END_MIN / 60 - DAY_START_MIN / 60 + 1 }, (_, i) => DAY_START_MIN / 60 + i);
  const totalMin = DAY_END_MIN - DAY_START_MIN;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Label htmlFor="tl-date" className="!mb-0">Day</Label>
        <Input
          id="tl-date"
          type="date"
          value={date}
          onChange={(e) => e.target.value && changeDate(e.target.value)}
          className="w-44"
        />
        {loading && <span className="text-xs text-slate-400">Loading…</span>}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white scroll-thin">
        <div className="min-w-[900px]">
          {/* hour header */}
          <div className="flex border-b border-slate-200 bg-slate-50">
            <div className="w-40 shrink-0 px-3 py-2 text-xs font-semibold text-slate-500">Desk</div>
            <div className="relative flex-1">
              {hours.map((h) => (
                <div
                  key={h}
                  className="absolute top-0 bottom-0 border-l border-slate-200 px-1 py-2 text-[10px] text-slate-400"
                  style={{ left: `${((h * 60 - DAY_START_MIN) / totalMin) * 100}%` }}
                >
                  {String(h).padStart(2, "0")}:00
                </div>
              ))}
              <div className="h-8" />
            </div>
          </div>
          {/* desk rows */}
          {desks.map((desk) => {
            const blocks = occurrences
              .filter((o) => o.deskId === desk.id)
              .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
            return (
              <div key={desk.id} className="flex border-b border-slate-100 last:border-0">
                <div className="w-40 shrink-0 border-r border-slate-200 px-3 py-2">
                  <div className="text-sm font-medium text-slate-800">{desk.label}</div>
                  {desk.status === "MAINTENANCE" && <Badge color="warning">Maintenance</Badge>}
                </div>
                <div className="relative flex-1" style={{ minHeight: 40 }}>
                  {hours.map((h) => (
                    <div
                      key={h}
                      className="absolute top-0 bottom-0 border-l border-slate-100"
                      style={{ left: `${((h * 60 - DAY_START_MIN) / totalMin) * 100}%` }}
                    />
                  ))}
                  {blocks.map((o) => {
                    const s = Math.max(pktMinutes(o.startsAt), DAY_START_MIN);
                    const e = Math.min(pktMinutes(o.endsAt), DAY_END_MIN);
                    if (e <= s) return null;
                    const left = ((s - DAY_START_MIN) / totalMin) * 100;
                    const width = ((e - s) / totalMin) * 100;
                    return (
                      <div
                        key={o.id}
                        className="absolute top-1.5 bottom-1.5 overflow-hidden rounded-md border border-indigo-200 bg-indigo-100 px-2 py-0.5 text-xs"
                        style={{ left: `${left}%`, width: `${width}%` }}
                        title={`${o.booking.user.name} — ${fmtRange(o)}${o.booking.title ? ` — ${o.booking.title}` : ""}`}
                      >
                        <span className="font-medium text-indigo-900">{o.booking.user.name}</span>
                        <span className="ml-1 text-indigo-700">{fmtRange(o)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {/* remote row */}
          <div className="flex bg-emerald-50/40">
            <div className="w-40 shrink-0 border-r border-slate-200 px-3 py-2">
              <div className="text-sm font-medium text-emerald-800">Remote / WFH</div>
            </div>
            <div className="relative flex-1" style={{ minHeight: 40 }}>
              {occurrences
                .filter((o) => !o.deskId)
                .map((o) => {
                  const s = Math.max(pktMinutes(o.startsAt), DAY_START_MIN);
                  const e = Math.min(pktMinutes(o.endsAt), DAY_END_MIN);
                  if (e <= s) return null;
                  const left = ((s - DAY_START_MIN) / totalMin) * 100;
                  const width = ((e - s) / totalMin) * 100;
                  return (
                    <div
                      key={o.id}
                      className="absolute top-1.5 bottom-1.5 overflow-hidden rounded-md border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-xs"
                      style={{ left: `${left}%`, width: `${width}%` }}
                      title={`${o.booking.user.name} — ${fmtRange(o)}`}
                    >
                      <span className="font-medium text-emerald-900">{o.booking.user.name}</span>
                      <span className="ml-1 text-emerald-700">{fmtRange(o)}</span>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
