import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DashboardSummary = {
  yearRevenue: number;
  strawTotalValue: number;
  strawTotalQty: number;
  openInvoiceCount: number;
  nextContractEnd: string | null;
  upcomingContracts: Array<{
    id: string;
    kind: "land" | "building" | "hunting";
    label: string;
    contract_end: string;
  }>;
  pendingBuildingLeases: Array<{ id: string; building: string; tenant: string }>;
  readyInvoices: Array<{ id: string; invoice_number: string | null; total_amount: number; contact: string | null }>;
  budgetProgress: Array<{ category: string; budget: number; realized: number }>;
};

export const getDashboardSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DashboardSummary> => {
    const { supabase } = context;
    const year = new Date().getFullYear();
    const yearStart = `${year}-01-01`;

    const [
      paidInvoicesRes,
      strawRes,
      openInvRes,
      landRes,
      buildingLeaseRes,
      huntingRes,
      readyInvRes,
      budgetsRes,
      paidByCatRes,
    ] = await Promise.all([
      supabase
        .from("invoices")
        .select("total_amount, invoice_date, status")
        .eq("status", "paid")
        .gte("invoice_date", yearStart),
      supabase.from("straw_inventory").select("quantity, price_per_unit"),
      supabase.from("invoices").select("id", { count: "exact", head: true }).in("status", ["draft", "ready"]),
      supabase
        .from("land_leases")
        .select("id, contract_end, contacts:leaseholder_id(name)")
        .not("contract_end", "is", null),
      supabase
        .from("building_leases")
        .select("id, contract_end, status, buildings:building_id(name), contacts:tenant_id(name)")
        .not("contract_end", "is", null),
      supabase
        .from("hunting_leases")
        .select("id, name, contract_end")
        .not("contract_end", "is", null),
      supabase
        .from("invoices")
        .select("id, invoice_number, total_amount, contacts:contact_id(name)")
        .eq("status", "ready")
        .limit(5),
      supabase.from("budgets").select("category, budgeted_amount").eq("year", year),
      supabase
        .from("invoices")
        .select("category, total_amount")
        .eq("status", "paid")
        .gte("invoice_date", yearStart),
    ]);

    const yearRevenue = (paidInvoicesRes.data ?? []).reduce(
      (s, r) => s + Number(r.total_amount ?? 0),
      0,
    );
    const strawTotalValue = (strawRes.data ?? []).reduce(
      (s, r) => s + Number(r.quantity ?? 0) * Number(r.price_per_unit ?? 0),
      0,
    );
    const strawTotalQty = (strawRes.data ?? []).reduce(
      (s, r) => s + Number(r.quantity ?? 0),
      0,
    );
    const openInvoiceCount = openInvRes.count ?? 0;

    type EndItem = { id: string; kind: "land" | "building" | "hunting"; label: string; contract_end: string };
    const endings: EndItem[] = [];
    for (const r of landRes.data ?? []) {
      if (!r.contract_end) continue;
      const name = (r.contacts as { name?: string } | null)?.name ?? "Forpagter";
      endings.push({ id: r.id, kind: "land", label: `Jord — ${name}`, contract_end: r.contract_end });
    }
    for (const r of buildingLeaseRes.data ?? []) {
      if (!r.contract_end) continue;
      const b = (r.buildings as { name?: string } | null)?.name ?? "Bygning";
      const t = (r.contacts as { name?: string } | null)?.name ?? "Lejer";
      endings.push({ id: r.id, kind: "building", label: `${b} — ${t}`, contract_end: r.contract_end });
    }
    for (const r of huntingRes.data ?? []) {
      if (!r.contract_end) continue;
      endings.push({ id: r.id, kind: "hunting", label: `Jagtleje — ${r.name}`, contract_end: r.contract_end });
    }
    endings.sort((a, b) => a.contract_end.localeCompare(b.contract_end));
    const nextContractEnd = endings[0]?.contract_end ?? null;
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + 90);
    const upcomingContracts = endings.filter(
      (e) => new Date(e.contract_end) <= horizon,
    ).slice(0, 8);

    const pendingBuildingLeases = (buildingLeaseRes.data ?? [])
      .filter((r) => r.status === "pending_payment")
      .map((r) => ({
        id: r.id,
        building: (r.buildings as { name?: string } | null)?.name ?? "Bygning",
        tenant: (r.contacts as { name?: string } | null)?.name ?? "Lejer",
      }));

    const readyInvoices = (readyInvRes.data ?? []).map((r) => ({
      id: r.id,
      invoice_number: r.invoice_number,
      total_amount: Number(r.total_amount ?? 0),
      contact: (r.contacts as { name?: string } | null)?.name ?? null,
    }));

    const realizedByCat: Record<string, number> = {};
    for (const r of paidByCatRes.data ?? []) {
      const k = r.category ?? "andet";
      realizedByCat[k] = (realizedByCat[k] ?? 0) + Number(r.total_amount ?? 0);
    }
    const budgetProgress = (budgetsRes.data ?? []).map((b) => ({
      category: b.category,
      budget: Number(b.budgeted_amount ?? 0),
      realized: realizedByCat[b.category] ?? 0,
    }));

    return {
      yearRevenue,
      strawTotalValue,
      strawTotalQty,
      openInvoiceCount,
      nextContractEnd,
      upcomingContracts,
      pendingBuildingLeases,
      readyInvoices,
      budgetProgress,
    };
  });
