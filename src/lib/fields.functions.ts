import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const SOIL_TYPES = [
  { value: "JB1", label: "JB 1 — Grovsandet jord" },
  { value: "JB2", label: "JB 2 — Finsandet jord" },
  { value: "JB3", label: "JB 3 — Grov lerblandet sandjord" },
  { value: "JB4", label: "JB 4 — Fin lerblandet sandjord" },
  { value: "JB5", label: "JB 5 — Grov sandblandet lerjord" },
  { value: "JB6", label: "JB 6 — Fin sandblandet lerjord" },
  { value: "JB7", label: "JB 7 — Lerjord" },
  { value: "JB8", label: "JB 8 — Svær lerjord" },
  { value: "JB9", label: "JB 9 — Meget svær lerjord" },
  { value: "JB10", label: "JB 10 — Sandblandet humusjord" },
  { value: "JB11", label: "JB 11 — Humusjord" },
] as const;

export const USE_TYPES = ["omdrift", "skov", "gaard"] as const;

const UpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  use_type: z.enum(USE_TYPES).nullable(),
  lease_area_ha: z.number().min(0).max(100000).nullable(),
  lease_price_per_ha: z.number().min(0).max(1_000_000).nullable(),
  eligible_area_ha: z.number().min(0).max(100000).nullable(),
  non_eligible_area_ha: z.number().min(0).max(100000).nullable(),
  soil_type: z.string().trim().max(20).nullable(),
  is_drained: z.boolean(),
  has_irrigation: z.boolean(),
  notes: z.string().trim().max(2000).nullable(),
});

export const updateField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => UpdateSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { error } = await context.supabase.from("fields").update(rest).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const DeleteSchema = z.object({ id: z.string().uuid() });

export const deleteField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => DeleteSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("fields").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
