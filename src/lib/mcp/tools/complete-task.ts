import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, json } from "../supabase";

export default defineTool({
  name: "complete_task",
  title: "Afslut opgave",
  description:
    "Markér en driftsopgave som færdig med dagens dato og returnér den opdaterede opgave.",
  inputSchema: { id: z.string().uuid().describe("Opgavens UUID.") },
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  handler: async ({ id }, ctx) => {
    const { data, error } = await supabaseForUser(ctx)
      .from("tasks")
      .update({ status: "done", completed_date: new Date().toISOString().slice(0, 10) })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new ToolError(error.message);
    return json({ updated: data });
  },
});
