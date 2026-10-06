"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth-helpers";

export interface AuditRow {
  id: string;
  createdAt: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  actorName: string | null;
  details: string | null;
}

export interface AuditFilters {
  action: string;
  entityType: string;
  from: string;
  to: string;
}

const ACTIONS = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "ASSIGN",
  "UNASSIGN",
  "CHECK_IN",
  "CHECK_OUT",
  "CANCEL",
  "APPROVE",
  "RETURN",
  "SUBMIT",
  "PASSWORD_RESET",
  "ACTIVATE",
  "DEACTIVATE",
];

const ENTITY_TYPES = [
  "Desk",
  "Booking",
  "BookingOccurrence",
  "User",
  "Lab",
  "LabIncharge",
  "Organization",
  "Role",
  "AttendanceRecord",
  "LogEntry",
  "Project",
  "Milestone",
  "Todo",
  "ProjectMember",
];

export async function listAuditLogs(filters: AuditFilters): Promise<AuditRow[]> {
  await requirePermission("audit.view");
  const where: Record<string, unknown> = {};
  if (filters.action) where.action = filters.action;
  if (filters.entityType) where.entityType = filters.entityType;
  if (filters.from) {
    const [y, m, d] = filters.from.split("-").map(Number);
    where.createdAt = { ...(where.createdAt as object), gte: new Date(Date.UTC(y, m - 1, d, 0, 0) - 5 * 3600 * 1000) };
  }
  if (filters.to) {
    const [y, m, d] = filters.to.split("-").map(Number);
    where.createdAt = { ...(where.createdAt as object), lt: new Date(Date.UTC(y, m - 1, d + 1, 0, 0) - 5 * 3600 * 1000) };
  }
  const rows = await prisma.auditLog.findMany({
    where,
    include: { actor: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt.toLocaleString("en-PK", { timeZone: "Asia/Karachi" }),
    action: r.action,
    entityType: r.entityType,
    entityId: r.entityId,
    actorName: r.actor?.name ?? null,
    details: r.details ? JSON.stringify(r.details) : null,
  }));
}

export async function auditFilterOptions() {
  await requirePermission("audit.view");
  return { ACTIONS, ENTITY_TYPES };
}

