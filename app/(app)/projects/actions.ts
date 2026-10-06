"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { can, scopeFilter, type PermissionKey } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import type { ActionResult } from "../labs/actions";

function deny(perm: PermissionKey) {
  return { ok: false as const, error: `You don't have permission (${perm}).` };
}

// ─── Projects ───

export async function listProjects(filters: { labId?: string; status?: string } = {}) {
  const actor = await requireUser();
  const labIds = scopeFilter(actor);
  return prisma.project.findMany({
    where: {
      ...(filters.labId ? { labId: filters.labId } : labIds ? { labId: { in: labIds } } : {}),
      ...(filters.status ? { status: filters.status as never } : {}),
    },
    include: {
      lab: { select: { id: true, name: true } },
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
      lab: { select: { id: true, name: true } },
      lead: { select: { id: true, name: true } },
      members: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { user: { name: "asc" } },
      },
      milestones: { orderBy: { sortOrder: "asc" } },
      todos: {
        include: {
          assignee: { select: { id: true, name: true } },
          milestone: { select: { id: true, title: true } },
        },
        orderBy: [{ status: "asc" }, { sortOrder: "asc" }],
      },
    },
  });
  if (!project) return null;
  const labIds = scopeFilter(actor);
  if (labIds && !labIds.includes(project.labId)) return null;
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
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  status: z.enum(["PLANNED", "IN_PROGRESS", "DONE"]),
});

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
  const ms = await prisma.milestone.create({
    data: {
      projectId: parsed.data.projectId,
      title: parsed.data.title,
      description: parsed.data.description || null,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
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
  await prisma.milestone.update({
    where: { id },
    data: {
      title: parsed.data.title,
      description: parsed.data.description || null,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
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
  const todo = await prisma.todo.create({
    data: {
      projectId: parsed.data.projectId,
      milestoneId: parsed.data.milestoneId || null,
      title: parsed.data.title,
      description: parsed.data.description || null,
      status: parsed.data.status,
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
    Object.assign(data, {
      title: parsed.data.title,
      description: parsed.data.description || null,
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
