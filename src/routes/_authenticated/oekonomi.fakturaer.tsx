import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/page-placeholder";

export const Route = createFileRoute("/_authenticated/oekonomi/fakturaer")({
  component: FakturaerPage,
});

function FakturaerPage() {
  return (
    <div className="px-6 py-6 max-w-7xl mx-auto">
      <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Dinero-integration ikke konfigureret — tilføj API-nøgle under Indstillinger
      </div>
      <PagePlaceholder
        title="Fakturakladder"
        description="Kladder, klar til eksport, eksporteret til Dinero, betalt"
      />
    </div>
  );
}
