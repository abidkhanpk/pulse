"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, FieldError } from "@/components/ui/input";
import { updateLabAiConfig } from "@/app/(app)/labs/actions";
import { AI_PROVIDERS, type AiProviderId } from "@/lib/ai-providers";

/**
 * Per-lab AI planning settings, owned by the lab's incharge: their own
 * provider + API key. The key is write-only — after saving it is never
 * shown again; leaving the field blank keeps the stored key.
 */
export function LabAiSettings({
  labId,
  initialProvider,
  initialModel,
  initialKeySet,
}: {
  labId: string;
  initialProvider: string | null;
  initialModel: string | null;
  initialKeySet: boolean;
}) {
  const [provider, setProvider] = React.useState<string>(initialProvider ?? "");
  const [model, setModel] = React.useState(initialModel ?? "");
  const [apiKey, setApiKey] = React.useState("");
  const [keySet, setKeySet] = React.useState(initialKeySet);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const defaultModel = AI_PROVIDERS.find((p) => p.id === provider)?.defaultModel;

  async function save(clearKey = false) {
    setError(null);
    setSaved(false);
    setPending(true);
    try {
      const res = await updateLabAiConfig(labId, {
        provider: (provider || null) as AiProviderId | null,
        model: model.trim() || null,
        ...(clearKey ? { clearKey: true } : apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
      });
      if (!res.ok) setError(res.error);
      else {
        setSaved(true);
        if (clearKey) setKeySet(false);
        if (apiKey.trim()) setKeySet(true);
        setApiKey("");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/40">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">AI planning</p>
        {saved && <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Saved ✓</span>}
      </div>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
        Your own AI provider and key, used only by this lab&apos;s incharges in the Availability finder.
        Bookings are anonymized (Person 1, Desk 1, Project 1…) before anything is sent, and real names are
        restored in the answer. The key is stored on the server and never shown again.
      </p>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <Label htmlFor={`ai-provider-${labId}`}>Provider</Label>
          <Select id={`ai-provider-${labId}`} value={provider} onChange={(e) => setProvider(e.target.value)}>
            <option value="">Not configured</option>
            {AI_PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor={`ai-model-${labId}`}>Model (optional)</Label>
          <Input
            id={`ai-model-${labId}`}
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={defaultModel ?? "Provider default"}
          />
        </div>
      </div>
      <div className="mt-2">
        <Label htmlFor={`ai-key-${labId}`}>API key {keySet && <span className="font-normal text-emerald-600 dark:text-emerald-400">— one is saved</span>}</Label>
        <Input
          id={`ai-key-${labId}`}
          type="password"
          autoComplete="off"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={keySet ? "Leave blank to keep the saved key" : "Paste your API key"}
        />
      </div>
      <FieldError message={error ?? undefined} />
      <div className="mt-2 flex gap-2">
        <Button size="sm" onClick={() => save(false)} disabled={pending}>
          {pending ? "Saving…" : "Save AI settings"}
        </Button>
        {keySet && (
          <Button size="sm" variant="outline" onClick={() => save(true)} disabled={pending}>
            Remove key
          </Button>
        )}
      </div>
    </div>
  );
}
