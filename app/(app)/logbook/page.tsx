import { requireUser } from "@/lib/auth-helpers";
import { hasPermission } from "@/lib/permissions";
import { listEntries, reviewQueue, entryProjects, entryPeople } from "./actions";
import { LogbookClient } from "@/components/logbook/logbook-client";

type Entry = Awaited<ReturnType<typeof listEntries>>[number];

function ser(e: Entry) {
  return {
    id: e.id,
    date: e.date.toISOString().slice(0, 10),
    summary: e.summary,
    details: e.details,
    status: e.status,
    reviewComment: e.reviewComment,
    user: e.user,
    project: e.project,
    reviewedBy: e.reviewedBy,
  };
}

export default async function LogbookPage() {
  const actor = await requireUser();
  const canReview = hasPermission(actor, "logbook.review");
  const [entries, queue, projects, people] = await Promise.all([
    listEntries({ mineOnly: true }),
    canReview ? reviewQueue() : Promise.resolve([]),
    entryProjects(),
    entryPeople(),
  ]);
  return (
    <LogbookClient
      initialEntries={entries.map(ser)}
      projects={projects}
      canReview={canReview}
      initialQueue={queue.map(ser)}
      people={people}
      userId={actor.id}
    />
  );
}
