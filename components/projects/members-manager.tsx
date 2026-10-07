"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Avatar } from "@/components/ui/misc";
import { addMember, removeMember, memberCandidates } from "@/app/(app)/projects/actions";

interface Member {
  user: { id: string; name: string; email: string };
  role: string;
}

export function MembersManager({
  projectId,
  members,
  onChanged,
}: {
  projectId: string;
  members: Member[];
  onChanged: () => void;
}) {
  const [candidates, setCandidates] = React.useState<{ id: string; name: string; email: string }[]>([]);
  const [candidateId, setCandidateId] = React.useState("");

  React.useEffect(() => {
    memberCandidates(projectId).then(setCandidates);
  }, [projectId, members.length]);

  async function add() {
    if (!candidateId) return;
    const res = await addMember(projectId, candidateId);
    if (!res.ok) alert(res.error);
    else {
      setCandidateId("");
      onChanged();
    }
  }

  async function remove(userId: string, name: string) {
    if (!confirm(`Remove ${name} from the project?`)) return;
    const res = await removeMember(projectId, userId);
    if (!res.ok) alert(res.error);
    else onChanged();
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Select value={candidateId} onChange={(e) => setCandidateId(e.target.value)} className="max-w-xs">
          <option value="">Add a person…</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.email})
            </option>
          ))}
        </Select>
        <Button size="sm" onClick={add} disabled={!candidateId}>
          Add
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {members.map((m) => (
          <div key={m.user.id} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:bg-slate-900 dark:border-slate-700">
            <Avatar name={m.user.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{m.user.name}</p>
              <p className="truncate text-xs text-slate-400">{m.user.email} · {m.role}</p>
            </div>
            <Button variant="ghost" size="sm" className="text-red-600" onClick={() => remove(m.user.id, m.user.name)}>
              Remove
            </Button>
          </div>
        ))}
        {members.length === 0 && <p className="text-sm text-slate-400">No members yet.</p>}
      </div>
    </div>
  );
}
