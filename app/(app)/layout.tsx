import { requireUser } from "@/lib/auth-helpers";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireUser();
  return <AppShell actor={actor}>{children}</AppShell>;
}
