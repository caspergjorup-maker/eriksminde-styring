import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { getBudgetByYear, listBudgetYears } from "@/lib/budget.functions";
import { BudgetLiquidity, LIQ_MONTHS, OpeningBalance, monthlyNet } from "@/components/budget-liquidity";
import { formatDKK } from "@/lib/format";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/likviditet")({
  head: () => ({
    meta: [
      { title: "Likviditet — Eriksminde" },
      { name: "description", content: "Likviditet måned for måned på tværs af alle budgetår." },
      { property: "og:title", content: "Likviditet — Eriksminde" },
      { property: "og:description", content: "Likviditet måned for måned på tværs af alle budgetår." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LiquidityPage,
});

function LiquidityPage() {
  const listYears = useServerFn(listBudgetYears);
  const getBudget = useServerFn(getBudgetByYear);
  const yearsQ = useQuery({ queryKey: ["budget-years"], queryFn: () => listYears() });
  const years = [...(yearsQ.data ?? [])].sort((a, b) => a - b);

  const bundles = useQueries({
    queries: years.map((y) => ({
      queryKey: ["budget", y],
      queryFn: () => getBudget({ data: { year: y } }),
    })),
  });

  const [opening, setOpening] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  // Akkumuleret likviditet på tværs af alle år; hvert år starter med forrige års slutsaldo.
  const points: { label: string; saldo: number }[] = [];
  const yearOpening: Record<number, number> = {};
  let run = opening;
  years.forEach((y, i) => {
    const b = bundles[i]?.data;
    yearOpening[y] = run;
    if (!b) return;
    monthlyNet(y, b.lines, b.loans).forEach((n, m) => {
      run += n;
      points.push({ label: `${LIQ_MONTHS[m]} ${String(y).slice(2)}`, saldo: Math.round(run) });
    });
  });

  const current = selected ?? years[years.length - 1] ?? null;
  const curIdx = current !== null ? years.indexOf(current) : -1;
  const curBundle = curIdx >= 0 ? bundles[curIdx]?.data : null;
  const lowest = points.length ? Math.min(...points.map((p) => p.saldo)) : 0;

  return (
    <div className="px-6 py-6 w-full mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--brand-900)]">Likviditet</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Penge ind og ud — baseret på budgetterne</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Startbeløb {years[0] ? `1. jan ${years[0]}` : ""}:</span>
          <OpeningBalance value={opening} onCommit={setOpening} />
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-[var(--brand-900)]">Likviditet over tid — alle budgetår</h2>
          {points.length > 0 && (
            <span className={`text-sm ${lowest < 0 ? "text-red-700" : "text-muted-foreground"}`}>
              Laveste punkt: {formatDKK(lowest)}
            </span>
          )}
        </div>
        {years.length === 0 ? (
          <p className="text-sm text-muted-foreground py-10 text-center">Der er endnu ingen budgetter.</p>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{ top: 10, right: 20, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={60} />
                <Tooltip formatter={(v: number) => formatDKK(v)} />
                <ReferenceLine y={0} stroke="var(--destructive)" strokeDasharray="4 4" />
                <Area type="monotone" dataKey="saldo" name="Likviditet" stroke="var(--brand-500)" fill="var(--brand-500)" fillOpacity={0.2} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {years.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Detaljer for år:</span>
          <Select value={current !== null ? String(current) : ""} onValueChange={(v) => setSelected(Number(v))}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {current !== null && curBundle && (
        <BudgetLiquidity
          key={current}
          year={current}
          incomes={curBundle.lines.filter((l) => l.kind === "income")}
          expenses={curBundle.lines.filter((l) => l.kind === "expense")}
          loans={curBundle.loans}
          opening={yearOpening[current] ?? 0}
          onOpeningChange={curIdx === 0 ? setOpening : () => {}}
        />
      )}
    </div>
  );
}
