import { cache } from "react";
import { prisma } from "@/lib/prisma";

export const DEFAULT_APP_NAME = "Pulse";

/** App display name, editable by admin in Settings. Falls back to "Pulse". */
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
