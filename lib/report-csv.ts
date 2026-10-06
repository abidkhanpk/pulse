/** Row shape for the monthly attendance report (shared by server actions and the CSV exporter). */
export interface ReportRow {
  userId: string;
  name: string;
  email: string;
  labName: string;
  present: number;
  remote: number;
  leave: number;
  absent: number; // weekdays with no record and tracking on
  avgHours: number | null;
  expectedDays: number; // weekdays in month (tracking on)
}

/** Client-safe CSV export of the monthly attendance report. */
export function reportToCsv(rows: ReportRow[], year: number, month: number): string {
  const header = "Name,Email,Lab,Present,Remote,Leave,Absent,Avg hours/day,Expected weekdays";
  const lines = rows.map((r) =>
    [r.name, r.email, r.labName, r.present, r.remote, r.leave, r.absent, r.avgHours ?? "", r.expectedDays]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  );
  return [`# Attendance report ${year}-${String(month).padStart(2, "0")}`, header, ...lines].join("\n");
}
