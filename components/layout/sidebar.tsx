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
  Pin,
  PinOff,
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
    .join("");
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

const COLLAPSED_W = 72;
const EXPANDED_W = 260;

export function Sidebar({
  actor,
  pathname,
  pinned,
  onTogglePin,
}: {
  actor: SessionActorLike;
  pathname: string;
  pinned: boolean;
  onTogglePin: () => void;
}) {
  const [hovered, setHovered] = React.useState(false);
  const leaveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const expanded = pinned || hovered;

  const items = NAV.filter((n) => canSee(actor, n));

  function onEnter() {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    setHovered(true);
  }
  function onLeave() {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    // Small delay so moving between icon and edge doesn't flicker.
    leaveTimer.current = setTimeout(() => setHovered(false), 220);
  }
  React.useEffect(() => () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
  }, []);

  return (
    <motion.aside
      initial={false}
      animate={{ width: expanded ? EXPANDED_W : COLLAPSED_W }}
      transition={{ type: "spring", stiffness: 380, damping: 36 }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className="fixed bottom-0 left-0 top-0 z-40 hidden flex-col overflow-hidden bg-[#0e2238] shadow-[4px_0_24px_rgba(2,8,23,0.35)] dark:bg-[#0a1424] md:flex"
    >
      {/* Brand */}
      <div className={cn("flex h-16 shrink-0 items-center border-b border-white/10", expanded ? "px-5" : "justify-center px-2")}>
        <Link href="/dashboard" className="flex items-center gap-2.5" title="Pulse">
          <motion.span
            whileHover={{ rotate: -8, scale: 1.06 }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-base font-black text-white shadow-[0_4px_14px_rgba(99,102,241,0.5)]"
          >
            P
          </motion.span>
          {expanded && (
            <motion.span
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              className="whitespace-nowrap text-xl font-extrabold tracking-tight text-white"
            >
              Pulse
            </motion.span>
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
              title={expanded ? undefined : item.label}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
                !expanded && "justify-center px-0",
                active ? "text-white" : "text-slate-300/80 hover:bg-white/10 hover:text-white"
              )}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 shadow-[0_4px_14px_rgba(99,102,241,0.45)]"
                  transition={{ type: "spring", stiffness: 450, damping: 35 }}
                />
              )}
              <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center">
                <Icon className="h-[18px] w-[18px]" />
              </span>
              {expanded && (
                <motion.span
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.15 }}
                  className="relative z-10 truncate whitespace-nowrap"
                >
                  {item.label}
                </motion.span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Pin toggle */}
      <div className="border-t border-white/10 p-3">
        <button
          onClick={onTogglePin}
          title={pinned ? "Unpin sidebar (auto-collapse on hover)" : "Pin sidebar open"}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
            !expanded && "justify-center px-0",
            pinned ? "bg-white/10 text-white" : "text-slate-300/70 hover:bg-white/10 hover:text-white"
          )}
        >
          {pinned ? <PinOff className="h-[18px] w-[18px] shrink-0" /> : <Pin className="h-[18px] w-[18px] shrink-0" />}
          {expanded && (
            <motion.span
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.15 }}
              className="whitespace-nowrap"
            >
              {pinned ? "Unpin" : "Pin open"}
            </motion.span>
          )}
        </button>
      </div>
    </motion.aside>
  );
}

export function MobileNav({ actor, pathname }: { actor: SessionActorLike; pathname: string }) {
  const items = NAV.filter((n) => canSee(actor, n)).slice(0, 5);
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 md:hidden">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors",
              active ? "text-indigo-700 dark:text-indigo-300" : "text-slate-500 dark:text-slate-400"
            )}
          >
            <span className={cn("flex h-8 w-8 items-center justify-center rounded-xl", active && "bg-indigo-100 dark:bg-indigo-950")}>
              <Icon className="h-5 w-5" />
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
