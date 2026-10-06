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

export async function listLabs() {
  const actor = await requireUser();
  const labIds = scopeFilter(actor);
  return prisma.lab.findMany({
    where: labIds ? { id: { in: labIds } } : undefined,
    include: {
      _count: { select: { desks: true, projects: true } },
      incharges: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
    orderBy: { name: "asc" },
  });
}

/** Labs the current user is incharge of (for filters). */
export async function myLabs() {
  const actor = await requireUser();
  const labIds = scopeFilter(actor);
  return prisma.lab.findMany({
    where: labIds ? { id: { in: labIds } } : undefined,
    orderBy: { name: "asc" },
  });
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

export async function deleteLab(id: string): Promise<ActionResult> {
  const actor = await requireUser();
  if (!can(actor, "labs.manage", id)) return deny("labs.manage");
  const counts = await prisma.lab.findUnique({
    where: { id },
    include: { _count: { select: { desks: true, projects: true, members: true } } },
  });
  if (!counts) return { ok: false, error: "Lab not found." };
  if (counts._count.desks > 0 || counts._count.projects > 0 || counts._count.members > 0) {
    return { ok: false, error: "Cannot delete a lab that still has desks, projects, or members." };
  }
  await prisma.$transaction([
    prisma.labIncharge.deleteMany({ where: { labId: id } }),
    prisma.lab.delete({ where: { id } }),
  ]);
  await logAudit(actor.id, "lab.deleted", "Lab", id, {});
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
