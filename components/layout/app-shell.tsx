"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Sidebar, MobileNav, type SessionActorLike } from "./sidebar";
import { UserMenu } from "./user-menu";
import { BrandLogo } from "@/components/brand-logo";

const PIN_KEY = "pulse-sidebar-pinned";

export function AppShell({
  actor,
  appName,
  showCheckIn,
  accentChoice,
  defaultAccent,
  children,
}: {
  actor: SessionActorLike;
  appName: string;
  showCheckIn: boolean;
  /** The user's own accent choice; null = following the org default. */
  accentChoice: string | null;
  defaultAccent: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [pinned, setPinned] = React.useState(false);
  // Sidebar expansion state lives here so the header can show the app
  // name while the sidebar is collapsed. When pinned, the edge arrow
  // collapses/expands it manually; otherwise hover drives it.
  const [hovered, setHovered] = React.useState(false);
  const [pinCollapsed, setPinCollapsed] = React.useState(false);
  const sidebarExpanded = pinned ? !pinCollapsed : hovered;

  React.useEffect(() => {
    try {
      setPinned(localStorage.getItem(PIN_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  function togglePin() {
    // Leaving pinned mode always restores the full-width state first.
    setPinCollapsed(false);
    setPinned((v) => {
      const next = !v;
      try {
        localStorage.setItem(PIN_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <div className="app-wash flex min-h-screen bg-slate-100 dark:bg-slate-950">
      <Sidebar
        actor={actor}
        appName={appName}
        pathname={pathname}
        pinned={pinned}
        expanded={sidebarExpanded}
        pinCollapsed={pinCollapsed}
        onHoverChange={setHovered}
        onTogglePin={togglePin}
        onTogglePinCollapsed={() => setPinCollapsed((v) => !v)}
        showCheckIn={showCheckIn}
      />
      {/* The sidebar is in normal flow: as it expands/collapses this column
          reflows — the page is pushed, never overlaid. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="relative z-40 flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white/80 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 md:px-6">
          <span className="flex items-center gap-2 md:hidden">
            <BrandLogo className="h-7 w-7" />
            <span className="font-wordmark text-[19px] leading-none tracking-[0.06em] text-slate-900 dark:text-white">{appName}</span>
          </span>
          <div className="hidden items-center gap-3 md:flex">
            {/* Collapsed sidebar: the wordmark moves up here, left of the date. */}
            {!sidebarExpanded && (
              <>
                <span className="font-wordmark text-[44px] leading-none tracking-[-0.015em] text-slate-900 dark:text-white">
                  {appName}
                </span>
                <span className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
              </>
            )}
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {new Date().toLocaleDateString("en-PK", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
                timeZone: "Asia/Karachi",
              })}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <UserMenu actor={actor} accentChoice={accentChoice} defaultAccent={defaultAccent} />
          </div>
        </header>
        <main className="flex-1 p-4 pb-20 md:p-6 md:pb-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <MobileNav actor={actor} pathname={pathname} showCheckIn={showCheckIn} />
    </div>
  );
}
