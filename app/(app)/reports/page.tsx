import { requireUser, requirePermission } from "@/lib/auth-helpers";
import { myLabs } from "../labs/actions";
import { ReportsClient } from "@/components/reports/reports-client";

export default async function ReportsPage() {
  await requirePermission("attendance.view_reports");
  const actor = await requireUser();
  const labs = await myLabs();
  const now = new Date();
  return (
    <ReportsClient
      labs={labs}
      isGlobal={actor.role.scope === "GLOBAL"}
      initialYear={now.getUTCFullYear()}
      initialMonth={now.getUTCMonth() + 1}
    />
  );
}
