import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ParcelListItem = {
  id: string;
  matrikel_id: string;
  ejerlav: string;
};

export const listParcels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ParcelListItem[]> => {
    const { data, error } = await context.supabase
      .from("parcels")
      .select("id, matrikel_id, ejerlav")
      .order("matrikel_id");
    if (error) throw new Error(error.message);
    return (data ?? []) as ParcelListItem[];
  });

const GeometrySchema = z.object({
  type: z.enum(["Polygon", "MultiPolygon"]),
  coordinates: z.array(z.any()),
});

const SaveSchema = z.object({
  parcelId: z.string().uuid(),
  geometry: GeometrySchema.nullable(),
});

export const saveParcelGeometry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SaveSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("parcels")
      .update({ custom_geometry: data.geometry })
      .eq("id", data.parcelId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const USE_TYPES = ["omdrift", "skov", "gaard"] as const;

const UpdateParcelSchema = z.object({
  id: z.string().uuid(),
  use_type: z.enum(USE_TYPES).nullable(),
  net_area_ha: z.number().min(0).max(100000).nullable(),
  notes: z.string().trim().max(2000).nullable(),
});

export const updateParcel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => UpdateParcelSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { error } = await context.supabase.from("parcels").update(rest).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
