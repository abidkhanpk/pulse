"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { can, scopeFilter, type PermissionKey } from "@/lib/permissions";
import { canViewAllProjects, myProjectIds, projectTeamUserIds, projectMemberUserIds } from "@/lib/project-access";
import { logAudit } from "@/lib/audit";
import { todayPKT, toISODate } from "@/lib/bookings";
import type { ReportRow } from "@/lib/report-csv";
import type { ActionResult } from "../labs/actions";

function deny(perm: PermissionKey) {
  return { ok: false as const, error: `You don't have permission (${perm}).` };
}

export type AttendanceMode = "SELF" | "MANUAL" | "NONE";

/** Effective attendance mode for a user: personal override wins, else their lab's mode. */
export async function effectiveAttendanceMode(userId: string): Promise<AttendanceMode> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { attendanceModeOverride: true, lab: { select: { attendanceMode: true } } },
  });
  if (!u) return "SELF";
  return u.attendanceModeOverride ?? u.lab?.attendanceMode ?? "SELF";
}

/** Can this actor mark attendance for people in the given lab? (incharge, designated marker, or admin) */
export async function canMarkAttendance(actorId: string, labId: string): Promise<boolean> {
  const [actor, lab] = await Promise.all([
    prisma.user.findUnique({
      where: { id: actorId },
      select: { role: { select: { scope: true } }, inchargeOf: { select: { labId: true } } },
    }),
    prisma.lab.findUnique({ where: { id: labId }, select: { attendanceMarkerId: true } }),
  ]);
  if (!actor || !lab) return false;
  if (actor.role.scope === "GLOBAL") return true;
  if (lab.attendanceMarkerId === actorId) return true;
  return actor.inchargeOf.some((l) => l.labId === labId);
}

/** Whether the check-in module is enabled for a user (effective mode is not NONE). */
export async function isCheckInEnabled(userId: string): Promise<boolean> {
  return (await effectiveAttendanceMode(userId)) !== "NONE";
}

/**
 * Whether the Check-in sidebar entry is shown for a user.
 * - SELF: everyone checks themselves in → shown.
 * - MANUAL: only the marker (incharge / designated person / admin) needs the
 *   page; others would only see a "marked by your incharge" dead end → hidden.
 * - NONE: hidden for everyone.
 */
export async function isCheckInVisible(userId: string): Promise<boolean> {
  const mode = await effectiveAttendanceMode(userId);
  if (mode === "SELF") return true;
  if (mode === "NONE") return false;
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { labId: true } });
  return me?.labId ? canMarkAttendance(userId, me.labId) : false;
}

/** Attendance context for the check-in page. */
export async function attendanceContext() {
  const actor = await requireUser();
  const me = await prisma.user.findUnique({
    where: { id: actor.id },
    select: {
      labId: true,
      attendanceModeOverride: true,
      lab: { select: { id: true, name: true, attendanceMode: true, attendanceMarkerId: true } },
    },
  });
  const mode = me?.attendanceModeOverride ?? me?.lab?.attendanceMode ?? "SELF";
  let canMark = false;
  let people: { id: string; name: string }[] = [];
  if (me?.labId && mode === "MANUAL") {
    canMark = await canMarkAttendance(actor.id, me.labId);
    if (canMark) {
      people = await prisma.user.findMany({
        where: { labId: me.labId, status: "ACTIVE", attendanceTracking: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });
    }
  }
  return {
    mode: mode as AttendanceMode,
    labName: me?.lab?.name ?? null,
    canMark,
    people,
  };
}

// ─── Self check-in / check-out (no permission needed) ───

export async function todayAttendance() {
  const actor = await requireUser();
  const today = todayPKT();
  return prisma.attendanceRecord.findUnique({
    where: { userId_date: { userId: actor.id, date: today } },
  });
}

const checkInSchema = z.object({ workMode: z.enum(["ONSITE", "REMOTE", "LEAVE"]) });

export async function checkIn(input: z.infer<typeof checkInSchema>): Promise<ActionResult> {
  const actor = await requireUser();
  const parsed = checkInSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid check-in." };
  const mode = await effectiveAttendanceMode(actor.id);
  if (mode === "NONE") return { ok: false, error: "Attendance is disabled for your lab." };
  if (mode === "MANUAL") return { ok: false, error: "Your attendance is marked by your lab incharge." };
  const today = todayPKT();
  const existing = await prisma.attendanceRecord.findUnique({
    where: { userId_date: { userId: actor.id, date: today } },
  });
  if (existing?.checkIn) return { ok: false, error: "You are already checked in today." };
  const now = new Date();
  if (existing) {
    await prisma.attendanceRecord.update({
      where: { id: existing.id },
      data: { checkIn: now, workMode: parsed.data.workMode },
    });
  } else {
    await prisma.attendanceRecord.create({
      data: { userId: actor.id, date: today, checkIn: now, workMode: parsed.data.workMode },
    });
  }
  await logAudit(actor.id, "attendance.check_in", "AttendanceRecord", null, { workMode: parsed.data.workMode });
  revalidatePath("/check-in");
  return { ok: true };
}

export async function checkOut(): Promise<ActionResult> {
  const actor = await requireUser();
  const mode = await effectiveAttendanceMode(actor.id);
  if (mode === "NONE") return { ok: false, error: "Attendance is disabled for your lab." };
  if (mode === "MANUAL") return { ok: false, error: "Your attendance is marked by your lab incharge." };
  const today = todayPKT();
  const existing = await prisma.attendanceRecord.findUnique({
    where: { userId_date: { userId: actor.id, date: today } },
  });
  if (!existing?.checkIn) return { ok: false, error: "You haven't checked in today." };
  if (existing.checkOut) return { ok: false, error: "You are already checked out today." };
  await prisma.attendanceRecord.update({
    where: { id: existing.id },
    data: { checkOut: new Date() },
  });
  await logAudit(actor.id, "attendance.check_out", "AttendanceRecord", null, {});
  revalidatePath("/check-in");
  return { ok: true };
}

/** Correct today's record (admin/incharge): set times or mark leave. */
const correctSchema = z.object({
  userId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkIn: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  checkOut: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  workMode: z.enum(["ONSITE", "REMOTE", "LEAVE"]),
});

export async function correctAttendance(input: z.infer<typeof correctSchema>): Promise<ActionResult> {
  const actor = await requireUser();
  const parsed = correctSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid correction." };
  const person = await prisma.user.findUnique({ where: { id: parsed.data.userId }, select: { labId: true } });
  if (!person) return { ok: false, error: "Person not found." };
  if (!person.labId || !can(actor, "bookings.manage", person.labId)) return deny("bookings.manage");
  const date = new Date(parsed.data.date + "T00:00:00Z");
  const at = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    const utc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), h, m);
    return new Date(utc - 5 * 60 * 60 * 1000);
  };
  await prisma.attendanceRecord.upsert({
    where: { userId_date: { userId: parsed.data.userId, date } },
    update: {
      checkIn: parsed.data.checkIn ? at(parsed.data.checkIn) : null,
      checkOut: parsed.data.checkOut ? at(parsed.data.checkOut) : null,
      workMode: parsed.data.workMode,
    },
    create: {
      userId: parsed.data.userId,
      date,
      checkIn: parsed.data.checkIn ? at(parsed.data.checkIn) : null,
      checkOut: parsed.data.checkOut ? at(parsed.data.checkOut) : null,
      workMode: parsed.data.workMode,
    },
  });
  await logAudit(actor.id, "attendance.corrected", "AttendanceRecord", null, {
    userId: parsed.data.userId,
    date: parsed.data.date,
  });
  revalidatePath("/check-in");
  return { ok: true };
}

// ─── Reports ───

export interface ReportFilters {
  year: number;
  month: number; // 1-12
  labId?: string;
  userId?: string;
  projectId?: string;
}

export async function monthlyReport({ year, month, labId, userId, projectId }: ReportFilters): Promise<ReportRow[]> {
  const actor = await requireUser();
  if (!can(actor, "attendance.view_reports")) return [];
  const labIds = scopeFilter(actor);
  const viewAll = canViewAllProjects(actor);

  // ── scope enforcement ──
  // Lab incharges may only report on their own lab(s): reject out-of-scope filters.
  if (labId && labIds && !labIds.includes(labId)) return [];
  // Supervisors (no projects.view_all) may only report on their project teams.
  let allowedUserIds: string[] | null = null;
  if (!viewAll) {
    const mine = await myProjectIds(actor);
    if (projectId) {
      if (!mine.includes(projectId)) return [];
      allowedUserIds = await projectMemberUserIds(projectId);
    } else {
      allowedUserIds = await projectTeamUserIds(actor);
    }
  }
  if (userId) {
    if (allowedUserIds && !allowedUserIds.includes(userId)) return [];
    if (!allowedUserIds) {
      const person = await prisma.user.findUnique({ where: { id: userId }, select: { labId: true } });
      if (!person) return [];
      if (labIds && person.labId && !labIds.includes(person.labId)) return [];
    }
  }

  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 0)); // last day
  const fromIso = toISODate(monthStart);
  // Don't count future days as absent for the current month.
  const todayIso = toISODate(todayPKT());
  const capIso = `${year}-${String(month).padStart(2, "0")}`;
  const isCurrentMonth = todayIso.slice(0, 7) === capIso;
  const toIso = isCurrentMonth ? todayIso : toISODate(monthEnd);

  const users = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      attendanceTracking: true,
      ...(userId ? { id: userId } : allowedUserIds ? { id: { in: allowedUserIds } } : {}),
      ...(labId ? { labId } : labIds ? { labId: { in: labIds } } : {}),
    },
    include: {
      lab: { select: { name: true } },
      workingDayExceptions: { select: { date: true, recurrence: true } },
    },
    orderBy: { name: "asc" },
  });
  const userIds = users.map((u) => u.id);

  const [records, occurrences] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: { userId: { in: userIds }, date: { gte: monthStart, lte: monthEnd } },
    }),
    prisma.bookingOccurrence.findMany({
      where: {
        status: "SCHEDULED",
        date: { gte: monthStart, lte: monthEnd },
        booking: { userId: { in: userIds } },
      },
      select: { date: true, booking: { select: { userId: true } } },
    }),
  ]);

  const recByUser = new Map<string, typeof records>();
  for (const r of records) {
    if (!recByUser.has(r.userId)) recByUser.set(r.userId, []);
    recByUser.get(r.userId)!.push(r);
  }
  const bookingDaysByUser = new Map<string, Set<string>>();
  for (const o of occurrences) {
    const uid = o.booking.userId;
    if (!bookingDaysByUser.has(uid)) bookingDaysByUser.set(uid, new Set());
    bookingDaysByUser.get(uid)!.add(toISODate(o.date));
  }

  const { workingDaysInRange } = await import("@/lib/attendance");

  return users.map((u) => {
    const recs = recByUser.get(u.id) ?? [];
    const workingDays = new Set(
      workingDaysInRange(fromIso, toIso, {
        bookingDays: u.linkAttendanceToBooking ? bookingDaysByUser.get(u.id) ?? new Set() : new Set(),
        linkToBooking: u.linkAttendanceToBooking,
        exceptions: u.workingDayExceptions.map((e) => ({
          date: toISODate(e.date),
          recurrence: e.recurrence,
        })),
      })
    );

    let present = 0, remote = 0, leave = 0, hours = 0, hourDays = 0;
    for (const r of recs) {
      const iso = toISODate(r.date);
      if (!workingDays.has(iso)) continue;
      if (r.workMode === "LEAVE") { leave++; continue; }
      if (!r.checkIn) continue;
      if (r.workMode === "REMOTE") remote++;
      else present++;
      if (r.checkIn && r.checkOut) {
        hours += (r.checkOut.getTime() - r.checkIn.getTime()) / 3600000;
        hourDays++;
      }
    }
    let absent = 0;
    for (const d of workingDays) {
      const rec = recs.find((r) => toISODate(r.date) === d);
      if (!rec || (!rec.checkIn && rec.workMode !== "LEAVE")) absent++;
    }
    return {
      userId: u.id,
      name: u.name,
      email: u.email,
      labName: u.lab?.name ?? "—",
      present,
      remote,
      leave,
      absent,
      avgHours: hourDays ? Math.round((hours / hourDays) * 10) / 10 : null,
      expectedDays: workingDays.size,
    };
  });
}

/** People visible to the actor for report filters. */
export async function reportPeople(labId?: string, projectId?: string) {
  const actor = await requireUser();
  if (!can(actor, "attendance.view_reports")) return [];
  const labIds = scopeFilter(actor);
  if (labId && labIds && !labIds.includes(labId)) return [];
  let idFilter: Record<string, unknown> = {};
  if (!canViewAllProjects(actor)) {
    const mine = await myProjectIds(actor);
    if (projectId) {
      if (!mine.includes(projectId)) return [];
      idFilter = { id: { in: await projectMemberUserIds(projectId) } };
    } else {
      idFilter = { id: { in: await projectTeamUserIds(actor) } };
    }
  }
  return prisma.user.findMany({
    where: {
      status: "ACTIVE",
      ...idFilter,
      ...(labId ? { labId } : labIds ? { labId: { in: labIds } } : {}),
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 300,
  });
}

/** Attendance history for one person (manager view or self). */
export async function personAttendance(userId: string, from: string, to: string) {
  const actor = await requireUser();
  const person = await prisma.user.findUnique({ where: { id: userId }, select: { labId: true } });
  if (!person) return [];
  if (userId !== actor.id) {
    if (!can(actor, "attendance.view_reports")) return [];
    const labIds = scopeFilter(actor);
    if (person.labId && labIds && !labIds.includes(person.labId)) return [];
    if (!canViewAllProjects(actor) && !(await projectTeamUserIds(actor)).includes(userId)) return [];
  }
  return prisma.attendanceRecord.findMany({
    where: {
      userId,
      date: { gte: new Date(from + "T00:00:00Z"), lte: new Date(to + "T00:00:00Z") },
    },
    orderBy: { date: "desc" },
    take: 90,
  });
}

export type { ReportRow };

// ─── Manual marking (MANUAL mode) ───

const markDaySchema = z.object({
  userId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["PRESENT", "REMOTE", "LEAVE", "ABSENT"]),
});

/**
 * Mark a person's attendance for a day. Allowed for the lab's incharges,
 * the designated marker, and admins.
 */
export async function markDay(input: z.infer<typeof markDaySchema>): Promise<ActionResult> {
  const actor = await requireUser();
  const parsed = markDaySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid marking." };
  const person = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { labId: true, status: true },
  });
  if (!person || !person.labId || person.status !== "ACTIVE")
    return { ok: false, error: "Person not found." };
  if (!(await canMarkAttendance(actor.id, person.labId)))
    return { ok: false, error: "You cannot mark attendance for this lab." };
  const date = new Date(parsed.data.date + "T00:00:00Z");
  const where = { userId_date: { userId: parsed.data.userId, date } };

  if (parsed.data.status === "ABSENT") {
    await prisma.attendanceRecord.deleteMany({ where: { userId: parsed.data.userId, date } });
  } else if (parsed.data.status === "LEAVE") {
    await prisma.attendanceRecord.upsert({
      where,
      update: { checkIn: null, checkOut: null, workMode: "LEAVE" },
      create: { userId: parsed.data.userId, date, workMode: "LEAVE" },
    });
  } else {
    const workMode = parsed.data.status === "REMOTE" ? "REMOTE" : "ONSITE";
    const now = new Date();
    await prisma.attendanceRecord.upsert({
      where,
      update: { checkIn: now, workMode },
      create: { userId: parsed.data.userId, date, checkIn: now, workMode },
    });
  }
  await logAudit(actor.id, "attendance.marked", "AttendanceRecord", parsed.data.userId, {
    date: parsed.data.date,
    status: parsed.data.status,
  });
  revalidatePath("/check-in");
  return { ok: true };
}

/** Attendance records for a lab's people across a week (for the manual register). */
export async function weekAttendance(labId: string, weekStart: string) {
  const actor = await requireUser();
  if (!(await canMarkAttendance(actor.id, labId))) return null;
  const start = new Date(weekStart + "T00:00:00Z");
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const [people, records] = await Promise.all([
    prisma.user.findMany({
      where: { labId, status: "ACTIVE", attendanceTracking: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.attendanceRecord.findMany({
      where: { user: { labId }, date: { gte: start, lte: end } },
      select: { userId: true, date: true, checkIn: true, checkOut: true, workMode: true },
    }),
  ]);
  return {
    people,
    records: records.map((r) => ({
      userId: r.userId,
      date: r.date.toISOString().slice(0, 10),
      checkIn: !!r.checkIn,
      workMode: r.workMode,
    })),
  };
}
