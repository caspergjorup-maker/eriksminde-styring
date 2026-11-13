import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, json } from "../supabase";

export const TABLES = {
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

export const farmTableSchema = z.enum(
  Object.keys(TABLES) as [keyof typeof TABLES, ...(keyof typeof TABLES)[]],
);

const DATE_COLUMNS: Partial<Record<keyof typeof TABLES, string>> = {
  fields: "created_at",
  parcels: "created_at",
  field_parcels: "created_at",
  land_leases: "contract_start",
  buildings: "last_inspection",
  building_units: "created_at",
  building_leases: "contract_start",
  hunting_leases: "contract_start",
  straw_inventory: "updated_at",
  straw_movements: "movement_date",
  tasks: "due_date",
  maintenance_tasks: "due_date",
  machines: "last_service_date",
  contacts: "created_at",
  invoices: "invoice_date",
  budget_lines: "created_at",
  budget_loans: "start_date",
  forest_parcels: "created_at",
  forest_activities: "activity_date",
};

const SEARCH_COLUMNS: Partial<Record<keyof typeof TABLES, string[]>> = {
  fields: ["name"],
  buildings: ["name", "description"],
  building_units: ["name", "description"],
  hunting_leases: ["name"],
  tasks: ["title", "description"],
  maintenance_tasks: ["title", "description"],
  machines: ["name"],
  contacts: ["name"],
  invoices: ["description"],
  budget_scenarios: ["name"],
  forest_parcels: ["name"],
};

const columnName = z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Ugyldigt kolonnenavn");
const filterValue = z.union([z.string().max(1000), z.number().finite(), z.boolean(), z.null()]);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Brug YYYY-MM-DD");

function assertColumn(value: string) {
  const parsed = columnName.safeParse(value);
  if (!parsed.success) throw new ToolError(`Ugyldigt kolonnenavn: ${value}`);
}

export default defineTool({
  name: "read_farm_data",
  title: "Læs gårdens data",
  description: `Læs og filtrer rækker fra Eriksmindes tabeller. Understøtter lighedsfiltre, valg af kolonner, sortering, datointerval og tekstsøgning. Tabeller: ${Object.entries(
    TABLES,
  )
    .map(([key, value]) => `${key} (${value})`)
    .join(", ")}.`,
  inputSchema: {
    table: farmTableSchema.describe("Tabellen der skal læses."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(500)
      .optional()
      .describe("Maks antal rækker (standard 200)."),
    filters: z
      .record(z.string(), filterValue)
      .optional()
      .describe('Lighedsfiltre, fx {"lease_status":"ledig"}.'),
    columns: z
      .array(columnName)
      .min(1)
      .max(100)
      .optional()
      .describe("Kolonner der returneres; standard er alle."),
    order_by: columnName.optional().describe("Kolonne der sorteres efter."),
    ascending: z.boolean().optional().describe("Stigende sortering; standard er sand."),
    date_from: date.optional().describe("Fra og med dato på tabellens primære datokolonne."),
    date_to: date.optional().describe("Til og med dato på tabellens primære datokolonne."),
    search: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .optional()
      .describe("Søg i tabellens name-, title- og description-felter, hvor de findes."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (
    { table, limit, filters, columns, order_by, ascending, date_from, date_to, search },
    ctx,
  ) => {
    const sb = supabaseForUser(ctx);
    // Tabellen kommer fra den lukkede whitelist ovenfor; kolonnenavne valideres separat.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (sb.from as any)(table).select(columns?.join(",") ?? "*");

    for (const [column, value] of Object.entries(filters ?? {})) {
      assertColumn(column);
      query = query.eq(column, value);
    }

    if (date_from || date_to) {
      const dateColumn = DATE_COLUMNS[table];
      if (!dateColumn) throw new ToolError(`${table} har ingen primær datokolonne.`);
      if (date_from) query = query.gte(dateColumn, date_from);
      if (date_to) {
        if (dateColumn.endsWith("_at")) {
          const nextDay = new Date(`${date_to}T00:00:00Z`);
          nextDay.setUTCDate(nextDay.getUTCDate() + 1);
          query = query.lt(dateColumn, nextDay.toISOString());
        } else {
          query = query.lte(dateColumn, date_to);
        }
      }
    }

    if (search) {
      const searchColumns = SEARCH_COLUMNS[table];
      if (!searchColumns?.length)
        throw new ToolError(`Tekstsøgning er ikke understøttet på ${table}.`);
      const safeSearch = search
        .replace(/[%_(),]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (!safeSearch) throw new ToolError("Søgeteksten skal indeholde bogstaver eller tal.");
      query = query.or(searchColumns.map((column) => `${column}.ilike.%${safeSearch}%`).join(","));
    }

    if (order_by) query = query.order(order_by, { ascending: ascending ?? true });
    const { data, error } = await query.limit(limit ?? 200);
    if (error) throw new ToolError(error.message);
    return json({ table, rows: data ?? [] });
  },
});
