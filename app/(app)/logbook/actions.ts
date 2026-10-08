"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma, type LogStatus, type RevisionKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { can, scopeFilter, type PermissionKey } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { todayPKT, toISODate } from "@/lib/bookings";
import type { ActionResult } from "../labs/actions";

function deny(perm: PermissionKey) {
  return { ok: false as const, error: `You don't have permission (${perm}).` };
}

export interface EntryFilters {
  from?: string;
  to?: string;
  projectId?: string;
  userId?: string;
  status?: "DRAFT" | "SUBMITTED" | "REVIEWED";
  search?: string;
  mineOnly?: boolean;
  /** Reviewers can opt into seeing soft-deleted entries. Owners always see their own. */
  includeDeleted?: boolean;
}

/**
 * List entries: own always; others' only with logbook.review (scoped to labs).
 * Soft-deleted entries are hidden by default, except the owner's own (shown
 * greyed so they can be restored or inspected).
 */
export async function listEntries(filters: EntryFilters = {}) {
  const actor = await requireUser();
  const reviewer = can(actor, "logbook.review");
  const labIds = scopeFilter(actor);

  const where: Record<string, unknown> = {};
  if (filters.mineOnly || !reviewer) {
    where.userId = actor.id;
    // own deleted entries stay visible to the owner (greyed, restorable)
  } else {
    if (filters.userId) {
      where.userId = filters.userId;
    } else if (labIds) {
      where.user = { labId: { in: labIds } };
    }
    if (!filters.includeDeleted) where.deletedAt = null;
  }
  if (filters.from) where.date = { ...(where.date as object ?? {}), gte: new Date(filters.from + "T00:00:00Z") };
  if (filters.to) where.date = { ...(where.date as object ?? {}), lte: new Date(filters.to + "T00:00:00Z") };
  if (filters.projectId) where.projectId = filters.projectId;
  if (filters.status) where.status = filters.status;
  if (filters.search) {
    where.OR = [
      { summary: { contains: filters.search, mode: "insensitive" } },
      { details: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return prisma.logEntry.findMany({
    where: where as never,
    include: {
      user: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
      reviewedBy: { select: { id: true, name: true } },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 200,
  });
}

/** Review queue: SUBMITTED entries in the actor's scope. */
export async function reviewQueue() {
  const actor = await requireUser();
  if (!can(actor, "logbook.review")) return [];
  const labIds = scopeFilter(actor);
  return prisma.logEntry.findMany({
    where: {
      status: "SUBMITTED",
      deletedAt: null,
      ...(labIds ? { user: { labId: { in: labIds } } } : {}),
    },
    include: {
      user: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
      reviewedBy: { select: { id: true, name: true } },
    },
    orderBy: [{ date: "asc" }],
    take: 200,
  });
}

const entrySchema = z.object({
  projectId: z.string().min(1).nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  summary: z.string().trim().min(1).max(300),
  details: z.string().trim().max(5000).optional().nullable(),
  // Optional revision note ("what changed?" / delete reason), stored on the revision.
  note: z.string().trim().max(500).optional().nullable(),
});

/** Snapshot shape stored on every revision: the entry as it looked after the change. */
interface EntrySnapshot {
  summary: string;
  details: string | null;
  projectId: string | null;
  projectName: string | null;
  date: Date;
  status: LogStatus;
}

/**
 * Append a revision inside a transaction. Numbers revisions sequentially per
 * entry and keeps LogEntry.revisionCount in sync. Must run inside $transaction.
 */
async function recordRevision(
  tx: Prisma.TransactionClient,
  entryId: string,
  kind: RevisionKind,
  snapshot: EntrySnapshot,
  actor: { id: string; name: string },
  note?: string | null,
): Promise<void> {
  const last = await tx.logEntryRevision.findFirst({
    where: { entryId },
    orderBy: { revisionNo: "desc" },
    select: { revisionNo: true },
  });
  const revisionNo = (last?.revisionNo ?? 0) + 1;
  await tx.logEntryRevision.create({
    data: {
      entryId,
      revisionNo,
      kind,
      summary: snapshot.summary,
      details: snapshot.details,
      projectId: snapshot.projectId,
      projectName: snapshot.projectName,
      date: snapshot.date,
      status: snapshot.status,
      actorId: actor.id,
      actorName: actor.name,
      note: note?.trim() || null,
    },
  });
  await tx.logEntry.update({ where: { id: entryId }, data: { revisionCount: revisionNo } });
}

function snapshotOf(row: {
  summary: string;
  details: string | null;
  projectId: string | null;
  project: { name: string } | null;
  date: Date;
  status: LogStatus;
}): EntrySnapshot {
  return {
    summary: row.summary,
    details: row.details,
    projectId: row.projectId,
    projectName: row.project?.name ?? null,
    date: row.date,
    status: row.status,
  };
}

export async function createEntry(input: z.infer<typeof entrySchema>): Promise<ActionResult<{ id: string }>> {
  const actor = await requireUser();
  const parsed = entrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Summary and date are required." };
  const date = new Date(parsed.data.date + "T00:00:00Z");
  const projectId = parsed.data.projectId || null;
  const dup = await prisma.logEntry.findFirst({
    where: { userId: actor.id, date, projectId, deletedAt: null },
  });
  if (dup) return { ok: false, error: "You already have an entry for this day and project." };
  const entry = await prisma.$transaction(async (tx) => {
    const created = await tx.logEntry.create({
      data: {
        userId: actor.id,
        projectId,
        date,
        summary: parsed.data.summary,
        details: parsed.data.details || null,
        status: "DRAFT",
      },
      include: { project: { select: { name: true } } },
    });
    await recordRevision(tx, created.id, "CREATED", snapshotOf(created), actor);
    return created;
  });
  await logAudit(actor.id, "logbook.created", "LogEntry", entry.id, { date: parsed.data.date });
  revalidatePath("/logbook");
  return { ok: true, data: { id: entry.id } };
}

export async function updateEntry(id: string, input: z.infer<typeof entrySchema>): Promise<ActionResult> {
  const actor = await requireUser();
  const parsed = entrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Summary and date are required." };
  const existing = await prisma.logEntry.findUnique({
    where: { id },
    include: { project: { select: { name: true } } },
  });
  if (!existing) return { ok: false, error: "Entry not found." };
  if (existing.userId !== actor.id) return { ok: false, error: "You can only edit your own entries." };
  if (existing.deletedAt) return { ok: false, error: "This entry is deleted. Restore it before editing." };
  if (existing.status === "REVIEWED") return { ok: false, error: "Reviewed entries cannot be edited." };
  const dup = await prisma.logEntry.findFirst({
    where: {
      userId: actor.id,
      date: new Date(parsed.data.date + "T00:00:00Z"),
      projectId: parsed.data.projectId || null,
      deletedAt: null,
      id: { not: id },
    },
  });
  if (dup) return { ok: false, error: "You already have an entry for this day and project." };
  await prisma.$transaction(async (tx) => {
    const updated = await tx.logEntry.update({
      where: { id },
      data: {
        projectId: parsed.data.projectId || null,
        date: new Date(parsed.data.date + "T00:00:00Z"),
        summary: parsed.data.summary,
        details: parsed.data.details || null,
      },
      include: { project: { select: { name: true } } },
    });
    await recordRevision(tx, id, "EDITED", snapshotOf(updated), actor, parsed.data.note);
  });
  await logAudit(actor.id, "logbook.updated", "LogEntry", id, {});
  revalidatePath("/logbook");
  return { ok: true };
}

export async function submitEntry(id: string): Promise<ActionResult> {
  const actor = await requireUser();
  const existing = await prisma.logEntry.findUnique({
    where: { id },
    include: { project: { select: { name: true } } },
  });
  if (!existing) return { ok: false, error: "Entry not found." };
  if (existing.userId !== actor.id) return { ok: false, error: "You can only submit your own entries." };
  if (existing.deletedAt) return { ok: false, error: "This entry is deleted." };
  if (existing.status !== "DRAFT") return { ok: false, error: "Only drafts can be submitted." };
  await prisma.$transaction(async (tx) => {
    const updated = await tx.logEntry.update({
      where: { id },
      data: { status: "SUBMITTED" },
      include: { project: { select: { name: true } } },
    });
    await recordRevision(tx, id, "SUBMITTED", snapshotOf(updated), actor);
  });
  await logAudit(actor.id, "logbook.submitted", "LogEntry", id, {});
  revalidatePath("/logbook");
  return { ok: true };
}

export async function deleteEntry(id: string, reason?: string | null): Promise<ActionResult> {
  const actor = await requireUser();
  const existing = await prisma.logEntry.findUnique({
    where: { id },
    include: { project: { select: { name: true } } },
  });
  if (!existing) return { ok: false, error: "Entry not found." };
  if (existing.userId !== actor.id) return { ok: false, error: "You can only delete your own entries." };
  if (existing.deletedAt) return { ok: false, error: "Entry is already deleted." };
  if (existing.status !== "DRAFT") return { ok: false, error: "Only drafts can be deleted." };
  // Soft delete: the entry (and its history) is preserved; deletion itself is a revision.
  await prisma.$transaction(async (tx) => {
    const updated = await tx.logEntry.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: { project: { select: { name: true } } },
    });
    await recordRevision(tx, id, "DELETED", snapshotOf(updated), actor, reason);
  });
  await logAudit(actor.id, "logbook.deleted", "LogEntry", id, { reason: reason?.trim() || null });
  revalidatePath("/logbook");
  return { ok: true };
}

/** Restore a soft-deleted entry. Owner, or a reviewer in scope. */
export async function restoreEntry(id: string): Promise<ActionResult> {
  const actor = await requireUser();
  const existing = await prisma.logEntry.findUnique({
    where: { id },
    include: { user: { select: { labId: true } }, project: { select: { name: true } } },
  });
  if (!existing) return { ok: false, error: "Entry not found." };
  if (!existing.deletedAt) return { ok: false, error: "Entry is not deleted." };
  const reviewer = can(actor, "logbook.review");
  const isOwner = existing.userId === actor.id;
  if (!isOwner) {
    if (!reviewer) return deny("logbook.review");
    if (existing.user.labId && !can(actor, "logbook.review", existing.user.labId)) return deny("logbook.review");
  }
  await prisma.$transaction(async (tx) => {
    const updated = await tx.logEntry.update({
      where: { id },
      data: { deletedAt: null },
      include: { project: { select: { name: true } } },
    });
    await recordRevision(tx, id, "RESTORED", snapshotOf(updated), actor);
  });
  await logAudit(actor.id, "logbook.restored", "LogEntry", id, {});
  revalidatePath("/logbook");
  return { ok: true };
}

export interface RevisionView {
  id: string;
  revisionNo: number;
  kind: RevisionKind;
  summary: string;
  details: string | null;
  projectName: string | null;
  date: string;
  status: LogStatus;
  actorName: string;
  note: string | null;
  createdAt: string;
}

/**
 * Full revision history of one entry, oldest first.
 * Visible to the entry's owner and to reviewers (lab-scoped) — including
 * deleted entries, so a deletion never hides the story.
 */
export async function getRevisions(entryId: string): Promise<RevisionView[]> {
  const actor = await requireUser();
  const entry = await prisma.logEntry.findUnique({
    where: { id: entryId },
    include: { user: { select: { labId: true } } },
  });
  if (!entry) throw new Error("Entry not found.");
  const isOwner = entry.userId === actor.id;
  const reviewer = can(actor, "logbook.review");
  if (!isOwner) {
    if (!reviewer) throw new Error("You don't have permission to view this history.");
    if (entry.user.labId && !can(actor, "logbook.review", entry.user.labId)) {
      throw new Error("You don't have permission to view this history.");
    }
  }
  const rows = await prisma.logEntryRevision.findMany({
    where: { entryId },
    orderBy: { revisionNo: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    revisionNo: r.revisionNo,
    kind: r.kind,
    summary: r.summary,
    details: r.details,
    projectName: r.projectName,
    date: r.date.toISOString().slice(0, 10),
    status: r.status,
    actorName: r.actorName,
    note: r.note,
    createdAt: r.createdAt.toISOString(),
  }));
}

const reviewSchema = z.object({
  id: z.string().min(1),
  approved: z.boolean(),
  comment: z.string().trim().max(1000).optional().nullable(),
});

export async function reviewEntry(input: z.infer<typeof reviewSchema>): Promise<ActionResult> {
  const actor = await requireUser();
  if (!can(actor, "logbook.review")) return deny("logbook.review");
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid review." };
  const existing = await prisma.logEntry.findUnique({
    where: { id: parsed.data.id },
    include: { user: { select: { labId: true } }, project: { select: { name: true } } },
  });
  if (!existing) return { ok: false, error: "Entry not found." };
  if (existing.deletedAt) return { ok: false, error: "This entry is deleted." };
  if (existing.status !== "SUBMITTED") return { ok: false, error: "Only submitted entries can be reviewed." };
  if (existing.user.labId && !can(actor, "logbook.review", existing.user.labId)) return deny("logbook.review");
  await prisma.$transaction(async (tx) => {
    const updated = await tx.logEntry.update({
      where: { id: parsed.data.id },
      data: {
        status: parsed.data.approved ? "REVIEWED" : "DRAFT",
        reviewedById: parsed.data.approved ? actor.id : null,
        reviewedAt: parsed.data.approved ? new Date() : null,
        reviewComment: parsed.data.comment || null,
      },
      include: { project: { select: { name: true } } },
    });
    await recordRevision(
      tx,
      parsed.data.id,
      parsed.data.approved ? "REVIEWED" : "RETURNED",
      snapshotOf(updated),
      actor,
      parsed.data.comment,
    );
  });
  await logAudit(actor.id, parsed.data.approved ? "logbook.reviewed" : "logbook.returned", "LogEntry", parsed.data.id, {
    comment: parsed.data.comment || null,
  });
  revalidatePath("/logbook");
  return { ok: true };
}

/** Projects the user can attach entries to (member of, or in scope). */
export async function entryProjects() {
  const actor = await requireUser();
  const labIds = scopeFilter(actor);
  return prisma.project.findMany({
    where: {
      status: "ACTIVE",
      ...(labIds ? { labId: { in: labIds } } : {}),
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 200,
  });
}

/** People with entries (for the review filter). */
export async function entryPeople() {
  const actor = await requireUser();
  if (!can(actor, "logbook.review")) return [];
  const labIds = scopeFilter(actor);
  const users = await prisma.logEntry.findMany({
    where: labIds ? { user: { labId: { in: labIds } } } : {},
    select: { user: { select: { id: true, name: true } } },
    distinct: ["userId"],
  });
  const map = new Map<string, string>();
  for (const u of users) map.set(u.user.id, u.user.name);
  return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

export interface DigestDay {
  date: string;
  entries: { id: string; userName: string; projectName: string | null; summary: string; status: string }[];
}

/** Weekly digest: entries grouped by day for the reviewer's scope. */
export async function weeklyDigest(weekStart: string): Promise<DigestDay[]> {
  const actor = await requireUser();
  if (!can(actor, "logbook.review")) return [];
  const labIds = scopeFilter(actor);
  const start = new Date(weekStart + "T00:00:00Z");
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const entries = await prisma.logEntry.findMany({
    where: {
      date: { gte: start, lte: end },
      deletedAt: null,
      ...(labIds ? { user: { labId: { in: labIds } } } : {}),
    },
    include: {
      user: { select: { name: true } },
      project: { select: { name: true } },
    },
    orderBy: [{ date: "asc" }, { user: { name: "asc" } }],
  });
  const days: DigestDay[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    const iso = toISODate(d);
    days.push({
      date: iso,
      entries: entries
        .filter((e) => toISODate(e.date) === iso)
        .map((e) => ({
          id: e.id,
          userName: e.user.name,
          projectName: e.project?.name ?? null,
          summary: e.summary,
          status: e.status,
        })),
    });
  }
  return days;
}
