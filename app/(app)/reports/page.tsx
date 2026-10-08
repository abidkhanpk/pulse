import { requireUser, requirePermission } from "@/lib/auth-helpers";
import { canViewAllProjects, myProjects } from "@/lib/project-access";
import { myLabs } from "../labs/actions";
import { ReportsClient } from "@/components/reports/reports-client";

export default async function ReportsPage() {
  await requirePermission("attendance.view_reports");
  const actor = await requireUser();
  const labs = await myLabs();
  // Supervisors (no projects.view_all) report on their own projects, not labs.
  const projectScoped = !canViewAllProjects(actor);
  const projects = projectScoped ? await myProjects(actor) : [];
  const now = new Date();
  return (
    <ReportsClient
      labs={labs}
      isGlobal={actor.role.scope === "GLOBAL"}
      initialYear={now.getUTCFullYear()}
      initialMonth={now.getUTCMonth() + 1}
      projectScoped={projectScoped}
      projects={projects}
    />
  );
}
