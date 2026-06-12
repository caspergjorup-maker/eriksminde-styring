import { Suspense } from "react";
import { createFileRoute, ErrorComponent } from "@tanstack/react-router";
import { buildingsMapQuery } from "@/components/building-map/building-map";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BygningerPage } from "@/components/pages/bygninger-tab";
import { BygningsplanPage } from "@/components/pages/bygningsplan-tab";

export const Route = createFileRoute("/_authenticated/bygninger")({
  loader: ({ context }) => context.queryClient.ensureQueryData(buildingsMapQuery),
  component: BygningerTabsPage,
  errorComponent: ErrorComponent,
  notFoundComponent: () => <div className="p-6">Siden blev ikke fundet.</div>,
});

function BygningerTabsPage() {
  return (
    <div className="px-6 py-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[var(--brand-900)]">Bygninger</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Bygninger, lejemål og bygningsplan</p>
      </div>
      <Tabs defaultValue="liste">
        <TabsList>
          <TabsTrigger value="liste">Liste</TabsTrigger>
          <TabsTrigger value="plan">Bygningsplan</TabsTrigger>
        </TabsList>
        <TabsContent value="liste" className="mt-4"><BygningerPage /></TabsContent>
        <TabsContent value="plan" className="mt-4">
          <Suspense fallback={<div style={{ width: 600, height: 520 }} />}>
            <BygningsplanPage />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
