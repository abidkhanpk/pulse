"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { getFloorplan, layoutOccupancy } from "@/app/(app)/desks/actions";

interface DeskPos {
  id: string;
  label: string;
  status: string;
  xPct: number | null;
  yPct: number | null;
}

interface Occ {
  deskId: string | null;
  occupiedNow: boolean;
  upcoming: boolean;
  personName: string;
  title: string | null;
  timeStart: string;
  timeEnd: string;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-PK", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Karachi",
  });
}

export function FloorplanView({ labId, labName }: { labId: string; labName: string }) {
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);
  const [desks, setDesks] = React.useState<DeskPos[]>([]);
  const [shapes, setShapes] = React.useState<
    { id: string; kind: string; xPct: number; yPct: number; wPct: number; hPct: number; label: string | null; color: string | null }[]
  >([]);
  const [occs, setOccs] = React.useState<Occ[]>([]);
  const [hasImage, setHasImage] = React.useState(false);
  const [selected, setSelected] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      const fp = await getFloorplan(labId);
      if (fp) {
        setHasImage(fp.hasImage);
        setImageUrl(fp.imageUrl);
        setDesks(fp.desks);
        setShapes(fp.shapes);
      }
      setOccs(await layoutOccupancy(labId));
    })();
  }, [labId]);

  const placed = desks.filter((d) => d.xPct != null);
  const occByDesk = new Map<string, Occ[]>();
  for (const o of occs) {
    if (!o.deskId) continue;
    if (!occByDesk.has(o.deskId)) occByDesk.set(o.deskId, []);
    occByDesk.get(o.deskId)!.push(o);
  }

  function statusOf(d: DeskPos): "maintenance" | "occupied" | "upcoming" | "free" {
    if (d.status === "MAINTENANCE") return "maintenance";
    const list = occByDesk.get(d.id) ?? [];
    if (list.some((o) => o.occupiedNow)) return "occupied";
    if (list.some((o) => o.upcoming)) return "upcoming";
    return "free";
  }

  const selDesk = desks.find((d) => d.id === selected);
  const selOccs = selected ? occByDesk.get(selected) ?? [] : [];

  if (!hasImage) {
    return (
      <EmptyState
        title="No floorplan yet"
        description={`No layout image has been set up for ${labName}. Ask a lab admin to upload one under Desks → Layout → Edit layout.`}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 text-xs">
        {[
          ["bg-red-500", "Occupied now"],
          ["bg-emerald-500", "Free"],
          ["bg-sky-500", "Booked later today"],
          ["bg-amber-500", "Maintenance"],
        ].map(([dot, label]) => (
          <span key={label} className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
            {label}
          </span>
        ))}
      </div>

      <Card>
        <CardContent className="!p-3">
          <div className="relative w-full select-none overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800" style={{ aspectRatio: "16 / 10" }}>
            {imageUrl && <img src={imageUrl} alt={`${labName} floorplan`} className="absolute inset-0 h-full w-full object-contain" draggable={false} />}
            {shapes.map((s) => (
              <div
                key={s.id}
                className="pointer-events-none absolute"
                style={{
                  left: `${s.xPct}%`,
                  top: `${s.yPct}%`,
                  width: `${s.wPct}%`,
                  height: `${s.hPct}%`,
                  backgroundColor: s.kind === "ZONE" ? `${s.color ?? "#6366f1"}22` : "transparent",
                  border: `3px solid ${s.color ?? "#475569"}`,
                  borderRadius: s.kind === "ZONE" ? 8 : 2,
                }}
              >
                {s.kind === "ZONE" && s.label && (
                  <span className="absolute left-1 top-1 rounded bg-black/50 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {s.label}
                  </span>
                )}
              </div>
            ))}
            {placed.map((d) => {
              const st = statusOf(d);
              const color =
                st === "occupied" ? "bg-red-500" : st === "upcoming" ? "bg-sky-500" : st === "maintenance" ? "bg-amber-500" : "bg-emerald-500";
              return (
                <button
                  key={d.id}
                  onClick={() => setSelected(selected === d.id ? null : d.id)}
                  className={`absolute flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-lg transition-transform hover:scale-110 ${
                    selected === d.id ? "ring-2 ring-indigo-500 ring-offset-2" : ""
                  }`}
                  style={{ left: `${d.xPct}%`, top: `${d.yPct}%` }}
                  title={`${d.label} — ${st}`}
                >
                  {/* Roomer-style ripple on currently occupied stations */}
                  {st === "occupied" && (
                    <span className="absolute inset-0">
                      <span className="ripple-ring absolute inset-0 rounded-full bg-red-500" />
                      <span className="ripple-ring ripple-delay absolute inset-0 rounded-full bg-red-500" />
                    </span>
                  )}
                  <span className={`${color} absolute inset-0 rounded-full`} />
                  <span className="relative">{d.label.slice(0, 4)}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {selDesk && (
        <Card>
          <CardContent className="!py-3">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {selDesk.label}
              <span className="ml-2 text-xs font-normal text-slate-400">
                {statusOf(selDesk) === "occupied" ? "Occupied now" : statusOf(selDesk) === "upcoming" ? "Booked later today" : statusOf(selDesk) === "maintenance" ? "Under maintenance" : "Free"}
              </span>
            </p>
            {selOccs.length > 0 ? (
              <ul className="mt-1 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                {selOccs.map((o, i) => (
                  <li key={i}>
                    {o.personName} · {fmtTime(o.timeStart)}–{fmtTime(o.timeEnd)}
                    {o.title ? ` · ${o.title}` : ""}
                    {o.occupiedNow && <span className="ml-1 font-semibold text-red-600">● now</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-slate-400">No bookings today.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
