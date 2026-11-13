import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, json } from "../supabase";

export default defineTool({
  name: "create_invoice_draft",
  title: "Opret fakturakladde",
  description: "Opret en fakturakladde (uden moms) i appen. Den sendes til Dinero fra siden Fakturakladder. Find kundens id via read_farm_data på contacts.",
  inputSchema: {
    contact_id: z.string().uuid(),
    description: z.string().trim().min(1).max(500),
    amount_excl_vat: z.number().min(0).max(100_000_000).describe("Beløb i kr."),
    invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (i, ctx) => {
    const { data, error } = await supabaseForUser(ctx)
      .from("invoices")
      .insert({
        contact_id: i.contact_id,
        description: i.description,
        invoice_date: i.invoice_date ?? new Date().toISOString().slice(0, 10),
        amount_excl_vat: i.amount_excl_vat,
        vat_amount: 0,
        total_amount: i.amount_excl_vat,
        status: "draft",
      })
      .select()
      .single();
    if (error) throw new ToolError(error.message);
    return json({ created: data });
  },
});
