import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Slår navne/emails op for en liste af bruger-ids via public.profiles.
 * Returnerer en map fra user id -> visningsnavn.
 */
export async function resolveCreatorNames(
  supabase: SupabaseClient,
  ids: Array<string | null | undefined>,
): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids.filter((v): v is string => !!v)));
  const map = new Map<string, string>();
  if (unique.length === 0) return map;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, display_name")
    .in("id", unique);
  if (error) return map;

  for (const row of (data ?? []) as Array<{
    id: string;
    email: string | null;
    display_name: string | null;
  }>) {
    map.set(row.id, row.display_name || row.email || "Ukendt bruger");
  }
  return map;
}
