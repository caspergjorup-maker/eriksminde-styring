import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, json, cleanFields } from "../supabase";
import type { Database } from "@/integrations/supabase/types";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Brug YYYY-MM-DD");

export default defineTool({
  name: "update_invoice_draft",
  title: "Opdatér fakturakladde",
  description:
    "Opdatér kunde, tekst, beløb, datoer eller status på en åben fakturakladde og returnér den opdaterede række. Eksporterede fakturaer kan ikke ændres.",
  inputSchema: {
    id: z.string().uuid().describe("Fakturakladdens UUID."),
    contact_id: z.string().uuid().optional(),
    description: z.string().trim().min(1).max(500).optional(),
    amount_excl_vat: z
      .number()
      .finite()
      .min(0)
      .max(100_000_000)
      .optional()
      .describe("Beløb i kr.; momsen forbliver 0."),
    invoice_date: date.optional(),
    due_date: date.nullable().optional(),
    category: z.string().trim().max(100).nullable().optional(),
    notes: z.string().trim().max(4000).nullable().optional(),
    status: z.enum(["draft", "ready"]).optional(),
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  handler: async ({ id, ...fields }, ctx) => {
    const payload: Database["public"]["Tables"]["invoices"]["Update"] = cleanFields(fields);
    if (!Object.keys(payload).length)
      throw new ToolError("Angiv mindst ét felt, der skal opdateres.");
    if (fields.amount_excl_vat !== undefined) {
      payload.vat_amount = 0;
      payload.total_amount = fields.amount_excl_vat;
    }
    const { data, error } = await supabaseForUser(ctx)
      .from("invoices")
      .update(payload)
      .eq("id", id)
      .in("status", ["draft", "ready"])
      .is("dinero_invoice_id", null)
      .select()
      .single();
    if (error) throw new ToolError(error.message);
    return json({ updated: data });
  },
});
