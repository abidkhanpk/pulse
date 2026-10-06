"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardContent, Badge } from "@/components/ui/card";
import { Avatar } from "@/components/ui/misc";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { personAttendance } from "@/app/(app)/check-in/actions";

interface Person {
  id: string;
  name: string;
  email: string;
  status: string;
  attendanceTracking: boolean;
  joinDate: string | null;
  role: { key: string; name: string; scope: string; permissions: string[] };
  lab: { id: string; name: string } | null;
  inchargeOf: { lab: { id: string; name: string } }[];
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-PK", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Karachi",
  });
}

export function PersonClient({ person }: { person: Person }) {
  const [from, setFrom] = React.useState(() => {
    const d = new Date();
    d.setUTCDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [records, setRecords] = React.useState<
    { id: string; date: string; checkIn: string | null; checkOut: string | null; workMode: string }[]
  >([]);
  const [loading, setLoading] = React.useState(false);

  async function load() {
    setLoading(true);
    try {
      const recs = await personAttendance(person.id, from, to);
      setRecords(
        recs.map((r) => ({
          id: r.id,
          date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10),
          checkIn: r.checkIn ? (r.checkIn instanceof Date ? r.checkIn.toISOString() : String(r.checkIn)) : null,
          checkOut: r.checkOut ? (r.checkOut instanceof Date ? r.checkOut.toISOString() : String(r.checkOut)) : null,
          workMode: r.workMode,
        }))
      );
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 !py-5">
          <Avatar name={person.name} className="h-12 w-12 text-base" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-slate-900">{person.name}</h1>
            <p className="text-sm text-slate-500">{person.email}</p>
          </div>
          <div className="flex gap-2">
            <Badge color={person.status === "ACTIVE" ? "success" : "danger"}>{person.status}</Badge>
            <Badge color="default">{person.role.name}</Badge>
            {person.attendanceTracking ? <Badge color="success">Tracking on</Badge> : <Badge color="warning">Tracking off</Badge>}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="font-medium text-slate-700">Lab:</span> {person.lab?.name ?? "—"}</p>
            <p><span className="font-medium text-slate-700">Join date:</span> {person.joinDate ? person.joinDate.slice(0, 10) : "—"}</p>
            {person.inchargeOf.length > 0 && (
              <p>
                <span className="font-medium text-slate-700">Incharge of:</span>{" "}
                {person.inchargeOf.map((i) => i.lab.name).join(", ")}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Permissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {person.role.permissions.length === 0 && <span className="text-sm text-slate-400">Base abilities only</span>}
              {person.role.permissions.map((p) => (
                <Badge key={p} color="default">{p}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Attendance</CardTitle>
          <div className="flex items-center gap-2">
            <Label htmlFor="att-from" className="!mb-0 text-xs">From</Label>
            <Input id="att-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-36" />
            <Label htmlFor="att-to" className="!mb-0 text-xs">To</Label>
            <Input id="att-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-36" />
            <Button size="sm" onClick={load} disabled={loading}>
              {loading ? "Loading…" : "Load"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Date</TH>
                <TH>Check-in</TH>
                <TH>Check-out</TH>
                <TH>Hours</TH>
                <TH>Mode</TH>
              </TR>
            </THead>
            <TBody>
              {records.map((r) => {
                const hours =
                  r.checkIn && r.checkOut
                    ? ((new Date(r.checkOut).getTime() - new Date(r.checkIn).getTime()) / 3600000).toFixed(1)
                    : "—";
                return (
                  <TR key={r.id}>
                    <TD>{r.date}</TD>
                    <TD>{fmtTime(r.checkIn)}</TD>
                    <TD>{fmtTime(r.checkOut)}</TD>
                    <TD>{hours}</TD>
                    <TD><Badge color={r.workMode === "REMOTE" ? "info" : r.workMode === "LEAVE" ? "warning" : "success"}>{r.workMode}</Badge></TD>
                  </TR>
                );
              })}
              {records.length === 0 && (
                <TR>
                  <TD colSpan={5} className="text-center text-slate-400">
                    No records in this range.
                  </TD>
                </TR>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
