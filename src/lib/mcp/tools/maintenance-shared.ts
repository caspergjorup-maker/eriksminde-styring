import { z } from "zod";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Brug YYYY-MM-DD");

export const maintenanceFields = {
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  building_id: z
    .string()
    .uuid()
    .nullable()
    .optional()
    .describe("Bygningens UUID; vælg enten bygning eller maskine."),
  machine_id: z
    .string()
    .uuid()
    .nullable()
    .optional()
    .describe("Maskinens UUID; vælg enten bygning eller maskine."),
  assigned_contact_id: z.string().uuid().nullable().optional(),
  preferred_supplier_id: z.string().uuid().nullable().optional(),
  category: z.string().trim().max(60).nullable().optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  status: z.enum(["open", "in_progress", "done", "cancelled"]).optional(),
  due_date: date.nullable().optional(),
  completed_date: date.nullable().optional(),
  estimated_cost: z.number().finite().min(0).max(100_000_000).nullable().optional(),
  actual_cost: z.number().finite().min(0).max(100_000_000).nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
};
