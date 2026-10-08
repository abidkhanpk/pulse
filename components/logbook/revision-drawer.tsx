"use client";

import * as React from "react";
import {
  Plus,
  Pencil,
  Send,
  CheckCircle2,
  Undo2,
  Trash2,
  History as HistoryIcon,
  ChevronDown,
  GitCompareArrows,
  X,
} from "lucide-react";
import { Sheet, SheetHeader, SheetTitle, SheetBody } from "@/components/ui/overlay";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { RevisionView } from "@/app/(app)/logbook/actions";
import { diffWords, textsEqual } from "@/lib/diff";
import { cn } from "@/lib/utils";

const KIND_META: Record<
  RevisionView["kind"],
  { label: string; icon: React.ComponentType<{ className?: string }>; bubble: string }
> = {
  CREATED: { label: "Created", icon: Plus, bubble: "bg-emerald-500" },
  EDITED: { label: "Edited", icon: Pencil, bubble: "bg-blue-500" },
  SUBMITTED: { label: "Submitted for review", icon: Send, bubble: "bg-indigo-500" },
  REVIEWED: { label: "Approved", icon: CheckCircle2, bubble: "bg-green-600" },
  RETURNED: { label: "Returned to draft", icon: Undo2, bubble: "bg-amber-500" },
  DELETED: { label: "Deleted", icon: Trash2, bubble: "bg-red-500" },
  RESTORED: { label: "Restored", icon: HistoryIcon, bubble: "bg-teal-500" },
};

function timeAgo(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" });
}

function fullDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Karachi",
  });
}

/** Rendered word diff: deletions red strikethrough, additions green. */
function DiffText({ oldText, newText }: { oldText: string | null; newText: string | null }) {
  const tokens = React.useMemo(() => diffWords(oldText, newText), [oldText, newText]);
  if (tokens.length === 0) return <span className="text-slate-400">—</span>;
  return (
    <span className="whitespace-pre-wrap">
      {tokens.map((t, i) =>
        t.type === "same" ? (
          <span key={i}>{t.text}</span>
        ) : t.type === "add" ? (
          <span key={i} className="rounded bg-emerald-100 px-0.5 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
            {t.text}
          </span>
        ) : (
          <span key={i} className="rounded bg-red-100 px-0.5 text-red-900 line-through dark:bg-red-950 dark:text-red-200">
            {t.text}
          </span>
        ),
      )}
    </span>
  );
}

function FieldDiff({
  label,
  oldText,
  newText,
}: {
  label: string;
  oldText: string | null;
  newText: string | null;
}) {
  const changed = !textsEqual(oldText, newText);
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label} {changed ? <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-amber-800 dark:bg-amber-950 dark:text-amber-300">changed</span> : <span className="ml-1 text-slate-300 dark:text-slate-600">unchanged</span>}
      </p>
      {changed ? (
        <p className="text-sm text-slate-700 dark:text-slate-200">
          <DiffText oldText={oldText} newText={newText} />
        </p>
      ) : (
        <p className="whitespace-pre-wrap text-sm text-slate-500 dark:text-slate-400">{newText || "—"}</p>
      )}
    </div>
  );
}

function MetaChange({ label, oldValue, newValue }: { label: string; oldValue: string | null; newValue: string | null }) {
  if ((oldValue ?? "") === (newValue ?? "")) return null;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-16 shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      <span className="rounded bg-red-100 px-2 py-0.5 text-red-900 line-through dark:bg-red-950 dark:text-red-200">{oldValue || "—"}</span>
      <span className="text-slate-400">→</span>
      <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">{newValue || "—"}</span>
    </div>
  );
}

export interface HistoryEntry {
  id: string;
  summary: string;
  date: string;
  status: string;
  revisionCount: number;
  user: { id: string; name: string };
}

export function RevisionDrawer({
  entry,
  revisions,
  error,
  open,
  onClose,
}: {
  entry: HistoryEntry | null;
  /** null while loading */
  revisions: RevisionView[] | null;
  error: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const [expanded, setExpanded] = React.useState<number | null>(null);
  const [compareMode, setCompareMode] = React.useState(false);
  const [pickA, setPickA] = React.useState<number | null>(null);
  const [pickB, setPickB] = React.useState<number | null>(null);
  const loading = revisions === null && error === null;

  function togglePick(no: number) {
    if (pickA === no) setPickA(null);
    else if (pickB === no) setPickB(null);
    else if (pickA === null) setPickA(no);
    else if (pickB === null) setPickB(no);
    else setPickA(no); // replace oldest pick
  }

  const rows = revisions ?? [];
  const revA = pickA !== null ? rows.find((r) => r.revisionNo === pickA) ?? null : null;
  const revB = pickB !== null ? rows.find((r) => r.revisionNo === pickB) ?? null : null;
  const [before, after] =
    revA && revB
      ? revA.revisionNo < revB.revisionNo
        ? [revA, revB]
        : [revB, revA]
      : [null, null];

  return (
    <Sheet open={open} onClose={onClose} className="max-w-lg">
      <SheetHeader>
        <SheetTitle>Revision history</SheetTitle>
        {entry && (
          <div className="mt-2">
            <p className="pr-8 font-medium text-slate-900 dark:text-slate-100">{entry.summary}</p>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>{entry.date}</span>
              <span>·</span>
              <span>{entry.user.name}</span>
              <Badge color={entry.status === "REVIEWED" ? "success" : entry.status === "SUBMITTED" ? "info" : "default"}>
                {entry.status}
              </Badge>
              <span>·</span>
              <span>{rows.length} revision{rows.length === 1 ? "" : "s"}</span>
            </p>
          </div>
        )}
      </SheetHeader>
      <SheetBody>
        {loading && <p className="py-8 text-center text-sm text-slate-500">Loading history…</p>}
        {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}
        {!loading && !error && (
          <>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Every save, status change, and deletion is recorded — nothing is lost.
              </p>
              <Button
                size="sm"
                variant={compareMode ? "secondary" : "outline"}
                onClick={() => {
                  setCompareMode((v) => !v);
                  setPickA(null);
                  setPickB(null);
                }}
              >
                <GitCompareArrows className="mr-1.5 h-3.5 w-3.5" />
                Compare
              </Button>
            </div>

            {compareMode && before && after && (
              <div className="mb-5 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2 dark:border-slate-700 dark:bg-slate-800">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Revision {before.revisionNo} <span className="font-normal text-slate-400">({KIND_META[before.kind].label})</span>
                    {" → "}
                    Revision {after.revisionNo} <span className="font-normal text-slate-400">({KIND_META[after.kind].label})</span>
                  </p>
                  <button
                    onClick={() => {
                      setPickA(null);
                      setPickB(null);
                    }}
                    aria-label="Clear comparison"
                    className="rounded p-1 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-4 px-4 py-3">
                  <FieldDiff label="Summary" oldText={before.summary} newText={after.summary} />
                  <FieldDiff label="Details" oldText={before.details} newText={after.details} />
                  <div className="space-y-1.5">
                    <MetaChange label="Project" oldValue={before.projectName} newValue={after.projectName} />
                    <MetaChange label="Date" oldValue={before.date} newValue={after.date} />
                    <MetaChange label="Status" oldValue={before.status} newValue={after.status} />
                  </div>
                </div>
              </div>
            )}
            {compareMode && (!before || !after) && (
              <p className="mb-4 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                Tick two revisions below to compare them side by side.
              </p>
            )}

            <div className="relative">
              <div className="absolute bottom-4 left-4 top-2 w-px bg-slate-200 dark:bg-slate-700" />
              <div className="space-y-1">
                {rows.map((r) => {
                  const meta = KIND_META[r.kind];
                  const Icon = meta.icon;
                  const isOpen = expanded === r.revisionNo;
                  const picked = pickA === r.revisionNo || pickB === r.revisionNo;
                  return (
                    <div key={r.id} className="relative pl-12 pb-5">
                      <div
                        className={cn(
                          "absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full text-white shadow",
                          meta.bubble,
                          r.kind === "DELETED" && "ring-2 ring-red-200 dark:ring-red-900",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div
                        className={cn(
                          "rounded-xl border px-4 py-3 transition-colors",
                          picked
                            ? "border-indigo-400 bg-indigo-50/60 dark:border-indigo-600 dark:bg-indigo-950/40"
                            : "border-slate-200 dark:border-slate-700",
                          r.kind === "DELETED" && "border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/30",
                        )}
                      >
                        <div className="flex items-start gap-2">
                          {compareMode && (
                            <input
                              type="checkbox"
                              checked={picked}
                              onChange={() => togglePick(r.revisionNo)}
                              aria-label={`Select revision ${r.revisionNo} for comparison`}
                              className="mt-1 h-4 w-4 shrink-0 accent-indigo-600"
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                {meta.label}
                              </span>
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                rev {r.revisionNo}
                              </span>
                              <span className="text-xs text-slate-500 dark:text-slate-400">by {r.actorName}</span>
                              <span className="text-xs text-slate-400" title={fullDateTime(r.createdAt)}>
                                · {timeAgo(r.createdAt)}
                              </span>
                            </div>
                            {r.note && (
                              <p className="mt-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs italic text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                “{r.note}”
                              </p>
                            )}
                            <button
                              onClick={() => setExpanded(isOpen ? null : r.revisionNo)}
                              className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400"
                            >
                              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")} />
                              {isOpen ? "Hide snapshot" : "View snapshot"}
                            </button>
                            {isOpen && (
                              <div className="mt-2 space-y-2 border-t border-slate-100 pt-2 dark:border-slate-700">
                                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                                  {r.projectName && <span className="font-medium text-indigo-600 dark:text-indigo-400">{r.projectName}</span>}
                                  <span>{r.date}</span>
                                  <Badge color={r.status === "REVIEWED" ? "success" : r.status === "SUBMITTED" ? "info" : "default"}>
                                    {r.status}
                                  </Badge>
                                </div>
                                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{r.summary}</p>
                                {r.details && (
                                  <p className="whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{r.details}</p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {rows.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-500">No revisions recorded yet.</p>
            )}
          </>
        )}
      </SheetBody>
    </Sheet>
  );
}
