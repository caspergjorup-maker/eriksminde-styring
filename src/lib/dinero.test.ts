import { describe, expect, test } from "bun:test";
import { summarizeEntries } from "./dinero.server";

describe("summarizeEntries", () => {
  test("revenue (negative on P&L) counts as income, costs as expense, balance accounts ignored", () => {
    const r = summarizeEntries(
      [
        { AccountNumber: 1050, AccountName: "Salg", Date: "2026-11-05", Description: "", Amount: -10000 },
        { AccountNumber: 7220, AccountName: "Gebyr", Date: "2026-10-14", Description: "", Amount: 150 },
        { AccountNumber: 55000, AccountName: "Bank", Date: "2026-10-14", Description: "", Amount: -150 },
      ],
      [55000],
    );
    expect(r.income[10]).toBe(10000);
    expect(r.expense[9]).toBe(150);
    expect(r.expense[10]).toBe(0);
    expect(r.bank).toBe(-150);
  });
});
