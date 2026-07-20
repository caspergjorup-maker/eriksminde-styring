import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type LoanType = "annuity" | "interest_only" | "standing";

export type BudgetScenario = {
  id: string;
  name: string;
  year: number;
  notes: string | null;
  is_primary: boolean;
};

export type BudgetLine = {
  id: string;
  scenario_id: string;
  kind: "income" | "expense";
  category: string;
  label: string;
  annual_amount: number;
  monthly_override: number[] | null;
  source_note: string | null;
  sort_order: number;
};

export type BudgetLoan = {
  id: string;
  scenario_id: string;
  name: string;
  principal: number;
  interest_rate: number;
  term_months: number;
  loan_type: LoanType;
  start_date: string | null;
  notes: string | null;
  sort_order: number;
};

export type ScenarioBundle = {
  scenario: BudgetScenario;
  lines: BudgetLine[];
  loans: BudgetLoan[];
};

// ---------- Scenarios ----------

export const listScenarios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BudgetScenario[]> => {
    const { data, error } = await context.supabase
      .from("budget_scenarios")
      .select("id, name, year, notes, is_primary")
      .order("is_primary", { ascending: false })
      .order("year", { ascending: false })
      .order("name");
    if (error) throw new Error(error.message);
    return (data ?? []) as BudgetScenario[];
  });

export const getScenario = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<ScenarioBundle | null> => {
    const [sRes, lRes, loRes] = await Promise.all([
      context.supabase.from("budget_scenarios").select("id, name, year, notes, is_primary").eq("id", data.id).maybeSingle(),
      context.supabase.from("budget_lines").select("*").eq("scenario_id", data.id).order("sort_order").order("created_at"),
      context.supabase.from("budget_loans").select("*").eq("scenario_id", data.id).order("sort_order").order("created_at"),
    ]);
    if (sRes.error) throw new Error(sRes.error.message);
    if (!sRes.data) return null;
    if (lRes.error) throw new Error(lRes.error.message);
    if (loRes.error) throw new Error(loRes.error.message);
    return {
      scenario: sRes.data as BudgetScenario,
      lines: (lRes.data ?? []).map((r) => ({
        ...r,
        annual_amount: Number(r.annual_amount ?? 0),
        monthly_override: (r.monthly_override as number[] | null) ?? null,
      })) as BudgetLine[],
      loans: (loRes.data ?? []).map((r) => ({
        ...r,
        principal: Number(r.principal ?? 0),
        interest_rate: Number(r.interest_rate ?? 0),
        term_months: Number(r.term_months ?? 0),
      })) as BudgetLoan[],
    };
  });

const scenarioInput = z.object({
  name: z.string().trim().min(1).max(200),
  year: z.number().int().min(1900).max(3000),
  notes: z.string().trim().max(2000).nullable(),
});

export const createScenario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => scenarioInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: inserted, error } = await context.supabase
      .from("budget_scenarios")
      .insert(data)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id as string };
  });

export const updateScenario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).and(scenarioInput).parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { error } = await context.supabase.from("budget_scenarios").update(rest).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteScenario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("budget_scenarios").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setPrimaryScenario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const c1 = await context.supabase.from("budget_scenarios").update({ is_primary: false }).neq("id", data.id);
    if (c1.error) throw new Error(c1.error.message);
    const c2 = await context.supabase.from("budget_scenarios").update({ is_primary: true }).eq("id", data.id);
    if (c2.error) throw new Error(c2.error.message);
    return { ok: true };
  });

// ---------- Lines ----------

const lineInput = z.object({
  scenario_id: z.string().uuid(),
  kind: z.enum(["income", "expense"]),
  category: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(200),
  annual_amount: z.number().finite(),
  monthly_override: z.array(z.number().finite()).length(12).nullable(),
  source_note: z.string().trim().max(500).nullable(),
  sort_order: z.number().int().default(0),
});

export const createBudgetLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => lineInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("budget_lines").insert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateBudgetLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ id: z.string().uuid() })
      .and(lineInput.partial().omit({ scenario_id: true }))
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { error } = await context.supabase.from("budget_lines").update(rest).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteBudgetLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("budget_lines").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Loans ----------

const loanInput = z.object({
  scenario_id: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  principal: z.number().min(0),
  interest_rate: z.number().min(0).max(1),
  term_months: z.number().int().min(0).max(12 * 100),
  loan_type: z.enum(["annuity", "interest_only", "standing"]),
  start_date: z.string().nullable(),
  notes: z.string().trim().max(2000).nullable(),
  sort_order: z.number().int().default(0),
});

export const createLoan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => loanInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("budget_loans").insert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateLoan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ id: z.string().uuid() })
      .and(loanInput.partial().omit({ scenario_id: true }))
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { error } = await context.supabase.from("budget_loans").update(rest).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteLoan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("budget_loans").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
