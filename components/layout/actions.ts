"use server";

import { signOut } from "@/auth";

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}

/** Save the current user's accent color preference. */
export async function setMyAccentAction(accentId: string): Promise<{ ok: boolean; error?: string }> {
  const { requireUser } = await import("@/lib/auth-helpers");
  const { prisma } = await import("@/lib/prisma");
  const { isAccentId } = await import("@/lib/accent");
  const actor = await requireUser();
  if (!isAccentId(accentId)) return { ok: false, error: "Unknown color." };
  await prisma.user.update({ where: { id: actor.id }, data: { accentColor: accentId } });
  return { ok: true };
}
