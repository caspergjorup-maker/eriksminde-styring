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
