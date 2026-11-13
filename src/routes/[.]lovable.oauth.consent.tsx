import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EriksmindeLogo } from "@/components/eriksminde-logo";
import { Button } from "@/components/ui/button";

type OAuthResult = { data: { redirect_url?: string; redirect_to?: string; client?: { name?: string; redirect_uri?: string }; scope?: string } | null; error: { message: string } | null };
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<OAuthResult>;
  approveAuthorization: (id: string) => Promise<OAuthResult>;
  denyAuthorization: (id: string) => Promise<OAuthResult>;
};
const oauth = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Forbind app — Eriksminde" },
      { name: "description", content: "Giv en ekstern app adgang til Eriksminde." },
      { property: "og:title", content: "Forbind app — Eriksminde" },
      { property: "og:description", content: "Giv en ekstern app adgang til Eriksminde." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s["authorization_id"] === "string" ? s["authorization_id"] : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Mangler authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth", search: { next: location.pathname + location.searchStr } });
  },
  loaderDeps: ({ search }) => ({ id: search.authorization_id }),
  loader: async ({ deps }) => {
    const { data, error } = await oauth().getAuthorizationDetails(deps.id);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) {
      window.location.href = immediate;
    }
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="min-h-screen flex items-center justify-center p-6 text-sm text-destructive">
      Kunne ikke indlæse anmodningen: {error instanceof Error ? error.message : String(error)}
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const client = details?.client?.name ?? "en app";

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await oauth().approveAuthorization(authorization_id)
      : await oauth().denyAuthorization(authorization_id);
    if (error) { setBusy(false); setError(error.message); return; }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) { setBusy(false); setError("Ingen viderestilling modtaget."); return; }
    window.location.href = target;
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-[var(--brand-50)]/40">
      <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-sm p-8 space-y-4">
        <div className="flex justify-center"><EriksmindeLogo /></div>
        <h1 className="text-lg font-semibold text-center">Forbind {client} til Eriksminde</h1>
        <p className="text-sm text-muted-foreground text-center">
          {client} vil kunne læse gårdens data og oprette opgaver, halmsalg og fakturakladder som dig.
        </p>
        {details?.client?.redirect_uri && (
          <p className="text-xs text-muted-foreground text-center break-all">{details.client.redirect_uri}</p>
        )}
        <p className="text-xs text-muted-foreground text-center">Appens adgangsregler gælder stadig.</p>
        {error && <p role="alert" className="text-sm text-destructive text-center">{error}</p>}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" disabled={busy} onClick={() => decide(false)}>Annuller</Button>
          <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>Godkend</Button>
        </div>
      </div>
    </main>
  );
}
