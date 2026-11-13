import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, json } from "../supabase";

export default defineTool({
  name: "create_task",
  title: "Opret opgave",
  description: "Opret en ny driftsopgave på Eriksminde.",
  inputSchema: {
    title: z.string().trim().min(1).max(200),
    description: z.string().max(4000).optional(),
    priority: z.enum(["low", "medium", "high", "critical"]).optional(),
    due_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .describe("Frist, YYYY-MM-DD"),
    category: z.string().max(60).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    const { data, error } = await supabaseForUser(ctx)
      .from("tasks")
      .insert({
        title: input.title,
        description: input.description ?? null,
        priority: input.priority ?? "medium",
        status: "open",
        due_date: input.due_date ?? null,
        category: input.category ?? null,
      })
      .select()
      .single();
    if (error) throw new ToolError(error.message);
    return json({ created: data });
  },
});
