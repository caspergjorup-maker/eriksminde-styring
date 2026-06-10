import { createFileRoute } from "@tanstack/react-router";

// TODO: Implementér Dinero-integration.
// Docs: https://api.dinero.dk/docs
// Endpoint: POST https://api.dinero.dk/v1/{organizationId}/invoices
//
// Flow når integrationen er klar:
//  1. Hent invoice fra public.invoices via supabaseAdmin
//  2. Map til Dinero invoice schema
//  3. POST til Dinero med OAuth Bearer token
//  4. Gem returneret invoice-id i invoices.dinero_invoice_id
//  5. Opdatér status til 'exported_to_dinero'
//
// API-nøgle/credentials skal gemmes som secrets (DINERO_CLIENT_ID,
// DINERO_CLIENT_SECRET, DINERO_ORG_ID) via add_secret-værktøjet.

export const Route = createFileRoute("/api/dinero/export-invoice")({
  server: {
    handlers: {
      POST: async () => {
        return new Response(
          JSON.stringify({
            ok: false,
            error: "Dinero-integration ikke konfigureret endnu",
            docs: "https://api.dinero.dk/docs",
          }),
          {
            status: 501,
            headers: { "Content-Type": "application/json" },
          },
        );
      },
    },
  },
});
