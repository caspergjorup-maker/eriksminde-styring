import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/page-placeholder";

export const Route = createFileRoute("/_authenticated/skov/overblik")({
  component: () => <PagePlaceholder title="Skovoverblik" description="Skovparceller og status" />,
});
