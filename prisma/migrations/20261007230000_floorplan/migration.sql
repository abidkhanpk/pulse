-- CreateEnum
CREATE TYPE "FloorplanShapeKind" AS ENUM ('WALL', 'ZONE');

-- AlterTable
ALTER TABLE "Desk" ADD COLUMN     "xPct" DOUBLE PRECISION,
ADD COLUMN     "yPct" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "FloorplanImage" (
    "id" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FloorplanImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FloorplanShape" (
    "id" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "kind" "FloorplanShapeKind" NOT NULL,
    "xPct" DOUBLE PRECISION NOT NULL,
    "yPct" DOUBLE PRECISION NOT NULL,
    "wPct" DOUBLE PRECISION NOT NULL,
    "hPct" DOUBLE PRECISION NOT NULL,
    "label" TEXT,
    "color" TEXT,

    CONSTRAINT "FloorplanShape_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FloorplanImage_labId_key" ON "FloorplanImage"("labId");

-- AddForeignKey
ALTER TABLE "FloorplanImage" ADD CONSTRAINT "FloorplanImage_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FloorplanShape" ADD CONSTRAINT "FloorplanShape_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE CASCADE ON UPDATE CASCADE;
