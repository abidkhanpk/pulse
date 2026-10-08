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

type Tool = "select" | "station" | "wall" | "zone";

interface DeskPos {
  id: string;
  label: string;
  status: string;
  xPct: number | null;
  yPct: number | null;
}

interface Shape {
  id: string;
  kind: "WALL" | "ZONE";
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
  label: string | null;
  color: string | null;
}

const ZONE_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#0ea5e9", "#f43f5e", "#8b5cf6"];

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
  const canvasRef = React.useRef<HTMLDivElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const load = React.useCallback(async () => {
    const fp = await getFloorplan(labId);
    if (!fp) return;
    setHasImage(fp.hasImage);
    setImageUrl(fp.imageUrl);
    setDesks(fp.desks);
    setShapes(fp.shapes);
    setDirty(false);
    setSelectedDesk(null);
    setSelectedShape(null);
  }, [labId]);

  React.useEffect(() => {
    load();
  }, [load]);

  function pctFromEvent(e: React.MouseEvent): { x: number; y: number } {
    const el = canvasRef.current!;
    const r = el.getBoundingClientRect();
    return {
      x: Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)),
      y: Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100)),
    };
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
    if (tool === "wall" || tool === "zone") {
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
    if (drawStart) setDrawCur(pctFromEvent(e));
  }

  function onCanvasUp() {
    if (dragDesk) {
      setDragDesk(null);
      return;
    }
    if (drawStart && drawCur) {
      const x = Math.min(drawStart.x, drawCur.x);
      const y = Math.min(drawStart.y, drawCur.y);
      const w = Math.abs(drawCur.x - drawStart.x);
      const h = Math.abs(drawCur.y - drawStart.y);
      if (w > 0.5 && h > 0.5) {
        const kind = tool === "wall" ? "WALL" : "ZONE";
        const id = `new-${Date.now()}`;
        setShapes((ss) => [
          ...ss,
          { id, kind, xPct: x, yPct: y, wPct: w, hPct: h, label: kind === "ZONE" ? "Zone" : null, color: kind === "ZONE" ? ZONE_COLORS[ss.length % ZONE_COLORS.length] : "#475569" },
        ]);
        setSelectedShape(id);
        setDirty(true);
      }
      setDrawStart(null);
      setDrawCur(null);
    }
  }

  async function onSave() {
    setSaving(true);
    try {
      // Send every station: placed ones with coordinates, unplaced with nulls
      // so "Remove from layout" actually clears them server-side.
      const [r1, r2] = await Promise.all([
        saveDeskPositions({
          labId,
          positions: desks.map((d) => ({ id: d.id, xPct: d.xPct ?? null, yPct: d.yPct ?? null })),
        }),
        saveFloorplanShapes({
          labId,
          shapes: shapes
            .filter((s) => !s.id.startsWith("new-") || true)
            .map((s) => ({ kind: s.kind, xPct: s.xPct, yPct: s.yPct, wPct: s.wPct, hPct: s.hPct, label: s.label, color: s.color })),
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Floorplan — {labName}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Upload the lab layout, then place stations, draw walls and zones.
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
                    ["wall", "Draw wall"],
                    ["zone", "Draw zone"],
                  ] as [Tool, string][]
                ).map(([t, label]) => (
                  <button
                    key={t}
                    onClick={() => setTool(t)}
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
              <div
                ref={canvasRef}
                className="relative w-full select-none overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800"
                style={{ aspectRatio: "16 / 10", cursor: tool === "select" ? "default" : "crosshair" }}
                onMouseDown={onCanvasDown}
                onMouseMove={onCanvasMove}
                onMouseUp={onCanvasUp}
                onMouseLeave={() => {
                  setDragDesk(null);
                  setDrawStart(null);
                  setDrawCur(null);
                }}
              >
                {imageUrl && <img src={imageUrl} alt="Lab floorplan" className="absolute inset-0 h-full w-full object-contain" draggable={false} />}
                {/* shapes */}
                {shapes.map((s) => (
                  <div
                    key={s.id}
                    onMouseDown={(e) => {
                      if (tool === "select") {
                        e.stopPropagation();
                        setSelectedShape(s.id);
                        setSelectedDesk(null);
                      }
                    }}
                    className={`absolute ${tool === "select" ? "cursor-pointer" : ""} ${selectedShape === s.id ? "ring-2 ring-indigo-500" : ""}`}
                    style={{
                      left: `${s.xPct}%`,
                      top: `${s.yPct}%`,
                      width: `${s.wPct}%`,
                      height: `${s.hPct}%`,
                      backgroundColor: s.kind === "ZONE" ? `${s.color ?? "#6366f1"}22` : "transparent",
                      border: `3px solid ${s.color ?? "#475569"}`,
                      borderRadius: s.kind === "ZONE" ? 8 : 2,
                    }}
                    title={s.label ?? s.kind}
                  >
                    {s.kind === "ZONE" && s.label && (
                      <span className="absolute left-1 top-1 rounded bg-black/50 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        {s.label}
                      </span>
                    )}
                  </div>
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
                    className={`absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-lg transition-transform ${
                      selectedDesk === d.id ? "ring-2 ring-indigo-500 ring-offset-2 scale-110" : "hover:scale-110"
                    } ${d.status === "MAINTENANCE" ? "bg-amber-500" : "bg-indigo-600"}`}
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
                {tool === "select" && "Drag stations to move them. Click a station, wall or zone to edit it."}
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
                  <CardTitle>{selShape.kind === "WALL" ? "Wall" : "Zone"}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {selShape.kind === "ZONE" && (
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
                    Delete {selShape.kind.toLowerCase()}
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
