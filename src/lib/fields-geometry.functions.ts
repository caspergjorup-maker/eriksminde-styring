import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GeometrySchema = z.object({
  type: z.enum(["Polygon", "MultiPolygon"]),
  coordinates: z.array(z.any()),
});

const SaveSchema = z.object({
  fieldId: z.string().uuid(),
  geometry: GeometrySchema.nullable(),
});

export const saveFieldGeometry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SaveSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("fields")
      .update({ geometry: data.geometry })
      .eq("id", data.fieldId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const CreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  use_type: z.enum(["omdrift", "skov", "gaard"]).nullable(),
  geometry: GeometrySchema.nullable(),
});

export const createField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CreateSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: inserted, error } = await context.supabase
      .from("fields")
      .insert({ name: data.name, use_type: data.use_type, geometry: data.geometry })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id as string };
  });
