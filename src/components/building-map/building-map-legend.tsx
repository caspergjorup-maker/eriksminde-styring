import { BUILDING_TYPE_COLOR, BUILDING_TYPE_LABEL } from "@/lib/buildings.functions";
import type { BuildingType } from "@/lib/buildings.functions";

export function BuildingMapLegend() {
  const items = Object.entries(BUILDING_TYPE_COLOR).map(([type, color]) => ({
    color,
    label: BUILDING_TYPE_LABEL[type as BuildingType],
  }));
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 10,
        marginTop: 16,
        padding: "10px 12px",
        background: "hsl(var(--card))",
        border: "1px solid hsl(var(--border))",
        borderRadius: "var(--radius-lg)",
        fontSize: 12,
        color: "hsl(var(--muted-foreground))",
        boxShadow: "0 1px 6px oklch(0.35 0.02 160 / 0.04)",
      }}
    >
      {items.map((it) => (
        <div key={it.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: "var(--radius-sm)",
              background: it.color,
              display: "inline-block",
              boxShadow: "0 1px 3px oklch(0.35 0.02 160 / 0.15)",
            }}
          />
          <span style={{ fontWeight: 500 }}>{it.label}</span>
        </div>
      ))}
    </div>
  );
}
