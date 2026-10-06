import { requirePermission } from "@/lib/auth-helpers";
import { listLabs } from "./actions";
import { LabsClient } from "@/components/labs/labs-client";

export default async function LabsPage() {
  await requirePermission("labs.manage");
  const labs = await listLabs();
  return <LabsClient labs={labs} />;
}
