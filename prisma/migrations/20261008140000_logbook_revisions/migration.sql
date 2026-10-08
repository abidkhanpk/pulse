-- CreateEnum
CREATE TYPE "RevisionKind" AS ENUM ('CREATED', 'EDITED', 'SUBMITTED', 'REVIEWED', 'RETURNED', 'DELETED', 'RESTORED');

-- AlterTable
ALTER TABLE "LogEntry" ADD COLUMN     "deletedAt" TIMESTAMPTZ,
ADD COLUMN     "revisionCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "LogEntryRevision" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "revisionNo" INTEGER NOT NULL,
    "kind" "RevisionKind" NOT NULL,
    "summary" TEXT NOT NULL,
    "details" TEXT,
    "projectId" TEXT,
    "projectName" TEXT,
    "date" DATE NOT NULL,
    "status" "LogStatus" NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogEntryRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LogEntryRevision_entryId_revisionNo_key" ON "LogEntryRevision"("entryId", "revisionNo");

-- CreateIndex
CREATE INDEX "LogEntryRevision_entryId_idx" ON "LogEntryRevision"("entryId");

-- AddForeignKey
ALTER TABLE "LogEntryRevision" ADD CONSTRAINT "LogEntryRevision_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "LogEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogEntryRevision" ADD CONSTRAINT "LogEntryRevision_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: one CREATED revision per existing entry, snapshotting its current values.
INSERT INTO "LogEntryRevision" ("id", "entryId", "revisionNo", "kind", "summary", "details", "projectId", "projectName", "date", "status", "actorId", "actorName", "note", "createdAt")
SELECT gen_random_uuid()::text, e."id", 1, 'CREATED', e."summary", e."details", e."projectId", p."name", e."date", e."status", e."userId", u."name", NULL, e."createdAt"
FROM "LogEntry" e
JOIN "User" u ON u."id" = e."userId"
LEFT JOIN "Project" p ON p."id" = e."projectId";

UPDATE "LogEntry" SET "revisionCount" = 1;
