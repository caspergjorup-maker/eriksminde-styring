import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/page-placeholder";

export const Route = createFileRoute("/_authenticated/bygninger")({
  component: () => <PagePlaceholder title="Bygninger" description="Bygninger og lejemål" />,
});
