import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HalmLagerPage } from "@/components/pages/halm-lager-tab";
import { HalmSalgPage } from "@/components/pages/halm-salg-tab";
import { HalmOekonomiPage } from "@/components/pages/halm-oekonomi-tab";

export const Route = createFileRoute("/_authenticated/halm")({
  component: HalmTabsPage,
});

function HalmTabsPage() {
  return (
    <div className="px-6 py-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[var(--brand-900)]">Halm</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Lager, salg og økonomi</p>
      </div>
      <Tabs defaultValue="lager">
        <TabsList>
          <TabsTrigger value="lager">Lager</TabsTrigger>
          <TabsTrigger value="salg">Salg & kunder</TabsTrigger>
          <TabsTrigger value="oekonomi">Økonomi</TabsTrigger>
        </TabsList>
        <TabsContent value="lager" className="mt-4"><HalmLagerPage /></TabsContent>
        <TabsContent value="salg" className="mt-4"><HalmSalgPage /></TabsContent>
        <TabsContent value="oekonomi" className="mt-4"><HalmOekonomiPage /></TabsContent>
      </Tabs>
    </div>
  );
}
