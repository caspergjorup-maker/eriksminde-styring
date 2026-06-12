import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SkovOverblikPage } from "@/components/pages/skov-overblik-tab";
import { HugstPage } from "@/components/pages/skov-hugst-tab";

export const Route = createFileRoute("/_authenticated/skov")({
  component: SkovTabsPage,
});

function SkovTabsPage() {
  return (
    <div className="px-6 py-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[var(--brand-900)]">Skov & hugst</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Skovparceller og aktiviteter</p>
      </div>
      <Tabs defaultValue="overblik">
        <TabsList>
          <TabsTrigger value="overblik">Skovoverblik</TabsTrigger>
          <TabsTrigger value="hugst">Hugst & aktivitet</TabsTrigger>
        </TabsList>
        <TabsContent value="overblik" className="mt-4"><SkovOverblikPage /></TabsContent>
        <TabsContent value="hugst" className="mt-4"><HugstPage /></TabsContent>
      </Tabs>
    </div>
  );
}
