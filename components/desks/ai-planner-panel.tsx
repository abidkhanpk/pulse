"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label, Select, Switch } from "@/components/ui/input";
import {
  askAiPlanner,
  type AvailabilityInput,
  type AvailabilityResult,
} from "@/app/(app)/desks/actions";
import type { Priority } from "@/components/projects/kanban";

/**
 * "Ask AI" for the availability finder — incharges only. Sends the
 * anonymized snapshot (Person/DESK/Project tokens) to the lab's own AI
 * provider and shows the de-anonymized answer. Suggestions only.
 */
export function AiPlannerPanel({
  labId,
  configured,
  providerLabel,
  ctx,
}: {
  labId: string;
  configured: boolean;
  providerLabel: string | null;
  ctx: { input: AvailabilityInput; result: AvailabilityResult } | null;
}) {
  const [planIfUnavailable, setPlanIfUnavailable] = React.useState(true);
  const [keepExistingPriority, setKeepExistingPriority] = React.useState(true);
  const [newPriority, setNewPriority] = React.useState<Priority>("NORMAL");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [answer, setAnswer] = React.useState<string | null>(null);

  async function onAsk() {
    if (!ctx) return;
    setError(null);
    setAnswer(null);
    setPending(true);
    try {
      const res = await askAiPlanner({
        ...ctx.input,
        planIfUnavailable,
        keepExistingPriority,
        newProjectPriority: newPriority,
      });
      if (!res.ok) setError(res.error);
      else setAnswer(res.text);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-accent-600" /> Ask AI to plan
          {providerLabel && <span className="text-xs font-normal text-slate-400">via {providerLabel}</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!configured ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            AI planning isn&apos;t set up for this lab yet. As its incharge, add your provider and API key under
            Labs → AI planning — then you can ask the AI to suggest accommodation plans here. Bookings are
            anonymized before anything is sent.
          </p>
        ) : !ctx ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Run an availability search above first — the AI plans from that request plus the lab&apos;s current
            bookings.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <Switch checked={planIfUnavailable} onChange={setPlanIfUnavailable} />
                Suggest a plan if nothing is available
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <Switch checked={keepExistingPriority} onChange={setKeepExistingPriority} />
                Existing teams keep priority (first come, first served)
              </label>
              <div className="flex items-center gap-2">
                <Label htmlFor="ai-new-priority" className="mb-0">New project priority</Label>
                <Select id="ai-new-priority" value={newPriority} onChange={(e) => setNewPriority(e.target.value as Priority)} className="w-32">
                  <option value="LOW">Low</option>
                  <option value="NORMAL">Normal</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </Select>
              </div>
            </div>
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <div>
              <Button onClick={onAsk} disabled={pending}>
                {pending ? "Asking the AI… (up to a minute)" : "Ask AI"}
              </Button>
              <span className="ml-2 text-xs text-slate-400">
                Suggestions only — the AI never books, moves, or cancels anything.
              </span>
            </div>
            {answer && (
              <div className="rounded-sm border border-accent-200 bg-accent-50/60 p-3 dark:border-accent-900 dark:bg-accent-950/40">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-accent-700 dark:text-accent-300">
                  AI suggestion
                </p>
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800 dark:text-slate-100">
                  {answer}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
