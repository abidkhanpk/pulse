import { requireUser } from "@/lib/auth-helpers";
import { getAppName, getUserAccentColor } from "@/lib/app-settings";
import { isCheckInVisible } from "./check-in/actions";
import { AppShell } from "@/components/layout/app-shell";
import { AccentRoot } from "@/components/theme-accent";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireUser();
  const [appName, showCheckIn, accent] = await Promise.all([
    getAppName(),
    isCheckInVisible(actor.id),
    getUserAccentColor(actor.id),
  ]);
  return (
    <>
      <AccentRoot accent={accent} />
      <AppShell actor={actor} appName={appName} showCheckIn={showCheckIn}>
        {children}
      </AppShell>
    </>
  );
}
