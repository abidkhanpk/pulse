"use client";

import { FadeIn } from "@/components/ui/motion";
import { LabOverviewCard, OverviewGrid, OverviewItem, type LabOverviewStat } from "@/components/overview/lab-overview-card";
import type { ProjectLabOverview } from "@/app/(app)/projects/actions";

export function ProjectsOverview({ overview }: { overview: ProjectLabOverview[] }) {
  return (
    <div className="space-y-5">
      <FadeIn>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Projects</h1>
          <p className="mt-1 text-sm text-slate-500">
            Select a lab to see its projects in detail.
          </p>
        </div>
      </FadeIn>
      <OverviewGrid>
        {overview.map((o) => {
          const stats: LabOverviewStat[] = [
            { label: "Projects", value: o.projectCount },
            { label: "Active", value: o.activeCount },
            { label: "Todos", value: o.todoCount, hint: o.overdueCount > 0 ? `${o.overdueCount} overdue` : undefined },
            { label: "Members", value: o.memberCount },
          ];
          return (
            <OverviewItem key={o.labId}>
              <LabOverviewCard labName={o.labName} href={`/projects?lab=${o.labId}`} stats={stats} accent="indigo" />
            </OverviewItem>
          );
        })}
      </OverviewGrid>
    </div>
  );
}
