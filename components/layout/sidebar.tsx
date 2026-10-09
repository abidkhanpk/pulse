"use client";

import * as React from "react";
import Link from "next/link";
import { motion, animate, useMotionValue, useMotionValueEvent } from "framer-motion";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/brand-logo";
import { Tooltip } from "@/components/ui/tooltip";
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
  ChevronLeft,
  ChevronRight,
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
  appName,
  pathname,
  pinned,
  expanded,
  pinCollapsed,
  onHoverChange,
  onTogglePin,
  onTogglePinCollapsed,
  showCheckIn,
}: {
  actor: SessionActorLike;
  appName: string;
  pathname: string;
  pinned: boolean;
  /** Owned by the app shell so the header can react to the sidebar state. */
  expanded: boolean;
  pinCollapsed: boolean;
  onHoverChange: (hovered: boolean) => void;
  onTogglePin: () => void;
  onTogglePinCollapsed: () => void;
  showCheckIn: boolean;
}) {
  const leaveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Width is driven by a motion value, and text visibility is DERIVED from
  // the actual rendered width — labels only exist once the sidebar is
  // physically wide enough to fit them (past 150px), and vanish the moment
  // it narrows below that. No timers or delays: a clipped label is
  // impossible regardless of animation speed or machine load.
  const widthMV = useMotionValue(COLLAPSED_W);
  const [showText, setShowText] = React.useState(false);
  React.useEffect(() => {
    const controls = animate(widthMV, expanded ? EXPANDED_W : COLLAPSED_W, {
      type: "spring",
      stiffness: 380,
      damping: 36,
    });
    return () => controls.stop();
  }, [expanded, widthMV]);
  useMotionValueEvent(widthMV, "change", (w) => {
    setShowText(w > 150);
  });

  const items = NAV.filter((n) => canSee(actor, n) && (n.href !== "/check-in" || showCheckIn));

  function onEnter() {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    onHoverChange(true);
  }
  function onLeave() {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    // Small delay so moving between icon and edge doesn't flicker.
    leaveTimer.current = setTimeout(() => onHoverChange(false), 220);
  }
  React.useEffect(() => () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
  }, []);


  return (
    <motion.div
      style={{ width: widthMV }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className="sticky top-0 z-40 hidden h-screen shrink-0 self-start md:block"
    >
      <aside className="flex h-full flex-col overflow-hidden border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {/* Brand */}
        <div className={cn("flex h-16 shrink-0 items-center border-b border-slate-100 dark:border-slate-800", expanded ? "px-3" : "justify-center px-2")}>
          <Tooltip content={appName} disabled={expanded} prefer="right">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center">
              <BrandLogo className="h-9 w-9" />
            </span>
            {showText && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.15 }}
                className="font-wordmark whitespace-nowrap text-[44px] leading-none tracking-[-0.015em] text-slate-900 dark:text-white"
              >
                {appName}
              </motion.span>
            )}
          </Link>
          </Tooltip>
        </div>

        {/* Nav — flat list, clean icons: muted when idle, accent on the active button itself */}
        <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden p-3">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Tooltip key={item.href} content={item.label} disabled={expanded} prefer="right">
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-sm px-3 py-2 text-sm font-medium transition-colors duration-150",
                  !expanded && "justify-center px-0",
                  active
                    ? expanded
                      ? "bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-300"
                      : // Collapsed: no background at all — only the icon color marks the active item.
                        "text-accent-700 hover:bg-slate-100 dark:text-accent-300 dark:hover:bg-white/5"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
                )}
              >
                <Icon
                  className={cn(
                    "h-[18px] w-[18px] shrink-0",
                    active ? "text-accent-600 dark:text-accent-400" : "text-slate-400 dark:text-slate-500"
                  )}
                />
                {showText && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.15 }}
                    className="truncate whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </Link>
              </Tooltip>
            );
          })}
        </nav>

        {/* Profile + pin (the pin button is always visible) */}
        <div className="space-y-1 border-t border-slate-100 p-3 dark:border-slate-800">
          <div className={cn("flex items-center gap-2.5 rounded-sm px-2 py-1.5", !expanded && "justify-center px-0")}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-600 text-[11px] font-bold text-white">
              {actor.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
            </span>
            {showText && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.15 }}
                className="min-w-0 flex-1"
              >
                <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-100">{actor.name}</span>
                <span className="block truncate text-[11px] text-slate-400">{roleDisplayName(actor.role.key)}</span>
              </motion.span>
            )}
          </div>
          <Tooltip content={pinned ? "Unpin sidebar" : "Pin sidebar open"} disabled={expanded} prefer="right">
          <button
            onClick={onTogglePin}
            aria-label={pinned ? "Unpin sidebar" : "Pin sidebar open"}
            className={cn(
              "flex w-full items-center gap-3 rounded-sm px-3 py-2 text-sm font-medium transition-colors",
              !expanded && "justify-center px-0",
              pinned
                ? // Pinned: no background shade — only the icon/label colour shows the state.
                  "text-accent-700 hover:bg-slate-100 dark:text-accent-300 dark:hover:bg-white/5"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
            )}
          >
            {pinned ? <PinOff className="h-[18px] w-[18px] shrink-0" /> : <Pin className="h-[18px] w-[18px] shrink-0" />}
            {showText && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.15 }}
                className="whitespace-nowrap"
              >
                {pinned ? "Unpin" : "Pin open"}
              </motion.span>
            )}
          </button>
          </Tooltip>
        </div>
      </aside>

      {/* Edge arrow — only in pinned mode: collapse/expand the pinned sidebar */}
      {pinned && (
        <Tooltip content={pinCollapsed ? "Expand sidebar" : "Collapse sidebar"} prefer="right">
          <button
            onClick={onTogglePinCollapsed}
            aria-label={pinCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!pinCollapsed}
            className="absolute -right-3 top-20 z-50 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-md transition-colors hover:text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-white"
          >
            {pinCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>
        </Tooltip>
      )}
    </motion.div>
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
            <span className={cn("flex h-8 w-8 items-center justify-center rounded-sm", active && "bg-accent-100 dark:bg-accent-950")}>
              <Icon className="h-5 w-5" />
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
