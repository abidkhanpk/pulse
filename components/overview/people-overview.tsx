"use client";

import { FadeIn } from "@/components/ui/motion";
import { LabOverviewCard, OverviewGrid, OverviewItem, type LabOverviewStat } from "@/components/overview/lab-overview-card";
import type { PeopleLabOverview } from "@/app/(app)/people/actions";

export function PeopleOverview({ overview }: { overview: PeopleLabOverview[] }) {
  return (
    <div className="space-y-5">
      <FadeIn>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">People</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Select a lab to manage its people in detail.
          </p>
        </div>
      </FadeIn>
      <OverviewGrid>
        {overview.map((o) => {
          const stats: LabOverviewStat[] = [
            { label: "Headcount", value: o.headcount },
            { label: "Active", value: o.activeCount },
            { label: "Checked in today", value: o.checkedInToday },
            {
              label: "Incharges",
              value: o.inchargeNames.length,
              hint: o.inchargeNames.slice(0, 2).join(",") || undefined,
            },
          ];
          return (
            <OverviewItem key={o.labId}>
              <LabOverviewCard labName={o.labName} href={`/people?lab=${o.labId}`} stats={stats} accent="emerald" />
            </OverviewItem>
          );
        })}
      </OverviewGrid>
    </div>
  );
}
