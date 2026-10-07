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
        "rounded-2xl border border-slate-200/80 bg-white",
        "shadow-[0_1px_3px_rgba(15,23,42,0.06),0_1px_2px_rgba(15,23,42,0.04)]",
        hover &&
          "cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(15,23,42,0.10)]",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center justify-between border-b border-slate-100 px-5 py-4", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-base font-semibold tracking-tight text-slate-900", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 py-4", className)} {...props} />;
}

const badgeColors: Record<string, string> = {
  default: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
  primary: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
  success: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  warning: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  danger: "bg-red-50 text-red-700 ring-1 ring-red-200",
  info: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
};

export function Badge({
  color = "default",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { color?: keyof typeof badgeColors }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        badgeColors[color],
        className
      )}
      {...props}
    />
  );
}
