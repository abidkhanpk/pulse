import { requireUser } from "@/lib/auth-helpers";
import { getAppName } from "@/lib/app-settings";
import { isCheckInEnabled } from "./check-in/actions";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [actor, appName, showCheckIn] = await Promise.all([
    requireUser(),
    getAppName(),
    isCheckInEnabled((await requireUser()).id),
  ]);
  return (
    <AppShell actor={actor} appName={appName} showCheckIn={showCheckIn}>
      {children}
    </AppShell>
  );
}
