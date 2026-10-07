"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label, Select, FieldError } from "@/components/ui/input";
import { Dialog, DialogTitle } from "@/components/ui/overlay";
import { Card, CardContent, Badge } from "@/components/ui/card";
import { createMilestone, updateMilestone, deleteMilestone, milestoneDependencyCandidates, setMilestoneDependencies } from "@/app/(app)/projects/actions";
import { DependencyPicker, type DependencyCandidate } from "./dependency-picker";

interface Milestone {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: string;
  prerequisites: { dependsOn: { id: string; title: string; status: string } }[];
}

const STATUS_COLORS: Record<string, "default" | "info" | "success"> = {
  PLANNED: "default",
  IN_PROGRESS: "info",
  DONE: "success",
};

export function MilestoneManager({
  projectId,
  milestones,
  onChanged,
}: {
  projectId: string;
  milestones: Milestone[];
  onChanged: () => void;
}) {
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Milestone | null>(null);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const [status, setStatus] = React.useState("PLANNED");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [candidates, setCandidates] = React.useState<DependencyCandidate[]>([]);
  const [dependsOn, setDependsOn] = React.useState<string[]>([]);

  function startCreate() {
    setEditing(null);
    setTitle(""); setDescription(""); setDueDate(""); setStatus("PLANNED");
    setDependsOn([]); setCandidates([]);
    setError(null);
    setFormOpen(true);
  }

  function startEdit(m: Milestone) {
    setEditing(m);
    setTitle(m.title); setDescription(m.description ?? "");
    setDueDate(m.dueDate ? m.dueDate.slice(0, 10) : ""); setStatus(m.status);
    setDependsOn(m.prerequisites.map((p) => p.dependsOn.id));
    setError(null);
    setFormOpen(true);
    milestoneDependencyCandidates(m.id).then(setCandidates);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) return setError("Title is required.");
    setPending(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        dueDate: dueDate || null,
        status: status as "PLANNED" | "IN_PROGRESS" | "DONE",
      };
      let targetId: string | undefined;
      if (editing) {
        const r = await updateMilestone(editing.id, payload);
        if (!r.ok) {
          setError(r.error);
          setPending(false);
          return;
        }
        targetId = editing.id;
      } else {
        const r = await createMilestone({ projectId, ...payload });
        if (!r.ok) {
          setError(r.error);
          setPending(false);
          return;
        }
        targetId = r.data?.id;
      }
      if (targetId && (dependsOn.length > 0 || editing)) {
        const depRes = await setMilestoneDependencies(targetId, dependsOn);
        if (!depRes.ok) {
          setError(depRes.error);
          setPending(false);
          return;
        }
      }
      setFormOpen(false);
      onChanged();
    } finally {
      setPending(false);
    }
  }

  async function onDelete(m: Milestone) {
    if (!confirm(`Delete milestone "${m.title}"?`)) return;
    const res = await deleteMilestone(m.id);
    if (!res.ok) alert(res.error);
    else onChanged();
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={startCreate}>Add milestone</Button>
      </div>
      {milestones.length === 0 && (
        <p className="text-sm text-slate-400">No milestones yet. Group todos under milestones to track phases.</p>
      )}
      <div className="space-y-2">
        {milestones.map((m) => (
          <Card key={m.id}>
            <CardContent className="!py-3">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">{m.title}</p>
                  {m.description && <p className="truncate text-sm text-slate-500">{m.description}</p>}
                  {m.prerequisites.length > 0 && (
                    <p className="mt-0.5 text-xs text-slate-400">
                      Depends on: {m.prerequisites.map((p) => p.dependsOn.title).join(", ")}
                    </p>
                  )}
                </div>
                <Badge color={STATUS_COLORS[m.status] ?? "default"}>{m.status.replace("_", " ")}</Badge>
                {m.dueDate && <span className="text-xs text-slate-400">Due {m.dueDate.slice(0, 10)}</span>}
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => startEdit(m)}>Edit</Button>
                  <Button variant="ghost" size="sm" className="text-red-600" onClick={() => onDelete(m)}>Delete</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={formOpen} onClose={() => setFormOpen(false)}>
        <DialogTitle>{editing ? "Edit milestone" : "New milestone"}</DialogTitle>
        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <div>
            <Label htmlFor="ms-title">Title</Label>
            <Input id="ms-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="M1: Sensor interface" />
          </div>
          <div>
            <Label htmlFor="ms-desc">Description (optional)</Label>
            <Textarea id="ms-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ms-due">Due date (optional)</Label>
              <Input id="ms-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="ms-status">Status</Label>
              <Select id="ms-status" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="PLANNED">Planned</option>
                <option value="IN_PROGRESS">In progress</option>
                <option value="DONE">Done</option>
              </Select>
            </div>
          </div>
          <FieldError message={error ?? undefined} />
          {editing && (
            <DependencyPicker
              label="Depends on"
              candidates={candidates}
              selected={dependsOn}
              onChange={setDependsOn}
            />
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : editing ? "Save" : "Add"}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
