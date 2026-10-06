-- DropForeignKey
ALTER TABLE "LogEntry" DROP CONSTRAINT "LogEntry_projectId_fkey";

-- DropIndex
DROP INDEX "LogEntry_userId_projectId_date_key";

-- AlterTable
ALTER TABLE "LogEntry" ADD COLUMN     "reviewComment" TEXT,
ALTER COLUMN "projectId" DROP NOT NULL,
ALTER COLUMN "details" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "LogEntry_userId_date_idx" ON "LogEntry"("userId", "date");

-- AddForeignKey
ALTER TABLE "LogEntry" ADD CONSTRAINT "LogEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
