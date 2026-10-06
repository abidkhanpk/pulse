import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { Actor, PermissionKey } from "./permissions";
import { hasPermission } from "./permissions";

export interface SessionActor extends Actor {
  name: string;
  email: string;
}

/** Build the actor from the session. Redirects to /login when not signed in. */
export async function requireUser(): Promise<SessionActor> {
  const session = await auth();
  const u = session?.user;
  if (!u?.id || !u.role || u.status === "INACTIVE") redirect("/login");
  return {
    id: u.id,
    name: u.name ?? "",
    email: u.email ?? "",
    role: u.role,
    labId: u.labId,
    inchargeOf: u.inchargeOf,
  };
}

/** Like requireUser, but also requires a permission (no lab scope). Redirects to /dashboard on denial. */
export async function requirePermission(perm: PermissionKey): Promise<SessionActor> {
  const actor = await requireUser();
  if (!hasPermission(actor, perm)) redirect("/dashboard");
  return actor;
}

/** Optional user — returns null instead of redirecting. */
export async function optionalUser() {
  const session = await auth();
  return session?.user ?? null;
}
