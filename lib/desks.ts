/** What a desk is called in booking-facing UI: its display text when set, else its code. */
export function deskDisplayLabel(d: { label: string; displayName?: string | null }): string {
  const t = d.displayName?.trim();
  return t ? t : d.label;
}
