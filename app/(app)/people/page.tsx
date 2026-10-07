import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/auth-helpers";
import { listPeople, assignableRoles, peopleLabOverview } from "./actions";
import { myLabs } from "../labs/actions";
import { PeopleClient } from "@/components/people/people-client";
import { PeopleOverview } from "@/components/overview/people-overview";

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ lab?: string; q?: string; status?: string }>;
}) {
  const actor = await requirePermission("users.manage");
  const params = await searchParams;
  const isAdmin = actor.role.scope === "GLOBAL";

  // Admins start at the lab overview; drill into ?lab=<id> for detail.
  if (isAdmin && !params.lab) {
    const overview = await peopleLabOverview();
    return <PeopleOverview overview={overview} />;
  }

  const [people, labs, roles] = await Promise.all([
    listPeople({
      labId: params.lab || undefined,
      search: params.q || undefined,
      status: (params.status as "ACTIVE" | "INACTIVE") || undefined,
    }),
    myLabs(),
    assignableRoles(),
  ]);
  const labName = params.lab ? labs.find((l) => l.id === params.lab)?.name : null;
  return (
    <div className="space-y-4">
      {isAdmin && params.lab && (
        <Link
          href="/people"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-indigo-600"
        >
          <ArrowLeft className="h-4 w-4" /> All labs
        </Link>
      )}
      {labName && (
        <p className="text-sm text-slate-400">
          <Link href="/people" className="hover:text-indigo-600">People</Link>
          <span className="mx-1">›</span> {labName}
        </p>
      )}
      <PeopleClient
        people={people.map((p) => ({
          ...p,
          joinDate: p.joinDate ? p.joinDate.toISOString() : null,
        }))}
        labs={labs}
        roles={roles}
      />
    </div>
  );
}
