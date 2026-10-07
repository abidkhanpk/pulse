"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { updateOrganization } from "@/app/(app)/labs/actions";
import { updateAppName } from "@/app/(app)/settings/actions";

export function OrganizationClient({ initialName, initialAppName }: { initialName: string; initialAppName: string }) {
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
    </div>
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
