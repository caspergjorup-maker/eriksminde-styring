/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import type { BudgetLoan } from "../lib/budget.functions";
import { loanMonthly, monthlyNet } from "./budget-liquidity";

const loan: BudgetLoan = {
  id: "test", scenario_id: "test", name: "Testlån", monthly_payment: 1000,
  principal: 0, interest_rate: 0, term_months: 0, loan_type: "standing",
  start_date: null, notes: null, sort_order: 0,
};

describe("Låneydelser efter overtagelse 1. november 2026", () => {
  test("2026 tæller kun november og december, også uden startdato", () => {
    for (const start_date of [null, "2026-01-01", "2026-11-01"]) {
      const payments = Array.from({ length: 12 }, (_, m) => loanMonthly({ ...loan, start_date }, 2026, m));
      expect(payments).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1000, 1000]);
      expect(payments.reduce((sum, payment) => sum + payment, 0)).toBe(2000);
      expect(monthlyNet(2026, [], [{ ...loan, start_date }])).toEqual(payments.map((v) => 0 - v));
    }
  });

  test("2027 tæller alle 12 måneder", () => {
    const payments = Array.from({ length: 12 }, (_, m) => loanMonthly(loan, 2027, m));
    expect(payments).toEqual(Array(12).fill(1000));
    expect(payments.reduce((sum, payment) => sum + payment, 0)).toBe(12000);
  });

  test("en senere startdato og lånets udløb respekteres fortsat", () => {
    const payments = Array.from({ length: 12 }, (_, m) => loanMonthly({ ...loan, start_date: "2026-12-01", term_months: 1 }, 2026, m));
    expect(payments).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1000]);
    expect(loanMonthly({ ...loan, start_date: "2026-12-01", term_months: 1 }, 2027, 0)).toBe(0);
  });
});