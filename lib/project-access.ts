import { prisma } from "@/lib/prisma";
import { hasPermission, scopeFilter, type Actor } from "@/lib/permissions";

/**
 * Project visibility model:
 * - Actors with `projects.view_all` see every project in their lab scope.
 * - Everyone else sees only projects where they are lead or member ("own projects").
 */

/** Can the actor see all projects in scope (vs only their own)? */
export function canViewAllProjects(actor: Actor): boolean {
  return hasPermission(actor, "projects.view_all");
}

/** Ids of projects where the actor is lead or a member. */
export async function myProjectIds(actor: Actor): Promise<string[]> {
  const [led, member] = await Promise.all([
    prisma.project.findMany({ where: { leadId: actor.id }, select: { id: true } }),
    prisma.projectMember.findMany({ where: { userId: actor.id }, select: { projectId: true } }),
  ]);
  return [...new Set([...led.map((p) => p.id), ...member.map((m) => m.projectId)])];
}

/** Ids of users on the actor's project teams (members + leads of their projects, incl. self). */
export async function projectTeamUserIds(actor: Actor): Promise<string[]> {
  const ids = await myProjectIds(actor);
  if (ids.length === 0) return [actor.id];
  const [members, leads] = await Promise.all([
    prisma.projectMember.findMany({ where: { projectId: { in: ids } }, select: { userId: true } }),
    prisma.project.findMany({ where: { id: { in: ids } }, select: { leadId: true } }),
  ]);
  const set = new Set<string>([actor.id]);
  for (const m of members) set.add(m.userId);
  for (const l of leads) if (l.leadId) set.add(l.leadId);
  return [...set];
}

/** Id + name of the actor's own projects (for pickers). */
export async function myProjects(actor: Actor): Promise<{ id: string; name: string }[]> {
  const ids = await myProjectIds(actor);
  if (ids.length === 0) return [];
  return prisma.project.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

/** Can the actor see / attach records to this project? (lab scope + membership) */
export async function canAccessProject(actor: Actor, projectId: string): Promise<boolean> {
  const labIds = scopeFilter(actor);
  const p = await prisma.project.findFirst({
    where: { id: projectId, ...(labIds ? { labId: { in: labIds } } : {}) },
    select: {
      leadId: true,
      members: { where: { userId: actor.id }, select: { userId: true } },
    },
  });
  if (!p) return false;
  if (canViewAllProjects(actor)) return true;
  return p.leadId === actor.id || p.members.length > 0;
}

/** Member user ids of one project (for validating a project-scoped filter). */
export async function projectMemberUserIds(projectId: string): Promise<string[]> {
  const [members, project] = await Promise.all([
    prisma.projectMember.findMany({ where: { projectId }, select: { userId: true } }),
    prisma.project.findUnique({ where: { id: projectId }, select: { leadId: true } }),
  ]);
  const set = new Set(members.map((m) => m.userId));
  if (project?.leadId) set.add(project.leadId);
  return [...set];
}
