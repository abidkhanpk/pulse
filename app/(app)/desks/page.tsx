import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/auth-helpers";
import { hasPermission } from "@/lib/permissions";
import { listDesks, listOccurrences, bookablePeopleAll, bookableProjects, deskLabOverview } from "./actions";
import { myLabs } from "../labs/actions";
import { DesksClient } from "@/components/desks/desks-client";
import { DesksOverview } from "@/components/overview/desks-overview";
import { todayPKT, toISODate } from "@/lib/bookings";

function mondayOf(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  const dow = d.getUTCDay();
  const delta = (dow + 6) % 7; // days since Monday
  d.setUTCDate(d.getUTCDate() - delta);
  return d.toISOString().slice(0, 10);
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export default async function DesksPage({
  searchParams,
}: {
  searchParams: Promise<{ lab?: string }>;
}) {
  const actor = await requirePermission("bookings.view_all");
  const params = await searchParams;
  const labId = params.lab || undefined;
  const isAdmin = actor.role.scope === "GLOBAL";

  // Admins start at the lab overview; drill into ?lab=<id> for detail.
  if (isAdmin && !labId) {
    const overview = await deskLabOverview();
    return <DesksOverview overview={overview} />;
  }

  const today = toISODate(todayPKT());
  const weekStart = mondayOf(today);

  const [labs, desks, people, projects, occurrences] = await Promise.all([
    myLabs(),
    listDesks(labId),
    bookablePeopleAll(labId),
    bookableProjects(labId),
    listOccurrences({ from: weekStart, to: addDays(weekStart, 6), labId }),
  ]);

  return (
    <div className="space-y-4">
      {isAdmin && labId && (
        <Link
          href="/desks"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-indigo-600"
        >
          <ArrowLeft className="h-4 w-4" /> All labs
        </Link>
      )}
      <DesksClient
      labs={labs}
      desks={desks.map((d) => ({ ...d, notes: d.notes ?? null }))}
      people={people}
      projects={projects}
      initialOccurrences={occurrences.map((o) => ({
        id: o.id,
        date: o.date instanceof Date ? o.date.toISOString().slice(0, 10) : String(o.date).slice(0, 10),
        startsAt: o.startsAt instanceof Date ? o.startsAt.toISOString() : String(o.startsAt),
        endsAt: o.endsAt instanceof Date ? o.endsAt.toISOString() : String(o.endsAt),
        deskId: o.deskId,
        desk: o.desk,
        booking: o.booking,
      }))}
      weekStart={weekStart}
      today={today}
      canManage={hasPermission(actor, "bookings.manage")}
      canManageDesks={hasPermission(actor, "desks.manage")}
    />
    </div>
  );
}
