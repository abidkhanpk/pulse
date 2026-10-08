import * as React from "react";
import { cn } from "@/lib/utils";

const fieldBase =
  "flex w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 " +
  "shadow-[inset_0_1px_2px_rgb(15,23,42,0.05)] transition-all duration-200 ease-liquid " +
  "placeholder:text-slate-400 hover:border-slate-300 " +
  "focus:border-accent-400 focus:outline-none focus:ring-4 focus:ring-accent-500/15 focus:shadow-[0_0_0_4px_var(--accent-100),inset_0_1px_2px_rgb(15,23,42,0.05)] " +
  "dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100 dark:placeholder:text-slate-500 dark:hover:border-slate-600 " +
  "dark:focus:border-accent-500 dark:focus:ring-accent-500/20 dark:focus:shadow-[0_0_0_4px_rgb(99,102,241,0.12)] " +
  "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 dark:disabled:bg-slate-800/60 dark:disabled:text-slate-500";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldBase, "h-10", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldBase, "min-h-[80px]", className)} {...props} />;
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1.5 block text-sm font-semibold tracking-tight text-slate-700 dark:text-slate-300", className)}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(fieldBase, "h-10 cursor-pointer pr-9", className)} {...props}>
      {children}
    </select>
  );
}

export function Checkbox({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={cn(
        "h-[18px] w-[18px] shrink-0 cursor-pointer rounded-md border-slate-300 accent-accent-600",
        "transition-all duration-150 focus:ring-4 focus:ring-accent-500/20",
        className
      )}
      {...props}
    />
  );
}

/** Animated toggle switch (for on/off settings). */
export function Switch({
  checked,
  onChange,
  className,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  className?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-300 ease-liquid",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600",
        checked ? "bg-gradient-to-b from-accent-500 to-accent-700 shadow-glow-sm" : "bg-slate-200 dark:bg-slate-700",
        className
      )}
    >
      <span
        className={cn(
          "inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow-md transition-transform duration-300 ease-spring",
          checked ? "translate-x-[22px]" : "translate-x-[3px]"
        )}
      />
    </button>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">{message}</p>;
}
