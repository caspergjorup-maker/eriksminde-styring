import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, json } from "../supabase";
import { maintenanceFields } from "./maintenance-shared";

export default defineTool({
  name: "create_maintenance_task",
  title: "Opret vedligeholdelsesopgave",
  description:
    "Opret en vedligeholdelsesopgave knyttet til præcis én bygning eller maskine og returnér den oprettede række.",
  inputSchema: {
    ...maintenanceFields,
    title: z.string().trim().min(1).max(200),
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
  handler: async (input, ctx) => {
    if (!input.building_id && !input.machine_id)
      throw new ToolError("Vælg enten building_id eller machine_id.");
    if (input.building_id && input.machine_id)
      throw new ToolError("Vælg kun én af building_id og machine_id.");
    const { data, error } = await supabaseForUser(ctx)
      .from("maintenance_tasks")
      .insert({
        title: input.title,
        description: input.description ?? null,
        building_id: input.building_id ?? null,
        machine_id: input.machine_id ?? null,
        assigned_contact_id: input.assigned_contact_id ?? null,
        preferred_supplier_id: input.preferred_supplier_id ?? null,
        category: input.category ?? null,
        priority: input.priority ?? "medium",
        status: input.status ?? "open",
        due_date: input.due_date ?? null,
        completed_date: input.completed_date ?? null,
        estimated_cost: input.estimated_cost ?? null,
        actual_cost: input.actual_cost ?? null,
        notes: input.notes ?? null,
      })
      .select()
      .single();
    if (error) throw new ToolError(error.message);
    return json({ created: data });
  },
});
