/** Amenities as small wrapping chips — never one long line in a tooltip. */
export function AmenityChips({ labels }: { labels: string[] | null | undefined }) {
  if (!labels || labels.length === 0) return null;
  return (
    <div className="flex max-w-[230px] flex-wrap gap-1">
      {labels.map((l) => (
        <span
          key={l}
          className="rounded-sm border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium leading-tight text-slate-600 dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-300"
        >
          {l}
        </span>
      ))}
    </div>
  );
}
