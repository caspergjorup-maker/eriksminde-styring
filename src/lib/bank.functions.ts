import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { bankPattern, matchRule, parseBankCsv, type BankKind, type BankRule } from "@/lib/bank-csv";

export type BankTx = {
  id: string; booked_date: string; text: string; amount: number; balance: number | null;
  kind: BankKind | null; category: string | null;
};

export const importBankCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ csv: z.string().min(1).max(2_000_000) }).parse(d))
  .handler(async ({ data, context }) => {
    const rows = parseBankCsv(data.csv);
    if (rows.length === 0) throw new Error("Filen indeholder ingen genkendelige posteringer");
    const rulesRes = await context.supabase.from("bank_rules").select("pattern, kind, category");
    if (rulesRes.error) throw new Error(rulesRes.error.message);
    const rules = (rulesRes.data ?? []) as BankRule[];
    const ins = rows.map((r) => {
      const m = matchRule(r.text, rules);
      return { ...r, kind: m?.kind ?? null, category: m?.category ?? null };
    });
    const res = await context.supabase.from("bank_transactions")
      .upsert(ins, { onConflict: "dedupe_key", ignoreDuplicates: true }).select("id, kind");
    if (res.error) throw new Error(res.error.message);
    const added = res.data ?? [];
    return { total: rows.length, added: added.length, unknown: added.filter((r) => !r.kind).length };
  });

export const listBankTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BankTx[]> => {
    const { data, error } = await context.supabase.from("bank_transactions")
      .select("id, booked_date, text, amount, balance, kind, category, created_at")
      .order("booked_date", { ascending: false }).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      id: r.id, booked_date: r.booked_date, text: r.text, amount: Number(r.amount),
      balance: r.balance != null ? Number(r.balance) : null,
      kind: (r.kind as BankKind | null) ?? null, category: r.category ?? null,
    }));
  });

export const categorizeBankTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    kind: z.enum(["income", "expense", "capital"]),
    category: z.string().trim().min(1).max(80),
    remember: z.boolean().default(true),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const tx = await context.supabase.from("bank_transactions").select("text").eq("id", data.id).single();
    if (tx.error) throw new Error(tx.error.message);
    const up = await context.supabase.from("bank_transactions")
      .update({ kind: data.kind, category: data.category }).eq("id", data.id);
    if (up.error) throw new Error(up.error.message);
    let alsoUpdated = 0;
    if (data.remember) {
      const pattern = bankPattern(tx.data.text);
      if (pattern) {
        const r = await context.supabase.from("bank_rules")
          .upsert({ pattern, kind: data.kind, category: data.category }, { onConflict: "pattern" });
        if (r.error) throw new Error(r.error.message);
        // Anvend reglen på andre ukategoriserede poster med samme tekst.
        const open = await context.supabase.from("bank_transactions").select("id, text").is("kind", null);
        if (open.error) throw new Error(open.error.message);
        const ids = (open.data ?? []).filter((o) => bankPattern(o.text).includes(pattern)).map((o) => o.id);
        if (ids.length) {
          const u = await context.supabase.from("bank_transactions")
            .update({ kind: data.kind, category: data.category }).in("id", ids);
          if (u.error) throw new Error(u.error.message);
          alsoUpdated = ids.length;
        }
      }
    }
    return { ok: true, alsoUpdated };
  });
