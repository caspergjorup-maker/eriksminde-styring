import { useState } from "react";
import { Wallet } from "lucide-react";

import type { BudgetLine, BudgetLoan } from "@/lib/budget.functions";
import { calcLoan } from "@/lib/loan-math";
import { formatDKK } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"];

function lineMonthly(l: BudgetLine, m: number): number {
  return l.monthly_override ? (l.monthly_override[m] ?? 0) : l.annual_amount / 12;
}

/** Månedlig ydelse for et lån i en given måned af året — 0 før startdato og efter løbetidens udløb. */
function loanMonthly(loan: BudgetLoan, year: number, m: number): number {
  const { monthlyPayment } = calcLoan(loan);
  if (monthlyPayment <= 0) return 0;
  if (loan.start_date) {
    const start = new Date(loan.start_date);
    const startIdx = start.getFullYear() * 12 + start.getMonth();
    const idx = year * 12 + m;
    if (idx < startIdx) return 0;
    if (loan.term_months > 0 && idx >= startIdx + loan.term_months) return 0;
  }
  return monthlyPayment;
}

function OpeningBalance({ value, onCommit }: { value: number; onCommit: (n: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const commit = () => {
    setEditing(false);
    const cleaned = text.replace(/\s|kr\.?/gi, "").replace(/\./g, "").replace(",", ".");
    const n = cleaned === "" || cleaned === "-" ? 0 : Number(cleaned);
    if (Number.isFinite(n) && Math.round(n) !== Math.round(value)) onCommit(Math.round(n));
  };
  if (editing) {
    return (
      <input
        autoFocus
        inputMode="decimal"
        className="w-32 text-right tabular-nums bg-background border border-[var(--brand-500)] rounded px-1.5 py-0.5 outline-none"
        value={text}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") setEditing(false);
        }}
      />
    );
  }
  return (
    <button
      type="button"
      title="Klik for at rette startbeløbet"
      className="text-right tabular-nums font-semibold rounded px-1.5 py-0.5 cursor-text hover:bg-muted hover:ring-1 hover:ring-border"
      onClick={() => { setText(String(Math.round(value))); setEditing(true); }}
    >
      {formatDKK(value)}
    </button>
  );
}

export function BudgetLiquidity({
  year,
  incomes,
  expenses,
  loans,
}: {
  year: number;
  incomes: BudgetLine[];
  expenses: BudgetLine[];
  loans: BudgetLoan[];
}) {
  const [opening, setOpening] = useState(0);

  const inc = MONTHS.map((_, m) => incomes.reduce((s, l) => s + lineMonthly(l, m), 0));
  const exp = MONTHS.map((_, m) => expenses.reduce((s, l) => s + lineMonthly(l, m), 0));
  const loan = MONTHS.map((_, m) => loans.reduce((s, l) => s + loanMonthly(l, year, m), 0));
  const net = MONTHS.map((_, m) => inc[m] - exp[m] - loan[m]);

  const cum: number[] = [];
  let run = opening;
  net.forEach((n) => { run += n; cum.push(run); });

  const maxAbs = Math.max(1, ...net.map((n) => Math.abs(n)));
  const lowest = Math.min(...cum);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between gap-4 p-4 pb-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-[var(--brand-900)]">Likviditet — penge ind og ud måned for måned</h2>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Startbeløb 1. jan {year}:</span>
          <OpeningBalance value={opening} onCommit={setOpening} />
        </div>
      </div>

      {/* Mini søjlediagram over netto cashflow */}
      <div className="px-4 pt-2">
        <div className="grid grid-cols-12 gap-1 items-end h-24 border-b border-border">
          {net.map((n, m) => (
            <div key={m} className="flex flex-col items-center justify-end h-full gap-0.5" title={`${MONTHS[m]}: ${formatDKK(n)}`}>
              <div
                className={`w-full max-w-10 rounded-sm ${n >= 0 ? "bg-emerald-500/70" : "bg-red-500/70"}`}
                style={{ height: `${Math.max(2, (Math.abs(n) / maxAbs) * 100)}%` }}
              />
              <span className="text-[10px] text-muted-foreground">{MONTHS[m]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-44"></TableHead>
              {MONTHS.map((m) => <TableHead key={m} className="text-right">{m}</TableHead>)}
              <TableHead className="text-right font-semibold">I alt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">Indtægter</TableCell>
              {inc.map((v, m) => (
                <TableCell key={m} className="text-right tabular-nums text-sm text-emerald-700">{v ? formatDKK(v) : "—"}</TableCell>
              ))}
              <TableCell className="text-right tabular-nums text-sm font-semibold text-emerald-700">{formatDKK(inc.reduce((s, x) => s + x, 0))}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Driftsudgifter</TableCell>
              {exp.map((v, m) => (
                <TableCell key={m} className="text-right tabular-nums text-sm text-red-700">{v ? `−${formatDKK(v)}` : "—"}</TableCell>
              ))}
              <TableCell className="text-right tabular-nums text-sm font-semibold text-red-700">−{formatDKK(exp.reduce((s, x) => s + x, 0))}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Låneydelser</TableCell>
              {loan.map((v, m) => (
                <TableCell key={m} className="text-right tabular-nums text-sm text-red-700">{v ? `−${formatDKK(v)}` : "—"}</TableCell>
              ))}
              <TableCell className="text-right tabular-nums text-sm font-semibold text-red-700">−{formatDKK(loan.reduce((s, x) => s + x, 0))}</TableCell>
            </TableRow>
            <TableRow className="border-t-2 border-border">
              <TableCell className="font-semibold">Netto cashflow</TableCell>
              {net.map((v, m) => (
                <TableCell key={m} className={`text-right tabular-nums text-sm font-medium ${v >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                  {formatDKK(v)}
                </TableCell>
              ))}
              <TableCell className={`text-right tabular-nums text-sm font-bold ${net.reduce((s, x) => s + x, 0) >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                {formatDKK(net.reduce((s, x) => s + x, 0))}
              </TableCell>
            </TableRow>
            <TableRow className="bg-muted/40">
              <TableCell className="font-semibold">Likviditet (akkumuleret)</TableCell>
              {cum.map((v, m) => (
                <TableCell
                  key={m}
                  className={`text-right tabular-nums text-sm font-semibold ${v < 0 ? "text-red-700 bg-red-50" : "text-[var(--brand-900)]"}`}
                >
                  {formatDKK(v)}
                </TableCell>
              ))}
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {lowest < 0 && (
        <div className="px-4 py-3 text-sm text-red-700 bg-red-50 border-t border-red-200">
          Bemærk: Likviditeten går i minus i løbet af året (laveste punkt {formatDKK(lowest)}). Overvej at flytte udgifter eller aftale kredit.
        </div>
      )}
    </div>
  );
}
