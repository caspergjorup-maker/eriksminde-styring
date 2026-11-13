import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, json, cleanFields } from "../supabase";
import { maintenanceFields } from "./maintenance-shared";

export default defineTool({
  name: "update_maintenance_task",
  title: "Opdatér vedligeholdelsesopgave",
  description:
    "Opdatér valgfrie felter på vedligehold knyttet til en bygning eller maskine og returnér den opdaterede række. Ved skift af tilknytning fjernes den anden tilknytning automatisk.",
  inputSchema: {
    id: z.string().uuid().describe("Vedligeholdelsesopgavens UUID."),
    ...maintenanceFields,
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  handler: async ({ id, ...fields }, ctx) => {
    if (fields.building_id && fields.machine_id)
      throw new ToolError("Vælg kun én af building_id og machine_id.");
    const payload = cleanFields(fields);
    if (!Object.keys(payload).length)
      throw new ToolError("Angiv mindst ét felt, der skal opdateres.");
    if (fields.building_id) payload.machine_id = null;
    if (fields.machine_id) payload.building_id = null;
    const { data, error } = await supabaseForUser(ctx)
      .from("maintenance_tasks")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new ToolError(error.message);
    return json({ updated: data });
  },
});
