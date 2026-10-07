"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { can, scopeFilter, hasPermission, type PermissionKey } from "@/lib/permissions";
import type { SessionActor } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";
import { todayPKT } from "@/lib/bookings";
import type { ActionResult } from "../labs/actions";

function deny(perm: PermissionKey) {
  return { ok: false as const, error: `You don't have permission (${perm}).` };
}

const PROTECTED_ROLE_KEYS = ["ADMIN", "LAB_INCHARGE"];

/** Roles the actor may assign. Lab incharges cannot grant ADMIN/LAB_INCHARGE. */
export async function assignableRoles() {
  const actor = await requireUser();
  if (!can(actor, "users.manage")) return [];
  const roles = await prisma.role.findMany({ orderBy: { name: "asc" } });
  if (can(actor, "roles.manage")) return roles; // admin can assign anything
  return roles.filter((r) => !PROTECTED_ROLE_KEYS.includes(r.key) && r.scope === "LAB");
}

function canAssignRole(actor: SessionActor, roleKey: string, roleScope: string): boolean {
  if (hasPermission(actor, "roles.manage")) return true; // admin-level
  return !PROTECTED_ROLE_KEYS.includes(roleKey) && roleScope === "LAB";
}

export interface PersonFilters {
  labId?: string;
  status?: "ACTIVE" | "INACTIVE";
  search?: string;
}

export async function listPeople(filters: PersonFilters = {}) {
  const actor = await requireUser();
  if (!can(actor, "users.manage")) return [];
  const labIds = scopeFilter(actor);
  return prisma.user.findMany({
    where: {
      ...(filters.labId ? { labId: filters.labId } : labIds ? { labId: { in: labIds } } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.search
        ? { OR: [{ name: { contains: filters.search, mode: "insensitive" } }, { email: { contains: filters.search, mode: "insensitive" } }] }
        : {}),
    },
    include: {
      role: { select: { key: true, name: true } },
      lab: { select: { id: true, name: true } },
    },
    orderBy: { name: "asc" },
    take: 300,
  });
}

export async function getPerson(id: string) {
  const actor = await requireUser();
  const person = await prisma.user.findUnique({
    where: { id },
    include: {
      role: true,
      lab: true,
      inchargeOf: { include: { lab: { select: { id: true, name: true } } } },
    },
  });
  if (!person) return null;
  // Self can view own profile; otherwise needs users.manage in scope.
  if (person.id !== actor.id) {
    if (!can(actor, "users.manage")) return null;
    if (person.labId && !can(actor, "users.manage", person.labId)) return null;
  }
  const { passwordHash: _ph, ...safe } = person;
  return safe;
}

const userSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().email().max(160),
  password: z.string().min(8).max(100).optional(),
  roleId: z.string().min(1),
  labId: z.string().min(1).nullable(),
  attendanceTracking: z.boolean(),
  joinDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  attendanceModeOverride: z.enum(["SELF", "MANUAL", "NONE"]).nullable().optional(),
  linkAttendanceToBooking: z.boolean().optional(),
});

async function checkUserScope(actor: Awaited<ReturnType<typeof requireUser>>, labId: string | null, roleId: string) {
  if (!can(actor, "users.manage")) return deny("users.manage");
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) return { ok: false as const, error: "Role not found." };
  if (!canAssignRole(actor, role.key, role.scope)) {
    return { ok: false as const, error: `You cannot assign the ${role.name} role.` };
  }
  if (labId && !can(actor, "users.manage", labId)) return deny("users.manage");
  return { ok: true as const, role };
}

export async function createUser(input: z.infer<typeof userSchema>): Promise<ActionResult<{ id: string }>> {
  const actor = await requireUser();
  const parsed = userSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid person data." };
  if (!parsed.data.password) return { ok: false, error: "A password is required for a new person." };
  const scope = await checkUserScope(actor, parsed.data.labId, parsed.data.roleId);
  if (!scope.ok) return scope;
  const email = parsed.data.email.toLowerCase();
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return { ok: false, error: "That email is already in use." };
  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email,
      passwordHash: await hash(parsed.data.password, 10),
      roleId: parsed.data.roleId,
      labId: parsed.data.labId,
      attendanceTracking: parsed.data.attendanceTracking,
      joinDate: parsed.data.joinDate ? new Date(parsed.data.joinDate) : null,
      attendanceModeOverride: parsed.data.attendanceModeOverride ?? null,
      linkAttendanceToBooking: parsed.data.linkAttendanceToBooking ?? true,
      status: "ACTIVE",
    },
  });
  await logAudit(actor.id, "user.created", "User", user.id, { name: user.name, email: user.email });
  revalidatePath("/people");
  return { ok: true, data: { id: user.id } };
}

const updateUserSchema = userSchema.omit({ password: true }).extend({ id: z.string().min(1) });

export async function updateUser(input: z.infer<typeof updateUserSchema>): Promise<ActionResult> {
  const actor = await requireUser();
  const parsed = updateUserSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid person data." };
  const existing = await prisma.user.findUnique({ where: { id: parsed.data.id } });
  if (!existing) return { ok: false, error: "Person not found." };
  // Scope check against the person's CURRENT lab too (can't poach from other labs).
  if (existing.labId && !can(actor, "users.manage", existing.labId)) return deny("users.manage");
  const scope = await checkUserScope(actor, parsed.data.labId, parsed.data.roleId);
  if (!scope.ok) return scope;
  const email = parsed.data.email.toLowerCase();
  if (email !== existing.email) {
    const dup = await prisma.user.findUnique({ where: { email } });
    if (dup) return { ok: false, error: "That email is already in use." };
  }
  await prisma.user.update({
    where: { id: parsed.data.id },
    data: {
      name: parsed.data.name,
      email,
      roleId: parsed.data.roleId,
      labId: parsed.data.labId,
      attendanceTracking: parsed.data.attendanceTracking,
      joinDate: parsed.data.joinDate ? new Date(parsed.data.joinDate) : null,
      attendanceModeOverride: parsed.data.attendanceModeOverride ?? null,
      linkAttendanceToBooking: parsed.data.linkAttendanceToBooking ?? true,
    },
  });
  await logAudit(actor.id, "user.updated", "User", parsed.data.id, { name: parsed.data.name });
  revalidatePath("/people");
  return { ok: true };
}

export async function setUserStatus(id: string, status: "ACTIVE" | "INACTIVE"): Promise<ActionResult> {
  const actor = await requireUser();
  if (id === actor.id) return { ok: false, error: "You cannot deactivate yourself." };
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Person not found." };
  if (existing.labId && !can(actor, "users.manage", existing.labId)) return deny("users.manage");
  if (!can(actor, "users.manage")) return deny("users.manage");
  await prisma.user.update({ where: { id }, data: { status } });
  await logAudit(actor.id, "user.status_changed", "User", id, { status });
  revalidatePath("/people");
  return { ok: true };
}

const passwordSchema = z.object({ id: z.string().min(1), password: z.string().min(8).max(100) });

export async function resetPassword(input: z.infer<typeof passwordSchema>): Promise<ActionResult> {
  const actor = await requireUser();
  const parsed = passwordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Password must be at least 8 characters." };
  const existing = await prisma.user.findUnique({ where: { id: parsed.data.id } });
  if (!existing) return { ok: false, error: "Person not found." };
  if (existing.labId && !can(actor, "users.manage", existing.labId)) return deny("users.manage");
  if (!can(actor, "users.manage")) return deny("users.manage");
  await prisma.user.update({ where: { id: parsed.data.id }, data: { passwordHash: await hash(parsed.data.password, 10) } });
  await logAudit(actor.id, "user.password_reset", "User", parsed.data.id, {});
  return { ok: true };
}

export interface PeopleLabOverview {
  labId: string;
  labName: string;
  headcount: number;
  activeCount: number;
  checkedInToday: number;
  inchargeNames: string[];
}

/** Per-lab people stats for the admin overview. */
export async function peopleLabOverview(): Promise<PeopleLabOverview[]> {
  const actor = await requireUser();
  if (actor.role.scope !== "GLOBAL") return [];
  const today = todayPKT();
  const labs = await prisma.lab.findMany({
    orderBy: { name: "asc" },
    include: { incharges: { include: { user: { select: { name: true } } } } },
  });
  return Promise.all(
    labs.map(async (lab) => {
      const [headcount, activeCount, checkedInToday] = await Promise.all([
        prisma.user.count({ where: { labId: lab.id } }),
        prisma.user.count({ where: { labId: lab.id, status: "ACTIVE" } }),
        prisma.attendanceRecord.count({
          where: { date: today, checkIn: { not: null }, user: { labId: lab.id } },
        }),
      ]);
      return {
        labId: lab.id,
        labName: lab.name,
        headcount,
        activeCount,
        checkedInToday,
        inchargeNames: lab.incharges.map((i) => i.user.name),
      };
    })
  );
}

// ─── Extra working days ───

async function canManagePerson(userId: string) {
  const actor = await requireUser();
  const person = await prisma.user.findUnique({ where: { id: userId }, select: { labId: true } });
  if (!person) return { ok: false as const, error: "Person not found." };
  if (!can(actor, "users.manage")) return { ok: false as const, error: "You don't have permission (users.manage)." };
  if (person.labId && !can(actor, "users.manage", person.labId))
    return { ok: false as const, error: "You don't have permission (users.manage)." };
  return { ok: true as const };
}

export async function listWorkingDayExceptions(userId: string) {
  const check = await canManagePerson(userId);
  if (!check.ok) return [];
  return prisma.workingDayException.findMany({
    where: { userId },
    orderBy: { date: "asc" },
  });
}

const extraDaySchema = z.object({
  userId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  recurrence: z.enum(["ONCE", "WEEKLY", "BIWEEKLY", "MONTHLY"]),
  note: z.string().trim().max(120).optional().nullable(),
});

export async function addWorkingDayException(
  input: z.infer<typeof extraDaySchema>
): Promise<ActionResult> {
  const check = await canManagePerson(input.userId);
  if (!check.ok) return check;
  const parsed = extraDaySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid date." };
  await prisma.workingDayException.create({
    data: {
      userId: parsed.data.userId,
      date: new Date(parsed.data.date + "T00:00:00Z"),
      recurrence: parsed.data.recurrence,
      note: parsed.data.note?.trim() || null,
    },
  });
  await logAudit((await requireUser()).id, "user.extra_day_added", "User", parsed.data.userId, {
    date: parsed.data.date,
    recurrence: parsed.data.recurrence,
  });
  revalidatePath("/people");
  return { ok: true };
}

export async function deleteWorkingDayException(id: string): Promise<ActionResult> {
  const actor = await requireUser();
  const ex = await prisma.workingDayException.findUnique({ where: { id }, select: { userId: true } });
  if (!ex) return { ok: false, error: "Not found." };
  const check = await canManagePerson(ex.userId);
  if (!check.ok) return check;
  await prisma.workingDayException.delete({ where: { id } });
  await logAudit(actor.id, "user.extra_day_removed", "User", ex.userId, {});
  revalidatePath("/people");
  return { ok: true };
}
