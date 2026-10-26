import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { dinero, dineroOrg, summarizeEntries, type DineroEntry, type DineroYear } from "@/lib/dinero.server";

export type DineroYearSummary = {
  orgName: string;
  year: number;
  income: number[];
  expense: number[];
  hasAccountingYear: boolean;
};

export const getDineroYear = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ year: z.number().int() }).parse(d))
  .handler(async ({ data }): Promise<DineroYearSummary> => {
    const org = await dineroOrg();
    const years = await dinero<DineroYear[]>("/accountingyears");
    const entries: DineroEntry[] = [];
    const yStart = `${data.year}-01-01`;
    const yEnd = `${data.year}-12-31`;
    for (const ay of years) {
      const from = ay.FromDate > yStart ? ay.FromDate : yStart;
      const to = ay.ToDate < yEnd ? ay.ToDate : yEnd;
      if (from > to) continue;
      entries.push(...(await dinero<DineroEntry[]>(`/entries?fromDate=${from}&toDate=${to}`)));
    }
    const s = summarizeEntries(entries, []);
    return { orgName: org.name, year: data.year, income: s.income, expense: s.expense, hasAccountingYear: entries.length > 0 || years.some((y) => y.FromDate <= yEnd && y.ToDate >= yStart) };
  });

export const getDineroBank = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const org = await dineroOrg();
    const deposit = await dinero<{ AccountNumber: number; Name: string }[]>("/accounts/deposit");
    const years = await dinero<DineroYear[]>("/accountingyears");
    const today = new Date().toISOString().slice(0, 10);
    const balances = new Map<number, number>(deposit.map((d) => [d.AccountNumber, 0]));
    for (const ay of years) {
      if (ay.FromDate > today) continue;
      const to = ay.ToDate < today ? ay.ToDate : today;
      const entries = await dinero<DineroEntry[]>(`/entries?fromDate=${ay.FromDate}&toDate=${to}`);
      for (const e of entries) if (balances.has(e.AccountNumber)) balances.set(e.AccountNumber, (balances.get(e.AccountNumber) ?? 0) + e.Amount);
    }
    const accounts = deposit
      .map((d) => ({ number: d.AccountNumber, name: d.Name, balance: Math.round((balances.get(d.AccountNumber) ?? 0) * 100) / 100 }))
      .filter((a) => a.balance !== 0 || a.number === 55000);
    return { orgName: org.name, asOf: today, accounts };
  });

// ---------- Kontakter ----------

type DineroContact = { ContactGuid: string; Name: string; VatNumber: string | null };

async function allDineroContacts() {
  const r = await dinero<{ Collection: DineroContact[] }>("/contacts?fields=Name,ContactGuid,VatNumber&pageSize=1000");
  return r.Collection;
}

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

async function ensureDineroContact(c: { name: string; cvr: string | null; email: string | null; phone: string | null; address: string | null }, existing?: DineroContact[]) {
  const list = existing ?? (await allDineroContacts());
  const hit = list.find((d) => (c.cvr && norm(d.VatNumber) === norm(c.cvr)) || norm(d.Name) === norm(c.name));
  if (hit) return { guid: hit.ContactGuid, created: false };
  const res = await dinero<{ ContactGuid: string }>("/contacts", {
    method: "POST",
    body: { Name: c.name, CountryKey: "DK", IsPerson: !c.cvr, VatNumber: c.cvr || undefined, Email: c.email || undefined, Phone: c.phone || undefined, Street: c.address || undefined },
  });
  list.push({ ContactGuid: res.ContactGuid, Name: c.name, VatNumber: c.cvr });
  return { guid: res.ContactGuid, created: true };
}

export const syncContactsToDinero = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ kind: z.enum(["customers", "suppliers"]) }).parse(d))
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("contacts").select("name, cvr, email, phone, address, type");
    q = data.kind === "suppliers" ? q.eq("type", "supplier") : q.neq("type", "supplier");
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const existing = await allDineroContacts();
    let created = 0;
    for (const c of rows ?? []) if ((await ensureDineroContact(c, existing)).created) created++;
    // Kontakter der kun findes i Dinero kopieres ind i appen.
    const known = new Set((rows ?? []).map((r) => norm(r.name)));
    const fresh = existing.filter((d) => !known.has(norm(d.Name)));
    let imported = 0;
    if (fresh.length > 0) {
      const { error: insErr } = await context.supabase.from("contacts").insert(
        fresh.map((d) => ({ name: d.Name, cvr: d.VatNumber, type: data.kind === "suppliers" ? "supplier" : "customer" })),
      );
      if (insErr) throw new Error(insErr.message);
      imported = fresh.length;
    }
    return { created, imported };
  });

// ---------- Fakturakladder ----------

export type InvoiceDraft = {
  id: string;
  contact_id: string | null;
  contact_name: string | null;
  description: string | null;
  invoice_date: string | null;
  amount_excl_vat: number;
  vat_amount: number;
  total_amount: number | null;
  status: string | null;
  dinero_invoice_id: string | null;
};

export const listInvoiceDrafts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<InvoiceDraft[]> => {
    const { data, error } = await context.supabase
      .from("invoices")
      .select("id, contact_id, description, invoice_date, amount_excl_vat, vat_amount, total_amount, status, dinero_invoice_id, contacts(name)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => {
      const { contacts, ...rest } = r as typeof r & { contacts: { name: string } | null };
      return { ...rest, amount_excl_vat: Number(rest.amount_excl_vat), vat_amount: Number(rest.vat_amount), total_amount: rest.total_amount != null ? Number(rest.total_amount) : null, contact_name: contacts?.name ?? null };
    });
  });

const draftInput = z.object({
  contact_id: z.string().uuid(),
  description: z.string().trim().min(1).max(500),
  invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount_excl_vat: z.number().finite().min(0).max(100_000_000),
});

export const createInvoiceDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => draftInput.parse(d))
  .handler(async ({ data, context }) => {
    const vat = Math.round(data.amount_excl_vat * 25) / 100;
    const { error } = await context.supabase.from("invoices").insert({
      ...data,
      vat_amount: vat,
      total_amount: data.amount_excl_vat + vat,
      status: "draft",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteInvoiceDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("invoices").delete().eq("id", data.id).is("dinero_invoice_id", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const exportInvoiceToDinero = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: inv, error } = await context.supabase
      .from("invoices")
      .select("id, description, invoice_date, amount_excl_vat, dinero_invoice_id, contacts(name, cvr, email, phone, address)")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    if (inv.dinero_invoice_id) throw new Error("Fakturaen er allerede sendt til Dinero.");
    const contact = (inv as unknown as { contacts: { name: string; cvr: string | null; email: string | null; phone: string | null; address: string | null } | null }).contacts;
    if (!contact) throw new Error("Vælg en kunde på fakturaen først.");
    const { guid } = await ensureDineroContact(contact);
    const res = await dinero<{ Guid: string }>("/invoices", {
      method: "POST",
      body: {
        ContactGuid: guid,
        Date: inv.invoice_date ?? new Date().toISOString().slice(0, 10),
        Currency: "DKK",
        Language: "da-DK",
        ShowLinesInclVat: false,
        ProductLines: [
          { Description: inv.description ?? "Faktura", Quantity: 1, AccountNumber: 1000, Unit: "parts", BaseAmountValue: Number(inv.amount_excl_vat) },
        ],
      },
    });
    const { error: upErr } = await context.supabase
      .from("invoices")
      .update({ dinero_invoice_id: res.Guid, status: "exported_to_dinero" })
      .eq("id", data.id);
    if (upErr) throw new Error(upErr.message);
    return { guid: res.Guid };
  });
