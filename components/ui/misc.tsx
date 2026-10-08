"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface TabsProps {
  tabs: { id: string; label: string; badge?: number }[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}

/** Segmented control with a sliding active pill. */
export function Tabs({ tabs, active, onChange, className }: TabsProps) {
  const pillId = React.useId();
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-2xl border border-slate-200/70 bg-slate-100/80 p-1.5 shadow-[inset_0_1px_2px_rgb(15,23,42,0.06)] dark:border-slate-700/60 dark:bg-slate-800/70",
        className
      )}
      role="tablist"
    >
      {tabs.map((t) => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.id)}
            className={cn(
              "relative rounded-xl px-4 py-2 text-sm font-semibold transition-colors duration-200",
              isActive
                ? "text-accent-700 dark:text-accent-200"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            )}
          >
            {isActive && (
              <motion.span
                layoutId={`tab-pill-${pillId}`}
                transition={{ type: "spring", stiffness: 480, damping: 38 }}
                className="absolute inset-0 rounded-xl bg-white shadow-soft ring-1 ring-slate-200/70 dark:bg-slate-700 dark:ring-slate-600/60"
              />
            )}
            <span className="relative z-10 inline-flex items-center">
              {t.label}
              {t.badge !== undefined && t.badge > 0 && (
                <span
                  className={cn(
                    "ml-1.5 rounded-full px-1.5 py-0.5 text-xs font-bold",
                    isActive
                      ? "bg-accent-100 text-accent-700 dark:bg-accent-900 dark:text-accent-300"
                      : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                  )}
                >
                  {t.badge}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split("")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      title={name}
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
        "bg-gradient-to-br from-accent-500 to-accent-700 text-xs font-bold text-white shadow-glow-sm ring-2 ring-white dark:ring-slate-900",
        className
      )}
    >
      {initials}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-gradient-to-b from-slate-50/80 to-transparent px-6 py-12 text-center shadow-[inset_0_1px_0_rgb(255,255,255,0.6)] dark:border-slate-700 dark:from-slate-800/40">
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  href?: string;
}) {
  const inner = (
    <div className="card-sheen rounded-2xl border border-slate-200/70 bg-white p-5 shadow-soft transition-all duration-300 ease-liquid hover:-translate-y-0.5 hover:shadow-lift dark:border-slate-700/60 dark:bg-slate-900">
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
  return href ? (
    <a href={href} className="block">
      {inner}
    </a>
  ) : (
    inner
  );
}
