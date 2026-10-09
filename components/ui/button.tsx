import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg" | "icon";
}

const variants: Record<string, string> = {
  primary: "bg-accent-600 text-white hover:bg-accent-700 active:bg-accent-800",
  secondary:
    "bg-white text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50 hover:ring-slate-300 " +
    "dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700 dark:hover:bg-slate-700/60 dark:hover:ring-slate-600",
  outline:
    "border border-slate-300 bg-white text-slate-700 hover:border-accent-400 hover:bg-accent-50 hover:text-accent-700 " +
    "dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-accent-700 dark:hover:bg-accent-950 dark:hover:text-accent-300",
  ghost:
    "text-slate-600 hover:bg-accent-50 hover:text-accent-700 dark:text-slate-300 dark:hover:bg-accent-950 dark:hover:text-accent-300",
  danger: "bg-red-600 text-white hover:bg-red-700 active:bg-red-800",
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
        "inline-flex cursor-pointer items-center justify-center gap-2 rounded-sm font-semibold",
        "transition-colors duration-150",
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
