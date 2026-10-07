"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label, Select, FieldError } from "@/components/ui/input";
import { Dialog, DialogTitle } from "@/components/ui/overlay";
import { Badge } from "@/components/ui/card";
import { Avatar } from "@/components/ui/misc";
import {
  createMilestone,
  updateMilestone,
  deleteMilestone,
  milestoneDependencyCandidates,
  setMilestoneDependencies,
} from "@/app/(app)/projects/actions";
import { DependencyPicker, type DependencyCandidate } from "./dependency-picker";

export interface OverviewTodo {
  id: string;
  title: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  milestoneId: string | null;
  assignee: { id: string; name: string } | null;
  prerequisites: { dependsOn: { id: string; title: string; status: string } }[];
}

export interface OverviewMilestone {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: string;
  prerequisites: { dependsOn: { id: string; title: string; status: string } }[];
}

function dateKey(t: OverviewTodo): string {
  return t.startDate ?? t.endDate ?? "9999-99-99";
}

function fmt(d: string | null): string {
  if (!d) return "—";
  return d.slice(0, 10);
}

function TodoRow({ todo, onClick }: { todo: OverviewTodo; onClick: () => void }) {
  const blockers = todo.prerequisites.filter((p) => p.dependsOn.status !== "DONE");
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 py-2.5 text-left shadow-sm transition hover:border-indigo-200 hover:shadow"
    >
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{todo.title}</span>
      {blockers.length > 0 && todo.status !== "DONE" && (
        <Badge color="warning" className="shrink-0 text-[10px]" title={`Waiting on: ${blockers.map((b) => b.dependsOn.title).join(", ")}`}>
          Blocked
        </Badge>
      )}
      <span className="hidden shrink-0 text-xs text-slate-400 sm:block" title="Start → End">
        {fmt(todo.startDate)} → {fmt(todo.endDate)}
      </span>
      <Badge
        color={todo.status === "DONE" ? "success" : todo.status === "IN_PROGRESS" ? "info" : "default"}
        className="shrink-0"
      >
        {todo.status.replace("_", " ")}
      </Badge>
      {todo.assignee && <Avatar name={todo.assignee.name} className="h-6 w-6 shrink-0 text-[10px]" />}
    </button>
  );
}

function MilestoneCard({
  milestone,
  todos,
  expanded,
  onToggle,
  onTodoClick,
  onEdit,
  onDelete,
  canManage,
}: {
  milestone: OverviewMilestone;
  todos: OverviewTodo[];
  expanded: boolean;
  onToggle: () => void;
  onTodoClick: (t: OverviewTodo) => void;
  onEdit: () => void;
  onDelete: () => void;
  canManage: boolean;
}) {
  const done = todos.filter((t) => t.status === "DONE").length;
  const pct = todos.length === 0 ? 0 : Math.round((done / todos.length) * 100);
  const starts = todos.map((t) => t.startDate ?? t.endDate).filter(Boolean) as string[];
  const ends = todos.map((t) => t.endDate ?? t.startDate).filter(Boolean) as string[];
  const startLabel = starts.length ? starts.sort()[0].slice(0, 10) : null;
  const endCandidates = [...ends];
  if (milestone.dueDate) endCandidates.push(milestone.dueDate.slice(0, 10));
  const endLabel = endCandidates.length ? endCandidates.sort().pop()! : null;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 px-4 pt-3">
        <button
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={expanded}
        >
          <motion.span animate={{ rotate: expanded ? 0 : -90 }} transition={{ type: "spring", stiffness: 400, damping: 30 }}>
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </motion.span>
          <span className="truncate text-[15px] font-semibold text-slate-900">{milestone.title}</span>
        </button>
        {milestone.dueDate && (
          <span className="shrink-0 text-xs text-slate-400">Due By: {milestone.dueDate.slice(0, 10)}</span>
        )}
        <span className="shrink-0 text-xs font-medium text-slate-500">{pct}% Complete</span>
        {canManage && (
          <span className="flex shrink-0 gap-1">
            <Button variant="ghost" size="sm" onClick={onEdit} title="Edit milestone">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="text-red-600" onClick={onDelete} title="Delete milestone">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </span>
        )}
      </div>
      {/* Progress bar with start/end dates at its ends */}
      <div className="flex items-center gap-2 px-4 pt-2">
        <span className="w-20 shrink-0 text-right text-[11px] text-slate-400">{startLabel ?? "—"}</span>
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-600"
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          />
        </div>
        <span className="w-20 shrink-0 text-[11px] text-slate-400">{endLabel ?? "—"}</span>
      </div>
      <div className="px-4 pb-1 pt-1 text-xs text-slate-400">
        {done}/{todos.length} todos done
        {milestone.prerequisites.length > 0 && (
          <span> · Depends on: {milestone.prerequisites.map((p) => p.dependsOn.title).join(", ")}</span>
        )}
      </div>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="space-y-1.5 border-t border-slate-100 bg-slate-50/60 px-4 py-3">
              {todos.length === 0 ? (
                <p className="py-2 text-center text-xs text-slate-400">No todos in this milestone yet.</p>
              ) : (
                todos.map((t) => <TodoRow key={t.id} todo={t} onClick={() => onTodoClick(t)} />)
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function MilestoneOverview({
  projectId,
  milestones,
  todos,
  canManage,
  onChanged,
  onTodoClick,
}: {
  projectId: string;
  milestones: OverviewMilestone[];
  todos: OverviewTodo[];
  canManage: boolean;
  onChanged: () => void;
  onTodoClick: (t: OverviewTodo) => void;
}) {
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<OverviewMilestone | null>(null);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const [status, setStatus] = React.useState("PLANNED");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [candidates, setCandidates] = React.useState<DependencyCandidate[]>([]);
  const [dependsOn, setDependsOn] = React.useState<string[]>([]);

  // Group + sort: milestones by earliest date, todos by start date.
  const groups = React.useMemo(() => {
    const byMs = new Map<string, OverviewTodo[]>();
    const loose: OverviewTodo[] = [];
    for (const t of todos) {
      if (t.milestoneId && milestones.some((m) => m.id === t.milestoneId)) {
        const arr = byMs.get(t.milestoneId) ?? [];
        arr.push(t);
        byMs.set(t.milestoneId, arr);
      } else {
        loose.push(t);
      }
    }
    const sortTodos = (arr: OverviewTodo[]) => arr.sort((a, b) => dateKey(a).localeCompare(dateKey(b)));
    const msWithKey = milestones.map((m) => {
      const mt = sortTodos(byMs.get(m.id) ?? []);
      const key = mt.length ? dateKey(mt[0]) : m.dueDate ?? "9999-99-99";
      return { m, todos: mt, key };
    });
    msWithKey.sort((a, b) => a.key.localeCompare(b.key));
    return { msWithKey, loose: sortTodos(loose) };
  }, [milestones, todos]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function startCreate() {
    setEditing(null);
    setTitle(""); setDescription(""); setDueDate(""); setStatus("PLANNED");
    setDependsOn([]); setCandidates([]);
    setError(null);
    setFormOpen(true);
  }

  function startEdit(m: OverviewMilestone) {
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
        if (!r.ok) { setError(r.error); return; }
        targetId = editing.id;
      } else {
        const r = await createMilestone({ projectId, ...payload });
        if (!r.ok) { setError(r.error); return; }
        targetId = r.data?.id;
      }
      if (targetId && (dependsOn.length > 0 || editing)) {
        const depRes = await setMilestoneDependencies(targetId, dependsOn);
        if (!depRes.ok) { setError(depRes.error); return; }
      }
      setFormOpen(false);
      onChanged();
    } finally {
      setPending(false);
    }
  }

  async function onDelete(m: OverviewMilestone) {
    if (!confirm(`Delete milestone "${m.title}"? Its todos become unassigned.`)) return;
    const res = await deleteMilestone(m.id);
    if (!res.ok) alert(res.error);
    else onChanged();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Milestones & todos</h3>
        {canManage && (
          <Button size="sm" onClick={startCreate}>
            <Plus className="mr-1 h-4 w-4" /> Milestone
          </Button>
        )}
      </div>

      {groups.msWithKey.length === 0 && groups.loose.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
          No milestones or todos yet. Add a milestone to group work into phases.
        </p>
      )}

      {groups.msWithKey.map(({ m, todos: mt }) => (
        <MilestoneCard
          key={m.id}
          milestone={m}
          todos={mt}
          expanded={expanded.has(m.id)}
          onToggle={() => toggle(m.id)}
          onTodoClick={onTodoClick}
          onEdit={() => startEdit(m)}
          onDelete={() => onDelete(m)}
          canManage={canManage}
        />
      ))}

      {groups.loose.length > 0 && (
        <MilestoneCard
          milestone={{ id: "__none__", title: "Without milestone", description: null, dueDate: null, status: "PLANNED", prerequisites: [] }}
          todos={groups.loose}
          expanded={expanded.has("__none__")}
          onToggle={() => toggle("__none__")}
          onTodoClick={onTodoClick}
          onEdit={() => {}}
          onDelete={() => {}}
          canManage={false}
        />
      )}

      <Dialog open={formOpen} onClose={() => setFormOpen(false)}>
        <DialogTitle>{editing ? "Edit milestone" : "New milestone"}</DialogTitle>
        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <div>
            <Label htmlFor="mo-title">Title</Label>
            <Input id="mo-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="M1: Sensor interface" />
          </div>
          <div>
            <Label htmlFor="mo-desc">Description (optional)</Label>
            <Textarea id="mo-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="mo-due">Due date (optional)</Label>
              <Input id="mo-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="mo-status">Status</Label>
              <Select id="mo-status" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="PLANNED">Planned</option>
                <option value="IN_PROGRESS">In progress</option>
                <option value="DONE">Done</option>
              </Select>
            </div>
          </div>
          {editing && (
            <DependencyPicker label="Depends on" candidates={candidates} selected={dependsOn} onChange={setDependsOn} />
          )}
          <FieldError message={error ?? undefined} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : editing ? "Save" : "Add"}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
