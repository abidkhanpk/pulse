"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Sidebar, MobileNav, type SessionActorLike } from "./sidebar";
import { UserMenu } from "./user-menu";
import { BrandLogo } from "@/components/brand-logo";

const PIN_KEY = "pulse-sidebar-pinned";

export function AppShell({
  actor,
  appName,
  showCheckIn,
  children,
}: {
  actor: SessionActorLike;
  appName: string;
  showCheckIn: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [pinned, setPinned] = React.useState(false);

  React.useEffect(() => {
    try {
      setPinned(localStorage.getItem(PIN_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  function togglePin() {
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
    <div className="flex min-h-screen bg-slate-100 dark:bg-slate-950">
      <Sidebar
        actor={actor}
        appName={appName}
        pathname={pathname}
        pinned={pinned}
        onTogglePin={togglePin}
        showCheckIn={showCheckIn}
      />
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col transition-[padding] duration-300 ease-out",
          pinned ? "md:pl-[260px]" : "md:pl-[72px]"
        )}
      >
        <header className="relative z-40 flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white/80 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 md:px-6">
          <span className="flex items-center gap-2 md:hidden">
            <BrandLogo className="h-7 w-7" />
            <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">{appName}</span>
          </span>
          <div className="hidden text-sm text-slate-500 dark:text-slate-400 md:block">
            {new Date().toLocaleDateString("en-PK", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
              timeZone: "Asia/Karachi",
            })}
          </div>
          <div className="flex items-center gap-3">
            <UserMenu actor={actor} />
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
