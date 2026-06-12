import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/page-placeholder";

export const Route = createFileRoute("/_authenticated/oekonomi")({
  component: () => <PagePlaceholder title="Årsresultat" description="Realiseret vs. budget på tværs af kategorier" />,
});
