"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label, Select, Checkbox, FieldError } from "@/components/ui/input";
import { Dialog, DialogTitle } from "@/components/ui/overlay";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/card";
import { Avatar, EmptyState } from "@/components/ui/misc";
import {
  createUser,
  updateUser,
  setUserStatus,
  resetPassword,
} from "@/app/(app)/people/actions";
import { ExtraDaysManager } from "./extra-days-manager";
import { ATTENDANCE_MODES, type AttendanceMode } from "@/lib/attendance";

interface Person {
  id: string;
  name: string;
  email: string;
  status: string;
  attendanceTracking: boolean;
  attendanceModeOverride: AttendanceMode | null;
  linkAttendanceToBooking: boolean;
  joinDate: string | null;
  role: { key: string; name: string };
  lab: { id: string; name: string } | null;
}

interface RoleOpt {
  id: string;
  key: string;
  name: string;
  scope: string;
}

export function PeopleClient({
  people,
  labs,
  roles,
}: {
  people: Person[];
  labs: { id: string; name: string }[];
  roles: RoleOpt[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Person | null>(null);
  const [pwFor, setPwFor] = React.useState<Person | null>(null);

  // form state
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [roleId, setRoleId] = React.useState("");
  const [labId, setLabId] = React.useState("");
  const [tracking, setTracking] = React.useState(true);
  const [joinDate, setJoinDate] = React.useState("");
  const [overrideOn, setOverrideOn] = React.useState(false);
  const [modeOverride, setModeOverride] = React.useState<AttendanceMode>("SELF");
  const [linkBooking, setLinkBooking] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const [search, setSearch] = React.useState(searchParams.get("q") ?? "");
  const [statusFilter, setStatusFilter] = React.useState(searchParams.get("status") ?? "");

  function startCreate() {
    setEditing(null);
    setName(""); setEmail(""); setPassword("");
    setRoleId(roles.find((r) => r.key === "INTERNEE")?.id ?? roles[0]?.id ?? "");
    setLabId(labs[0]?.id ?? "");
    setTracking(true); setJoinDate("");
    setOverrideOn(false); setModeOverride("SELF"); setLinkBooking(true);
    setError(null);
    setFormOpen(true);
  }

  function startEdit(p: Person) {
    setEditing(p);
    setName(p.name); setEmail(p.email); setPassword("");
    setRoleId(roles.find((r) => r.key === p.role.key)?.id ?? roles[0]?.id ?? "");
    setLabId(p.lab?.id ?? "");
    setTracking(p.attendanceTracking);
    setJoinDate(p.joinDate ? p.joinDate.slice(0, 10) : "");
    setOverrideOn(!!p.attendanceModeOverride);
    setModeOverride(p.attendanceModeOverride ?? "SELF");
    setLinkBooking(p.linkAttendanceToBooking);
    setError(null);
    setFormOpen(true);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const payload = {
        name: name.trim(),
        email: email.trim(),
        roleId,
        labId: labId || null,
        attendanceTracking: tracking,
        joinDate: joinDate || null,
        attendanceModeOverride: overrideOn ? modeOverride : null,
        linkAttendanceToBooking: linkBooking,
        ...(editing ? {} : { password }),
      };
      const res = editing
        ? await updateUser({ id: editing.id, ...payload })
        : await createUser(payload);
      if (!res.ok) setError(res.error);
      else {
        setFormOpen(false);
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  async function toggleStatus(p: Person) {
    if (p.status === "ACTIVE" && !confirm(`Deactivate ${p.name}? They will lose access immediately.`)) return;
    const res = await setUserStatus(p.id, p.status === "ACTIVE" ? "INACTIVE" : "ACTIVE");
    if (!res.ok) alert(res.error);
    else router.refresh();
  }

  async function doResetPassword() {
    if (!pwFor || !password || password.length < 8) return setError("Password must be at least 8 characters.");
    const res = await resetPassword({ id: pwFor.id, password });
    if (!res.ok) setError(res.error);
    else {
      setPwFor(null);
      setPassword("");
      alert("Password updated.");
    }
  }

  function applyFilters() {
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    if (statusFilter) params.set("status", statusFilter);
    const lab = searchParams.get("lab");
    if (lab) params.set("lab", lab);
    router.push(`/people?${params.toString()}`);
  }

  function changeLab(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("lab", id);
    else params.delete("lab");
    router.push(`/people?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">People</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{people.length} people</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            className="w-52"
          />
          <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); }} className="w-32">
            <option value="">All status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </Select>
          <Select value={searchParams.get("lab") ?? ""} onChange={(e) => changeLab(e.target.value)} className="w-44">
            <option value="">All labs</option>
            {labs.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </Select>
          <Button size="sm" onClick={applyFilters}>Filter</Button>
          <Button onClick={startCreate}>Add person</Button>
        </div>
      </div>

      {people.length === 0 ? (
        <EmptyState title="No people found" description="Try adjusting the filters, or add a person." action={<Button onClick={startCreate}>Add person</Button>} />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Person</TH>
              <TH>Role</TH>
              <TH>Lab</TH>
              <TH>Tracking</TH>
              <TH>Status</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <TBody>
            {people.map((p) => (
              <TR key={p.id}>
                <TD>
                  <Link href={`/people/${p.id}`} className="flex items-center gap-2 hover:underline">
                    <Avatar name={p.name} />
                    <span>
                      <span className="block font-medium text-slate-900 dark:text-slate-100">{p.name}</span>
                      <span className="block text-xs text-slate-400">{p.email}</span>
                    </span>
                  </Link>
                </TD>
                <TD><Badge color="default">{p.role.name}</Badge></TD>
                <TD>{p.lab?.name ?? "—"}</TD>
                <TD>{p.attendanceTracking ? <Badge color="success">On</Badge> : <Badge color="warning">Off</Badge>}</TD>
                <TD><Badge color={p.status === "ACTIVE" ? "success" : "danger"}>{p.status}</Badge></TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => startEdit(p)}>Edit</Button>
                    <Button variant="ghost" size="sm" onClick={() => { setPwFor(p); setPassword(""); setError(null); }}>
                      Password
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => toggleStatus(p)} className={p.status === "ACTIVE" ? "text-red-600" : "text-emerald-600"}>
                      {p.status === "ACTIVE" ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      {/* Add / edit dialog */}
      <Dialog open={formOpen} onClose={() => setFormOpen(false)} className="max-w-lg">
        <DialogTitle>{editing ? `Edit — ${editing.name}` : "Add person"}</DialogTitle>
        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="p-name">Full name</Label>
              <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="p-email">Email</Label>
              <Input id="p-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          {!editing && (
            <div>
              <Label htmlFor="p-pw">Password (min 8 chars)</Label>
              <Input id="p-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="p-role">Role</Label>
              <Select id="p-role" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name} ({r.scope})</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="p-lab">Lab</Label>
              <Select id="p-lab" value={labId} onChange={(e) => setLabId(e.target.value)}>
                <option value="">None</option>
                {labs.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="p-join">Join date (optional)</Label>
              <Input id="p-join" type="date" value={joinDate} onChange={(e) => setJoinDate(e.target.value)} />
            </div>
            <div className="flex items-end gap-2 pb-2">
              <Checkbox id="p-track" checked={tracking} onChange={(e) => setTracking(e.target.checked)} />
              <Label htmlFor="p-track" className="!mb-0">Attendance tracking</Label>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/40">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Attendance
            </p>
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox
                id="p-override"
                checked={overrideOn}
                onChange={(e) => setOverrideOn(e.target.checked)}
              />
              <Label htmlFor="p-override" className="!mb-0">
                Override lab attendance mode for this person
              </Label>
            </label>
            {overrideOn && (
              <div className="mt-2 space-y-1.5">
                {ATTENDANCE_MODES.map((m) => (
                  <label key={m.id} className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="p-mode-override"
                      checked={modeOverride === m.id}
                      onChange={() => setModeOverride(m.id)}
                      className="h-4 w-4 accent-accent-600"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      {m.label} <span className="text-xs text-slate-400">— {m.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
            <label className="mt-2 flex cursor-pointer items-center gap-2">
              <Checkbox
                id="p-linkbooking"
                checked={linkBooking}
                onChange={(e) => setLinkBooking(e.target.checked)}
              />
              <Label htmlFor="p-linkbooking" className="!mb-0">
                Count desk-booking days as working days
              </Label>
            </label>
            {editing && (
              <div className="mt-2">
                <ExtraDaysManager userId={editing.id} userName={editing.name} />
              </div>
            )}
          </div>
          <FieldError message={error ?? undefined} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : editing ? "Save" : "Add person"}</Button>
          </div>
        </form>
      </Dialog>

      {/* Password reset dialog */}
      <Dialog open={!!pwFor} onClose={() => setPwFor(null)}>
        <DialogTitle>Set password — {pwFor?.name}</DialogTitle>
        <div className="mt-4 space-y-3">
          <div>
            <Label htmlFor="pw-new">New password (min 8 chars)</Label>
            <Input id="pw-new" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/40">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Attendance
            </p>
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox
                id="p-override"
                checked={overrideOn}
                onChange={(e) => setOverrideOn(e.target.checked)}
              />
              <Label htmlFor="p-override" className="!mb-0">
                Override lab attendance mode for this person
              </Label>
            </label>
            {overrideOn && (
              <div className="mt-2 space-y-1.5">
                {ATTENDANCE_MODES.map((m) => (
                  <label key={m.id} className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="p-mode-override"
                      checked={modeOverride === m.id}
                      onChange={() => setModeOverride(m.id)}
                      className="h-4 w-4 accent-accent-600"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      {m.label} <span className="text-xs text-slate-400">— {m.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
            <label className="mt-2 flex cursor-pointer items-center gap-2">
              <Checkbox
                id="p-linkbooking"
                checked={linkBooking}
                onChange={(e) => setLinkBooking(e.target.checked)}
              />
              <Label htmlFor="p-linkbooking" className="!mb-0">
                Count desk-booking days as working days
              </Label>
            </label>
            {editing && (
              <div className="mt-2">
                <ExtraDaysManager userId={editing.id} userName={editing.name} />
              </div>
            )}
          </div>
          <FieldError message={error ?? undefined} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPwFor(null)}>Cancel</Button>
            <Button onClick={doResetPassword}>Set password</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
