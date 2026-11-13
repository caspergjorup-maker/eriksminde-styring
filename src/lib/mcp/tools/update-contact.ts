import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, json, cleanFields } from "../supabase";
import { contactFields } from "./contact-shared";

export default defineTool({
  name: "update_contact",
  title: "Opdatér kontakt",
  description:
    "Opdatér type, navn eller kontaktoplysninger på en eksisterende kontakt og returnér den opdaterede række. Brug null til at rydde valgfrie felter.",
  inputSchema: {
    id: z.string().uuid().describe("Kontaktens UUID."),
    ...contactFields,
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
      .from("contacts")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new ToolError(error.message);
    return json({ updated: data });
  },
});
