import type { BudgetLine, BudgetLoan } from "./budget.functions";
import { calcLoan } from "./loan-math";

export const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Maj",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Okt",
  "Nov",
  "Dec",
];

export function lineMonthly(line: BudgetLine, month: number): number {
  return line.monthly_override ? (line.monthly_override[month] ?? 0) : line.annual_amount / 12;
}

/** Månedlig ydelse for et lån i en given måned af året — 0 før startdato og efter løbetidens udløb. */
export function loanMonthly(loan: BudgetLoan, year: number, month: number): number {
  // Ejerskabet starter 1. november 2026, uanset lånets startdato.
  if (year === 2026 && month < 10) return 0;
  const { monthlyPayment } = calcLoan(loan);
  if (monthlyPayment <= 0) return 0;
  if (loan.start_date) {
    const start = new Date(loan.start_date);
    const startIndex = start.getFullYear() * 12 + start.getMonth();
    const index = year * 12 + month;
    if (index < startIndex) return 0;
    if (loan.term_months > 0 && index >= startIndex + loan.term_months) return 0;
  }
  // Kvartalsvise terminer forfalder i marts, juni, september og december.
  if (loan.payment_frequency === "quarterly" && month % 3 !== 2) return 0;
  return monthlyPayment;
}

/** Netto cashflow pr. måned for et budgetår. */
/** Kapital & etablering (indskud, købsomkostninger) pr. måned fra bankposter — påvirker likviditet, ikke drift. */
export function capitalByMonth(
  year: number,
  txs: { booked_date: string; amount: number; kind: string | null }[],
): number[] {
  const out = MONTHS.map(() => 0);
  for (const t of txs) {
    if (t.kind !== "capital" || !t.booked_date.startsWith(`${year}-`)) continue;
    const m = Number(t.booked_date.slice(5, 7)) - 1;
    if (m >= 0 && m < 12) out[m] = (out[m] ?? 0) + t.amount;
  }
  return out;
}

export function monthlyNet(
  year: number,
  lines: BudgetLine[],
  loans: BudgetLoan[],
  capital: number[] = [],
): number[] {
  return MONTHS.map((_, month) => {
    const income = lines
      .filter((line) => line.kind === "income")
      .reduce((sum, line) => sum + lineMonthly(line, month), 0);
    const expenses = lines
      .filter((line) => line.kind !== "income")
      .reduce((sum, line) => sum + lineMonthly(line, month), 0);
    const loanPayments = loans.reduce((sum, loan) => sum + loanMonthly(loan, year, month), 0);
    return income - expenses - loanPayments + (capital[month] ?? 0);
  });
}

export function budgetMonthlySummary(year: number, lines: BudgetLine[], loans: BudgetLoan[]) {
  return MONTHS.map((monthName, month) => {
    const income = lines
      .filter((line) => line.kind === "income")
      .reduce((sum, line) => sum + lineMonthly(line, month), 0);
    const expenses = lines
      .filter((line) => line.kind !== "income")
      .reduce((sum, line) => sum + lineMonthly(line, month), 0);
    const loanPayments = loans.reduce((sum, loan) => sum + loanMonthly(loan, year, month), 0);
    return {
      month: month + 1,
      month_name: monthName,
      income,
      expenses,
      loan_payments: loanPayments,
      result: income - expenses - loanPayments,
    };
  });
}
