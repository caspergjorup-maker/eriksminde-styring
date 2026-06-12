import { createFileRoute } from "@tanstack/react-router";
import { MatrikelMap } from "@/components/matrikel-map";

export const Route = createFileRoute("/_authenticated/matrikelkort")({
  component: MatrikelkortPage,
});

function MatrikelkortPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-lg font-medium mb-1">Matrikelkort</h1>
      <p className="text-sm text-muted-foreground mb-5">
        Klik på en matrikel for at se areal, type og forpagteroplysninger.
        Kortdata fra Datafordeler (Klimadatastyrelsen).
      </p>
      <MatrikelMap />
    </div>
  );
}
