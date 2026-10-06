"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { can, scopeFilter, type PermissionKey } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { todayPKT, toISODate } from "@/lib/bookings";
import type { ActionResult } from "../labs/actions";

function deny(perm: PermissionKey) {
  return { ok: false as const, error: `You don't have permission (${perm}).` };
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
}

export interface ReportRow {
  userId: string;
  name: string;
  email: string;
  labName: string;
  present: number;
  remote: number;
  leave: number;
  absent: number; // weekdays with no record and tracking on
  avgHours: number | null;
  expectedDays: number; // weekdays in month (tracking on)
}

export async function monthlyReport({ year, month, labId, userId }: ReportFilters): Promise<ReportRow[]> {
  const actor = await requireUser();
  if (!can(actor, "attendance.view_reports")) return [];
  const labIds = scopeFilter(actor);

  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 0)); // last day
  const weekdays: Date[] = [];
  for (let d = new Date(monthStart); d <= monthEnd; d.setUTCDate(d.getUTCDate() + 1)) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) weekdays.push(new Date(d));
  }

  const users = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      attendanceTracking: true,
      ...(userId ? { id: userId } : labId ? { labId } : labIds ? { labId: { in: labIds } } : {}),
    },
    include: { lab: { select: { name: true } } },
    orderBy: { name: "asc" },
  });

  const records = await prisma.attendanceRecord.findMany({
    where: {
      userId: { in: users.map((u) => u.id) },
      date: { gte: monthStart, lte: monthEnd },
    },
  });
  const byUser = new Map<string, typeof records>();
  for (const r of records) {
    if (!byUser.has(r.userId)) byUser.set(r.userId, []);
    byUser.get(r.userId)!.push(r);
  }

  return users.map((u) => {
    const recs = byUser.get(u.id) ?? [];
    let present = 0, remote = 0, leave = 0, hours = 0, hourDays = 0;
    for (const r of recs) {
      if (r.workMode === "LEAVE") { leave++; continue; }
      if (!r.checkIn) continue;
      if (r.workMode === "REMOTE") remote++;
      else present++;
      if (r.checkIn && r.checkOut) {
        hours += (r.checkOut.getTime() - r.checkIn.getTime()) / 3600000;
        hourDays++;
      }
    }
    const recordedDays = new Set(recs.filter((r) => r.checkIn || r.workMode === "LEAVE").map((r) => toISODate(r.date)));
    const absent = weekdays.filter((d) => {
      const iso = toISODate(d);
      const rec = recs.find((r) => toISODate(r.date) === iso);
      return !rec || (!rec.checkIn && rec.workMode !== "LEAVE");
    }).length;
    void recordedDays;
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
      expectedDays: weekdays.length,
    };
  });
}

/** People visible to the actor for report filters. */
export async function reportPeople(labId?: string) {
  const actor = await requireUser();
  if (!can(actor, "attendance.view_reports")) return [];
  const labIds = scopeFilter(actor);
  return prisma.user.findMany({
    where: {
      status: "ACTIVE",
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
    if (person.labId && scopeFilter(actor) && !scopeFilter(actor)!.includes(person.labId)) return [];
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

export function reportToCsv(rows: ReportRow[], year: number, month: number): string {
  const header = "Name,Email,Lab,Present,Remote,Leave,Absent,Avg hours/day,Expected weekdays";
  const lines = rows.map((r) =>
    [r.name, r.email, r.labName, r.present, r.remote, r.leave, r.absent, r.avgHours ?? "", r.expectedDays]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  );
  return [`# Attendance report ${year}-${String(month).padStart(2, "0")}`, header, ...lines].join("\n");
}
