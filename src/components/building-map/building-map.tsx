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
            background: "#EBF8F3",
            borderRadius: 8,
            overflow: "hidden",
            transform: scale !== 1 ? `scale(${scale})` : undefined,
            transformOrigin: "top left",
          }}
        >
          {/* Fjordager — lodret, let roteret */}
          <div
            style={{
              position: "absolute",
              width: 16,
              height: 340,
              left: 95,
              top: 0,
              background: "#d4cfc8",
              transform: "rotate(8deg)",
              transformOrigin: "top center",
            }}
          />
          {/* Sønderbyen — vandret tværvej */}
          <div
            style={{
              position: "absolute",
              width: 580,
              height: 15,
              left: 80,
              top: 252,
              background: "#d4cfc8",
            }}
          />
          {/* Vejskilte */}
          <span
            style={{
              position: "absolute",
              left: 52,
              top: 130,
              fontSize: 11,
              color: "#888",
              letterSpacing: 1,
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
              top: 238,
              fontSize: 11,
              color: "#888",
              letterSpacing: 1,
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
            return (
              <div
                key={b.id}
                onClick={() => handleClick(b)}
                style={{
                  position: "absolute",
                  left: b.map_x ?? 0,
                  top: b.map_y ?? 0,
                  width: b.map_w ?? 40,
                  height: b.map_h ?? 40,
                  background: b.map_color ?? "#1D9E75",
                  borderRadius: isCircle ? "50%" : 2,
                  border: `1.5px solid ${isSelected ? "#085041" : borderColor}`,
                  cursor: interactive ? "pointer" : "default",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transform: rotate ? "rotate(-8deg)" : undefined,
                  transformOrigin: rotateOrigin ? "left center" : undefined,
                  filter: isSelected ? "brightness(0.82)" : undefined,
                  transition: "filter 0.15s",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: "#fff",
                    textAlign: "center",
                    lineHeight: 1.25,
                    textShadow: "0 1px 2px rgba(0,0,0,0.4)",
                    pointerEvents: "none",
                    padding: "0 2px",
                  }}
                >
                  {b.building_nr}
                  <br />
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
