import { useEffect, useRef, useState } from "react";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bolt, Droplet, Flame, Upload, Waves, Wifi, X } from "lucide-react";

import { BuildingMapLegend } from "./building-map-legend";

import { listBuildingsWithLeases, type BuildingMapLease, type BuildingLeaseStatus, type BuildingWithLease } from "@/lib/buildings.functions";
import { BUILDING_TYPE_COLOR, BUILDING_TYPE_LABEL, type BuildingType } from "@/lib/buildings.functions";
import { listBuildingUnits, type BuildingUnit } from "@/lib/building-units.functions";
import { getMapBackgroundSignedUrl, getMapBackgroundUploadUrl, getSiteSettings, updateSiteSettings } from "@/lib/site-settings.functions";
import { formatDKK, formatDate, daysUntil } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";

const LEASE_STATUS_LABEL: Record<BuildingLeaseStatus, string> = {
  udlejet: "Udlejet",
  ledig: "Ledig",
  intern_brug: "Intern brug",
};

const LEASE_STATUS_STYLE: Record<BuildingLeaseStatus, { bg: string; fg: string }> = {
  udlejet: { bg: "#D1FAE5", fg: "#065F46" },
  ledig: { bg: "#DBEAFE", fg: "#1E3A8A" },
  intern_brug: { bg: "#CCFBF1", fg: "#115E59" },
};

function getBuildingTypeColor(type: BuildingType | null): string {
  if (!type) return "#8A9A8C";
  return BUILDING_TYPE_COLOR[type] ?? "#8A9A8C";
}

function getWallColor(b: BuildingWithLease): string {
  return b.wall_color ?? getBuildingTypeColor(b.type);
}

function getRoofColor(b: BuildingWithLease): string {
  return b.roof_color ?? getWallColor(b);
}

function getRoofType(b: BuildingWithLease): string {
  return b.roof_type ?? "saddeltag";
}

function getBuildingAngle(b: BuildingWithLease): number {
  return b.map_angle ?? 0;
}

export const buildingsMapQuery = queryOptions({
  queryKey: ["buildings", "with-leases"],
  queryFn: () => listBuildingsWithLeases(),
});

export const buildingUnitsQuery = queryOptions({
  queryKey: ["building-units"],
  queryFn: () => listBuildingUnits(),
});

export const siteSettingsQuery = queryOptions({
  queryKey: ["site-settings"],
  queryFn: () => getSiteSettings(),
});

export const mapBackgroundUrlQuery = (path: string | null) =>
  queryOptions({
    queryKey: ["map-background-url", path],
    queryFn: () => (path ? getMapBackgroundSignedUrl({ data: { path } }).then((r) => r.url) : Promise.resolve(null)),
    staleTime: 1000 * 60 * 50,
  });

function getBorderColor(lease: BuildingMapLease | null): string {
  if (!lease) return "transparent";
  if (lease.status === "vacant") return "#378ADD";
  if (lease.status === "pending_payment") return "#EF9F27";
  const d = daysUntil(lease.contract_end);
  if (d != null && d < 90) return "#D85A30";
  return "transparent";
}

const MAP_W = 600;
const MAP_H = 520;

export type BuildingMapProps = {
  scale?: number;
  interactive?: boolean;
  showPanel?: boolean;
  onSelect?: (b: BuildingWithLease | null) => void;
};

export function BuildingMap({
  scale = 1,
  interactive = true,
  showPanel = true,
  onSelect,
}: BuildingMapProps) {
  const { data: buildings } = useSuspenseQuery(buildingsMapQuery);
  const { data: units } = useSuspenseQuery(buildingUnitsQuery);
  const { data: settings } = useSuspenseQuery(siteSettingsQuery);
  const [selected, setSelected] = useState<BuildingWithLease | null>(null);
  const [showControls, setShowControls] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const backgroundUrl = useMapBackgroundUrl(settings.map_background_url);

  const placed = buildings.filter(
    (b) => b.map_x != null && b.map_y != null && b.map_w != null && b.map_h != null,
  );

  function handleClick(b: BuildingWithLease) {
    if (!interactive) return;
    const next = selected?.id === b.id ? null : b;
    setSelected(next);
    onSelect?.(next);
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { path, signedUrl } = await getMapBackgroundUploadUrl({ data: { filename: file.name } });
      const res = await fetch(signedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });
      if (!res.ok) throw new Error("Upload failed");
      await updateSiteSettings({ data: { map_background_url: path } });
      toast.success("Baggrundsbillede uploadet");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleRemoveBackground() {
    try {
      await updateSiteSettings({ data: { map_background_url: null } });
      toast.success("Baggrundsbillede fjernet");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleOpacityChange(v: number[]) {
    const opacity = v[0] ?? 0.55;
    try {
      await updateSiteSettings({ data: { map_background_opacity: opacity } });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowControls((s) => !s)}
        >
          <SlidersIcon className="h-4 w-4 mr-1.5" /> Kortindstillinger
        </Button>
      </div>

      {showControls && (
        <div className="mb-3 p-3 bg-card border border-border rounded-xl flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              <Upload className="h-4 w-4 mr-1.5" />
              {uploading ? "Uploader…" : "Upload baggrund"}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
          {settings.map_background_url && (
            <>
              <div className="flex items-center gap-3 min-w-[200px]">
                <span className="text-xs text-muted-foreground">Gennemsigtighed</span>
                <Slider
                  value={[settings.map_background_opacity]}
                  min={0}
                  max={1}
                  step={0.05}
                  onValueChange={handleOpacityChange}
                  className="w-32"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemoveBackground}
              >
                <X className="h-4 w-4 mr-1.5" /> Fjern
              </Button>
            </>
          )}
          <span className="text-xs text-muted-foreground ml-auto">
            Tegninger af bygninger kan redigeres under Bygninger → Rediger
          </span>
        </div>
      )}

      <div
        style={{
          width: MAP_W * scale,
          height: MAP_H * scale,
        }}
      >
        <div
          style={{
            position: "relative",
            width: MAP_W,
            height: MAP_H,
            borderRadius: "var(--radius-lg)",
            overflow: "hidden",
            transform: scale !== 1 ? `scale(${scale})` : undefined,
            transformOrigin: "top left",
            boxShadow: "inset 0 0 0 1px oklch(0.85 0.012 165 / 0.5), 0 4px 20px oklch(0.55 0.02 160 / 0.08)",
          }}
        >
          <svg
            width={MAP_W}
            height={MAP_H}
            viewBox={`0 0 ${MAP_W} ${MAP_H}`}
            style={{ display: "block", userSelect: "none" }}
          >
            <defs>
              <filter id="building-shadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="2" dy="3" stdDeviation="2.5" floodColor="#0c1a14" floodOpacity="0.22" />
              </filter>
              <filter id="roof-darken" x="-20%" y="-20%" width="140%" height="140%">
                <feComponentTransfer>
                  <feFuncR type="linear" slope="0.88" intercept="0" />
                  <feFuncG type="linear" slope="0.88" intercept="0" />
                  <feFuncB type="linear" slope="0.88" intercept="0" />
                </feComponentTransfer>
              </filter>
              <pattern id="grass" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
                <rect width="80" height="80" fill="oklch(0.96 0.018 160)" />
                <circle cx="12" cy="18" r="1.5" fill="oklch(0.90 0.015 160)" />
                <circle cx="48" cy="55" r="2" fill="oklch(0.90 0.015 160)" />
                <circle cx="68" cy="22" r="1.5" fill="oklch(0.90 0.015 160)" />
                <circle cx="30" cy="72" r="2" fill="oklch(0.90 0.015 160)" />
              </pattern>
              <pattern id="selected-halo" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
                <rect width="8" height="8" fill="none" />
                <path d="M0,4 L8,4 M4,0 L4,8" stroke="oklch(0.55 0.05 160)" strokeWidth="1" strokeDasharray="2 2" />
              </pattern>
              <marker id="road-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto">
                <path d="M0,0 L10,5 L0,10 z" fill="oklch(0.62 0.005 160)" />
              </marker>
            </defs>

            {/* Ground */}
            <rect width={MAP_W} height={MAP_H} fill="url(#grass)" />

            {/* Optional background image */}
            {settings.map_background_url && backgroundUrl && (
              <image
                href={backgroundUrl}
                x={0}
                y={0}
                width={MAP_W}
                height={MAP_H}
                preserveAspectRatio="xMidYMid slice"
                opacity={settings.map_background_opacity}
                style={{ pointerEvents: "none" }}
              />
            )}

            {/* Roads */}
            <Roads />

            {/* Buildings */}
            {placed.map((b) => {
              const lease = b.lease;
              const borderColor = getBorderColor(lease);
              const isSelected = selected?.id === b.id;
              return (
                <BuildingShape
                  key={b.id}
                  building={b}
                  units={units}
                  isSelected={isSelected}
                  borderColor={borderColor}
                  interactive={interactive}
                  onClick={() => handleClick(b)}
                />
              );
            })}
          </svg>
        </div>
      </div>

      {showPanel && selected && <BuildingInfoPanel building={selected} />}
    </div>
  );
}

function Roads() {
  return (
    <g>
      {/* Fjordager — vertical, slightly rotated */}
      <g transform="translate(94, 0) rotate(8)">
        <rect
          x={-9}
          y={-20}
          width={18}
          height={380}
          rx={9}
          fill="oklch(0.82 0.004 160)"
          stroke="oklch(0.73 0.004 160 / 0.4)"
          strokeWidth={1}
        />
        {/* Road center line */}
        <line x1={0} y1={-10} x2={0} y2={360} stroke="oklch(0.70 0.004 160 / 0.35)" strokeWidth={1} strokeDasharray="6 6" />
      </g>
      {/* Sønderbyen — horizontal */}
      <rect
        x={80}
        y={252 - 8}
        width={520}
        height={16}
        rx={8}
        fill="oklch(0.82 0.004 160)"
        stroke="oklch(0.73 0.004 160 / 0.4)"
        strokeWidth={1}
      />
      <line x1={90} y1={252} x2={590} y2={252} stroke="oklch(0.70 0.004 160 / 0.35)" strokeWidth={1} strokeDasharray="6 6" />

      {/* Road labels */}
      <text
        x={50}
        y={130}
        transform="rotate(-90, 50, 130)"
        textAnchor="middle"
        fontSize={10}
        fontWeight={600}
        fill="oklch(0.55 0.01 160)"
        letterSpacing={1.5}
        style={{ textTransform: "uppercase", pointerEvents: "none" }}
      >
        Fjordager
      </text>
      <text
        x={340}
        y={236}
        textAnchor="middle"
        fontSize={10}
        fontWeight={600}
        fill="oklch(0.55 0.01 160)"
        letterSpacing={1.5}
        style={{ textTransform: "uppercase", pointerEvents: "none" }}
      >
        Sønderbyen
      </text>
    </g>
  );
}

function BuildingShape({
  building: b,
  units,
  isSelected,
  borderColor,
  interactive,
  onClick,
}: {
  building: BuildingWithLease;
  units: BuildingUnit[];
  isSelected: boolean;
  borderColor: string;
  interactive: boolean;
  onClick: () => void;
}) {
  const x = b.map_x ?? 0;
  const y = b.map_y ?? 0;
  const w = b.map_w ?? 40;
  const h = b.map_h ?? 40;
  const angle = getBuildingAngle(b);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const isCircle = b.map_shape === "circle";
  const wallColor = getWallColor(b);
  const roofColor = getRoofColor(b);
  const roofType = getRoofType(b);

  const showDetails = w >= 28 && h >= 22;

  const cursor = interactive ? "pointer" : "default";

  return (
    <g
      transform={`translate(${x}, ${y})`}
      style={{ cursor }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onMouseEnter={(e) => {
        const g = e.currentTarget;
        g.style.filter = "brightness(1.06)";
      }}
      onMouseLeave={(e) => {
        const g = e.currentTarget;
        g.style.filter = "";
      }}
    >
      <g transform={`rotate(${angle}, ${w / 2}, ${h / 2})`}>
        {/* Selection halo */}
        {isSelected && (
          <rect
            x={-4}
            y={-4}
            width={w + 8}
            height={h + 8}
            rx={isCircle ? (w + 8) / 2 : 6}
            fill="url(#selected-halo)"
            stroke="oklch(0.35 0.07 168)"
            strokeWidth={2}
            style={{ pointerEvents: "none" }}
          />
        )}

        {/* Shadow / footprint */}
        {!isCircle && (
          <rect
            x={3}
            y={3}
            width={w}
            height={h}
            rx={4}
            fill="oklch(0.35 0.02 160 / 0.18)"
            style={{ pointerEvents: "none" }}
          />
        )}
        {isCircle && (
          <ellipse cx={w / 2 + 3} cy={h / 2 + 3} rx={w / 2} ry={h / 2} fill="oklch(0.35 0.02 160 / 0.18)" style={{ pointerEvents: "none" }} />
        )}

        {/* Walls */}
        {!isCircle ? (
          <rect
            x={0}
            y={0}
            width={w}
            height={h}
            rx={4}
            fill={wallColor}
            filter="url(#building-shadow)"
            stroke={borderColor !== "transparent" ? borderColor : "oklch(0.35 0.02 160 / 0.15)"}
            strokeWidth={borderColor !== "transparent" ? 2.5 : 1}
          />
        ) : (
          <ellipse
            cx={w / 2}
            cy={h / 2}
            rx={w / 2}
            ry={h / 2}
            fill={wallColor}
            filter="url(#building-shadow)"
            stroke={borderColor !== "transparent" ? borderColor : "oklch(0.35 0.02 160 / 0.15)"}
            strokeWidth={borderColor !== "transparent" ? 2.5 : 1}
          />
        )}

        {/* Roof */}
        <RoofShape
          width={w}
          height={h}
          color={roofColor}
          type={roofType}
          isCircle={isCircle}
        />

        {/* Door and windows */}
        {showDetails && <BuildingDetails width={w} height={h} color={wallColor} type={b.type} />}

        {/* Unit overlay — only when selected */}
        {isSelected && (
          <UnitOverlay units={units.filter((u) => u.building_id === b.id && u.map_geometry && u.map_kind)} width={w} height={h} />
        )}

        {/* Label */}
        <text
          x={w / 2}
          y={h / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={w < 55 || h < 30 ? 8 : w < 85 || h < 45 ? 10 : 12}
          fontWeight={600}
          fill="#ffffff"
          style={{
            textShadow: "0 1px 3px rgba(0,0,0,0.45)",
            pointerEvents: "none",
            filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.35))",
          }}
        >
          {b.name}
        </text>
      </g>
    </g>
  );
}

function RoofShape({
  width: w,
  height: h,
  color,
  type,
  isCircle,
}: {
  width: number;
  height: number;
  color: string;
  type: string;
  isCircle: boolean;
}) {
  const inset = 2;
  const insetX = inset;
  const insetY = inset;
  const rw = w - insetX * 2;
  const rh = h - insetY * 2;
  const rx = isCircle ? Math.max(0, rw / 2 - 1) : 3;
  const ry = isCircle ? Math.max(0, rh / 2 - 1) : 3;

  if (isCircle) {
    return (
      <ellipse
        cx={w / 2}
        cy={h / 2}
        rx={rw / 2}
        ry={rh / 2}
        fill={color}
        filter="url(#roof-darken)"
        stroke="oklch(1 0 0 / 0.2)"
        strokeWidth={1}
        style={{ pointerEvents: "none" }}
      />
    );
  }

  if (type === "fladt") {
    return (
      <rect
        x={insetX}
        y={insetY}
        width={rw}
        height={rh}
        rx={rx}
        fill={color}
        filter="url(#roof-darken)"
        stroke="oklch(1 0 0 / 0.2)"
        strokeWidth={1}
        style={{ pointerEvents: "none" }}
      />
    );
  }

  if (type === "saddeltag") {
    const peak = Math.max(8, rh * 0.35);
    return (
      <g style={{ pointerEvents: "none" }}>
        <path
          d={`M ${insetX} ${insetY + rh - rx} L ${insetX} ${insetY + peak} L ${w / 2} ${insetY} L ${w - insetX} ${insetY + peak} L ${w - insetX} ${insetY + rh - rx} Z`}
          fill={color}
          filter="url(#roof-darken)"
          stroke="oklch(1 0 0 / 0.2)"
          strokeWidth={1}
        />
        <line x1={insetX} y1={insetY + peak} x2={w / 2} y2={insetY} stroke="oklch(1 0 0 / 0.15)" strokeWidth={1} />
        <line x1={w - insetX} y1={insetY + peak} x2={w / 2} y2={insetY} stroke="oklch(1 0 0 / 0.15)" strokeWidth={1} />
      </g>
    );
  }

  if (type === "pulttag") {
    const rise = Math.max(6, rh * 0.25);
    return (
      <path
        d={`M ${insetX} ${insetY + rise} L ${insetX} ${insetY + rh - rx} L ${w - insetX} ${insetY + rh - rx} L ${w - insetX} ${insetY} Z`}
        fill={color}
        filter="url(#roof-darken)"
        stroke="oklch(1 0 0 / 0.2)"
        strokeWidth={1}
        style={{ pointerEvents: "none" }}
      />
    );
  }

  if (type === "valmtag") {
    const peak = Math.max(8, rh * 0.3);
    const hip = Math.min(12, rw * 0.18);
    return (
      <g style={{ pointerEvents: "none" }}>
        <path
          d={`M ${insetX + hip} ${insetY + peak} L ${w - insetX - hip} ${insetY + peak} L ${w - insetX} ${insetY + hip} L ${w - insetX} ${insetY + rh - rx} L ${insetX} ${insetY + rh - rx} L ${insetX} ${insetY + hip} Z`}
          fill={color}
          filter="url(#roof-darken)"
          stroke="oklch(1 0 0 / 0.2)"
          strokeWidth={1}
        />
        <line x1={insetX + hip} y1={insetY + peak} x2={w - insetX - hip} y2={insetY + peak} stroke="oklch(1 0 0 / 0.15)" strokeWidth={1} />
        <line x1={w - insetX - hip} y1={insetY + peak} x2={w - insetX} y2={insetY + hip} stroke="oklch(1 0 0 / 0.15)" strokeWidth={1} />
        <line x1={insetX + hip} y1={insetY + peak} x2={insetX} y2={insetY + hip} stroke="oklch(1 0 0 / 0.15)" strokeWidth={1} />
      </g>
    );
  }

  if (type === "skur_tag") {
    const rise = Math.max(5, rh * 0.2);
    return (
      <path
        d={`M ${insetX} ${insetY + rise} L ${insetX} ${insetY + rh - rx} L ${w - insetX} ${insetY + rh - rx} L ${w - insetX} ${insetY + rise} L ${w / 2} ${insetY} Z`}
        fill={color}
        filter="url(#roof-darken)"
        stroke="oklch(1 0 0 / 0.2)"
        strokeWidth={1}
        style={{ pointerEvents: "none" }}
      />
    );
  }

  return null;
}

function BuildingDetails({
  width: w,
  height: h,
  color,
  type,
}: {
  width: number;
  height: number;
  color: string;
  type: BuildingType;
}) {
  // Door always at the bottom center
  const doorW = Math.max(4, Math.min(10, w * 0.18));
  const doorH = Math.max(5, Math.min(12, h * 0.25));
  const doorX = (w - doorW) / 2;
  const doorY = h - doorH - 3;

  // Windows: 1-2 small rectangles above the door
  const winW = Math.max(3, Math.min(8, w * 0.14));
  const winH = Math.max(3, Math.min(7, h * 0.14));
  const winY = doorY - winH - 3;
  const windows: { x: number; w: number }[] = [];
  if (w > 45) {
    windows.push({ x: w * 0.25 - winW / 2, w: winW });
    windows.push({ x: w * 0.75 - winW / 2, w: winW });
  } else if (w > 30) {
    windows.push({ x: w * 0.5 - winW / 2, w: winW });
  }

  const isLight = isLightColor(color);
  const detailFill = isLight ? "oklch(0.25 0.02 160 / 0.55)" : "oklch(1 0 0 / 0.45)";

  return (
    <g style={{ pointerEvents: "none" }}>
      {/* Door */}
      {type !== "garage" && type !== "lagerhal" && (
        <rect x={doorX} y={doorY} width={doorW} height={doorH} rx={1} fill={detailFill} />
      )}
      {windows.map((win, i) => (
        <rect key={i} x={win.x} y={winY} width={win.w} height={winH} rx={1} fill={detailFill} />
      ))}
    </g>
  );
}

function isLightColor(hex: string): boolean {
  // Quick heuristic for common hex colors
  const rgb = hexToRgb(hex);
  if (!rgb) return false;
  const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  return brightness > 140;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace("#", "");
  if (clean.length !== 3 && clean.length !== 6) return null;
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return null;
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function statusLabel(status?: string | null) {
  switch (status) {
    case "active":
      return { label: "Aktiv", bg: "#E1F5EE", fg: "#0F6E56" };
    case "pending_payment":
      return { label: "Afventer betaling", bg: "#FFF4E0", fg: "#A86600" };
    case "expiring_soon":
      return { label: "Udløber snart", bg: "#FDE7DC", fg: "#9A3B12" };
    case "vacant":
      return { label: "Ledig", bg: "#E0EEFB", fg: "#1F5A99" };
    default:
      return { label: "—", bg: "#eee", fg: "#555" };
  }
}

function BuildingInfoPanel({ building }: { building: BuildingWithLease }) {
  const lease = building.lease;
  const s = statusLabel(lease?.status);
  return (
    <div
      style={{
        marginTop: 16,
        background: "hsl(var(--card))",
        border: "1px solid hsl(var(--border))",
        borderRadius: "var(--radius-xl)",
        padding: "1.25rem",
        maxWidth: MAP_W,
        boxShadow: "0 2px 12px oklch(0.35 0.02 160 / 0.06)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "var(--radius-md)",
            background: getBuildingTypeColor(building.type),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: 16,
            boxShadow: "0 2px 6px oklch(0.35 0.02 160 / 0.15)",
            flexShrink: 0,
          }}
        >
          <HomeIcon />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 600, fontSize: 16, margin: 0 }}>{building.name}</p>
          <div
            style={{
              fontSize: 13,
              color: "hsl(var(--muted-foreground))",
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
              marginTop: 2,
            }}
          >
            <span>{BUILDING_TYPE_LABEL[building.type]}</span>
            {building.lease_status && (
              <>
                <span style={{ color: "hsl(var(--border))" }}>·</span>
                <span
                  title={building.lease_status_note ?? undefined}
                  style={{
                    background: LEASE_STATUS_STYLE[building.lease_status].bg,
                    color: LEASE_STATUS_STYLE[building.lease_status].fg,
                    padding: "2px 8px",
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 500,
                  }}
                >
                  {LEASE_STATUS_LABEL[building.lease_status]}
                </span>
              </>
            )}
            {lease && (
              <>
                <span style={{ color: "hsl(var(--border))" }}>·</span>
                <span
                  style={{
                    background: s.bg,
                    color: s.fg,
                    padding: "2px 8px",
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 500,
                  }}
                >
                  {s.label}
                </span>
              </>
            )}
          </div>
          <UtilityIconRow building={building} />
        </div>
      </div>

      {lease ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 10,
            marginTop: 12,
          }}
        >
          <MetricCard label="Lejer" value={lease.tenant?.name ?? "—"} />
          <MetricCard
            label="Månedlig leje"
            value={lease.monthly_rent ? formatDKK(lease.monthly_rent) : "—"}
          />
          <MetricCard label="Kontraktudløb" value={formatDate(lease.contract_end)} />
          <MetricCard label="Telefon" value={lease.tenant?.phone ?? "—"} />
          <MetricCard label="Email" value={lease.tenant?.email ?? "—"} />
          <MetricCard
            label="Depositum"
            value={lease.deposit ? formatDKK(lease.deposit) : "—"}
          />
        </div>
      ) : (
        <p style={{ fontSize: 13, color: "hsl(var(--muted-foreground))", marginTop: 8 }}>
          Ingen aktiv lejeaftale.
        </p>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <Link
          to="/dokumenter"
          search={{ building: building.id } as never}
          className="inline-flex items-center px-3 py-1.5 text-sm rounded-md border border-input bg-background hover:bg-accent"
        >
          Se lejekontrakt
        </Link>
        <Link
          to="/bygninger"
          className="inline-flex items-center px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Rediger
        </Link>
      </div>
    </div>
  );
}

function HomeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "hsl(var(--muted) / 0.45)",
        borderRadius: "var(--radius-md)",
        padding: "10px 12px",
        border: "1px solid hsl(var(--border) / 0.4)",
      }}
    >
      <p style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", margin: 0, fontWeight: 500 }}>{label}</p>
      <p
        style={{
          fontSize: 13,
          fontWeight: 600,
          margin: "4px 0 0",
          wordBreak: "break-word",
        }}
      >
        {value}
      </p>
    </div>
  );
}

function UtilityIconRow({ building }: { building: BuildingWithLease }) {
  const items: { on: boolean | null | undefined; icon: React.ReactNode; title: string }[] = [
    { on: building.has_electricity, icon: <Bolt size={13} />, title: "El" },
    { on: building.has_water, icon: <Droplet size={13} />, title: "Vand" },
    { on: building.has_heating, icon: <Flame size={13} />, title: "Varme" },
    { on: building.has_sewage, icon: <Waves size={13} />, title: "Kloak" },
    { on: building.has_internet, icon: <Wifi size={13} />, title: "Internet" },
  ];
  const active = items.filter((i) => i.on);
  if (active.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 4, color: "hsl(var(--muted-foreground))" }}>
      {active.map((i) => (
        <span key={i.title} title={i.title} style={{ display: "inline-flex", alignItems: "center" }}>
          {i.icon}
        </span>
      ))}
    </div>
  );
}

function UnitOverlay({
  units,
  width,
  height,
}: {
  units: BuildingUnit[];
  width: number;
  height: number;
}) {
  if (units.length === 0) return null;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      {units.map((u) => {
        const color = u.map_color ?? "#3F8DDB";
        if (u.map_kind === "rect") {
          const g = u.map_geometry as { x: number; y: number; w: number; h: number };
          return (
            <rect
              key={u.id}
              x={(g.x / 100) * width}
              y={(g.y / 100) * height}
              width={(g.w / 100) * width}
              height={(g.h / 100) * height}
              fill={color}
              fillOpacity={0.55}
              stroke={color}
              strokeWidth={0.5}
            />
          );
        }
        if (u.map_kind === "polygon") {
          const g = u.map_geometry as { points: Array<[number, number]> };
          const pts = g.points
            .map(([x, y]) => `${(x / 100) * width},${(y / 100) * height}`)
            .join(" ");
          return (
            <polygon
              key={u.id}
              points={pts}
              fill={color}
              fillOpacity={0.55}
              stroke={color}
              strokeWidth={0.5}
            />
          );
        }
        return null;
      })}
    </svg>
  );
}

function SlidersIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  );
}

function useMapBackgroundUrl(path: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    getMapBackgroundSignedUrl({ data: { path } })
      .then((r) => {
        if (!cancelled) setUrl(r.url);
      })
      .catch(() => setUrl(null));
    return () => { cancelled = true; };
  }, [path]);
  return url;
}

export { BuildingMapLegend };
