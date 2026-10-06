"use client";

import * as React from "react";
import { Badge } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";

export interface GanttItem {
  id: string;
  title: string;
  kind: "milestone" | "todo";
  status: string;
  startDate: string | null;
  endDate: string | null;
  assigneeName: string | null;
}

const DAY_MS = 86400000;

function parseDay(s: string): number {
  return new Date(s + "T00:00:00Z").getTime();
}

export function GanttChart({ items }: { items: GanttItem[] }) {
  const dated = items.filter((i) => i.startDate || i.endDate);
  const undated = items.filter((i) => !i.startDate && !i.endDate);

  const { minDay, maxDay } = React.useMemo(() => {
    if (dated.length === 0) return { minDay: 0, maxDay: 0 };
    let min = Infinity;
    let max = -Infinity;
    for (const i of dated) {
      const s = i.startDate ? parseDay(i.startDate) : i.endDate ? parseDay(i.endDate) : 0;
      const e = i.endDate ? parseDay(i.endDate) : i.startDate ? parseDay(i.startDate) : 0;
      if (s < min) min = s;
      if (e > max) max = e;
    }
    // pad 7 days each side
    return { minDay: min - 7 * DAY_MS, maxDay: max + 7 * DAY_MS };
  }, [dated]);

  const totalDays = Math.round((maxDay - minDay) / DAY_MS) + 1;
  const dayWidth = Math.max(28, Math.min(48, Math.floor(1100 / Math.min(totalDays, 40))));

  // month ticks + today line (computed in one memo; hooks stay above the early return)
  const { ticks, todayLeft } = React.useMemo(() => {
    const list: { label: string; left: number }[] = [];
    const d = new Date(minDay);
    d.setUTCDate(1);
    while (d.getTime() <= maxDay) {
      const left = ((d.getTime() - minDay) / DAY_MS) * dayWidth;
      list.push({
        label: d.toLocaleDateString("en-PK", { month: "short", year: "2-digit", timeZone: "Asia/Karachi" }),
        left,
      });
      d.setUTCMonth(d.getUTCMonth() + 1);
    }
    // eslint-disable-next-line react-hooks/purity -- "today" is intentionally read once per render
    return { ticks: list, todayLeft: ((Date.now() - minDay) / DAY_MS) * dayWidth };
  }, [minDay, maxDay, dayWidth]);

  if (dated.length === 0) {
    return (
      <EmptyState
        title="Nothing to show on the timeline"
        description="Add start/end dates to todos and milestones to see them here."
      />
    );
  }

  const barColor = (i: GanttItem) =>
    i.kind === "milestone"
      ? "bg-amber-500"
      : i.status === "DONE"
        ? "bg-emerald-500"
        : i.status === "IN_PROGRESS"
          ? "bg-indigo-500"
          : "bg-slate-400";

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white scroll-thin">
        <div style={{ minWidth: 320 + totalDays * dayWidth }}>
          {/* header */}
          <div className="flex border-b border-slate-200">
            <div className="w-80 shrink-0 border-r border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
              Item
            </div>
            <div className="relative flex-1 bg-slate-50" style={{ height: 34 }}>
              {ticks.map((t, i) => (
                <div key={i} className="absolute top-0 bottom-0 border-l border-slate-200 px-1 pt-1.5 text-[10px] text-slate-500" style={{ left: t.left }}>
                  {t.label}
                </div>
              ))}
            </div>
          </div>
          {/* rows */}
          {dated.map((item) => {
            const s = item.startDate ? parseDay(item.startDate) : parseDay(item.endDate!);
            const e = item.endDate ? parseDay(item.endDate) : parseDay(item.startDate!);
            const left = ((s - minDay) / DAY_MS) * dayWidth;
            const width = Math.max(dayWidth * 0.6, ((e - s) / DAY_MS + 1) * dayWidth);
            return (
              <div key={item.id} className="flex border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                <div className="w-80 shrink-0 truncate border-r border-slate-200 px-3 py-2">
                  <div className="flex items-center gap-2">
                    {item.kind === "milestone" ? (
                      <Badge color="warning" className="text-[10px]">Milestone</Badge>
                    ) : (
                      <Badge color="default" className="text-[10px]">{item.status.replace("_", " ")}</Badge>
                    )}
                    <span className="truncate text-sm font-medium text-slate-800" title={item.title}>
                      {item.title}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-slate-400">
                    {(item.startDate ?? "?") + " → " + (item.endDate ?? "?")}
                    {item.assigneeName ? ` · ${item.assigneeName}` : ""}
                  </div>
                </div>
                <div className="relative flex-1" style={{ height: 52 }}>
                  {/* today line */}
                  {todayLeft >= 0 && todayLeft <= totalDays * dayWidth && (
                    <div className="absolute top-0 bottom-0 z-10 w-px bg-red-400" style={{ left: todayLeft }} title="Today" />
                  )}
                  <div
                    className={`absolute top-1/2 h-6 -translate-y-1/2 rounded-md ${barColor(item)} opacity-90`}
                    style={{ left, width }}
                    title={`${item.title}: ${item.startDate ?? "?"} → ${item.endDate ?? "?"}`}
                  />
                  {item.kind === "milestone" && item.endDate && (
                    <div
                      className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 bg-amber-600"
                      style={{ left: left + width - 6 }}
                      title={`Due ${item.endDate}`}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {undated.length > 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-4">
          <p className="text-sm font-medium text-slate-600">Without dates ({undated.length})</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {undated.map((i) => (
              <Badge key={i.id} color="default">{i.title}</Badge>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-amber-500" /> Milestone</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-indigo-500" /> In progress</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-slate-400" /> To do</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-emerald-500" /> Done</span>
        <span className="flex items-center gap-1"><span className="h-3 w-px bg-red-400" /> Today</span>
      </div>
    </div>
  );
}
