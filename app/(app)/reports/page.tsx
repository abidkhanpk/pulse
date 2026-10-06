import { requirePermission } from "@/lib/auth-helpers";
import { myLabs } from "../labs/actions";
import { ReportsClient } from "@/components/reports/reports-client";

export default async function ReportsPage() {
  await requirePermission("attendance.view_reports");
  const labs = await myLabs();
  const now = new Date();
  return (
    <ReportsClient
      labs={labs}
      initialYear={now.getUTCFullYear()}
      initialMonth={now.getUTCMonth() + 1}
    />
  );
}
