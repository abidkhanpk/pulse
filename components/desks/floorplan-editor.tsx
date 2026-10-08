"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import {
  getFloorplan,
  uploadFloorplan,
  deleteFloorplan,
  saveDeskPositions,
  saveFloorplanShapes,
  updateDesk,
  setDeskStatus,
} from "@/app/(app)/desks/actions";

type Tool = "select" | "station" | "wall" | "zone" | "rectangle" | "circle" | "polygon";
type ShapeKind = "WALL" | "ZONE" | "RECTANGLE" | "CIRCLE" | "POLYGON";
type MarkerShape = "CIRCLE" | "SQUARE" | "ROUNDED";

interface DeskPos {
  id: string;
  label: string;
  status: string;
  xPct: number | null;
  yPct: number | null;
  markerShape: MarkerShape;
}

interface Shape {
  id: string;
  kind: ShapeKind;
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
  label: string | null;
  color: string | null;
  points: { x: number; y: number }[] | null;
  filled: boolean;
}

const ZONE_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#0ea5e9", "#f43f5e", "#8b5cf6"];

const KIND_LABEL: Record<ShapeKind, string> = {
  WALL: "Wall",
  ZONE: "Zone",
  RECTANGLE: "Rectangle",
  CIRCLE: "Circle",
  POLYGON: "Polygon",
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function FloorplanEditor({ labId, labName }: { labId: string; labName: string }) {
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);
  const [hasImage, setHasImage] = React.useState(false);
  const [desks, setDesks] = React.useState<DeskPos[]>([]);
  const [shapes, setShapes] = React.useState<Shape[]>([]);
  const [tool, setTool] = React.useState<Tool>("select");
  const [trayDeskId, setTrayDeskId] = React.useState("");
  const [selectedDesk, setSelectedDesk] = React.useState<string | null>(null);
  const [selectedShape, setSelectedShape] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const [drawStart, setDrawStart] = React.useState<{ x: number; y: number } | null>(null);
  const [drawCur, setDrawCur] = React.useState<{ x: number; y: number } | null>(null);
  const [dragDesk, setDragDesk] = React.useState<string | null>(null);
  const [dragShape, setDragShape] = React.useState<{ id: string; dx: number; dy: number } | null>(null);
  const [polyPoints, setPolyPoints] = React.useState<{ x: number; y: number }[]>([]);
  const [polyCursor, setPolyCursor] = React.useState<{ x: number; y: number } | null>(null);
  const canvasRef = React.useRef<HTMLDivElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const load = React.useCallback(async () => {
    const fp = await getFloorplan(labId);
    if (!fp) return;
    setHasImage(fp.hasImage);
    setImageUrl(fp.imageUrl);
    setDesks(fp.desks as DeskPos[]);
    setShapes(fp.shapes as Shape[]);
    setDirty(false);
    setSelectedDesk(null);
    setSelectedShape(null);
    setPolyPoints([]);
    setPolyCursor(null);
  }, [labId]);

  React.useEffect(() => {
    load();
  }, [load]);

  // Esc cancels an in-progress polygon.
  React.useEffect(() => {
    if (tool !== "polygon" || polyPoints.length === 0) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPolyPoints([]);
        setPolyCursor(null);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [tool, polyPoints.length]);

  function pctFromEvent(e: React.MouseEvent): { x: number; y: number } {
    const el = canvasRef.current!;
    const r = el.getBoundingClientRect();
    return {
      x: clamp(((e.clientX - r.left) / r.width) * 100, 0, 100),
      y: clamp(((e.clientY - r.top) / r.height) * 100, 0, 100),
    };
  }

  function finishPolygon() {
    if (polyPoints.length < 3) {
      alert("Click at least 3 points to make a polygon.");
      return;
    }
    const xs = polyPoints.map((p) => p.x);
    const ys = polyPoints.map((p) => p.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    const w = Math.max(...xs) - x;
    const h = Math.max(...ys) - y;
    if (w < 0.5 || h < 0.5) {
      alert("Polygon is too small.");
      return;
    }
    const id = `new-${Date.now()}`;
    setShapes((ss) => [
      ...ss,
      {
        id,
        kind: "POLYGON",
        xPct: x,
        yPct: y,
        wPct: w,
        hPct: h,
        label: "Polygon",
        color: ZONE_COLORS[ss.length % ZONE_COLORS.length],
        points: polyPoints,
        filled: true,
      },
    ]);
    setPolyPoints([]);
    setPolyCursor(null);
    setSelectedShape(id);
    setSelectedDesk(null);
    setDirty(true);
  }

  function beginShapeDrag(e: React.MouseEvent, s: Shape) {
    const p = pctFromEvent(e);
    setDragShape({ id: s.id, dx: p.x - s.xPct, dy: p.y - s.yPct });
  }

  function onShapeMouseDown(e: React.MouseEvent, s: Shape) {
    if (tool !== "select") return;
    e.stopPropagation();
    setSelectedShape(s.id);
    setSelectedDesk(null);
    beginShapeDrag(e, s);
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (hasImage && !confirm("This will REPLACE the existing layout image for this lab. Continue?")) {
      e.target.value = "";
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((res, rej) => {
        const rd = new FileReader();
        rd.onload = () => res(String(rd.result));
        rd.onerror = rej;
        rd.readAsDataURL(f);
      });
      const dims = await new Promise<{ w: number; h: number }>((res) => {
        const img = new Image();
        img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight });
        img.src = dataUrl;
      });
      const r = await uploadFloorplan({ labId, dataUrl, width: dims.w, height: dims.h });
      if (!r.ok) alert(r.error);
      else load();
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function onDeleteImage() {
    if (!confirm("Delete the layout image? Station positions are kept.")) return;
    const r = await deleteFloorplan(labId);
    if (!r.ok) alert(r.error);
    else load();
  }

  function onCanvasDown(e: React.MouseEvent) {
    if (!hasImage) return;
    const p = pctFromEvent(e);
    if (tool === "station") {
      const id = trayDeskId;
      if (!id) {
        alert("Pick a station from the tray first (stations are created under the Manage tab).");
        return;
      }
      setDesks((ds) => ds.map((d) => (d.id === id ? { ...d, xPct: p.x, yPct: p.y } : d)));
      setTrayDeskId("");
      setDirty(true);
      return;
    }
    if (tool === "polygon") {
      // Click near the first vertex to close; ignore double-click duplicates.
      if (polyPoints.length >= 3) {
        const f = polyPoints[0];
        if (Math.hypot(p.x - f.x, p.y - f.y) < 2) {
          finishPolygon();
          return;
        }
      }
      const last = polyPoints[polyPoints.length - 1];
      if (last && Math.hypot(p.x - last.x, p.y - last.y) < 1) return;
      setPolyPoints((ps) => [...ps, p]);
      return;
    }
    if (tool === "wall" || tool === "zone" || tool === "rectangle" || tool === "circle") {
      setDrawStart(p);
      setDrawCur(p);
    }
  }

  function onCanvasMove(e: React.MouseEvent) {
    if (dragDesk) {
      const p = pctFromEvent(e);
      setDesks((ds) => ds.map((d) => (d.id === dragDesk ? { ...d, xPct: p.x, yPct: p.y } : d)));
      setDirty(true);
      return;
    }
    if (dragShape) {
      const p = pctFromEvent(e);
      setShapes((ss) =>
        ss.map((s) => {
          if (s.id !== dragShape.id) return s;
          const nx = clamp(p.x - dragShape.dx, 0, 100 - s.wPct);
          const ny = clamp(p.y - dragShape.dy, 0, 100 - s.hPct);
          if (s.kind === "POLYGON" && s.points) {
            const ddx = nx - s.xPct;
            const ddy = ny - s.yPct;
            return { ...s, xPct: nx, yPct: ny, points: s.points.map((pt) => ({ x: pt.x + ddx, y: pt.y + ddy })) };
          }
          return { ...s, xPct: nx, yPct: ny };
        })
      );
      setDirty(true);
      return;
    }
    if (drawStart) {
      setDrawCur(pctFromEvent(e));
      return;
    }
    if (tool === "polygon" && polyPoints.length > 0) {
      setPolyCursor(pctFromEvent(e));
    }
  }

  function onCanvasUp() {
    if (dragDesk) {
      setDragDesk(null);
      return;
    }
    if (dragShape) {
      setDragShape(null);
      return;
    }
    if (drawStart && drawCur) {
      const x = Math.min(drawStart.x, drawCur.x);
      const y = Math.min(drawStart.y, drawCur.y);
      const w = Math.abs(drawCur.x - drawStart.x);
      const h = Math.abs(drawCur.y - drawStart.y);
      if (w > 0.5 && h > 0.5) {
        const kind: ShapeKind = tool === "wall" ? "WALL" : tool === "zone" ? "ZONE" : tool === "rectangle" ? "RECTANGLE" : "CIRCLE";
        const id = `new-${Date.now()}`;
        const zoneLike = kind === "ZONE" || kind === "RECTANGLE" || kind === "CIRCLE";
        setShapes((ss) => [
          ...ss,
          {
            id,
            kind,
            xPct: x,
            yPct: y,
            wPct: w,
            hPct: h,
            label: kind === "ZONE" ? "Zone" : kind === "RECTANGLE" ? "Rectangle" : kind === "CIRCLE" ? "Circle" : null,
            color: kind === "WALL" ? "#475569" : ZONE_COLORS[ss.length % ZONE_COLORS.length],
            points: null,
            filled: zoneLike,
          },
        ]);
        setSelectedShape(id);
        setSelectedDesk(null);
        setDirty(true);
      }
      setDrawStart(null);
      setDrawCur(null);
    }
  }

  async function onSave() {
    setSaving(true);
    try {
      // Send every station: placed with coordinates, unplaced with nulls so
      // "Remove from layout" actually clears them server-side.
      const [r1, r2] = await Promise.all([
        saveDeskPositions({
          labId,
          positions: desks.map((d) => ({ id: d.id, xPct: d.xPct ?? null, yPct: d.yPct ?? null })),
        }),
        saveFloorplanShapes({
          labId,
          shapes: shapes.map((s) => ({
            kind: s.kind,
            xPct: s.xPct,
            yPct: s.yPct,
            wPct: s.wPct,
            hPct: s.hPct,
            label: s.label,
            color: s.color,
            points: s.points,
            filled: s.filled,
          })),
        }),
      ]);
      if (!r1.ok) alert(r1.error);
      else if (!r2.ok) alert(r2.error);
      else {
        setDirty(false);
        load();
      }
    } finally {
      setSaving(false);
    }
  }

  const placed = desks.filter((d) => d.xPct != null);
  const unplaced = desks.filter((d) => d.xPct == null);
  const selDesk = desks.find((d) => d.id === selectedDesk);
  const selShape = shapes.find((s) => s.id === selectedShape);
  const polygons = shapes.filter((s) => s.kind === "POLYGON");

  function shapeStyle(s: Shape): React.CSSProperties {
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

  function markerRadius(m: MarkerShape): string {
    return m === "SQUARE" ? "rounded-md" : m === "ROUNDED" ? "rounded-xl" : "rounded-full";
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Floorplan — {labName}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Upload the lab layout, then place stations and draw walls, zones and shapes.
          </p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onUpload} />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? "Uploading…" : hasImage ? "Replace image" : "Upload layout image"}
          </Button>
          {hasImage && (
            <Button variant="outline" size="sm" onClick={onDeleteImage} className="text-red-600">
              Delete image
            </Button>
          )}
          <Button size="sm" onClick={onSave} disabled={saving || !dirty}>
            {saving ? "Saving…" : dirty ? "Save layout *" : "Saved"}
          </Button>
        </div>
      </div>

      {!hasImage ? (
        <EmptyState title="No layout image" description="Upload a floorplan image of the lab to start placing stations on it." />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
          <Card>
            <CardContent className="!p-3">
              <div className="mb-2 flex flex-wrap gap-1.5">
                {(
                  [
                    ["select", "Select / move"],
                    ["station", "Place station"],
                    ["wall", "Wall"],
                    ["zone", "Zone"],
                    ["rectangle", "Rectangle"],
                    ["circle", "Circle"],
                    ["polygon", "Polygon"],
                  ] as [Tool, string][]
                ).map(([t, label]) => (
                  <button
                    key={t}
                    onClick={() => {
                      setTool(t);
                      setPolyPoints([]);
                      setPolyCursor(null);
                    }}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      tool === t
                        ? "bg-indigo-600 text-white shadow"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {tool === "polygon" && polyPoints.length > 0 && (
                <div className="mb-2 flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                  <span>{polyPoints.length} points — double-click or click near the start to close, Esc to cancel.</span>
                  <Button size="sm" variant="outline" className="ml-auto !py-0.5 !text-xs" onClick={finishPolygon}>
                    Finish
                  </Button>
                  <Button size="sm" variant="outline" className="!py-0.5 !text-xs" onClick={() => { setPolyPoints([]); setPolyCursor(null); }}>
                    Cancel
                  </Button>
                </div>
              )}
              <div
                ref={canvasRef}
                className="relative w-full select-none overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800"
                style={{ aspectRatio: "16 / 10", cursor: tool === "select" ? "default" : "crosshair" }}
                onMouseDown={onCanvasDown}
                onMouseMove={onCanvasMove}
                onMouseUp={onCanvasUp}
                onDoubleClick={() => {
                  if (tool === "polygon") finishPolygon();
                }}
                onMouseLeave={() => {
                  setDragDesk(null);
                  setDragShape(null);
                  setDrawStart(null);
                  setDrawCur(null);
                  setPolyCursor(null);
                }}
              >
                {imageUrl && <img src={imageUrl} alt="Lab floorplan" className="absolute inset-0 h-full w-full object-contain" draggable={false} />}
                {/* rect-like shapes */}
                {shapes.filter((s) => s.kind !== "POLYGON").map((s) => (
                  <div
                    key={s.id}
                    onMouseDown={(e) => onShapeMouseDown(e, s)}
                    className={`absolute ${tool === "select" ? "cursor-move" : ""} ${selectedShape === s.id ? "ring-2 ring-indigo-500" : ""}`}
                    style={shapeStyle(s)}
                    title={s.label ?? KIND_LABEL[s.kind]}
                  >
                    {(s.kind === "ZONE" || s.kind === "RECTANGLE") && s.label && (
                      <span className="absolute left-1 top-1 rounded bg-black/50 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        {s.label}
                      </span>
                    )}
                  </div>
                ))}
                {/* polygons (SVG overlay so arbitrary vertex lists render) */}
                <svg
                  className="absolute inset-0 h-full w-full"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  style={{ pointerEvents: "none" }}
                >
                  {polygons.map((s) => {
                    const col = s.color ?? "#6366f1";
                    const pts = (s.points ?? []).map((p) => `${p.x},${p.y}`).join(" ");
                    return (
                      <g
                        key={s.id}
                        onMouseDown={(e) => onShapeMouseDown(e, s)}
                        style={{ pointerEvents: "all", cursor: tool === "select" ? "move" : "default" }}
                      >
                        {s.filled ? (
                          <polygon points={pts} fill="rgba(0,0,0,0)" stroke="none" />
                        ) : (
                          <polygon points={pts} fill="none" stroke="rgba(0,0,0,0)" strokeWidth={14} />
                        )}
                        <polygon
                          points={pts}
                          fill={s.filled ? `${col}22` : "none"}
                          stroke={col}
                          strokeWidth={3}
                          vectorEffect="non-scaling-stroke"
                          pointerEvents="none"
                        />
                        {selectedShape === s.id && (
                          <polygon
                            points={pts}
                            fill="none"
                            stroke="#6366f1"
                            strokeWidth={1.5}
                            strokeDasharray="4 2"
                            vectorEffect="non-scaling-stroke"
                            pointerEvents="none"
                          />
                        )}
                      </g>
                    );
                  })}
                  {tool === "polygon" && polyPoints.length > 0 && polyCursor && (
                    <polyline
                      points={[...polyPoints, polyCursor].map((p) => `${p.x},${p.y}`).join(" ")}
                      fill="none"
                      stroke="#6366f1"
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      vectorEffect="non-scaling-stroke"
                      pointerEvents="none"
                    />
                  )}
                </svg>
                {/* polygon vertex dots */}
                {tool === "polygon" &&
                  polyPoints.map((p, i) => (
                    <div
                      key={i}
                      className="pointer-events-none absolute z-10 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-600 ring-2 ring-white"
                      style={{ left: `${p.x}%`, top: `${p.y}%` }}
                    />
                  ))}
                {/* in-progress draw rect */}
                {drawStart && drawCur && (
                  <div
                    className="pointer-events-none absolute border-2 border-dashed border-indigo-500 bg-indigo-500/10"
                    style={{
                      left: `${Math.min(drawStart.x, drawCur.x)}%`,
                      top: `${Math.min(drawStart.y, drawCur.y)}%`,
                      width: `${Math.abs(drawCur.x - drawStart.x)}%`,
                      height: `${Math.abs(drawCur.y - drawStart.y)}%`,
                      borderRadius: tool === "circle" ? "50%" : 4,
                    }}
                  />
                )}
                {/* station markers */}
                {placed.map((d) => (
                  <button
                    key={d.id}
                    onMouseDown={(e) => {
                      if (tool === "select") {
                        e.stopPropagation();
                        setDragDesk(d.id);
                        setSelectedDesk(d.id);
                        setSelectedShape(null);
                      }
                    }}
                    onClick={(e) => {
                      if (tool === "select") e.stopPropagation();
                    }}
                    className={`absolute z-10 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center text-[10px] font-bold text-white shadow-lg transition-transform ${
                      selectedDesk === d.id ? "ring-2 ring-indigo-500 ring-offset-2 scale-110" : "hover:scale-110"
                    } ${markerRadius(d.markerShape)} ${d.status === "MAINTENANCE" ? "bg-amber-500" : "bg-indigo-600"}`}
                    style={{ left: `${d.xPct}%`, top: `${d.yPct}%`, cursor: tool === "select" ? "move" : "default" }}
                    title={d.label}
                  >
                    {d.label.slice(0, 4)}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-400">
                {tool === "station" && "Click on the layout to place the selected tray station."}
                {tool === "wall" && "Drag on the layout to draw a wall."}
                {tool === "zone" && "Drag on the layout to draw a zone."}
                {tool === "rectangle" && "Drag on the layout to draw a rectangle."}
                {tool === "circle" && "Drag on the layout to draw a circle (ellipse)."}
                {tool === "polygon" && "Click to place each corner. Double-click, or click near the start point, to close the shape."}
                {tool === "select" && "Drag stations, walls and shapes to move them. Click a station or shape to edit it."}
              </p>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <Card>
              <CardHeader>
                <CardTitle>Station tray ({unplaced.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Select a station, then click the layout to place it.
                </p>
                <Select value={trayDeskId} onChange={(e) => { setTrayDeskId(e.target.value); if (e.target.value) setTool("station"); }}>
                  <option value="">— pick a station —</option>
                  {unplaced.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </Select>
              </CardContent>
            </Card>

            {selDesk && (
              <Card>
                <CardHeader>
                  <CardTitle>Station: {selDesk.label}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>
                    <Label>Rename</Label>
                    <div className="flex gap-1.5">
                      <Input id={`desk-rename-${selDesk.id}`} defaultValue={selDesk.label} />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          const el = document.getElementById(`desk-rename-${selDesk.id}`) as HTMLInputElement;
                          const r = await updateDesk(selDesk.id, { labId, label: el.value.trim() });
                          if (!r.ok) alert(r.error);
                          else load();
                        }}
                      >
                        ✓
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label>Marker shape</Label>
                    <div className="flex gap-1.5">
                      {(["CIRCLE", "SQUARE", "ROUNDED"] as MarkerShape[]).map((m) => (
                        <button
                          key={m}
                          title={m.charAt(0) + m.slice(1).toLowerCase()}
                          onClick={async () => {
                            const r = await updateDesk(selDesk.id, { labId, label: selDesk.label, markerShape: m });
                            if (!r.ok) alert(r.error);
                            else load();
                          }}
                          className={`flex h-9 w-9 items-center justify-center rounded-lg border transition ${
                            selDesk.markerShape === m
                              ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950"
                              : "border-slate-200 hover:border-slate-300 dark:border-slate-700"
                          }`}
                        >
                          <span
                            className={`h-4 w-4 bg-indigo-600 ${m === "CIRCLE" ? "rounded-full" : m === "SQUARE" ? "rounded-[2px]" : "rounded-md"}`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select
                      value={selDesk.status}
                      onChange={async (e) => {
                        const r = await setDeskStatus(selDesk.id, e.target.value as "ACTIVE" | "MAINTENANCE");
                        if (!r.ok) alert(r.error);
                        else load();
                      }}
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="MAINTENANCE">Maintenance</option>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setDesks((ds) => ds.map((d) => (d.id === selDesk.id ? { ...d, xPct: null, yPct: null } : d)));
                        setSelectedDesk(null);
                        setDirty(true);
                      }}
                    >
                      Remove from layout
                    </Button>
                  </div>
                  <p className="text-xs text-slate-400">
                    To delete the station itself, use Manage desks.
                  </p>
                </CardContent>
              </Card>
            )}

            {selShape && (
              <Card>
                <CardHeader>
                  <CardTitle>{KIND_LABEL[selShape.kind]}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {selShape.kind !== "WALL" && (
                    <>
                      <div>
                        <Label>Label</Label>
                        <Input
                          value={selShape.label ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            setShapes((ss) => ss.map((s) => (s.id === selShape.id ? { ...s, label: v } : s)));
                            setDirty(true);
                          }}
                        />
                      </div>
                      <div>
                        <Label>Color</Label>
                        <div className="flex gap-1.5">
                          {ZONE_COLORS.map((c) => (
                            <button
                              key={c}
                              onClick={() => {
                                setShapes((ss) => ss.map((s) => (s.id === selShape.id ? { ...s, color: c } : s)));
                                setDirty(true);
                              }}
                              className={`h-7 w-7 rounded-full ${selShape.color === c ? "ring-2 ring-indigo-500 ring-offset-2" : ""}`}
                              style={{ backgroundColor: c }}
                              title={c}
                            />
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                  {selShape.kind === "POLYGON" && (
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={selShape.filled}
                        onChange={(e) => {
                          const v = e.target.checked;
                          setShapes((ss) => ss.map((s) => (s.id === selShape.id ? { ...s, filled: v } : s)));
                          setDirty(true);
                        }}
                        className="h-4 w-4 accent-indigo-600"
                      />
                      Filled <span className="text-xs text-slate-400">(uncheck for outline only)</span>
                    </label>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600"
                    onClick={() => {
                      setShapes((ss) => ss.filter((s) => s.id !== selShape.id));
                      setSelectedShape(null);
                      setDirty(true);
                    }}
                  >
                    Delete {KIND_LABEL[selShape.kind].toLowerCase()}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
