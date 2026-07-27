import { useState } from "react";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bolt, Droplet, Flame, Waves, Wifi } from "lucide-react";

import { listBuildingsWithLeases, type BuildingMapLease, type BuildingLeaseStatus, type BuildingWithLease } from "@/lib/buildings.functions";
import { listBuildingUnits, type BuildingUnit } from "@/lib/building-units.functions";
import { formatDKK, formatDate, daysUntil } from "@/lib/format";

const LEASE_STATUS_LABEL: Record<BuildingLeaseStatus, string> = {
  udlejet: "Udlejet",
  ledig: "Ledig",
  ikke_klar: "Ikke klar endnu",
  intern_brug: "Intern brug",
  udlejes_ikke: "Udlejes ikke",
};

const LEASE_STATUS_STYLE: Record<BuildingLeaseStatus, { bg: string; fg: string }> = {
  udlejet: { bg: "#D1FAE5", fg: "#065F46" },
  ledig: { bg: "#DBEAFE", fg: "#1E3A8A" },
  ikke_klar: { bg: "#FEF3C7", fg: "#854D0E" },
  intern_brug: { bg: "#CCFBF1", fg: "#115E59" },
  udlejes_ikke: { bg: "#E5E7EB", fg: "#374151" },
};

export const buildingsMapQuery = queryOptions({
  queryKey: ["buildings", "with-leases"],
  queryFn: () => listBuildingsWithLeases(),
});

export const buildingUnitsQuery = queryOptions({
  queryKey: ["building-units"],
  queryFn: () => listBuildingUnits(),
});

function getBorderColor(lease: BuildingMapLease | null): string {
  if (!lease) return "transparent";
  if (lease.status === "vacant") return "#378ADD";
  if (lease.status === "pending_payment") return "#EF9F27";
  const d = daysUntil(lease.contract_end);
  if (d != null && d < 90) return "#D85A30";
  return "transparent";
}

const NORTH_NRS = new Set(["1", "2", "3", "4"]);
const NORTH_ROT_NRS = new Set(["2", "3", "4"]);

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
  const [selected, setSelected] = useState<BuildingWithLease | null>(null);

  const placed = buildings.filter(
    (b) => b.map_x != null && b.map_y != null && b.map_w != null && b.map_h != null,
  );

  function handleClick(b: BuildingWithLease) {
    if (!interactive) return;
    const next = selected?.id === b.id ? null : b;
    setSelected(next);
    onSelect?.(next);
  }

  return (
    <div>
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
            background: "oklch(0.97 0.015 160)",
            borderRadius: "var(--radius-lg)",
            overflow: "hidden",
            transform: scale !== 1 ? `scale(${scale})` : undefined,
            transformOrigin: "top left",
            boxShadow: "inset 0 0 0 1px oklch(0.85 0.012 165 / 0.5), 0 4px 20px oklch(0.55 0.02 160 / 0.08)",
          }}
        >
          {/* Subtle map texture */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                "radial-gradient(circle at 20% 30%, oklch(0.94 0.02 160 / 0.25) 0%, transparent 25%), radial-gradient(circle at 80% 70%, oklch(0.92 0.015 160 / 0.3) 0%, transparent 30%)",
              pointerEvents: "none",
            }}
          />

          {/* Fjordager — lodret, let roteret */}
          <div
            style={{
              position: "absolute",
              width: 18,
              height: 340,
              left: 94,
              top: 0,
              background: "oklch(0.82 0.01 80)",
              borderRadius: 9,
              transform: "rotate(8deg)",
              transformOrigin: "top center",
              boxShadow: "inset 0 0 0 1px oklch(0.75 0.01 80 / 0.4)",
            }}
          />
          {/* Sønderbyen — vandret tværvej */}
          <div
            style={{
              position: "absolute",
              width: 580,
              height: 16,
              left: 80,
              top: 252,
              background: "oklch(0.82 0.01 80)",
              borderRadius: 8,
              boxShadow: "inset 0 0 0 1px oklch(0.75 0.01 80 / 0.4)",
            }}
          />
          {/* Vejskilte */}
          <span
            style={{
              position: "absolute",
              left: 50,
              top: 130,
              fontSize: 10,
              fontWeight: 600,
              color: "oklch(0.55 0.01 160)",
              letterSpacing: 1.5,
              textTransform: "uppercase",
              transform: "rotate(-90deg)",
              transformOrigin: "center",
              whiteSpace: "nowrap",
              pointerEvents: interactive ? undefined : "none",
            }}
          >
            Fjordager
          </span>
          <span
            style={{
              position: "absolute",
              left: 200,
              top: 236,
              fontSize: 10,
              fontWeight: 600,
              color: "oklch(0.55 0.01 160)",
              letterSpacing: 1.5,
              textTransform: "uppercase",
              pointerEvents: interactive ? undefined : "none",
            }}
          >
            Sønderbyen
          </span>

          {placed.map((b) => {
            const lease = b.lease;
            const borderColor = getBorderColor(lease);
            const isCircle = b.map_shape === "circle";
            const isSelected = selected?.id === b.id;
            const rotate = b.building_nr && NORTH_NRS.has(b.building_nr);
            const rotateOrigin = b.building_nr && NORTH_ROT_NRS.has(b.building_nr);
            const baseColor = b.map_color ?? "#1D9E75";
            return (
              <div
                key={b.id}
                onClick={() => handleClick(b)}
                title={b.name}
                style={{
                  position: "absolute",
                  left: b.map_x ?? 0,
                  top: b.map_y ?? 0,
                  width: b.map_w ?? 40,
                  height: b.map_h ?? 40,
                  background: baseColor,
                  borderRadius: isCircle ? "50%" : "var(--radius-md)",
                  border: `2px solid ${isSelected ? "oklch(0.35 0.07 168)" : borderColor}`,
                  cursor: interactive ? "pointer" : "default",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transform: rotate ? "rotate(-8deg)" : undefined,
                  transformOrigin: rotateOrigin ? "left center" : undefined,
                  boxShadow: isSelected
                    ? "0 8px 24px oklch(0.35 0.05 160 / 0.25), 0 0 0 3px oklch(0.95 0.005 160)"
                    : "0 3px 10px oklch(0.35 0.02 160 / 0.18)",
                  filter: isSelected ? "brightness(0.92)" : undefined,
                  transition: "box-shadow 0.15s ease, filter 0.15s ease, transform 0.15s ease",
                  zIndex: isSelected ? 10 : 1,
                }}
                onMouseEnter={(e) => {
                  if (interactive) e.currentTarget.style.transform = `${rotate ? "rotate(-8deg) " : ""}scale(1.02)`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = rotate ? "rotate(-8deg)" : undefined;
                }}
              >
                <UnitOverlay
                  units={units.filter((u) => u.building_id === b.id && u.map_geometry && u.map_kind)}
                  width={b.map_w ?? 40}
                  height={b.map_h ?? 40}
                />
                <span
                  style={{
                    position: "relative",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#fff",
                    textAlign: "center",
                    lineHeight: 1.2,
                    textShadow: "0 1px 3px rgba(0,0,0,0.35)",
                    pointerEvents: "none",
                    padding: "0 4px",
                  }}
                >
                  {b.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {showPanel && selected && <BuildingInfoPanel building={selected} />}
    </div>
  );
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
        marginTop: 12,
        background: "hsl(var(--background))",
        border: "1px solid hsl(var(--border))",
        borderRadius: 12,
        padding: "1rem 1.25rem",
        maxWidth: MAP_W,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: building.map_color ?? "#1D9E75",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {building.building_nr ?? "?"}
        </div>
        <div>
          <p style={{ fontWeight: 500, fontSize: 15, margin: 0 }}>{building.name}</p>
          <div
            style={{
              fontSize: 13,
              color: "hsl(var(--muted-foreground))",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>{building.type}</span>
            {building.lease_status && (
              <>
                <span>·</span>
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
                <span>·</span>
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
            gap: 8,
            marginTop: 10,
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

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
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

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "hsl(var(--muted) / 0.4)",
        borderRadius: 8,
        padding: "8px 10px",
      }}
    >
      <p style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", margin: 0 }}>{label}</p>
      <p
        style={{
          fontSize: 13,
          fontWeight: 500,
          margin: "2px 0 0",
          wordBreak: "break-word",
        }}
      >
        {value}
      </p>
    </div>
  );
}

export function BuildingMapLegend() {
  const items = [
    { color: "#0F6E56", label: "Stuehus" },
    { color: "#1D9E75", label: "Nordlænge" },
    { color: "#5DCAA5", label: "Stalde" },
    { color: "#7EC8A4", label: "Værksted / tørreri" },
    { color: "#9FE1CB", label: "Foderrum" },
    { color: "#085041", label: "Maskinhus" },
    { color: "#7a7a7a", label: "Gylletank", circle: true },
  ];
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 12,
        marginTop: 12,
        fontSize: 12,
        color: "hsl(var(--muted-foreground))",
      }}
    >
      {items.map((it) => (
        <div key={it.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: it.circle ? "50%" : 3,
              background: it.color,
              display: "inline-block",
            }}
          />
          {it.label}
        </div>
      ))}
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
  // Use viewBox in same units as building box (px). Convert percentages → px.
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
