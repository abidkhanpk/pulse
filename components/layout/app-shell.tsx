"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Sidebar, MobileNav, type SessionActorLike } from "./sidebar";
import { UserMenu } from "./user-menu";

export function AppShell({
  actor,
  children,
}: {
  actor: SessionActorLike;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar
        actor={actor}
        pathname={pathname}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((v) => !v)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="relative z-40 flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white/80 px-4 backdrop-blur md:px-6">
          <span className="text-lg font-bold tracking-tight text-slate-900 md:hidden">Pulse</span>
          <div className="hidden text-sm text-slate-500 md:block">
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
      <MobileNav actor={actor} pathname={pathname} />
    </div>
  );
}
