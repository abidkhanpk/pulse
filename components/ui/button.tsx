import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg" | "icon";
}

const variants: Record<string, string> = {
  primary:
    "bg-gradient-to-b from-indigo-600 to-indigo-700 text-white shadow-[0_1px_2px_rgba(79,70,229,0.4),inset_0_1px_0_rgba(255,255,255,0.15)] hover:from-indigo-500 hover:to-indigo-600",
  secondary:
    "bg-slate-100 text-slate-900 shadow-sm hover:bg-slate-200",
  outline:
    "border border-slate-300 bg-white text-slate-700 shadow-sm hover:border-slate-400 hover:bg-slate-50",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  danger:
    "bg-gradient-to-b from-red-600 to-red-700 text-white shadow-[0_1px_2px_rgba(220,38,38,0.4)] hover:from-red-500 hover:to-red-600",
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
        "inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl font-medium",
        "transition-all duration-150 active:scale-[0.97]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600",
        "disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}
