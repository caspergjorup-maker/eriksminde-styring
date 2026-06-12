import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/page-placeholder";

export const Route = createFileRoute("/_authenticated/budget")({
  component: () => <PagePlaceholder title="Budget" description="Budget og realiseret per kategori" />,
});
