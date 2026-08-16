import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveCreatorNames } from "./creators.server";

export const BUILDING_TYPES = [
  "stuehus",
  "lade",
  "maskinhus",
  "lagerhal",
  "vaerksted",
  "smedie",
  "garage",
] as const;
export type BuildingType = (typeof BUILDING_TYPES)[number];

export const BUILDING_TYPE_LABEL: Record<BuildingType, string> = {
  stuehus: "Stuehus",
  lade: "Lade",
  maskinhus: "Maskinhus",
  lagerhal: "Lagerhal",
  vaerksted: "Værksted",
  smedie: "Smedie",
  garage: "Garage",
};

export const BUILDING_TYPE_COLOR: Record<BuildingType, string> = {
  stuehus: "#B94E48",
  lade: "#D4A23A",
  maskinhus: "#5B7A9C",
  lagerhal: "#C27A3E",
  vaerksted: "#3F8DDB",
  smedie: "#4A4A4A",
  garage: "#8A9A8C",
};

export const LEASE_STATUSES = [
  "active",
  "pending_payment",
  "expiring_soon",
  "vacant",
] as const;
export type LeaseStatus = (typeof LEASE_STATUSES)[number];

export type Building = {
  id: string;
  name: string;
  type: BuildingType;
  description: string | null;
  building_nr: string | null;
  map_color: string | null;
  map_section: string | null;
  map_x: number | null;
  map_y: number | null;
  map_w: number | null;
  map_h: number | null;
  map_shape: string | null;
  map_angle: number | null;
  build_year: number | null;
  area_m2_gross: number | null;
  area_m2_net: number | null;
  floors: number | null;
  condition: BuildingCondition | null;
  last_inspection: string | null;
  lease_status: BuildingLeaseStatus | null;
  lease_status_note: string | null;
  estimated_monthly_rent: number | null;
  has_electricity: boolean | null;
  has_water: boolean | null;
  has_heating: boolean | null;
  heating_type: HeatingType | null;
  has_sewage: boolean | null;
  has_internet: boolean | null;
  parcel_id: string | null;
  internal_notes: string | null;
  height_m: number | null;
  roof_type: RoofType | null;
  roof_color: string | null;
  wall_color: string | null;
};

export const BUILDING_CONDITIONS = ["god", "vedligeholdelse_nødvendig", "renovering_nødvendig"] as const;
export type BuildingCondition = (typeof BUILDING_CONDITIONS)[number];

export const ROOF_TYPES = ["fladt", "saddeltag", "pulttag", "valmtag", "skur_tag"] as const;
export type RoofType = (typeof ROOF_TYPES)[number];

export const BUILDING_LEASE_STATUSES = ["udlejet", "ledig", "intern_brug"] as const;
export type BuildingLeaseStatus = (typeof BUILDING_LEASE_STATUSES)[number];

export const HEATING_TYPES = ["fjernvarme", "olie", "varmepumpe", "elvarme", "ingen"] as const;
export type HeatingType = (typeof HEATING_TYPES)[number];

export type BuildingLease = {
  id: string;
  building_id: string | null;
  building_name: string | null;
  unit_id: string | null;
  unit_name: string | null;
  tenant_id: string | null;
  tenant_name: string | null;
  monthly_rent: number;
  deposit: number;
  contract_start: string | null;
  contract_end: string | null;
  status: LeaseStatus;
  notes: string | null;
};

export type BuildingMapTenant = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
};

export type BuildingMapLease = {
  id: string;
  monthly_rent: number;
  deposit: number;
  contract_start: string | null;
  contract_end: string | null;
  status: LeaseStatus;
  tenant: BuildingMapTenant | null;
};

export type BuildingWithLease = Building & {
  lease: BuildingMapLease | null;
};

const buildingInput = z.object({
  name: z.string().trim().min(1).max(200),
  type: z.enum(BUILDING_TYPES),
  description: z.string().trim().max(2000).nullable(),
  build_year: z.number().int().min(1500).max(2100).nullable(),
  area_m2_gross: z.number().min(0).max(1_000_000).nullable(),
  area_m2_net: z.number().min(0).max(1_000_000).nullable(),
  floors: z.number().int().min(0).max(50).nullable(),
  condition: z.enum(BUILDING_CONDITIONS).nullable(),
  last_inspection: z.string().nullable(),
  lease_status: z.enum(BUILDING_LEASE_STATUSES).nullable(),
  lease_status_note: z.string().trim().max(2000).nullable(),
  estimated_monthly_rent: z.number().min(0).max(10_000_000).nullable(),
  has_electricity: z.boolean(),
  has_water: z.boolean(),
  has_heating: z.boolean(),
  heating_type: z.enum(HEATING_TYPES).nullable(),
  has_sewage: z.boolean(),
  has_internet: z.boolean(),
  parcel_id: z.string().uuid().nullable(),
  internal_notes: z.string().trim().max(5000).nullable(),
  height_m: z.number().min(0).max(200).nullable(),
  roof_type: z.enum(ROOF_TYPES).nullable(),
  roof_color: z.string().trim().max(50).nullable(),
  wall_color: z.string().trim().max(50).nullable(),
  map_angle: z.number().min(-180).max(180).nullable(),
});

const leaseInput = z.object({
  building_id: z.string().uuid().nullable(),
  unit_id: z.string().uuid().nullable().optional(),
  tenant_id: z.string().uuid().nullable(),
  monthly_rent: z.number().min(0).max(10_000_000),
  deposit: z.number().min(0).max(10_000_000),
  contract_start: z.string().nullable(),
  contract_end: z.string().nullable(),
  status: z.enum(LEASE_STATUSES),
  notes: z.string().trim().max(2000).nullable(),
});

const BUILDING_COLS =
  "id, name, type, description, building_nr, map_color, map_section, map_x, map_y, map_w, map_h, map_shape, map_angle, build_year, area_m2_gross, area_m2_net, floors, condition, last_inspection, lease_status, lease_status_note, estimated_monthly_rent, has_electricity, has_water, has_heating, heating_type, has_sewage, has_internet, parcel_id, internal_notes, height_m, roof_type, roof_color, wall_color";

export const listBuildings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Building[]> => {
    const { data, error } = await context.supabase
      .from("buildings")
      .select(BUILDING_COLS)
      .order("name");
    if (error) throw new Error(error.message);
    return (data ?? []) as Building[];
  });

export const listBuildingsWithLeases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BuildingWithLease[]> => {
    const { data, error } = await context.supabase
      .from("buildings")
      .select(
        `${BUILDING_COLS}, building_leases(id, monthly_rent, deposit, contract_start, contract_end, status, tenant:contacts!building_leases_tenant_id_fkey(id, name, phone, email))`,
      )
      .order("building_nr", { nullsFirst: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: Record<string, unknown>) => {
      const leases = (r.building_leases as Array<Record<string, unknown>> | null) ?? [];
      // pick lease with farthest contract_end (latest); fallback first
      const sorted = [...leases].sort((a, b) => {
        const ae = a.contract_end as string | null;
        const be = b.contract_end as string | null;
        if (!ae) return 1;
        if (!be) return -1;
        return be.localeCompare(ae);
      });
      const l = sorted[0];
      const lease: BuildingMapLease | null = l
        ? {
            id: l.id as string,
            monthly_rent: Number(l.monthly_rent ?? 0),
            deposit: Number(l.deposit ?? 0),
            contract_start: (l.contract_start as string | null) ?? null,
            contract_end: (l.contract_end as string | null) ?? null,
            status: ((l.status as LeaseStatus) ?? "active"),
            tenant: (l.tenant as BuildingMapTenant | null) ?? null,
          }
        : null;
      const { building_leases: _omit, ...building } = r as Record<string, unknown>;
      void _omit;
      return { ...(building as unknown as Building), lease };
    });
  });

export const createBuilding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => buildingInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("buildings").insert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateBuilding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).and(buildingInput).parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { error } = await context.supabase.from("buildings").update(rest).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteBuilding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("buildings").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listBuildingLeases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BuildingLease[]> => {
    const { data, error } = await context.supabase
      .from("building_leases")
      .select(
        "id, created_by, building_id, unit_id, tenant_id, monthly_rent, deposit, contract_start, contract_end, status, notes, buildings:building_id(name), building_units:unit_id(name), contacts:tenant_id(name)",
      )
      .order("contract_end", { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);
    const creators = await resolveCreatorNames(
      context.supabase,
      (data ?? []).map((r) => (r as { created_by?: string | null }).created_by),
    );
    return (data ?? []).map((r) => ({
      id: r.id,
      created_by_name: creators.get((r as { created_by?: string | null }).created_by ?? "") ?? null,
      building_id: r.building_id,
      building_name: (r.buildings as { name?: string } | null)?.name ?? null,
      unit_id: (r as { unit_id?: string | null }).unit_id ?? null,
      unit_name: (r.building_units as { name?: string } | null)?.name ?? null,
      tenant_id: r.tenant_id,
      tenant_name: (r.contacts as { name?: string } | null)?.name ?? null,
      monthly_rent: Number(r.monthly_rent ?? 0),
      deposit: Number(r.deposit ?? 0),
      contract_start: r.contract_start,
      contract_end: r.contract_end,
      status: (r.status ?? "active") as LeaseStatus,
      notes: r.notes,
    }));
  });

export const createBuildingLease = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => leaseInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("building_leases").insert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateBuildingLease = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).and(leaseInput).parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { error } = await context.supabase.from("building_leases").update(rest).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteBuildingLease = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("building_leases").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type TenantOption = { id: string; name: string };

export const listTenantOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TenantOption[]> => {
    const { data, error } = await context.supabase
      .from("contacts")
      .select("id, name")
      .in("type", ["tenant", "customer"])
      .order("name");
    if (error) throw new Error(error.message);
    return (data ?? []) as TenantOption[];
  });
