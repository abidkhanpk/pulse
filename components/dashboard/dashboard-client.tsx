"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { Armchair, UserCheck, AlertTriangle, ClipboardCheck, ArrowRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, Badge } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { FadeIn, Stagger, StaggerItem } from "@/components/ui/motion";
import type { DashboardData } from "@/app/(app)/dashboard/actions";

function AnimatedNumber({ value }: { value: number }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [n, setN] = React.useState(0);
  React.useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    const dur = 800;
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

function Stat({
  icon: Icon,
  label,
  value,
  total,
  hint,
  href,
  gradient,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  total?: number;
  hint?: string;
  href?: string;
  gradient: string;
}) {
  const inner = (
    <Card hover={!!href} className="relative overflow-hidden p-5">
      <div className={`pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${gradient} opacity-10 blur-2xl`} />
      <div className="flex items-start justify-between">
        <span className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} text-white shadow-lg`}>
          <Icon className="h-5 w-5" />
        </span>
        {href && <ArrowRight className="h-4 w-4 text-slate-300 transition-transform duration-200 group-hover:translate-x-0.5" />}
      </div>
      <p className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
        <AnimatedNumber value={value} />
        {total !== undefined && <span className="text-lg font-medium text-slate-400"> / {total}</span>}
      </p>
      <p className="mt-1 text-sm font-medium text-slate-600">{label}</p>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </Card>
  );
  return href ? (
    <Link href={href} className="group block">
      {inner}
    </Link>
  ) : (
    inner
  );
}

export function DashboardClient({ d }: { d: DashboardData }) {
  return (
    <div className="space-y-6">
      <FadeIn>
        <div>
          <h1 className="bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500">Today&apos;s overview of the lab.</p>
        </div>
      </FadeIn>

      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" gap={0.08}>
        <StaggerItem>
          <Stat icon={Armchair} label="Desks occupied now" value={d.desksOccupied} total={d.desksTotal} hint="Active desks with a live booking" href={d.canSeeBookings ? "/desks" : undefined} gradient="from-indigo-600 to-violet-600" />
        </StaggerItem>
        <StaggerItem>
          <Stat icon={UserCheck} label="Checked in today" value={d.checkedInToday} total={d.peopleTotal} hint="Active people" href="/reports" gradient="from-emerald-600 to-teal-600" />
        </StaggerItem>
        <StaggerItem>
          <Stat icon={AlertTriangle} label="Overdue todos" value={d.overdueTodos} href="/projects" gradient="from-amber-500 to-orange-600" />
        </StaggerItem>
        <StaggerItem>
          <Stat icon={ClipboardCheck} label="Awaiting review" value={d.pendingReviews} hint="Logbook entries" href="/logbook" gradient="from-sky-600 to-blue-600" />
        </StaggerItem>
      </Stagger>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FadeIn delay={0.15}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>My open todos</CardTitle>
              <Link href="/projects" className="group inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700">
                All projects <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </CardHeader>
            <CardContent className="space-y-2">
              {d.myTodos.length === 0 && <p className="text-sm text-slate-400">Nothing assigned — enjoy the quiet.</p>}
              {d.myTodos.map((t, i) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.05, duration: 0.3 }}
                >
                  <Link href={`/projects/${t.projectId}`} className="block rounded-xl border border-slate-100 px-3 py-2.5 transition-all hover:-translate-y-px hover:border-indigo-200 hover:shadow-md">
                    <div className="flex items-center gap-2">
                      <span className="flex-1 truncate text-sm font-medium text-slate-800">{t.title}</span>
                      <Badge color={t.status === "IN_PROGRESS" ? "info" : "default"}>{t.status.replace("_", " ")}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {t.projectName}
                      {t.endDate ? ` · due ${t.endDate}` : ""}
                    </p>
                  </Link>
                </motion.div>
              ))}
            </CardContent>
          </Card>
        </FadeIn>

        {d.canSeeBookings && (
          <FadeIn delay={0.22}>
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Today&apos;s bookings</CardTitle>
                <Link href="/desks" className="group inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700">
                  Desk booking <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </CardHeader>
              <CardContent className="space-y-2">
                {d.todayBookings.length === 0 && (
                  <EmptyState title="No bookings today" description="The labs are free — or nobody booked." />
                )}
                {d.todayBookings.map((b, i) => (
                  <motion.div
                    key={b.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 + i * 0.04, duration: 0.3 }}
                    className="flex items-center gap-2 rounded-xl border border-slate-100 px-3 py-2.5 text-sm transition-shadow hover:shadow-sm"
                  >
                    <span className="font-medium text-slate-800">{b.personName}</span>
                    <span className="text-slate-400">
                      {b.deskLabel ?? "Remote"} · {b.timeStart}–{b.timeEnd}
                    </span>
                    {b.title && <span className="truncate text-xs text-slate-400">· {b.title}</span>}
                  </motion.div>
                ))}
              </CardContent>
            </Card>
          </FadeIn>
        )}
      </div>
    </div>
  );
}
