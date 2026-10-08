import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  hover = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { hover?: boolean }) {
  return (
    <div
      className={cn(
        "card-sheen rounded-2xl border border-slate-200/70 bg-white shadow-soft dark:border-slate-700/60 dark:bg-slate-900",
        "transition-all duration-300 ease-liquid",
        hover && "cursor-pointer hover:-translate-y-1 hover:shadow-lift hover:border-slate-300/80 dark:hover:border-slate-600",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800/80", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-base font-semibold tracking-tight text-slate-900 dark:text-white", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 py-4", className)} {...props} />;
}

const badgeColors: Record<string, string> = {
  default:
    "bg-gradient-to-b from-slate-50 to-slate-100 text-slate-700 ring-1 ring-slate-200 dark:from-slate-800 dark:to-slate-800/80 dark:text-slate-300 dark:ring-slate-700",
  primary:
    "bg-gradient-to-b from-accent-50 to-accent-100/70 text-accent-700 ring-1 ring-accent-200 dark:from-accent-950 dark:to-accent-900/40 dark:text-accent-300 dark:ring-accent-800",
  success:
    "bg-gradient-to-b from-emerald-50 to-emerald-100/70 text-emerald-700 ring-1 ring-emerald-200 dark:from-emerald-950 dark:to-emerald-900/40 dark:text-emerald-300 dark:ring-emerald-800",
  warning:
    "bg-gradient-to-b from-amber-50 to-amber-100/70 text-amber-800 ring-1 ring-amber-200 dark:from-amber-950 dark:to-amber-900/40 dark:text-amber-300 dark:ring-amber-800",
  danger:
    "bg-gradient-to-b from-red-50 to-red-100/70 text-red-700 ring-1 ring-red-200 dark:from-red-950 dark:to-red-900/40 dark:text-red-300 dark:ring-red-800",
  info:
    "bg-gradient-to-b from-sky-50 to-sky-100/70 text-sky-700 ring-1 ring-sky-200 dark:from-sky-950 dark:to-sky-900/40 dark:text-sky-300 dark:ring-sky-800",
};

export function Badge({
  color = "default",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { color?: keyof typeof badgeColors }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold shadow-sm",
        badgeColors[color],
        className
      )}
      {...props}
    />
  );
}
