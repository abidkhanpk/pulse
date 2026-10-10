"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { can, scopeFilter, type PermissionKey } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { resolveAmenityLabels, type AmenityOption } from "@/lib/amenities";

/** The admin-managed amenity catalogue. */
export async function listAmenities(): Promise<AmenityOption[]> {
  await requireUser();
  const rows = await prisma.deskAmenity.findMany({ orderBy: { label: "asc" } });
  return rows.map((r) => ({ id: r.id, label: r.label }));
}

async function amenityCatalogue(): Promise<AmenityOption[]> {
  const rows = await prisma.deskAmenity.findMany({ select: { id: true, label: true } });
  return rows;
}

/** Keep only ids that exist in the catalogue. */
async function validAmenityIds(ids: string[] | undefined | null): Promise<string[]> {
  if (!ids || ids.length === 0) return [];
  const valid = new Set((await amenityCatalogue()).map((a) => a.id));
  return ids.filter((id) => valid.has(id));
}

export async function createAmenity(label: string): Promise<ActionResult<{ items: AmenityOption[] }>> {
  const actor = await requireUser();
  if (!can(actor, "org.manage")) return deny("org.manage");
  const clean = label.trim().replace(/\s+/g, " ");
  if (!clean || clean.length > 40) return { ok: false, error: "Amenity name must be 1–40 characters." };
  const dup = await prisma.deskAmenity.findUnique({ where: { label: clean } });
  if (dup) return { ok: false, error: `"${clean}" already exists.` };
  await prisma.deskAmenity.create({ data: { label: clean } });
  await logAudit(actor.id, "desk.amenity_created", "DeskAmenity", clean, { label: clean });
  revalidatePath("/desks");
  return { ok: true, data: { items: await listAmenities() } };
}

/** Rename an amenity in place — desks reference it by id, so the new name shows everywhere it is used. */
export async function updateAmenity(id: string, label: string): Promise<ActionResult<{ items: AmenityOption[] }>> {
  const actor = await requireUser();
  if (!can(actor, "org.manage")) return deny("org.manage");
  const clean = label.trim().replace(/\s+/g, " ");
  if (!clean || clean.length > 40) return { ok: false, error: "Amenity name must be 1–40 characters." };
  const existing = await prisma.deskAmenity.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Amenity not found." };
  const dup = await prisma.deskAmenity.findUnique({ where: { label: clean } });
  if (dup && dup.id !== id) return { ok: false, error: `"${clean}" already exists.` };
  await prisma.deskAmenity.update({ where: { id }, data: { label: clean } });
  await logAudit(actor.id, "desk.amenity_renamed", "DeskAmenity", id, { from: existing.label, to: clean });
  revalidatePath("/desks");
  return { ok: true, data: { items: await listAmenities() } };
}

export async function deleteAmenity(id: string): Promise<ActionResult<{ items: AmenityOption[] }>> {
  const actor = await requireUser();
  if (!can(actor, "org.manage")) return deny("org.manage");
  const amenity = await prisma.deskAmenity.findUnique({ where: { id } });
  if (!amenity) return { ok: false, error: "Amenity not found." };
  // Remove the amenity and scrub it from every desk that lists it.
  const affected = await prisma.desk.findMany({ where: { amenities: { has: id } }, select: { id: true, amenities: true } });
  await prisma.$transaction([
    ...affected.map((d) =>
      prisma.desk.update({ where: { id: d.id }, data: { amenities: d.amenities.filter((a) => a !== id) } })
    ),
    prisma.deskAmenity.delete({ where: { id } }),
  ]);
  await logAudit(actor.id, "desk.amenity_deleted", "DeskAmenity", id, { label: amenity.label, desksScrubbed: affected.length });
  revalidatePath("/desks");
  return { ok: true, data: { items: await listAmenities() } };
}
import {
  createBooking,
  todayPKT,
  toISODate,
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
  layoutLabel: z.string().trim().max(20).optional().nullable(),
  notes: z.string().trim().max(300).optional().nullable(),
  markerShape: z.enum(["CIRCLE", "SQUARE", "ROUNDED"]).optional(),
  amenities: z.array(z.string().max(30)).max(20).optional(),
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
    data: {
      labId: parsed.data.labId,
      label: parsed.data.label,
      layoutLabel: parsed.data.layoutLabel?.trim() || null,
      notes: parsed.data.notes ?? null,
      amenities: await validAmenityIds(parsed.data.amenities),
    },
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
    data: {
      labId: parsed.data.labId,
      label: parsed.data.label,
      // Layout label changes only when the caller sends it (the layout
      // editor) — editing a desk elsewhere must not wipe it.
      ...(parsed.data.layoutLabel !== undefined ? { layoutLabel: parsed.data.layoutLabel?.trim() || null } : {}),
      notes: parsed.data.notes ?? null,
      ...(parsed.data.markerShape ? { markerShape: parsed.data.markerShape } : {}),
      ...(parsed.data.amenities ? { amenities: await validAmenityIds(parsed.data.amenities) } : {}),
    },
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
      desk: { select: { id: true, label: true, labId: true, amenities: true } },
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
  const rows = await prisma.bookingOccurrence.findMany({
    where: {
      date: { gte: fromDate, lte: toDate },
      status: "SCHEDULED",
      ...(labId
        ? { OR: [{ desk: { labId } }, { booking: { user: { labId } } }] }
        : labIds
          ? { OR: [{ desk: { labId: { in: labIds } } }, { booking: { user: { labId: { in: labIds } } } }] }
          : {}),
    },
    include: {
      desk: { select: { id: true, label: true, labId: true, amenities: true } },
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
  // Resolve desk amenity ids to labels for tooltips.
  const catalogue = await amenityCatalogue();
  return rows.map((o) => ({
    ...o,
    desk: o.desk ? { ...o.desk, amenities: resolveAmenityLabels(o.desk.amenities, catalogue) } : null,
  }));
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

export interface DeskLabOverview {
  labId: string;
  labName: string;
  deskCount: number;
  occupiedNow: number;
  bookingsToday: number;
}

/** Per-lab desk stats for the admin overview. */
export async function deskLabOverview(): Promise<DeskLabOverview[]> {
  const actor = await requireUser();
  const labIds = scopeFilter(actor);
  const today = todayPKT();
  const now = new Date();
  const labs = await prisma.lab.findMany({
    where: labIds ? { id: { in: labIds } } : undefined,
    orderBy: { name: "asc" },
  });
  return Promise.all(
    labs.map(async (lab) => {
      const [deskCount, occupiedNow, bookingsToday] = await Promise.all([
        prisma.desk.count({ where: { labId: lab.id, status: "ACTIVE" } }),
        prisma.bookingOccurrence.count({
          where: {
            status: "SCHEDULED",
            deskId: { not: null },
            startsAt: { lte: now },
            endsAt: { gt: now },
            desk: { labId: lab.id },
          },
        }),
        prisma.bookingOccurrence.count({
          where: { date: today, status: "SCHEDULED", desk: { labId: lab.id } },
        }),
      ]);
      return { labId: lab.id, labName: lab.name, deskCount, occupiedNow, bookingsToday };
    })
  );
}

// ─── Floorplan ───

const floorplanUploadSchema = z.object({
  labId: z.string().min(1),
  dataUrl: z.string().min(1).max(8_000_000), // ~6MB image
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

/**
 * Upload (or replace) a lab's floorplan image. One image per lab —
 * uploading replaces the previous one.
 */
export async function uploadFloorplan(input: z.infer<typeof floorplanUploadSchema>): Promise<ActionResult> {
  const actor = await requireUser();
  const parsed = floorplanUploadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid image." };
  if (!can(actor, "desks.manage", parsed.data.labId)) return { ok: false, error: "You don't have permission (desks.manage)." };
  const m = /^data:(image\/(png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(parsed.data.dataUrl);
  if (!m) return { ok: false, error: "Image must be PNG, JPEG or WebP." };
  const buf = Buffer.from(m[3], "base64");
  if (buf.length > 6 * 1024 * 1024) return { ok: false, error: "Image is too large (max 6 MB)." };
  await prisma.floorplanImage.upsert({
    where: { labId: parsed.data.labId },
    update: { data: buf, mimeType: m[1], width: parsed.data.width ?? null, height: parsed.data.height ?? null },
    create: {
      labId: parsed.data.labId,
      data: buf,
      mimeType: m[1],
      width: parsed.data.width ?? null,
      height: parsed.data.height ?? null,
    },
  });
  await logAudit(actor.id, "lab.floorplan_uploaded", "Lab", parsed.data.labId, { mimeType: m[1] });
  revalidatePath("/desks");
  return { ok: true };
}

export async function deleteFloorplan(labId: string): Promise<ActionResult> {
  const actor = await requireUser();
  if (!can(actor, "desks.manage", labId)) return { ok: false, error: "You don't have permission (desks.manage)." };
  await prisma.floorplanImage.deleteMany({ where: { labId } });
  await logAudit(actor.id, "lab.floorplan_deleted", "Lab", labId, {});
  revalidatePath("/desks");
  return { ok: true };
}

export async function floorplanMeta(labId: string) {
  const actor = await requireUser();
  if (!can(actor, "desks.manage", labId)) return null;
  const img = await prisma.floorplanImage.findUnique({
    where: { labId },
    select: { id: true, mimeType: true, width: true, height: true, updatedAt: true },
  });
  return img;
}

const positionsSchema = z.object({
  labId: z.string().min(1),
  // xPct/yPct null = station removed from the layout (coordinates cleared).
  positions: z.array(
    z.object({ id: z.string().min(1), xPct: z.number().min(0).max(100).nullable(), yPct: z.number().min(0).max(100).nullable() })
  ),
});

/** Persist station positions on the floorplan canvas (null clears the position). */
export async function saveDeskPositions(input: z.infer<typeof positionsSchema>): Promise<ActionResult> {
  const actor = await requireUser();
  const parsed = positionsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid positions." };
  if (!can(actor, "desks.manage", parsed.data.labId)) return { ok: false, error: "You don't have permission (desks.manage)." };
  await prisma.$transaction(
    parsed.data.positions.map((p) =>
      prisma.desk.updateMany({ where: { id: p.id, labId: parsed.data.labId }, data: { xPct: p.xPct, yPct: p.yPct } })
    )
  );
  await logAudit(actor.id, "lab.floorplan_layout", "Lab", parsed.data.labId, { count: parsed.data.positions.length });
  revalidatePath("/desks");
  return { ok: true };
}

const shapesSchema = z.object({
  labId: z.string().min(1),
  shapes: z.array(
    z.object({
      kind: z.enum(["WALL", "ZONE", "RECTANGLE", "CIRCLE", "POLYGON", "TEXT"]),
      xPct: z.number().min(0).max(100),
      yPct: z.number().min(0).max(100),
      wPct: z.number().min(0.5).max(100),
      hPct: z.number().min(0.5).max(100),
      label: z.string().max(200).nullable().optional(),
      color: z.string().max(20).nullable().optional(),
      points: z
        .array(z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) }))
        .nullable()
        .optional(),
      filled: z.boolean().optional(),
      fontSize: z.number().min(0.5).max(10).nullable().optional(),
      fontFamily: z.string().max(20).nullable().optional(),
      bold: z.boolean().optional(),
      italic: z.boolean().optional(),
    })
  ),
});

/** Replace all walls/zones on a lab's floorplan. */
export async function saveFloorplanShapes(input: z.infer<typeof shapesSchema>): Promise<ActionResult> {
  const actor = await requireUser();
  const parsed = shapesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid shapes." };
  if (!can(actor, "desks.manage", parsed.data.labId)) return { ok: false, error: "You don't have permission (desks.manage)." };
  await prisma.$transaction(async (tx) => {
    await tx.floorplanShape.deleteMany({ where: { labId: parsed.data.labId } });
    if (parsed.data.shapes.length) {
      await tx.floorplanShape.createMany({
        data: parsed.data.shapes.map((sh) => ({
          labId: parsed.data.labId,
          kind: sh.kind,
          xPct: sh.xPct,
          yPct: sh.yPct,
          wPct: sh.wPct,
          hPct: sh.hPct,
          label: sh.label?.trim() || null,
          color: sh.color || null,
          points: sh.points ?? undefined,
          filled: sh.filled ?? true,
          fontSize: sh.fontSize ?? null,
          fontFamily: sh.fontFamily ?? null,
          bold: sh.bold ?? false,
          italic: sh.italic ?? false,
        })),
      });
    }
  });
  revalidatePath("/desks");
  return { ok: true };
}

/** Full floorplan payload for the editor / layout view. */
export async function getFloorplan(labId: string) {
  const actor = await requireUser();
  if (!can(actor, "bookings.view_all", labId) && !can(actor, "desks.manage", labId)) {
    // Regular members can still see the layout for their own lab via booking view.
    const me = await prisma.user.findUnique({ where: { id: actor.id }, select: { labId: true } });
    if (me?.labId !== labId) return null;
  }
  const [img, desks, shapes] = await Promise.all([
    prisma.floorplanImage.findUnique({ where: { labId }, select: { id: true, updatedAt: true } }),
    prisma.desk.findMany({
      where: { labId },
      select: { id: true, label: true, layoutLabel: true, status: true, xPct: true, yPct: true, markerShape: true, amenities: true },
      orderBy: { label: "asc" },
    }),
    prisma.floorplanShape.findMany({ where: { labId } }),
  ]);
  const catalogue = await amenityCatalogue();
  return {
    hasImage: !!img,
    imageUrl: img ? `/api/floorplan/${labId}?v=${img.updatedAt.getTime()}` : null,
    desks: desks.map((d) => ({ ...d, amenities: resolveAmenityLabels(d.amenities, catalogue) })),
    shapes: shapes.map((sh) => ({
      id: sh.id,
      kind: sh.kind,
      xPct: sh.xPct,
      yPct: sh.yPct,
      wPct: sh.wPct,
      hPct: sh.hPct,
      label: sh.label,
      color: sh.color,
      points: (sh.points as { x: number; y: number }[] | null) ?? null,
      filled: sh.filled,
      fontSize: sh.fontSize,
      fontFamily: sh.fontFamily,
      bold: sh.bold,
      italic: sh.italic,
    })),
  };
}

/** Live per-desk occupancy for the layout view. */
export async function layoutOccupancy(labId: string) {
  const actor = await requireUser();
  const me = await prisma.user.findUnique({ where: { id: actor.id }, select: { labId: true } });
  const allowed = me?.labId === labId || can(actor, "bookings.view_all", labId);
  if (!allowed) return [];
  const now = new Date();
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const occs = await prisma.bookingOccurrence.findMany({
    where: { status: "SCHEDULED", date: dayStart, desk: { labId } },
    select: {
      deskId: true,
      startsAt: true,
      endsAt: true,
      booking: { select: { user: { select: { name: true } }, title: true } },
    },
  });
  return occs.map((o) => {
    const s = o.startsAt.getTime();
    const e = o.endsAt.getTime();
    const n = now.getTime();
    return {
      deskId: o.deskId,
      occupiedNow: s <= n && e > n,
      upcoming: s > n,
      personName: o.booking.user.name,
      title: o.booking.title,
      timeStart: o.startsAt.toISOString(),
      timeEnd: o.endsAt.toISOString(),
    };
  });
}

/* ───────────────────────── Availability finder ─────────────────────────
 * Answers "which desks are free for this whole pattern" exactly, from
 * materialized occurrences. A day counts as available when the desk is
 * continuously free from some start time inside [windowStart,
 * windowStart + tolerance] until windowEnd (user decision 2026-10-10:
 * a desk free from 9:00 against an 8:00 request with 1h tolerance IS
 * available, reported with its actual start). Admins and the lab's
 * incharges only. */

export interface AvailabilityInput {
  labId: string;
  from: string; // YYYY-MM-DD
  to: string;
  weekdays: number[] | null; // null = every day in range
  startTime: string; // "HH:MM" (PKT)
  endTime: string;
  toleranceMin: number;
  amenityIds: string[];
  horizonMonths: number; // how far ahead "next available" may look
}

export interface AvailabilityBlockerDay {
  date: string;
  bookings: { person: string; title: string | null; startMin: number; endMin: number }[];
}

export interface AvailabilityDesk {
  id: string;
  label: string;
  layoutLabel: string | null;
  amenities: { id: string; label: string }[];
  /** Full matches: latest actual free-from minute when later than the
   *  requested window start on some days; null = free from window start. */
  lateFromMin: number | null;
  blockedDays: AvailabilityBlockerDay[];
}

export interface AvailabilityResult {
  requestedDays: number;
  full: AvailabilityDesk[];
  near: AvailabilityDesk[];
  next: { desk: AvailabilityDesk; fromDate: string; toDate: string }[];
}

function parseISODate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
}
function isoOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDaysISO(iso: string, days: number): string {
  const d = parseISODate(iso)!;
  d.setUTCDate(d.getUTCDate() + days);
  return isoOf(d);
}
function addMonthsISO(iso: string, months: number): string {
  const d = parseISODate(iso)!;
  d.setUTCMonth(d.getUTCMonth() + months);
  return isoOf(d);
}
function parseTimeMin(s: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const v = +m[1] * 60 + +m[2];
  return v >= 0 && v < 1440 ? v : null;
}
/** PKT wall-clock minutes of a timestamp (PKT is a fixed UTC+5). */
function pktMinutes(ts: Date): number {
  const shifted = new Date(ts.getTime() + 5 * 3600_000);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

export async function findAvailability(
  input: AvailabilityInput
): Promise<{ ok: true; data: AvailabilityResult } | { ok: false; error: string }> {
  const actor = await requireUser();
  const allowed = can(actor, "org.manage") || actor.inchargeOf.some((l) => l.labId === input.labId);
  if (!allowed) return { ok: false, error: "Only admins and the lab incharge can search availability." };

  const from = parseISODate(input.from);
  const to = parseISODate(input.to);
  const winStart = parseTimeMin(input.startTime);
  const winEnd = parseTimeMin(input.endTime);
  if (!from || !to || to < from) return { ok: false, error: "Pick a valid date range." };
  if (winStart === null || winEnd === null || winEnd <= winStart)
    return { ok: false, error: "Pick a valid time window (end after start)." };
  const tolerance = Math.max(0, Math.min(600, Math.round(input.toleranceMin || 0)));
  const horizonMonths = [1, 3, 6, 12].includes(input.horizonMonths) ? input.horizonMonths : 6;

  const matchesPattern = (iso: string): boolean => {
    if (!input.weekdays || input.weekdays.length === 0) return true;
    return input.weekdays.includes(parseISODate(iso)!.getUTCDay());
  };
  const requested: string[] = [];
  for (let d = input.from; d <= input.to; d = addDaysISO(d, 1)) {
    if (matchesPattern(d)) requested.push(d);
  }
  if (requested.length === 0)
    return { ok: false, error: "No days in that range match the selected pattern." };
  const spanDays = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;

  const catalogue = await amenityCatalogue();
  const labelOf = new Map(catalogue.map((a) => [a.id, a.label]));
  const required = await validAmenityIds(input.amenityIds);

  const desks = await prisma.desk.findMany({
    where: { labId: input.labId, status: "ACTIVE" },
    select: { id: true, label: true, layoutLabel: true, amenities: true },
    orderBy: { label: "asc" },
  });
  const candidates = desks.filter((d) => required.every((id) => d.amenities.includes(id)));
  if (candidates.length === 0) {
    return { ok: true, data: { requestedDays: requested.length, full: [], near: [], next: [] } };
  }

  const todayIso = isoOf(new Date(Date.now() + 5 * 3600_000));
  const scanStart = input.from < todayIso ? todayIso : input.from;
  const horizonEnd = addMonthsISO(scanStart, horizonMonths);
  const fetchEnd = input.to > horizonEnd ? input.to : horizonEnd;

  const occs = await prisma.bookingOccurrence.findMany({
    where: {
      deskId: { in: candidates.map((d) => d.id) },
      status: "SCHEDULED",
      date: { gte: from, lte: parseISODate(fetchEnd)! },
    },
    select: {
      deskId: true,
      date: true,
      startsAt: true,
      endsAt: true,
      booking: { select: { title: true, user: { select: { name: true } } } },
    },
  });
  type Iv = { s: number; e: number; person: string; title: string | null };
  const byKey = new Map<string, Iv[]>();
  for (const o of occs) {
    if (!o.deskId) continue;
    const key = `${o.deskId}|${isoOf(o.date)}`;
    const s = pktMinutes(o.startsAt);
    let e = pktMinutes(o.endsAt);
    if (e <= s) e = 1440; // defensive: booking crossing midnight
    const arr = byKey.get(key) ?? [];
    arr.push({ s, e, person: o.booking.user.name, title: o.booking.title });
    byKey.set(key, arr);
  }
  for (const arr of byKey.values()) arr.sort((a, b) => a.s - b.s);

  /** Earliest minute the desk becomes continuously free until winEnd. */
  function freeFrom(deskId: string, iso: string): number {
    const ivs = byKey.get(`${deskId}|${iso}`) ?? [];
    let free = winStart!;
    for (const iv of ivs) {
      if (iv.e <= free) continue;
      if (iv.s >= winEnd!) break;
      free = Math.max(free, iv.e);
      if (free >= winEnd!) break;
    }
    return free;
  }
  const dayOk = (deskId: string, iso: string): { ok: boolean; from: number } => {
    const f = freeFrom(deskId, iso);
    return { ok: f < winEnd! && f <= winStart! + tolerance, from: f };
  };

  const toDesk = (d: (typeof candidates)[number], lateFromMin: number | null, blockedDays: AvailabilityBlockerDay[]): AvailabilityDesk => ({
    id: d.id,
    label: d.label,
    layoutLabel: d.layoutLabel,
    amenities: d.amenities.map((id) => ({ id, label: labelOf.get(id) ?? id })),
    lateFromMin,
    blockedDays,
  });

  const full: AvailabilityDesk[] = [];
  const near: AvailabilityDesk[] = [];
  const next: { desk: AvailabilityDesk; fromDate: string; toDate: string }[] = [];

  for (const d of candidates) {
    let late: number | null = null;
    const blocked: AvailabilityBlockerDay[] = [];
    for (const iso of requested) {
      const r = dayOk(d.id, iso);
      if (r.ok) {
        if (r.from > winStart!) late = late === null ? r.from : Math.max(late, r.from);
      } else {
        const ivs = (byKey.get(`${d.id}|${iso}`) ?? []).filter((iv) => iv.e > winStart! && iv.s < winEnd!);
        blocked.push({
          date: iso,
          bookings: ivs.map((iv) => ({ person: iv.person, title: iv.title, startMin: iv.s, endMin: iv.e })),
        });
      }
    }
    if (blocked.length === 0) {
      full.push(toDesk(d, late, []));
      continue;
    }
    if (blocked.length <= 3) near.push(toDesk(d, null, blocked));

    // Next available: first start date whose whole shifted window passes.
    const lastStart = addDaysISO(horizonEnd, -(spanDays - 1));
    for (let start = scanStart; start <= lastStart; start = addDaysISO(start, 1)) {
      let okAll = true;
      for (let i = 0; i < spanDays; i++) {
        const iso = addDaysISO(start, i);
        if (!matchesPattern(iso)) continue;
        if (!dayOk(d.id, iso).ok) { okAll = false; break; }
      }
      if (okAll) {
        next.push({ desk: toDesk(d, null, []), fromDate: start, toDate: addDaysISO(start, spanDays - 1) });
        break;
      }
    }
  }

  return { ok: true, data: { requestedDays: requested.length, full, near, next } };
}
