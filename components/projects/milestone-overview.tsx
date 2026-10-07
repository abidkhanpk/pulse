"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Plus, Pencil, Trash2, CalendarDays, MoreVertical, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label, Select, FieldError } from "@/components/ui/input";
import { Dialog, DialogTitle } from "@/components/ui/overlay";
import { Avatar } from "@/components/ui/misc";
import {
  createMilestone,
  updateMilestone,
  deleteMilestone,
  milestoneDependencyCandidates,
  setMilestoneDependencies,
  setTodoStatus,
  deleteTodo,
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
  startDate: string | null;
  dueDate: string | null;
  status: string;
  prerequisites: { dependsOn: { id: string; title: string; status: string } }[];
}

function dateKey(t: OverviewTodo): string {
  return t.startDate ?? t.endDate ?? "9999-99-99";
}

function fmt(d: string | null): string {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${m}/${day}/${y}`;
}

// Projects auto-expanded this session — survives tab switches (component
// remounts) but resets on page reload, so a collapsed milestone stays collapsed.
const autoExpandedProjects = new Set<string>();

const STATUS_PILL: Record<string, string> = {
  TODO: "bg-blue-600 hover:bg-blue-700",
  IN_PROGRESS: "bg-amber-500 hover:bg-amber-600",
  DONE: "bg-emerald-600 hover:bg-emerald-700",
};

function TodoRow({
  todo,
  projectName,
  onOpen,
  onChanged,
}: {
  todo: OverviewTodo;
  projectName: string;
  onOpen: () => void;
  onChanged: () => void;
}) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const blockers = todo.prerequisites.filter((p) => p.dependsOn.status !== "DONE");

  async function quickStatus(s: string) {
    if (s === todo.status) return;
    setSaving(true);
    const res = await setTodoStatus(todo.id, s as "TODO" | "IN_PROGRESS" | "DONE");
    setSaving(false);
    if (!res.ok) alert(res.error);
    else onChanged();
  }

  async function onDelete() {
    setMenuOpen(false);
    if (!confirm(`Delete todo "${todo.title}"?`)) return;
    const res = await deleteTodo(todo.id);
    if (!res.ok) alert(res.error);
    else onChanged();
  }

  return (
    <div className="relative">
      {/* elbow connector from the tree spine */}
      <div className="absolute -left-5 top-1/2 h-px w-5 bg-slate-300" />
      <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-2.5 shadow-[0_1px_3px_rgba(15,40,70,0.08)] ring-1 ring-slate-100 transition hover:ring-indigo-200 dark:bg-slate-900 dark:ring-slate-800">
        <Flag className="h-4 w-4 shrink-0 text-slate-300" />
        <button onClick={onOpen} className="min-w-0 flex-1 text-left" title={todo.startDate || todo.endDate ? `${fmt(todo.startDate)} → ${fmt(todo.endDate)}` : "No dates — click to add"}>
          <span className="block text-[10px] leading-tight text-slate-400">{projectName}</span>
          <span className={`block truncate text-sm font-semibold text-[#1d3f66] ${todo.status === "DONE" ? "line-through opacity-60" : ""}`}>
            {todo.title}
          </span>
        </button>
        {blockers.length > 0 && todo.status !== "DONE" && (
          <span
            className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950"
            title={`Waiting on: ${blockers.map((b) => b.dependsOn.title).join(",")}`}
          >
            Blocked
          </span>
        )}
        {todo.assignee && <Avatar name={todo.assignee.name} className="h-6 w-6 shrink-0 text-[10px]" />}
        <span className="flex shrink-0 items-center gap-1 text-xs text-slate-400" title={todo.startDate ? `Start ${fmt(todo.startDate)}` : "No start date"}>
          <CalendarDays className="h-3.5 w-3.5" />
          {fmt(todo.endDate)}
        </span>
        <select
          value={todo.status}
          disabled={saving}
          onChange={(e) => quickStatus(e.target.value)}
          className={`shrink-0 cursor-pointer appearance-none rounded-full px-3 py-1 pr-7 text-xs font-semibold text-white outline-none transition ${STATUS_PILL[todo.status] ?? STATUS_PILL.TODO}`}
          style={{
            backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' stroke='white' stroke-width='1.6' fill='none' stroke-linecap='round'/></svg>")`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 0.6rem center",
          }}
          title="Change status"
        >
          <option value="TODO">New</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="DONE">Done</option>
        </select>
        <div className="relative shrink-0">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            title="More actions"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 z-20 w-32 overflow-hidden rounded-lg bg-white py-1 shadow-lg ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
                <button onClick={() => { setMenuOpen(false); onOpen(); }} className="block w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800">
                  Open
                </button>
                <button onClick={onDelete} className="block w-full px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50">
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MilestoneCard({
  milestone,
  projectName,
  todos,
  expanded,
  onToggle,
  onTodoOpen,
  onAddTodo,
  onEdit,
  onDelete,
  canManage,
  onChanged,
}: {
  milestone: OverviewMilestone;
  projectName: string;
  todos: OverviewTodo[];
  expanded: boolean;
  onToggle: () => void;
  onTodoOpen: (t: OverviewTodo) => void;
  onAddTodo: () => void;
  onEdit: () => void;
  onDelete: () => void;
  canManage: boolean;
  onChanged: () => void;
}) {
  const done = todos.filter((t) => t.status === "DONE").length;
  const pct = todos.length === 0 ? 0 : (done / todos.length) * 100;
  // Hybrid dates: manual milestone dates widen the envelope; otherwise roll up from todos.
  const rolledStarts = todos.map((t) => t.startDate ?? t.endDate).filter(Boolean) as string[];
  const rolledEnds = todos.map((t) => t.endDate ?? t.startDate).filter(Boolean) as string[];
  if (milestone.dueDate) rolledEnds.push(milestone.dueDate.slice(0, 10));
  const rolledStart = rolledStarts.length ? rolledStarts.sort()[0].slice(0, 10) : null;
  const rolledEnd = rolledEnds.length ? rolledEnds.sort().pop()!.slice(0, 10) : null;
  const manualStart = milestone.startDate ? milestone.startDate.slice(0, 10) : null;
  const manualEnd = milestone.dueDate ? milestone.dueDate.slice(0, 10) : null;
  const startLabel = manualStart ?? rolledStart;
  const endLabel = manualEnd ?? rolledEnd;
  const startAuto = !manualStart && !!rolledStart;
  const endAuto = !manualEnd && !!rolledEnd;
  const isPseudo = milestone.id === "__none__";

  return (
    <div>
      {/* Milestone header card — clicking anywhere toggles expand/collapse */}
      <div
        className="relative cursor-pointer overflow-hidden rounded-2xl bg-white shadow-[0_2px_8px_rgba(15,40,70,0.08)] ring-1 ring-slate-100 transition hover:ring-indigo-200 dark:bg-slate-900 dark:ring-slate-800"
        onClick={onToggle}
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 dark:text-slate-400 dark:border-slate-700"
            aria-expanded={expanded}
            title={expanded ? "Collapse" : "Expand"}
          >
            <motion.span animate={{ rotate: expanded ? 0 : -90 }} transition={{ type: "spring", stiffness: 400, damping: 30 }} className="flex">
              <ChevronDown className="h-4 w-4" />
            </motion.span>
          </span>
          <span className="min-w-0 w-48 shrink-0 text-left">
            <span className="block text-[10px] leading-tight text-slate-400">{projectName}</span>
            <span className="block truncate text-[15px] font-bold text-[#1d3f66]" title={milestone.title}>{milestone.title}</span>
          </span>
          {/* Progress bar inline with the title */}
          <span className="flex min-w-[140px] flex-1 items-center gap-2">
            <span
              className="flex w-[76px] shrink-0 flex-col items-end leading-tight"
              title={startAuto ? "Auto: earliest todo start" : "Milestone start date"}
            >
              <span className="text-[11px] text-slate-400">{startLabel ? fmt(startLabel) : "—"}</span>
              {startAuto && <span className="text-[9px] text-slate-300">(auto)</span>}
            </span>
            <span
              className="h-2.5 min-w-[60px] flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
              title={`${done}/${todos.length} todos done${milestone.prerequisites.length > 0 ? ` · Depends on: ${milestone.prerequisites.map((p) => p.dependsOn.title).join(",")}` : ""}`}
            >
              <motion.span
                className="block h-full rounded-full bg-[#1e4a7a]"
                initial={false}
                animate={{ width: `${pct}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 20 }}
              />
            </span>
            <span
              className="flex w-[76px] shrink-0 flex-col items-start leading-tight"
              title={endAuto ? "Auto: latest todo end" : "Milestone due date"}
            >
              <span className="text-[11px] text-slate-400">{endLabel ? fmt(endLabel) : "—"}</span>
              {endAuto && <span className="text-[9px] text-slate-300">(auto)</span>}
            </span>
          </span>
          {!isPseudo && (
            <span className="hidden shrink-0 text-xs text-slate-400 md:block">
              Due By: {milestone.dueDate ? fmt(milestone.dueDate) : "—"}
            </span>
          )}
          <span className="shrink-0 text-xs font-medium text-slate-500 dark:text-slate-400">{pct.toFixed(2)}% Complete</span>
          {canManage && !isPseudo && (
            <span className="flex shrink-0 gap-0.5" onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" onClick={onEdit} title="Edit milestone" className="!px-2">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={onDelete} title="Delete milestone" className="!px-2 text-red-600">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </span>
          )}
        </div>
        {/* navy accent — only on expanded cards */}
        {expanded && <div className="h-1 bg-[#1e4a7a]" />}
      </div>

      {/* Expandable todo tree */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="relative ml-7 mt-1">
              {/* vertical tree spine */}
              <div className="absolute bottom-5 left-0 top-3 w-px bg-slate-300" />
              <div className="space-y-2 py-1 pl-5">
                {todos.length === 0 ? (
                  <p className="py-2 text-xs text-slate-400">No todos here yet.</p>
                ) : (
                  todos.map((t) => (
                    <TodoRow
                      key={t.id}
                      todo={t}
                      projectName={projectName}
                      onOpen={() => onTodoOpen(t)}
                      onChanged={onChanged}
                    />
                  ))
                )}
                {canManage && !isPseudo && (
                  <button
                    onClick={onAddTodo}
                    className="flex items-center gap-1.5 px-1 py-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800"
                  >
                    <Plus className="h-3.5 w-3.5 rounded-full border border-current" /> Add Task
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function MilestoneOverview({
  projectId,
  projectName,
  milestones,
  todos,
  canManage,
  onChanged,
  onTodoClick,
  onAddTodo,
}: {
  projectId: string;
  projectName: string;
  milestones: OverviewMilestone[];
  todos: OverviewTodo[];
  canManage: boolean;
  onChanged: () => void;
  onTodoClick: (t: OverviewTodo) => void;
  onAddTodo: (milestoneId: string | null) => void;
}) {
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set());
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<OverviewMilestone | null>(null);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
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

  // Expand the first milestone by default (like the screenshot) — once per
  // session, so tab switches don't re-expand what the user collapsed.
  const autoExpanded = React.useRef(false);
  /* eslint-disable react-hooks/set-state-in-effect -- one-time default expansion on data load */
  React.useEffect(() => {
    if (!autoExpanded.current && !autoExpandedProjects.has(projectId) && groups.msWithKey.length > 0) {
      autoExpanded.current = true;
      autoExpandedProjects.add(projectId);
      setExpanded(new Set([groups.msWithKey[0].m.id]));
    }
  }, [groups, projectId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function expandAll() {
    const ids = groups.msWithKey.map(({ m }) => m.id);
    if (groups.loose.length > 0) ids.push("__none__");
    setExpanded(new Set(ids));
  }

  function collapseAll() {
    setExpanded(new Set());
  }

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
    setTitle(""); setDescription(""); setDueDate(""); setStartDate(""); setStatus("PLANNED");
    setDependsOn([]); setCandidates([]);
    setError(null);
    setFormOpen(true);
  }

  function startEdit(m: OverviewMilestone) {
    setEditing(m);
    setTitle(m.title); setDescription(m.description ?? "");
    setDueDate(m.dueDate ? m.dueDate.slice(0, 10) : "");
    setStartDate(m.startDate ? m.startDate.slice(0, 10) : "");
    setStatus(m.status);
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
        startDate: startDate || null,
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
    <div className="space-y-4 rounded-2xl bg-[#edf2f5] p-4">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Milestones & todos</h3>
        <div className="flex items-center gap-2">
          <button onClick={expandAll} className="text-xs font-medium text-slate-500 hover:text-indigo-600 dark:text-slate-400">
            Expand all
          </button>
          <span className="text-slate-300">|</span>
          <button onClick={collapseAll} className="text-xs font-medium text-slate-500 hover:text-indigo-600 dark:text-slate-400">
            Collapse all
          </button>
          {canManage && (
            <Button size="sm" onClick={startCreate} className="ml-2">
              <Plus className="mr-1 h-4 w-4" /> Milestone
            </Button>
          )}
        </div>
      </div>

      {groups.msWithKey.length === 0 && groups.loose.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-400 dark:bg-slate-900 dark:border-slate-700">
          No milestones or todos yet. Add a milestone to group work into phases.
        </p>
      )}

      {groups.msWithKey.map(({ m, todos: mt }) => (
        <MilestoneCard
          key={m.id}
          milestone={m}
          projectName={projectName}
          todos={mt}
          expanded={expanded.has(m.id)}
          onToggle={() => toggle(m.id)}
          onTodoOpen={onTodoClick}
          onAddTodo={() => onAddTodo(m.id)}
          onEdit={() => startEdit(m)}
          onDelete={() => onDelete(m)}
          canManage={canManage}
          onChanged={onChanged}
        />
      ))}

      {groups.loose.length > 0 && (
        <MilestoneCard
          milestone={{ id: "__none__", title: "Without milestone", description: null, startDate: null, dueDate: null, status: "PLANNED", prerequisites: [] }}
          projectName={projectName}
          todos={groups.loose}
          expanded={expanded.has("__none__")}
          onToggle={() => toggle("__none__")}
          onTodoOpen={onTodoClick}
          onAddTodo={() => onAddTodo(null)}
          onEdit={() => {}}
          onDelete={() => {}}
          canManage={false}
          onChanged={onChanged}
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
              <Label htmlFor="mo-start">Start date (optional)</Label>
              <Input id="mo-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-36 px-2" />
            </div>
            <div>
              <Label htmlFor="mo-due">Due date (optional)</Label>
              <Input id="mo-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-36 px-2" />
            </div>
          </div>
          <p className="rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
            Tip: leave dates empty to roll them up from the milestone&apos;s todos — start becomes the first
            todo&apos;s start and due becomes the last todo&apos;s end. If you set them, the milestone may start
            earlier or end later, but never narrower than its todos.
          </p>
          <div>
            <Label htmlFor="mo-status">Status</Label>
            <Select id="mo-status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="PLANNED">Planned</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="DONE">Done</option>
            </Select>
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
