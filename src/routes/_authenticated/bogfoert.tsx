import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getBudgetByYear } from "@/lib/budget.functions";
import { getDineroYear } from "@/lib/dinero.functions";
import { LIQ_MONTHS, lineMonthly, loanMonthly } from "@/components/budget-liquidity";
import { formatDKK } from "@/lib/format";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/bogfoert")({
  head: () => ({
    meta: [
      { title: "Budget vs. bogført — Eriksminde" },
      { name: "description", content: "Sammenlign budgettet med de bogførte tal fra Dinero måned for måned." },
      { property: "og:title", content: "Budget vs. bogført — Eriksminde" },
      { property: "og:description", content: "Sammenlign budgettet med de bogførte tal fra Dinero måned for måned." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const [year, setYear] = useState(new Date().getFullYear());
  const getBudget = useServerFn(getBudgetByYear);
  const getActual = useServerFn(getDineroYear);
  const budget = useQuery({ queryKey: ["budget", year], queryFn: () => getBudget({ data: { year } }) });
  const actual = useQuery({ queryKey: ["dinero-year", year], queryFn: () => getActual({ data: { year } }) });

  const b = budget.data;
  const bIncome = LIQ_MONTHS.map((_, m) => (b?.lines ?? []).filter((l) => l.kind === "income").reduce((s, l) => s + lineMonthly(l, m), 0));
  const bExpense = LIQ_MONTHS.map((_, m) =>
    (b?.lines ?? []).filter((l) => l.kind === "expense").reduce((s, l) => s + lineMonthly(l, m), 0) +
    (b?.loans ?? []).reduce((s, l) => s + loanMonthly(l, year, m), 0),
  );
  const a = actual.data;
  const rows: { label: string; v: number[]; strong?: boolean; diff?: boolean }[] = [
    { label: "Budget – indtægter", v: bIncome },
    { label: "Bogført – indtægter", v: a?.income ?? [] , strong: true },
    { label: "Afvigelse", v: bIncome.map((x, m) => (a?.income[m] ?? 0) - x), diff: true },
    { label: "Budget – udgifter inkl. lån", v: bExpense },
    { label: "Bogført – udgifter", v: a?.expense ?? [], strong: true },
    { label: "Afvigelse", v: bExpense.map((x, m) => x - (a?.expense[m] ?? 0)), diff: true },
  ];

  return (
    <div className="px-6 py-6 w-full mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--brand-900)]">Budget vs. bogført</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Bogførte tal hentes direkte fra Dinero{a ? ` (${a.orgName})` : ""}. Afvigelse er grøn når det går bedre end budgettet.
          </p>
        </div>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>{[2026, 2027, 2028].map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {actual.error && <p className="text-sm text-destructive">{(actual.error as Error).message}</p>}
      {(budget.isLoading || actual.isLoading) && <p className="text-sm text-muted-foreground">Henter tal…</p>}
      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left w-56"></th>
              {LIQ_MONTHS.map((m) => <th key={m} className="px-3 py-2 text-right">{m}</th>)}
              <th className="px-3 py-2 text-right">I alt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r, i) => {
              const total = r.v.reduce((s, x) => s + (x ?? 0), 0);
              const cls = (x: number) => (r.diff ? (x > 0 ? "text-brand-700" : x < 0 ? "text-destructive" : "") : "");
              return (
                <tr key={i} className={r.diff ? "bg-muted/20" : ""}>
                  <td className={`px-3 py-2 ${r.strong ? "font-medium" : r.diff ? "text-muted-foreground" : ""}`}>{r.label}</td>
                  {LIQ_MONTHS.map((_, m) => <td key={m} className={`px-3 py-2 text-right ${cls(r.v[m] ?? 0)}`}>{r.v[m] ? formatDKK(Math.round(r.v[m])) : "—"}</td>)}
                  <td className={`px-3 py-2 text-right font-medium ${cls(total)}`}>{formatDKK(Math.round(total))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
