"use client";

import * as React from "react";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, Badge } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/misc";
import { listAuditLogs, type AuditRow, type AuditFilters } from "@/app/(app)/audit/actions";

const ACTION_COLORS: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  CREATE: "success",
  UPDATE: "info",
  DELETE: "danger",
  CHECK_IN: "success",
  CHECK_OUT: "info",
  APPROVE: "success",
  RETURN: "warning",
  CANCEL: "warning",
  ACTIVATE: "success",
  DEACTIVATE: "danger",
  PASSWORD_RESET: "warning",
  SUBMIT: "info",
  ASSIGN: "info",
  UNASSIGN: "default",
};

export function AuditClient({
  initial,
  actions,
  entityTypes,
}: {
  initial: AuditRow[];
  actions: string[];
  entityTypes: string[];
}) {
  const [rows, setRows] = React.useState(initial);
  const [filters, setFilters] = React.useState<AuditFilters>({ action: "", entityType: "", from: "", to: "" });
  const [pending, setPending] = React.useState(false);

  async function apply() {
    setPending(true);
    try {
      setRows(await listAuditLogs(filters));
    } finally {
      setPending(false);
    }
  }

  function reset() {
    const empty = { action: "", entityType: "", from: "", to: "" };
    setFilters(empty);
    setPending(true);
    listAuditLogs(empty).then((r) => {
      setRows(r);
      setPending(false);
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="!py-3">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="au-action">Action</Label>
              <Select id="au-action" value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value })}>
                <option value="">All actions</option>
                {actions.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="au-entity">Entity</Label>
              <Select id="au-entity" value={filters.entityType} onChange={(e) => setFilters({ ...filters, entityType: e.target.value })}>
                <option value="">All entities</option>
                {entityTypes.map((e) => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="au-from">From</Label>
              <Input id="au-from" type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="au-to">To</Label>
              <Input id="au-to" type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={apply} disabled={pending}>{pending ? "Loading…" : "Apply"}</Button>
              <Button size="sm" variant="outline" onClick={reset}>Reset</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <EmptyState title="No audit entries" description="Nothing matches these filters." />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Time (PKT)</TH>
              <TH>Actor</TH>
              <TH>Action</TH>
              <TH>Entity</TH>
              <TH>Details</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((r) => (
              <TR key={r.id}>
                <TD className="whitespace-nowrap text-xs text-slate-500">{r.createdAt}</TD>
                <TD>{r.actorName ?? <span className="text-slate-400">system</span>}</TD>
                <TD><Badge color={ACTION_COLORS[r.action] ?? "default"}>{r.action}</Badge></TD>
                <TD>{r.entityType ?? "—"}</TD>
                <TD>
                  {r.details ? (
                    <code className="block max-w-md truncate text-xs text-slate-500" title={r.details}>
                      {r.details}
                    </code>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
      <p className="text-xs text-slate-400">Showing latest {rows.length} entries (max 200).</p>
    </div>
  );
}
