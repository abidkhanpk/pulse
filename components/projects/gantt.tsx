"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";

export interface GanttMilestone {
  id: string;
  title: string;
  startDate: string | null;
  dueDate: string | null;
  status: string;
  dependsOnIds: string[];
}

export interface GanttTodo {
  id: string;
  title: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  assigneeName: string | null;
  milestoneId: string | null;
  dependsOnIds: string[];
}

const DAY_MS = 86400000;
const LABEL_W = 264;
const ROW_H = 34;
const HEADER_H = 56;

function parseDay(s: string): number {
  return new Date(s + "T00:00:00Z").getTime();
}
function toISODate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

type Row =
  | { kind: "milestone"; ms: GanttMilestone; spanStart: number | null; spanEnd: number | null }
  | { kind: "todo"; todo: GanttTodo };

interface DragState {
  todoId: string;
  edge: "left" | "right";
  startX: number;
  origStart: number;
  origEnd: number;
}

const STATUS_BG: Record<string, string> = {
  TODO: "bg-slate-400",
  IN_PROGRESS: "bg-indigo-500",
  DONE: "bg-emerald-500",
};

export function GanttChart({
  milestones,
  todos,
  onResizeTodo,
  onTodoClick,
}: {
  milestones: GanttMilestone[];
  todos: GanttTodo[];
  onResizeTodo: (todoId: string, startDate: string, endDate: string) => Promise<void>;
  onTodoClick: (todo: GanttTodo) => void;
}) {
  const dated = todos.filter((t) => t.startDate || t.endDate);
  const undated = todos.filter((t) => !t.startDate && !t.endDate);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = React.useState(0);
  const [dayWidth, setDayWidth] = React.useState<number | null>(null); // null = fit
  const [preview, setPreview] = React.useState<Record<string, { s: number; e: number }>>({});
  const [saving, setSaving] = React.useState(false);
  const dragRef = React.useRef<DragState | null>(null);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setContainerW(el.clientWidth));
    ro.observe(el);
    setContainerW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const { minDay, maxDay } = React.useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    const consider = (s: string | null, e: string | null) => {
      const a = s ? parseDay(s) : e ? parseDay(e) : null;
      const b = e ? parseDay(e) : s ? parseDay(s) : null;
      if (a !== null && a < min) min = a;
      if (b !== null && b > max) max = b;
    };
    for (const t of dated) consider(t.startDate, t.endDate);
    for (const m of milestones) {
      const mTodos = dated.filter((t) => t.milestoneId === m.id);
      for (const t of mTodos) consider(t.startDate, t.endDate);
      if (m.dueDate) consider(null, m.dueDate);
    }
    if (min === Infinity) return { minDay: 0, maxDay: 0 };
    return { minDay: min - 7 * DAY_MS, maxDay: max + 7 * DAY_MS };
  }, [dated, milestones]);

  const totalDays = Math.max(1, Math.round((maxDay - minDay) / DAY_MS) + 1);
  const fitWidth = containerW > LABEL_W + 40 ? Math.max(14, Math.floor((containerW - LABEL_W - 8) / totalDays)) : 28;
  const dw = dayWidth ?? fitWidth;

  // Build hierarchical rows
  const rows: Row[] = React.useMemo(() => {
    const out: Row[] = [];
    const byMs = new Map<string, GanttTodo[]>();
    for (const t of dated) {
      const k = t.milestoneId ?? "__none__";
      if (!byMs.has(k)) byMs.set(k, []);
      byMs.get(k)!.push(t);
    }
    const sortedMs = [...milestones].sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
    for (const m of sortedMs) {
      const mTodos = (byMs.get(m.id) ?? []).sort((a, b) =>
        (a.startDate ?? a.endDate ?? "").localeCompare(b.startDate ?? b.endDate ?? "")
      );
      let spanStart: number | null = null;
      let spanEnd: number | null = null;
      for (const t of mTodos) {
        const s = t.startDate ? parseDay(t.startDate) : t.endDate ? parseDay(t.endDate) : null;
        const e = t.endDate ? parseDay(t.endDate) : t.startDate ? parseDay(t.startDate) : null;
        if (s !== null && (spanStart === null || s < spanStart)) spanStart = s;
        if (e !== null && (spanEnd === null || e > spanEnd)) spanEnd = e;
      }
      if (m.dueDate) {
        const d = parseDay(m.dueDate);
        if (spanEnd === null || d > spanEnd) spanEnd = d;
      }
      // Manual milestone start widens the span left (containment guarantees it never narrows).
      if (m.startDate) {
        const msd = parseDay(m.startDate);
        if (spanStart === null || msd < spanStart) spanStart = msd;
      }
      out.push({ kind: "milestone", ms: m, spanStart, spanEnd });
      for (const t of mTodos) out.push({ kind: "todo", todo: t });
      byMs.delete(m.id);
    }
    const loose = (byMs.get("__none__") ?? []).sort((a, b) =>
      (a.startDate ?? a.endDate ?? "").localeCompare(b.startDate ?? b.endDate ?? "")
    );
    if (loose.length > 0) {
      out.push({
        kind: "milestone",
        ms: { id: "__none__", title: "Without milestone", startDate: null, dueDate: null, status: "PLANNED", dependsOnIds: [] },
        spanStart: null,
        spanEnd: null,
      });
      for (const t of loose) out.push({ kind: "todo", todo: t });
    }
    return out;
  }, [dated, milestones]);



  const xOf = React.useCallback((ms: number) => ((ms - minDay) / DAY_MS) * dw, [minDay, dw]);

  // Bar geometry (mirrors the todo row renderer, incl. drag preview).
  const barGeom = React.useCallback(
    (t: GanttTodo) => {
      const pv = preview[t.id];
      const s = pv ? pv.s : t.startDate ? parseDay(t.startDate) : t.endDate ? parseDay(t.endDate) : minDay;
      const e = pv ? pv.e : t.endDate ? parseDay(t.endDate) : t.startDate ? parseDay(t.startDate) : minDay;
      const left = xOf(s);
      const width = Math.max(dw * 0.7, xOf(e) - xOf(s) + dw);
      return { left, width };
    },
    [preview, minDay, xOf, dw]
  );

  // ── Dependency links (Finish-to-Start arrows) ──
  const links = React.useMemo(() => {
    const rowY = new Map<string, number>(); // "t:<id>" | "m:<id>" → row center y
    rows.forEach((row, i) => {
      const y = i * ROW_H + ROW_H / 2;
      if (row.kind === "todo") rowY.set(`t:${row.todo.id}`, y);
      else rowY.set(`m:${row.ms.id}`, y);
    });
    // Milestone anchor x: finish = due date (diamond) or span end; start = span start or due date.
    const msFinishX = new Map<string, number>();
    const msStartX = new Map<string, number>();
    for (const row of rows) {
      if (row.kind !== "milestone" || row.ms.id === "__none__") continue;
      const { ms, spanStart, spanEnd } = row;
      const fx = ms.dueDate ? xOf(parseDay(ms.dueDate)) : spanEnd !== null ? xOf(spanEnd) + dw : null;
      const sx = spanStart !== null ? xOf(spanStart) : ms.dueDate ? xOf(parseDay(ms.dueDate)) : null;
      if (fx !== null) msFinishX.set(ms.id, fx);
      if (sx !== null) msStartX.set(ms.id, sx);
    }
    const todoById = new Map(dated.map((t) => [t.id, t]));
    const out: { key: string; x1: number; y1: number; x2: number; y2: number; conflict: boolean; label: string }[] = [];

    // Todo → todo
    for (const t of dated) {
      const y2 = rowY.get(`t:${t.id}`);
      if (y2 === undefined) continue;
      const { left: x2 } = barGeom(t);
      for (const depId of t.dependsOnIds) {
        const pred = todoById.get(depId);
        const y1 = rowY.get(`t:${depId}`);
        if (!pred || y1 === undefined) continue;
        const { left, width } = barGeom(pred);
        const x1 = left + width;
        out.push({
          key: `tt:${depId}:${t.id}`,
          x1, y1, x2, y2,
          conflict: x2 < x1 - 1, // successor starts before predecessor finishes
          label: `${pred.title} → ${t.title}`,
        });
      }
    }
    // Milestone → milestone
    for (const row of rows) {
      if (row.kind !== "milestone" || row.ms.id === "__none__") continue;
      const y2 = rowY.get(`m:${row.ms.id}`);
      const x2 = msStartX.get(row.ms.id);
      if (y2 === undefined || x2 === undefined) continue;
      for (const depId of row.ms.dependsOnIds) {
        const y1 = rowY.get(`m:${depId}`);
        const x1 = msFinishX.get(depId);
        if (y1 === undefined || x1 === undefined) continue;
        out.push({
          key: `mm:${depId}:${row.ms.id}`,
          x1, y1, x2, y2,
          conflict: x2 < x1 - 1,
          label: `Milestone dependency`,
        });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- barGeom identity changes with preview; links must follow drags
  }, [rows, dated, milestones, xOf, dw, barGeom]);

  // Month + day headers
  const { monthCells, dayCells } = React.useMemo(() => {
    /* eslint-disable react-hooks/purity -- calendar labels + "today" are intentionally read during render */
    const months: { label: string; left: number; width: number }[] = [];
    const days: { n: number; dow: string; left: number; weekend: boolean; today: boolean }[] = [];
    const todayIso = toISODate(Date.now());
    let cur: { label: string; left: number; width: number } | null = null;
    for (let i = 0; i < totalDays; i++) {
      const ms = minDay + i * DAY_MS;
      const d = new Date(ms);
      const label = d.toLocaleDateString("en-PK", { month: "long", year: "numeric", timeZone: "UTC" });
      const left = i * dw;
      if (!cur || cur.label !== label) {
        if (cur) months.push(cur);
        cur = { label, left, width: dw };
      } else {
        cur.width += dw;
      }
      const dow = d.getUTCDay();
      days.push({
        n: d.getUTCDate(),
        dow: "SMTWTFS"[dow],
        left,
        weekend: dow === 0 || dow === 6,
        today: toISODate(ms) === todayIso,
      });
    }
    if (cur) months.push(cur);
    /* eslint-enable react-hooks/purity */
    return { monthCells: months, dayCells: days };
  }, [minDay, totalDays, dw]);

  const todayX = React.useMemo(() => {
    // eslint-disable-next-line react-hooks/purity -- "today" is intentionally read once per render
    const t = Date.now();
    if (t < minDay || t > maxDay) return null;
    return xOf(t);
  }, [minDay, maxDay, xOf]);

  // ── Drag resizing ──
  function onHandleDown(e: React.PointerEvent, todo: GanttTodo, edge: "left" | "right") {
    if (saving) return;
    e.stopPropagation();
    e.preventDefault();
    const s = todo.startDate ? parseDay(todo.startDate) : todo.endDate ? parseDay(todo.endDate) : Date.now();
    const en = todo.endDate ? parseDay(todo.endDate) : todo.startDate ? parseDay(todo.startDate) : Date.now();
    dragRef.current = { todoId: todo.id, edge, startX: e.clientX, origStart: s, origEnd: en };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onDragMove(e: React.PointerEvent) {
    const dr = dragRef.current;
    if (!dr) return;
    const deltaDays = Math.round((e.clientX - dr.startX) / dw);
    let s = dr.origStart;
    let en = dr.origEnd;
    if (dr.edge === "left") s = Math.min(dr.origStart + deltaDays * DAY_MS, en);
    else en = Math.max(dr.origEnd + deltaDays * DAY_MS, s);
    setPreview((p) => ({ ...p, [dr.todoId]: { s, e: en } }));
  }

  async function onDragUp() {
    const dr = dragRef.current;
    dragRef.current = null;
    if (!dr) return;
    const pv = preview[dr.todoId];
    setPreview((p) => {
      const n = { ...p };
      delete n[dr.todoId];
      return n;
    });
    if (!pv) return;
    if (pv.s === dr.origStart && pv.e === dr.origEnd) return; // no change
    setSaving(true);
    try {
      await onResizeTodo(dr.todoId, toISODate(pv.s), toISODate(pv.e));
    } finally {
      setSaving(false);
    }
  }

  if (dated.length === 0) {
    return (
      <EmptyState
        title="Nothing to show on the timeline"
        description="Add start/end dates to todos to see them here. Drag a bar's edges to change its duration."
      />
    );
  }

  const timelineW = totalDays * dw;

  return (
    <div className="space-y-3" ref={containerRef}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
          <Button variant="ghost" size="sm" onClick={() => setDayWidth((w) => Math.max(10, (w ?? fitWidth) - 8))} title="Zoom out">−</Button>
          <Button variant="ghost" size="sm" onClick={() => setDayWidth(null)} title="Fit to screen">Fit</Button>
          <Button variant="ghost" size="sm" onClick={() => setDayWidth((w) => Math.min(72, (w ?? fitWidth) + 8))} title="Zoom in">+</Button>
        </div>
        <span className="text-xs text-slate-400">
          Drag a bar&apos;s left/right edge to change its duration{saving ? " · saving…" : ""}
        </span>
        <div className="ml-auto flex flex-wrap gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1"><span className="h-2.5 w-6 rounded bg-amber-500/80" /> Milestone</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-6 rounded bg-indigo-500" /> In progress</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-6 rounded bg-slate-400" /> To do</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-6 rounded bg-emerald-500" /> Done</span>
          <span className="flex items-center gap-1" title="Finish-to-Start dependency">
            <svg width="24" height="10" className="inline"><path d="M1 5 H14 V9 H21" fill="none" stroke="#64748b" strokeWidth="1.5" markerEnd="url(#dep-arrow-legend)" /><defs><marker id="dep-arrow-legend" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 1 L 9 5 L 0 9 z" fill="#64748b" /></marker></defs></svg>
            Depends on
          </span>
        </div>
      </div>

      {/* Chart */}
      <div
        className="overflow-auto rounded-xl border border-slate-200 bg-white scroll-thin"
        style={{ maxHeight: 560 }}
        onPointerMove={onDragMove}
        onPointerUp={onDragUp}
        onPointerCancel={onDragUp}
      >
        <div style={{ width: LABEL_W + timelineW }}>
          {/* Calendar header */}
          <div className="sticky top-0 z-20 flex bg-white shadow-[0_1px_0_0_#e2e8f0]">
            <div className="shrink-0 border-r border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500" style={{ width: LABEL_W }}>
              <div style={{ height: HEADER_H - 16 }} className="flex items-end">Item</div>
            </div>
            <div className="relative" style={{ width: timelineW, height: HEADER_H }}>
              {monthCells.map((m, i) => (
                <div
                  key={i}
                  className="absolute top-0 border-l border-slate-300 px-1.5 pt-1 text-xs font-semibold text-slate-600"
                  style={{ left: m.left, width: m.width }}
                >
                  <span className="whitespace-nowrap">{m.label}</span>
                </div>
              ))}
              {dayCells.map((d, i) => (
                <div
                  key={i}
                  className={`absolute bottom-0 border-l border-slate-100 text-center text-[10px] leading-4 ${
                    d.weekend ? "bg-slate-100/70 text-slate-400" : "text-slate-500"
                  } ${d.today ? "!bg-indigo-100 font-bold text-indigo-700" : ""}`}
                  style={{ left: d.left, width: dw, height: 24 }}
                  title={d.today ? "Today" : undefined}
                >
                  <span className="block text-[9px] text-slate-400">{d.dow}</span>
                  <span className="block -mt-0.5">{d.n}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Rows + dependency overlay */}
          <div className="relative">
          {rows.map((row) => {
            if (row.kind === "milestone") {
              const { ms, spanStart, spanEnd } = row;
              return (
                <div key={`ms-${ms.id}`} className="flex border-b border-slate-200 bg-amber-50/40">
                  <div className="flex shrink-0 items-center gap-2 border-r border-slate-200 px-3" style={{ width: LABEL_W, height: ROW_H }}>
                    <span className="inline-block h-2.5 w-2.5 rotate-45 bg-amber-500" />
                    <span className="truncate text-sm font-semibold text-slate-800" title={ms.title}>{ms.title}</span>
                    {ms.dueDate && ms.id !== "__none__" && (
                      <span className="ml-auto shrink-0 text-[11px] text-slate-400">due {ms.dueDate}</span>
                    )}
                  </div>
                  <div className="relative" style={{ width: timelineW, height: ROW_H }}>
                    {dayCells.map((d, i) => (
                      <div key={i} className={`absolute inset-y-0 border-l border-slate-100 ${d.weekend ? "bg-slate-50" : ""}`} style={{ left: d.left, width: dw }} />
                    ))}
                    {todayX !== null && <div className="absolute inset-y-0 z-10 w-px bg-red-400/70" style={{ left: todayX }} />}
                    {spanStart !== null && spanEnd !== null && (
                      <div
                        className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded-full bg-amber-500/80"
                        style={{ left: xOf(spanStart), width: Math.max(8, xOf(spanEnd) - xOf(spanStart) + dw) }}
                        title={`${ms.title}: ${toISODate(spanStart)} → ${toISODate(spanEnd)}`}
                      />
                    )}
                    {ms.dueDate && (
                      <div
                        className="absolute top-1/2 z-10 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-2 border-white bg-amber-600 shadow"
                        style={{ left: xOf(parseDay(ms.dueDate)) }}
                        title={`Due ${ms.dueDate}`}
                      />
                    )}
                  </div>
                </div>
              );
            }
            const t = row.todo;
            const pv = preview[t.id];
            const s = pv ? pv.s : t.startDate ? parseDay(t.startDate) : t.endDate ? parseDay(t.endDate) : minDay;
            const e = pv ? pv.e : t.endDate ? parseDay(t.endDate) : t.startDate ? parseDay(t.startDate) : minDay;
            const left = xOf(s);
            const width = Math.max(dw * 0.7, xOf(e) - xOf(s) + dw);
            const isDone = t.status === "DONE";
            return (
              <div key={t.id} className={`flex border-b border-slate-100 hover:bg-slate-50/60 ${pv ? "bg-indigo-50/40" : ""}`}>
                <div
                  className="flex shrink-0 cursor-pointer items-center gap-2 border-r border-slate-200 py-1 pl-8 pr-3"
                  style={{ width: LABEL_W, minHeight: ROW_H }}
                  onClick={() => onTodoClick(t)}
                  title="Open todo"
                >
                  <span className="min-w-0 flex-1 truncate text-[13px] text-slate-700">
                    <span className={isDone ? "line-through text-slate-400" : ""}>{t.title}</span>
                  </span>
                  {t.assigneeName && (
                    <span className="shrink-0 text-[11px] text-slate-400" title={t.assigneeName}>
                      {t.assigneeName.split(" ")[0]}
                    </span>
                  )}
                </div>
                <div className="relative" style={{ width: timelineW, height: ROW_H }}>
                  {dayCells.map((d, i) => (
                    <div key={i} className={`absolute inset-y-0 border-l border-slate-100 ${d.weekend ? "bg-slate-50" : ""} ${d.today ? "bg-indigo-50/60" : ""}`} style={{ left: d.left, width: dw }} />
                  ))}
                  {todayX !== null && <div className="absolute inset-y-0 z-10 w-px bg-red-400/70" style={{ left: todayX }} />}
                  <div
                    className={`group absolute top-1/2 h-6 -translate-y-1/2 rounded-md ${STATUS_BG[t.status] ?? "bg-slate-400"} ${pv ? "opacity-100 shadow-lg" : "opacity-90"} ${isDone ? "opacity-60" : ""}`}
                    style={{ left, width }}
                    title={`${t.title}\n${toISODate(s)} → ${toISODate(e)}\nDrag edges to resize`}
                  >
                    {/* left handle */}
                    <div
                      className="absolute inset-y-0 left-0 w-2.5 cursor-ew-resize rounded-l-md opacity-0 transition-opacity group-hover:opacity-100 hover:bg-white/40"
                      onPointerDown={(ev) => onHandleDown(ev, t, "left")}
                      title="Drag to change start"
                    />
                    {/* right handle */}
                    <div
                      className="absolute inset-y-0 right-0 w-2.5 cursor-ew-resize rounded-r-md opacity-0 transition-opacity group-hover:opacity-100 hover:bg-white/40"
                      onPointerDown={(ev) => onHandleDown(ev, t, "right")}
                      title="Drag to change end"
                    />
                    {width > 60 && (
                      <span className="pointer-events-none absolute inset-0 flex items-center justify-center truncate px-2 text-[10px] font-medium text-white">
                        {toISODate(s) === toISODate(e) ? toISODate(s).slice(5) : `${toISODate(s).slice(5)} → ${toISODate(e).slice(5)}`}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {rows.length === 0 && (
            <p className="p-6 text-center text-sm text-slate-400">No dated items.</p>
          )}
          {/* Dependency arrows (SVG overlay over the timeline area) */}
          {links.length > 0 && (
            <svg
              className="pointer-events-none absolute left-0 top-0 z-10"
              style={{ left: LABEL_W, width: timelineW, height: rows.length * ROW_H }}
              aria-hidden
            >
              <defs>
                <marker id="dep-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M 0 1 L 9 5 L 0 9 z" fill="#64748b" />
                </marker>
                <marker id="dep-arrow-conflict" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M 0 1 L 9 5 L 0 9 z" fill="#dc2626" />
                </marker>
              </defs>
              {links.map((l) => {
                const stub = 10;
                const color = l.conflict ? "#dc2626" : "#64748b";
                // Elbow: out of predecessor's finish → vertical → into successor's start.
                const d = `M ${l.x1} ${l.y1} h ${stub} V ${l.y2} H ${l.x2 - 2}`;
                return (
                  <g key={l.key}>
                    <title>{l.label}{l.conflict ? " — schedule conflict: starts before predecessor finishes" : ""}</title>
                    <path
                      d={d}
                      fill="none"
                      stroke={color}
                      strokeWidth={l.conflict ? 2 : 1.5}
                      strokeDasharray={l.conflict ? "4 3" : undefined}
                      markerEnd={`url(#${l.conflict ? "dep-arrow-conflict" : "dep-arrow"})`}
                      opacity={0.85}
                    />
                  </g>
                );
              })}
            </svg>
          )}
          </div>
        </div>
      </div>

      {undated.length > 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-4">
          <p className="text-sm font-medium text-slate-600">
            Without dates ({undated.length}) — open a todo to add dates
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {undated.map((t) => (
              <button key={t.id} onClick={() => onTodoClick(t)} className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-600 shadow-sm ring-1 ring-slate-200 hover:ring-indigo-300">
                {t.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
