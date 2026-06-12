import { Suspense } from "react";


import { BuildingMap, BuildingMapLegend, buildingsMapQuery } from "@/components/building-map/building-map";


export function BygningsplanPage() {
  return (
    <div style={{ padding: "1.5rem" }}>
      <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: "0.25rem" }}>Bygningsplan</h1>
      <p
        style={{
          fontSize: 13,
          color: "hsl(var(--muted-foreground))",
          marginBottom: "1.25rem",
        }}
      >
        Klik på en bygning for at se lejer, kontrakt og betalingsstatus
      </p>
      <Suspense fallback={<div style={{ width: 600, height: 520 }} />}>
        <BuildingMap />
      </Suspense>
      <BuildingMapLegend />
    </div>
  );
}
