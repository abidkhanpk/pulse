/** Desk amenities catalogue — ids are stored on Desk.amenities. */
export const DESK_AMENITIES: { id: string; label: string }[] = [
  { id: "PC", label: "Desktop PC" },
  { id: "LAN", label: "LAN connection" },
  { id: "MONITOR", label: "Monitor" },
  { id: "MONITOR2", label: "Second monitor" },
  { id: "DOCK", label: "Docking station" },
  { id: "CHARGER", label: "Laptop charger" },
  { id: "PHONE", label: "Landline phone" },
  { id: "STANDING", label: "Standing desk" },
  { id: "UPS", label: "UPS backup" },
  { id: "PRINTER", label: "Printer access" },
];

const LABELS = new Map(DESK_AMENITIES.map((a) => [a.id, a.label]));

export function amenityLabel(id: string): string {
  return LABELS.get(id) ?? id;
}

/** "Desktop PC · LAN connection" — or null when the desk has none recorded. */
export function amenitySummary(ids: string[] | null | undefined): string | null {
  if (!ids || ids.length === 0) return null;
  return ids.map(amenityLabel).join(" · ");
}

/** Keep only catalogue ids (server-side guard for desk writes). */
export function sanitizeAmenities(ids: string[] | undefined | null): string[] {
  if (!ids) return [];
  return DESK_AMENITIES.map((a) => a.id).filter((id) => ids.includes(id));
}
