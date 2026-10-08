-- AlterEnum
ALTER TYPE "FloorplanShapeKind" ADD VALUE 'RECTANGLE';
ALTER TYPE "FloorplanShapeKind" ADD VALUE 'CIRCLE';
ALTER TYPE "FloorplanShapeKind" ADD VALUE 'POLYGON';

-- CreateEnum
CREATE TYPE "DeskMarkerShape" AS ENUM ('CIRCLE', 'SQUARE', 'ROUNDED');

-- AlterTable
ALTER TABLE "FloorplanShape" ADD COLUMN "points" JSONB,
ADD COLUMN "filled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Desk" ADD COLUMN "markerShape" "DeskMarkerShape" NOT NULL DEFAULT 'CIRCLE';
