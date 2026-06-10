import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/page-placeholder";

export const Route = createFileRoute("/_authenticated/halm/salg")({
  component: () => <PagePlaceholder title="Halm — Salg & kunder" description="Salg, kunder og fakturaer" />,
});
