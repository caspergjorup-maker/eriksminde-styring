import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const BALE_TYPES = [
  "mini_bigballe",
  "bigballe",
  "rundballe",
  "small_square",
] as const;
export type BaleType = (typeof BALE_TYPES)[number];

export const BALE_TYPE_LABEL: Record<BaleType, string> = {
  mini_bigballe: "Mini-bigballe",
  bigballe: "Bigballe",
  rundballe: "Rundballe",
  small_square: "Småballe",
};

export type StrawInventoryRow = {
  id: string;
  bale_type: string;
  quantity: number;
  price_per_unit: number;
  harvest_year: number | null;
  notes: string | null;
  updated_at: string;
};

export type StrawMovementRow = {
  id: string;
  bale_type: string;
  quantity: number;
  direction: "in" | "out";
  contact_id: string | null;
  unit_price: number;
  total_amount: number | null;
  movement_date: string | null;
  notes: string | null;
  invoice_id: string | null;
  created_at: string;
  contact_name?: string | null;
};

const inventoryInput = z.object({
  bale_type: z.string().trim().min(1).max(60),
  quantity: z.number().int().min(0).max(1_000_000),
  price_per_unit: z.number().min(0).max(1_000_000),
  harvest_year: z.number().int().min(1990).max(2100).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

const movementInput = z.object({
  bale_type: z.string().trim().min(1).max(60),
  quantity: z.number().int().min(1).max(1_000_000),
  direction: z.enum(["in", "out"]),
  contact_id: z.string().uuid().nullable().optional(),
  unit_price: z.number().min(0).max(1_000_000),
  movement_date: z.string().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

function normMovement(input: z.infer<typeof movementInput>) {
  return {
    bale_type: input.bale_type,
    quantity: input.quantity,
    direction: input.direction,
    contact_id: input.contact_id ?? null,
    unit_price: input.unit_price,
    total_amount: input.quantity * input.unit_price,
    movement_date: input.movement_date || null,
    notes: input.notes || null,
  };
}

// ============ INVENTORY ============

export const listStrawInventory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StrawInventoryRow[]> => {
    const { data, error } = await context.supabase
      .from("straw_inventory")
      .select("*")
      .order("bale_type");
    if (error) throw new Error(error.message);
    return (data ?? []) as StrawInventoryRow[];
  });

export const createStrawInventory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inventoryInput.parse(data))
  .handler(async ({ data, context }) => {
    const { error, data: row } = await context.supabase
      .from("straw_inventory")
      .insert({
        bale_type: data.bale_type,
        quantity: data.quantity,
        price_per_unit: data.price_per_unit,
        harvest_year: data.harvest_year ?? null,
        notes: data.notes ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateStrawInventory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid() }).and(inventoryInput).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { error, data: row } = await context.supabase
      .from("straw_inventory")
      .update({
        bale_type: rest.bale_type,
        quantity: rest.quantity,
        price_per_unit: rest.price_per_unit,
        harvest_year: rest.harvest_year ?? null,
        notes: rest.notes ?? null,
      })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteStrawInventory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("straw_inventory")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ MOVEMENTS ============

export const listStrawMovements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { direction?: "in" | "out" | "all" } | undefined) => data ?? {})
  .handler(async ({ data, context }): Promise<StrawMovementRow[]> => {
    let query = context.supabase
      .from("straw_movements")
      .select("*, contacts(name)")
      .order("movement_date", { ascending: false, nullsFirst: false });
    if (data?.direction && data.direction !== "all") {
      query = query.eq("direction", data.direction);
    }
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => {
      const { contacts, ...rest } = r as typeof r & { contacts?: { name: string } | null };
      return {
        ...rest,
        direction: rest.direction as "in" | "out",
        contact_name: contacts?.name ?? null,
      };
    }) as StrawMovementRow[];
  });

export const createStrawMovement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => movementInput.parse(data))
  .handler(async ({ data, context }) => {
    const { error, data: row } = await context.supabase
      .from("straw_movements")
      .insert(normMovement(data))
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateStrawMovement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid() }).and(movementInput).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { error, data: row } = await context.supabase
      .from("straw_movements")
      .update(normMovement(rest))
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteStrawMovement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("straw_movements")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ CONTACTS for selector (straw customers/suppliers) ============

export const listStrawContacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("contacts")
      .select("id, name, type")
      .order("name");
    if (error) throw new Error(error.message);
    return (data ?? []) as { id: string; name: string; type: string }[];
  });

// ============ SUMMARY ============

export type StrawSummary = {
  inventory_value: number;
  inventory_quantity: number;
  by_type: { bale_type: string; quantity: number; value: number }[];
  ytd_sales: number;
  ytd_sales_qty: number;
  ytd_purchases: number;
  ytd_purchases_qty: number;
  year: number;
};

export const getStrawSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StrawSummary> => {
    const year = new Date().getFullYear();
    const yearStart = `${year}-01-01`;

    const [inv, mov] = await Promise.all([
      context.supabase.from("straw_inventory").select("*"),
      context.supabase
        .from("straw_movements")
        .select("direction, quantity, total_amount, movement_date")
        .gte("movement_date", yearStart),
    ]);
    if (inv.error) throw new Error(inv.error.message);
    if (mov.error) throw new Error(mov.error.message);

    const inventory = (inv.data ?? []) as StrawInventoryRow[];
    const movements = (mov.data ?? []) as Pick<
      StrawMovementRow,
      "direction" | "quantity" | "total_amount" | "movement_date"
    >[];

    const byTypeMap = new Map<string, { quantity: number; value: number }>();
    let totalQty = 0;
    let totalValue = 0;
    for (const r of inventory) {
      const v = r.quantity * Number(r.price_per_unit);
      totalQty += r.quantity;
      totalValue += v;
      const prev = byTypeMap.get(r.bale_type) ?? { quantity: 0, value: 0 };
      byTypeMap.set(r.bale_type, {
        quantity: prev.quantity + r.quantity,
        value: prev.value + v,
      });
    }

    let ytdSales = 0;
    let ytdSalesQty = 0;
    let ytdPurchases = 0;
    let ytdPurchasesQty = 0;
    for (const m of movements) {
      const amt = Number(m.total_amount ?? 0);
      if (m.direction === "out") {
        ytdSales += amt;
        ytdSalesQty += m.quantity;
      } else if (m.direction === "in") {
        ytdPurchases += amt;
        ytdPurchasesQty += m.quantity;
      }
    }

    return {
      inventory_value: totalValue,
      inventory_quantity: totalQty,
      by_type: Array.from(byTypeMap.entries()).map(([bale_type, v]) => ({
        bale_type,
        quantity: v.quantity,
        value: v.value,
      })),
      ytd_sales: ytdSales,
      ytd_sales_qty: ytdSalesQty,
      ytd_purchases: ytdPurchases,
      ytd_purchases_qty: ytdPurchasesQty,
      year,
    };
  });
