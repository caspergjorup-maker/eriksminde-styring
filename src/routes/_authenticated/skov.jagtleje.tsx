import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/page-placeholder";

export const Route = createFileRoute("/_authenticated/skov/jagtleje")({
  component: () => <PagePlaceholder title="Jagtleje" description="Jagtlejere og afskydningsrapporter" />,
});
