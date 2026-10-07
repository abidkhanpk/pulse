"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronRight, FlaskConical } from "lucide-react";
import { Card } from "@/components/ui/card";

export interface LabOverviewStat {
  label: string;
  value: string | number;
  hint?: string;
}

/** Clickable lab card for admin overviews — drills into the lab's detail view. */
export function LabOverviewCard({
  labName,
  href,
  stats,
  accent = "indigo",
}: {
  labName: string;
  href: string;
  stats: LabOverviewStat[];
  accent?: "indigo" | "emerald" | "amber" | "sky";
}) {
  const accents: Record<string, string> = {
    indigo: "from-indigo-600 to-violet-600",
    emerald: "from-emerald-600 to-teal-600",
    amber: "from-amber-500 to-orange-600",
    sky: "from-sky-600 to-blue-600",
  };
  return (
    <Link href={href} className="block">
      <Card hover className="group overflow-hidden p-0">
        <div className={`h-1.5 bg-gradient-to-r ${accents[accent]}`} />
        <div className="p-5">
          <div className="flex items-center gap-3">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${accents[accent]} text-white shadow-md`}>
              <FlaskConical className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">{labName}</h3>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-slate-300 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-indigo-500" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800">
                <p className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">{s.value}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{s.label}</p>
                {s.hint && <p className="text-[11px] text-slate-400">{s.hint}</p>}
              </div>
            ))}
          </div>
        </div>
      </Card>
    </Link>
  );
}

/** Animated grid wrapper for overview cards. */
export function OverviewGrid({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
      className="grid grid-cols-1 gap-4 lg:grid-cols-2"
    >
      {children}
    </motion.div>
  );
}

export function OverviewItem({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
      }}
    >
      {children}
    </motion.div>
  );
}
