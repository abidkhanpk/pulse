"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label, Select, FieldError } from "@/components/ui/input";
import { Dialog, DialogTitle } from "@/components/ui/overlay";
import { Card, CardHeader, CardTitle, CardContent, Badge } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import {
  createLab,
  updateLab,
  deleteLab,
  renameLab,
  labDeletePreview,
  type LabDeletePreview,
  assignLabIncharge,
  removeLabIncharge,
  inchargeCandidates,
} from "@/app/(app)/labs/actions";
import { LabAttendanceSettings } from "./lab-attendance-settings";
import type { AttendanceMode } from "@prisma/client";

interface Lab {
  id: string;
  name: string;
  description: string | null;
  attendanceMode: AttendanceMode;
  attendanceMarker: { id: string; name: string } | null;
  _count: { desks: number; projects: number };
  incharges: { user: { id: string; name: string; email: string } }[];
}

export function LabsClient({
  labs,
  canManage,
  inchargeLabIds,
}: {
  labs: Lab[];
  canManage: boolean;
  inchargeLabIds: string[];
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Lab | null>(null);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  // Rename-only dialog (for lab incharges without full manage rights)
  const [renameLabTarget, setRenameLabTarget] = React.useState<Lab | null>(null);
  const [renameName, setRenameName] = React.useState("");
  const [renameError, setRenameError] = React.useState<string | null>(null);
  const [renamePending, setRenamePending] = React.useState(false);

  const [inchargeLab, setInchargeLab] = React.useState<Lab | null>(null);
  const [candidates, setCandidates] = React.useState<{ id: string; name: string; email: string }[]>([]);
  const [candidateId, setCandidateId] = React.useState("");

  // Cascade-delete confirmation
  const [deleteTarget, setDeleteTarget] = React.useState<Lab | null>(null);
  const [deletePreview, setDeletePreview] = React.useState<LabDeletePreview | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const canRename = (lab: Lab) => canManage || inchargeLabIds.includes(lab.id);

  function startCreate() {
    setEditing(null);
    setName("");
    setDescription("");
    setError(null);
    setFormOpen(true);
  }

  function startEdit(lab: Lab) {
    setEditing(lab);
    setName(lab.name);
    setDescription(lab.description ?? "");
    setError(null);
    setFormOpen(true);
  }

  function startRename(lab: Lab) {
    setRenameLabTarget(lab);
    setRenameName(lab.name);
    setRenameError(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Name is required.");
    setPending(true);
    try {
      const res = editing
        ? await updateLab(editing.id, { name: name.trim(), description: description.trim() || null })
        : await createLab({ name: name.trim(), description: description.trim() || null });
      if (!res.ok) setError(res.error);
      else {
        setFormOpen(false);
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  async function onRename(e: React.FormEvent) {
    e.preventDefault();
    if (!renameLabTarget) return;
    setRenameError(null);
    if (!renameName.trim()) return setRenameError("Name is required.");
    setRenamePending(true);
    try {
      const res = await renameLab(renameLabTarget.id, renameName.trim());
      if (!res.ok) setRenameError(res.error);
      else {
        setRenameLabTarget(null);
        router.refresh();
      }
    } finally {
      setRenamePending(false);
    }
  }

  async function askDelete(lab: Lab) {
    setDeleteTarget(lab);
    setDeletePreview(null);
    setDeletePreview(await labDeletePreview(lab.id));
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await deleteLab(deleteTarget.id);
      if (!res.ok) alert(res.error);
      else {
        setDeleteTarget(null);
        router.refresh();
      }
    } finally {
      setDeleting(false);
    }
  }

  async function openIncharges(lab: Lab) {
    setInchargeLab(lab);
    setCandidates(await inchargeCandidates(lab.id));
    setCandidateId("");
  }

  async function addIncharge() {
    if (!inchargeLab || !candidateId) return;
    const res = await assignLabIncharge({ labId: inchargeLab.id, userId: candidateId });
    if (!res.ok) alert(res.error);
    else {
      setCandidates(await inchargeCandidates(inchargeLab.id));
      router.refresh();
    }
  }

  async function dropIncharge(labId: string, userId: string) {
    const res = await removeLabIncharge({ labId, userId });
    if (!res.ok) alert(res.error);
    else {
      setCandidates(await inchargeCandidates(labId));
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button onClick={startCreate}>Add lab</Button>
        </div>
      )}

      {labs.length === 0 ? (
        <EmptyState
          title="No labs yet"
          description={
            canManage
              ? "Create your first lab to start organizing desks, projects, and people."
              : "You are not incharge of any lab yet."
          }
          action={canManage ? <Button onClick={startCreate}>Add lab</Button> : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {labs.map((lab) => (
            <Card key={lab.id}>
              <CardHeader>
                <CardTitle>{lab.name}</CardTitle>
                <div className="flex gap-1">
                  {canManage ? (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => startEdit(lab)}>
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => askDelete(lab)} className="text-red-600">
                        Delete
                      </Button>
                    </>
                  ) : (
                    canRename(lab) && (
                      <Button variant="ghost" size="sm" onClick={() => startRename(lab)}>
                        Rename
                      </Button>
                    )
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {lab.description && <p className="text-sm text-slate-600 dark:text-slate-300">{lab.description}</p>}
                <div className="flex gap-4 text-sm text-slate-500 dark:text-slate-400">
                  <span>{lab._count.desks} desks</span>
                  <span>{lab._count.projects} projects</span>
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Lab incharges
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {lab.incharges.length === 0 && (
                      <span className="text-xs text-slate-400">None assigned</span>
                    )}
                    {lab.incharges.map((ic) => (
                      <Badge key={ic.user.id} color="primary">
                        {ic.user.name}
                      </Badge>
                    ))}
                  </div>
                  {canManage && (
                    <Button variant="outline" size="sm" className="mt-2" onClick={() => openIncharges(lab)}>
                      Manage incharges
                    </Button>
                  )}
                </div>
                {canRename(lab) && (
                  <LabAttendanceSettings
                    labId={lab.id}
                    initialMode={lab.attendanceMode}
                    initialMarker={lab.attendanceMarker}
                  />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / edit dialog (admin) */}
      <Dialog open={formOpen} onClose={() => setFormOpen(false)}>
        <DialogTitle>{editing ? "Edit lab" : "Add lab"}</DialogTitle>
        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <div>
            <Label htmlFor="lab-name">Name</Label>
            <Input id="lab-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Vibration Lab" />
          </div>
          <div>
            <Label htmlFor="lab-desc">Description (optional)</Label>
            <Textarea id="lab-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <FieldError message={error ?? undefined} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : editing ? "Save" : "Add lab"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Rename dialog (lab incharge) */}
      <Dialog open={!!renameLabTarget} onClose={() => setRenameLabTarget(null)}>
        <DialogTitle>Rename lab</DialogTitle>
        <form onSubmit={onRename} className="mt-4 space-y-3">
          <div>
            <Label htmlFor="lab-rename">Name</Label>
            <Input
              id="lab-rename"
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              maxLength={120}
            />
          </div>
          <FieldError message={renameError ?? undefined} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => setRenameLabTarget(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={renamePending}>
              {renamePending ? "Saving…" : "Rename"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Incharge management dialog */}
      <Dialog open={!!inchargeLab} onClose={() => setInchargeLab(null)}>
        {inchargeLab && (
          <>
            <DialogTitle>Incharges — {inchargeLab.name}</DialogTitle>
            <div className="mt-4 space-y-3">
              {inchargeLab.incharges.map((ic) => (
                <div key={ic.user.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{ic.user.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{ic.user.email}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="text-red-600" onClick={() => dropIncharge(inchargeLab.id, ic.user.id)}>
                    Remove
                  </Button>
                </div>
              ))}
              <div className="flex gap-2">
                <Select value={candidateId} onChange={(e) => setCandidateId(e.target.value)} className="flex-1">
                  <option value="">Select a person…</option>
                  {candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.email})
                    </option>
                  ))}
                </Select>
                <Button size="sm" onClick={addIncharge} disabled={!candidateId}>
                  Assign
                </Button>
              </div>
            </div>
          </>
        )}
      </Dialog>

      {/* Cascade delete confirmation */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle className="text-red-700 dark:text-red-300">Delete lab permanently?</DialogTitle>
        <div className="mt-4 space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            <span className="font-semibold text-slate-900 dark:text-slate-100">{deleteTarget?.name}</span> and{""}
            <span className="font-semibold text-red-700 dark:text-red-300">everything under it</span> will be
            permanently deleted. This cannot be undone.
          </p>
          {!deletePreview ? (
            <p className="text-sm text-slate-400">Counting records…</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-red-50 p-4 ring-1 ring-red-100 dark:bg-red-950">
              {[
                ["Users", deletePreview.users],
                ["Projects", deletePreview.projects],
                ["Todos", deletePreview.todos],
                ["Desks", deletePreview.desks],
                ["Bookings", deletePreview.bookings],
                ["Log entries", deletePreview.logEntries],
                ["Attendance records", deletePreview.attendanceRecords],
              ].map(([label, n]) => (
                <div key={label as string} className="flex items-baseline justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-300">{label}</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{n as number}</span>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete} disabled={deleting || !deletePreview}>
              {deleting ? "Deleting…" : "Delete everything"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
