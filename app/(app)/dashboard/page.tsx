import Link from "next/link";
import { requireUser } from "@/lib/auth-helpers";
import { dashboardData } from "./actions";
import { StatCard } from "@/components/ui/misc";
import { Card, CardHeader, CardTitle, CardContent, Badge } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";

export default async function DashboardPage() {
  await requireUser();
  const d = await dashboardData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Today&apos;s overview of the lab.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Desks occupied now"
          value={`${d.desksOccupied} / ${d.desksTotal}`}
          hint="Active desks with a live booking"
          href={d.canSeeBookings ? "/desks" : undefined}
        />
        <StatCard
          label="Checked in today"
          value={`${d.checkedInToday} / ${d.peopleTotal}`}
          hint="Active people"
          href="/reports"
        />
        <StatCard label="Overdue todos" value={d.overdueTodos} href="/projects" />
        <StatCard label="Awaiting review" value={d.pendingReviews} hint="Logbook entries" href="/logbook" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>My open todos</CardTitle>
            <Link href="/projects" className="text-sm text-indigo-600 hover:underline">
              All projects →
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {d.myTodos.length === 0 && <p className="text-sm text-slate-400">Nothing assigned — enjoy the quiet.</p>}
            {d.myTodos.map((t) => (
              <Link key={t.id} href={`/projects/${t.projectId}`} className="block rounded-lg border border-slate-100 px-3 py-2 hover:border-indigo-200">
                <div className="flex items-center gap-2">
                  <span className="flex-1 truncate text-sm font-medium text-slate-800">{t.title}</span>
                  <Badge color={t.status === "IN_PROGRESS" ? "info" : "default"}>{t.status.replace("_", " ")}</Badge>
                </div>
                <p className="mt-0.5 text-xs text-slate-400">
                  {t.projectName}
                  {t.endDate ? ` · due ${t.endDate}` : ""}
                </p>
              </Link>
            ))}
          </CardContent>
        </Card>

        {d.canSeeBookings && (
          <Card>
            <CardHeader>
              <CardTitle>Today&apos;s bookings</CardTitle>
              <Link href="/desks" className="text-sm text-indigo-600 hover:underline">
                Desk booking →
              </Link>
            </CardHeader>
            <CardContent className="space-y-2">
              {d.todayBookings.length === 0 && (
                <EmptyState title="No bookings today" description="The labs are free — or nobody booked." />
              )}
              {d.todayBookings.map((b) => (
                <div key={b.id} className="flex items-center gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm">
                  <span className="font-medium text-slate-800">{b.personName}</span>
                  <span className="text-slate-400">
                    {b.deskLabel ?? "Remote"} · {b.timeStart}–{b.timeEnd}
                  </span>
                  {b.title && <span className="truncate text-xs text-slate-400">· {b.title}</span>}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
