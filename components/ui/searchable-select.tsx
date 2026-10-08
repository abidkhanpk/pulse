"use client";

import * as React from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchableOption {
  value: string;
  label: string;
}

/**
 * Searchable single-select combobox — a drop-in replacement for the native
 * Select when the option list is long (people, assignees, …).
 * Type to filter, ↑/↓ to move, Enter to pick, Esc to close.
 */
export function SearchableSelect({
  id,
  value,
  onChange,
  options,
  placeholder = "Select…",
  disabled,
  className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: SearchableOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [hi, setHi] = React.useState(0);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  React.useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open ]);

  function openDropdown() {
    setQuery("");
    setHi(0);
    setOpen(true);
  }

  React.useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => searchRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open ]);

  const selected = options.find((o) => o.value === value);

  function choose(v: string) {
    onChange(v);
    setOpen(false);
  }

  function moveHi(d: number) {
    const n = Math.min(Math.max(hi + d, 0), filtered.length - 1);
    setHi(n);
    requestAnimationFrame(() => {
      listRef.current?.children[n]?.scrollIntoView({ block: "nearest" });
    });
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openDropdown())}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            openDropdown();
          }
        }}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100",
          "focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100",
          "disabled:cursor-not-allowed disabled:bg-slate-50 dark:disabled:bg-slate-800/60",
          !selected && "text-slate-400 dark:text-slate-500"
        )}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className="border-b border-slate-100 p-2 dark:border-slate-800">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setHi(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setOpen(false);
                  else if (e.key === "ArrowDown") {
                    e.preventDefault();
                    moveHi(1);
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    moveHi(-1);
                  } else if (e.key === "Enter" && filtered[hi]) {
                    e.preventDefault();
                    choose(filtered[hi].value);
                  }
                }}
                placeholder="Type to search…"
                className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 pl-8 pr-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>
          <ul ref={listRef} className="max-h-56 overflow-y-auto p-1">
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-slate-400">No matches</li>
            )}
            {filtered.map((o, i) => (
              <li key={`${i}-${o.value}`}>
                <button
                  type="button"
                  onClick={() => choose(o.value)}
                  onMouseEnter={() => setHi(i)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm",
                    i === hi
                      ? "bg-indigo-50 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-100"
                      : "text-slate-700 dark:text-slate-300"
                  )}
                >
                  <span className="truncate">{o.label}</span>
                  {o.value === value && <Check className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
