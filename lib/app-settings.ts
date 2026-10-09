import { cache } from "react";
import { prisma } from "@/lib/prisma";

export const DEFAULT_APP_NAME = "LOOM";

/** App display name, editable by admin in Settings. Falls back to "LOOM". */
export const getAppName = cache(async (): Promise<string> => {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: "appName" } });
    const v = row?.value.trim();
    return v ? v : DEFAULT_APP_NAME;
  } catch {
    return DEFAULT_APP_NAME;
  }
});

export async function setAppName(name: string): Promise<void> {
  const value = name.trim().slice(0, 60) || DEFAULT_APP_NAME;
  await prisma.appSetting.upsert({
    where: { key: "appName" },
    update: { value },
    create: { key: "appName", value },
  });
}

export const DEFAULT_ACCENT_COLOR = "indigo";

/** Admin-chosen default accent color id (falls back to indigo). */
export const getDefaultAccentColor = cache(async (): Promise<string> => {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: "defaultAccentColor" } });
    const v = row?.value.trim();
    const { isAccentId } = await import("./accent");
    return v && isAccentId(v) ? v : DEFAULT_ACCENT_COLOR;
  } catch {
    return DEFAULT_ACCENT_COLOR;
  }
});

export async function setDefaultAccentColor(id: string): Promise<void> {
  const { isAccentId, DEFAULT_ACCENT_ID } = await import("./accent");
  const value = isAccentId(id) ? id : DEFAULT_ACCENT_ID;
  await prisma.appSetting.upsert({
    where: { key: "defaultAccentColor" },
    update: { value },
    create: { key: "defaultAccentColor", value },
  });
}

/** The user's own stored accent choice, or null when they follow the org default. */
export async function getUserAccentChoice(userId: string): Promise<string | null> {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { accentColor: true } });
    const { isAccentId } = await import("./accent");
    return user?.accentColor && isAccentId(user.accentColor) ? user.accentColor : null;
  } catch {
    return null;
  }
}

/** Effective accent for a user: their choice, else the admin default. */
export async function getUserAccentColor(userId: string): Promise<string> {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { accentColor: true } });
    const { isAccentId } = await import("./accent");
    if (user?.accentColor && isAccentId(user.accentColor)) return user.accentColor;
  } catch {
    /* fall through */
  }
  return getDefaultAccentColor();
}
