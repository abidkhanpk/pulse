"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea, FieldError } from "@/components/ui/input";
import { Dialog, DialogTitle } from "@/components/ui/overlay";
import { Badge } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import {
  createDesk,
  updateDesk,
  setDeskStatus,
  deleteDesk,
  createAmenity,
  updateAmenity,
  deleteAmenity,
} from "@/app/(app)/desks/actions";
import { Pencil } from "lucide-react";

interface AmenityOption {
  id: string;
  label: string;
}

interface Desk {
  id: string;
  label: string;
  displayName: string | null;
  status: string;
  notes: string | null;
  amenities: string[];
  lab: { id: string; name: string };
}

export function DesksManager({
  open,
  onClose,
  desks,
  labs,
  onChanged,
  amenityOptions,
  canManageAmenities,
  onAmenitiesChanged,
}: {
  open: boolean;
  onClose: () => void;
  desks: Desk[];
  labs: { id: string; name: string }[];
  onChanged: () => void;
  amenityOptions: AmenityOption[];
  canManageAmenities: boolean;
  onAmenitiesChanged: (items: AmenityOption[]) => void;
}) {
  const [newAmenity, setNewAmenity] = React.useState("");
  const [editingAmenity, setEditingAmenity] = React.useState<AmenityOption | null>(null);
  const [amenityError, setAmenityError] = React.useState<string | null>(null);
  const [amenityPending, setAmenityPending] = React.useState(false);

  async function saveAmenityEdit() {
    if (!editingAmenity) return;
    setAmenityPending(true);
    setAmenityError(null);
    try {
      const res = await updateAmenity(editingAmenity.id, editingAmenity.label);
      if (!res.ok) setAmenityError(res.error);
      else if (res.data) {
        onAmenitiesChanged(res.data.items);
        setEditingAmenity(null);
        onChanged();
      }
    } finally {
      setAmenityPending(false);
    }
  }

  const labelOf = (id: string) => amenityOptions.find((a) => a.id === id)?.label ?? id;
  const summaryOf = (ids: string[]) => (ids.length ? ids.map(labelOf).join(" · ") : null);

  async function addAmenity() {
    const label = newAmenity.trim();
    if (!label) return;
    setAmenityPending(true);
    setAmenityError(null);
    try {
      const res = await createAmenity(label);
      if (!res.ok) setAmenityError(res.error);
      else if (res.data) {
        onAmenitiesChanged(res.data.items);
        setNewAmenity("");
      }
    } finally {
      setAmenityPending(false);
    }
  }

  async function removeAmenity(a: AmenityOption) {
    if (!confirm(`Delete amenity "${a.label}"? It will also be removed from every desk that lists it.`)) return;
    setAmenityPending(true);
    setAmenityError(null);
    try {
      const res = await deleteAmenity(a.id);
      if (!res.ok) setAmenityError(res.error);
      else if (res.data) {
        onAmenitiesChanged(res.data.items);
        onChanged();
      }
    } finally {
      setAmenityPending(false);
    }
  }
  const [editing, setEditing] = React.useState<Desk | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [labId, setLabId] = React.useState(labs[0]?.id ?? "");
  const [label, setLabel] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [amenities, setAmenities] = React.useState<string[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  function toggleAmenity(id: string) {
    setAmenities((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function startCreate() {
    setEditing(null);
    setLabId(labs[0]?.id ?? "");
    setLabel("");
    setDisplayName("");
    setNotes("");
    setAmenities([]);
    setError(null);
    setFormOpen(true);
  }

  function startEdit(d: Desk) {
    setEditing(d);
    setLabId(d.lab.id);
    setLabel(d.label);
    setDisplayName(d.displayName ?? "");
    setNotes(d.notes ?? "");
    setAmenities(d.amenities ?? []);
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
        ? await updateDesk(editing.id, { labId, label: label.trim(), displayName: displayName.trim() || null, notes: notes.trim() || null, amenities })
        : await createDesk({ labId, label: label.trim(), displayName: displayName.trim() || null, notes: notes.trim() || null, amenities });
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
          <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
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
              <Label>Display text (optional)</Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Window desk near the shaker table"
              />
              <p className="mt-1 text-xs text-slate-400">
                Shown in the booking views (week, month, day, layout) instead of the label. Leave empty to show the label.
              </p>
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
            <div>
              <Label>Amenities at this desk</Label>
              <div className="flex flex-wrap gap-1.5">
                {amenityOptions.map((a) => {
                  const on = amenities.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => toggleAmenity(a.id)}
                      className={`rounded-sm border px-2 py-1 text-xs font-medium transition-colors ${
                        on
                          ? "border-accent-600 bg-accent-600 text-white"
                          : "border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400"
                      }`}
                    >
                      {a.label}
                    </button>
                  );
                })}
              </div>
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
                  <TD className="font-medium">
                    {d.label}
                    {d.displayName && (
                      <span className="block text-[11px] font-normal text-slate-400">Display: {d.displayName}</span>
                    )}
                    {summaryOf(d.amenities) && (
                      <span className="block text-[11px] font-normal text-slate-400">{summaryOf(d.amenities)}</span>
                    )}
                  </TD>
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
        {!formOpen && canManageAmenities && (
          <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-700">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Amenities catalogue</p>
            <p className="mt-0.5 text-xs text-slate-400">
              The amenities desks can offer. Rename one with the pencil — desks keep it under the new name. Deleting one also removes it from every desk that lists it.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {amenityOptions.map((a) =>
                editingAmenity?.id === a.id ? (
                  <span
                    key={a.id}
                    className="inline-flex items-center gap-1 rounded-sm border border-accent-400 px-1.5 py-0.5 dark:border-accent-600"
                  >
                    <input
                      autoFocus
                      value={editingAmenity.label}
                      onChange={(e) => setEditingAmenity({ ...editingAmenity, label: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          saveAmenityEdit();
                        }
                        if (e.key === "Escape") setEditingAmenity(null);
                      }}
                      className="w-32 bg-transparent text-xs text-slate-700 outline-none dark:text-slate-200"
                    />
                    <button
                      type="button"
                      onClick={saveAmenityEdit}
                      disabled={amenityPending || !editingAmenity.label.trim()}
                      className="px-1 text-xs font-semibold text-accent-700 hover:text-accent-800 dark:text-accent-300"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingAmenity(null)}
                      disabled={amenityPending}
                      className="px-0.5 text-xs text-slate-400 hover:text-slate-600"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <span
                    key={a.id}
                    className="inline-flex items-center gap-1 rounded-sm border border-slate-200 px-2 py-1 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300"
                  >
                    {a.label}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAmenity(a);
                        setAmenityError(null);
                      }}
                      disabled={amenityPending}
                      className="px-0.5 text-slate-400 transition-colors hover:text-accent-600"
                      aria-label={`Rename ${a.label}`}
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeAmenity(a)}
                      disabled={amenityPending}
                      className="px-0.5 text-slate-400 transition-colors hover:text-red-600"
                      aria-label={`Delete ${a.label}`}
                    >
                      ×
                    </button>
                  </span>
                )
              )}
              {amenityOptions.length === 0 && <span className="text-xs text-slate-400">None defined yet.</span>}
            </div>
            <div className="mt-3 flex items-start gap-2">
              <Input
                value={newAmenity}
                onChange={(e) => setNewAmenity(e.target.value)}
                placeholder="New amenity, e.g. Whiteboard"
                className="max-w-xs"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addAmenity();
                  }
                }}
              />
              <Button size="sm" onClick={addAmenity} disabled={amenityPending || !newAmenity.trim()}>
                Add amenity
              </Button>
            </div>
            <FieldError message={amenityError ?? undefined} />
          </div>
        )}
      </div>
    </Dialog>
  );
}
