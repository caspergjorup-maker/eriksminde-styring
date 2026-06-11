import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const PRIORITIES = ["low", "medium", "high", "critical"] as const;
export const PRIORITY_LABEL: Record<string, string> = {
  low: "Lav",
  medium: "Medium",
  high: "Høj",
  critical: "Kritisk",
};

export const STATUSES = ["open", "in_progress", "done", "cancelled"] as const;
export const STATUS_LABEL: Record<string, string> = {
  open: "Åben",
  in_progress: "I gang",
  done: "Færdig",
  cancelled: "Aflyst",
};

export const CATEGORIES = [
  "bygning",
  "udstyr",
  "koeretoej",
  "el_vvs",
  "tag_facade",
  "udendoers",
  "andet",
] as const;
export const CATEGORY_LABEL: Record<string, string> = {
  bygning: "Bygning",
  udstyr: "Udstyr",
  koeretoej: "Køretøj",
  el_vvs: "El/VVS",
  tag_facade: "Tag/Facade",
  udendoers: "Udendørs",
  andet: "Andet",
};

export type MaintenanceTaskRow = {
  id: string;
  title: string;
  description: string | null;
  building_id: string | null;
  assigned_contact_id: string | null;
  category: string | null;
  priority: string;
  status: string;
  due_date: string | null;
  completed_date: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  building_name?: string | null;
  contact_name?: string | null;
};

const taskInput = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).nullable().optional(),
  building_id: z.string().uuid().nullable().optional(),
  assigned_contact_id: z.string().uuid().nullable().optional(),
  category: z.string().trim().max(60).nullable().optional(),
  priority: z.enum(PRIORITIES),
  status: z.enum(STATUSES),
  due_date: z.string().nullable().optional(),
  completed_date: z.string().nullable().optional(),
  estimated_cost: z.number().min(0).max(100_000_000).nullable().optional(),
  actual_cost: z.number().min(0).max(100_000_000).nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
});

function nullify<T extends Record<string, unknown>>(o: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    out[k] = v === undefined || v === "" ? null : v;
  }
  return out as T;
}

export const listMaintenanceTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MaintenanceTaskRow[]> => {
    const { data, error } = await context.supabase
      .from("maintenance_tasks")
      .select("*, buildings(name), contacts(name)")
      .order("due_date", { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => {
      const { buildings, contacts, ...rest } = r as typeof r & {
        buildings?: { name: string } | null;
        contacts?: { name: string } | null;
      };
      return {
        ...rest,
        building_name: buildings?.name ?? null,
        contact_name: contacts?.name ?? null,
      };
    }) as MaintenanceTaskRow[];
  });

export const createMaintenanceTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => taskInput.parse(data))
  .handler(async ({ data, context }) => {
    const { error, data: row } = await context.supabase
      .from("maintenance_tasks")
      .insert(nullify(data))
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateMaintenanceTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid() }).and(taskInput).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { error, data: row } = await context.supabase
      .from("maintenance_tasks")
      .update(nullify(rest))
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteMaintenanceTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("maintenance_tasks")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMaintenanceBuildings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("buildings")
      .select("id, name")
      .order("name");
    if (error) throw new Error(error.message);
    return (data ?? []) as { id: string; name: string }[];
  });

export const listMaintenanceContacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("contacts")
      .select("id, name, type")
      .order("name");
    if (error) throw new Error(error.message);
    return (data ?? []) as { id: string; name: string; type: string }[];
  });
