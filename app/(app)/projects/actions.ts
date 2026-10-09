"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { can, scopeFilter, type PermissionKey } from "@/lib/permissions";
import { canViewAllProjects } from "@/lib/project-access";
import { logAudit } from "@/lib/audit";
import { todayPKT } from "@/lib/bookings";
import type { ActionResult } from "../labs/actions";

function deny(perm: PermissionKey) {
  return { ok: false as const, error: `You don't have permission (${perm}).` };
}

// ─── Projects ───

export async function listProjects(filters: { labId?: string; status?: string } = {}) {
  const actor = await requireUser();
  const labIds = scopeFilter(actor);
  // Without projects.view_all you only see projects where you are lead or member.
  const mine = canViewAllProjects(actor)
    ? {}
    : { OR: [{ leadId: actor.id }, { members: { some: { userId: actor.id } } }] };
  return prisma.project.findMany({
    where: {
      ...(filters.labId ? { labId: filters.labId } : labIds ? { labId: { in: labIds } } : {}),
      ...(filters.status ? { status: filters.status as never } : {}),
      ...mine,
    },
    include: {
      lab: { select: { id: true, name: true, todoPriorityEnabled: true } },
      lead: { select: { id: true, name: true } },
      _count: { select: { todos: true, members: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function getProject(id: string) {
  const actor = await requireUser();
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      lab: { select: { id: true, name: true, todoPriorityEnabled: true } },
      lead: { select: { id: true, name: true } },
      members: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { user: { name: "asc" } },
      },
      milestones: {
        orderBy: { sortOrder: "asc" },
        include: {
          prerequisites: { include: { dependsOn: { select: { id: true, title: true, status: true } } } },
        },
      },
      todos: {
        include: {
          assignee: { select: { id: true, name: true } },
          milestone: { select: { id: true, title: true } },
          prerequisites: { include: { dependsOn: { select: { id: true, title: true, status: true } } } },
        },
        orderBy: [{ status: "asc" }, { sortOrder: "asc" }],
      },
    },
  });
  if (!project) return null;
  const labIds = scopeFilter(actor);
  if (labIds && !labIds.includes(project.labId)) return null;
  if (!canViewAllProjects(actor)) {
    const isMine =
      project.leadId === actor.id || project.members.some((m) => m.user.id === actor.id);
    if (!isMine) return null;
  }
  return project;
}

const projectSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional().nullable(),
  labId: z.string().min(1),
  status: z.enum(["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"]),
  leadId: z.string().min(1).nullable().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export async function createProject(input: z.infer<typeof projectSchema>): Promise<ActionResult<{ id: string }>> {
  const actor = await requireUser();
  if (!can(actor, "projects.manage", input.labId)) return deny("projects.manage");
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Project name and lab are required." };
  const project = await prisma.project.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
      labId: parsed.data.labId,
      status: parsed.data.status,
      leadId: parsed.data.leadId || null,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
    },
  });
  // creator becomes a member automatically
  await prisma.projectMember.create({
    data: { projectId: project.id, userId: actor.id, role: "member" },
  });
  await logAudit(actor.id, "project.created", "Project", project.id, { name: project.name });
  revalidatePath("/projects");
  return { ok: true, data: { id: project.id } };
}

export async function updateProject(id: string, input: z.infer<typeof projectSchema>): Promise<ActionResult> {
  const actor = await requireUser();
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid project data." };
  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Project not found." };
  if (!can(actor, "projects.manage", existing.labId)) return deny("projects.manage");
  if (!can(actor, "projects.manage", parsed.data.labId)) return deny("projects.manage");
  await prisma.project.update({
    where: { id },
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
      labId: parsed.data.labId,
      status: parsed.data.status,
      leadId: parsed.data.leadId || null,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
    },
  });
  await logAudit(actor.id, "project.updated", "Project", id, { name: parsed.data.name });
  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  return { ok: true };
}

export async function deleteProject(id: string): Promise<ActionResult> {
  const actor = await requireUser();
  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Project not found." };
  if (!can(actor, "projects.manage", existing.labId)) return deny("projects.manage");
  await prisma.project.delete({ where: { id } });
  await logAudit(actor.id, "project.deleted", "Project", id, { name: existing.name });
  revalidatePath("/projects");
  return { ok: true };
}

// ─── Milestones ───

const milestoneSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).optional().nullable(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  status: z.enum(["PLANNED", "IN_PROGRESS", "DONE"]),
});

/** Rolled-up envelope of a milestone's todos: earliest start / latest end (YYYY-MM-DD). */
async function milestoneTodoEnvelope(milestoneId: string): Promise<{ minStart: string | null; maxEnd: string | null }> {
  const todos = await prisma.todo.findMany({
    where: { milestoneId },
    select: { startDate: true, endDate: true },
  });
  let minStart: string | null = null;
  let maxEnd: string | null = null;
  for (const t of todos) {
    const s = t.startDate ? t.startDate.toISOString().slice(0, 10) : t.endDate ? t.endDate.toISOString().slice(0, 10) : null;
    const e = t.endDate ? t.endDate.toISOString().slice(0, 10) : t.startDate ? t.startDate.toISOString().slice(0, 10) : null;
    if (s && (!minStart || s < minStart)) minStart = s;
    if (e && (!maxEnd || e > maxEnd)) maxEnd = e;
  }
  return { minStart, maxEnd };
}

/**
 * Hybrid milestone dates: manual dates may widen the envelope but never narrow
 * it past the todos. Returns an error message or null.
 */
function validateMilestoneDates(
  startDate: string | null,
  dueDate: string | null,
  env: { minStart: string | null; maxEnd: string | null }
): string | null {
  if (startDate && dueDate && startDate > dueDate) return "Milestone start date cannot be after its due date.";
  if (startDate && env.minStart && startDate > env.minStart)
    return `Milestone start cannot be later than the first todo's start (${env.minStart}).`;
  if (dueDate && env.maxEnd && dueDate < env.maxEnd)
    return `Milestone due date cannot be earlier than the last todo's end (${env.maxEnd}).`;
  return null;
}

/** Block todo dates that would poke outside their milestone's manual envelope. */
async function checkTodoMilestoneEnvelope(
  milestoneId: string | null,
  startDate: string | null,
  endDate: string | null
): Promise<string | null> {
  if (!milestoneId) return null;
  const ms = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    select: { startDate: true, dueDate: true, title: true },
  });
  if (!ms) return null;
  if (ms.startDate && startDate) {
    const msStart = ms.startDate.toISOString().slice(0, 10);
    if (startDate < msStart)
      return `Todo starts before its milestone's start date (${msStart}). Adjust the milestone "${ms.title}" first.`;
  }
  if (ms.dueDate && endDate) {
    const msEnd = ms.dueDate.toISOString().slice(0, 10);
    if (endDate > msEnd)
      return `Todo ends after its milestone's due date (${msEnd}). Adjust the milestone "${ms.title}" first.`;
  }
  return null;
}

async function projectScope(projectId: string) {
  return prisma.project.findUnique({ where: { id: projectId }, select: { labId: true } });
}

export async function createMilestone(input: z.infer<typeof milestoneSchema>): Promise<ActionResult<{ id: string }>> {
  const actor = await requireUser();
  const parsed = milestoneSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Milestone title is required." };
  const proj = await projectScope(parsed.data.projectId);
  if (!proj || !can(actor, "projects.manage", proj.labId)) return deny("projects.manage");
  const count = await prisma.milestone.count({ where: { projectId: parsed.data.projectId } });
  const startDate = parsed.data.startDate || null;
  const dueDate = parsed.data.dueDate || null;
  const dateError = validateMilestoneDates(startDate, dueDate, { minStart: null, maxEnd: null });
  if (dateError) return { ok: false, error: dateError };
  const ms = await prisma.milestone.create({
    data: {
      projectId: parsed.data.projectId,
      title: parsed.data.title,
      description: parsed.data.description || null,
      startDate: startDate ? new Date(startDate) : null,
      dueDate: dueDate ? new Date(dueDate) : null,
      status: parsed.data.status,
      sortOrder: count,
    },
  });
  await logAudit(actor.id, "milestone.created", "Milestone", ms.id, { title: ms.title });
  revalidatePath(`/projects/${parsed.data.projectId}`);
  return { ok: true, data: { id: ms.id } };
}

export async function updateMilestone(
  id: string,
  input: Omit<z.infer<typeof milestoneSchema>, "projectId">
): Promise<ActionResult> {
  const actor = await requireUser();
  const ms = await prisma.milestone.findUnique({ where: { id }, include: { project: { select: { labId: true } } } });
  if (!ms) return { ok: false, error: "Milestone not found." };
  if (!can(actor, "projects.manage", ms.project.labId)) return deny("projects.manage");
  const parsed = milestoneSchema.omit({ projectId: true }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid milestone." };
  const startDate = parsed.data.startDate || null;
  const dueDate = parsed.data.dueDate || null;
  const dateError = validateMilestoneDates(startDate, dueDate, await milestoneTodoEnvelope(id));
  if (dateError) return { ok: false, error: dateError };
  await prisma.milestone.update({
    where: { id },
    data: {
      title: parsed.data.title,
      description: parsed.data.description || null,
      startDate: startDate ? new Date(startDate) : null,
      dueDate: dueDate ? new Date(dueDate) : null,
      status: parsed.data.status,
    },
  });
  await logAudit(actor.id, "milestone.updated", "Milestone", id, {});
  revalidatePath(`/projects/${ms.projectId}`);
  return { ok: true };
}

export async function deleteMilestone(id: string): Promise<ActionResult> {
  const actor = await requireUser();
  const ms = await prisma.milestone.findUnique({
    where: { id },
    include: { project: { select: { labId: true } }, _count: { select: { todos: true } } },
  });
  if (!ms) return { ok: false, error: "Milestone not found." };
  if (!can(actor, "projects.manage", ms.project.labId)) return deny("projects.manage");
  if (ms._count.todos > 0) return { ok: false, error: "Move the milestone's todos elsewhere first." };
  await prisma.milestone.delete({ where: { id } });
  await logAudit(actor.id, "milestone.deleted", "Milestone", id, {});
  revalidatePath(`/projects/${ms.projectId}`);
  return { ok: true };
}

// ─── Todos ───

const todoSchema = z.object({
  projectId: z.string().min(1),
  milestoneId: z.string().min(1).nullable().optional(),
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(2000).optional().nullable(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  assigneeId: z.string().min(1).nullable().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export async function createTodo(input: z.infer<typeof todoSchema>): Promise<ActionResult<{ id: string }>> {
  const actor = await requireUser();
  const parsed = todoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Todo title is required." };
  const proj = await projectScope(parsed.data.projectId);
  if (!proj || !can(actor, "projects.manage", proj.labId)) return deny("projects.manage");
  const maxSort = await prisma.todo.aggregate({
    where: { projectId: parsed.data.projectId, status: parsed.data.status },
    _max: { sortOrder: true },
  });
  const envError = await checkTodoMilestoneEnvelope(
    parsed.data.milestoneId || null,
    parsed.data.startDate || null,
    parsed.data.endDate || null
  );
  if (envError) return { ok: false, error: envError };
  const todo = await prisma.todo.create({
    data: {
      projectId: parsed.data.projectId,
      milestoneId: parsed.data.milestoneId || null,
      title: parsed.data.title,
      description: parsed.data.description || null,
      status: parsed.data.status,
      priority: parsed.data.priority ?? "MEDIUM",
      assigneeId: parsed.data.assigneeId || null,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      createdById: actor.id,
    },
  });
  await logAudit(actor.id, "todo.created", "Todo", todo.id, { title: todo.title });
  revalidatePath(`/projects/${parsed.data.projectId}`);
  return { ok: true, data: { id: todo.id } };
}

export async function updateTodo(id: string, input: z.infer<typeof todoSchema>): Promise<ActionResult> {
  const actor = await requireUser();
  const parsed = todoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid todo." };
  const existing = await prisma.todo.findUnique({
    where: { id },
    include: { project: { select: { labId: true } } },
  });
  if (!existing) return { ok: false, error: "Todo not found." };
  const manager = can(actor, "projects.manage", existing.project.labId);
  const ownTodo = existing.assigneeId === actor.id;
  if (!manager && !ownTodo) return deny("projects.manage");
  // Non-managers may only change status of their own todos.
  const data: Record<string, unknown> = { status: parsed.data.status };
  if (manager) {
    const envError = await checkTodoMilestoneEnvelope(
      parsed.data.milestoneId || null,
      parsed.data.startDate || null,
      parsed.data.endDate || null
    );
    if (envError) return { ok: false, error: envError };
    Object.assign(data, {
      title: parsed.data.title,
      description: parsed.data.description || null,
      ...(parsed.data.priority ? { priority: parsed.data.priority } : {}),
      milestoneId: parsed.data.milestoneId || null,
      assigneeId: parsed.data.assigneeId || null,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
    });
  }
  await prisma.todo.update({ where: { id }, data: data as never });
  await logAudit(actor.id, "todo.updated", "Todo", id, { status: parsed.data.status });
  revalidatePath(`/projects/${existing.projectId}`);
  return { ok: true };
}

/** Drag-and-drop move: change status and/or reorder. */
export async function moveTodo(
  id: string,
  toStatus: "TODO" | "IN_PROGRESS" | "DONE",
  toIndex: number
): Promise<ActionResult> {
  const actor = await requireUser();
  const existing = await prisma.todo.findUnique({
    where: { id },
    include: { project: { select: { labId: true } } },
  });
  if (!existing) return { ok: false, error: "Todo not found." };
  const manager = can(actor, "projects.manage", existing.project.labId);
  if (!manager && existing.assigneeId !== actor.id) return deny("projects.manage");

  await prisma.$transaction(async (tx) => {
    if (existing.status !== toStatus) {
      // close the gap in the old column
      await tx.todo.updateMany({
        where: { projectId: existing.projectId, status: existing.status, sortOrder: { gt: existing.sortOrder } },
        data: { sortOrder: { decrement: 1 } },
      });
      // make room in the new column
      await tx.todo.updateMany({
        where: { projectId: existing.projectId, status: toStatus, sortOrder: { gte: toIndex } },
        data: { sortOrder: { increment: 1 } },
      });
      await tx.todo.update({ where: { id }, data: { status: toStatus, sortOrder: toIndex } });
    } else if (existing.sortOrder !== toIndex) {
      const from = existing.sortOrder;
      if (toIndex > from) {
        await tx.todo.updateMany({
          where: { projectId: existing.projectId, status: toStatus, sortOrder: { gt: from, lte: toIndex }, id: { not: id } },
          data: { sortOrder: { decrement: 1 } },
        });
      } else {
        await tx.todo.updateMany({
          where: { projectId: existing.projectId, status: toStatus, sortOrder: { gte: toIndex, lt: from }, id: { not: id } },
          data: { sortOrder: { increment: 1 } },
        });
      }
      await tx.todo.update({ where: { id }, data: { sortOrder: toIndex } });
    }
  });
  await logAudit(actor.id, "todo.moved", "Todo", id, { toStatus, toIndex });
  revalidatePath(`/projects/${existing.projectId}`);
  return { ok: true };
}

export async function deleteTodo(id: string): Promise<ActionResult> {
  const actor = await requireUser();
  const existing = await prisma.todo.findUnique({
    where: { id },
    include: { project: { select: { labId: true } } },
  });
  if (!existing) return { ok: false, error: "Todo not found." };
  if (!can(actor, "projects.manage", existing.project.labId)) return deny("projects.manage");
  await prisma.$transaction([
    prisma.todo.updateMany({
      where: { projectId: existing.projectId, status: existing.status, sortOrder: { gt: existing.sortOrder } },
      data: { sortOrder: { decrement: 1 } },
    }),
    prisma.todo.delete({ where: { id } }),
  ]);
  await logAudit(actor.id, "todo.deleted", "Todo", id, {});
  revalidatePath(`/projects/${existing.projectId}`);
  return { ok: true };
}

// ─── Members ───

export async function addMember(projectId: string, userId: string): Promise<ActionResult> {
  const actor = await requireUser();
  const proj = await projectScope(projectId);
  if (!proj || !can(actor, "projects.manage", proj.labId)) return deny("projects.manage");
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId, userId } },
    update: {},
    create: { projectId, userId, role: "member" },
  });
  await logAudit(actor.id, "project.member_added", "Project", projectId, { userId });
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function removeMember(projectId: string, userId: string): Promise<ActionResult> {
  const actor = await requireUser();
  const proj = await projectScope(projectId);
  if (!proj || !can(actor, "projects.manage", proj.labId)) return deny("projects.manage");
  await prisma.projectMember.deleteMany({ where: { projectId, userId } });
  await logAudit(actor.id, "project.member_removed", "Project", projectId, { userId });
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

/** Candidate members: active users in the project's lab. */
export async function memberCandidates(projectId: string) {
  const actor = await requireUser();
  const proj = await prisma.project.findUnique({ where: { id: projectId }, select: { labId: true } });
  if (!proj || !can(actor, "projects.manage", proj.labId)) return [];
  return prisma.user.findMany({
    where: {
      status: "ACTIVE",
      labId: proj.labId,
      memberships: { none: { projectId } },
    },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
    take: 100,
  });
}

/** Project logbook entries (for the project's Logbook tab). */
export async function projectLogbook(projectId: string) {
  const actor = await requireUser();
  const proj = await projectScope(projectId);
  if (!proj) return [];
  const labIds = scopeFilter(actor);
  if (labIds && !labIds.includes(proj.labId)) return [];
  return prisma.logEntry.findMany({
    where: { projectId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { date: "desc" },
    take: 100,
  });
}

export interface ProjectLabOverview {
  labId: string;
  labName: string;
  projectCount: number;
  activeCount: number;
  todoCount: number;
  overdueCount: number;
  memberCount: number;
}

/** Per-lab project stats for the admin overview. */
export async function projectLabOverview(): Promise<ProjectLabOverview[]> {  const actor = await requireUser();
  if (actor.role.scope !== "GLOBAL") return [];
  const today = todayPKT();
  const labs = await prisma.lab.findMany({ orderBy: { name: "asc" } });
  return Promise.all(
    labs.map(async (lab) => {
      const [projectCount, activeCount, todoCount, overdueCount, memberCount] = await Promise.all([
        prisma.project.count({ where: { labId: lab.id } }),
        prisma.project.count({ where: { labId: lab.id, status: "ACTIVE" } }),
        prisma.todo.count({ where: { project: { labId: lab.id } } }),
        prisma.todo.count({
          where: { project: { labId: lab.id }, status: { not: "DONE" }, endDate: { lt: today } },
        }),
        prisma.projectMember.count({ where: { project: { labId: lab.id } } }),
      ]);
      return {
        labId: lab.id,
        labName: lab.name,
        projectCount,
        activeCount,
        todoCount,
        overdueCount,
        memberCount,
      };
    })
  );
}

// ─── Dependencies (Finish-to-Start) ───

/** DFS: is `target` reachable from `from` following dependent → prerequisite edges? */
function depReaches(edges: Map<string, string[]>, from: string, target: string, seen: Set<string>): boolean {
  if (from === target) return true;
  if (seen.has(from)) return false;
  seen.add(from);
  for (const next of edges.get(from) ?? []) {
    if (depReaches(edges, next, target, seen)) return true;
  }
  return false;
}

/** Todos this todo may depend on (same project, excluding itself). */
export async function todoDependencyCandidates(todoId: string) {
  const actor = await requireUser();
  const todo = await prisma.todo.findUnique({ where: { id: todoId }, select: { projectId: true, project: { select: { labId: true } } } });
  if (!todo) return [];
  const labIds = scopeFilter(actor);
  if (labIds && !labIds.includes(todo.project.labId)) return [];
  return prisma.todo.findMany({
    where: { projectId: todo.projectId, id: { not: todoId } },
    select: { id: true, title: true, status: true },
    orderBy: { title: "asc" },
    take: 200,
  });
}

/** Replace a todo's prerequisites. Validates same-project, no self-dep, no cycles. */
export async function setTodoDependencies(todoId: string, dependsOnIds: string[]): Promise<ActionResult> {
  const actor = await requireUser();
  const todo = await prisma.todo.findUnique({
    where: { id: todoId },
    select: { id: true, projectId: true, project: { select: { labId: true } } },
  });
  if (!todo) return { ok: false, error: "Todo not found." };
  if (!can(actor, "projects.manage", todo.project.labId)) return deny("projects.manage");

  const clean = [...new Set(dependsOnIds)].filter((d) => d && d !== todoId);
  if (clean.length > 0) {
    const count = await prisma.todo.count({ where: { id: { in: clean }, projectId: todo.projectId } });
    if (count !== clean.length) return { ok: false, error: "Dependencies must be todos in the same project." };
  }

  // Build the project's dependency graph with this todo's edges replaced, then
  // reject if any new prerequisite can already reach this todo (that'd be a cycle).
  const existing = await prisma.todoDependency.findMany({
    where: { todo: { projectId: todo.projectId } },
    select: { todoId: true, dependsOnId: true },
  });
  const edges = new Map<string, string[]>();
  for (const e of existing) {
    if (e.todoId === todoId) continue;
    const arr = edges.get(e.todoId) ?? [];
    arr.push(e.dependsOnId);
    edges.set(e.todoId, arr);
  }
  for (const p of clean) {
    if (depReaches(edges, p, todoId, new Set())) {
      const blocker = await prisma.todo.findUnique({ where: { id: p }, select: { title: true } });
      return { ok: false, error: `"${blocker?.title ?? "Todo"}" already depends on this todo — that would create a cycle.` };
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.todoDependency.deleteMany({ where: { todoId } });
    if (clean.length > 0) {
      await tx.todoDependency.createMany({ data: clean.map((d) => ({ todoId, dependsOnId: d })) });
    }
  });
  await logAudit(actor.id, "todo.dependencies_updated", "Todo", todoId, { dependsOn: clean });
  revalidatePath(`/projects/${todo.projectId}`);
  return { ok: true };
}

/** Milestones this milestone may depend on (same project, excluding itself). */
export async function milestoneDependencyCandidates(milestoneId: string) {
  const actor = await requireUser();
  const ms = await prisma.milestone.findUnique({ where: { id: milestoneId }, select: { projectId: true, project: { select: { labId: true } } } });
  if (!ms) return [];
  const labIds = scopeFilter(actor);
  if (labIds && !labIds.includes(ms.project.labId)) return [];
  return prisma.milestone.findMany({
    where: { projectId: ms.projectId, id: { not: milestoneId } },
    select: { id: true, title: true, status: true },
    orderBy: { sortOrder: "asc" },
    take: 100,
  });
}

/** Replace a milestone's prerequisites. Validates same-project, no self-dep, no cycles. */
export async function setMilestoneDependencies(milestoneId: string, dependsOnIds: string[]): Promise<ActionResult> {
  const actor = await requireUser();
  const ms = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    select: { id: true, projectId: true, project: { select: { labId: true } } },
  });
  if (!ms) return { ok: false, error: "Milestone not found." };
  if (!can(actor, "projects.manage", ms.project.labId)) return deny("projects.manage");

  const clean = [...new Set(dependsOnIds)].filter((d) => d && d !== milestoneId);
  if (clean.length > 0) {
    const count = await prisma.milestone.count({ where: { id: { in: clean }, projectId: ms.projectId } });
    if (count !== clean.length) return { ok: false, error: "Dependencies must be milestones in the same project." };
  }

  const existing = await prisma.milestoneDependency.findMany({
    where: { milestone: { projectId: ms.projectId } },
    select: { milestoneId: true, dependsOnId: true },
  });
  const edges = new Map<string, string[]>();
  for (const e of existing) {
    if (e.milestoneId === milestoneId) continue;
    const arr = edges.get(e.milestoneId) ?? [];
    arr.push(e.dependsOnId);
    edges.set(e.milestoneId, arr);
  }
  for (const p of clean) {
    if (depReaches(edges, p, milestoneId, new Set())) {
      const blocker = await prisma.milestone.findUnique({ where: { id: p }, select: { title: true } });
      return { ok: false, error: `"${blocker?.title ?? "Milestone"}" already depends on this milestone — that would create a cycle.` };
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.milestoneDependency.deleteMany({ where: { milestoneId } });
    if (clean.length > 0) {
      await tx.milestoneDependency.createMany({ data: clean.map((d) => ({ milestoneId, dependsOnId: d })) });
    }
  });
  await logAudit(actor.id, "milestone.dependencies_updated", "Milestone", milestoneId, { dependsOn: clean });
  revalidatePath(`/projects/${ms.projectId}`);
  return { ok: true };
}

/**
 * Materialize a board's current display order as the manual kanban order.
 * Called on the first manual drag of a date-ordered board: persists each
 * todo's position and flips the project to manual ordering.
 */
export async function initKanbanOrder(
  projectId: string,
  items: { id: string; status: "TODO" | "IN_PROGRESS" | "DONE"; sortOrder: number }[]
): Promise<ActionResult> {
  const actor = await requireUser();
  const proj = await prisma.project.findUnique({ where: { id: projectId }, select: { labId: true } });
  if (!proj) return { ok: false, error: "Project not found." };
  if (!can(actor, "projects.manage", proj.labId)) return deny("projects.manage");
  const valid = items.filter((i) => i.id);
  await prisma.$transaction(async (tx) => {
    for (const item of valid) {
      await tx.todo.update({
        where: { id: item.id },
        data: { status: item.status, sortOrder: item.sortOrder },
      });
    }
    await tx.project.update({ where: { id: projectId }, data: { kanbanOrdered: true } });
  });
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

/** Quick status change (e.g. from the overview status pill). Preserves all other fields. */
export async function setTodoStatus(id: string, status: "TODO" | "IN_PROGRESS" | "DONE"): Promise<ActionResult> {
  const actor = await requireUser();
  const existing = await prisma.todo.findUnique({
    where: { id },
    include: { project: { select: { labId: true } } },
  });
  if (!existing) return { ok: false, error: "Todo not found." };
  const manager = can(actor, "projects.manage", existing.project.labId);
  if (!manager && existing.assigneeId !== actor.id) return deny("projects.manage");
  await prisma.todo.update({ where: { id }, data: { status } });
  await logAudit(actor.id, "todo.status_changed", "Todo", id, { status });
  revalidatePath(`/projects/${existing.projectId}`);
  return { ok: true };
}
