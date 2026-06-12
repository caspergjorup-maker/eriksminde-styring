import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDownLeft, ArrowUpRight, Package, TrendingUp } from "lucide-react";

import { BALE_TYPE_LABEL, getStrawSummary } from "@/lib/straw.functions";
import { formatDKK, formatNumber } from "@/lib/format";


function labelFor(bt: string) {
  return (BALE_TYPE_LABEL as Record<string, string>)[bt] ?? bt;
}

export function HalmOekonomiPage() {
  const fn = useServerFn(getStrawSummary);
  const { data, isLoading } = useQuery({
    queryKey: ["straw-summary"],
    queryFn: () => fn(),
  });

  const margin = (data?.ytd_sales ?? 0) - (data?.ytd_purchases ?? 0);

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[var(--brand-900)]">Halm — Økonomi</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Aggregeret overblik {data ? `for ${data.year}` : ""}
        </p>
      </div>

      {isLoading && <div className="text-muted-foreground">Indlæser…</div>}

      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card icon={<Package className="h-4 w-4" />} label="Lagerbeholdning" value={formatNumber(data.inventory_quantity) + " stk"} sub={formatDKK(data.inventory_value)} />
            <Card icon={<ArrowUpRight className="h-4 w-4 text-emerald-600" />} label={`Salg YTD ${data.year}`} value={formatDKK(data.ytd_sales)} sub={`${formatNumber(data.ytd_sales_qty)} stk`} />
            <Card icon={<ArrowDownLeft className="h-4 w-4 text-amber-600" />} label={`Køb YTD ${data.year}`} value={formatDKK(data.ytd_purchases)} sub={`${formatNumber(data.ytd_purchases_qty)} stk`} />
            <Card icon={<TrendingUp className="h-4 w-4 text-[var(--brand-900)]" />} label="Margen YTD" value={formatDKK(margin)} sub={margin >= 0 ? "Positiv" : "Negativ"} />
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="font-medium">Beholdning pr. balletype</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Balletype</th>
                  <th className="px-4 py-2.5 font-medium text-right">Antal</th>
                  <th className="px-4 py-2.5 font-medium text-right">Værdi</th>
                  <th className="px-4 py-2.5 font-medium text-right">Andel</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.by_type.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">Ingen beholdning.</td></tr>
                )}
                {data.by_type.map((r) => {
                  const pct = data.inventory_value > 0 ? (r.value / data.inventory_value) * 100 : 0;
                  return (
                    <tr key={r.bale_type} className="hover:bg-muted/30">
                      <td className="px-4 py-2.5 font-medium">{labelFor(r.bale_type)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{formatNumber(r.quantity)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium">{formatDKK(r.value)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{pct.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Card({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
        {icon} {label}
      </div>
      <div className="text-2xl font-semibold mt-1 tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}
