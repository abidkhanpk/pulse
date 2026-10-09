import { fmtFullDate } from "@/lib/dates";
import type { Occurrence } from "./week-grid";

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-PK", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Karachi",
  });
}

/** Rich hover content for a booking, shared by the week / month / day desk views. */
export function BookingTipContent({ o }: { o: Occurrence }) {
  return (
    <div className="min-w-[170px]">
      <p className="font-bold text-slate-800 dark:text-slate-100">{o.booking.user.name}</p>
      <p className="mt-0.5 text-slate-500 dark:text-slate-400">
        {o.desk ? o.desk.label : "Remote / WFH"} · {fmtFullDate(o.date)}
      </p>
      <p className="text-slate-600 dark:text-slate-300">
        {fmtTime(o.startsAt)}–{fmtTime(o.endsAt)}
        {o.booking.type === "REMOTE" ? " · Remote" : ""}
      </p>
      {o.booking.title && <p className="mt-0.5 text-slate-600 dark:text-slate-300">{o.booking.title}</p>}
    </div>
  );
}
