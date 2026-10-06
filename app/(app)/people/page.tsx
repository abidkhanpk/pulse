import { requirePermission } from "@/lib/auth-helpers";
import { listPeople, assignableRoles } from "./actions";
import { myLabs } from "../labs/actions";
import { PeopleClient } from "@/components/people/people-client";

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ lab?: string; q?: string; status?: string }>;
}) {
  await requirePermission("users.manage");
  const params = await searchParams;
  const [people, labs, roles] = await Promise.all([
    listPeople({
      labId: params.lab || undefined,
      search: params.q || undefined,
      status: (params.status as "ACTIVE" | "INACTIVE") || undefined,
    }),
    myLabs(),
    assignableRoles(),
  ]);
  return (
    <PeopleClient
      people={people.map((p) => ({
        ...p,
        joinDate: p.joinDate ? p.joinDate.toISOString() : null,
      }))}
      labs={labs}
      roles={roles}
    />
  );
}
