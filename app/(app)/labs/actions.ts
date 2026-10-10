"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { can, scopeFilter, type PermissionKey } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

export type ActionResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

function deny(perm: PermissionKey) {
  return { ok: false as const, error: `You don't have permission (${perm}).` };
}

// ─── Organization ───

export async function getOrganization() {
  const org = await prisma.organization.findFirst({ include: { labs: { orderBy: { name: "asc" } } } });
  return org;
}

const orgSchema = z.object({ name: z.string().trim().min(1).max(120) });

export async function updateOrganization(input: z.infer<typeof orgSchema>): Promise<ActionResult> {
  const actor = await requireUser();
  if (!can(actor, "org.manage")) return deny("org.manage");
  const parsed = orgSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Organization name is required." };
  const org = await prisma.organization.findFirst();
  if (!org) return { ok: false, error: "Organization not found." };
  await prisma.organization.update({ where: { id: org.id }, data: { name: parsed.data.name } });
  await logAudit(actor.id, "organization.updated", "Organization", org.id, { name: parsed.data.name });
  revalidatePath("/settings");
  return { ok: true };
}

// ─── Labs ───

/** The lab AI key is server-only: strip it from anything a client can
 *  receive and expose only whether one is set. */
function stripAiKey<T extends { aiApiKey?: string | null }>(lab: T) {
  const { aiApiKey, ...rest } = lab;
  return { ...rest, aiKeySet: !!aiApiKey };
}

export async function listLabs() {
  const actor = await requireUser();
  const labIds = scopeFilter(actor);
  const labs = await prisma.lab.findMany({
    where: labIds ? { id: { in: labIds } } : undefined,
    include: {
      _count: { select: { desks: true, projects: true } },
      incharges: { include: { user: { select: { id: true, name: true, email: true } } } },
      attendanceMarker: { select: { id: true, name: true } },
    },
    orderBy: { name: "asc" },
  });
  return labs.map(stripAiKey);
}

/** Labs the current user is incharge of (for filters). */
export async function myLabs() {
  const actor = await requireUser();
  const labIds = scopeFilter(actor);
  const labs = await prisma.lab.findMany({
    where: labIds ? { id: { in: labIds } } : undefined,
    orderBy: { name: "asc" },
  });
  return labs.map(stripAiKey);
}

const labSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional().nullable(),
});

export async function createLab(input: z.infer<typeof labSchema>): Promise<ActionResult<{ id: string }>> {
  const actor = await requireUser();
  if (!can(actor, "labs.manage")) return deny("labs.manage");
  const parsed = labSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Lab name is required." };
  const org = await prisma.organization.findFirst();
  if (!org) return { ok: false, error: "Organization not found." };
  const lab = await prisma.lab.create({
    data: { organizationId: org.id, name: parsed.data.name, description: parsed.data.description ?? null },
  });
  await logAudit(actor.id, "lab.created", "Lab", lab.id, { name: lab.name });
  revalidatePath("/labs");
  return { ok: true, data: { id: lab.id } };
}

export async function updateLab(id: string, input: z.infer<typeof labSchema>): Promise<ActionResult> {
  const actor = await requireUser();
  if (!can(actor, "labs.manage", id)) return deny("labs.manage");
  const parsed = labSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Lab name is required." };
  await prisma.lab.update({ where: { id }, data: { name: parsed.data.name, description: parsed.data.description ?? null } });
  await logAudit(actor.id, "lab.updated", "Lab", id, { name: parsed.data.name });
  revalidatePath("/labs");
  return { ok: true };
}

/**
 * Rename a lab. Allowed for admins with labs.manage (scoped) and for the
 * lab's own incharges. Only the name can be changed through this action.
 */
export async function renameLab(id: string, name: string): Promise<ActionResult> {
  const actor = await requireUser();
  const isIncharge = actor.inchargeOf.some((l) => l.labId === id);
  if (!isIncharge && !can(actor, "labs.manage", id)) {
    return { ok: false as const, error: "Only the lab incharge or an admin can rename this lab." };
  }
  const clean = name.trim();
  if (!clean) return { ok: false, error: "Lab name is required." };
  if (clean.length > 120) return { ok: false, error: "Lab name is too long (max 120 characters)." };
  const lab = await prisma.lab.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!lab) return { ok: false, error: "Lab not found." };
  await prisma.lab.update({ where: { id }, data: { name: clean } });
  await logAudit(actor.id, "lab.renamed", "Lab", id, { from: lab.name, to: clean });
  revalidatePath("/labs");
  return { ok: true };
}

export interface LabDeletePreview {
  labName: string;
  desks: number;
  projects: number;
  todos: number;
  users: number;
  bookings: number;
  logEntries: number;
  attendanceRecords: number;
}

/** Counts of everything that will be removed by a cascade lab delete. */
export async function labDeletePreview(id: string): Promise<LabDeletePreview | null> {
  const actor = await requireUser();
  if (!can(actor, "labs.manage", id)) return null;
  const lab = await prisma.lab.findUnique({ where: { id }, select: { name: true } });
  if (!lab) return null;
  const [users, projects, desks] = await Promise.all([
    prisma.user.findMany({ where: { labId: id }, select: { id: true } }),
    prisma.project.findMany({ where: { labId: id }, select: { id: true } }),
    prisma.desk.findMany({ where: { labId: id }, select: { id: true } }),
  ]);
  const userIds = users.map((u) => u.id);
  const projectIds = projects.map((p) => p.id);
  const deskIds = desks.map((d) => d.id);
  const [todos, bookings, logEntries, attendanceRecords] = await Promise.all([
    prisma.todo.count({ where: { projectId: { in: projectIds } } }),
    prisma.booking.count({
      where: {
        OR: [
          { userId: { in: userIds } },
          { deskId: { in: deskIds } },
          { projectId: { in: projectIds } },
          { createdById: { in: userIds } },
        ],
      },
    }),
    prisma.logEntry.count({
      where: { OR: [{ userId: { in: userIds } }, { projectId: { in: projectIds } }] },
    }),
    prisma.attendanceRecord.count({ where: { userId: { in: userIds } } }),
  ]);
  return {
    labName: lab.name,
    desks: desks.length,
    projects: projects.length,
    todos,
    users: users.length,
    bookings,
    logEntries,
    attendanceRecords,
  };
}

/**
 * Delete a lab and EVERYTHING under it: desks, projects (with milestones,
 * todos, members), users in the lab (with their bookings, log entries and
 * attendance), and all related records. Atomic via transaction.
 */
export async function deleteLab(id: string): Promise<ActionResult> {
  const actor = await requireUser();
  if (!can(actor, "labs.manage", id)) return deny("labs.manage");
  const lab = await prisma.lab.findUnique({ where: { id }, select: { name: true } });
  if (!lab) return { ok: false, error: "Lab not found." };

  const userIds = (await prisma.user.findMany({ where: { labId: id }, select: { id: true } })).map((u) => u.id);
  // Safety: never delete yourself, and never remove the last admin.
  if (userIds.includes(actor.id)) {
    return { ok: false, error: "You cannot delete the lab you belong to. Move yourself to another lab first." };
  }
  const projectIds = (await prisma.project.findMany({ where: { labId: id }, select: { id: true } })).map((p) => p.id);
  const deskIds = (await prisma.desk.findMany({ where: { labId: id }, select: { id: true } })).map((d) => d.id);

  await prisma.$transaction(async (tx) => {
    // 1. Bookings touching the lab (occurrences cascade from bookings).
    await tx.booking.deleteMany({
      where: {
        OR: [
          { userId: { in: userIds } },
          { deskId: { in: deskIds } },
          { projectId: { in: projectIds } },
          { createdById: { in: userIds } },
        ],
      },
    });
    // 2. Log entries by lab users / for lab projects (reviewedBy nulled first).
    await tx.logEntry.updateMany({ where: { reviewedById: { in: userIds } }, data: { reviewedById: null } });
    await tx.logEntry.deleteMany({
      where: { OR: [{ userId: { in: userIds } }, { projectId: { in: projectIds } }] },
    });
    // 3. Attendance records of lab users.
    await tx.attendanceRecord.deleteMany({ where: { userId: { in: userIds } } });
    // 4. Todos created by lab users (outside cascade-deleted projects).
    await tx.todo.deleteMany({ where: { createdById: { in: userIds } } });
    // 5. Projects in other labs led by lab users — drop the lead, keep the project.
    await tx.project.updateMany({ where: { leadId: { in: userIds } }, data: { leadId: null } });
    // 6. Lab projects (milestones, todos, members cascade).
    await tx.project.deleteMany({ where: { labId: id } });
    // 7. Lab users (incharge links cascade; assigned todos already gone or SetNull).
    await tx.user.deleteMany({ where: { labId: id } });
    // 8. The lab itself (desks + incharge links cascade).
    await tx.lab.delete({ where: { id } });
  });

  await logAudit(actor.id, "lab.deleted", "Lab", id, { name: lab.name, cascade: true });
  revalidatePath("/labs");
  return { ok: true };
}

const inchargeSchema = z.object({ labId: z.string().min(1), userId: z.string().min(1) });

export async function assignLabIncharge(input: z.infer<typeof inchargeSchema>): Promise<ActionResult> {
  const actor = await requireUser();
  if (!can(actor, "labs.manage")) return deny("labs.manage");
  const parsed = inchargeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Lab and user are required." };
  const user = await prisma.user.findUnique({ where: { id: parsed.data.userId }, include: { role: true } });
  if (!user) return { ok: false, error: "User not found." };
  await prisma.labIncharge.upsert({
    where: { labId_userId: { labId: parsed.data.labId, userId: parsed.data.userId } },
    update: {},
    create: { labId: parsed.data.labId, userId: parsed.data.userId },
  });
  await logAudit(actor.id, "lab.incharge_assigned", "Lab", parsed.data.labId, { userId: parsed.data.userId });
  revalidatePath("/labs");
  return { ok: true };
}

export async function removeLabIncharge(input: z.infer<typeof inchargeSchema>): Promise<ActionResult> {
  const actor = await requireUser();
  if (!can(actor, "labs.manage")) return deny("labs.manage");
  const parsed = inchargeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Lab and user are required." };
  await prisma.labIncharge.deleteMany({ where: { labId: parsed.data.labId, userId: parsed.data.userId } });
  await logAudit(actor.id, "lab.incharge_removed", "Lab", parsed.data.labId, { userId: parsed.data.userId });
  revalidatePath("/labs");
  return { ok: true };
}

/** Users eligible to be incharges (active, not already incharge of this lab). */
export async function inchargeCandidates(labId: string) {
  const actor = await requireUser();
  if (!can(actor, "labs.manage")) return [];
  return prisma.user.findMany({
    where: { status: "ACTIVE", inchargeOf: { none: { labId } } },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
    take: 100,
  });
}

// ─── Attendance settings (per lab) ───

const attendanceSettingsSchema = z.object({
  mode: z.enum(["SELF", "MANUAL", "NONE"]),
  markerId: z.string().min(1).nullable().optional(),
});

/**
 * Turn todo priority on/off for a lab (kanban pills + priority field in
 * the todo form). Same gate as attendance settings: the lab's incharges
 * or admins.
 */
export async function updateLabTodoPriority(labId: string, enabled: boolean): Promise<ActionResult> {
  const actor = await requireUser();
  const isIncharge = actor.inchargeOf.some((l) => l.labId === labId);
  if (!isIncharge && !can(actor, "labs.manage", labId)) {
    return { ok: false as const, error: "Only the lab incharge or an admin can change this setting." };
  }
  const lab = await prisma.lab.findUnique({ where: { id: labId }, select: { id: true } });
  if (!lab) return { ok: false, error: "Lab not found." };
  await prisma.lab.update({ where: { id: labId }, data: { todoPriorityEnabled: enabled } });
  await logAudit(actor.id, "lab.todo_priority", "Lab", labId, { enabled });
  revalidatePath("/labs");
  revalidatePath("/projects");
  return { ok: true };
}

/**
 * Set a lab's attendance mode + designated marker.
 * Allowed for the lab's incharges and admins (labs.manage scoped).
 */
export async function updateLabAttendanceSettings(
  labId: string,
  input: z.infer<typeof attendanceSettingsSchema>
): Promise<ActionResult> {
  const actor = await requireUser();
  const isIncharge = actor.inchargeOf.some((l) => l.labId === labId);
  if (!isIncharge && !can(actor, "labs.manage", labId)) {
    return { ok: false as const, error: "Only the lab incharge or an admin can change attendance settings." };
  }
  const parsed = attendanceSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid attendance settings." };
  const lab = await prisma.lab.findUnique({ where: { id: labId }, select: { id: true } });
  if (!lab) return { ok: false, error: "Lab not found." };
  let markerId: string | null = null;
  if (parsed.data.mode === "MANUAL" && parsed.data.markerId) {
    const marker = await prisma.user.findUnique({
      where: { id: parsed.data.markerId },
      select: { id: true, labId: true, status: true },
    });
    if (!marker || marker.status !== "ACTIVE" || marker.labId !== labId) {
      return { ok: false, error: "Designated person must be an active member of this lab." };
    }
    markerId = marker.id;
  }
  await prisma.lab.update({
    where: { id: labId },
    data: { attendanceMode: parsed.data.mode, attendanceMarkerId: markerId },
  });
  await logAudit(actor.id, "lab.attendance_settings", "Lab", labId, {
    mode: parsed.data.mode,
    markerId,
  });
  revalidatePath("/labs");
  revalidatePath("/check-in");
  return { ok: true };
}

/** Lab members eligible as designated attendance marker. */
export async function labMarkerCandidates(labId: string) {
  const actor = await requireUser();
  const isIncharge = actor.inchargeOf.some((l) => l.labId === labId);
  if (!isIncharge && !can(actor, "labs.manage", labId)) return [];
  return prisma.user.findMany({
    where: { labId, status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

const aiConfigSchema = z.object({
  provider: z.enum(["GEMINI", "ANTHROPIC", "OPENAI", "XAI"]).nullable(),
  model: z.string().trim().max(120).nullable().optional(),
  /** Omit or send empty to keep the stored key; send a value to replace it. */
  apiKey: z.string().trim().max(500).optional(),
  clearKey: z.boolean().optional(),
});

/**
 * AI planning configuration for a lab. Owned by the lab's incharges
 * (user decision 2026-10-10): only an incharge can view or change it —
 * not even admins — and only incharges can use it. The key is stored
 * server-side and never returned to a client.
 */
export async function updateLabAiConfig(
  labId: string,
  input: z.infer<typeof aiConfigSchema>
): Promise<ActionResult> {
  const actor = await requireUser();
  if (!actor.inchargeOf.some((l) => l.labId === labId)) {
    return { ok: false, error: "Only the lab incharge can manage this lab's AI settings." };
  }
  const parsed = aiConfigSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid AI settings." };
  const lab = await prisma.lab.findUnique({ where: { id: labId }, select: { id: true } });
  if (!lab) return { ok: false, error: "Lab not found." };
  const { provider, model, apiKey, clearKey } = parsed.data;
  await prisma.lab.update({
    where: { id: labId },
    data: {
      aiProvider: provider,
      aiModel: model?.trim() ? model.trim() : null,
      ...(clearKey ? { aiApiKey: null } : apiKey ? { aiApiKey: apiKey } : {}),
    },
  });
  await logAudit(actor.id, "lab.ai_config", "Lab", labId, {
    provider,
    keyChanged: !!apiKey || !!clearKey,
  });
  revalidatePath("/labs");
  revalidatePath("/desks");
  return { ok: true };
}
