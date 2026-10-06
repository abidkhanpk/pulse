"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent, Badge } from "@/components/ui/card";
import { FieldError } from "@/components/ui/input";
import { checkIn, checkOut, todayAttendance } from "@/app/(app)/check-in/actions";

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-PK", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Karachi",
  });
}

export function CheckInClient() {
  const [record, setRecord] = React.useState<{
    checkIn: string | null;
    checkOut: string | null;
    workMode: string;
  } | null>(null);
  const [workMode, setWorkMode] = React.useState<"ONSITE" | "REMOTE" | "LEAVE">("ONSITE");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [now, setNow] = React.useState("");

  async function load() {
    const r = await todayAttendance();
    setRecord(
      r
        ? {
            checkIn: r.checkIn ? r.checkIn.toISOString() : null,
            checkOut: r.checkOut ? r.checkOut.toISOString() : null,
            workMode: r.workMode,
          }
        : null
    );
  }

  React.useEffect(() => {
    load();
    const t = setInterval(() => {
      setNow(
        new Date().toLocaleTimeString("en-PK", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
          timeZone: "Asia/Karachi",
        })
      );
    }, 1000);
    return () => clearInterval(t);
  }, []);

  async function doCheckIn() {
    setError(null);
    setPending(true);
    try {
      const res = await checkIn({ workMode });
      if (!res.ok) setError(res.error);
      else load();
    } finally {
      setPending(false);
    }
  }

  async function doCheckOut() {
    setError(null);
    setPending(true);
    try {
      const res = await checkOut();
      if (!res.ok) setError(res.error);
      else load();
    } finally {
      setPending(false);
    }
  }

  const checkedIn = !!record?.checkIn && !record.checkOut;
  const done = !!record?.checkOut;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Check-in</h1>
        <p className="mt-1 text-sm text-slate-500">
          {new Date().toLocaleDateString("en-PK", {
            weekday: "long",
            day: "numeric",
            month: "long",
            timeZone: "Asia/Karachi",
          })}
        </p>
        <p className="mt-1 font-mono text-3xl font-bold text-slate-800">{now}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s status</CardTitle>
          {record && <Badge color={record.workMode === "REMOTE" ? "info" : record.workMode === "LEAVE" ? "warning" : "success"}>{record.workMode}</Badge>}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Check-in</p>
              <p className="font-mono text-lg font-semibold">{fmtTime(record?.checkIn ?? null)}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Check-out</p>
              <p className="font-mono text-lg font-semibold">{fmtTime(record?.checkOut ?? null)}</p>
            </div>
          </div>

          {!record && (
            <>
              <div>
                <Label>Work mode</Label>
                <div className="flex gap-2">
                  {(["ONSITE", "REMOTE", "LEAVE"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setWorkMode(m)}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                        workMode === m
                          ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                          : "border-slate-300 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {m === "ONSITE" ? "On-site" : m === "REMOTE" ? "Remote" : "Leave"}
                    </button>
                  ))}
                </div>
              </div>
              <Button className="w-full" size="lg" onClick={doCheckIn} disabled={pending}>
                {pending ? "Checking in…" : workMode === "LEAVE" ? "Mark leave" : "Check in"}
              </Button>
            </>
          )}

          {checkedIn && (
            <Button className="w-full" size="lg" variant="secondary" onClick={doCheckOut} disabled={pending}>
              {pending ? "Checking out…" : "Check out"}
            </Button>
          )}

          {done && <p className="text-center text-sm text-slate-500">You&apos;re done for today. Have a good evening.</p>}

          <FieldError message={error ?? undefined} />
        </CardContent>
      </Card>
    </div>
  );
}
