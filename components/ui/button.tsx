import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg" | "icon";
}

const variants: Record<string, string> = {
  primary:
    "bg-gradient-to-b from-accent-500 via-accent-600 to-accent-700 text-white " +
    "shadow-[inset_0_1px_0_rgb(255,255,255,0.22),0_2px_8px_-2px_var(--accent-600),0_10px_24px_-10px_var(--accent-600)] " +
    "hover:brightness-110 active:brightness-95",
  secondary:
    "bg-white text-slate-800 ring-1 ring-slate-200 shadow-soft hover:-translate-y-px hover:shadow-lift hover:ring-slate-300 " +
    "dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700 dark:hover:ring-slate-600",
  outline:
    "border border-slate-300 bg-white/60 text-slate-700 shadow-sm backdrop-blur-sm hover:border-accent-300 hover:bg-accent-50 hover:text-accent-700 " +
    "dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:border-accent-700 dark:hover:bg-accent-950 dark:hover:text-accent-300",
  ghost:
    "text-slate-600 hover:bg-accent-50 hover:text-accent-700 dark:text-slate-300 dark:hover:bg-accent-950 dark:hover:text-accent-300",
  danger:
    "bg-gradient-to-b from-red-500 to-red-700 text-white " +
    "shadow-[inset_0_1px_0_rgb(255,255,255,0.2),0_2px_8px_-2px_rgb(220,38,38,0.5)] " +
    "hover:brightness-110 active:brightness-95",
};

const sizes: Record<string, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-6 text-base",
  icon: "h-9 w-9",
};

export function Button({ variant = "primary", size = "md", className, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl font-semibold",
        "transition-all duration-200 ease-liquid active:scale-[0.97]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600",
        "disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}
