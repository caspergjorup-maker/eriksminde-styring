import { useEffect, useRef } from "react";
import { MatrikelMap, type MatrikelMapHandle } from "@/components/matrikel-map";

export function MatrikelkortPage({ drawFieldId }: { drawFieldId?: string }) {
  const mapRef = useRef<MatrikelMapHandle | null>(null);
  const triggered = useRef<string | null>(null);

  useEffect(() => {
    if (!drawFieldId || triggered.current === drawFieldId) return;
    // Wait for fields to be ready before triggering
    const t = setTimeout(() => {
      mapRef.current?.startDrawField(drawFieldId);
      triggered.current = drawFieldId;
    }, 800);
    return () => clearTimeout(t);
  }, [drawFieldId]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-lg font-medium mb-1">Matrikelkort</h1>
      <p className="text-sm text-muted-foreground mb-5">
        Klik på en matrikel for at se areal, type og forpagteroplysninger.
        Kortdata fra Datafordeler (Klimadatastyrelsen).
      </p>
      <MatrikelMap ref={mapRef} />
    </div>
  );
}
