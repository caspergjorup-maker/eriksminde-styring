/* eslint-disable @typescript-eslint/no-explicit-any */
import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, json } from "../supabase";
import { farmTableSchema } from "./read-data";

export default defineTool({
  name: "get_record",
  title: "Hent én post med relationer",
  description:
    "Hent én række på id inklusive relaterede rækker, fx en bygning med enheder, lejeaftaler og vedligehold, en mark med matrikler og forpagtning eller en kontakt med fakturaer og halmbevægelser.",
  inputSchema: {
    table: farmTableSchema.describe("Tabellen posten findes i."),
    id: z.string().uuid().describe("Postens UUID."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ table, id }, ctx) => {
    const sb = supabaseForUser(ctx);
    const { data: record, error } = await (sb.from as any)(table)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new ToolError(error.message);
    if (!record) throw new ToolError(`Ingen række med id ${id} i ${table}.`);

    const related: Record<string, unknown> = {};
    const add = async (key: string, relatedTable: string, column: string, value: string) => {
      const result = await (sb.from as any)(relatedTable).select("*").eq(column, value).limit(500);
      if (result.error) throw new ToolError(result.error.message);
      related[key] = result.data ?? [];
      return (result.data ?? []) as any[];
    };
    const addIn = async (key: string, relatedTable: string, column: string, values: string[]) => {
      if (!values.length) {
        related[key] = [];
        return [];
      }
      const result = await (sb.from as any)(relatedTable).select("*").in(column, values).limit(500);
      if (result.error) throw new ToolError(result.error.message);
      related[key] = result.data ?? [];
      return (result.data ?? []) as any[];
    };

    if (table === "buildings") {
      await Promise.all([
        add("units", "building_units", "building_id", id),
        add("leases", "building_leases", "building_id", id),
        add("maintenance_tasks", "maintenance_tasks", "building_id", id),
      ]);
    } else if (table === "fields") {
      const links = await add("field_parcels", "field_parcels", "field_id", id);
      const parcels = await addIn(
        "parcels",
        "parcels",
        "id",
        links.map((link) => link.parcel_id).filter(Boolean),
      );
      await addIn("land_leases", "land_leases", "id", [
        ...new Set(parcels.map((parcel) => parcel.land_lease_id).filter(Boolean)),
      ]);
    } else if (table === "contacts") {
      await Promise.all([
        add("invoices", "invoices", "contact_id", id),
        add("straw_movements", "straw_movements", "contact_id", id),
        add("land_leases", "land_leases", "leaseholder_id", id),
        add("building_leases", "building_leases", "tenant_id", id),
        add("hunting_leases", "hunting_leases", "tenant_id", id),
      ]);
    } else if (table === "machines") {
      await Promise.all([
        add("maintenance_tasks", "maintenance_tasks", "machine_id", id),
        add("service_logs", "service_logs", "machine_id", id),
      ]);
    } else if (table === "parcels") {
      const links = await add("field_parcels", "field_parcels", "parcel_id", id);
      await Promise.all([
        addIn("fields", "fields", "id", links.map((link) => link.field_id).filter(Boolean)),
        add("buildings", "buildings", "parcel_id", id),
        record.land_lease_id
          ? add("land_lease", "land_leases", "id", record.land_lease_id)
          : Promise.resolve(),
      ]);
    } else if (table === "budget_scenarios") {
      await Promise.all([
        add("budget_lines", "budget_lines", "scenario_id", id),
        add("budget_loans", "budget_loans", "scenario_id", id),
      ]);
    } else if (table === "building_units") {
      await add("leases", "building_leases", "unit_id", id);
    } else if (table === "land_leases") {
      await add("parcels", "parcels", "land_lease_id", id);
    } else if (table === "hunting_leases") {
      await add("hunting_records", "hunting_records", "lease_id", id);
    } else if (table === "invoices") {
      await add("straw_movements", "straw_movements", "invoice_id", id);
    }

    return json({ table, record, related });
  },
});
