/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import type { BudgetLine, BudgetLoan } from "./budget.functions";
import { budgetMonthlySummary, loanMonthly } from "./budget-math";

const baseLine: BudgetLine = {
  id: "line",
  scenario_id: "scenario",
  kind: "income",
  category: "test",
  label: "Test",
  annual_amount: 0,
  monthly_override: null,
  source_note: null,
  sort_order: 0,
};

const loan: BudgetLoan = {
  id: "loan",
  scenario_id: "scenario",
  name: "Testlån",
  principal: 0,
  interest_rate: 0,
  term_months: 0,
  loan_type: "standing",
  start_date: null,
  notes: null,
  sort_order: 0,
  monthly_payment: 1000,
};

describe("Månedligt budget til MCP-overblikket", () => {
  test("2026 viser kun resultat i november og december", () => {
    const activeMonths = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1];
    const lines: BudgetLine[] = [
      {
        ...baseLine,
        id: "income",
        kind: "income",
        monthly_override: activeMonths.map((active) => active * 10000),
      },
      {
        ...baseLine,
        id: "expense",
        kind: "expense",
        monthly_override: activeMonths.map((active) => active * 500),
      },
    ];
    const monthly = budgetMonthlySummary(2026, lines, [loan]);
    expect(monthly[0]).toMatchObject({ income: 0, expenses: 0, loan_payments: 0, result: 0 });
    expect(monthly[10]).toMatchObject({
      income: 10000,
      expenses: 500,
      loan_payments: 1000,
      result: 8500,
    });
    expect(monthly[11]).toMatchObject({
      income: 10000,
      expenses: 500,
      loan_payments: 1000,
      result: 8500,
    });
    expect(monthly.reduce((sum, month) => sum + month.result, 0)).toBe(17000);
  });
});

describe("kvartalsvise låneterminer", () => {
  const dlr = {
    id: "dlr", scenario_id: "s", name: "DLR", principal: 6422000, interest_rate: 0, term_months: 360,
    loan_type: "standing", start_date: "2026-11-01", notes: null, sort_order: 0,
    monthly_payment: 37595, payment_frequency: "quarterly",
  } as BudgetLoan;
  test("2026: kun december betales", () => {
    expect(loanMonthly(dlr, 2026, 10)).toBe(0);
    expect(loanMonthly(dlr, 2026, 11)).toBe(37595);
  });
  test("2027: mar, jun, sep, dec = 150.380 kr.", () => {
    const months = Array.from({ length: 12 }, (_, m) => loanMonthly(dlr, 2027, m));
    expect(months.filter((v) => v > 0).length).toBe(4);
    expect(months[2]).toBe(37595);
    expect(months.reduce((a, b) => a + b, 0)).toBe(150380);
  });
});
