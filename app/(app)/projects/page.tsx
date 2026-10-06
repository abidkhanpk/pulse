import { requireUser } from "@/lib/auth-helpers";
import { hasPermission } from "@/lib/permissions";
import { listProjects } from "./actions";
import { myLabs } from "../labs/actions";
import { ProjectsClient } from "@/components/projects/projects-client";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ lab?: string; status?: string }>;
}) {
  const actor = await requireUser();
  const params = await searchParams;
  const [projects, labs] = await Promise.all([
    listProjects({ labId: params.lab || undefined, status: params.status || undefined }),
    myLabs(),
  ]);
  return (
    <ProjectsClient
      projects={projects.map((p) => ({
        ...p,
        startDate: p.startDate ? p.startDate.toISOString() : null,
        endDate: p.endDate ? p.endDate.toISOString() : null,
      }))}
      labs={labs}
      canManage={hasPermission(actor, "projects.manage")}
    />
  );
}
