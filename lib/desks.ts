/**
 * The text rendered inside a desk's station box ON THE LAYOUT: the
 * desk's short layout label when one is set (e.g. "1" within a group
 * of four), otherwise its real label. Used ONLY by layout rendering —
 * every other surface shows the real label.
 */
export function deskLayoutLabel(d: { label: string; layoutLabel?: string | null }): string {
  const t = d.layoutLabel?.trim();
  return t ? t : d.label;
}
