"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label, Select, FieldError } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Dialog, DialogTitle } from "@/components/ui/overlay";
import { createTodo, updateTodo, deleteTodo, todoDependencyCandidates, setTodoDependencies } from "@/app/(app)/projects/actions";
import { DependencyPicker, type DependencyCandidate } from "./dependency-picker";
import type { KanbanTodo, TodoPriority } from "./kanban";

interface TodoWithDeps extends KanbanTodo {
  description: string | null;
  startDate: string | null;
  milestoneId: string | null;
  prerequisites: { dependsOn: { id: string; title: string; status: string } }[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  projectId: string;
  todo: TodoWithDeps | null;
  defaultStatus: KanbanTodo["status"];
  defaultMilestoneId?: string | null;
  milestones: { id: string; title: string }[];
  members: { id: string; name: string }[];
  canManage: boolean;
  /** Lab feature toggle: when false the priority field is not shown at all. */
  showPriority?: boolean;
}

export function TodoDialog({ open, onClose, onSaved, projectId, todo, defaultStatus, defaultMilestoneId, milestones, members, canManage, showPriority }: Props) {
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [status, setStatus] = React.useState<KanbanTodo["status"]>("TODO");
  const [priority, setPriority] = React.useState<TodoPriority>("MEDIUM");
  const [milestoneId, setMilestoneId] = React.useState("");
  const [assigneeId, setAssigneeId] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [candidates, setCandidates] = React.useState<DependencyCandidate[]>([]);
  const [dependsOn, setDependsOn] = React.useState<string[]>([]);

  // Reset the form every time the dialog opens (or a different todo is selected).
  /* eslint-disable react-hooks/set-state-in-effect -- intentional form reset on open */
  React.useEffect(() => {
    if (open) {
      setTitle(todo?.title ?? "");
      setDescription(todo?.description ?? "");
      setStatus(todo?.status ?? defaultStatus);
      setPriority(todo?.priority ?? "MEDIUM");
      setMilestoneId(todo?.milestoneId ?? defaultMilestoneId ?? "");
      setAssigneeId(todo?.assignee?.id ?? "");
      setStartDate(todo?.startDate ? todo.startDate.slice(0, 10) : "");
      setEndDate(todo?.endDate ? todo.endDate.slice(0, 10) : "");
      setDependsOn(todo?.prerequisites.map((p) => p.dependsOn.id) ?? []);
      setError(null);
      setCandidates([]);
      if (todo) todoDependencyCandidates(todo.id).then(setCandidates);
    }
  }, [open, todo, defaultStatus, defaultMilestoneId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) return setError("Title is required.");
    setPending(true);
    try {
      const payload = {
        projectId,
        milestoneId: milestoneId || null,
        title: title.trim(),
        description: description.trim() || null,
        status,
        // Only sent when the lab has the priority feature on — otherwise the
        // stored value (if any) is left untouched.
        ...(showPriority ? { priority } : {}),
        assigneeId: assigneeId || null,
        startDate: startDate || null,
        endDate: endDate || null,
      };
      let depTarget: string | undefined;
      if (todo) {
        const r = await updateTodo(todo.id, payload);
        if (!r.ok) {
          setError(r.error);
          setPending(false);
          return;
        }
        depTarget = todo.id;
      } else {
        const r = await createTodo(payload);
        if (!r.ok) {
          setError(r.error);
          setPending(false);
          return;
        }
        depTarget = r.data?.id;
      }
      if (depTarget && (dependsOn.length > 0 || todo)) {
        const depRes = await setTodoDependencies(depTarget, dependsOn);
        if (!depRes.ok) {
          setError(depRes.error);
          setPending(false);
          return;
        }
      }
      onSaved();
      onClose();
    } finally {
      setPending(false);
    }
  }

  async function onDelete() {
    if (!todo || !confirm("Delete this todo?")) return;
    const res = await deleteTodo(todo.id);
    if (!res.ok) setError(res.error);
    else {
      onSaved();
      onClose();
    }
  }

  return (
    <Dialog open={open} onClose={onClose} className="max-w-lg">
      <DialogTitle>{todo ? "Edit todo" : "New todo"}</DialogTitle>
      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <div>
          <Label htmlFor="td-title">Title</Label>
          <Input id="td-title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canManage && !!todo} />
        </div>
        <div>
          <Label htmlFor="td-desc">Description (optional)</Label>
          <Textarea id="td-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} disabled={!canManage && !!todo} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="td-status">Status</Label>
            <Select id="td-status" value={status} onChange={(e) => setStatus(e.target.value as KanbanTodo["status"])}>
              <option value="TODO">To do</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="IN_REVIEW">In review</option>
              <option value="DONE">Done</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="td-assignee">Assignee</Label>
            <SearchableSelect
              id="td-assignee"
              value={assigneeId}
              onChange={setAssigneeId}
              options={[{ value: "", label: "Unassigned" }, ...members.map((m) => ({ value: m.id, label: m.name }))]}
              placeholder="Unassigned"
              disabled={!canManage}
            />
          </div>
        </div>
        {showPriority && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="td-priority">Priority</Label>
              <Select id="td-priority" value={priority} onChange={(e) => setPriority(e.target.value as TodoPriority)} disabled={!canManage}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </Select>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="td-ms">Milestone</Label>
            <Select id="td-ms" value={milestoneId} onChange={(e) => setMilestoneId(e.target.value)} disabled={!canManage}>
              <option value="">None</option>
              {milestones.map((m) => (
                <option key={m.id} value={m.id}>{m.title}</option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="td-start">Start</Label>
              <Input id="td-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={!canManage} />
            </div>
            <div>
              <Label htmlFor="td-end">End</Label>
              <Input id="td-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={!canManage} />
            </div>
          </div>
        </div>
        <FieldError message={error ?? undefined} />
        {todo && (
          <DependencyPicker
            label="Depends on"
            candidates={candidates}
            selected={dependsOn}
            onChange={setDependsOn}
            disabled={!canManage}
          />
        )}
        <div className="flex justify-between">
          <div>
            {todo && canManage && (
              <Button variant="ghost" type="button" className="text-red-600" onClick={onDelete}>
                Delete
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : todo ? "Save" : "Add todo"}</Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
