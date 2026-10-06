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
  assignLabIncharge,
  removeLabIncharge,
  inchargeCandidates,
} from "@/app/(app)/labs/actions";

interface Lab {
  id: string;
  name: string;
  description: string | null;
  _count: { desks: number; projects: number };
  incharges: { user: { id: string; name: string; email: string } }[];
}

export function LabsClient({ labs }: { labs: Lab[] }) {
  const router = useRouter();
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Lab | null>(null);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const [inchargeLab, setInchargeLab] = React.useState<Lab | null>(null);
  const [candidates, setCandidates] = React.useState<{ id: string; name: string; email: string }[]>([]);
  const [candidateId, setCandidateId] = React.useState("");

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

  async function remove(lab: Lab) {
    if (!confirm(`Delete lab "${lab.name}"? Desks, projects and members must be moved first.`)) return;
    const res = await deleteLab(lab.id);
    if (!res.ok) alert(res.error);
    else router.refresh();
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
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Labs</h1>
          <p className="text-sm text-slate-500">Departments within the organization.</p>
        </div>
        <div className="ml-auto">
          <Button onClick={startCreate}>Add lab</Button>
        </div>
      </div>

      {labs.length === 0 ? (
        <EmptyState
          title="No labs yet"
          description="Create your first lab to start organizing desks, projects, and people."
          action={<Button onClick={startCreate}>Add lab</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {labs.map((lab) => (
            <Card key={lab.id}>
              <CardHeader>
                <CardTitle>{lab.name}</CardTitle>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => startEdit(lab)}>
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(lab)} className="text-red-600">
                    Delete
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {lab.description && <p className="text-sm text-slate-600">{lab.description}</p>}
                <div className="flex gap-4 text-sm text-slate-500">
                  <span>{lab._count.desks} desks</span>
                  <span>{lab._count.projects} projects</span>
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
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
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => openIncharges(lab)}>
                    Manage incharges
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / edit dialog */}
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

      {/* Incharge management dialog */}
      <Dialog open={!!inchargeLab} onClose={() => setInchargeLab(null)}>
        {inchargeLab && (
          <>
            <DialogTitle>Incharges — {inchargeLab.name}</DialogTitle>
            <div className="mt-4 space-y-3">
              {inchargeLab.incharges.map((ic) => (
                <div key={ic.user.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{ic.user.name}</p>
                    <p className="text-xs text-slate-500">{ic.user.email}</p>
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
    </div>
  );
}
