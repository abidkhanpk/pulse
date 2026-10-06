import { prisma } from "./prisma";

/** Asia/Karachi is UTC+5 year-round (no DST). */
export const PKT_OFFSET_MINUTES = 5 * 60;

export class BookingConflictError extends Error {
  deskLabel: string;
  date: string;
  timeStart: string;
  timeEnd: string;
  constructor(deskLabel: string, date: string, timeStart: string, timeEnd: string) {
    super(
      `Desk ${deskLabel} is already booked ${timeStart}–${timeEnd} on ${date}.`
    );
    this.name = "BookingConflictError";
    this.deskLabel = deskLabel;
    this.date = date;
    this.timeStart = timeStart;
    this.timeEnd = timeEnd;
  }
}

/** Combine a calendar day (Date at UTC midnight) with "HH:mm" in PKT → timestamptz. */
export function pktDateTime(day: Date, time: string): Date {
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    throw new Error(`Invalid time "${time}" — expected HH:mm`);
  }
  const utc = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), h, m);
  return new Date(utc - PKT_OFFSET_MINUTES * 60 * 1000);
}

/** Today as a UTC-midnight Date for the PKT calendar day. */
export function todayPKT(): Date {
  const now = new Date(Date.now() + PKT_OFFSET_MINUTES * 60 * 1000);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Format a UTC-midnight date as YYYY-MM-DD. */
export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export interface BookingRuleInput {
  userId: string;
  type: "DESK" | "REMOTE";
  deskId?: string | null;
  title?: string | null;
  projectId?: string | null;
  timeStart: string;
  timeEnd: string;
  isRecurring: boolean;
  daysOfWeek: number[];
  validFrom: Date;
  validTo?: Date | null;
  trackAttendance?: boolean | null;
  notes?: string | null;
  createdById: string;
}

export interface ExpandedOccurrence {
  date: Date;
  startsAt: Date;
  endsAt: Date;
}

const MAX_RECURRING_DAYS = 366;

/** Expand a booking rule into concrete occurrences (no DB access — pure). */
export function expandOccurrences(rule: BookingRuleInput): ExpandedOccurrence[] {
  if (rule.timeStart >= rule.timeEnd) {
    throw new Error("End time must be after start time.");
  }
  const days: Date[] = [];
  if (!rule.isRecurring) {
    days.push(rule.validFrom);
  } else {
    if (!rule.daysOfWeek.length) throw new Error("Pick at least one weekday for a recurring booking.");
    const end = rule.validTo ?? rule.validFrom;
    const totalDays = Math.round((end.getTime() - rule.validFrom.getTime()) / 86400000);
    if (totalDays < 0) throw new Error("Valid-until must be on or after valid-from.");
    if (totalDays > MAX_RECURRING_DAYS) {
      throw new Error(`Recurring bookings are limited to ${MAX_RECURRING_DAYS} days per rule — extend it later.`);
    }
    const cursor = new Date(rule.validFrom);
    while (cursor <= end) {
      if (rule.daysOfWeek.includes(cursor.getUTCDay())) days.push(new Date(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  return days.map((date) => ({
    date,
    startsAt: pktDateTime(date, rule.timeStart),
    endsAt: pktDateTime(date, rule.timeEnd),
  }));
}

/**
 * Create a booking + materialize occurrences in one transaction.
 * Throws BookingConflictError when the desk is already taken.
 */
export async function createBooking(rule: BookingRuleInput) {
  if (rule.type === "DESK") {
    if (!rule.deskId) throw new Error("A desk booking needs a desk.");
    const desk = await prisma.desk.findUnique({ where: { id: rule.deskId } });
    if (!desk) throw new Error("Desk not found.");
    if (desk.status !== "ACTIVE") throw new Error(`Desk ${desk.label} is under maintenance.`);
  }

  const occurrences = expandOccurrences(rule);

  // Best-effort pre-check for a friendly conflict message (the exclusion
  // constraint remains the final guard inside the transaction).
  if (rule.type === "DESK" && rule.deskId) {
    for (const occ of occurrences) {
      const clash = await prisma.bookingOccurrence.findFirst({
        where: {
          deskId: rule.deskId,
          status: "SCHEDULED",
          startsAt: { lt: occ.endsAt },
          endsAt: { gt: occ.startsAt },
        },
        include: { desk: true },
      });
      if (clash) {
        throw new BookingConflictError(
          clash.desk?.label ?? "?",
          toISODate(occ.date),
          rule.timeStart,
          rule.timeEnd
        );
      }
    }
  }

  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.create({
      data: {
        userId: rule.userId,
        type: rule.type,
        deskId: rule.type === "DESK" ? rule.deskId : null,
        title: rule.title ?? null,
        projectId: rule.projectId ?? null,
        timeStart: rule.timeStart,
        timeEnd: rule.timeEnd,
        isRecurring: rule.isRecurring,
        daysOfWeek: rule.isRecurring ? rule.daysOfWeek : [],
        validFrom: rule.validFrom,
        validTo: rule.isRecurring ? (rule.validTo ?? null) : null,
        trackAttendance: rule.trackAttendance ?? null,
        notes: rule.notes ?? null,
        createdById: rule.createdById,
      },
    });
    try {
      await tx.bookingOccurrence.createMany({
        data: occurrences.map((occ) => ({
          bookingId: booking.id,
          deskId: rule.type === "DESK" ? rule.deskId! : null,
          date: occ.date,
          startsAt: occ.startsAt,
          endsAt: occ.endsAt,
          status: "SCHEDULED" as const,
        })),
      });
    } catch (e) {
      // Exclusion-constraint violation (Postgres 23P01) — rethrow as conflict.
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("no_double_booking") || msg.includes("23P01")) {
        throw new BookingConflictError("?", "?", rule.timeStart, rule.timeEnd);
      }
      throw e;
    }
    return booking;
  });
}

/** Cancel a single occurrence (exception to a recurring rule). */
export async function cancelOccurrence(occurrenceId: string, note?: string) {
  return prisma.bookingOccurrence.update({
    where: { id: occurrenceId },
    data: { status: "CANCELLED", cancelNote: note ?? null },
  });
}

/** Cancel all future occurrences of a booking from today (PKT) onward. */
export async function cancelFutureOccurrences(bookingId: string, note?: string) {
  const today = todayPKT();
  return prisma.bookingOccurrence.updateMany({
    where: { bookingId, date: { gte: today }, status: "SCHEDULED" },
    data: { status: "CANCELLED", cancelNote: note ?? null },
  });
}

/**
 * Regenerate FUTURE occurrences after a rule edit. Past occurrences are never rewritten.
 * Throws BookingConflictError on clashes.
 */
export async function updateBookingRule(bookingId: string, rule: BookingRuleInput) {
  const today = todayPKT();
  const occurrences = expandOccurrences(rule).filter((o) => o.date >= today);

  if (rule.type === "DESK" && rule.deskId) {
    for (const occ of occurrences) {
      const clash = await prisma.bookingOccurrence.findFirst({
        where: {
          deskId: rule.deskId,
          status: "SCHEDULED",
          bookingId: { not: bookingId },
          startsAt: { lt: occ.endsAt },
          endsAt: { gt: occ.startsAt },
        },
        include: { desk: true },
      });
      if (clash) {
        throw new BookingConflictError(
          clash.desk?.label ?? "?",
          toISODate(occ.date),
          rule.timeStart,
          rule.timeEnd
        );
      }
    }
  }

  return prisma.$transaction(async (tx) => {
    await tx.bookingOccurrence.deleteMany({
      where: { bookingId, date: { gte: today } },
    });
    const booking = await tx.booking.update({
      where: { id: bookingId },
      data: {
        type: rule.type,
        deskId: rule.type === "DESK" ? rule.deskId : null,
        title: rule.title ?? null,
        projectId: rule.projectId ?? null,
        timeStart: rule.timeStart,
        timeEnd: rule.timeEnd,
        isRecurring: rule.isRecurring,
        daysOfWeek: rule.isRecurring ? rule.daysOfWeek : [],
        validFrom: rule.validFrom,
        validTo: rule.isRecurring ? (rule.validTo ?? null) : null,
        trackAttendance: rule.trackAttendance ?? null,
        notes: rule.notes ?? null,
      },
    });
    await tx.bookingOccurrence.createMany({
      data: occurrences.map((occ) => ({
        bookingId: booking.id,
        deskId: rule.type === "DESK" ? rule.deskId! : null,
        date: occ.date,
        startsAt: occ.startsAt,
        endsAt: occ.endsAt,
        status: "SCHEDULED" as const,
      })),
    });
    return booking;
  });
}

/** ISO date (YYYY-MM-DD) of the Monday of the current PKT week. */
export function thisWeekMonday(): string {
  const today = todayPKT();
  const dow = today.getUTCDay();
  const delta = (dow + 6) % 7;
  const monday = new Date(today);
  monday.setUTCDate(monday.getUTCDate() - delta);
  return toISODate(monday);
}
