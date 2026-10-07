import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";
import { hasPermission } from "@/lib/permissions";
import { listLabs, getOrganization } from "./actions";
import { LabsClient } from "@/components/labs/labs-client";

export default async function LabsPage() {
  const actor = await requireUser();
  const canManage = hasPermission(actor, "labs.manage");
  const inchargeLabIds = actor.inchargeOf.map((l) => l.labId);
  if (!canManage && inchargeLabIds.length === 0) redirect("/dashboard");
  const [labs, org] = await Promise.all([listLabs(), getOrganization()]);
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-slate-400">
          {org?.name ?? "Organization"} <span className="mx-1">›</span> Labs
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Labs</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {canManage
            ? "Create, rename and manage labs and their incharges."
            : "Rename the labs you are incharge of."}
        </p>
      </div>
      <LabsClient labs={labs} canManage={canManage} inchargeLabIds={inchargeLabIds} />
    </div>
  );
}
