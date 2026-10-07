import { requireUser } from "@/lib/auth-helpers";
import { dashboardData } from "./actions";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

export default async function DashboardPage() {
  await requireUser();
  const d = await dashboardData();
  return <DashboardClient d={d} />;
}
