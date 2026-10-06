import { requireUser } from "@/lib/auth-helpers";
import { StatCard } from "@/components/ui/misc";

export default async function DashboardPage() {
  await requireUser();
  // Full dashboard ships in Phase 5 — shell verifies auth + layout first.
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Today&apos;s overview of the lab. Full widgets arrive in Phase 5.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Desks occupied now" value="—" />
        <StatCard label="Checked in today" value="—" />
        <StatCard label="Overdue todos" value="—" />
        <StatCard label="Log entries awaiting review" value="—" />
      </div>
    </div>
  );
}
