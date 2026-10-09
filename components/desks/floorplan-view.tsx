"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { Tooltip } from "@/components/ui/tooltip";
import { textShapeStyle } from "@/lib/floorplan-text";
import { AmenityChips } from "./amenity-chips";
import { getFloorplan, layoutOccupancy } from "@/app/(app)/desks/actions";
import { BookingDrawer } from "./booking-drawer";

interface DeskPos {
  id: string;
  label: string;
  status: string;
  xPct: number | null;
  yPct: number | null;
  markerShape: "CIRCLE" | "SQUARE" | "ROUNDED";
  amenities: string[];
}

interface Shape {
  id: string;
  kind: string;
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
  label: string | null;
  color: string | null;
  points: { x: number; y: number }[] | null;
  filled: boolean;
  fontSize?: number | null;
  fontFamily?: string | null;
  bold?: boolean;
  italic?: boolean;
}

function markerRadius(m: DeskPos["markerShape"]): string {
  return m === "SQUARE" ? "rounded-md" : m === "ROUNDED" ? "rounded-xl" : "rounded-full";
}

function shapeDivStyle(s: Shape): React.CSSProperties {
  const col = s.color ?? (s.kind === "WALL" ? "#475569" : "#6366f1");
  return {
    left: `${s.xPct}%`,
    top: `${s.yPct}%`,
    width: `${s.wPct}%`,
    height: `${s.hPct}%`,
    backgroundColor: s.kind === "ZONE" ? `${col}22` : s.kind === "RECTANGLE" ? `${col}14` : "transparent",
    border: `3px solid ${col}`,
    borderRadius: s.kind === "CIRCLE" ? "50%" : s.kind === "ZONE" ? 8 : s.kind === "RECTANGLE" ? 6 : 2,
  };
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

export function FloorplanView({
  labId,
  labName,
  desks: bookableDesks,
  people,
  projects,
  canBook,
}: {
  labId: string;
  labName: string;
  desks: { id: string; label: string; status: string }[];
  people: { id: string; name: string }[];
  projects: { id: string; name: string }[];
  canBook: boolean;
}) {
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);
  const [desks, setDesks] = React.useState<DeskPos[]>([]);
  const [shapes, setShapes] = React.useState<Shape[]>([]);
  const [occs, setOccs] = React.useState<Occ[]>([]);
  const [hasImage, setHasImage] = React.useState(false);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [bookingDeskId, setBookingDeskId] = React.useState<string | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labId, refreshKey]);

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
      <div className="flex flex-wrap items-center gap-3 text-xs">
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
        {canBook && (
          <span className="ml-auto font-medium text-accent-600 dark:text-accent-400">
            Click a station to book it
          </span>
        )}
      </div>

      <Card>
        <CardContent className="!p-3">
          <div className="relative w-full select-none overflow-hidden rounded-xl border border-slate-200 bg-slate-50 [container-type:inline-size] dark:border-slate-700 dark:bg-slate-800" style={{ aspectRatio: "16 / 10" }}>
            {imageUrl && <img src={imageUrl} alt={`${labName} floorplan`} className="absolute inset-0 h-full w-full object-contain" draggable={false} />}
            {shapes.filter((s) => s.kind !== "POLYGON" && s.kind !== "TEXT").map((s) => (
              <div key={s.id} className="pointer-events-none absolute" style={shapeDivStyle(s)}>
                {(s.kind === "ZONE" || s.kind === "RECTANGLE") && s.label && (
                  <span className="absolute left-1 top-1 rounded bg-black/50 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {s.label}
                  </span>
                )}
              </div>
            ))}
            {shapes.filter((s) => s.kind === "TEXT").map((s) => (
              <div
                key={s.id}
                className="pointer-events-none absolute max-w-[45%] whitespace-pre-wrap px-1 py-0.5"
                style={textShapeStyle(s)}
              >
                {s.label}
              </div>
            ))}
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {shapes.filter((s) => s.kind === "POLYGON").map((s) => {
                const col = s.color ?? "#6366f1";
                const pts = (s.points ?? []).map((p) => `${p.x},${p.y}`).join(" ");
                return (
                  <polygon
                    key={s.id}
                    points={pts}
                    fill={s.filled ? `${col}22` : "none"}
                    stroke={col}
                    strokeWidth={3}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </svg>
            {placed.map((d) => {
              const st = statusOf(d);
              const rad = markerRadius(d.markerShape);
              const bookable = canBook && d.status !== "MAINTENANCE";
              const list = occByDesk.get(d.id) ?? [];
              const statusText =
                st === "occupied" ? "Occupied now" : st === "upcoming" ? "Booked later today" : st === "maintenance" ? "Under maintenance" : "Free";
              const color =
                st === "occupied" ? "bg-red-500" : st === "upcoming" ? "bg-sky-500" : st === "maintenance" ? "bg-amber-500" : "bg-emerald-500";
              return (
                <Tooltip
                  key={d.id}
                  content={
                    <div className="min-w-[180px]">
                      <p className="font-bold text-slate-800 dark:text-slate-100">
                        {d.label} <span className="ml-1 font-medium text-slate-400">{statusText}</span>
                      </p>
                      {d.amenities.length > 0 && (
                        <div className="mt-1.5">
                          <AmenityChips labels={d.amenities} />
                        </div>
                      )}
                      {list.length > 0 ? (
                        <ul className="mt-1 space-y-0.5 text-slate-600 dark:text-slate-300">
                          {list.map((o, i) => (
                            <li key={i}>
                              {o.personName} · {fmtTime(o.timeStart)}–{fmtTime(o.timeEnd)}
                              {o.title ? ` · ${o.title}` : ""}
                              {o.occupiedNow && <span className="ml-1 font-semibold text-red-500">● now</span>}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-0.5 text-slate-400">{st === "maintenance" ? "Out of service" : "No bookings today"}</p>
                      )}
                    </div>
                  }
                >
                  <button
                    onClick={() => {
                      if (bookable) {
                        // Bookers go straight to the booking dialog with this station preselected.
                        setBookingDeskId(d.id);
                      } else {
                        // Everyone else (and maintenance stations) gets the inspection card.
                        setSelected(selected === d.id ? null : d.id);
                      }
                    }}
                    className={`absolute flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center ${rad} text-[10px] font-bold text-white shadow-lg transition-transform hover:scale-110 ${
                      selected === d.id ? "ring-2 ring-accent-500 ring-offset-2" : ""
                    }`}
                    style={{ left: `${d.xPct}%`, top: `${d.yPct}%` }}
                  >
                    {/* Roomer-style ripple on currently occupied stations */}
                    {st === "occupied" && (
                      <span className="absolute inset-0">
                        <span className={`ripple-ring absolute inset-0 ${rad} bg-red-500`} />
                        <span className={`ripple-ring ripple-delay absolute inset-0 ${rad} bg-red-500`} />
                      </span>
                    )}
                    <span className={`${color} absolute inset-0 ${rad}`} />
                    <span className="relative">{d.label.slice(0, 4)}</span>
                  </button>
                </Tooltip>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {selDesk && (
        <Card>
          <CardContent className="!py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {selDesk.label}
                <span className="ml-2 text-xs font-normal text-slate-400">
                  {statusOf(selDesk) === "occupied" ? "Occupied now" : statusOf(selDesk) === "upcoming" ? "Booked later today" : statusOf(selDesk) === "maintenance" ? "Under maintenance" : "Free"}
                </span>
              </p>
              {selDesk.amenities.length > 0 && (
                <div className="mt-1.5">
                  <AmenityChips labels={selDesk.amenities} />
                </div>
              )}
            </div>
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

      {bookingDeskId && (
        <BookingDrawer
          key={bookingDeskId}
          open={!!bookingDeskId}
          onClose={() => setBookingDeskId(null)}
          onSaved={() => {
            setBookingDeskId(null);
            setRefreshKey((k) => k + 1);
          }}
          defaults={{ deskId: bookingDeskId }}
          people={people}
          desks={bookableDesks}
          projects={projects}
          initial={null}
        />
      )}
    </div>
  );
}
