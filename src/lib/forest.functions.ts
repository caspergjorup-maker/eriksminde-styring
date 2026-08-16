import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveCreatorNames } from "./creators.server";

// ============ Constants ============

export const TREE_SPECIES = [
  "gran",
  "fyr",
  "eg",
  "boeg",
  "birk",
  "ahorn",
  "blandet",
  "andet",
] as const;

export const TREE_SPECIES_LABEL: Record<string, string> = {
  gran: "Gran",
  fyr: "Fyr",
  eg: "Eg",
  boeg: "Bøg",
  birk: "Birk",
  ahorn: "Ahorn",
  blandet: "Blandet løv/nål",
  andet: "Andet",
};

export const PARCEL_STATUS = ["aktiv", "plantet", "afdrevet", "fredet"] as const;
export const PARCEL_STATUS_LABEL: Record<string, string> = {
  aktiv: "Aktiv",
  plantet: "Plantet",
  afdrevet: "Afdrevet",
  fredet: "Fredet",
};

export const ACTIVITY_TYPES = [
  "hugst",
  "udtynding",
  "plantning",
  "rydning",
  "vedligehold",
  "salg_trae",
  "andet",
] as const;

export const ACTIVITY_TYPE_LABEL: Record<string, string> = {
  hugst: "Hugst",
  udtynding: "Udtynding",
  plantning: "Plantning",
  rydning: "Rydning",
  vedligehold: "Vedligehold",
  salg_trae: "Salg af træ",
  andet: "Andet",
};

export const HUNTING_SPECIES = [
  "raavildt",
  "kronvildt",
  "daadyr",
  "vildsvin",
  "raev",
  "fasan",
  "and",
  "andet",
] as const;

export const HUNTING_SPECIES_LABEL: Record<string, string> = {
  raavildt: "Råvildt",
  kronvildt: "Kronvildt",
  daadyr: "Dådyr",
  vildsvin: "Vildsvin",
  raev: "Ræv",
  fasan: "Fasan",
  and: "And",
  andet: "Andet",
};

// ============ Types ============

export type ForestParcelRow = {
  id: string;
  name: string;
  area_ha: number | null;
  tree_species: string | null;
  average_age_years: number | null;
  estimated_harvest_year_from: number | null;
  estimated_harvest_year_to: number | null;
  status: string | null;
  notes: string | null;
  created_at: string;
};

export type ForestActivityRow = {
  id: string;
  parcel_id: string | null;
  activity_type: string;
  activity_date: string | null;
  contractor_id: string | null;
  volume_m3: number | null;
  quantity_units: number | null;
  cost: number | null;
  revenue: number | null;
  notes: string | null;
  created_at: string;
  parcel_name?: string | null;
  contractor_name?: string | null;
};

export type HuntingLeaseRow = {
  id: string;
  name: string;
  tenant_id: string | null;
  area_ha: number | null;
  annual_fee: number | null;
  contract_start: string | null;
  contract_end: string | null;
  notes: string | null;
  created_at: string;
  tenant_name?: string | null;
  created_by_name?: string | null;
};

export type HuntingRecordRow = {
  id: string;
  lease_id: string | null;
  season: string | null;
  species: string | null;
  quota: number | null;
  harvested: number | null;
  notes: string | null;
  created_at: string;
  lease_name?: string | null;
};

// ============ Validators ============

const parcelInput = z.object({
  name: z.string().trim().min(1).max(120),
  area_ha: z.number().min(0).max(100000).nullable().optional(),
  tree_species: z.string().trim().max(60).nullable().optional(),
  average_age_years: z.number().int().min(0).max(500).nullable().optional(),
  estimated_harvest_year_from: z.number().int().min(1900).max(2200).nullable().optional(),
  estimated_harvest_year_to: z.number().int().min(1900).max(2200).nullable().optional(),
  status: z.string().trim().max(40).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

const activityInput = z.object({
  parcel_id: z.string().uuid().nullable().optional(),
  activity_type: z.string().trim().min(1).max(60),
  activity_date: z.string().nullable().optional(),
  contractor_id: z.string().uuid().nullable().optional(),
  volume_m3: z.number().min(0).max(1_000_000).nullable().optional(),
  quantity_units: z.number().min(0).max(1_000_000).nullable().optional(),
  cost: z.number().min(0).max(100_000_000).nullable().optional(),
  revenue: z.number().min(0).max(100_000_000).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

const leaseInput = z.object({
  name: z.string().trim().min(1).max(120),
  tenant_id: z.string().uuid().nullable().optional(),
  area_ha: z.number().min(0).max(100000).nullable().optional(),
  annual_fee: z.number().min(0).max(100_000_000).nullable().optional(),
  contract_start: z.string().nullable().optional(),
  contract_end: z.string().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

const recordInput = z.object({
  lease_id: z.string().uuid().nullable().optional(),
  season: z.string().trim().max(20).nullable().optional(),
  species: z.string().trim().max(60).nullable().optional(),
  quota: z.number().int().min(0).max(100000).nullable().optional(),
  harvested: z.number().int().min(0).max(100000).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

function nullify<T extends Record<string, unknown>>(o: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    out[k] = v === undefined || v === "" ? null : v;
  }
  return out as T;
}

// ============ PARCELS ============

export const listForestParcels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ForestParcelRow[]> => {
    const { data, error } = await context.supabase
      .from("forest_parcels")
      .select("*")
      .order("name");
    if (error) throw new Error(error.message);
    return (data ?? []) as ForestParcelRow[];
  });

export const createForestParcel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parcelInput.parse(data))
  .handler(async ({ data, context }) => {
    const { error, data: row } = await context.supabase
      .from("forest_parcels")
      .insert(nullify(data))
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateForestParcel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid() }).and(parcelInput).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { error, data: row } = await context.supabase
      .from("forest_parcels")
      .update(nullify(rest))
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteForestParcel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("forest_parcels")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ ACTIVITIES ============

export const listForestActivities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ForestActivityRow[]> => {
    const { data, error } = await context.supabase
      .from("forest_activities")
      .select("*, forest_parcels(name), contacts(name)")
      .order("activity_date", { ascending: false, nullsFirst: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => {
      const { forest_parcels, contacts, ...rest } = r as typeof r & {
        forest_parcels?: { name: string } | null;
        contacts?: { name: string } | null;
      };
      return {
        ...rest,
        parcel_name: forest_parcels?.name ?? null,
        contractor_name: contacts?.name ?? null,
      };
    }) as ForestActivityRow[];
  });

export const createForestActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => activityInput.parse(data))
  .handler(async ({ data, context }) => {
    const { error, data: row } = await context.supabase
      .from("forest_activities")
      .insert(nullify(data))
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateForestActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid() }).and(activityInput).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { error, data: row } = await context.supabase
      .from("forest_activities")
      .update(nullify(rest))
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteForestActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("forest_activities")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ HUNTING LEASES ============

export const listHuntingLeases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HuntingLeaseRow[]> => {
    const { data, error } = await context.supabase
      .from("hunting_leases")
      .select("*, contacts(name)")
      .order("name");
    if (error) throw new Error(error.message);
    const creators = await resolveCreatorNames(
      context.supabase,
      (data ?? []).map((r) => (r as { created_by?: string | null }).created_by),
    );
    return (data ?? []).map((r) => {
      const { contacts, ...rest } = r as typeof r & {
        contacts?: { name: string } | null;
      };
      return {
        ...rest,
        tenant_name: contacts?.name ?? null,
        created_by_name:
          creators.get((r as { created_by?: string | null }).created_by ?? "") ?? null,
      };
    }) as HuntingLeaseRow[];
  });

export const createHuntingLease = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => leaseInput.parse(data))
  .handler(async ({ data, context }) => {
    const { error, data: row } = await context.supabase
      .from("hunting_leases")
      .insert(nullify(data))
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateHuntingLease = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid() }).and(leaseInput).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { error, data: row } = await context.supabase
      .from("hunting_leases")
      .update(nullify(rest))
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteHuntingLease = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("hunting_leases")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ HUNTING RECORDS ============

export const listHuntingRecords = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HuntingRecordRow[]> => {
    const { data, error } = await context.supabase
      .from("hunting_records")
      .select("*, hunting_leases(name)")
      .order("season", { ascending: false, nullsFirst: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => {
      const { hunting_leases, ...rest } = r as typeof r & {
        hunting_leases?: { name: string } | null;
      };
      return { ...rest, lease_name: hunting_leases?.name ?? null };
    }) as HuntingRecordRow[];
  });

export const createHuntingRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => recordInput.parse(data))
  .handler(async ({ data, context }) => {
    const { error, data: row } = await context.supabase
      .from("hunting_records")
      .insert(nullify(data))
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateHuntingRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid() }).and(recordInput).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { error, data: row } = await context.supabase
      .from("hunting_records")
      .update(nullify(rest))
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteHuntingRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("hunting_records")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ CONTACTS selector ============

export const listForestContacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("contacts")
      .select("id, name, type")
      .order("name");
    if (error) throw new Error(error.message);
    return (data ?? []) as { id: string; name: string; type: string }[];
  });
