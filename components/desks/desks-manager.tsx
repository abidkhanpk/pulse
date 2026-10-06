"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea, FieldError } from "@/components/ui/input";
import { Dialog, DialogTitle } from "@/components/ui/overlay";
import { Badge } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { createDesk, updateDesk, setDeskStatus, deleteDesk } from "@/app/(app)/desks/actions";

interface Desk {
  id: string;
  label: string;
  status: string;
  notes: string | null;
  lab: { id: string; name: string };
}

export function DesksManager({
  open,
  onClose,
  desks,
  labs,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  desks: Desk[];
  labs: { id: string; name: string }[];
  onChanged: () => void;
}) {
  const [editing, setEditing] = React.useState<Desk | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [labId, setLabId] = React.useState(labs[0]?.id ?? "");
  const [label, setLabel] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  function startCreate() {
    setEditing(null);
    setLabId(labs[0]?.id ?? "");
    setLabel("");
    setNotes("");
    setError(null);
    setFormOpen(true);
  }

  function startEdit(d: Desk) {
    setEditing(d);
    setLabId(d.lab.id);
    setLabel(d.label);
    setNotes(d.notes ?? "");
    setError(null);
    setFormOpen(true);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!label.trim()) return setError("Label is required.");
    setPending(true);
    try {
      const res = editing
        ? await updateDesk(editing.id, { labId, label: label.trim(), notes: notes.trim() || null })
        : await createDesk({ labId, label: label.trim(), notes: notes.trim() || null });
      if (!res.ok) setError(res.error);
      else {
        setFormOpen(false);
        onChanged();
      }
    } finally {
      setPending(false);
    }
  }

  async function toggleStatus(d: Desk) {
    const res = await setDeskStatus(d.id, d.status === "ACTIVE" ? "MAINTENANCE" : "ACTIVE");
    if (!res.ok) alert(res.error);
    else onChanged();
  }

  async function remove(d: Desk) {
    if (!confirm(`Delete desk ${d.label}? This cannot be undone.`)) return;
    const res = await deleteDesk(d.id);
    if (!res.ok) alert(res.error);
    else onChanged();
  }

  return (
    <Dialog open={open} onClose={onClose} className="max-w-2xl">
      <DialogTitle>Manage desks</DialogTitle>
      <div className="mt-4">
        <div className="mb-3 flex justify-end">
          <Button size="sm" onClick={startCreate}>
            Add desk
          </Button>
        </div>
        {formOpen ? (
          <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-slate-200 p-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Lab</Label>
                <Select value={labId} onChange={(e) => setLabId(e.target.value)}>
                  {labs.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Label</Label>
                <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="VIB-09" />
              </div>
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
            <FieldError message={error ?? undefined} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" type="button" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" type="submit" disabled={pending}>
                {pending ? "Saving…" : editing ? "Save" : "Add"}
              </Button>
            </div>
          </form>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Label</TH>
                <TH>Lab</TH>
                <TH>Status</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {desks.map((d) => (
                <TR key={d.id}>
                  <TD className="font-medium">{d.label}</TD>
                  <TD>{d.lab.name}</TD>
                  <TD>
                    <Badge color={d.status === "ACTIVE" ? "success" : "warning"}>{d.status}</Badge>
                  </TD>
                  <TD className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => startEdit(d)}>
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => toggleStatus(d)}>
                        {d.status === "ACTIVE" ? "→ Maint." : "→ Active"}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => remove(d)} className="text-red-600">
                        Delete
                      </Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>
    </Dialog>
  );
}
