import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, json, cleanFields } from "../supabase";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Brug YYYY-MM-DD");
const nullableDate = date.nullable().optional();

export default defineTool({
  name: "update_task",
  title: "Opdatér opgave",
  description:
    "Opdatér valgfrie felter på en eksisterende driftsopgave og returnér den opdaterede opgave. Brug null til at fjerne valgfri tekst, tilknytning eller dato.",
  inputSchema: {
    id: z.string().uuid().describe("Opgavens UUID."),
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(4000).nullable().optional(),
    assigned_contact_id: z.string().uuid().nullable().optional(),
    category: z.string().trim().max(60).nullable().optional(),
    priority: z.enum(["low", "medium", "high", "critical"]).optional(),
    status: z.enum(["open", "in_progress", "done", "cancelled"]).optional(),
    due_date: nullableDate,
    completed_date: nullableDate,
    notes: z.string().trim().max(4000).nullable().optional(),
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
      .from("tasks")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new ToolError(error.message);
    return json({ updated: data });
  },
});
