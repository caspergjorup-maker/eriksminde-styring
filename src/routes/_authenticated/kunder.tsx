import { createFileRoute } from "@tanstack/react-router";
import { ContactsPage } from "@/components/contacts/contacts-page";

export const Route = createFileRoute("/_authenticated/kunder")({
  component: () => (
    <ContactsPage
      kind="customers"
      title="Kunder"
      description="Kunder, lejere, forpagtere og jagtlejere"
    />
  ),
});
