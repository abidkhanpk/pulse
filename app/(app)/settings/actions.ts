"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { can, isValidPermission, DEFAULT_ROLE_PERMISSIONS, type PermissionKey } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import type { ActionResult } from "../labs/actions";

function deny() {
  return { ok: false as const, error: "You don't have permission (roles.manage)." };
}

export async function listRoles() {
  const actor = await requireUser();
  if (!can(actor, "roles.manage")) return [];
  return prisma.role.findMany({
    include: { _count: { select: { users: true } } },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
  });
}

const roleSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[A-Z][A-Z0-9_]*$/, "Key must be UPPER_SNAKE_CASE"),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300).optional().nullable(),
  scope: z.enum(["GLOBAL", "LAB"]),
  permissions: z.array(z.string()).default([]),
});

function cleanPermissions(perms: string[]): PermissionKey[] {
  return [...new Set(perms.filter(isValidPermission))];
}

export async function createRole(input: z.infer<typeof roleSchema>): Promise<ActionResult<{ id: string }>> {
  const actor = await requireUser();
  if (!can(actor, "roles.manage")) return deny();
  const parsed = roleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid role." };
  const exists = await prisma.role.findUnique({ where: { key: parsed.data.key } });
  if (exists) return { ok: false, error: `A role with key ${parsed.data.key} already exists.` };
  const role = await prisma.role.create({
    data: {
      key: parsed.data.key,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      isSystem: false,
      scope: parsed.data.scope,
      permissions: cleanPermissions(parsed.data.permissions),
    },
  });
  await logAudit(actor.id, "role.created", "Role", role.id, { key: role.key });
  revalidatePath("/settings/roles");
  return { ok: true, data: { id: role.id } };
}

const updateRoleSchema = roleSchema.omit({ key: true }).extend({ id: z.string().min(1) });

export async function updateRole(input: z.infer<typeof updateRoleSchema>): Promise<ActionResult> {
  const actor = await requireUser();
  if (!can(actor, "roles.manage")) return deny();
  const parsed = updateRoleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid role data." };
  const role = await prisma.role.findUnique({ where: { id: parsed.data.id } });
  if (!role) return { ok: false, error: "Role not found." };
  await prisma.role.update({
    where: { id: role.id },
    data: {
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      scope: role.isSystem ? role.scope : parsed.data.scope, // system role scope is fixed
      permissions: cleanPermissions(parsed.data.permissions),
    },
  });
  await logAudit(actor.id, "role.updated", "Role", role.id, { key: role.key });
  revalidatePath("/settings/roles");
  return { ok: true };
}

export async function resetRolePermissions(id: string): Promise<ActionResult> {
  const actor = await requireUser();
  if (!can(actor, "roles.manage")) return deny();
  const role = await prisma.role.findUnique({ where: { id } });
  if (!role || !role.isSystem) return { ok: false, error: "Only system roles can be reset." };
  await prisma.role.update({
    where: { id },
    data: { permissions: DEFAULT_ROLE_PERMISSIONS[role.key] ?? [] },
  });
  await logAudit(actor.id, "role.reset", "Role", id, { key: role.key });
  revalidatePath("/settings/roles");
  return { ok: true };
}

export async function deleteRole(id: string): Promise<ActionResult> {
  const actor = await requireUser();
  if (!can(actor, "roles.manage")) return deny();
  const role = await prisma.role.findUnique({
    where: { id },
    include: { _count: { select: { users: true } } },
  });
  if (!role) return { ok: false, error: "Role not found." };
  if (role.isSystem) return { ok: false, error: "System roles cannot be deleted." };
  if (role._count.users > 0) return { ok: false, error: "Cannot delete a role that still has users." };
  await prisma.role.delete({ where: { id } });
  await logAudit(actor.id, "role.deleted", "Role", id, { key: role.key });
  revalidatePath("/settings/roles");
  return { ok: true };
}

const appNameSchema = z.object({ name: z.string().trim().min(1).max(60) });

/** Update the app display name (admin only). */
export async function updateAppName(input: z.infer<typeof appNameSchema>): Promise<ActionResult> {
  const actor = await requireUser();
  if (!can(actor, "org.manage")) return { ok: false, error: "You don't have permission (org.manage)." };
  const parsed = appNameSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Name must be 1–60 characters." };
  const { setAppName } = await import("@/lib/app-settings");
  await setAppName(parsed.data.name);
  await logAudit(actor.id, "app.rename", "AppSetting", "appName", { name: parsed.data.name });
  revalidatePath("/", "layout");
  return { ok: true };
}
