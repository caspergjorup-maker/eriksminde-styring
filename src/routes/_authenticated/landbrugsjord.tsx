import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarkerPage } from "@/components/pages/marker-tab";
import { LandbrugsjordPage } from "@/components/pages/forpagtning-tab";
import { MatrikelkortPage } from "@/components/pages/kort-tab";

export const Route = createFileRoute("/_authenticated/landbrugsjord")({
  component: LandbrugsjordTabsPage,
});

function LandbrugsjordTabsPage() {
  return (
    <div className="px-6 py-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[var(--brand-900)]">Landbrugsjord & Marker</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Marker, forpagtninger og matrikelkort</p>
      </div>
      <Tabs defaultValue="marker">
        <TabsList>
          <TabsTrigger value="marker">Marker</TabsTrigger>
          <TabsTrigger value="landbrugsjord">Forpagtning</TabsTrigger>
          <TabsTrigger value="kort">Kort</TabsTrigger>
        </TabsList>
        <TabsContent value="marker" className="mt-4"><MarkerPage /></TabsContent>
        <TabsContent value="landbrugsjord" className="mt-4"><LandbrugsjordPage /></TabsContent>
        <TabsContent value="kort" className="mt-4"><MatrikelkortPage /></TabsContent>
      </Tabs>
    </div>
  );
}
