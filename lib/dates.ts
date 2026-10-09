// Shared date formatting — one format rule app-wide:
//   day + month only  -> "30 Sep"           (fmtDayMonth)
//   day + month + day -> "Wed · 30 Sep"     (fmtDayMonthDay)
//   full date         -> "30/09/2026"      (fmtFullDate)
// All helpers accept ISO dates ("2026-09-30"), ISO datetimes, or "MM-DD".

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface DateParts {
  y: number;
  m: number;
  d: number;
}

function parts(iso: string): DateParts | null {
  // Datetimes are instants — resolve the calendar day in Asia/Karachi.
  if (iso.includes("T")) {
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) return null;
    const map: Record<string, string> = {};
    for (const p of new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Karachi",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(dt)) {
      map[p.type] = p.value;
    }
    return { y: Number(map.year), m: Number(map.month), d: Number(map.day) };
  }
  // Pure dates are calendar days — take them literally, no TZ shift.
  const full = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (full) return { y: Number(full[1]), m: Number(full[2]), d: Number(full[3]) };
  const md = /^(\d{2})-(\d{2})$/.exec(iso);
  if (md) return { y: new Date().getFullYear(), m: Number(md[1]), d: Number(md[2]) };
  return null;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "30 Sep" */
export function fmtDayMonth(iso: string): string {
  const p = parts(iso);
  if (!p) return iso;
  return `${p.d} ${MONTHS[p.m - 1]}`;
}

/** "30/09/2026" */
export function fmtFullDate(iso: string): string {
  const p = parts(iso);
  if (!p) return iso;
  return `${pad(p.d)}/${pad(p.m)}/${p.y}`;
}

/** "Wed · 30 Sep" — weekday separated from the date by a middle dot. */
export function fmtDayMonthDay(iso: string): string {
  const p = parts(iso);
  if (!p) return iso;
  const wd = DAYS[new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay()];
  return `${wd} · ${p.d} ${MONTHS[p.m - 1]}`;
}

/** "30/09/2026 · 4:12 PM" — full date plus local time, for timestamps. */
export function fmtDateTime(iso: string): string {
  const p = parts(iso);
  if (!p) return iso;
  const time = new Date(iso).toLocaleTimeString("en-PK", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Karachi",
  });
  return `${fmtFullDate(iso)} · ${time}`;
}
