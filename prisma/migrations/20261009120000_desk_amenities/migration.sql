-- Desk amenities (e.g. PC, LAN connection) shown in desk tooltips.
ALTER TABLE "Desk" ADD COLUMN "amenities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
