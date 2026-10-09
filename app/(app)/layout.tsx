import { requireUser } from "@/lib/auth-helpers";
import { getAppName, getUserAccentColor, getUserAccentChoice, getDefaultAccentColor } from "@/lib/app-settings";
import { isCheckInVisible } from "./check-in/actions";
import { AppShell } from "@/components/layout/app-shell";
import { AccentRoot } from "@/components/theme-accent";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireUser();
  const [appName, showCheckIn, accent, accentChoice, defaultAccent] = await Promise.all([
    getAppName(),
    isCheckInVisible(actor.id),
    getUserAccentColor(actor.id),
    getUserAccentChoice(actor.id),
    getDefaultAccentColor(),
  ]);
  return (
    <>
      <AccentRoot accent={accent} />
      <AppShell actor={actor} appName={appName} showCheckIn={showCheckIn} accentChoice={accentChoice} defaultAccent={defaultAccent}>
        {children}
      </AppShell>
    </>
  );
}
