import { Suspense, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Shapes } from "lucide-react";

import { BuildingMap, BuildingMapLegend, buildingUnitsQuery } from "@/components/building-map/building-map";
import { BuildingUnitEditor } from "@/components/building-map/building-unit-editor";
import { Button } from "@/components/ui/button";
import type { BuildingWithLease } from "@/lib/buildings.functions";


export function BygningsplanPage() {
  const [selected, setSelected] = useState<BuildingWithLease | null>(null);
  const [drawing, setDrawing] = useState<BuildingWithLease | null>(null);

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
        <BuildingMap onSelect={setSelected} />
        {selected && (
          <div className="mt-3" style={{ maxWidth: 600 }}>
            <Button size="sm" variant="outline" onClick={() => setDrawing(selected)}>
              <Shapes className="h-4 w-4 mr-1.5" /> Tegn enheder på {selected.name}
            </Button>
          </div>
        )}
        {drawing && <DrawingDialog building={drawing} onClose={() => setDrawing(null)} />}
      </Suspense>
      <BuildingMapLegend />
    </div>
  );
}

function DrawingDialog({ building, onClose }: { building: BuildingWithLease; onClose: () => void }) {
  const { data: units } = useSuspenseQuery(buildingUnitsQuery);
  return (
    <BuildingUnitEditor
      building={building}
      units={units}
      open
      onOpenChange={(o) => !o && onClose()}
    />
  );
}
