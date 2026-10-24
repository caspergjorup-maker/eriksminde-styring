import { supabase } from "@/integrations/supabase/client";

export async function requestMatrikel() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Log ind for at hente matrikler.");
  const response = await fetch("/api/matrikel", {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? "Kunne ikke hente matrikeldata.");
  }
  return response.json();
}