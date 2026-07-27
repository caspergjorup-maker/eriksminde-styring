import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildAmortization } from "@/lib/loan-math";

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

// ---------- Ét budget pr. år ----------

export const listBudgetYears = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<number[]> => {
    const { data, error } = await context.supabase
      .from("budget_scenarios")
      .select("year")
      .order("year", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => r.year as number);
  });

export const getBudgetByYear = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ year: z.number().int() }).parse(d))
  .handler(async ({ data, context }): Promise<ScenarioBundle | null> => {
    const sRes = await context.supabase
      .from("budget_scenarios")
      .select("id, name, year, notes, is_primary")
      .eq("year", data.year)
      .maybeSingle();
    if (sRes.error) throw new Error(sRes.error.message);
    if (!sRes.data) return null;
    const id = sRes.data.id as string;
    const [lRes, loRes] = await Promise.all([
      context.supabase.from("budget_lines").select("*").eq("scenario_id", id).order("sort_order").order("created_at"),
      context.supabase.from("budget_loans").select("*").eq("scenario_id", id).order("sort_order").order("created_at"),
    ]);
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

export const copyBudgetToYear = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        fromYear: z.number().int(),
        toYear: z.number().int().min(1900).max(3000),
        adjustPct: z.number().min(-100).max(1000).default(0),
        rollForwardLoans: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const src = await context.supabase
      .from("budget_scenarios")
      .select("id, notes")
      .eq("year", data.fromYear)
      .maybeSingle();
    if (src.error) throw new Error(src.error.message);
    if (!src.data) throw new Error(`Der findes intet budget for ${data.fromYear}`);

    const exists = await context.supabase
      .from("budget_scenarios")
      .select("id")
      .eq("year", data.toYear)
      .maybeSingle();
    if (exists.error) throw new Error(exists.error.message);
    if (exists.data) throw new Error(`Der findes allerede et budget for ${data.toYear}`);

    const created = await context.supabase
      .from("budget_scenarios")
      .insert({ name: `Budget ${data.toYear}`, year: data.toYear, notes: src.data.notes, is_primary: false })
      .select("id")
      .single();
    if (created.error) throw new Error(created.error.message);
    const newId = created.data.id as string;

    const factor = 1 + data.adjustPct / 100;

    const [lRes, loRes] = await Promise.all([
      context.supabase.from("budget_lines").select("*").eq("scenario_id", src.data.id),
      context.supabase.from("budget_loans").select("*").eq("scenario_id", src.data.id),
    ]);
    if (lRes.error) throw new Error(lRes.error.message);
    if (loRes.error) throw new Error(loRes.error.message);

    const newLines = (lRes.data ?? []).map((r) => ({
      scenario_id: newId,
      kind: r.kind,
      category: r.category,
      label: r.label,
      annual_amount: Math.round(Number(r.annual_amount ?? 0) * factor),
      monthly_override: Array.isArray(r.monthly_override)
        ? (r.monthly_override as number[]).map((v) => Math.round(Number(v) * factor))
        : null,
      source_note: [r.source_note, `Kopieret fra ${data.fromYear}`].filter(Boolean).join(" · ").slice(0, 500),
      sort_order: r.sort_order ?? 0,
    }));
    if (newLines.length > 0) {
      const ins = await context.supabase.from("budget_lines").insert(newLines);
      if (ins.error) throw new Error(ins.error.message);
    }

    const newLoans = (loRes.data ?? []).map((r) => {
      const loan: BudgetLoan = {
        id: r.id as string,
        scenario_id: newId,
        name: r.name as string,
        principal: Number(r.principal ?? 0),
        interest_rate: Number(r.interest_rate ?? 0),
        term_months: Number(r.term_months ?? 0),
        loan_type: r.loan_type as LoanType,
        start_date: (r.start_date as string | null) ?? null,
        notes: (r.notes as string | null) ?? null,
        sort_order: (r.sort_order as number) ?? 0,
      };
      if (!data.rollForwardLoans) {
        return {
          scenario_id: newId,
          name: loan.name,
          principal: loan.principal,
          interest_rate: loan.interest_rate,
          term_months: loan.term_months,
          loan_type: loan.loan_type,
          start_date: loan.start_date,
          notes: loan.notes,
          sort_order: loan.sort_order,
        };
      }
      const rows = buildAmortization(loan);
      const remaining = rows.length > 0 ? Math.round(rows[0].balance) : loan.principal;
      const start = loan.start_date ? new Date(loan.start_date) : null;
      if (start) start.setFullYear(start.getFullYear() + 1);
      return {
        scenario_id: newId,
        name: loan.name,
        principal: remaining,
        interest_rate: loan.interest_rate,
        term_months: Math.max(0, loan.term_months - 12),
        loan_type: loan.loan_type,
        start_date: start ? start.toISOString().slice(0, 10) : null,
        notes: [loan.notes, `Restgæld videreført fra ${data.fromYear}`].filter(Boolean).join(" · ").slice(0, 2000),
        sort_order: loan.sort_order,
      };
    });
    if (newLoans.length > 0) {
      const ins = await context.supabase.from("budget_loans").insert(newLoans);
      if (ins.error) throw new Error(ins.error.message);
    }

    return { id: newId, year: data.toYear };
  });

export const deleteBudgetYear = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ year: z.number().int() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("budget_scenarios").delete().eq("year", data.year);
    if (error) throw new Error(error.message);
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
