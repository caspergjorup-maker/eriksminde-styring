import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/page-placeholder";

export const Route = createFileRoute("/_authenticated/halm/lager")({
  component: () => <PagePlaceholder title="Halmlager" description="Lagerbeholdning og bevægelser" />,
});
