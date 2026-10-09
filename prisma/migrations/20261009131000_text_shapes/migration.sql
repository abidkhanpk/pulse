-- Text annotations on floorplans: new shape kind + font styling columns.
ALTER TYPE "FloorplanShapeKind" ADD VALUE 'TEXT';

ALTER TABLE "FloorplanShape" ADD COLUMN "fontSize" DOUBLE PRECISION;
ALTER TABLE "FloorplanShape" ADD COLUMN "fontFamily" TEXT;
ALTER TABLE "FloorplanShape" ADD COLUMN "bold" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "FloorplanShape" ADD COLUMN "italic" BOOLEAN NOT NULL DEFAULT false;
