import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/page-placeholder";

export const Route = createFileRoute("/_authenticated/skov/hugst")({
  component: () => <PagePlaceholder title="Hugst & aktivitet" description="Skovaktiviteter og driftsregnskab" />,
});
