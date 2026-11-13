/* eslint-disable @typescript-eslint/no-explicit-any */
import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { supabaseForUser, json } from "../supabase";
import { budgetMonthlySummary } from "@/lib/budget-math";
import type { BudgetLine, BudgetLoan } from "@/lib/budget.functions";

function byDueDate(a: any, b: any) {
  if (!a.due_date) return 1;
  if (!b.due_date) return -1;
  return a.due_date.localeCompare(b.due_date);
}

function activeOn(date: string, start: string | null, end: string | null) {
  return (!start || start <= date) && (!end || end >= date);
}

export default defineTool({
  name: "farm_overview",
  title: "Samlet gårdoverblik",
  description:
    "Giv et samlet overblik over forfaldne og åbne opgaver, vedligehold, bygningers udlejningsstatus og lejepotentiale, aktive og udløbende lejeaftaler, halmlager, primært månedsbudget og åbne fakturakladder.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_args, ctx) => {
    const sb = supabaseForUser(ctx);
    const today = new Date().toISOString().slice(0, 10);
    const horizonDate = new Date(`${today}T00:00:00Z`);
    horizonDate.setUTCMonth(horizonDate.getUTCMonth() + 6);
    const horizon = horizonDate.toISOString().slice(0, 10);

    const [
      tasksRes,
      maintenanceRes,
      buildingsRes,
      buildingLeasesRes,
      landLeasesRes,
      huntingLeasesRes,
      strawRes,
      scenariosRes,
      invoicesRes,
    ] = await Promise.all([
      sb
        .from("tasks")
        .select("*, contacts:assigned_contact_id(name)")
        .not("status", "in", "('done','cancelled')"),
      sb
        .from("maintenance_tasks")
        .select("*, buildings(name), machines(name)")
        .not("status", "in", "('done','cancelled')"),
      sb.from("buildings").select("id, name, lease_status, estimated_monthly_rent"),
      sb
        .from("building_leases")
        .select(
          "*, buildings:building_id(name), building_units:unit_id(name), contacts:tenant_id(name)",
        ),
      sb.from("land_leases").select("*, contacts:leaseholder_id(name)"),
      sb.from("hunting_leases").select("*, contacts:tenant_id(name)"),
      sb.from("straw_inventory").select("*"),
      sb
        .from("budget_scenarios")
        .select("*")
        .eq("is_primary", true)
        .order("year", { ascending: false })
        .limit(1),
      sb
        .from("invoices")
        .select("*, contacts:contact_id(name)")
        .in("status", ["draft", "ready"])
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    const responses = [
      tasksRes,
      maintenanceRes,
      buildingsRes,
      buildingLeasesRes,
      landLeasesRes,
      huntingLeasesRes,
      strawRes,
      scenariosRes,
      invoicesRes,
    ];
    const failed = responses.find((response) => response.error);
    if (failed?.error) throw new ToolError(failed.error.message);

    const withOverdue = (row: any) => ({
      ...row,
      overdue: Boolean(row.due_date && row.due_date < today),
    });
    const openTasks = ((tasksRes.data ?? []) as any[]).map(withOverdue).sort(byDueDate);
    const openMaintenance = ((maintenanceRes.data ?? []) as any[]).map(withOverdue).sort(byDueDate);

    const buildingGroups = Object.values(
      ((buildingsRes.data ?? []) as any[]).reduce(
        (groups, building) => {
          const status = building.lease_status ?? "ukendt";
          groups[status] ??= {
            lease_status: status,
            building_count: 0,
            estimated_monthly_rent_total: 0,
          };
          groups[status].building_count += 1;
          groups[status].estimated_monthly_rent_total += Number(
            building.estimated_monthly_rent ?? 0,
          );
          return groups;
        },
        {} as Record<
          string,
          { lease_status: string; building_count: number; estimated_monthly_rent_total: number }
        >,
      ),
    );

    const activeLeases: any[] = [];
    for (const lease of (buildingLeasesRes.data ?? []) as any[]) {
      if (
        !["active", "expiring_soon"].includes(lease.status) ||
        !activeOn(today, lease.contract_start, lease.contract_end)
      )
        continue;
      activeLeases.push({
        kind: "building",
        id: lease.id,
        name:
          [lease.buildings?.name, lease.building_units?.name].filter(Boolean).join(" — ") ||
          "Bygning",
        tenant: lease.contacts?.name ?? null,
        annual_income: Number(lease.monthly_rent ?? 0) * 12,
        contract_start: lease.contract_start,
        contract_end: lease.contract_end,
        status: lease.status,
      });
    }
    for (const lease of (landLeasesRes.data ?? []) as any[]) {
      if (!activeOn(today, lease.contract_start, lease.contract_end)) continue;
      activeLeases.push({
        kind: "land",
        id: lease.id,
        name: lease.contacts?.name ?? "Jordforpagtning",
        annual_income: Number(
          lease.annual_fee ?? Number(lease.area_ha ?? 0) * Number(lease.price_per_ha ?? 0),
        ),
        contract_start: lease.contract_start,
        contract_end: lease.contract_end,
        status: "active",
      });
    }
    for (const lease of (huntingLeasesRes.data ?? []) as any[]) {
      if (!activeOn(today, lease.contract_start, lease.contract_end)) continue;
      activeLeases.push({
        kind: "hunting",
        id: lease.id,
        name: lease.name,
        tenant: lease.contacts?.name ?? null,
        annual_income: Number(lease.annual_fee ?? 0),
        contract_start: lease.contract_start,
        contract_end: lease.contract_end,
        status: "active",
      });
    }
    activeLeases.sort((a, b) =>
      (a.contract_end ?? "9999-12-31").localeCompare(b.contract_end ?? "9999-12-31"),
    );
    const expiringLeases = activeLeases.filter(
      (lease) => lease.contract_end && lease.contract_end >= today && lease.contract_end <= horizon,
    );

    const strawByType = Object.values(
      ((strawRes.data ?? []) as any[]).reduce(
        (groups, row) => {
          groups[row.bale_type] ??= { bale_type: row.bale_type, quantity: 0, inventory_value: 0 };
          groups[row.bale_type].quantity += Number(row.quantity ?? 0);
          groups[row.bale_type].inventory_value +=
            Number(row.quantity ?? 0) * Number(row.price_per_unit ?? 0);
          return groups;
        },
        {} as Record<string, { bale_type: string; quantity: number; inventory_value: number }>,
      ),
    );

    const scenario = scenariosRes.data?.[0] ?? null;
    let budget = null;
    if (scenario) {
      const [linesRes, loansRes] = await Promise.all([
        sb.from("budget_lines").select("*").eq("scenario_id", scenario.id),
        sb.from("budget_loans").select("*").eq("scenario_id", scenario.id),
      ]);
      if (linesRes.error) throw new ToolError(linesRes.error.message);
      if (loansRes.error) throw new ToolError(loansRes.error.message);
      const lines = (linesRes.data ?? []).map((line) => ({
        ...line,
        annual_amount: Number(line.annual_amount ?? 0),
        monthly_override: Array.isArray(line.monthly_override)
          ? line.monthly_override.map(Number)
          : null,
      })) as BudgetLine[];
      const loans = (loansRes.data ?? []).map((loan) => ({
        ...loan,
        principal: Number(loan.principal ?? 0),
        interest_rate: Number(loan.interest_rate ?? 0),
        monthly_payment: loan.monthly_payment == null ? null : Number(loan.monthly_payment),
      })) as BudgetLoan[];
      const monthly = budgetMonthlySummary(scenario.year, lines, loans);
      budget = {
        scenario,
        monthly,
        totals: {
          income: monthly.reduce((sum, month) => sum + month.income, 0),
          expenses: monthly.reduce((sum, month) => sum + month.expenses, 0),
          loan_payments: monthly.reduce((sum, month) => sum + month.loan_payments, 0),
          result: monthly.reduce((sum, month) => sum + month.result, 0),
        },
      };
    }

    return json({
      as_of: today,
      open_tasks: openTasks,
      open_maintenance_tasks: openMaintenance,
      buildings_by_lease_status: buildingGroups,
      active_leases: activeLeases,
      leases_expiring_within_6_months: expiringLeases,
      straw_inventory_by_bale_type: strawByType,
      primary_budget: budget,
      open_invoice_drafts: invoicesRes.data ?? [],
    });
  },
});
