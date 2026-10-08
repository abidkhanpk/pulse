import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth-helpers";
import { getOrganization } from "../../labs/actions";
import { getAppName, getDefaultAccentColor } from "@/lib/app-settings";
import { OrganizationClient } from "@/components/settings/organization-client";

export default async function OrganizationPage() {
  await requirePermission("org.manage");
  const org = await getOrganization();
  if (!org) redirect("/dashboard");
  const [appName, accent] = await Promise.all([getAppName(), getDefaultAccentColor()]);
  return <OrganizationClient initialName={org.name} initialAppName={appName} initialAccent={accent} />;
}
