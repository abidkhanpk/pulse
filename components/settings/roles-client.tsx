"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label, Select, Checkbox, FieldError } from "@/components/ui/input";
import { Dialog, DialogTitle } from "@/components/ui/overlay";
import { Card, CardHeader, CardTitle, CardContent, Badge } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/misc";
import { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } from "@/lib/permissions";
import {
  createRole,
  updateRole,
  deleteRole,
  resetRolePermissions,
} from "@/app/(app)/settings/actions";

interface Role {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  scope: "GLOBAL" | "LAB";
  permissions: string[];
  _count: { users: number };
}

export function RolesClient({ roles }: { roles: Role[] }) {
  const router = useRouter();
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Role | null>(null);
  const [key, setKey] = React.useState("");
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [scope, setScope] = React.useState<"GLOBAL" | "LAB">("LAB");
  const [permissions, setPermissions] = React.useState<string[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  function startCreate() {
    setEditing(null);
    setKey("");
    setName("");
    setDescription("");
    setScope("LAB");
    setPermissions([]);
    setError(null);
    setFormOpen(true);
  }

  function startEdit(r: Role) {
    setEditing(r);
    setKey(r.key);
    setName(r.name);
    setDescription(r.description ?? "");
    setScope(r.scope);
    setPermissions([...r.permissions]);
    setError(null);
    setFormOpen(true);
  }

  function togglePerm(p: string) {
    setPermissions((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Name is required.");
    setPending(true);
    try {
      const res = editing
        ? await updateRole({
            id: editing.id,
            name: name.trim(),
            description: description.trim() || null,
            scope,
            permissions,
          })
        : await createRole({
            key: key.trim().toUpperCase(),
            name: name.trim(),
            description: description.trim() || null,
            scope,
            permissions,
          });
      if (!res.ok) setError(res.error);
      else {
        setFormOpen(false);
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  async function onReset(r: Role) {
    if (!confirm(`Reset ${r.name} to its default permissions?`)) return;
    const res = await resetRolePermissions(r.id);
    if (!res.ok) alert(res.error);
    else router.refresh();
  }

  async function onDelete(r: Role) {
    if (!confirm(`Delete role "${r.name}"?`)) return;
    const res = await deleteRole(r.id);
    if (!res.ok) alert(res.error);
    else router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Roles</h1>
          <p className="text-sm text-slate-500">
            Granular permissions per role. System roles can be reset to defaults but not deleted.
          </p>
        </div>
        <div className="ml-auto">
          <Button onClick={startCreate}>Add role</Button>
        </div>
      </div>

      <Table>
        <THead>
          <TR>
            <TH>Role</TH>
            <TH>Scope</TH>
            <TH>Permissions</TH>
            <TH>Users</TH>
            <TH className="text-right">Actions</TH>
          </TR>
        </THead>
        <TBody>
          {roles.map((r) => (
            <TR key={r.id}>
              <TD>
                <div className="font-medium text-slate-900">
                  {r.name}
                  {r.isSystem && (
                    <Badge color="default" className="ml-2">
                      system
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-slate-400">{r.key}</div>
                {r.description && <div className="text-xs text-slate-500">{r.description}</div>}
              </TD>
              <TD>
                <Badge color={r.scope === "GLOBAL" ? "primary" : "info"}>{r.scope}</Badge>
              </TD>
              <TD>
                <div className="flex max-w-md flex-wrap gap-1">
                  {r.permissions.length === 0 && <span className="text-xs text-slate-400">none</span>}
                  {r.permissions.map((p) => (
                    <Badge key={p} color="default">
                      {p}
                    </Badge>
                  ))}
                </div>
                {r.isSystem && DEFAULT_ROLE_PERMISSIONS[r.key] && (
                  <div className="mt-1 text-xs text-slate-400">
                    default: {DEFAULT_ROLE_PERMISSIONS[r.key].length} permissions
                  </div>
                )}
              </TD>
              <TD>{r._count.users}</TD>
              <TD className="text-right">
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="sm" onClick={() => startEdit(r)}>
                    Edit
                  </Button>
                  {r.isSystem && (
                    <Button variant="ghost" size="sm" onClick={() => onReset(r)}>
                      Reset
                    </Button>
                  )}
                  {!r.isSystem && (
                    <Button variant="ghost" size="sm" className="text-red-600" onClick={() => onDelete(r)}>
                      Delete
                    </Button>
                  )}
                </div>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>

      <Dialog open={formOpen} onClose={() => setFormOpen(false)} className="max-w-xl">
        <DialogTitle>{editing ? `Edit role — ${editing.name}` : "Add role"}</DialogTitle>
        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {!editing && (
              <div>
                <Label htmlFor="role-key">Key (UPPER_SNAKE)</Label>
                <Input id="role-key" value={key} onChange={(e) => setKey(e.target.value.toUpperCase())} placeholder="TECHNICIAN" />
              </div>
            )}
            <div>
              <Label htmlFor="role-name">Name</Label>
              <Input id="role-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Technician" />
            </div>
          </div>
          <div>
            <Label htmlFor="role-desc">Description (optional)</Label>
            <Textarea id="role-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div>
            <Label htmlFor="role-scope">Scope</Label>
            <Select
              id="role-scope"
              value={scope}
              onChange={(e) => setScope(e.target.value as "GLOBAL" | "LAB")}
              disabled={!!editing?.isSystem}
            >
              <option value="LAB">LAB — limited to assigned labs</option>
              <option value="GLOBAL">GLOBAL — all labs</option>
            </Select>
            {editing?.isSystem && <p className="mt-1 text-xs text-slate-400">System role scope is fixed.</p>}
          </div>
          <div>
            <Label>Permissions</Label>
            <div className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-2">
              {PERMISSIONS.map((p) => (
                <label key={p.key} className="flex cursor-pointer items-start gap-2 text-sm">
                  <Checkbox checked={permissions.includes(p.key)} onChange={() => togglePerm(p.key)} className="mt-0.5" />
                  <span>
                    <span className="font-medium text-slate-700">{p.label}</span>
                    <span className="block text-xs text-slate-400">{p.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <FieldError message={error ?? undefined} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : editing ? "Save" : "Add role"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
