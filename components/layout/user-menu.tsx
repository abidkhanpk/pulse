"use client";

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, FlaskConical, Settings, LogOut, Sun, Moon, Monitor } from "lucide-react";
import { signOutAction } from "./actions";
import { roleDisplayName, type SessionActorLike } from "./sidebar";
import { useTheme, type Theme } from "@/components/theme";

function initials(name: string): string {
  return name
    .split("")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function UserMenu({ actor }: { actor: SessionActorLike }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const isIncharge = actor.inchargeOf.length > 0;
  const canSettings = actor.role.permissions.includes("org.manage");
  const { theme, setTheme } = useTheme();

  const themeOptions: { id: Theme; label: string; icon: typeof Sun }[] = [
    { id: "light", label: "Light", icon: Sun },
    { id: "dark", label: "Dark", icon: Moon },
    { id: "system", label: "System", icon: Monitor },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="group flex items-center gap-2 rounded-full py-1 pl-1 pr-1.5 transition hover:bg-slate-100 dark:hover:bg-slate-800"
        title={actor.name}
        aria-expanded={open}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-xs font-bold text-white shadow-[0_2px_8px_rgba(79,70,229,0.4)] ring-2 ring-white transition group-hover:shadow-[0_2px_12px_rgba(79,70,229,0.55)]">
          {initials(actor.name)}
        </span>
        <span className="hidden text-left lg:block">
          <span className="block max-w-[140px] truncate text-sm font-semibold text-slate-800 dark:text-slate-200">{actor.name}</span>
          <span className="block text-[11px] text-slate-400">{roleDisplayName(actor.role.key)}</span>
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl bg-white shadow-[0_12px_40px_rgba(15,23,42,0.16)] ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"
          >
            {/* Identity header */}
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3.5 text-white">
              <p className="truncate text-sm font-bold">{actor.name}</p>
              <p className="truncate text-xs text-indigo-100">{actor.email}</p>
              <span className="mt-1.5 inline-block rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                {roleDisplayName(actor.role.key)}
              </span>
            </div>
            <div className="p-1.5">
              {/* Theme switcher */}
              <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Appearance
              </div>
              <div className="mb-1 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                {themeOptions.map((opt) => {
                  const Icon = opt.icon;
                  const activeOpt = theme === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setTheme(opt.id)}
                      className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition ${
                        activeOpt
                          ? "bg-white text-indigo-700 shadow-sm dark:bg-slate-700 dark:text-indigo-300"
                          : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              {isIncharge && (
                <Link
                  href="/labs"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-700 dark:text-slate-300 dark:hover:bg-indigo-950 dark:hover:text-indigo-300"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
                    <FlaskConical className="h-4 w-4" />
                  </span>
                  My Lab
                </Link>
              )}
              {canSettings && (
                <Link
                  href="/settings"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-700 dark:text-slate-300 dark:hover:bg-indigo-950 dark:hover:text-indigo-300"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    <Settings className="h-4 w-4" />
                  </span>
                  Settings
                </Link>
              )}
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-red-50 hover:text-red-700 dark:text-slate-300 dark:hover:bg-red-950 dark:hover:text-red-300"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-100 text-red-600 dark:bg-red-950">
                    <LogOut className="h-4 w-4" />
                  </span>
                  Sign out
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
