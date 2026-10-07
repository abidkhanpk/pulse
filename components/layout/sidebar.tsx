"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { PermissionKey, ActorRole } from "@/lib/permissions";
import {
  LayoutDashboard,
  Armchair,
  FolderKanban,
  BookOpenText,
  Users,
  BarChart3,
  ClipboardList,
  FlaskConical,
  ShieldCheck,
  Settings,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

export interface SessionActorLike {
  role: ActorRole;
  name: string;
  email: string;
  inchargeOf: { labId: string }[];
}

/** "LAB_INCHARGE" → "Lab Incharge" */
export function roleDisplayName(key: string): string {
  return key
    .split("_")
    .map((p) => p.charAt(0) + p.slice(1).toLowerCase())
    .join(" ");
}

const NAV: { href: string; label: string; icon: typeof LayoutDashboard; perm: PermissionKey | null }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, perm: null },
  { href: "/desks", label: "Desks", icon: Armchair, perm: "bookings.view_all" },
  { href: "/projects", label: "Projects", icon: FolderKanban, perm: null },
  { href: "/logbook", label: "Logbook", icon: BookOpenText, perm: null },
  { href: "/people", label: "People", icon: Users, perm: "users.manage" },
  { href: "/check-in", label: "Check-in", icon: ClipboardList, perm: null },
  { href: "/reports", label: "Reports", icon: BarChart3, perm: "attendance.view_reports" },
  { href: "/labs", label: "Labs", icon: FlaskConical, perm: "labs.manage" },
  { href: "/audit", label: "Audit", icon: ShieldCheck, perm: "audit.view" },
  { href: "/settings", label: "Settings", icon: Settings, perm: "org.manage" },
];

function canSee(actor: SessionActorLike, item: (typeof NAV)[number]) {
  if (!item.perm) return true;
  return actor.role.permissions.includes(item.perm);
}

export function Sidebar({
  actor,
  pathname,
  collapsed,
  onToggleCollapse,
}: {
  actor: SessionActorLike;
  pathname: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const items = NAV.filter((n) => canSee(actor, n));
  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 76 : 240 }}
      transition={{ type: "spring", stiffness: 320, damping: 32 }}
      className="hidden shrink-0 flex-col overflow-hidden border-r border-slate-200/80 bg-gradient-to-b from-white via-white to-indigo-50/40 md:flex"
    >
      {/* Brand */}
      <div className={cn("flex h-16 items-center border-b border-slate-100", collapsed ? "justify-center px-2" : "px-5")}>
        <Link href="/dashboard" className="flex items-center gap-2.5" title="Pulse">
          <motion.span
            whileHover={{ rotate: -8, scale: 1.06 }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-600 text-base font-black text-white shadow-[0_4px_14px_rgba(79,70,229,0.45)]"
          >
            P
          </motion.span>
          {!collapsed && (
            <span className="bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-xl font-extrabold tracking-tight text-transparent">
              Pulse
            </span>
          )}
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden p-3">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
                collapsed && "justify-center px-0",
                active
                  ? "text-white shadow-[0_4px_14px_rgba(79,70,229,0.4)]"
                  : "text-slate-600 hover:translate-x-0.5 hover:bg-indigo-50/70 hover:text-indigo-700"
              )}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600"
                  transition={{ type: "spring", stiffness: 450, damping: 35 }}
                />
              )}
              <span
                className={cn(
                  "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors",
                  active ? "bg-white/20" : "bg-slate-100 text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600"
                )}
              >
                <Icon className="h-[17px] w-[17px]" />
              </span>
              {!collapsed && <span className="relative z-10 truncate">{item.label}</span>}
              {!collapsed && active && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="relative z-10 ml-auto h-1.5 w-1.5 rounded-full bg-white"
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-slate-100 p-3">
        <button
          onClick={onToggleCollapse}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-indigo-50/70 hover:text-indigo-700",
            collapsed && "justify-center px-0"
          )}
        >
          {collapsed ? <ChevronsRight className="h-[18px] w-[18px]" /> : <ChevronsLeft className="h-[18px] w-[18px]" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </motion.aside>
  );
}

export function MobileNav({ actor, pathname }: { actor: SessionActorLike; pathname: string }) {
  const items = NAV.filter((n) => canSee(actor, n)).slice(0, 5);
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors",
              active ? "text-indigo-700" : "text-slate-500"
            )}
          >
            <span className={cn("flex h-8 w-8 items-center justify-center rounded-xl", active && "bg-indigo-100")}>
              <Icon className="h-5 w-5" />
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
