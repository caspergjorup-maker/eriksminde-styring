import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const UNIT_LEASE_STATUSES = [
  "udlejet",
  "ledig",
  "ikke_klar",
  "intern_brug",
  "udlejes_ikke",
] as const;
export type UnitLeaseStatus = (typeof UNIT_LEASE_STATUSES)[number];

export const UNIT_LEASE_STATUS_LABEL: Record<UnitLeaseStatus, string> = {
  udlejet: "Udlejet",
  ledig: "Ledig",
  ikke_klar: "Ikke klar endnu",
  intern_brug: "Intern brug",
  udlejes_ikke: "Udlejes ikke",
};

export const UNIT_LEASE_STATUS_TONE: Record<UnitLeaseStatus, string> = {
  udlejet: "bg-emerald-100 text-emerald-900",
  ledig: "bg-blue-100 text-blue-900",
  ikke_klar: "bg-yellow-100 text-yellow-900",
  intern_brug: "bg-teal-100 text-teal-900",
  udlejes_ikke: "bg-gray-200 text-gray-800",
};

export type UnitLeaseSummary = {
  id: string;
  monthly_rent: number;
  deposit: number;
  contract_start: string | null;
  contract_end: string | null;
  status: string;
  tenant: { id: string; name: string; phone: string | null; email: string | null } | null;
};

export type UnitMapKind = "rect" | "polygon";
export type UnitMapRect = { x: number; y: number; w: number; h: number };
export type UnitMapPolygon = { points: Array<[number, number]> };
export type UnitMapGeometry = UnitMapRect | UnitMapPolygon;

export type BuildingUnit = {
  id: string;
  building_id: string | null;
  name: string;
  description: string | null;
  area_m2: number | null;
  lease_status: UnitLeaseStatus;
  lease_status_note: string | null;
  estimated_monthly_rent: number | null;
  has_electricity: boolean | null;
  has_water: boolean | null;
  has_heating: boolean | null;
  heating_type: string | null;
  has_sewage: boolean | null;
  has_internet: boolean | null;
  notes: string | null;
  map_kind: UnitMapKind | null;
  map_geometry: UnitMapGeometry | null;
  map_color: string | null;
  lease: UnitLeaseSummary | null;
};

const unitInput = z.object({
  building_id: z.string().uuid().nullable(),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  area_m2: z.number().min(0).max(1_000_000).nullable().optional(),
  lease_status: z.enum(UNIT_LEASE_STATUSES),
  lease_status_note: z.string().trim().max(2000).nullable().optional(),
  estimated_monthly_rent: z.number().min(0).max(10_000_000).nullable().optional(),
  has_electricity: z.boolean().nullable().optional(),
  has_water: z.boolean().nullable().optional(),
  has_heating: z.boolean().nullable().optional(),
  heating_type: z.string().trim().max(60).nullable().optional(),
  has_sewage: z.boolean().nullable().optional(),
  has_internet: z.boolean().nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
});

const geometrySchema = z.union([
  z.object({
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
    w: z.number().min(0).max(100),
    h: z.number().min(0).max(100),
  }),
  z.object({
    points: z
      .array(z.tuple([z.number().min(0).max(100), z.number().min(0).max(100)]))
      .min(3)
      .max(60),
  }),
]);

function pickLease(rows: Array<Record<string, unknown>> | null | undefined): UnitLeaseSummary | null {
  if (!rows || rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => {
    const ae = a.contract_end as string | null;
    const be = b.contract_end as string | null;
    if (!ae) return 1;
    if (!be) return -1;
    return be.localeCompare(ae);
  });
  const l = sorted[0];
  return {
    id: l.id as string,
    monthly_rent: Number(l.monthly_rent ?? 0),
    deposit: Number(l.deposit ?? 0),
    contract_start: (l.contract_start as string | null) ?? null,
    contract_end: (l.contract_end as string | null) ?? null,
    status: (l.status as string) ?? "active",
    tenant: (l.tenant as UnitLeaseSummary["tenant"]) ?? null,
  };
}

export const listBuildingUnits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BuildingUnit[]> => {
    const { data, error } = await context.supabase
      .from("building_units")
      .select(
        "*, building_leases(id, monthly_rent, deposit, contract_start, contract_end, status, tenant:contacts!building_leases_tenant_id_fkey(id,name,phone,email))",
      )
      .order("name");
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => {
      const { building_leases, ...rest } = r as typeof r & {
        building_leases?: Array<Record<string, unknown>> | null;
      };
      return { ...(rest as unknown as BuildingUnit), lease: pickLease(building_leases ?? null) };
    });
  });

export const createBuildingUnit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => unitInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("building_units").insert(data as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateBuildingUnit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).and(unitInput).parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { error } = await context.supabase.from("building_units").update(rest as never).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteBuildingUnit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("building_units").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveBuildingUnitGeometry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        map_kind: z.enum(["rect", "polygon"]).nullable(),
        map_geometry: geometrySchema.nullable(),
        map_color: z.string().trim().max(20).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { error } = await context.supabase
      .from("building_units")
      .update(rest as never)
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
