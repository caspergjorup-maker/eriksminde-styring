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
  "administration",
  "indkoeb",
  "moede",
  "opfoelgning",
  "kontrakt",
  "personlig",
  "andet",
] as const;
export const CATEGORY_LABEL: Record<string, string> = {
  administration: "Administration",
  indkoeb: "Indkøb",
  moede: "Møde",
  opfoelgning: "Opfølgning",
  kontrakt: "Kontrakt",
  personlig: "Personlig",
  andet: "Andet",
};

export type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  assigned_contact_id: string | null;
  category: string | null;
  priority: string;
  status: string;
  due_date: string | null;
  completed_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  contact_name?: string | null;
};

const taskInput = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).nullable().optional(),
  assigned_contact_id: z.string().uuid().nullable().optional(),
  category: z.string().trim().max(60).nullable().optional(),
  priority: z.enum(PRIORITIES),
  status: z.enum(STATUSES),
  due_date: z.string().nullable().optional(),
  completed_date: z.string().nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
});

function nullify<T extends Record<string, unknown>>(o: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    out[k] = v === undefined || v === "" ? null : v;
  }
  return out as T;
}

export const listTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TaskRow[]> => {
    const { data, error } = await context.supabase
      .from("tasks")
      .select("*, contacts:assigned_contact_id(name)")
      .order("due_date", { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => {
      const { contacts, ...rest } = r as typeof r & { contacts?: { name: string } | null };
      return { ...rest, contact_name: contacts?.name ?? null };
    }) as TaskRow[];
  });

export const createTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => taskInput.parse(data))
  .handler(async ({ data, context }) => {
    const { error, data: row } = await context.supabase
      .from("tasks")
      .insert(nullify(data))
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid() }).and(taskInput).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { error, data: row } = await context.supabase
      .from("tasks")
      .update(nullify(rest))
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("tasks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
