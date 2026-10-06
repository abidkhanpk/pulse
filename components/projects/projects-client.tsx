"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label, Select, FieldError } from "@/components/ui/input";
import { Dialog, DialogTitle } from "@/components/ui/overlay";
import { Card, CardHeader, CardTitle, CardContent, Badge } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { createProject, updateProject } from "@/app/(app)/projects/actions";

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  lab: { id: string; name: string };
  lead: { id: string; name: string } | null;
  _count: { todos: number; members: number };
}

const STATUS_COLORS: Record<string, "success" | "warning" | "default" | "info"> = {
  PLANNING: "info",
  ACTIVE: "success",
  ON_HOLD: "warning",
  COMPLETED: "info",
  ARCHIVED: "default",
};

export function ProjectsClient({
  projects,
  labs,
  canManage,
}: {
  projects: Project[];
  labs: { id: string; name: string }[];
  canManage: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Project | null>(null);

  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [labId, setLabId] = React.useState("");
  const [status, setStatus] = React.useState("ACTIVE");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  function startCreate() {
    setEditing(null);
    setName(""); setDescription("");
    setLabId(labs[0]?.id ?? "");
    setStatus("ACTIVE"); setStartDate(""); setEndDate("");
    setError(null);
    setFormOpen(true);
  }

  function startEdit(p: Project) {
    setEditing(p);
    setName(p.name); setDescription(p.description ?? "");
    setLabId(p.lab.id);
    setStatus(p.status);
    setStartDate(p.startDate ? p.startDate.slice(0, 10) : "");
    setEndDate(p.endDate ? p.endDate.slice(0, 10) : "");
    setError(null);
    setFormOpen(true);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Name is required.");
    setPending(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        labId,
        status: status as "ACTIVE" | "ON_HOLD" | "COMPLETED" | "ARCHIVED",
        leadId: null,
        startDate: startDate || null,
        endDate: endDate || null,
      };
      const res = editing ? await updateProject(editing.id, payload) : await createProject(payload);
      if (!res.ok) setError(res.error);
      else {
        setFormOpen(false);
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  function changeFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/projects?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Projects</h1>
          <p className="text-sm text-slate-500">{projects.length} projects</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Select value={searchParams.get("lab") ?? ""} onChange={(e) => changeFilter("lab", e.target.value)} className="w-44">
            <option value="">All labs</option>
            {labs.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </Select>
          <Select value={searchParams.get("status") ?? ""} onChange={(e) => changeFilter("status", e.target.value)} className="w-36">
            <option value="">All statuses</option>
            <option value="PLANNING">Planning</option>
            <option value="ACTIVE">Active</option>
            <option value="ON_HOLD">On hold</option>
            <option value="COMPLETED">Completed</option>
            <option value="ARCHIVED">Archived</option>
          </Select>
          {canManage && <Button onClick={startCreate}>New project</Button>}
        </div>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          title="No projects"
          description="Create your first project to start tracking milestones and todos."
          action={canManage ? <Button onClick={startCreate}>New project</Button> : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <Card key={p.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start gap-2">
                  <Link href={`/projects/${p.id}`} className="min-w-0 flex-1 hover:underline">
                    <CardTitle className="truncate">{p.name}</CardTitle>
                  </Link>
                  <Badge color={STATUS_COLORS[p.status] ?? "default"}>{p.status.replace("_", " ")}</Badge>
                </div>
                <p className="text-xs text-slate-400">{p.lab.name}</p>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-2">
                {p.description && <p className="line-clamp-2 text-sm text-slate-600">{p.description}</p>}
                <div className="mt-auto flex items-center justify-between pt-2 text-xs text-slate-500">
                  <span>{p._count.todos} todos · {p._count.members} members</span>
                  {p.endDate && <span>Due {p.endDate.slice(0, 10)}</span>}
                </div>
                <div className="flex gap-2">
                  <Link href={`/projects/${p.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">Open</Button>
                  </Link>
                  {canManage && (
                    <Button variant="ghost" size="sm" onClick={() => startEdit(p)}>
                      Edit
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={formOpen} onClose={() => setFormOpen(false)} className="max-w-lg">
        <DialogTitle>{editing ? "Edit project" : "New project"}</DialogTitle>
        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <div>
            <Label htmlFor="pr-name">Name</Label>
            <Input id="pr-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Portable vibration analyzer" />
          </div>
          <div>
            <Label htmlFor="pr-desc">Description (optional)</Label>
            <Textarea id="pr-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="pr-lab">Lab</Label>
              <Select id="pr-lab" value={labId} onChange={(e) => setLabId(e.target.value)}>
                {labs.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="pr-status">Status</Label>
              <Select id="pr-status" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="PLANNING">Planning</option>
            <option value="ACTIVE">Active</option>
                <option value="ON_HOLD">On hold</option>
                <option value="COMPLETED">Completed</option>
                <option value="ARCHIVED">Archived</option>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="pr-start">Start date (optional)</Label>
              <Input id="pr-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="pr-end">End date (optional)</Label>
              <Input id="pr-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <FieldError message={error ?? undefined} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : editing ? "Save" : "Create project"}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
