import { prisma } from "./prisma";
import type { Prisma } from "@prisma/client";

export async function logAudit(
  actorId: string | null,
  action: string,
  entityType: string,
  entityId?: string | null,
  details?: Record<string, unknown>
) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId,
        action,
        entityType,
        entityId: entityId ?? null,
        details: (details ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch {
    // Audit logging must never break the main operation.
  }
}
