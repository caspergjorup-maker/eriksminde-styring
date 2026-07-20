import type { BudgetLoan } from "./budget.functions";

export type LoanCalc = {
  annualPayment: number;
  monthlyPayment: number;
  totalInterest: number;
  totalPaid: number;
};

export type AmortizationYear = {
  year: number;
  payment: number;
  interest: number;
  principal: number;
  balance: number;
};

export function calcLoan(loan: BudgetLoan): LoanCalc {
  const P = loan.principal;
  const r = loan.interest_rate; // annual decimal
  const n = loan.term_months;
  if (P <= 0) return { annualPayment: 0, monthlyPayment: 0, totalInterest: 0, totalPaid: 0 };

  if (loan.loan_type === "annuity") {
    if (r === 0) {
      const monthly = n > 0 ? P / n : 0;
      return { monthlyPayment: monthly, annualPayment: monthly * 12, totalInterest: 0, totalPaid: P };
    }
    const mr = r / 12;
    const monthly = n > 0 ? (P * mr) / (1 - Math.pow(1 + mr, -n)) : 0;
    const totalPaid = monthly * n;
    return {
      monthlyPayment: monthly,
      annualPayment: monthly * 12,
      totalInterest: totalPaid - P,
      totalPaid,
    };
  }

  if (loan.loan_type === "interest_only") {
    const annual = P * r;
    return {
      monthlyPayment: annual / 12,
      annualPayment: annual,
      totalInterest: annual * (n / 12),
      totalPaid: P + annual * (n / 12),
    };
  }

  // standing (rente- og afdragsfrit) — 0 løbende ydelse
  return { annualPayment: 0, monthlyPayment: 0, totalInterest: 0, totalPaid: P };
}

export function buildAmortization(loan: BudgetLoan): AmortizationYear[] {
  const { annualPayment } = calcLoan(loan);
  const years = Math.ceil(loan.term_months / 12);
  if (years <= 0 || loan.principal <= 0) return [];

  let balance = loan.principal;
  const rows: AmortizationYear[] = [];
  const startYear = loan.start_date ? new Date(loan.start_date).getFullYear() : new Date().getFullYear();

  if (loan.loan_type === "annuity") {
    const mr = loan.interest_rate / 12;
    const monthly = annualPayment / 12;
    for (let y = 0; y < years; y++) {
      let interestYear = 0;
      let principalYear = 0;
      for (let m = 0; m < 12; m++) {
        if (balance <= 0.01) break;
        const interestMonth = balance * mr;
        const principalMonth = Math.min(monthly - interestMonth, balance);
        interestYear += interestMonth;
        principalYear += principalMonth;
        balance -= principalMonth;
      }
      rows.push({
        year: startYear + y,
        payment: interestYear + principalYear,
        interest: interestYear,
        principal: principalYear,
        balance: Math.max(0, balance),
      });
    }
  } else if (loan.loan_type === "interest_only") {
    for (let y = 0; y < years; y++) {
      const interest = balance * loan.interest_rate;
      const principalYear = y === years - 1 ? balance : 0;
      balance -= principalYear;
      rows.push({
        year: startYear + y,
        payment: interest + principalYear,
        interest,
        principal: principalYear,
        balance: Math.max(0, balance),
      });
    }
  } else {
    for (let y = 0; y < years; y++) {
      const principalYear = y === years - 1 ? balance : 0;
      balance -= principalYear;
      rows.push({
        year: startYear + y,
        payment: principalYear,
        interest: 0,
        principal: principalYear,
        balance: Math.max(0, balance),
      });
    }
  }

  return rows;
}
