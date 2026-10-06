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
  };
}
