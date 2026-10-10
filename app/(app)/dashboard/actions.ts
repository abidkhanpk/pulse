"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { can, scopeFilter, hasPermission } from "@/lib/permissions";
import { canViewAllProjects, myProjectIds, projectTeamUserIds } from "@/lib/project-access";
import { todayPKT, toISODate } from "@/lib/bookings";

export type DashboardMode = "full" | "team" | "personal";

export interface DashboardData {
  mode: DashboardMode;
  // personal (all modes)
  myTodos: { id: string; title: string; projectName: string; projectId: string; endDate: string | null; status: string }[];
  myBookingsToday: { id: string; deskLabel: string | null; timeStart: string; timeEnd: string; title: string | null }[];
  myMonthPct: number | null;
  myProjectsCount: number;
  // stats (meaning depends on mode)
  overdueTodos: number;
  pendingReviews: number;
  canReview: boolean;
  // full mode only
  desksOccupied: number;
  desksTotal: number;
  checkedInToday: number;
  peopleTotal: number;
  todayBookings: { id: string; personName: string; deskLabel: string | null; timeStart: string; timeEnd: string; title: string | null }[];
  canSeeBookings: boolean;
  canViewReports: boolean;
  // Per-lab desk occupation states for today (full mode only): how many
  // desks are still bookable all day, partly booked, fully booked, or
  // under maintenance — the admin/incharge planning glance.
  deskLabs: { labId: string; labName: string; total: number; freeAllDay: number; partlyBooked: number; fullyBooked: number; maintenance: number }[];
  // team mode only
  teamCheckedInToday: number;
  teamSize: number;
  // charts & lists (scoped per mode)
  attendanceTrend: { date: string; present: number }[];
  attendanceTrendTitle: string;
  projectProgress: { name: string; done: number; total: number }[];
  recentActivity: { id: string; action: string; entity: string; at: string; userName: string }[];
  attendanceEnabled: boolean;
}

function fmtTime(iso: Date): string {
  return iso.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Karachi" });
}

function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setUTCDate(c.getUTCDate() + n);
  return c;
}

function buildTrend(today: Date, records: { date: Date }[]): { date: string; present: number }[] {
  const trendMap = new Map<string, number>();
  for (let i = 13; i >= 0; i--) {
    trendMap.set(toISODate(addDays(today, -i)), 0);
  }
  for (const r of records) {
    const k = toISODate(r.date);
    if (trendMap.has(k)) trendMap.set(k, (trendMap.get(k) ?? 0) + 1);
  }
  return [...trendMap.entries()].map(([date, present]) => ({ date, present }));
}

function toProgress(
  projects: { name: string; milestones: { todos: { status: string }[] }[] }[],
): { name: string; done: number; total: number }[] {
  return projects.map((pr) => {
    const todos = pr.milestones.flatMap((m) => m.todos);
    return {
      name: pr.name.length > 18 ? pr.name.slice(0, 18) + "…" : pr.name,
      done: todos.filter((t) => t.status === "DONE").length,
      total: todos.length,
    };
  });
}

function toActivity(
  activity: { id: string; action: string; entityType: string; createdAt: Date; actor: { name: string } | null }[],
): { id: string; action: string; entity: string; at: string; userName: string }[] {
  return activity.map((a) => ({
    id: a.id,
    action: a.action,
    entity: a.entityType,
    at: a.createdAt.toISOString(),
    userName: a.actor?.name ?? "System",
  }));
}

export async function dashboardData(): Promise<DashboardData> {
  const actor = await requireUser();
  const labIds = scopeFilter(actor);
  const labFilter = labIds ? { in: labIds } : undefined;
  const today = todayPKT();
  const now = new Date();

  const viewAll = canViewAllProjects(actor);
  const reviewer = can(actor, "logbook.review");
  const mode: DashboardMode = viewAll ? "full" : reviewer ? "team" : "personal";

  const myPids = viewAll ? null : await myProjectIds(actor);
  const teamIds = mode === "team" ? await projectTeamUserIds(actor) : null;

  // ── shared: my todos, my bookings today, my month attendance ──
  const [myTodos, myOccs, labsWithAttendance, myRecords, myWorking] = await Promise.all([
    prisma.todo.findMany({
      where: { assigneeId: actor.id, status: { not: "DONE" } },
      include: { project: { select: { id: true, name: true } } },
      orderBy: { endDate: "asc" },
      take: 8,
    }),
    prisma.bookingOccurrence.findMany({
      where: { date: today, status: "SCHEDULED", booking: { userId: actor.id } },
      include: { desk: { select: { label: true } }, booking: { select: { title: true } } },
      orderBy: { startsAt: "asc" },
      take: 8,
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

  const myPresent = new Set(myRecords.filter((r) => r.workMode !== "LEAVE").map((r) => toISODate(r.date))).size;
  const myMonthPct = myWorking.length ? Math.round((myPresent / myWorking.length) * 100) : null;

  const todoView = myTodos.map((t) => ({
    id: t.id,
    title: t.title,
    projectName: t.project.name,
    projectId: t.project.id,
    endDate: t.endDate ? toISODate(t.endDate) : null,
    status: t.status,
  }));
  const myBookingsToday = myOccs.map((o) => ({
    id: o.id,
    deskLabel: o.desk?.label ?? null,
    timeStart: fmtTime(o.startsAt),
    timeEnd: fmtTime(o.endsAt),
    title: o.booking.title,
  }));
  const attendanceEnabled = labsWithAttendance > 0;

  // ── personal mode (internee): only their own world ──
  if (mode === "personal") {
    const [myOverdue, projects, trendRecords, activity] = await Promise.all([
      prisma.todo.count({
        where: { assigneeId: actor.id, status: { not: "DONE" }, endDate: { lt: today } },
      }),
      prisma.project.findMany({
        where: { id: { in: myPids ?? [] }, status: { in: ["ACTIVE", "PLANNING"] } },
        select: { name: true, milestones: { select: { todos: { select: { status: true } } } } },
        take: 12,
      }),
      prisma.attendanceRecord.findMany({
        where: { userId: actor.id, date: { gte: addDays(today, -13), lte: today }, checkIn: { not: null } },
        select: { date: true },
      }),
      prisma.auditLog.findMany({
        where: { actorId: actor.id },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { actor: { select: { name: true } } },
      }),
    ]);
    return {
      mode,
      myTodos: todoView,
      myBookingsToday,
      myMonthPct,
      myProjectsCount: (myPids ?? []).length,
      overdueTodos: myOverdue,
      pendingReviews: 0,
      canReview: false,
      desksOccupied: 0,
      desksTotal: 0,
      checkedInToday: 0,
      peopleTotal: 0,
      todayBookings: [],
      canSeeBookings: false,
      canViewReports: false,
      teamCheckedInToday: 0,
      teamSize: 0,
      deskLabs: [],
      attendanceTrend: buildTrend(today, trendRecords),
      attendanceTrendTitle: "My attendance — last 14 days",
      projectProgress: toProgress(projects),
      recentActivity: toActivity(activity),
      attendanceEnabled,
    };
  }

  // ── team mode (supervisor): me + my projects + project teams ──
  if (mode === "team") {
    const team = teamIds ?? [actor.id];
    const [overdue, pendingReviews, teamCheckedIn, projects, trendRecords, activity] = await Promise.all([
      prisma.todo.count({
        where: { status: { not: "DONE" }, endDate: { lt: today }, projectId: { in: myPids ?? [] } },
      }),
      prisma.logEntry.count({
        where: { status: "SUBMITTED", deletedAt: null, userId: { in: team } },
      }),
      prisma.attendanceRecord.count({
        where: { date: today, checkIn: { not: null }, userId: { in: team } },
      }),
      prisma.project.findMany({
        where: { id: { in: myPids ?? [] }, status: { in: ["ACTIVE", "PLANNING"] } },
        select: { name: true, milestones: { select: { todos: { select: { status: true } } } } },
        take: 12,
      }),
      prisma.attendanceRecord.findMany({
        where: { userId: { in: team }, date: { gte: addDays(today, -13), lte: today }, checkIn: { not: null } },
        select: { date: true },
      }),
      prisma.auditLog.findMany({
        where: { actorId: { in: team } },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { actor: { select: { name: true } } },
      }),
    ]);
    return {
      mode,
      myTodos: todoView,
      myBookingsToday,
      myMonthPct,
      myProjectsCount: (myPids ?? []).length,
      overdueTodos: overdue,
      pendingReviews,
      canReview: true,
      desksOccupied: 0,
      desksTotal: 0,
      checkedInToday: 0,
      peopleTotal: 0,
      todayBookings: [],
      canSeeBookings: false,
      canViewReports: hasPermission(actor, "attendance.view_reports"),
      teamCheckedInToday: teamCheckedIn,
      teamSize: team.length,
      deskLabs: [],
      attendanceTrend: buildTrend(today, trendRecords),
      attendanceTrendTitle: "Team attendance — last 14 days",
      projectProgress: toProgress(projects),
      recentActivity: toActivity(activity),
      attendanceEnabled,
    };
  }

  // ── full mode (admin / lab incharge): lab- or org-wide overview ──
  const [desksTotal, occupied, checkedIn, peopleTotal, overdue, pendingReviews, todayBookings, trendRecords, projects, activity] =
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
            where: { status: "SUBMITTED", deletedAt: null, ...(labFilter ? { user: { labId: labFilter } } : {}) },
          })
        : Promise.resolve(0),
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
      prisma.attendanceRecord.findMany({
        where: {
          date: { gte: addDays(today, -13), lte: today },
          checkIn: { not: null },
          ...(labFilter ? { user: { labId: labFilter } } : {}),
        },
        select: { date: true },
      }),
      prisma.project.findMany({
        where: { ...(labFilter ? { labId: labFilter } : {}), status: { in: ["ACTIVE", "PLANNING"] } },
        select: { name: true, milestones: { select: { todos: { select: { status: true } } } } },
        take: 6,
      }),
      prisma.auditLog.findMany({
        // Scoped: org-wide for global admins; otherwise only events by actors in
        // the viewer's labs (actorless system events are excluded for them).
        where: labFilter ? { actor: { labId: labFilter } } : {},
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { actor: { select: { name: true } } },
      }),
    ]);

  // Per-lab desk occupation states for today (interval-merged booked
  // minutes per desk): 0 = free all day, >= 8h booked = fully booked.
  const deskLabs = await (async () => {
    const [labs, desks, occs] = await Promise.all([
      prisma.lab.findMany({
        where: { ...(labFilter ? { id: labFilter } : {}) },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.desk.findMany({
        where: { ...(labFilter ? { labId: labFilter } : {}) },
        select: { id: true, labId: true, status: true },
      }),
      prisma.bookingOccurrence.findMany({
        where: { date: today, status: "SCHEDULED", deskId: { not: null }, ...(labFilter ? { desk: { labId: labFilter } } : {}) },
        select: { deskId: true, startsAt: true, endsAt: true },
      }),
    ]);
    const minutes = new Map<string, number>();
    const byDesk = new Map<string, { s: number; e: number }[]>();
    for (const o of occs) {
      if (!o.deskId) continue;
      const arr = byDesk.get(o.deskId) ?? [];
      arr.push({ s: o.startsAt.getTime(), e: o.endsAt.getTime() });
      byDesk.set(o.deskId, arr);
    }
    for (const [deskId, ivs] of byDesk) {
      ivs.sort((a, b) => a.s - b.s);
      let total = 0, curS = -1, curE = -1;
      for (const iv of ivs) {
        if (iv.s > curE) { if (curE > curS) total += curE - curS; curS = iv.s; curE = iv.e; }
        else if (iv.e > curE) curE = iv.e;
      }
      if (curE > curS) total += curE - curS;
      minutes.set(deskId, Math.round(total / 60000));
    }
    return labs.map((lab) => {
      const mine = desks.filter((d) => d.labId === lab.id);
      let freeAllDay = 0, partlyBooked = 0, fullyBooked = 0, maintenance = 0;
      for (const d of mine) {
        if (d.status === "MAINTENANCE") { maintenance++; continue; }
        const m = minutes.get(d.id) ?? 0;
        if (m === 0) freeAllDay++;
        else if (m >= 480) fullyBooked++;
        else partlyBooked++;
      }
      return { labId: lab.id, labName: lab.name, total: mine.length, freeAllDay, partlyBooked, fullyBooked, maintenance };
    }).filter((l) => l.total > 0);
  })();

  return {
    mode,
    myTodos: todoView,
    myBookingsToday,
    myMonthPct,
    myProjectsCount: 0,
    overdueTodos: overdue,
    pendingReviews,
    canReview: can(actor, "logbook.review"),
    desksOccupied: occupied,
    desksTotal,
    checkedInToday: checkedIn,
    peopleTotal,
    todayBookings: todayBookings.map((o) => ({
      id: o.id,
      personName: o.booking.user.name,
      deskLabel: o.desk?.label ?? null,
      timeStart: fmtTime(o.startsAt),
      timeEnd: fmtTime(o.endsAt),
      title: o.booking.title,
    })),
    canSeeBookings: hasPermission(actor, "bookings.view_all"),
    canViewReports: hasPermission(actor, "attendance.view_reports"),
    deskLabs,
    teamCheckedInToday: 0,
    teamSize: 0,
    attendanceTrend: buildTrend(today, trendRecords),
    attendanceTrendTitle: "Attendance — last 14 days",
    projectProgress: toProgress(projects),
    recentActivity: toActivity(activity),
    attendanceEnabled,
  };
}
