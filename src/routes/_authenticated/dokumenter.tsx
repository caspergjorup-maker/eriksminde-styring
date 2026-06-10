import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/page-placeholder";

export const Route = createFileRoute("/_authenticated/dokumenter")({
  component: () => <PagePlaceholder title="Dokumenter" description="Kontrakter, bilag og andre filer" />,
});
