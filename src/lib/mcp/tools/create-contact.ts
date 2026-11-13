import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, json } from "../supabase";
import { contactFields } from "./contact-shared";

export default defineTool({
  name: "create_contact",
  title: "Opret kontakt",
  description:
    "Opret en kunde, lejer, forpagter, jagtlejer eller leverandør med validerede kontaktoplysninger og returnér den oprettede kontakt.",
  inputSchema: {
    ...contactFields,
    type: z.enum(["customer", "tenant", "leaseholder", "hunting_tenant", "supplier"]),
    name: z.string().trim().min(1).max(200),
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
  handler: async (input, ctx) => {
    const { data, error } = await supabaseForUser(ctx)
      .from("contacts")
      .insert({
        type: input.type,
        name: input.name,
        cvr: input.cvr ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        address: input.address ?? null,
        notes: input.notes ?? null,
      })
      .select()
      .single();
    if (error) throw new ToolError(error.message);
    return json({ created: data });
  },
});
