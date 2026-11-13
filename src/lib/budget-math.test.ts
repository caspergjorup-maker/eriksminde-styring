/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import type { BudgetLine, BudgetLoan } from "./budget.functions";
import { budgetMonthlySummary } from "./budget-math";

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
