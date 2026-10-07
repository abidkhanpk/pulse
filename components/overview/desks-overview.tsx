"use client";

import { FadeIn } from "@/components/ui/motion";
import { LabOverviewCard, OverviewGrid, OverviewItem, type LabOverviewStat } from "@/components/overview/lab-overview-card";
import type { DeskLabOverview } from "@/app/(app)/desks/actions";

export function DesksOverview({ overview }: { overview: DeskLabOverview[] }) {
  return (
    <div className="space-y-5">
      <FadeIn>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Desks</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Select a lab to see its desk booking in detail.
          </p>
        </div>
      </FadeIn>
      <OverviewGrid>
        {overview.map((o) => {
          const stats: LabOverviewStat[] = [
            { label: "Desks", value: o.deskCount },
            { label: "Occupied now", value: o.occupiedNow },
            { label: "Bookings today", value: o.bookingsToday },
            {
              label: "Free now",
              value: Math.max(0, o.deskCount - o.occupiedNow),
            },
          ];
          return (
            <OverviewItem key={o.labId}>
              <LabOverviewCard labName={o.labName} href={`/desks?lab=${o.labId}`} stats={stats} accent="sky" />
            </OverviewItem>
          );
        })}
      </OverviewGrid>
    </div>
  );
}
