import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/page-placeholder";

export const Route = createFileRoute("/_authenticated/landbrugsjord")({
  component: () => <PagePlaceholder title="Landbrugsjord" description="Forpagtninger og forpagtere" />,
});
