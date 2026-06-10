import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/page-placeholder";

export const Route = createFileRoute("/_authenticated/kontakter/kunder")({
  component: () => <PagePlaceholder title="Kunder" description="Kunder, lejere, forpagtere og jagtlejere" />,
});
