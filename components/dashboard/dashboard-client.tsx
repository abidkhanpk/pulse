"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import {
  Armchair,
  UserCheck,
  Users,
  AlertTriangle,
  ClipboardCheck,
  ArrowRight,
  TrendingUp,
  Activity,
  CalendarCheck,
  CalendarDays,
  ListTodo,
  FolderKanban,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent, Badge } from "@/components/ui/card";
import { ChartTipBubble, placeTip, type TipPos } from "@/components/ui/chart-tip";
import { fmtDayMonth, fmtDayMonthDay, fmtFullDate, fmtDateTime } from "@/lib/dates";
import { EmptyState } from "@/components/ui/misc";
import { FadeIn, Stagger, StaggerItem } from "@/components/ui/motion";
import type { DashboardData } from "@/app/(app)/dashboard/actions";

function useIsDark(): boolean {
  const [dark, setDark] = React.useState(false);
  React.useEffect(() => {
    const el = document.documentElement;
    const update = () => setDark(el.classList.contains("dark"));
    update();
    const obs = new MutationObserver(update);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

function AnimatedNumber({ value }: { value: number }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [n, setN] = React.useState(0);
  React.useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    const dur = 900;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value]);
  return <span ref={ref}>{n}</span>;
}

const CHART_COLORS = {
  indigo: "#6366f1",
  emerald: "#10b981",
  amber: "#f59e0b",
  sky: "#0ea5e9",
  rose: "#f43f5e",
  violet: "#8b5cf6",
};

/** Minimal shape of the state recharts v3 passes to chart mouse handlers. */
interface ChartHoverState {
  isTooltipActive?: boolean;
  activeCoordinate?: { x: number; y: number };
  activeTooltipIndex?: number | string | null;
}

interface TipState {
  x: number;
  y: number;
  idx: number;
  pos: TipPos;
}

/** Compute the adaptive tip position for a hover inside `el`, bounded by the nearest [data-tip-bound] ancestor (or the element itself). */
function computeTipPos(el: HTMLElement, x: number, y: number): TipPos {
  const sr = el.getBoundingClientRect();
  const boundEl = el.closest("[data-tip-bound]");
  const br = boundEl ? boundEl.getBoundingClientRect() : sr;
  return placeTip(x, y, {
    left: br.left - sr.left,
    top: br.top - sr.top,
    right: br.right - sr.left,
    bottom: br.bottom - sr.top,
  });
}

function Stat({
  icon: Icon,
  label,
  value,
  total,
  hint,
  href,
  gradient,
  spark,
  sparkColor,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  total?: number;
  hint?: string;
  href?: string;
  gradient: string;
  spark?: { label: string; value: number }[];
  sparkColor?: string;
}) {
  const stripRef = React.useRef<HTMLDivElement>(null);
  const [tip, setTip] = React.useState<TipState | null>(null);

  function handleSparkMove(s: ChartHoverState) {
    const el = stripRef.current;
    if (!el || !s?.isTooltipActive || !s.activeCoordinate || s.activeTooltipIndex == null) return;
    const idx = Number(s.activeTooltipIndex);
    const datum = spark?.[idx];
    if (!datum) return;
    // recharts' activeCoordinate.y is the MOUSE y, not the point's — compute
    // the true point y from the value (domain is pinned to [0, max] below).
    const maxV = Math.max(1, ...(spark ?? []).map((p) => p.value));
    const y = 4 + (1 - datum.value / maxV) * (el.clientHeight - 6);
    setTip({ x: s.activeCoordinate.x, y, idx, pos: computeTipPos(el, s.activeCoordinate.x, y) });
  }

  const inner = (
    <Card hover={!!href} data-tip-bound className="relative h-full overflow-hidden p-5">
      <div className="flex items-start justify-between">
        <span className={`flex h-12 w-12 items-center justify-center rounded-sm ${gradient} text-white`}>
          <Icon className="h-6 w-6" />
        </span>
        {href && <ArrowRight className="h-4 w-4 text-slate-300 transition-transform duration-200 group-hover:translate-x-0.5" />}
      </div>
      <p className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
        <AnimatedNumber value={value} />
        {total !== undefined && <span className="text-lg font-medium text-slate-400"> / {total}</span>}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-300">{label}</p>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
      {spark && spark.length > 1 && (
        <div ref={stripRef} className="relative mt-2 h-10">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={spark}
              margin={{ top: 4, bottom: 2, left: 0, right: 0 }}
              onMouseMove={handleSparkMove}
              onMouseLeave={() => setTip(null)}
            >
              <defs>
                <linearGradient id={`spark-${label}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={sparkColor} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={sparkColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis hide domain={[0, (dataMax: number) => Math.max(1, dataMax)]} />
              <Area
                type="monotone"
                dataKey="value"
                stroke={sparkColor ?? "#6366f1"}
                strokeWidth={2}
                fill={sparkColor ? `url(#spark-${label})` : "none"}
                isAnimationActive={false}
                activeDot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
          {tip && spark[tip.idx] && (
            <>
              <div
                aria-hidden
                className="pointer-events-none absolute bottom-0 top-0 z-10 border-l border-dashed opacity-40"
                style={{ left: tip.x, borderColor: sparkColor ?? "#6366f1" }}
              />
              <div
                aria-hidden
                className="pointer-events-none absolute z-20 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
                style={{ left: tip.x, top: tip.y, backgroundColor: sparkColor ?? "#6366f1" }}
              />
              <ChartTipBubble
                title={
                  <>
                    {spark[tip.idx].value} <span className="font-medium text-slate-400">present</span>
                  </>
                }
                sub={fmtDayMonthDay(spark[tip.idx].label)}
                pos={tip.pos}
              />
            </>
          )}
        </div>
      )}
    </Card>
  );
  return href ? (
    <Link href={href} className="group block h-full">
      {inner}
    </Link>
  ) : (
    inner
  );
}

function ChartCard({ title, action, children, tipBound }: { title: string; action?: React.ReactNode; children: React.ReactNode; tipBound?: boolean }) {
  return (
    <Card {...(tipBound ? { "data-tip-bound": true } : {})}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function BookingRows({
  bookings,
}: {
  bookings: { id: string; deskLabel: string | null; timeStart: string; timeEnd: string; title: string | null }[];
}) {
  if (bookings.length === 0) {
    return <EmptyState title="No bookings today" description="Nothing on your calendar." />;
  }
  return (
    <div className="space-y-2">
      {bookings.map((b, i) => (
        <motion.div
          key={b.id}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.38 + i * 0.04, duration: 0.3 }}
          className="flex items-center gap-2 rounded-sm border border-slate-100 px-3 py-2.5 text-sm transition-colors hover:border-slate-200 dark:border-slate-800"
        >
          <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" />
          <span className="text-slate-600 dark:text-slate-300">
            {b.deskLabel ?? "Remote"} · {b.timeStart}–{b.timeEnd}
          </span>
          {b.title && <span className="truncate text-xs text-slate-400">· {b.title}</span>}
        </motion.div>
      ))}
    </div>
  );
}

export function DashboardClient({ d }: { d: DashboardData }) {
  const dark = useIsDark();
  const attRef = React.useRef<HTMLDivElement>(null);
  const [attTip, setAttTip] = React.useState<TipState | null>(null);

  function handleAttMove(s: ChartHoverState) {
    const el = attRef.current;
    if (!el || !s?.isTooltipActive || !s.activeCoordinate || s.activeTooltipIndex == null) return;
    const idx = Number(s.activeTooltipIndex);
    const datum = d.attendanceTrend[idx];
    if (!datum) return;
    // True point y from the value (recharts reports the mouse y instead);
    // the Y domain is pinned below to the same formula used here.
    const maxPresent = Math.max(0, ...d.attendanceTrend.map((t) => t.present));
    const domainMax = Math.max(5, Math.ceil(maxPresent * 1.15));
    const y = 8 + (1 - datum.present / domainMax) * (el.clientHeight - 8 - 30);
    setAttTip({ x: s.activeCoordinate.x, y, idx, pos: computeTipPos(el, s.activeCoordinate.x, y) });
  }

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {d.mode === "full"
                ? "Live overview of desks, people, projects and activity."
                : d.mode === "team"
                  ? "You, your projects, and your project teams."
                  : "Your work, your projects, your day."}
            </p>
          </div>
          {d.myMonthPct !== null && (
            <div className="flex items-center gap-2 rounded-sm border border-accent-200 bg-accent-50 px-4 py-2 dark:border-accent-800 dark:bg-accent-950">
              <CalendarCheck className="h-5 w-5 text-accent-600 dark:text-accent-300" />
              <div>
                <p className="text-lg font-extrabold leading-none text-accent-700 dark:text-accent-300">{d.myMonthPct}%</p>
                <p className="text-[11px] text-accent-500 dark:text-accent-400">my attendance this month</p>
              </div>
            </div>
          )}
        </div>
      </FadeIn>

      {/* ── stat cards ── */}
      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" gap={0.08}>
        {d.mode === "full" && (
          <>
            <StaggerItem>
              <Stat icon={Armchair} label="Desks occupied now" value={d.desksOccupied} total={d.desksTotal} hint="Live bookings on active desks" href={d.canSeeBookings ? "/desks" : undefined} gradient="bg-accent-600" />
            </StaggerItem>
            <StaggerItem>
              <Stat icon={UserCheck} label="Checked in today" value={d.checkedInToday} total={d.peopleTotal} hint="Across your labs" href={d.canViewReports ? "/reports" : undefined} gradient="bg-emerald-600" spark={d.attendanceTrend.map((t) => ({ label: t.date, value: t.present }))} sparkColor={CHART_COLORS.emerald} />
            </StaggerItem>
            <StaggerItem>
              <Stat icon={AlertTriangle} label="Overdue todos" value={d.overdueTodos} hint="Past due date, not done" href="/projects" gradient="bg-amber-500" />
            </StaggerItem>
            <StaggerItem>
              <Stat icon={ClipboardCheck} label="Awaiting review" value={d.pendingReviews} hint="Logbook entries" href="/logbook" gradient="bg-sky-600" />
            </StaggerItem>
          </>
        )}
        {d.mode === "team" && (
          <>
            <StaggerItem>
              <Stat icon={ListTodo} label="My open todos" value={d.myTodos.length} hint="Assigned to me" href="/projects" gradient="bg-accent-600" />
            </StaggerItem>
            <StaggerItem>
              <Stat icon={AlertTriangle} label="Overdue in my projects" value={d.overdueTodos} hint="Past due date, not done" href="/projects" gradient="bg-amber-500" />
            </StaggerItem>
            <StaggerItem>
              <Stat icon={Users} label="Team checked in today" value={d.teamCheckedInToday} total={d.teamSize} hint="My project teams" href={d.canViewReports ? "/reports" : undefined} gradient="bg-emerald-600" spark={d.attendanceTrend.map((t) => ({ label: t.date, value: t.present }))} sparkColor={CHART_COLORS.emerald} />
            </StaggerItem>
            <StaggerItem>
              <Stat icon={ClipboardCheck} label="Awaiting review" value={d.pendingReviews} hint="My teams' logbooks" href="/logbook" gradient="bg-sky-600" />
            </StaggerItem>
          </>
        )}
        {d.mode === "personal" && (
          <>
            <StaggerItem>
              <Stat icon={ListTodo} label="My open todos" value={d.myTodos.length} hint="Assigned to me" href="/projects" gradient="bg-accent-600" />
            </StaggerItem>
            <StaggerItem>
              <Stat icon={AlertTriangle} label="Overdue" value={d.overdueTodos} hint="Past due date, not done" href="/projects" gradient="bg-amber-500" />
            </StaggerItem>
            <StaggerItem>
              <Stat icon={CalendarDays} label="My bookings today" value={d.myBookingsToday.length} hint="Desk & remote" gradient="bg-emerald-600" />
            </StaggerItem>
            <StaggerItem>
              <Stat icon={FolderKanban} label="My projects" value={d.myProjectsCount} hint="Where I'm lead or member" href="/projects" gradient="bg-sky-600" />
            </StaggerItem>
          </>
        )}
      </Stagger>

      {/* ── desks today: per-lab occupation states (admin / incharge) ── */}
      {d.mode === "full" && d.deskLabs.length > 0 && (
        <FadeIn delay={0.15}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Armchair className="h-4 w-4 text-accent-600" /> Desks today
                <span className="text-xs font-normal text-slate-400">free all day · partly booked · fully booked · maintenance</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {d.deskLabs.map((lab) => (
                <Link
                  key={lab.labId}
                  href={`/desks?lab=${lab.labId}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-sm border border-slate-200 px-3 py-2 transition-colors hover:border-accent-300 hover:bg-accent-50/50 dark:border-slate-800 dark:hover:bg-slate-800/50"
                >
                  <span className="min-w-32 text-sm font-medium text-slate-800 dark:text-slate-100">{lab.labName}</span>
                  <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{lab.freeAllDay} free all day</span>
                  <span className="text-xs text-slate-400">of {lab.total} desks</span>
                  <span className="ml-auto flex items-center gap-2 text-xs">
                    <span className="rounded-sm bg-amber-100 px-1.5 py-0.5 font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">{lab.partlyBooked} partly</span>
                    <span className="rounded-sm bg-red-100 px-1.5 py-0.5 font-medium text-red-700 dark:bg-red-950 dark:text-red-300">{lab.fullyBooked} full</span>
                    {lab.maintenance > 0 && (
                      <span className="rounded-sm bg-slate-200 px-1.5 py-0.5 font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">{lab.maintenance} maint.</span>
                    )}
                  </span>
                </Link>
              ))}
            </CardContent>
          </Card>
        </FadeIn>
      )}

      {/* ── two stacked columns: cards pack tightly, no cross-column gaps ── */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-4">
          <FadeIn delay={0.2}>
            <ChartCard
              title={d.mode === "full" ? "Project progress" : "My projects"}
              action={
                <Link href="/projects" className="group inline-flex items-center gap-1 text-sm font-medium text-accent-600 hover:text-accent-700 dark:text-accent-400">
                  All projects <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              }
            >
              <div className="space-y-3">
                {d.projectProgress.length === 0 && <p className="text-sm text-slate-400">No active projects.</p>}
                {d.projectProgress.map((p, i) => {
                  const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
                  const colors = [CHART_COLORS.indigo, CHART_COLORS.violet, CHART_COLORS.sky, CHART_COLORS.emerald, CHART_COLORS.amber, CHART_COLORS.rose];
                  const c = colors[i % colors.length];
                  return (
                    <div key={p.name}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="truncate font-medium text-slate-700 dark:text-slate-300">{p.name}</span>
                        <span className="ml-2 shrink-0 text-xs text-slate-400">
                          {p.done}/{p.total} · {pct}%
                        </span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.9, delay: 0.25 + i * 0.08, ease: "easeOut" }}
                          className="h-full rounded-full"
                          style={{ background: `linear-gradient(90deg, ${c}, ${c}cc)` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </ChartCard>
          </FadeIn>
          <FadeIn delay={0.3}>
            <ChartCard title={d.mode === "full" ? "Recent activity" : d.mode === "team" ? "Team activity" : "My activity"}>
              <div className="max-h-72 space-y-1 overflow-y-auto">
                {d.recentActivity.length === 0 && <p className="text-sm text-slate-400">No activity yet.</p>}
                {d.recentActivity.map((a) => (
                  <div key={a.id} className="flex items-start gap-3 rounded-sm px-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-accent-100 text-accent-600 dark:bg-accent-950 dark:text-accent-300">
                      <Activity className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-300">
                        {a.userName} <span className="font-normal text-slate-400">· {a.action.replace(/\./g, " ")}</span>
                      </p>
                      <p className="text-xs text-slate-400">
                        {a.entity} · {fmtDateTime(a.at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ChartCard>
          </FadeIn>
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <FadeIn delay={0.26}>
            <ChartCard
              title="My open todos"
              action={
                <Link href="/projects" className="group inline-flex items-center gap-1 text-sm font-medium text-accent-600 hover:text-accent-700 dark:text-accent-400">
                  All projects <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              }
            >
              <div className="space-y-2">
                {d.myTodos.length === 0 && <p className="text-sm text-slate-400">Nothing assigned — enjoy the quiet.</p>}
                {d.myTodos.map((t, i) => (
                  <motion.div key={t.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.32 + i * 0.05, duration: 0.3 }}>
                    <Link href={`/projects/${t.projectId}`} className="flex items-center gap-2 rounded-sm border border-slate-100 px-3 py-2.5 transition-colors hover:border-accent-300 dark:border-slate-800">
                      <ListTodo className="h-4 w-4 shrink-0 text-slate-400" />
                      <span className="flex-1 truncate text-sm font-medium text-slate-800 dark:text-slate-200">{t.title}</span>
                      <Badge color={t.status === "IN_PROGRESS" ? "info" : t.status === "IN_REVIEW" ? "warning" : "default"}>{t.status.replace(/_/g, " ")}</Badge>
                    </Link>
                    <p className="mt-0.5 pl-6 text-xs text-slate-400">
                      {t.projectName}
                      {t.endDate ? ` · due ${fmtFullDate(t.endDate)}` : ""}
                    </p>
                  </motion.div>
                ))}
              </div>
            </ChartCard>
          </FadeIn>
          {d.mode === "full" && d.canSeeBookings ? (
            <FadeIn delay={0.36}>
              <ChartCard
                title="Today's bookings"
                action={
                  <Link href="/desks" className="group inline-flex items-center gap-1 text-sm font-medium text-accent-600 hover:text-accent-700 dark:text-accent-400">
                    Desk booking <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                }
              >
                <div className="space-y-2">
                  {d.todayBookings.length === 0 && <EmptyState title="No bookings today" description="The labs are free — or nobody booked." />}
                  {d.todayBookings.map((b, i) => (
                    <motion.div
                      key={b.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.38 + i * 0.04, duration: 0.3 }}
                      className="flex items-center gap-2 rounded-sm border border-slate-100 px-3 py-2.5 text-sm transition-colors hover:border-slate-200 dark:border-slate-800"
                    >
                      <span className="font-medium text-slate-800 dark:text-slate-200">{b.personName}</span>
                      <span className="text-slate-400">
                        {b.deskLabel ?? "Remote"} · {b.timeStart}–{b.timeEnd}
                      </span>
                      {b.title && <span className="truncate text-xs text-slate-400">· {b.title}</span>}
                    </motion.div>
                  ))}
                </div>
              </ChartCard>
            </FadeIn>
          ) : (
            <FadeIn delay={0.36}>
              <ChartCard title="My bookings today">
                <BookingRows bookings={d.myBookingsToday} />
              </ChartCard>
            </FadeIn>
          )}
        </div>
      </div>

      {/* ── attendance chart, last ── */}
      {d.attendanceEnabled && (
        <FadeIn delay={0.4}>
          <ChartCard
            tipBound
            title={d.attendanceTrendTitle}
            action={
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="h-3.5 w-3.5" /> daily check-ins
              </span>
            }
          >
            <div ref={attRef} className="relative h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={d.attendanceTrend}
                  margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
                  onMouseMove={handleAttMove}
                  onMouseLeave={() => setAttTip(null)}
                >
                  <defs>
                    <linearGradient id="attTrend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.emerald} stopOpacity={0.45} />
                      <stop offset="100%" stopColor={CHART_COLORS.emerald} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={dark ? "#1e293b" : "#e2e8f0"} vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(v: string) => fmtDayMonth(v)} tick={{ fontSize: 11, fill: dark ? "#94a3b8" : "#64748b" }} tickLine={false} axisLine={false} interval={2} />
                  <YAxis domain={[0, (dataMax: number) => Math.max(5, Math.ceil(dataMax * 1.15))]} tick={{ fontSize: 11, fill: dark ? "#94a3b8" : "#64748b" }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Area type="monotone" dataKey="present" name="Present" stroke={CHART_COLORS.emerald} strokeWidth={2.5} fill="url(#attTrend)" activeDot={false} />
                </AreaChart>
              </ResponsiveContainer>
              {attTip && d.attendanceTrend[attTip.idx] && (
                <>
                  <div
                    aria-hidden
                    className="pointer-events-none absolute bottom-0 top-0 z-10 border-l border-dashed opacity-40"
                    style={{ left: attTip.x, borderColor: CHART_COLORS.emerald }}
                  />
                  <div
                    aria-hidden
                    className="pointer-events-none absolute z-20 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
                    style={{ left: attTip.x, top: attTip.y, backgroundColor: CHART_COLORS.emerald }}
                  />
                  <ChartTipBubble
                    title={
                      <>
                        {d.attendanceTrend[attTip.idx].present} <span className="font-medium text-slate-400">present</span>
                      </>
                    }
                    sub={fmtDayMonthDay(d.attendanceTrend[attTip.idx].date)}
                    pos={attTip.pos}
                  />
                </>
              )}
            </div>
          </ChartCard>
        </FadeIn>
      )}
    </div>
  );
}
