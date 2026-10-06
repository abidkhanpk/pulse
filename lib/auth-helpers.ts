import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "./prisma";
import type { Actor, PermissionKey } from "./permissions";
import { hasPermission } from "./permissions";

export interface SessionActor extends Actor {
  name: string;
  email: string;
}

/**
 * Build the actor from the session. Redirects to /login when not signed in.
 * Re-checks ACTIVE status against the DB so deactivation ends access promptly
 * (JWT sessions are otherwise stateless).
 */
export async function requireUser(): Promise<SessionActor> {
  const session = await auth();
  const u = session?.user;
  if (!u?.id || !u.role) redirect("/login");
  const dbUser = await prisma.user.findUnique({
    where: { id: u.id },
    select: { status: true },
  });
  if (!dbUser || dbUser.status === "INACTIVE") redirect("/login");
  return {
    id: u.id,
    name: u.name ?? "",
    email: u.email ?? "",
    role: u.role,
    labId: u.labId,
    inchargeOf: u.inchargeOf,
  };
}

/** Like requireUser, but also requires a permission. Redirects to /dashboard on denial. */
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
