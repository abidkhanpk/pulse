import { requireUser } from "@/lib/auth-helpers";
import { CheckInClient } from "@/components/check-in/check-in-client";

export default async function CheckInPage() {
  await requireUser();
  return <CheckInClient />;
}
