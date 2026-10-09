"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/brand-logo";
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

const NAV: { href: string; label: string; icon: typeof LayoutDashboard; perm: PermissionKey | null; section: string }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, perm: null, section: "Main" },
  { href: "/desks", label: "Desks", icon: Armchair, perm: "bookings.view_all", section: "Main" },
  { href: "/projects", label: "Projects", icon: FolderKanban, perm: null, section: "Main" },
  { href: "/logbook", label: "Logbook", icon: BookOpenText, perm: null, section: "Main" },
  { href: "/people", label: "People", icon: Users, perm: "users.manage", section: "Main" },
  { href: "/check-in", label: "Check-in", icon: ClipboardList, perm: null, section: "Main" },
  { href: "/reports", label: "Reports", icon: BarChart3, perm: "attendance.view_reports", section: "Main" },
  { href: "/labs", label: "Labs", icon: FlaskConical, perm: "labs.manage", section: "Manage" },
  { href: "/audit", label: "Audit", icon: ShieldCheck, perm: "audit.view", section: "Manage" },
  { href: "/settings", label: "Settings", icon: Settings, perm: "org.manage", section: "Manage" },
];

function canSee(actor: SessionActorLike, item: (typeof NAV)[number]) {
  if (!item.perm) return true;
  return actor.role.permissions.includes(item.perm);
}

const COLLAPSED_W = 72;
const EXPANDED_W = 260;

export function Sidebar({
  actor,
  appName,
  pathname,
  pinned,
  onTogglePin,
  showCheckIn,
}: {
  actor: SessionActorLike;
  appName: string;
  pathname: string;
  pinned: boolean;
  onTogglePin: () => void;
  showCheckIn: boolean;
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
      className="fixed bottom-0 left-0 top-0 z-40 hidden flex-col overflow-hidden border-r border-slate-200/70 bg-white shadow-[4px_0_24px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-[#0a0a0e] dark:shadow-[4px_0_24px_rgba(0,0,0,0.5)] md:flex"
    >
      {/* Brand */}
      <div className={cn("flex h-16 shrink-0 items-center border-b border-slate-100 dark:border-white/10", expanded ? "px-5" : "justify-center px-2")}>
        <Link href="/dashboard" className="flex items-center gap-2.5" title={appName}>
          <motion.span
            whileHover={{ rotate: -8, scale: 1.06 }}
            className="flex h-9 w-9 shrink-0 items-center justify-center"
          >
            <BrandLogo className="h-9 w-9" />
          </motion.span>
          {expanded && (
            <motion.span
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              // Delay until the width spring has opened far enough to fit the
              // word — otherwise a clipped first-letter sliver shows mid-animation.
              transition={{ duration: 0.18, delay: 0.13 }}
              className="whitespace-nowrap bg-gradient-to-r from-accent-600 to-accent-700 bg-clip-text text-xl font-extrabold tracking-tight text-transparent"
            >
              {appName}
            </motion.span>
          )}
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden p-3">
        {(() => {
          let lastSection = "";
          return items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            const sectionHeader = item.section !== lastSection ? item.section : null;
            lastSection = item.section;
            return (
              <React.Fragment key={item.href}>
                {sectionHeader && expanded && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.18, delay: 0.13 }}
                    className="whitespace-nowrap px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500"
                  >
                    {sectionHeader}
                  </motion.p>
                )}
                <Link
                  href={item.href}
                  title={expanded ? undefined : item.label}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
                    !expanded && "justify-center px-0",
                    active
                      ? "text-white"
                      : "text-slate-600 hover:bg-accent-50 hover:text-accent-700 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="sidebar-active"
                      className="absolute inset-0 rounded-xl bg-gradient-to-r from-accent-600 to-accent-700 shadow-glow"
                      transition={{ type: "spring", stiffness: 450, damping: 35 }}
                    />
                  )}
                  <span
                    className={cn(
                      "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                      active
                        ? "bg-white/20"
                        : "bg-slate-100 text-slate-500 group-hover:bg-accent-100 group-hover:text-accent-600 dark:bg-white/5 dark:text-slate-400 dark:group-hover:bg-white/10 dark:group-hover:text-white"
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  {expanded && (
                    <motion.span
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.18, delay: 0.13 }}
                      className="relative z-10 truncate whitespace-nowrap"
                    >
                      {item.label}
                    </motion.span>
                  )}
                  {expanded && active && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.13 }}
                      className="relative z-10 ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-white"
                    />
                  )}
                </Link>
              </React.Fragment>
            );
          });
        })()}
      </nav>

      {/* Profile + pin */}
      <div className="space-y-2 border-t border-slate-100 p-3 dark:border-white/10">
        {expanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.18, delay: 0.13 }}
            className="flex items-center gap-2.5 rounded-2xl bg-gradient-to-br from-accent-50 to-accent-100 p-2.5 ring-1 ring-accent-100 dark:from-white/5 dark:to-white/10 dark:ring-white/10"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent-600 to-accent-700 text-xs font-bold text-white">
              {actor.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-slate-800 dark:text-white">{actor.name}</span>
              <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">{roleDisplayName(actor.role.key)}</span>
            </span>
          </motion.div>
        )}
        <button
          onClick={onTogglePin}
          title={pinned ? "Unpin sidebar (auto-collapse on hover)" : "Pin sidebar open"}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
            !expanded && "justify-center px-0",
            pinned
              ? "bg-accent-100 text-accent-700 dark:bg-white/10 dark:text-white"
              : "text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
          )}
        >
          {pinned ? <PinOff className="h-[18px] w-[18px] shrink-0" /> : <Pin className="h-[18px] w-[18px] shrink-0" />}
          {expanded && (
            <motion.span
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.18, delay: 0.13 }}
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

export function MobileNav({ actor, pathname, showCheckIn }: { actor: SessionActorLike; pathname: string; showCheckIn: boolean }) {
  const items = NAV.filter((n) => canSee(actor, n) && (n.href !== "/check-in" || showCheckIn)).slice(0, 5);
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
              active ? "text-accent-700 dark:text-accent-300" : "text-slate-500 dark:text-slate-400"
            )}
          >
            <span className={cn("flex h-8 w-8 items-center justify-center rounded-xl", active && "bg-accent-100 dark:bg-accent-950")}>
              <Icon className="h-5 w-5" />
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
