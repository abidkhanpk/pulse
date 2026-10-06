"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Select, Label } from "@/components/ui/input";
import { Tabs } from "@/components/ui/misc";
import { WeekGrid, type Occurrence } from "./week-grid";
import { DayTimeline } from "./day-timeline";
import { DesksManager } from "./desks-manager";

interface Desk {
  id: string;
  label: string;
  status: string;
  notes: string | null;
  lab: { id: string; name: string };
}

export function DesksClient({
  labs,
  desks,
  people,
  projects,
  initialOccurrences,
  weekStart,
  today,
  canManage,
  canManageDesks,
}: {
  labs: { id: string; name: string }[];
  desks: Desk[];
  people: { id: string; name: string }[];
  projects: { id: string; name: string }[];
  initialOccurrences: Occurrence[];
  weekStart: string;
  today: string;
  canManage: boolean;
  canManageDesks: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [view, setView] = React.useState("week");
  const [managerOpen, setManagerOpen] = React.useState(false);

  const labId = searchParams.get("lab") ?? "";

  function changeLab(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("lab", id);
    else params.delete("lab");
    router.push(`/desks?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Desk booking</h1>
          <p className="text-sm text-slate-500">Availability across labs — click an empty cell to book.</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Label htmlFor="lab-filter" className="!mb-0 text-sm">
            Lab
          </Label>
          <Select id="lab-filter" value={labId} onChange={(e) => changeLab(e.target.value)} className="w-48">
            <option value="">All labs</option>
            {labs.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <Tabs
        tabs={[
          { id: "week", label: "Week view" },
          { id: "day", label: "Day timeline" },
        ]}
        active={view}
        onChange={setView}
      />

      {view === "week" ? (
        <WeekGrid
          key={`${labId}|${weekStart}`}
          desks={desks}
          people={people}
          projects={projects}
          initialOccurrences={initialOccurrences}
          weekStart={weekStart}
          canManage={canManage}
          canManageDesks={canManageDesks}
          onManageDesks={() => setManagerOpen(true)}
        />
      ) : (
        <DayTimeline
          desks={desks}
          initialOccurrences={initialOccurrences.filter((o) => o.date === today)}
          initialDate={today}
        />
      )}

      <DesksManager
        open={managerOpen}
        onClose={() => setManagerOpen(false)}
        desks={desks}
        labs={labs}
        onChanged={() => router.refresh()}
      />
    </div>
  );
}
