import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const MACHINE_TYPES = [
  "traktor",
  "rendegraver",
  "laesser",
  "anhaenger",
  "plov",
  "saemaskine",
  "sproejtevogn",
  "andet",
] as const;
export const MACHINE_TYPE_LABEL: Record<string, string> = {
  traktor: "Traktor",
  rendegraver: "Rendegraver",
  laesser: "Læsser",
  anhaenger: "Anhænger",
  plov: "Plov",
  saemaskine: "Såmaskine",
  sproejtevogn: "Sprøjtevogn",
  andet: "Andet",
};

export const OWNERSHIPS = ["eget", "leaset", "lejet"] as const;
export const OWNERSHIP_LABEL: Record<string, string> = {
  eget: "Eget",
  leaset: "Leaset",
  lejet: "Lejet",
};

export const MACHINE_STATUSES = ["i_drift", "reparation", "udgaaet"] as const;
export const MACHINE_STATUS_LABEL: Record<string, string> = {
  i_drift: "I drift",
  reparation: "Til reparation",
  udgaaet: "Udgået",
};

export type ServiceLogRow = {
  id: string;
  machine_id: string;
  service_date: string;
  hours_at_service: number | null;
  description: string | null;
  cost: number | null;
  supplier_id: string | null;
  supplier_name?: string | null;
  next_service_date: string | null;
  next_service_hours: number | null;
  created_at: string;
};

export type MachineRow = {
  id: string;
  name: string;
  type: string | null;
  brand: string | null;
  model: string | null;
  year: number | null;
  serial_number: string | null;
  registration_number: string | null;
  ownership: string | null;
  status: string | null;
  current_hours: number | null;
  last_service_date: string | null;
  last_service_hours: number | null;
  next_service_date: string | null;
  next_service_hours: number | null;
  service_interval_hours: number | null;
  service_interval_months: number | null;
  estimated_value: number | null;
  insurance_company: string | null;
  insurance_expiry: string | null;
  lease_expiry: string | null;
  preferred_supplier_id: string | null;
  preferred_supplier_name?: string | null;
  image_url: string | null;
  notes: string | null;
  created_at: string;
};

const machineInput = z.object({
  name: z.string().trim().min(1).max(200),
  type: z.enum(MACHINE_TYPES).nullable().optional(),
  brand: z.string().trim().max(120).nullable().optional(),
  model: z.string().trim().max(120).nullable().optional(),
  year: z.number().int().min(1900).max(2100).nullable().optional(),
  serial_number: z.string().trim().max(120).nullable().optional(),
  registration_number: z.string().trim().max(60).nullable().optional(),
  ownership: z.enum(OWNERSHIPS).nullable().optional(),
  status: z.enum(MACHINE_STATUSES).nullable().optional(),
  current_hours: z.number().int().min(0).max(1_000_000).nullable().optional(),
  last_service_date: z.string().nullable().optional(),
  last_service_hours: z.number().int().min(0).max(1_000_000).nullable().optional(),
  next_service_date: z.string().nullable().optional(),
  next_service_hours: z.number().int().min(0).max(1_000_000).nullable().optional(),
  service_interval_hours: z.number().int().min(0).max(100_000).nullable().optional(),
  service_interval_months: z.number().int().min(0).max(240).nullable().optional(),
  estimated_value: z.number().min(0).max(100_000_000).nullable().optional(),
  insurance_company: z.string().trim().max(200).nullable().optional(),
  insurance_expiry: z.string().nullable().optional(),
  lease_expiry: z.string().nullable().optional(),
  preferred_supplier_id: z.string().uuid().nullable().optional(),
  image_url: z.string().trim().max(2000).nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
});

function nullify<T extends Record<string, unknown>>(o: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    out[k] = v === undefined || v === "" ? null : v;
  }
  return out as T;
}

export const listMachines = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MachineRow[]> => {
    const { data, error } = await context.supabase
      .from("machines")
      .select("*, preferred_supplier:contacts!machines_preferred_supplier_id_fkey(id,name)")
      .order("name");
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => {
      const { preferred_supplier, ...rest } = r as typeof r & {
        preferred_supplier?: { id: string; name: string } | null;
      };
      return {
        ...rest,
        preferred_supplier_name: preferred_supplier?.name ?? null,
      };
    }) as MachineRow[];
  });

export const createMachine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => machineInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error, data: row } = await context.supabase
      .from("machines")
      .insert(nullify(data) as never)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateMachine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).and(machineInput).parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { error, data: row } = await context.supabase
      .from("machines")
      .update(nullify(rest) as never)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteMachine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("machines").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const serviceLogInput = z.object({
  machine_id: z.string().uuid(),
  service_date: z.string().min(1),
  hours_at_service: z.number().int().min(0).max(1_000_000).nullable().optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  cost: z.number().min(0).max(100_000_000).nullable().optional(),
  supplier_id: z.string().uuid().nullable().optional(),
  next_service_date: z.string().nullable().optional(),
  next_service_hours: z.number().int().min(0).max(1_000_000).nullable().optional(),
});

export const listServiceLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ machine_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<ServiceLogRow[]> => {
    const { data: rows, error } = await context.supabase
      .from("service_logs")
      .select("*, supplier:contacts!service_logs_supplier_id_fkey(id,name)")
      .eq("machine_id", data.machine_id)
      .order("service_date", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => {
      const { supplier, ...rest } = r as typeof r & { supplier?: { id: string; name: string } | null };
      return { ...rest, supplier_name: supplier?.name ?? null };
    }) as ServiceLogRow[];
  });

export const createServiceLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => serviceLogInput.parse(d))
  .handler(async ({ data, context }) => {
    const payload = nullify(data);
    const { error, data: row } = await context.supabase
      .from("service_logs")
      .insert(payload as never)
      .select()
      .single();
    if (error) throw new Error(error.message);

    // Update parent machine with latest service info
    const update: Record<string, unknown> = {
      last_service_date: data.service_date,
    };
    if (data.hours_at_service != null) update.last_service_hours = data.hours_at_service;
    if (data.next_service_date) update.next_service_date = data.next_service_date;
    if (data.next_service_hours != null) update.next_service_hours = data.next_service_hours;
    await context.supabase.from("machines").update(update as never).eq("id", data.machine_id);

    return row;
  });

export const deleteServiceLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("service_logs").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export function needsService(m: Pick<MachineRow, "next_service_date" | "next_service_hours" | "current_hours">): boolean {
  if (m.next_service_date) {
    const days = Math.ceil((new Date(m.next_service_date).getTime() - Date.now()) / 86400000);
    if (days <= 30) return true;
  }
  if (m.next_service_hours != null && m.current_hours != null) {
    if (m.next_service_hours - m.current_hours <= 50) return true;
  }
  return false;
}
