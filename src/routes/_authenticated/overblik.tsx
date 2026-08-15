import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp,
  Wheat,
  FileText,
  CalendarClock,
  ArrowRight,
} from "lucide-react";

import { getDashboardSummary } from "@/lib/dashboard.functions";
import { formatDKK, formatDate, formatNumber, daysUntil } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/overblik")({
  component: DashboardPage,
});

const categoryLabels: Record<string, string> = {
  forpagtning: "Forpagtning",
  bygningsudlejning: "Bygningsudlejning",
  halm: "Halm",
  jagtleje: "Jagtleje",
  skov: "Skov",
  udgifter: "Udgifter",
};

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  to,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  to?: string;
}) {
  const card = (
    <div
      className={[
        "bg-card border border-border rounded-xl p-5",
        to ? "hover:border-[var(--brand-500)] hover:shadow-sm transition-colors cursor-pointer" : "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="h-9 w-9 rounded-lg bg-[var(--brand-50)] flex items-center justify-center text-[var(--brand-700)]">
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
      <div className="mt-3 text-2xl font-semibold text-[var(--brand-900)]">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );

  if (to) return <Link to={to} className="block">{card}</Link>;
  return card;
}

function Badge({
  tone,
  children,
}: {
  tone: "green" | "yellow" | "red" | "blue";
  children: React.ReactNode;
}) {
  const map = {
    green: "bg-[var(--brand-50)] text-[var(--brand-900)]",
    yellow: "bg-amber-100 text-amber-900",
    red: "bg-red-100 text-red-900",
    blue: "bg-sky-100 text-sky-900",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${map[tone]}`}>
      {children}
    </span>
  );
}

function contractKindToPath(kind: "land" | "building" | "hunting") {
  if (kind === "land") return "/landbrugsjord";
  if (kind === "building") return "/bygninger";
  return "/jagtleje";
}

function DashboardPage() {
  const fetchSummary = useServerFn(getDashboardSummary);
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => fetchSummary(),
  });

  const year = new Date().getFullYear();

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[var(--brand-900)]">Overblik</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Status for {year} — Eriksminde
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          icon={TrendingUp}
          label="Realiseret indtægt år til dato"
          value={isLoading ? "…" : formatDKK(data?.yearRevenue ?? 0)}
          sub={`Året ${year}`}
        />
        <MetricCard
          icon={Wheat}
          label="Halm på lager"
          value={isLoading ? "…" : `${formatNumber(data?.strawTotalQty ?? 0)} stk.`}
          sub={isLoading ? "" : `Værdi ${formatDKK(data?.strawTotalValue ?? 0)}`}
        />
        <MetricCard
          icon={FileText}
          label="Åbne fakturakladder"
          value={isLoading ? "…" : String(data?.openInvoiceCount ?? 0)}
          sub="Kladder + klar til eksport"
        />
        <MetricCard
          icon={CalendarClock}
          label="Næste kontraktudløb"
          value={isLoading ? "…" : data?.nextContractEnd ? formatDate(data.nextContractEnd) : "—"}
          sub={
            isLoading
              ? ""
              : data?.nextContractEnd
                ? `${daysUntil(data.nextContractEnd) ?? 0} dage`
                : "Ingen registreret"
          }
          to={
            data?.upcomingContracts && data.upcomingContracts.length > 0
              ? contractKindToPath(data.upcomingContracts[0].kind)
              : "/landbrugsjord"
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-[var(--brand-900)]">Kommende opgaver</h2>
          </div>
          <div className="space-y-3">
            {(data?.upcomingContracts ?? []).map((c) => {
              const days = daysUntil(c.contract_end) ?? 0;
              const tone = days < 30 ? "red" : days < 60 ? "yellow" : "blue";
              const to =
                c.kind === "land"
                  ? "/landbrugsjord"
                  : c.kind === "building"
                    ? "/bygninger"
                    : "/jagtleje";
              return (
                <Link
                  key={c.id}
                  to={to}
                  className="flex items-center justify-between py-1.5 -mx-2 px-2 rounded-md hover:bg-muted/60 transition-colors"
                >
                  <div>
                    <div className="text-sm font-medium">{c.label}</div>
                    <div className="text-xs text-muted-foreground">
                      Udløber {formatDate(c.contract_end)}
                    </div>
                  </div>
                  <Badge tone={tone}>{days} dage</Badge>
                </Link>
              );
            })}
            {(data?.pendingBuildingLeases ?? []).map((p) => (
              <Link
                key={`pend-${p.id}`}
                to="/bygninger"
                className="flex items-center justify-between py-1.5 -mx-2 px-2 rounded-md hover:bg-muted/60 transition-colors"
              >
                <div>
                  <div className="text-sm font-medium">Ubetalt leje — {p.building}</div>
                  <div className="text-xs text-muted-foreground">{p.tenant}</div>
                </div>
                <Badge tone="yellow">Afventer</Badge>
              </Link>
            ))}
            {(data?.readyInvoices ?? []).map((r) => (
              <Link
                key={`inv-${r.id}`}
                to="/fakturakladder"
                className="flex items-center justify-between py-1.5 -mx-2 px-2 rounded-md hover:bg-muted/60 transition-colors"
              >
                <div>
                  <div className="text-sm font-medium">
                    Faktura klar {r.invoice_number ? `#${r.invoice_number}` : ""}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {r.contact ?? "—"} · {formatDKK(r.total_amount)}
                  </div>
                </div>
                <Badge tone="blue">Klar</Badge>
              </Link>
            ))}
            {(data?.openTasks ?? []).map((t) => {
              const days = t.due_date ? (daysUntil(t.due_date) ?? 0) : null;
              const tone =
                t.priority === "critical"
                  ? "red"
                  : t.priority === "high"
                    ? "yellow"
                    : "blue";
              return (
                <Link
                  key={`task-${t.id}`}
                  to="/opgaver"
                  className="flex items-center justify-between py-1.5 -mx-2 px-2 rounded-md hover:bg-muted/60 transition-colors"
                >
                  <div>
                    <div className="text-sm font-medium">{t.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {t.assignee ?? "Ingen ansvarlig"}
                      {t.due_date ? ` · Forfalder ${formatDate(t.due_date)}` : ""}
                    </div>
                  </div>
                  <Badge tone={tone}>
                    {days !== null ? `${days} dage` : t.priority}
                  </Badge>
                </Link>
              );
            })}
            {!isLoading &&
              (data?.upcomingContracts.length ?? 0) === 0 &&
              (data?.pendingBuildingLeases.length ?? 0) === 0 &&
              (data?.readyInvoices.length ?? 0) === 0 &&
              (data?.openTasks.length ?? 0) === 0 && (
                <p className="text-sm text-muted-foreground">Ingen opgaver lige nu.</p>
              )}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-[var(--brand-900)]">Indtægtsoverblik</h2>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="space-y-4">
            {(data?.budgetProgress ?? []).map((b) => {
              const pct = b.budget > 0 ? Math.min(100, Math.round((b.realized / b.budget) * 100)) : 0;
              return (
                <div key={b.category}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium">{categoryLabels[b.category] ?? b.category}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {formatDKK(b.realized)} / {formatDKK(b.budget)}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--brand-500)]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {!isLoading && (data?.budgetProgress.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">Ingen budget for {year} endnu.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
