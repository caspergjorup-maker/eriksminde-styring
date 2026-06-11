import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
};

export type BuildingLease = {
  id: string;
  building_id: string | null;
  building_name: string | null;
  tenant_id: string | null;
  tenant_name: string | null;
  monthly_rent: number;
  deposit: number;
  contract_start: string | null;
  contract_end: string | null;
  status: LeaseStatus;
  notes: string | null;
};

const buildingInput = z.object({
  name: z.string().trim().min(1).max(200),
  type: z.enum(BUILDING_TYPES),
  description: z.string().trim().max(2000).nullable(),
});

const leaseInput = z.object({
  building_id: z.string().uuid().nullable(),
  tenant_id: z.string().uuid().nullable(),
  monthly_rent: z.number().min(0).max(10_000_000),
  deposit: z.number().min(0).max(10_000_000),
  contract_start: z.string().nullable(),
  contract_end: z.string().nullable(),
  status: z.enum(LEASE_STATUSES),
  notes: z.string().trim().max(2000).nullable(),
});

export const listBuildings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Building[]> => {
    const { data, error } = await context.supabase
      .from("buildings")
      .select("id, name, type, description")
      .order("name");
    if (error) throw new Error(error.message);
    return (data ?? []) as Building[];
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
      .select("id, building_id, tenant_id, monthly_rent, deposit, contract_start, contract_end, status, notes, buildings:building_id(name), contacts:tenant_id(name)")
      .order("contract_end", { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      id: r.id,
      building_id: r.building_id,
      building_name: (r.buildings as { name?: string } | null)?.name ?? null,
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
