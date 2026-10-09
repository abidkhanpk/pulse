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
  Tooltip,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent, Badge } from "@/components/ui/card";
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

function SparkTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { value: number; payload: { label: string; value: number } }[];
}) {
  if (!active || !payload?.length) return null;
  const { label, value } = payload[0].payload;
  const [mm, dd] = label.split("-").map(Number);
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const nice = mm && dd ? `${dd} ${MONTHS[mm - 1]}` : label;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-pop dark:border-slate-700 dark:bg-slate-800">
      <p className="font-bold text-slate-800 dark:text-slate-100">
        {value} <span className="font-medium text-slate-400">present</span>
      </p>
      <p className="text-slate-400">{nice}</p>
    </div>
  );
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
  const inner = (
    <Card hover={!!href} className="relative h-full overflow-hidden p-5">
      <div className={`pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br ${gradient} opacity-[0.14] blur-2xl`} />
      <div className="flex items-start justify-between">
        <span className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} text-white shadow-lg`}>
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
        <div className="mt-2 h-10">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={spark} margin={{ top: 4, bottom: 2, left: 0, right: 0 }}>
              <defs>
                <linearGradient id={`spark-${label}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={sparkColor} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={sparkColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" hide />
              <Tooltip
                content={<SparkTooltip />}
                cursor={{ stroke: sparkColor ?? "#6366f1", strokeOpacity: 0.35, strokeDasharray: "3 3" }}
                wrapperStyle={{ zIndex: 20 }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={sparkColor ?? "#6366f1"}
                strokeWidth={2}
                fill={sparkColor ? `url(#spark-${label})` : "none"}
                isAnimationActive={false}
                activeDot={{ r: 3.5, strokeWidth: 2, stroke: "#fff" }}
              />
            </AreaChart>
          </ResponsiveContainer>
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

function ChartCard({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

const tooltipStyle = (dark: boolean) => ({
  backgroundColor: dark ? "#1e293b" : "#ffffff",
  border: `1px solid ${dark ? "#334155" : "#e2e8f0"}`,
  borderRadius: 12,
  fontSize: 12,
  color: dark ? "#e2e8f0" : "#0f172a",
});

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
          className="flex items-center gap-2 rounded-xl border border-slate-100 px-3 py-2.5 text-sm transition-shadow hover:shadow-sm dark:border-slate-800"
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

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="bg-gradient-to-r from-accent-600 via-accent-700 to-accent-600 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent">
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
            <div className="flex items-center gap-2 rounded-2xl border border-accent-200 bg-accent-50 px-4 py-2 dark:border-accent-800 dark:bg-accent-950">
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
              <Stat icon={Armchair} label="Desks occupied now" value={d.desksOccupied} total={d.desksTotal} hint="Live bookings on active desks" href={d.canSeeBookings ? "/desks" : undefined} gradient="from-accent-600 to-accent-700" />
            </StaggerItem>
            <StaggerItem>
              <Stat icon={UserCheck} label="Checked in today" value={d.checkedInToday} total={d.peopleTotal} hint="Across your labs" href={d.canViewReports ? "/reports" : undefined} gradient="from-emerald-600 to-teal-600" spark={d.attendanceTrend.map((t) => ({ label: t.date, value: t.present }))} sparkColor={CHART_COLORS.emerald} />
            </StaggerItem>
            <StaggerItem>
              <Stat icon={AlertTriangle} label="Overdue todos" value={d.overdueTodos} hint="Past due date, not done" href="/projects" gradient="from-amber-500 to-orange-600" />
            </StaggerItem>
            <StaggerItem>
              <Stat icon={ClipboardCheck} label="Awaiting review" value={d.pendingReviews} hint="Logbook entries" href="/logbook" gradient="from-sky-600 to-blue-600" />
            </StaggerItem>
          </>
        )}
        {d.mode === "team" && (
          <>
            <StaggerItem>
              <Stat icon={ListTodo} label="My open todos" value={d.myTodos.length} hint="Assigned to me" href="/projects" gradient="from-accent-600 to-accent-700" />
            </StaggerItem>
            <StaggerItem>
              <Stat icon={AlertTriangle} label="Overdue in my projects" value={d.overdueTodos} hint="Past due date, not done" href="/projects" gradient="from-amber-500 to-orange-600" />
            </StaggerItem>
            <StaggerItem>
              <Stat icon={Users} label="Team checked in today" value={d.teamCheckedInToday} total={d.teamSize} hint="My project teams" href={d.canViewReports ? "/reports" : undefined} gradient="from-emerald-600 to-teal-600" spark={d.attendanceTrend.map((t) => ({ label: t.date, value: t.present }))} sparkColor={CHART_COLORS.emerald} />
            </StaggerItem>
            <StaggerItem>
              <Stat icon={ClipboardCheck} label="Awaiting review" value={d.pendingReviews} hint="My teams' logbooks" href="/logbook" gradient="from-sky-600 to-blue-600" />
            </StaggerItem>
          </>
        )}
        {d.mode === "personal" && (
          <>
            <StaggerItem>
              <Stat icon={ListTodo} label="My open todos" value={d.myTodos.length} hint="Assigned to me" href="/projects" gradient="from-accent-600 to-accent-700" />
            </StaggerItem>
            <StaggerItem>
              <Stat icon={AlertTriangle} label="Overdue" value={d.overdueTodos} hint="Past due date, not done" href="/projects" gradient="from-amber-500 to-orange-600" />
            </StaggerItem>
            <StaggerItem>
              <Stat icon={CalendarDays} label="My bookings today" value={d.myBookingsToday.length} hint="Desk & remote" gradient="from-emerald-600 to-teal-600" />
            </StaggerItem>
            <StaggerItem>
              <Stat icon={FolderKanban} label="My projects" value={d.myProjectsCount} hint="Where I'm lead or member" href="/projects" gradient="from-sky-600 to-blue-600" />
            </StaggerItem>
          </>
        )}
      </Stagger>

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
                    <Link href={`/projects/${t.projectId}`} className="flex items-center gap-2 rounded-xl border border-slate-100 px-3 py-2.5 transition-all hover:-translate-y-px hover:border-accent-200 hover:shadow-md dark:border-slate-800">
                      <ListTodo className="h-4 w-4 shrink-0 text-slate-400" />
                      <span className="flex-1 truncate text-sm font-medium text-slate-800 dark:text-slate-200">{t.title}</span>
                      <Badge color={t.status === "IN_PROGRESS" ? "info" : "default"}>{t.status.replace("_", "")}</Badge>
                    </Link>
                    <p className="mt-0.5 pl-6 text-xs text-slate-400">
                      {t.projectName}
                      {t.endDate ? ` · due ${t.endDate}` : ""}
                    </p>
                  </motion.div>
                ))}
              </div>
            </ChartCard>
          </FadeIn>
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <FadeIn delay={0.26}>
            <ChartCard title={d.mode === "full" ? "Recent activity" : d.mode === "team" ? "Team activity" : "My activity"}>
              <div className="max-h-72 space-y-1 overflow-y-auto">
                {d.recentActivity.length === 0 && <p className="text-sm text-slate-400">No activity yet.</p>}
                {d.recentActivity.map((a) => (
                  <div key={a.id} className="flex items-start gap-3 rounded-xl px-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent-100 text-accent-600 dark:bg-accent-950 dark:text-accent-300">
                      <Activity className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-300">
                        {a.userName} <span className="font-normal text-slate-400">· {a.action.replace(/\./g, " ")}</span>
                      </p>
                      <p className="text-xs text-slate-400">
                        {a.entity} · {new Date(a.at).toLocaleString("en-PK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Karachi" })}
                      </p>
                    </div>
                  </div>
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
                      className="flex items-center gap-2 rounded-xl border border-slate-100 px-3 py-2.5 text-sm transition-shadow hover:shadow-sm dark:border-slate-800"
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
            title={d.attendanceTrendTitle}
            action={
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="h-3.5 w-3.5" /> daily check-ins
              </span>
            }
          >
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={d.attendanceTrend} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="attTrend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.emerald} stopOpacity={0.45} />
                      <stop offset="100%" stopColor={CHART_COLORS.emerald} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={dark ? "#1e293b" : "#e2e8f0"} vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: dark ? "#94a3b8" : "#64748b" }} tickLine={false} axisLine={false} interval={2} />
                  <YAxis tick={{ fontSize: 11, fill: dark ? "#94a3b8" : "#64748b" }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle(dark)} />
                  <Area type="monotone" dataKey="present" name="Present" stroke={CHART_COLORS.emerald} strokeWidth={2.5} fill="url(#attTrend)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </FadeIn>
      )}
    </div>
  );
}
