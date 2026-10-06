"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { monthlyReport, reportPeople, reportToCsv, type ReportRow } from "@/app/(app)/check-in/actions";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function ReportsClient({
  labs,
  initialYear,
  initialMonth,
}: {
  labs: { id: string; name: string }[];
  initialYear: number;
  initialMonth: number;
}) {
  const [year, setYear] = React.useState(initialYear);
  const [month, setMonth] = React.useState(initialMonth);
  const [labId, setLabId] = React.useState("");
  const [userId, setUserId] = React.useState("");
  const [people, setPeople] = React.useState<{ id: string; name: string }[]>([]);
  const [rows, setRows] = React.useState<ReportRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);

  async function loadPeople(lab: string) {
    setPeople(await reportPeople(lab || undefined));
  }

  React.useEffect(() => {
    loadPeople("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run() {
    setLoading(true);
    try {
      const r = await monthlyReport({ year, month, labId: labId || undefined, userId: userId || undefined });
      setRows(r);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }

  function downloadCsv() {
    const csv = reportToCsv(rows, year, month);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${year}-${String(month).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const years = Array.from({ length: 3 }, (_, i) => initialYear - 1 + i);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Attendance reports</h1>
        <p className="text-sm text-slate-500">Monthly summary per person, with CSV export.</p>
      </div>

      <Card>
        <CardContent className="!py-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="rep-month">Month</Label>
              <Select id="rep-month" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="rep-year">Year</Label>
              <Select id="rep-year" value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="rep-lab">Lab</Label>
              <Select
                id="rep-lab"
                value={labId}
                onChange={(e) => {
                  setLabId(e.target.value);
                  setUserId("");
                  loadPeople(e.target.value);
                }}
              >
                <option value="">All labs</option>
                {labs.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="rep-person">Person</Label>
              <Select id="rep-person" value={userId} onChange={(e) => setUserId(e.target.value)}>
                <option value="">Everyone</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </div>
            <Button onClick={run} disabled={loading}>
              {loading ? "Loading…" : "Run report"}
            </Button>
            {loaded && rows.length > 0 && (
              <Button variant="outline" onClick={downloadCsv}>
                Export CSV
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {loaded && (
        rows.length === 0 ? (
          <EmptyState title="No data" description="Nobody with attendance tracking matched these filters." />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>
                {MONTHS[month - 1]} {year} — {rows.length} people
              </CardTitle>
            </CardHeader>
            <CardContent className="!px-0">
              <Table className="rounded-none border-0">
                <THead>
                  <TR>
                    <TH>Name</TH>
                    <TH>Lab</TH>
                    <TH className="text-right">Present</TH>
                    <TH className="text-right">Remote</TH>
                    <TH className="text-right">Leave</TH>
                    <TH className="text-right">Absent</TH>
                    <TH className="text-right">Avg h/day</TH>
                  </TR>
                </THead>
                <TBody>
                  {rows.map((r) => (
                    <TR key={r.userId}>
                      <TD className="font-medium">{r.name}</TD>
                      <TD>{r.labName}</TD>
                      <TD className="text-right">{r.present}</TD>
                      <TD className="text-right">{r.remote}</TD>
                      <TD className="text-right">{r.leave}</TD>
                      <TD className="text-right font-semibold text-red-600">{r.absent > 0 ? r.absent : "—"}</TD>
                      <TD className="text-right">{r.avgHours ?? "—"}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
}
