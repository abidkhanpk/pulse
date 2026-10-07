import { requireUser } from "@/lib/auth-helpers";
import { attendanceContext } from "./actions";
import { CheckInClient } from "@/components/check-in/check-in-client";
import { ManualRegister } from "@/components/check-in/manual-register";
import { EmptyState } from "@/components/ui/misc";

export default async function CheckInPage() {
  const actor = await requireUser();
  const ctx = await attendanceContext();

  if (ctx.mode === "NONE") {
    return (
      <div className="mx-auto max-w-lg pt-10">
        <EmptyState
          title="Attendance is disabled"
          description={`Check-in / check-out is turned off for ${ctx.labName ?? "your lab"} by the lab incharge.`}
        />
      </div>
    );
  }

  if (ctx.mode === "MANUAL") {
    if (!ctx.canMark || !actor.labId) {
      return (
        <div className="mx-auto max-w-lg pt-10">
          <EmptyState
            title="Manual attendance"
            description={`Your attendance for ${ctx.labName ?? "your lab"} is marked by your lab incharge or designated person.`}
          />
        </div>
      );
    }
    return <ManualRegister labId={actor.labId} labName={ctx.labName ?? ""} />;
  }

  return <CheckInClient />;
}
