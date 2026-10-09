/**
 * Desk amenities are admin-managed data (DeskAmenity table) — desks store
 * amenity ids; UI payloads resolve them to labels server-side.
 */

export interface AmenityOption {
  id: string;
  label: string;
}

/** Map stored ids to labels using the catalogue; unknown ids pass through. */
export function resolveAmenityLabels(ids: string[] | null | undefined, catalogue: AmenityOption[]): string[] {
  if (!ids || ids.length === 0) return [];
  const map = new Map(catalogue.map((a) => [a.id, a.label]));
  return ids.map((id) => map.get(id) ?? id);
}

/** "Desktop PC · LAN connection" from labels — or null when empty. */
export function amenitySummary(labels: string[] | null | undefined): string | null {
  if (!labels || labels.length === 0) return null;
  return labels.join(" · ");
}
