-- Admin-managed desk amenity catalogue. Seeded with the original built-in
-- list, keeping the same ids so desks already tagged keep resolving.
CREATE TABLE "DeskAmenity" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeskAmenity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeskAmenity_label_key" ON "DeskAmenity"("label");

INSERT INTO "DeskAmenity" ("id", "label") VALUES
  ('PC', 'Desktop PC'),
  ('LAN', 'LAN connection'),
  ('MONITOR', 'Monitor'),
  ('MONITOR2', 'Second monitor'),
  ('DOCK', 'Docking station'),
  ('CHARGER', 'Laptop charger'),
  ('PHONE', 'Landline phone'),
  ('STANDING', 'Standing desk'),
  ('UPS', 'UPS backup'),
  ('PRINTER', 'Printer access');
