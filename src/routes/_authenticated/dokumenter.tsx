import { createFileRoute } from "@tanstack/react-router";
import { DocumentsPage } from "@/components/documents/documents-page";

export const Route = createFileRoute("/_authenticated/dokumenter")({
  component: () => <DocumentsPage />,
});
