import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth-helpers";
import { getOrganization } from "../../labs/actions";
import { OrganizationClient } from "@/components/settings/organization-client";

export default async function OrganizationPage() {
  await requirePermission("org.manage");
  const org = await getOrganization();
  if (!org) redirect("/dashboard");
  return <OrganizationClient initialName={org.name} />;
}
