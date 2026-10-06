// Permission catalog (fixed in code; assigned per role in the admin UI).
// See IMPLEMENTATION_PLAN_v5.md §3.

export const PERMISSIONS = [
  { key: "org.manage", label: "Manage organization", description: "Edit organization name" },
  { key: "labs.manage", label: "Manage labs", description: "Create/edit/delete labs, assign/remove lab incharges" },
  { key: "roles.manage", label: "Manage roles", description: "Create/edit/delete roles and their permission sets" },
  { key: "users.manage", label: "Manage users", description: "Create/edit/deactivate users (within scope)" },
  { key: "desks.manage", label: "Manage desks", description: "Create/edit desks, set maintenance status (within scope)" },
  { key: "bookings.manage", label: "Manage bookings", description: "Create/edit/cancel bookings for anyone (within scope)" },
  { key: "bookings.view_all", label: "View all bookings", description: "See all bookings & availability grid (within scope)" },
  { key: "projects.manage", label: "Manage projects", description: "Create/edit projects, milestones, todos (within scope)" },
  { key: "logbook.review", label: "Review logbook", description: "Review others' logbook entries (within scope)" },
  { key: "attendance.view_reports", label: "View attendance reports", description: "View attendance reports beyond self (within scope)" },
  { key: "audit.view", label: "View audit log", description: "View the audit log (within scope)" },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key) as PermissionKey[];

export function isValidPermission(key: string): key is PermissionKey {
  return (PERMISSION_KEYS as string[]).includes(key);
}

// Default permission sets for the four system roles (also used by "reset to defaults").
export const DEFAULT_ROLE_PERMISSIONS: Record<string, PermissionKey[]> = {
  ADMIN: [...PERMISSION_KEYS],
  LAB_INCHARGE: [
    "users.manage",
    "desks.manage",
    "bookings.manage",
    "bookings.view_all",
    "projects.manage",
    "logbook.review",
    "attendance.view_reports",
    "audit.view",
  ],
  SUPERVISOR: ["projects.manage", "logbook.review", "attendance.view_reports"],
  INTERNEE: [],
};

export type RoleScope = "GLOBAL" | "LAB";

export interface ActorRole {
  key: string;
  scope: RoleScope;
  permissions: string[];
}

export interface Actor {
  id: string;
  role: ActorRole;
  labId: string | null;
  inchargeOf: { labId: string }[];
}

/** Does this actor hold the permission? */
export function hasPermission(actor: Actor, perm: PermissionKey): boolean {
  return actor.role.permissions.includes(perm);
}

/** Lab ids this actor may act within (GLOBAL scope is handled by callers via inScope). */
export function actorLabIds(actor: Actor): string[] {
  const ids = new Set<string>();
  if (actor.labId) ids.add(actor.labId);
  for (const l of actor.inchargeOf) ids.add(l.labId);
  return [...ids];
}

/**
 * Is labId within the actor's scope?
 * GLOBAL roles skip lab filtering; LAB roles are limited to home lab + incharge labs.
 */
export function inScope(actor: Actor, labId: string): boolean {
  if (actor.role.scope === "GLOBAL") return true;
  return actorLabIds(actor).includes(labId);
}

/** Combined check used by every management server action. */
export function can(actor: Actor, perm: PermissionKey, labId?: string): boolean {
  if (!hasPermission(actor, perm)) return false;
  if (labId !== undefined && !inScope(actor, labId)) return false;
  return true;
}

/** Labs filter for list queries: null = no filter (global), otherwise the id list. */
export function scopeFilter(actor: Actor): string[] | null {
  if (actor.role.scope === "GLOBAL") return null;
  return actorLabIds(actor);
}
