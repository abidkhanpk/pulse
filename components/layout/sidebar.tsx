import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { PermissionKey } from "@/lib/permissions";
import { signOutAction } from "./actions";
import {
  LayoutDashboard,
  Armchair,
  FolderKanban,
  BookOpenText,
  Users,
  BarChart3,
  FlaskConical,
  Settings,
  LogOut,
} from "lucide-react";

export interface SessionActorLike {
  role: { permissions: string[] };
  name: string;
  email: string;
}

const NAV: { href: string; label: string; icon: typeof LayoutDashboard; perm: PermissionKey | null }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, perm: null },
  { href: "/desks", label: "Desks", icon: Armchair, perm: "bookings.view_all" },
  { href: "/projects", label: "Projects", icon: FolderKanban, perm: null },
  { href: "/logbook", label: "Logbook", icon: BookOpenText, perm: null },
  { href: "/people", label: "People", icon: Users, perm: "users.manage" },
  { href: "/check-in", label: "Check-in", icon: BarChart3, perm: null },
  { href: "/reports", label: "Reports", icon: BarChart3, perm: "attendance.view_reports" },
  { href: "/labs", label: "Labs", icon: FlaskConical, perm: "labs.manage" },
  { href: "/settings", label: "Settings", icon: Settings, perm: "org.manage" },
];

function canSee(actor: SessionActorLike, perm: PermissionKey | null) {
  return !perm || actor.role.permissions.includes(perm);
}

export function Sidebar({ actor, pathname }: { actor: SessionActorLike; pathname: string }) {
  const items = NAV.filter((n) => canSee(actor, n.perm));
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
      <div className="flex h-16 items-center border-b border-slate-100 px-5">
        <Link href="/dashboard" className="text-xl font-bold tracking-tight text-slate-900">
          Pulse
        </Link>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-100 p-3">
        <div className="rounded-lg bg-slate-50 px-3 py-2.5">
          <p className="truncate text-sm font-medium text-slate-800">{actor.name}</p>
          <p className="truncate text-xs text-slate-500">{actor.email}</p>
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}

export function MobileNav({ actor, pathname }: { actor: SessionActorLike; pathname: string }) {
  const items = NAV.filter((n) => canSee(actor, n.perm)).slice(0, 5);
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-slate-200 bg-white md:hidden">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium",
              active ? "text-indigo-700" : "text-slate-500"
            )}
          >
            <Icon className="h-5 w-5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
