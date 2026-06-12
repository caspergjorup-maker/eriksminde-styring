import { createFileRoute } from "@tanstack/react-router";
import { ContactsPage } from "@/components/contacts/contacts-page";

export const Route = createFileRoute("/_authenticated/leverandoerer")({
  component: () => (
    <ContactsPage
      kind="suppliers"
      title="Leverandører"
      description="Håndværkere, forsikring, forsyning m.v."
    />
  ),
});
