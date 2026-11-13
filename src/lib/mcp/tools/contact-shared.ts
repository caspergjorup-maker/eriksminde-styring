import { z } from "zod";

export const contactFields = {
  type: z.enum(["customer", "tenant", "leaseholder", "hunting_tenant", "supplier"]).optional(),
  name: z.string().trim().min(1).max(200).optional(),
  cvr: z.string().trim().max(20).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  email: z.string().trim().email("Ugyldig e-mailadresse").max(255).nullable().optional(),
  address: z.string().trim().max(500).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
};
