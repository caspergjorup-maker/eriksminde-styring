import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type LandLease = {
  id: string;
  leaseholder_id: string | null;
  leaseholder_name: string | null;
  area_ha: number;
  price_per_ha: number;
  annual_fee: number | null;
  contract_start: string | null;
  contract_end: string | null;
  notes: string | null;
};

const input = z.object({
  leaseholder_id: z.string().uuid().nullable(),
  area_ha: z.number().min(0).max(100000),
  price_per_ha: z.number().min(0).max(1_000_000),
  contract_start: z.string().nullable(),
  contract_end: z.string().nullable(),
  notes: z.string().trim().max(2000).nullable(),
});

export const listLandLeases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LandLease[]> => {
    const { data, error } = await context.supabase
      .from("land_leases")
      .select("id, leaseholder_id, area_ha, price_per_ha, annual_fee, contract_start, contract_end, notes, contacts:leaseholder_id(name)")
      .order("contract_end", { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      id: r.id,
      leaseholder_id: r.leaseholder_id,
      leaseholder_name: (r.contacts as { name?: string } | null)?.name ?? null,
      area_ha: Number(r.area_ha ?? 0),
      price_per_ha: Number(r.price_per_ha ?? 0),
      annual_fee: r.annual_fee == null ? null : Number(r.annual_fee),
      contract_start: r.contract_start,
      contract_end: r.contract_end,
      notes: r.notes,
    }));
  });

export const createLandLease = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("land_leases").insert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateLandLease = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).and(input).parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { error } = await context.supabase.from("land_leases").update(rest).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteLandLease = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("land_leases").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type ContactOption = { id: string; name: string; type: string };

export const listLeaseholders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ContactOption[]> => {
    const { data, error } = await context.supabase
      .from("contacts")
      .select("id, name, type")
      .in("type", ["leaseholder", "customer", "tenant"])
      .order("name");
    if (error) throw new Error(error.message);
    return (data ?? []) as ContactOption[];
  });
