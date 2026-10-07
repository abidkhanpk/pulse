"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, Badge } from "@/components/ui/card";
import { Tabs, StatCard } from "@/components/ui/misc";
import { KanbanBoard, type KanbanTodo } from "./kanban";
import { GanttChart } from "./gantt";
import { TodoDialog } from "./todo-dialog";
import { MilestoneManager } from "./milestone-manager";
import { MembersManager } from "./members-manager";
import { deleteProject, updateTodo } from "@/app/(app)/projects/actions";

interface Milestone {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: string;
  sortOrder: number;
  prerequisites: { dependsOn: { id: string; title: string; status: string } }[];
}

interface TodoFull extends KanbanTodo {
  description: string | null;
  startDate: string | null;
  milestoneId: string | null;
  prerequisites: { dependsOn: { id: string; title: string; status: string } }[];
}

interface LogEntry {
  id: string;
  date: string;
  summary: string;
  status: string;
  user: { id: string; name: string };
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  lab: { id: string; name: string };
  lead: { id: string; name: string } | null;
  members: { user: { id: string; name: string; email: string }; role: string }[];
  milestones: Milestone[];
  todos: TodoFull[];
}

export function ProjectDetail({
  project,
  logEntries,
  canManage,
}: {
  project: Project;
  logEntries: LogEntry[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = React.useState("overview");
  const [todoDialog, setTodoDialog] = React.useState<{
    open: boolean;
    todo: TodoFull | null;
    defaultStatus: KanbanTodo["status"];
  }>({ open: false, todo: null, defaultStatus: "TODO" });

  const doneCount = project.todos.filter((t) => t.status === "DONE").length;
  const overdueCount = project.todos.filter(
    (t) => t.endDate && t.status !== "DONE" && t.endDate.slice(0, 10) < new Date().toISOString().slice(0, 10)
  ).length;

  function openTodoDialog(t: { id: string; status: KanbanTodo["status"] }) {
    const full = project.todos.find((x) => x.id === t.id);
    setTodoDialog({ open: true, todo: full ?? null, defaultStatus: t.status });
  }

  async function onGanttResize(todoId: string, startDate: string, endDate: string) {
    const t = project.todos.find((x) => x.id === todoId);
    if (!t) return;
    const res = await updateTodo(todoId, {
      projectId: project.id,
      title: t.title,
      description: t.description,
      status: t.status,
      milestoneId: t.milestoneId,
      assigneeId: t.assignee?.id ?? null,
      startDate,
      endDate,
    });
    if (!res.ok) alert(res.error);
    router.refresh();
  }

  async function onDelete() {
    if (!confirm(`Delete project "${project.name}"? All milestones, todos and memberships go with it.`)) return;
    const res = await deleteProject(project.id);
    if (!res.ok) alert(res.error);
    else router.push("/projects");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{project.name}</h1>
            <Badge color={project.status === "ACTIVE" ? "success" : project.status === "ON_HOLD" ? "warning" : "default"}>
              {project.status.replace("_", " ")}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {project.lab.name}
            {project.lead ? ` · Lead: ${project.lead.name}` : ""}
            {project.startDate ? ` · ${project.startDate.slice(0, 10)}` : ""}
            {project.endDate ? ` → ${project.endDate.slice(0, 10)}` : ""}
          </p>
        </div>
        {canManage && (
          <Button variant="outline" size="sm" className="text-red-600" onClick={onDelete}>
            Delete project
          </Button>
        )}
      </div>

      <Tabs
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "kanban", label: "Kanban" },
          { id: "gantt", label: "Gantt" },
          { id: "logbook", label: "Logbook", badge: logEntries.length },
          { id: "members", label: "Members", badge: project.members.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Todos" value={project.todos.length} hint={`${doneCount} done`} />
            <StatCard label="Overdue" value={overdueCount} />
            <StatCard label="Milestones" value={project.milestones.length} />
            <StatCard label="Members" value={project.members.length} />
          </div>
          {project.description && (
            <Card>
              <CardHeader><CardTitle>About</CardTitle></CardHeader>
              <CardContent><p className="whitespace-pre-wrap text-sm text-slate-700">{project.description}</p></CardContent>
            </Card>
          )}
          <Card>
            <CardHeader><CardTitle>Milestones</CardTitle></CardHeader>
            <CardContent>
              {canManage ? (
                <MilestoneManager projectId={project.id} milestones={project.milestones} onChanged={() => router.refresh()} />
              ) : project.milestones.length === 0 ? (
                <p className="text-sm text-slate-400">No milestones.</p>
              ) : (
                <div className="space-y-2">
                  {project.milestones.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2">
                      <span className="flex-1 text-sm font-medium text-slate-800">{m.title}</span>
                      <Badge color={m.status === "DONE" ? "success" : m.status === "IN_PROGRESS" ? "info" : "default"}>
                        {m.status.replace("_", " ")}
                      </Badge>
                      {m.dueDate && <span className="text-xs text-slate-400">{m.dueDate.slice(0, 10)}</span>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "kanban" && (
        <KanbanBoard
          projectId={project.id}
          initialTodos={project.todos}
          onTodoClick={(t) => openTodoDialog(t)}
          onNewTodo={(status) => setTodoDialog({ open: true, todo: null, defaultStatus: status })}
        />
      )}

      {tab === "gantt" && (
        <GanttChart
          milestones={project.milestones.map((m) => ({
            id: m.id,
            title: m.title,
            dueDate: m.dueDate,
            status: m.status,
            dependsOnIds: m.prerequisites.map((p) => p.dependsOn.id),
          }))}
          todos={project.todos.map((t) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            startDate: t.startDate,
            endDate: t.endDate,
            assigneeName: t.assignee?.name ?? null,
            milestoneId: t.milestoneId,
            dependsOnIds: t.prerequisites.map((p) => p.dependsOn.id),
          }))}
          onResizeTodo={onGanttResize}
          onTodoClick={(t) => openTodoDialog({ id: t.id, status: t.status as KanbanTodo["status"] })}
        />
      )}

      {tab === "logbook" && (
        <Card>
          <CardHeader><CardTitle>Project logbook</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {logEntries.length === 0 && <p className="text-sm text-slate-400">No logbook entries for this project yet.</p>}
            {logEntries.map((e) => (
              <div key={e.id} className="rounded-lg border border-slate-100 px-3 py-2">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>{e.date}</span>
                  <span className="font-medium text-slate-600">{e.user.name}</span>
                  <Badge color={e.status === "REVIEWED" ? "success" : e.status === "SUBMITTED" ? "info" : "default"}>{e.status}</Badge>
                </div>
                <p className="mt-0.5 text-sm text-slate-800">{e.summary}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {tab === "members" && (
        <Card>
          <CardHeader><CardTitle>Members</CardTitle></CardHeader>
          <CardContent>
            {canManage ? (
              <MembersManager projectId={project.id} members={project.members} onChanged={() => router.refresh()} />
            ) : (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {project.members.map((m) => (
                  <div key={m.user.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    <p className="font-medium text-slate-900">{m.user.name}</p>
                    <p className="text-xs text-slate-400">{m.user.email}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <TodoDialog
        open={todoDialog.open}
        onClose={() => setTodoDialog({ open: false, todo: null, defaultStatus: "TODO" })}
        onSaved={() => router.refresh()}
        projectId={project.id}
        todo={todoDialog.todo}
        defaultStatus={todoDialog.defaultStatus}
        milestones={project.milestones}
        members={project.members.map((m) => ({ id: m.user.id, name: m.user.name }))}
        canManage={canManage}
      />
    </div>
  );
}
