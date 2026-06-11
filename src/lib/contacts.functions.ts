import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const CONTACT_TYPES = [
  "customer",
  "tenant",
  "leaseholder",
  "hunting_tenant",
  "supplier",
] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];

export type Contact = {
  id: string;
  type: ContactType;
  name: string;
  cvr: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
};

const contactInput = z.object({
  type: z.enum(CONTACT_TYPES),
  name: z.string().trim().min(1, "Navn er påkrævet").max(200),
  cvr: z.string().trim().max(20).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().max(255).email("Ugyldig email").optional().nullable().or(z.literal("")),
  address: z.string().trim().max(500).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

function normalize(input: z.infer<typeof contactInput>) {
  const blank = (v: string | null | undefined) => (v == null || v === "" ? null : v);
  return {
    type: input.type,
    name: input.name,
    cvr: blank(input.cvr ?? null),
    phone: blank(input.phone ?? null),
    email: blank(input.email ?? null),
    address: blank(input.address ?? null),
    notes: blank(input.notes ?? null),
  };
}

export const listContacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { kind: "customers" | "suppliers" }) => data)
  .handler(async ({ data, context }): Promise<Contact[]> => {
    const { supabase } = context;
    const query = supabase.from("contacts").select("*").order("name");
    const res =
      data.kind === "suppliers"
        ? await query.eq("type", "supplier")
        : await query.neq("type", "supplier");
    if (res.error) throw new Error(res.error.message);
    return (res.data ?? []) as Contact[];
  });

export const createContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => contactInput.parse(data))
  .handler(async ({ data, context }) => {
    const { error, data: row } = await context.supabase
      .from("contacts")
      .insert(normalize(data))
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row as Contact;
  });

export const updateContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid() }).and(contactInput).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { error, data: row } = await context.supabase
      .from("contacts")
      .update(normalize(rest))
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row as Contact;
  });

export const deleteContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("contacts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
