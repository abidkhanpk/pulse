import { requirePermission } from "@/lib/auth-helpers";
import { listRoles } from "../actions";
import { RolesClient } from "@/components/settings/roles-client";

export default async function RolesPage() {
  await requirePermission("roles.manage");
  const roles = await listRoles();
  return <RolesClient roles={roles} />;
}
