"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { can, scopeFilter, type PermissionKey } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import {
  createBooking,
  updateBookingRule,
  cancelOccurrence,
  cancelFutureOccurrences,
  BookingConflictError,
  type BookingRuleInput,
} from "@/lib/bookings";
import type { ActionResult } from "../labs/actions";

function deny(perm: PermissionKey) {
  return { ok: false as const, error: `You don't have permission (${perm}).` };
}

// ─── Desks ───

export async function listDesks(labId?: string) {
  const actor = await requireUser();
  if (!can(actor, "bookings.view_all") && !can(actor, "desks.manage")) return [];
  const labIds = scopeFilter(actor);
  return prisma.desk.findMany({
    where: {
      ...(labId ? { labId } : labIds ? { labId: { in: labIds } } : {}),
    },
    include: { lab: { select: { id: true, name: true } } },
    orderBy: { label: "asc" },
  });
}

const deskSchema = z.object({
  labId: z.string().min(1),
  label: z.string().trim().min(1).max(60),
  notes: z.string().trim().max(300).optional().nullable(),
});

export async function createDesk(input: z.infer<typeof deskSchema>): Promise<ActionResult<{ id: string }>> {
  const actor = await requireUser();
  if (!can(actor, "desks.manage", input.labId)) return deny("desks.manage");
  const parsed = deskSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Lab and label are required." };
  const dup = await prisma.desk.findUnique({
    where: { labId_label: { labId: parsed.data.labId, label: parsed.data.label } },
  });
  if (dup) return { ok: false, error: `Desk ${parsed.data.label} already exists in this lab.` };
  const desk = await prisma.desk.create({
    data: { labId: parsed.data.labId, label: parsed.data.label, notes: parsed.data.notes ?? null },
  });
  await logAudit(actor.id, "desk.created", "Desk", desk.id, { label: desk.label, labId: desk.labId });
  revalidatePath("/desks");
  return { ok: true, data: { id: desk.id } };
}

export async function updateDesk(
  id: string,
  input: z.infer<typeof deskSchema>
): Promise<ActionResult> {
  const actor = await requireUser();
  const desk = await prisma.desk.findUnique({ where: { id } });
  if (!desk) return { ok: false, error: "Desk not found." };
  if (!can(actor, "desks.manage", desk.labId)) return deny("desks.manage");
  const parsed = deskSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Lab and label are required." };
  if (!can(actor, "desks.manage", parsed.data.labId)) return deny("desks.manage");
  await prisma.desk.update({
    where: { id },
    data: { labId: parsed.data.labId, label: parsed.data.label, notes: parsed.data.notes ?? null },
  });
  await logAudit(actor.id, "desk.updated", "Desk", id, { label: parsed.data.label });
  revalidatePath("/desks");
  return { ok: true };
}

export async function setDeskStatus(id: string, status: "ACTIVE" | "MAINTENANCE"): Promise<ActionResult> {
  const actor = await requireUser();
  const desk = await prisma.desk.findUnique({ where: { id } });
  if (!desk) return { ok: false, error: "Desk not found." };
  if (!can(actor, "desks.manage", desk.labId)) return deny("desks.manage");
  await prisma.desk.update({ where: { id }, data: { status } });
  await logAudit(actor.id, "desk.status_changed", "Desk", id, { status });
  revalidatePath("/desks");
  return { ok: true };
}

export async function deleteDesk(id: string): Promise<ActionResult> {
  const actor = await requireUser();
  const desk = await prisma.desk.findUnique({
    where: { id },
    include: { _count: { select: { bookings: true } } },
  });
  if (!desk) return { ok: false, error: "Desk not found." };
  if (!can(actor, "desks.manage", desk.labId)) return deny("desks.manage");
  if (desk._count.bookings > 0) {
    return { ok: false, error: "Cannot delete a desk with bookings — set it to maintenance instead." };
  }
  await prisma.desk.delete({ where: { id } });
  await logAudit(actor.id, "desk.deleted", "Desk", id, { label: desk.label });
  revalidatePath("/desks");
  return { ok: true };
}

// ─── Bookings ───

const bookingInputSchema = z.object({
  userId: z.string().min(1),
  type: z.enum(["DESK", "REMOTE"]),
  deskId: z.string().min(1).optional().nullable(),
  title: z.string().trim().max(160).optional().nullable(),
  projectId: z.string().min(1).optional().nullable(),
  timeStart: z.string().regex(/^\d{2}:\d{2}$/),
  timeEnd: z.string().regex(/^\d{2}:\d{2}$/),
  isRecurring: z.boolean(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)),
  validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  validTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  trackAttendance: z.boolean().optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

type BookingInput = z.infer<typeof bookingInputSchema>;

function toRuleInput(input: BookingInput, createdById: string): BookingRuleInput {
  return {
    userId: input.userId,
    type: input.type,
    deskId: input.deskId ?? null,
    title: input.title ?? null,
    projectId: input.projectId ?? null,
    timeStart: input.timeStart,
    timeEnd: input.timeEnd,
    isRecurring: input.isRecurring,
    daysOfWeek: input.daysOfWeek,
    validFrom: new Date(input.validFrom + "T00:00:00Z"),
    validTo: input.validTo ? new Date(input.validTo + "T00:00:00Z") : null,
    trackAttendance: input.trackAttendance ?? null,
    notes: input.notes ?? null,
    createdById,
  };
}

async function bookingLabScope(input: BookingInput): Promise<string | null> {
  // Resolve the lab for scoping: desk's lab, or the user's home lab for REMOTE.
  if (input.type === "DESK" && input.deskId) {
    const desk = await prisma.desk.findUnique({ where: { id: input.deskId }, select: { labId: true } });
    return desk?.labId ?? null;
  }
  const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { labId: true } });
  return user?.labId ?? null;
}

export async function createBookingAction(input: BookingInput): Promise<ActionResult<{ id: string }>> {
  const actor = await requireUser();
  const parsed = bookingInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid booking data." };
  const labId = await bookingLabScope(parsed.data);
  if (!labId || !can(actor, "bookings.manage", labId)) return deny("bookings.manage");
  try {
    const booking = await createBooking(toRuleInput(parsed.data, actor.id));
    await logAudit(actor.id, "booking.created", "Booking", booking.id, {
      userId: parsed.data.userId,
      deskId: parsed.data.deskId ?? null,
      type: parsed.data.type,
    });
    revalidatePath("/desks");
    return { ok: true, data: { id: booking.id } };
  } catch (e) {
    if (e instanceof BookingConflictError) return { ok: false, error: e.message };
    return { ok: false, error: e instanceof Error ? e.message : "Could not create booking." };
  }
}

export async function updateBookingAction(id: string, input: BookingInput): Promise<ActionResult> {
  const actor = await requireUser();
  const parsed = bookingInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid booking data." };
  const existing = await prisma.booking.findUnique({
    where: { id },
    include: { desk: { select: { labId: true } }, user: { select: { labId: true } } },
  });
  if (!existing) return { ok: false, error: "Booking not found." };
  const oldLab = existing.desk?.labId ?? existing.user.labId;
  if (!oldLab || !can(actor, "bookings.manage", oldLab)) return deny("bookings.manage");
  const newLab = await bookingLabScope(parsed.data);
  if (!newLab || !can(actor, "bookings.manage", newLab)) return deny("bookings.manage");
  try {
    await updateBookingRule(id, toRuleInput(parsed.data, actor.id));
    await logAudit(actor.id, "booking.updated", "Booking", id, {});
    revalidatePath("/desks");
    return { ok: true };
  } catch (e) {
    if (e instanceof BookingConflictError) return { ok: false, error: e.message };
    return { ok: false, error: e instanceof Error ? e.message : "Could not update booking." };
  }
}

export async function cancelOccurrenceAction(id: string, note?: string): Promise<ActionResult> {
  const actor = await requireUser();
  const occ = await prisma.bookingOccurrence.findUnique({
    where: { id },
    include: { desk: { select: { labId: true } }, booking: { include: { user: { select: { labId: true } } } } },
  });
  if (!occ) return { ok: false, error: "Booking not found." };
  const labId = occ.desk?.labId ?? occ.booking.user.labId;
  if (!labId || !can(actor, "bookings.manage", labId)) return deny("bookings.manage");
  await cancelOccurrence(id, note);
  await logAudit(actor.id, "booking.occurrence_cancelled", "BookingOccurrence", id, { note: note ?? null });
  revalidatePath("/desks");
  return { ok: true };
}

export async function cancelBookingAction(id: string, note?: string): Promise<ActionResult> {
  const actor = await requireUser();
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { desk: { select: { labId: true } }, user: { select: { labId: true } } },
  });
  if (!booking) return { ok: false, error: "Booking not found." };
  const labId = booking.desk?.labId ?? booking.user.labId;
  if (!labId || !can(actor, "bookings.manage", labId)) return deny("bookings.manage");
  await cancelFutureOccurrences(id, note);
  await logAudit(actor.id, "booking.cancelled", "Booking", id, { note: note ?? null });
  revalidatePath("/desks");
  return { ok: true };
}

export async function getBooking(id: string) {
  const actor = await requireUser();
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, labId: true } },
      desk: { select: { id: true, label: true, labId: true } },
      project: { select: { id: true, name: true } },
    },
  });
  if (!booking) return null;
  const labId = booking.desk?.labId ?? booking.user.labId ?? null;
  if (!labId || !can(actor, "bookings.manage", labId)) return null;
  return booking;
}

// ─── Reads ───

export interface OccurrenceRange {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  labId?: string;
}

/** Scheduled occurrences in a date range, for the week grid / day timeline. */
export async function listOccurrences({ from, to, labId }: OccurrenceRange) {
  const actor = await requireUser();
  if (!can(actor, "bookings.view_all") && !can(actor, "bookings.manage")) return [];
  const labIds = scopeFilter(actor);
  const fromDate = new Date(from + "T00:00:00Z");
  const toDate = new Date(to + "T00:00:00Z");
  return prisma.bookingOccurrence.findMany({
    where: {
      date: { gte: fromDate, lte: toDate },
      status: "SCHEDULED",
      ...(labId
        ? { desk: { labId } }
        : labIds
          ? { OR: [{ desk: { labId: { in: labIds } } }, { booking: { user: { labId: { in: labIds } } } }] }
          : {}),
    },
    include: {
      desk: { select: { id: true, label: true, labId: true } },
      booking: {
        select: {
          id: true,
          type: true,
          title: true,
          user: { select: { id: true, name: true, labId: true } },
        },
      },
    },
    orderBy: [{ date: "asc" }, { startsAt: "asc" }],
  });
}

/** The signed-in user's own upcoming bookings (read-only view). */
export async function myBookings() {
  const actor = await requireUser();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return prisma.bookingOccurrence.findMany({
    where: { booking: { userId: actor.id }, date: { gte: today }, status: "SCHEDULED" },
    include: { desk: { select: { label: true } } },
    orderBy: [{ date: "asc" }, { startsAt: "asc" }],
    take: 30,
  });
}

/** People bookable in a lab (active users). */
export async function bookablePeople(labId: string) {
  const actor = await requireUser();
  if (!can(actor, "bookings.manage", labId)) return [];
  return prisma.user.findMany({
    where: { status: "ACTIVE", OR: [{ labId }, { inchargeOf: { some: { labId } } }] },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
    take: 200,
  });
}

/** Active people across the actor's scope (for the booking drawer). */
export async function bookablePeopleAll(labId?: string) {
  const actor = await requireUser();
  if (!can(actor, "bookings.manage")) return [];
  const labIds = scopeFilter(actor);
  return prisma.user.findMany({
    where: {
      status: "ACTIVE",
      ...(labId ? { OR: [{ labId }, { inchargeOf: { some: { labId } } }] } : labIds ? { OR: [{ labId: { in: labIds } }, { inchargeOf: { some: { labId: { in: labIds } } } }] } : {}),
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 300,
  });
}

/** Active projects in scope (for the booking drawer). */
export async function bookableProjects(labId?: string) {
  const actor = await requireUser();
  if (!can(actor, "bookings.manage")) return [];
  const labIds = scopeFilter(actor);
  return prisma.project.findMany({
    where: {
      status: "ACTIVE",
      ...(labId ? { labId } : labIds ? { labId: { in: labIds } } : {}),
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 200,
  });
}
