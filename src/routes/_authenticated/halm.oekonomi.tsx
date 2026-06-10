import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/page-placeholder";

export const Route = createFileRoute("/_authenticated/halm/oekonomi")({
  component: () => <PagePlaceholder title="Halm — Økonomi" description="Aggregeret økonomi for halm" />,
});
