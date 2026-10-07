"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { weekAttendance, markDay } from "@/app/(app)/check-in/actions";

type Status = "PRESENT" | "REMOTE" | "LEAVE" | "ABSENT" | "UNMARKED";

const STATUS_STYLE: Record<Status, string> = {
  PRESENT: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  REMOTE: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  LEAVE: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  ABSENT: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  UNMARKED: "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500",
};

const STATUS_LABEL: Record<Status, string> = {
  PRESENT: "P",
  REMOTE: "R",
  LEAVE: "L",
  ABSENT: "A",
  UNMARKED: "–",
};

const CYCLE: Status[] = ["PRESENT", "REMOTE", "LEAVE", "ABSENT", "UNMARKED"];

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function mondayOf(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  const dow = (d.getUTCDay() + 6) % 7;
  return addDays(iso, -dow);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ManualRegister({ labId, labName }: { labId: string; labName: string }) {
  const [weekStart, setWeekStart] = React.useState(() => mondayOf(todayIso()));
  const [people, setPeople] = React.useState<{ id: string; name: string }[]>([]);
  const [records, setRecords] = React.useState<
    { userId: string; date: string; checkIn: boolean; workMode: string }[]
  >([]);
  const [pending, setPending] = React.useState<string | null>(null);

  const days = React.useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const load = React.useCallback(async () => {
    const data = await weekAttendance(labId, weekStart);
    if (data) {
      setPeople(data.people);
      setRecords(data.records);
    }
  }, [labId, weekStart]);

  React.useEffect(() => {
    load();
  }, [load]);

  function statusFor(userId: string, date: string): Status {
    const r = records.find((x) => x.userId === userId && x.date === date);
    if (!r) return "UNMARKED";
    if (!r.checkIn && r.workMode === "LEAVE") return "LEAVE";
    if (!r.checkIn) return "UNMARKED";
    return r.workMode === "REMOTE" ? "REMOTE" : "PRESENT";
  }

  async function cycle(userId: string, date: string) {
    const cur = statusFor(userId, date);
    const next = CYCLE[(CYCLE.indexOf(cur) + 1) % CYCLE.length];
    const key = `${userId}|${date}`;
    setPending(key);
    try {
      const res = await markDay({ userId, date, status: next === "UNMARKED" ? "ABSENT" : next });
      if (!res.ok) alert(res.error);
      else load();
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Mark attendance
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{labName} — click a cell to cycle status</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setWeekStart(addDays(weekStart, -7))}>
            ← Prev
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekStart(mondayOf(todayIso()))}>
            This week
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekStart(addDays(weekStart, 7))}>
            Next →
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <span className={`flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-bold ${STATUS_STYLE[s]}`}>
              {STATUS_LABEL[s]}
            </span>
            {s.charAt(0) + s.slice(1).toLowerCase()}
          </span>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Week of {days[0]} → {days[6]}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                    Person
                  </th>
                  {days.map((d) => (
                    <th key={d} className="px-2 py-2 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">
                      <div>{new Date(d + "T00:00:00Z").toLocaleDateString("en-PK", { weekday: "short", timeZone: "Asia/Karachi" })}</div>
                      <div className="text-sm">{Number(d.slice(8, 10))}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {people.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="sticky left-0 bg-white px-3 py-1.5 font-medium text-slate-800 dark:bg-slate-900 dark:text-slate-200">
                      {p.name}
                    </td>
                    {days.map((d) => {
                      const st = statusFor(p.id, d);
                      const key = `${p.id}|${d}`;
                      return (
                        <td key={d} className="px-1 py-1 text-center">
                          <button
                            onClick={() => cycle(p.id, d)}
                            disabled={pending === key}
                            title={`${p.name} — ${d}: ${st}`}
                            className={`h-9 w-9 rounded-lg text-xs font-bold transition active:scale-90 ${STATUS_STYLE[st]} ${pending === key ? "opacity-50" : "hover:ring-2 hover:ring-indigo-400"}`}
                          >
                            {STATUS_LABEL[st]}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {people.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-sm text-slate-400">
                      No active members with attendance tracking in this lab.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
