import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SiteSettings = {
  id: string;
  map_background_url: string | null;
  map_background_opacity: number;
  map_scale_m_per_px: number | null;
  created_at: string;
  updated_at: string;
};

const SETTINGS_ID = "00000000-0000-0000-0000-000000000001";

export const getSiteSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SiteSettings> => {
    const { data, error } = await context.supabase
      .from("site_settings")
      .select("id, map_background_url, map_background_opacity, map_scale_m_per_px, created_at, updated_at")
      .order("id")
      .limit(1)
      .single();
    if (error) {
      // If no row exists, create the default row
      if (error.code === "PGRST116") {
        const { data: inserted, error: insertErr } = await context.supabase
          .from("site_settings")
          .insert({ id: SETTINGS_ID, map_background_url: null, map_background_opacity: 0.55, map_scale_m_per_px: null })
          .select("id, map_background_url, map_background_opacity, map_scale_m_per_px, created_at, updated_at")
          .single();
        if (insertErr) throw new Error(insertErr.message);
        return inserted as SiteSettings;
      }
      throw new Error(error.message);
    }
    return data as SiteSettings;
  });

export const updateSiteSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      map_background_url: z.string().trim().max(2000).nullable(),
      map_background_opacity: z.number().min(0).max(1).optional(),
      map_scale_m_per_px: z.number().min(0).max(100).nullable().optional(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { data: existing, error: fetchErr } = await context.supabase
      .from("site_settings")
      .select("id")
      .order("id")
      .limit(1)
      .single();
    if (fetchErr && fetchErr.code !== "PGRST116") throw new Error(fetchErr.message);

    const id = existing?.id ?? SETTINGS_ID;
    const payload = {
      map_background_url: data.map_background_url,
      map_background_opacity: data.map_background_opacity,
      map_scale_m_per_px: data.map_scale_m_per_px,
    };

    if (existing) {
      const { error } = await context.supabase.from("site_settings").update(payload).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase.from("site_settings").insert({ id, ...payload });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const getMapBackgroundUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ filename: z.string().trim().min(1).max(200) }).parse(d)
  )
  .handler(async ({ data, context }): Promise<{ path: string; signedUrl: string; token: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const safeName = data.filename
      .toLowerCase()
      .replace(/[^a-z0-9æøå_.-]/g, "_")
      .replace(/_+/g, "_");
    const path = `map-backgrounds/${context.userId}/${crypto.randomUUID()}/${safeName}`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from("documents")
      .createSignedUploadUrl(path, { upsert: false });
    if (error) throw new Error(error.message);
    return { path, signedUrl: signed.signedUrl, token: signed.token };
  });

export const getMapBackgroundSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ path: z.string().trim().min(1) }).parse(d)
  )
  .handler(async ({ data, context }): Promise<{ url: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("documents")
      .createSignedUrl(data.path, 60 * 60); // 1 hour
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });

