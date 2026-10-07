-- CreateEnum
CREATE TYPE "AttendanceMode" AS ENUM ('SELF', 'MANUAL', 'NONE');

-- CreateEnum
CREATE TYPE "Recurrence" AS ENUM ('ONCE', 'WEEKLY', 'BIWEEKLY', 'MONTHLY');

-- AlterTable
ALTER TABLE "Lab" ADD COLUMN     "attendanceMode" "AttendanceMode" NOT NULL DEFAULT 'SELF',
ADD COLUMN     "attendanceMarkerId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "attendanceModeOverride" "AttendanceMode",
ADD COLUMN     "linkAttendanceToBooking" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "WorkingDayException" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "recurrence" "Recurrence" NOT NULL DEFAULT 'ONCE',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkingDayException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "WorkingDayException_userId_date_idx" ON "WorkingDayException"("userId", "date");

-- AddForeignKey
ALTER TABLE "Lab" ADD CONSTRAINT "Lab_attendanceMarkerId_fkey" FOREIGN KEY ("attendanceMarkerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkingDayException" ADD CONSTRAINT "WorkingDayException_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
