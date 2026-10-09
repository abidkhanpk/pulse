-- The desk display text added in 20261009150000 is layout-only: it is
-- the short label rendered inside the station box on the floorplan.
-- Rename the column to match its actual purpose.
ALTER TABLE "Desk" RENAME COLUMN "displayName" TO "layoutLabel";
