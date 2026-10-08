"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { updateOrganization } from "@/app/(app)/labs/actions";
import { updateAppName, updateDefaultAccentColor } from "@/app/(app)/settings/actions";
import { ACCENTS } from "@/lib/accent";
import { cn } from "@/lib/utils";

export function OrganizationClient({
  initialName,
  initialAppName,
  initialAccent,
}: {
  initialName: string;
  initialAppName: string;
  initialAccent: string;
}) {
  const [name, setName] = React.useState(initialName);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (!name.trim()) return setError("Name is required.");
    setPending(true);
    try {
      const res = await updateOrganization({ name: name.trim() });
      if (!res.ok) setError(res.error);
      else setSaved(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="max-w-xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Organization</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Shown across the app wherever the lab name appears.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Organization name</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <Label htmlFor="org-name">Name</Label>
              <Input id="org-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <FieldError message={error ?? undefined} />
            {saved && <p className="text-sm text-emerald-600">Saved.</p>}
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </form>
        </CardContent>
      </Card>
      <AppNameCard initialAppName={initialAppName} />
      <DefaultAccentCard initialAccent={initialAccent} />
    </div>
  );
}

function DefaultAccentCard({ initialAccent }: { initialAccent: string }) {
  const [accent, setAccent] = React.useState(initialAccent);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  async function onSave() {
    setError(null);
    setSaved(false);
    setPending(true);
    try {
      const res = await updateDefaultAccentColor({ accentId: accent });
      if (!res.ok) setError(res.error);
      else setSaved(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Default accent color</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
          Used on the login page and for users who haven't picked their own accent color.
        </p>
        <div className="mb-4 flex flex-wrap gap-3">
          {ACCENTS.map((a) => {
            const active = a.id === accent;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  setAccent(a.id);
                  setSaved(false);
                }}
                className="group flex flex-col items-center gap-1.5"
                title={a.name}
              >
                <span
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200 group-hover:scale-110",
                    active && "ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900"
                  )}
                  style={{ backgroundColor: a.swatch, ["--tw-ring-color" as string]: a.swatch } as React.CSSProperties}
                />
                <span className={cn("text-xs", active ? "font-semibold text-slate-800 dark:text-slate-200" : "text-slate-500 dark:text-slate-400")}>
                  {a.name}
                </span>
              </button>
            );
          })}
        </div>
        <FieldError message={error ?? undefined} />
        {saved && <p className="mb-2 text-sm text-emerald-600">Saved.</p>}
        <Button onClick={onSave} disabled={pending || accent === initialAccent}>
          {pending ? "Saving…" : "Save default color"}
        </Button>
      </CardContent>
    </Card>
  );
}

function AppNameCard({ initialAppName }: { initialAppName: string }) {
  const [appName, setAppNameState] = React.useState(initialAppName);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (!appName.trim()) return setError("Name is required.");
    setPending(true);
    try {
      const res = await updateAppName({ name: appName.trim() });
      if (!res.ok) setError(res.error);
      else setSaved(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Application name</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
          Shown in the sidebar, login page and browser tab.
        </p>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <Label htmlFor="app-name">Name</Label>
            <Input id="app-name" value={appName} onChange={(e) => setAppNameState(e.target.value)} maxLength={60} />
          </div>
          <FieldError message={error ?? undefined} />
          {saved && <p className="text-sm text-emerald-600">Saved. Reload the page to see it everywhere.</p>}
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
