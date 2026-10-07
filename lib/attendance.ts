import type { AttendanceMode, Recurrence } from "@prisma/client";

export type { AttendanceMode };

export const ATTENDANCE_MODES: { id: AttendanceMode; label: string; hint: string }[] = [
  { id: "SELF", label: "Self check-in", hint: "Members check themselves in/out" },
  { id: "MANUAL", label: "Manual marking", hint: "Incharge or designated person marks attendance" },
  { id: "NONE", label: "No attendance", hint: "Attendance disabled for this lab" },
];

export interface WorkingDayInput {
  /** YYYY-MM-DD dates with at least one booking occurrence (when linked). */
  bookingDays: Set<string>;
  linkToBooking: boolean;
  exceptions: { date: string; recurrence: Recurrence }[];
}

function isoOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDaysIso(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return isoOf(d);
}

function diffDays(aIso: string, bIso: string): number {
  return Math.round(
    (new Date(bIso + "T00:00:00Z").getTime() - new Date(aIso + "T00:00:00Z").getTime()) / 86400000
  );
}

/**
 * All working-day dates (YYYY-MM-DD) for a user inside [fromIso, toIso]:
 * booking-linked days + extra working days (with recurrence expansion).
 */
export function workingDaysInRange(
  fromIso: string,
  toIso: string,
  input: WorkingDayInput
): string[] {
  const days = new Set<string>();

  if (input.linkToBooking) {
    for (const d of input.bookingDays) {
      if (d >= fromIso && d <= toIso) days.add(d);
    }
  }

  for (const ex of input.exceptions) {
    if (ex.recurrence === "ONCE") {
      if (ex.date >= fromIso && ex.date <= toIso) days.add(ex.date);
      continue;
    }
    // Recurring: first occurrence on/after fromIso that aligns with ex.date.
    let cur = ex.date < fromIso ? fromIso : ex.date;
    if (ex.recurrence === "WEEKLY" || ex.recurrence === "BIWEEKLY") {
      const step = ex.recurrence === "WEEKLY" ? 7 : 14;
      if (cur > ex.date) {
        const delta = diffDays(ex.date, cur);
        const skip = Math.ceil(delta / step);
        cur = addDaysIso(ex.date, skip * step);
      }
      while (cur <= toIso) {
        days.add(cur);
        cur = addDaysIso(cur, step);
      }
    } else {
      // MONTHLY: same day-of-month, starting at ex.date.
      const dayOfMonth = Number(ex.date.slice(8, 10));
      let y = Number(fromIso.slice(0, 4));
      let m = Number(fromIso.slice(5, 7));
      // advance to first month on/after both fromIso and ex.date's month
      const exY = Number(ex.date.slice(0, 4));
      const exM = Number(ex.date.slice(5, 7));
      if (y * 12 + m < exY * 12 + exM) {
        y = exY;
        m = exM;
      }
      for (;;) {
        const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
        const dd = Math.min(dayOfMonth, lastDay);
        const iso = `${y}-${String(m).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
        if (iso > toIso) break;
        if (iso >= fromIso && iso >= ex.date) days.add(iso);
        m++;
        if (m > 12) {
          m = 1;
          y++;
        }
      }
    }
  }

  return [...days].sort();
}

/** Effective attendance mode for a user: personal override wins, else lab mode. */
export function effectiveMode(
  userOverride: AttendanceMode | null,
  labMode: AttendanceMode
): AttendanceMode {
  return userOverride ?? labMode;
}
