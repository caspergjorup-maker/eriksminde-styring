import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, json, cleanFields } from "../supabase";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Brug YYYY-MM-DD");

export default defineTool({
  name: "update_building",
  title: "Opdatér bygning",
  description:
    "Opdatér en bygnings stamdata, stand, udlejningsstatus, estimeret månedlig leje eller noter og returnér den opdaterede bygning. Kortgeometri kan ikke ændres her.",
  inputSchema: {
    id: z.string().uuid().describe("Bygningens UUID."),
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    build_year: z.number().int().min(1500).max(2100).nullable().optional(),
    area_m2_gross: z.number().finite().min(0).max(1_000_000).nullable().optional(),
    area_m2_net: z.number().finite().min(0).max(1_000_000).nullable().optional(),
    floors: z.number().int().min(0).max(50).nullable().optional(),
    condition: z
      .enum(["god", "vedligeholdelse_nødvendig", "renovering_nødvendig"])
      .nullable()
      .optional()
      .describe("Bygningens stand."),
    last_inspection: date.nullable().optional(),
    lease_status: z.enum(["udlejet", "ledig", "intern_brug"]).nullable().optional(),
    lease_status_note: z.string().trim().max(2000).nullable().optional(),
    estimated_monthly_rent: z.number().finite().min(0).max(10_000_000).nullable().optional(),
    has_electricity: z.boolean().nullable().optional(),
    has_water: z.boolean().nullable().optional(),
    has_heating: z.boolean().nullable().optional(),
    heating_type: z
      .enum(["fjernvarme", "olie", "varmepumpe", "elvarme", "ingen"])
      .nullable()
      .optional(),
    has_sewage: z.boolean().nullable().optional(),
    has_internet: z.boolean().nullable().optional(),
    parcel_id: z.string().uuid().nullable().optional(),
    internal_notes: z.string().trim().max(5000).nullable().optional(),
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  handler: async ({ id, ...fields }, ctx) => {
    const payload = cleanFields(fields);
    if (!Object.keys(payload).length)
      throw new ToolError("Angiv mindst ét felt, der skal opdateres.");
    const { data, error } = await supabaseForUser(ctx)
      .from("buildings")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new ToolError(error.message);
    return json({ updated: data });
  },
});
