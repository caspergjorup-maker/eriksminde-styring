import { useState } from "react";
import { Wallet } from "lucide-react";

import type { BudgetLine, BudgetLoan } from "@/lib/budget.functions";
import { formatDKK } from "@/lib/format";
import { lineMonthly, loanMonthly, MONTHS } from "@/lib/budget-math";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function OpeningBalance({
  value,
  onCommit,
}: {
  value: number;
  onCommit: (n: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const commit = () => {
    setEditing(false);
    const cleaned = text
      .replace(/\s|kr\.?/gi, "")
      .replace(/\./g, "")
      .replace(",", ".");
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
      onClick={() => {
        setText(String(Math.round(value)));
        setEditing(true);
      }}
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
  opening: props_opening,
  onOpeningChange,
}: {
  year: number;
  incomes: BudgetLine[];
  expenses: BudgetLine[];
  loans: BudgetLoan[];
  opening?: number;
  onOpeningChange?: (n: number) => void;
}) {
  const [localOpening, setLocalOpening] = useState(0);
  const opening = props_opening ?? localOpening;
  const setOpening = onOpeningChange ?? setLocalOpening;

  const inc = MONTHS.map((_, m) => incomes.reduce((s, l) => s + lineMonthly(l, m), 0));
  const exp = MONTHS.map((_, m) => expenses.reduce((s, l) => s + lineMonthly(l, m), 0));
  const loan = MONTHS.map((_, m) => loans.reduce((s, l) => s + loanMonthly(l, year, m), 0));
  const net = MONTHS.map((_, m) => inc[m] - exp[m] - loan[m]);

  const cum: number[] = [];
  let run = opening;
  net.forEach((n) => {
    run += n;
    cum.push(run);
  });

  const maxAbs = Math.max(1, ...net.map((n) => Math.abs(n)));
  const lowest = Math.min(...cum);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between gap-4 p-4 pb-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-[var(--brand-900)]">
            Likviditet — penge ind og ud måned for måned
          </h2>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Startbeløb 1. jan {year}:</span>
          <OpeningBalance value={opening} onCommit={setOpening} />
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            {/* The bars share the table's actual month columns, including horizontal scrolling. */}
            <TableRow className="hover:bg-transparent">
              <TableHead />
              {net.map((n, m) => (
                <TableHead
                  key={m}
                  className="h-28 align-bottom pb-0 pt-3"
                  aria-label={`${MONTHS[m]} netto cashflow: ${formatDKK(n)}`}
                >
                  <div
                    className="flex h-24 items-end justify-end"
                    title={`${MONTHS[m]}: ${formatDKK(n)}`}
                  >
                    <div
                      className={`w-10 max-w-full rounded-t-sm ${n >= 0 ? "bg-success/70" : "bg-destructive/70"}`}
                      style={{ height: `${Math.max(2, (Math.abs(n) / maxAbs) * 100)}%` }}
                    />
                  </div>
                </TableHead>
              ))}
              <TableHead />
            </TableRow>
            <TableRow>
              <TableHead className="min-w-44"></TableHead>
              {MONTHS.map((m) => (
                <TableHead key={m} className="text-right">
                  {m}
                </TableHead>
              ))}
              <TableHead className="text-right font-semibold">I alt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">Indtægter</TableCell>
              {inc.map((v, m) => (
                <TableCell key={m} className="text-right tabular-nums text-sm text-emerald-700">
                  {v ? formatDKK(v) : "—"}
                </TableCell>
              ))}
              <TableCell className="text-right tabular-nums text-sm font-semibold text-emerald-700">
                {formatDKK(inc.reduce((s, x) => s + x, 0))}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Driftsudgifter</TableCell>
              {exp.map((v, m) => (
                <TableCell key={m} className="text-right tabular-nums text-sm text-red-700">
                  {v ? `−${formatDKK(v)}` : "—"}
                </TableCell>
              ))}
              <TableCell className="text-right tabular-nums text-sm font-semibold text-red-700">
                −{formatDKK(exp.reduce((s, x) => s + x, 0))}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Låneydelser</TableCell>
              {loan.map((v, m) => (
                <TableCell key={m} className="text-right tabular-nums text-sm text-red-700">
                  {v ? `−${formatDKK(v)}` : "—"}
                </TableCell>
              ))}
              <TableCell className="text-right tabular-nums text-sm font-semibold text-red-700">
                −{formatDKK(loan.reduce((s, x) => s + x, 0))}
              </TableCell>
            </TableRow>
            <TableRow className="border-t-2 border-border">
              <TableCell className="font-semibold">Netto cashflow</TableCell>
              {net.map((v, m) => (
                <TableCell
                  key={m}
                  className={`text-right tabular-nums text-sm font-medium ${v >= 0 ? "text-emerald-700" : "text-red-700"}`}
                >
                  {formatDKK(v)}
                </TableCell>
              ))}
              <TableCell
                className={`text-right tabular-nums text-sm font-bold ${net.reduce((s, x) => s + x, 0) >= 0 ? "text-emerald-700" : "text-red-700"}`}
              >
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
          Bemærk: Likviditeten går i minus i løbet af året (laveste punkt {formatDKK(lowest)}).
          Overvej at flytte udgifter eller aftale kredit.
        </div>
      )}
    </div>
  );
}
