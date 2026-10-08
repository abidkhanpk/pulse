import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth-helpers";
import { hasPermission } from "@/lib/permissions";
import { listProjects, projectLabOverview } from "./actions";
import { myLabs } from "../labs/actions";
import { ProjectsClient } from "@/components/projects/projects-client";
import { ProjectsOverview } from "@/components/overview/projects-overview";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ lab?: string; status?: string }>;
}) {
  const actor = await requireUser();
  const params = await searchParams;
  const isAdmin = actor.role.scope === "GLOBAL";

  // Admins start at the lab overview; drill into ?lab=<id> for detail.
  if (isAdmin && !params.lab) {
    const overview = await projectLabOverview();
    return <ProjectsOverview overview={overview} />;
  }

  const [projects, labs] = await Promise.all([
    listProjects({ labId: params.lab || undefined, status: params.status || undefined }),
    myLabs(),
  ]);
  const labName = params.lab ? labs.find((l) => l.id === params.lab)?.name : null;
  return (
    <div className="space-y-4">
      {isAdmin && params.lab && (
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-accent-600 dark:text-slate-400"
        >
          <ArrowLeft className="h-4 w-4" /> All labs
        </Link>
      )}
      {labName && (
        <p className="text-sm text-slate-400">
          <Link href="/projects" className="hover:text-accent-600">Projects</Link>
          <span className="mx-1">›</span> {labName}
        </p>
      )}
      <ProjectsClient
        projects={projects.map((p) => ({
          ...p,
          startDate: p.startDate ? p.startDate.toISOString() : null,
          endDate: p.endDate ? p.endDate.toISOString() : null,
        }))}
        labs={labs}
        canManage={hasPermission(actor, "projects.manage")}
      />
    </div>
  );
}
