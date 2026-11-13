import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, json } from "../supabase";

export default defineTool({
  name: "record_straw_movement",
  title: "Registrer halmsalg/-tilgang",
  description:
    "Registrer salg (out) eller tilgang (in) af halmballer. Brug read_farm_data på contacts for at finde kundens id.",
  inputSchema: {
    bale_type: z.string().trim().min(1).max(60).describe("Balletype som i straw_inventory"),
    quantity: z.number().int().min(1).max(1_000_000),
    direction: z.enum(["in", "out"]),
    unit_price: z.number().min(0).max(1_000_000).describe("Pris pr. balle i kr."),
    contact_id: z.string().uuid().optional(),
    movement_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    notes: z.string().max(2000).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (i, ctx) => {
    const { data, error } = await supabaseForUser(ctx)
      .from("straw_movements")
      .insert({
        bale_type: i.bale_type,
        quantity: i.quantity,
        direction: i.direction,
        unit_price: i.unit_price,
        total_amount: i.quantity * i.unit_price,
        contact_id: i.contact_id ?? null,
        movement_date: i.movement_date ?? new Date().toISOString().slice(0, 10),
        notes: i.notes ?? null,
      })
      .select()
      .single();
    if (error) throw new ToolError(error.message);
    return json({ created: data });
  },
});
