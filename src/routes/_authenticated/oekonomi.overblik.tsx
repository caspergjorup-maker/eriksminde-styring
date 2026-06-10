import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/page-placeholder";

export const Route = createFileRoute("/_authenticated/oekonomi/overblik")({
  component: () => <PagePlaceholder title="Økonomi — Overblik" description="Realiseret vs. budget på tværs af kategorier" />,
});
