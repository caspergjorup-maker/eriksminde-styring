import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarkerPage } from "@/components/pages/marker-tab";
import { MatriklerPage } from "@/components/pages/matrikler-tab";
import { LandbrugsjordPage } from "@/components/pages/forpagtning-tab";
import { MatrikelkortPage } from "@/components/pages/kort-tab";

const searchSchema = z.object({
  tab: z.enum(["marker", "matrikler", "landbrugsjord", "kort"]).optional(),
  drawField: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/landbrugsjord")({
  component: LandbrugsjordTabsPage,
  validateSearch: (search) => searchSchema.parse(search),
});

function LandbrugsjordTabsPage() {
  const { tab, drawField } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const active = tab ?? "marker";

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[var(--brand-900)]">Landbrugsjord & Marker</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Marker, matrikler, forpagtninger og kort</p>
      </div>
      <Tabs
        value={active}
        onValueChange={(v) =>
          navigate({ search: { tab: v as "marker" | "matrikler" | "landbrugsjord" | "kort" } })
        }
      >
        <TabsList>
          <TabsTrigger value="marker">Marker</TabsTrigger>
          <TabsTrigger value="matrikler">Matrikler</TabsTrigger>
          <TabsTrigger value="landbrugsjord">Forpagtning</TabsTrigger>
          <TabsTrigger value="kort">Kort</TabsTrigger>
        </TabsList>
        <TabsContent value="marker" className="mt-4"><MarkerPage /></TabsContent>
        <TabsContent value="matrikler" className="mt-4"><MatriklerPage /></TabsContent>
        <TabsContent value="landbrugsjord" className="mt-4"><LandbrugsjordPage /></TabsContent>
        <TabsContent value="kort" className="mt-4"><MatrikelkortPage drawFieldId={drawField} /></TabsContent>
      </Tabs>
    </div>
  );
}
