"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { can, scopeFilter, hasPermission } from "@/lib/permissions";
import { todayPKT, toISODate } from "@/lib/bookings";

export interface DashboardData {
  desksOccupied: number;
  desksTotal: number;
  checkedInToday: number;
  peopleTotal: number;
  overdueTodos: number;
  pendingReviews: number;
  myTodos: { id: string; title: string; projectName: string; projectId: string; endDate: string | null; status: string }[];
  todayBookings: { id: string; personName: string; deskLabel: string | null; timeStart: string; timeEnd: string; title: string | null }[];
  canSeeBookings: boolean;
  attendanceTrend: { date: string; present: number }[];
  projectProgress: { name: string; done: number; total: number }[];
  recentActivity: { id: string; action: string; entity: string; at: string; userName: string }[];
  attendanceEnabled: boolean;
  myMonthPct: number | null;
}

function fmtTime(iso: Date): string {
  return iso.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Karachi" });
}

export async function dashboardData(): Promise<DashboardData> {
  const actor = await requireUser();
  const labIds = scopeFilter(actor);
  const labFilter = labIds ? { in: labIds } : undefined;
  const today = todayPKT();
  const now = new Date();

  const [desksTotal, occupied, checkedIn, peopleTotal, overdue, pendingReviews, myTodos, todayBookings] =
    await Promise.all([
      prisma.desk.count({
        where: { status: "ACTIVE", ...(labFilter ? { labId: labFilter } : {}) },
      }),
      prisma.bookingOccurrence.count({
        where: {
          status: "SCHEDULED",
          deskId: { not: null },
          startsAt: { lte: now },
          endsAt: { gt: now },
          ...(labFilter ? { desk: { labId: labFilter } } : {}),
        },
      }),
      prisma.attendanceRecord.count({
        where: {
          date: today,
          checkIn: { not: null },
          ...(labFilter ? { user: { labId: labFilter } } : {}),
        },
      }),
      prisma.user.count({
        where: { status: "ACTIVE", ...(labFilter ? { labId: labFilter } : {}) },
      }),
      prisma.todo.count({
        where: {
          status: { not: "DONE" },
          endDate: { lt: today },
          ...(labFilter ? { project: { labId: labFilter } } : {}),
        },
      }),
      can(actor, "logbook.review")
        ? prisma.logEntry.count({
            where: { status: "SUBMITTED", ...(labFilter ? { user: { labId: labFilter } } : {}) },
          })
        : Promise.resolve(0),
      prisma.todo.findMany({
        where: { assigneeId: actor.id, status: { not: "DONE" } },
        include: { project: { select: { id: true, name: true } } },
        orderBy: { endDate: "asc" },
        take: 8,
      }),
      can(actor, "bookings.view_all")
        ? prisma.bookingOccurrence.findMany({
            where: {
              date: today,
              status: "SCHEDULED",
              ...(labFilter
                ? { OR: [{ desk: { labId: labFilter } }, { booking: { user: { labId: labFilter } } }] }
                : {}),
            },
            include: {
              desk: { select: { label: true } },
              booking: { select: { title: true, user: { select: { name: true } } } },
            },
            orderBy: { startsAt: "asc" },
            take: 12,
          })
        : Promise.resolve([]),
    ]);

  // ── extended data ──
  const trendStart = new Date(today);
  trendStart.setUTCDate(trendStart.getUTCDate() - 13);
  const [trendRecords, projects, activity, labsWithAttendance, myRecords, myWorking] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: {
        date: { gte: trendStart, lte: today },
        checkIn: { not: null },
        ...(labFilter ? { user: { labId: labFilter } } : {}),
      },
      select: { date: true },
    }),
    prisma.project.findMany({
      where: { ...(labFilter ? { labId: labFilter } : {}), status: { in: ["ACTIVE", "PLANNING"] } },
      select: {
        name: true,
        milestones: { select: { todos: { select: { status: true } } } },
      },
      take: 6,
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { actor: { select: { name: true } } },
    }),
    prisma.lab.count({
      where: { ...(labFilter ? { id: labFilter } : {}), attendanceMode: { not: "NONE" } },
    }),
    prisma.attendanceRecord.findMany({
      where: {
        userId: actor.id,
        date: { gte: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)), lte: today },
        checkIn: { not: null },
      },
      select: { date: true, workMode: true },
    }),
    (async () => {
      const me = await prisma.user.findUnique({
        where: { id: actor.id },
        select: {
          linkAttendanceToBooking: true,
          workingDayExceptions: { select: { date: true, recurrence: true } },
        },
      });
      if (!me) return [];
      const occs = await prisma.bookingOccurrence.findMany({
        where: {
          status: "SCHEDULED",
          date: { gte: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)), lte: today },
          booking: { userId: actor.id },
        },
        select: { date: true },
      });
      const { workingDaysInRange } = await import("@/lib/attendance");
      const y = today.getUTCFullYear();
      const m = String(today.getUTCMonth() + 1).padStart(2, "0");
      return workingDaysInRange(`${y}-${m}-01`, toISODate(today), {
        bookingDays: new Set(occs.map((o) => toISODate(o.date))),
        linkToBooking: me.linkAttendanceToBooking,
        exceptions: me.workingDayExceptions.map((e) => ({ date: toISODate(e.date), recurrence: e.recurrence })),
      });
    })(),
  ]);

  const trendMap = new Map<string, number>();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    trendMap.set(toISODate(d), 0);
  }
  for (const r of trendRecords) {
    const k = toISODate(r.date);
    trendMap.set(k, (trendMap.get(k) ?? 0) + 1);
  }
  const attendanceTrend = [...trendMap.entries()].map(([date, present]) => ({
    date: date.slice(5),
    present,
  }));

  const projectProgress = projects.map((pr) => {
    const todos = pr.milestones.flatMap((m) => m.todos);
    return { name: pr.name.length > 18 ? pr.name.slice(0, 18) + "…" : pr.name, done: todos.filter((t) => t.status === "DONE").length, total: todos.length };
  });

  const myPresent = new Set(myRecords.filter((r) => r.workMode !== "LEAVE").map((r) => toISODate(r.date))).size;
  const myMonthPct = myWorking.length ? Math.round((myPresent / myWorking.length) * 100) : null;

  return {
    desksOccupied: occupied,
    desksTotal,
    checkedInToday: checkedIn,
    peopleTotal,
    overdueTodos: overdue,
    pendingReviews,
    myTodos: myTodos.map((t) => ({
      id: t.id,
      title: t.title,
      projectName: t.project.name,
      projectId: t.project.id,
      endDate: t.endDate ? toISODate(t.endDate) : null,
      status: t.status,
    })),
    todayBookings: todayBookings.map((o) => ({
      id: o.id,
      personName: o.booking.user.name,
      deskLabel: o.desk?.label ?? null,
      timeStart: fmtTime(o.startsAt),
      timeEnd: fmtTime(o.endsAt),
      title: o.booking.title,
    })),
    canSeeBookings: hasPermission(actor, "bookings.view_all"),
    attendanceTrend,
    projectProgress,
    recentActivity: activity.map((a) => ({
      id: a.id,
      action: a.action,
      entity: a.entityType,
      at: a.createdAt.toISOString(),
      userName: a.actor?.name ?? "System",
    })),
    attendanceEnabled: labsWithAttendance > 0,
    myMonthPct,
  };
}
