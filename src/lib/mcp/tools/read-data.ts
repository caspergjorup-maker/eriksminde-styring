import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, json } from "../supabase";

const TABLES = {
  fields: "Marker (areal, afgrøde, forpagtningsareal)",
  parcels: "Matrikler",
  field_parcels: "Kobling mellem marker og matrikler",
  land_leases: "Forpagtningsaftaler for jord",
  buildings: "Bygninger og udlejningspotentiale",
  building_units: "Bygningsenheder",
  building_leases: "Lejeaftaler for bygninger",
  hunting_leases: "Jagtlejeaftaler",
  straw_inventory: "Halmlager",
  straw_movements: "Halmsalg og -bevægelser",
  tasks: "Opgaver",
  maintenance_tasks: "Vedligehold",
  machines: "Maskiner",
  contacts: "Kunder og leverandører",
  invoices: "Fakturakladder",
  budget_scenarios: "Budgetter pr. år",
  budget_lines: "Budgetlinjer (indtægter/udgifter, månedsfordeling)",
  budget_loans: "Lån i budgettet",
  forest_parcels: "Skovarealer",
  forest_activities: "Skovaktiviteter (hugst m.m.)",
} as const;

export default defineTool({
  name: "read_farm_data",
  title: "Læs gårdens data",
  description: `Læs rækker fra en af Eriksmindes tabeller. Tabeller: ${Object.entries(TABLES).map(([k, v]) => `${k} (${v})`).join(", ")}.`,
  inputSchema: {
    table: z.enum(Object.keys(TABLES) as [keyof typeof TABLES, ...(keyof typeof TABLES)[]]).describe("Tabellen der skal læses."),
    limit: z.number().int().min(1).max(500).optional().describe("Maks antal rækker (standard 200)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ table, limit }, ctx) => {
    const sb = supabaseForUser(ctx);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (sb.from as any)(table).select("*").limit(limit ?? 200);
    if (error) throw new ToolError(error.message);
    return json({ table, rows: data ?? [] });
  },
});
