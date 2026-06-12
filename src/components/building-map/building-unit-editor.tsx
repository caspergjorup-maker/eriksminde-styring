import { useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MousePointer2, Pencil, Square, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import {
  saveBuildingUnitGeometry,
  type BuildingUnit,
  type UnitMapGeometry,
  type UnitMapKind,
} from "@/lib/building-units.functions";
import type { Building } from "@/lib/buildings.functions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const UNIT_PALETTE = [
  "#3F8DDB",
  "#27AE60",
  "#E67E22",
  "#9B59B6",
  "#16A085",
  "#E74C3C",
  "#F1C40F",
  "#34495E",
];

type Tool = "select" | "rect" | "polygon";

type Props = {
  building: Building;
  units: BuildingUnit[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function BuildingUnitEditor({ building, units, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const save = useServerFn(saveBuildingUnitGeometry);
  const saveMut = useMutation({
    mutationFn: (input: {
      id: string;
      map_kind: UnitMapKind | null;
      map_geometry: UnitMapGeometry | null;
      map_color: string | null;
    }) => save({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["building-units"] });
      toast.success("Tegning gemt");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const buildingUnits = useMemo(
    () => units.filter((u) => u.building_id === building.id),
    [units, building.id],
  );

  const [selectedId, setSelectedId] = useState<string | null>(
    buildingUnits.find((u) => u.map_geometry == null)?.id ?? buildingUnits[0]?.id ?? null,
  );
  const selected = buildingUnits.find((u) => u.id === selectedId) ?? null;

  const [tool, setTool] = useState<Tool>("select");

  // SVG uses viewBox 0..100 for x and 0..100 for y (percentages).
  const aspect = (building.map_w ?? 100) / (building.map_h ?? 100);
  const viewW = 100 * aspect;
  const viewH = 100;
  const VIEW_PX_H = 480;
  const VIEW_PX_W = Math.round(VIEW_PX_H * aspect);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const [draftRect, setDraftRect] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [draftPoly, setDraftPoly] = useState<Array<[number, number]>>([]);
  const [hoverPt, setHoverPt] = useState<[number, number] | null>(null);

  function svgPoint(e: React.MouseEvent): [number, number] | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const inv = ctm.inverse();
    const p = pt.matrixTransform(inv);
    return [Math.max(0, Math.min(viewW, p.x)), Math.max(0, Math.min(viewH, p.y))];
  }

  function pxToPct(p: [number, number]): [number, number] {
    return [(p[0] / aspect) , p[1]];
  }
  function pctToPx(p: [number, number]): [number, number] {
    return [p[0] * aspect, p[1]];
  }

  function commit(kind: UnitMapKind, geom: UnitMapGeometry) {
    if (!selected) {
      toast.error("Vælg en enhed først");
      return;
    }
    const color = selected.map_color ?? UNIT_PALETTE[buildingUnits.findIndex((u) => u.id === selected.id) % UNIT_PALETTE.length];
    saveMut.mutate({ id: selected.id, map_kind: kind, map_geometry: geom, map_color: color });
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (!selected) return;
    const p = svgPoint(e);
    if (!p) return;
    if (tool === "rect") {
      const [px, py] = pxToPct(p);
      setDraftRect({ x0: px, y0: py, x1: px, y1: py });
    } else if (tool === "polygon") {
      const [px, py] = pxToPct(p);
      setDraftPoly((prev) => [...prev, [px, py]]);
    }
  }

  function handleMouseMove(e: React.MouseEvent) {
    const p = svgPoint(e);
    if (!p) return;
    setHoverPt(p);
    if (tool === "rect" && draftRect) {
      const [px, py] = pxToPct(p);
      setDraftRect({ ...draftRect, x1: px, y1: py });
    }
  }

  function handleMouseUp() {
    if (tool === "rect" && draftRect) {
      const x = Math.min(draftRect.x0, draftRect.x1);
      const y = Math.min(draftRect.y0, draftRect.y1);
      const w = Math.abs(draftRect.x1 - draftRect.x0);
      const h = Math.abs(draftRect.y1 - draftRect.y0);
      setDraftRect(null);
      if (w < 2 || h < 2) return;
      commit("rect", { x, y, w, h });
      setTool("select");
    }
  }

  function finishPolygon() {
    if (draftPoly.length < 3) {
      toast.error("Mindst 3 punkter");
      return;
    }
    commit("polygon", { points: draftPoly });
    setDraftPoly([]);
    setTool("select");
  }

  function clearGeometry(u: BuildingUnit) {
    saveMut.mutate({ id: u.id, map_kind: null, map_geometry: null, map_color: u.map_color ?? null });
  }

  function renderShape(u: BuildingUnit, isSelected: boolean) {
    if (!u.map_geometry || !u.map_kind) return null;
    const color = u.map_color ?? "#3F8DDB";
    const opacity = isSelected ? 0.85 : 0.6;
    const stroke = isSelected ? "#085041" : color;
    const strokeW = isSelected ? 0.6 : 0.3;
    if (u.map_kind === "rect") {
      const g = u.map_geometry as { x: number; y: number; w: number; h: number };
      const [x, y] = pctToPx([g.x, g.y]);
      const [w, h] = [g.w * aspect, g.h];
      return (
        <g key={u.id} onClick={(e) => { e.stopPropagation(); setSelectedId(u.id); }} style={{ cursor: "pointer" }}>
          <rect x={x} y={y} width={w} height={h} fill={color} fillOpacity={opacity} stroke={stroke} strokeWidth={strokeW} />
          <text x={x + w / 2} y={y + h / 2} fontSize={2.5} textAnchor="middle" dominantBaseline="middle" fill="#fff" style={{ pointerEvents: "none", textShadow: "0 1px 1px rgba(0,0,0,.4)" }}>
            {u.name}
          </text>
        </g>
      );
    }
    const g = u.map_geometry as { points: Array<[number, number]> };
    const pts = g.points.map(pctToPx).map(([x, y]) => `${x},${y}`).join(" ");
    const cx = g.points.reduce((a, p) => a + p[0], 0) / g.points.length;
    const cy = g.points.reduce((a, p) => a + p[1], 0) / g.points.length;
    const [tx, ty] = pctToPx([cx, cy]);
    return (
      <g key={u.id} onClick={(e) => { e.stopPropagation(); setSelectedId(u.id); }} style={{ cursor: "pointer" }}>
        <polygon points={pts} fill={color} fillOpacity={opacity} stroke={stroke} strokeWidth={strokeW} />
        <text x={tx} y={ty} fontSize={2.5} textAnchor="middle" dominantBaseline="middle" fill="#fff" style={{ pointerEvents: "none", textShadow: "0 1px 1px rgba(0,0,0,.4)" }}>
          {u.name}
        </text>
      </g>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Tegn enheder – {building.name}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-[260px_1fr] gap-4">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Enheder</p>
              <div className="space-y-1">
                {buildingUnits.length === 0 && (
                  <p className="text-xs text-muted-foreground">Ingen enheder — opret først via tabellen.</p>
                )}
                {buildingUnits.map((u, idx) => {
                  const isSel = u.id === selectedId;
                  const color = u.map_color ?? UNIT_PALETTE[idx % UNIT_PALETTE.length];
                  return (
                    <button
                      key={u.id}
                      onClick={() => setSelectedId(u.id)}
                      className={`w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-2 ${isSel ? "bg-muted" : "hover:bg-muted/50"}`}
                    >
                      <span className="w-3 h-3 rounded-sm" style={{ background: color }} />
                      <span className="flex-1 truncate">{u.name}</span>
                      {u.map_geometry ? (
                        <span
                          title="Fjern tegning"
                          onClick={(e) => { e.stopPropagation(); clearGeometry(u); }}
                          className="text-muted-foreground hover:text-red-600"
                        >
                          <X className="h-3.5 w-3.5" />
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">ingen</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Værktøj</p>
              <div className="flex flex-wrap gap-1">
                <Button size="sm" variant={tool === "select" ? "default" : "outline"} onClick={() => { setTool("select"); setDraftPoly([]); setDraftRect(null); }}>
                  <MousePointer2 className="h-3.5 w-3.5 mr-1" /> Vælg
                </Button>
                <Button size="sm" variant={tool === "rect" ? "default" : "outline"} disabled={!selected} onClick={() => { setTool("rect"); setDraftPoly([]); }}>
                  <Square className="h-3.5 w-3.5 mr-1" /> Rektangel
                </Button>
                <Button size="sm" variant={tool === "polygon" ? "default" : "outline"} disabled={!selected} onClick={() => { setTool("polygon"); setDraftRect(null); }}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Polygon
                </Button>
              </div>
              {tool === "polygon" && (
                <div className="mt-2 space-y-1">
                  <p className="text-[11px] text-muted-foreground">Klik for hvert hjørne ({draftPoly.length} punkter).</p>
                  <div className="flex gap-1">
                    <Button size="sm" variant="secondary" onClick={finishPolygon} disabled={draftPoly.length < 3}>Færdig</Button>
                    <Button size="sm" variant="ghost" onClick={() => setDraftPoly([])}>Ryd</Button>
                  </div>
                </div>
              )}
            </div>

            {selected && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Farve</p>
                <div className="flex flex-wrap gap-1">
                  {UNIT_PALETTE.map((c) => (
                    <button
                      key={c}
                      onClick={() => saveMut.mutate({ id: selected.id, map_kind: selected.map_kind, map_geometry: selected.map_geometry, map_color: c })}
                      className="w-5 h-5 rounded border border-border"
                      style={{ background: c, outline: selected.map_color === c ? "2px solid #085041" : undefined }}
                    />
                  ))}
                </div>
              </div>
            )}

            <p className="text-[11px] text-muted-foreground border-t border-border pt-2">
              Vælg en enhed, vælg et værktøj og tegn ind på bygningen. Koordinater gemmes relativt til bygningens størrelse.
            </p>
          </div>

          <div className="flex items-start justify-center bg-muted/30 rounded-lg p-4">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${viewW} ${viewH}`}
              width={VIEW_PX_W}
              height={VIEW_PX_H}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              style={{
                background: building.map_color ?? "#1D9E75",
                borderRadius: 4,
                cursor: tool === "select" ? "default" : "crosshair",
                display: "block",
              }}
            >
              {/* Existing shapes */}
              {buildingUnits.map((u) => renderShape(u, u.id === selectedId))}

              {/* Draft rect */}
              {draftRect && (() => {
                const x = Math.min(draftRect.x0, draftRect.x1) * aspect;
                const y = Math.min(draftRect.y0, draftRect.y1);
                const w = Math.abs(draftRect.x1 - draftRect.x0) * aspect;
                const h = Math.abs(draftRect.y1 - draftRect.y0);
                return <rect x={x} y={y} width={w} height={h} fill="#fff" fillOpacity={0.3} stroke="#fff" strokeDasharray="1 1" strokeWidth={0.4} />;
              })()}

              {/* Draft polygon */}
              {draftPoly.length > 0 && (
                <>
                  <polyline
                    points={[...draftPoly, hoverPt ? pxToPct(hoverPt) : draftPoly[draftPoly.length - 1]]
                      .map(pctToPx)
                      .map(([x, y]) => `${x},${y}`)
                      .join(" ")}
                    fill="none"
                    stroke="#fff"
                    strokeDasharray="1 1"
                    strokeWidth={0.4}
                  />
                  {draftPoly.map((p, i) => {
                    const [x, y] = pctToPx(p);
                    return <circle key={i} cx={x} cy={y} r={0.7} fill="#fff" />;
                  })}
                </>
              )}
            </svg>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
