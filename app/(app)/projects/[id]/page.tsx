import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";
import { hasPermission } from "@/lib/permissions";
import { getProject, projectLogbook } from "../actions";
import { ProjectDetail } from "@/components/projects/project-detail";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireUser();
  const project = await getProject(id);
  if (!project) notFound();
  const logEntries = await projectLogbook(id);

  return (
    <ProjectDetail
      project={{
        ...project,
        startDate: project.startDate ? project.startDate.toISOString().slice(0, 10) : null,
        endDate: project.endDate ? project.endDate.toISOString().slice(0, 10) : null,
        milestones: project.milestones.map((m) => ({
          ...m,
          dueDate: m.dueDate ? m.dueDate.toISOString().slice(0, 10) : null,
        })),
        todos: project.todos.map((t) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          status: t.status,
          sortOrder: t.sortOrder,
          startDate: t.startDate ? t.startDate.toISOString().slice(0, 10) : null,
          endDate: t.endDate ? t.endDate.toISOString().slice(0, 10) : null,
          assignee: t.assignee,
          milestone: t.milestone,
          milestoneId: t.milestoneId,
          prerequisites: t.prerequisites,
        })),
      }}
      logEntries={logEntries.map((e) => ({
        ...e,
        date: e.date.toISOString().slice(0, 10),
      }))}
      canManage={hasPermission(actor, "projects.manage")}
    />
  );
}
