"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label, Select, FieldError } from "@/components/ui/input";
import { Dialog, DialogTitle } from "@/components/ui/overlay";
import { Card, CardHeader, CardTitle, CardContent, Badge } from "@/components/ui/card";
import { Tabs } from "@/components/ui/misc";
import { EmptyState } from "@/components/ui/misc";
import {
  createEntry,
  updateEntry,
  submitEntry,
  deleteEntry,
  reviewEntry,
  listEntries,
  reviewQueue,
  weeklyDigest,
  thisWeekMonday,
} from "@/app/(app)/logbook/actions";

interface Entry {
  id: string;
  date: string;
  summary: string;
  details: string | null;
  status: string;
  reviewComment: string | null;
  user: { id: string; name: string };
  project: { id: string; name: string } | null;
  reviewedBy: { id: string; name: string } | null;
}

const STATUS_COLORS: Record<string, "default" | "info" | "success" | "warning"> = {
  DRAFT: "default",
  SUBMITTED: "info",
  REVIEWED: "success",
};

function EntryCard({
  entry,
  mine,
  onEdit,
  onSubmit,
  onDelete,
  onReview,
}: {
  entry: Entry;
  mine: boolean;
  onEdit: () => void;
  onSubmit: () => void;
  onDelete: () => void;
  onReview: (approved: boolean, comment: string) => void;
}) {
  const [reviewing, setReviewing] = React.useState(false);
  const [comment, setComment] = React.useState("");
  return (
    <Card>
      <CardContent className="!py-4">
        <div className="flex flex-wrap items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge color={STATUS_COLORS[entry.status] ?? "default"}>{entry.status}</Badge>
              <span className="text-xs text-slate-400">{entry.date}</span>
              {!mine && <span className="text-xs font-medium text-slate-600">{entry.user.name}</span>}
              {entry.project && <span className="text-xs text-indigo-600">{entry.project.name}</span>}
            </div>
            <p className="mt-1.5 font-medium text-slate-900">{entry.summary}</p>
            {entry.details && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{entry.details}</p>}
            {entry.reviewComment && (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <span className="font-medium">Reviewer note:</span> {entry.reviewComment}
              </p>
            )}
            {entry.status === "REVIEWED" && entry.reviewedBy && (
              <p className="mt-1 text-xs text-slate-400">Reviewed by {entry.reviewedBy.name}</p>
            )}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {mine && entry.status !== "REVIEWED" && (
            <>
              <Button variant="outline" size="sm" onClick={onEdit}>Edit</Button>
              {entry.status === "DRAFT" && (
                <>
                  <Button size="sm" onClick={onSubmit}>Submit for review</Button>
                  <Button variant="ghost" size="sm" className="text-red-600" onClick={onDelete}>Delete</Button>
                </>
              )}
            </>
          )}
          {!mine && entry.status === "SUBMITTED" && (
            <>
              {!reviewing ? (
                <Button variant="outline" size="sm" onClick={() => setReviewing(true)}>Review</Button>
              ) : (
                <div className="flex w-full flex-col gap-2">
                  <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Reviewer note (optional)" rows={2} />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => onReview(true, comment)}>Approve</Button>
                    <Button size="sm" variant="secondary" onClick={() => onReview(false, comment)}>Return to draft</Button>
                    <Button size="sm" variant="ghost" onClick={() => setReviewing(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function LogbookClient({
  initialEntries,
  projects,
  canReview,
  initialQueue,
  people,
  userId,
}: {
  initialEntries: Entry[];
  projects: { id: string; name: string }[];
  canReview: boolean;
  initialQueue: Entry[];
  people: { id: string; name: string }[];
  userId: string;
}) {
  const router = useRouter();
  const [tab, setTab] = React.useState("mine");
  const [entries, setEntries] = React.useState(initialEntries);
  const [queue, setQueue] = React.useState(initialQueue);
  const [digest, setDigest] = React.useState<Awaited<ReturnType<typeof weeklyDigest>>>([]);
  const [weekStart, setWeekStart] = React.useState(thisWeekMonday());

  // filters
  const [search, setSearch] = React.useState("");
  const [projectId, setProjectId] = React.useState("");
  const [personId, setPersonId] = React.useState("");
  const [status, setStatus] = React.useState("");

  // form
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Entry | null>(null);
  const [fDate, setFDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [fProject, setFProject] = React.useState("");
  const [fSummary, setFSummary] = React.useState("");
  const [fDetails, setFDetails] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function refresh() {
    const [e, q] = await Promise.all([
      listEntries({ search: search.trim() || undefined, projectId: projectId || undefined, userId: personId || undefined, status: (status as never) || undefined, mineOnly: tab === "mine" }),
      canReview ? reviewQueue() : Promise.resolve([]),
    ]);
    setEntries(e.map(ser));
    setQueue(q.map(ser));
  }

  type RawEntry = Awaited<ReturnType<typeof listEntries>>[number];

  function ser(e: RawEntry): Entry {
    return {
      id: e.id,
      date: e.date instanceof Date ? e.date.toISOString().slice(0, 10) : String(e.date).slice(0, 10),
      summary: e.summary,
      details: e.details,
      status: e.status,
      reviewComment: e.reviewComment,
      user: e.user,
      project: e.project,
      reviewedBy: e.reviewedBy,
    };
  }

  React.useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function loadDigest() {
    setDigest(await weeklyDigest(weekStart));
  }

  React.useEffect(() => {
    if (tab === "digest") loadDigest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, weekStart]);

  function startCreate() {
    setEditing(null);
    setFDate(new Date().toISOString().slice(0, 10));
    setFProject("");
    setFSummary("");
    setFDetails("");
    setError(null);
    setFormOpen(true);
  }

  function startEdit(e: Entry) {
    setEditing(e);
    setFDate(e.date);
    setFProject(e.project?.id ?? "");
    setFSummary(e.summary);
    setFDetails(e.details ?? "");
    setError(null);
    setFormOpen(true);
  }

  async function onSubmitForm(ev: React.FormEvent) {
    ev.preventDefault();
    setError(null);
    if (!fSummary.trim()) return setError("Summary is required.");
    setPending(true);
    try {
      const payload = { projectId: fProject || null, date: fDate, summary: fSummary.trim(), details: fDetails.trim() || null };
      const res = editing ? await updateEntry(editing.id, payload) : await createEntry(payload);
      if (!res.ok) setError(res.error);
      else {
        setFormOpen(false);
        refresh();
      }
    } finally {
      setPending(false);
    }
  }

  async function doSubmit(id: string) {
    const res = await submitEntry(id);
    if (!res.ok) alert(res.error);
    else refresh();
  }

  async function doDelete(id: string) {
    if (!confirm("Delete this draft?")) return;
    const res = await deleteEntry(id);
    if (!res.ok) alert(res.error);
    else refresh();
  }

  async function doReview(id: string, approved: boolean, comment: string) {
    const res = await reviewEntry({ id, approved, comment: comment || null });
    if (!res.ok) alert(res.error);
    else {
      refresh();
      router.refresh();
    }
  }

  const tabs = [
    { id: "mine", label: "My entries" },
    ...(canReview
      ? [
          { id: "review", label: "Review queue", badge: queue.length },
          { id: "digest", label: "Weekly digest" },
        ]
      : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Logbook</h1>
          <p className="text-sm text-slate-500">Daily record of project work.</p>
        </div>
        <div className="ml-auto">
          <Button onClick={startCreate}>New entry</Button>
        </div>
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === "digest" ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="digest-week" className="!mb-0 text-sm">Week of</Label>
            <Input id="digest-week" type="date" value={weekStart} onChange={(e) => e.target.value && setWeekStart(e.target.value)} className="w-44" />
          </div>
          {digest.map((d) => (
            <Card key={d.date}>
              <CardHeader>
                <CardTitle className="text-sm">
                  {new Date(d.date + "T00:00:00Z").toLocaleDateString("en-PK", { weekday: "long", day: "numeric", month: "short", timeZone: "Asia/Karachi" })}
                  <span className="ml-2 font-normal text-slate-400">{d.entries.length} entries</span>
                </CardTitle>
              </CardHeader>
              {d.entries.length > 0 && (
                <CardContent className="space-y-2">
                  {d.entries.map((e) => (
                    <div key={e.id} className="rounded-lg border border-slate-100 px-3 py-2 text-sm">
                      <span className="font-medium text-slate-800">{e.userName}</span>
                      {e.projectName && <span className="ml-2 text-xs text-indigo-600">{e.projectName}</span>}
                      <span className="ml-2"><Badge color={STATUS_COLORS[e.status] ?? "default"}>{e.status}</Badge></span>
                      <p className="mt-0.5 text-slate-600">{e.summary}</p>
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-2">
            <Input
              placeholder="Search entries…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && refresh()}
              className="w-52"
            />
            <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-44">
              <option value="">All projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
            {canReview && tab === "review" && (
              <Select value={personId} onChange={(e) => setPersonId(e.target.value)} className="w-44">
                <option value="">Everyone</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            )}
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-36">
              <option value="">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="REVIEWED">Reviewed</option>
            </Select>
            <Button size="sm" onClick={refresh}>Filter</Button>
          </div>

          {(tab === "mine" ? entries : queue).length === 0 ? (
            <EmptyState
              title={tab === "mine" ? "No entries yet" : "Review queue is empty"}
              description={tab === "mine" ? "Write your first logbook entry for today." : "Nothing waiting for review."}
              action={tab === "mine" ? <Button onClick={startCreate}>New entry</Button> : undefined}
            />
          ) : (
            <div className="space-y-3">
              {(tab === "mine" ? entries : queue).map((e) => (
                <EntryCard
                  key={e.id}
                  entry={e}
                  mine={e.user.id === userId}
                  onEdit={() => startEdit(e)}
                  onSubmit={() => doSubmit(e.id)}
                  onDelete={() => doDelete(e.id)}
                  onReview={(approved, comment) => doReview(e.id, approved, comment)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Entry form dialog */}
      <Dialog open={formOpen} onClose={() => setFormOpen(false)} className="max-w-xl">
        <DialogTitle>{editing ? "Edit entry" : "New logbook entry"}</DialogTitle>
        <form onSubmit={onSubmitForm} className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="le-date">Date</Label>
              <Input id="le-date" type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="le-project">Project (optional)</Label>
              <Select id="le-project" value={fProject} onChange={(e) => setFProject(e.target.value)}>
                <option value="">None</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="le-summary">Summary</Label>
            <Input id="le-summary" value={fSummary} onChange={(e) => setFSummary(e.target.value)} placeholder="What did you work on today?" />
          </div>
          <div>
            <Label htmlFor="le-details">Details (optional)</Label>
            <Textarea id="le-details" value={fDetails} onChange={(e) => setFDetails(e.target.value)} rows={4} placeholder="Findings, blockers, next steps…" />
          </div>
          <FieldError message={error ?? undefined} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : editing ? "Save" : "Save draft"}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
