import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/page-placeholder";

export const Route = createFileRoute("/_authenticated/kontakter/leverandoerer")({
  component: () => <PagePlaceholder title="Leverandører" description="Håndværkere, forsikring, forsyning m.v." />,
});
