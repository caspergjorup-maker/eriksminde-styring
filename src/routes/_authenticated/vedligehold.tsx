import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/page-placeholder";

export const Route = createFileRoute("/_authenticated/vedligehold")({
  component: () => <PagePlaceholder title="Vedligehold" description="Opgaver knyttet til bygninger og udstyr" />,
});
