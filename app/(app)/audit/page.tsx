import { requirePermission } from "@/lib/auth-helpers";
import { listAuditLogs, auditFilterOptions } from "./actions";
import { AuditClient } from "@/components/audit/audit-client";

export default async function AuditPage() {
  await requirePermission("audit.view");
  const [rows, opts] = await Promise.all([
    listAuditLogs({ action: "", entityType: "", from: "", to: "" }),
    auditFilterOptions(),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Audit log</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Who changed what, and when.</p>
      </div>
      <AuditClient initial={rows} actions={opts.ACTIONS} entityTypes={opts.ENTITY_TYPES} />
    </div>
  );
}
