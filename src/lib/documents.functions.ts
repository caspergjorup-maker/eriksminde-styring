import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export const DOCUMENT_CATEGORIES = [
  "lease_contract",
  "insurance",
  "drawing",
  "deed",
  "invoice",
  "receipt",
  "certificate",
  "permit",
  "correspondence",
  "other",
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  lease_contract: "Lejekontrakt / Forpagtning",
  insurance: "Forsikring",
  drawing: "Tegning / Kort",
  deed: "Skøde / Ejendom",
  invoice: "Faktura",
  receipt: "Kvittering",
  certificate: "Attest / Certifikat",
  permit: "Tilladelse",
  correspondence: "Korrespondance",
  other: "Andet",
};

export const ENTITY_TYPES = [
  "contact",
  "building",
  "building_unit",
  "machine",
  "field",
  "parcel",
  "land_lease",
  "building_lease",
  "hunting_lease",
  "task",
  "maintenance_task",
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  contact: "Kontakt",
  building: "Bygning",
  building_unit: "Lejemål",
  machine: "Maskine",
  field: "Mark",
  parcel: "Matrikel",
  land_lease: "Forpagtning",
  building_lease: "Udlejning",
  hunting_lease: "Jagtleje",
  task: "Opgave",
  maintenance_task: "Vedligehold",
};

export type DocumentLink = {
  id: string;
  document_id: string;
  entity_type: EntityType;
  entity_id: string;
  entity_name: string | null;
  created_at: string;
};

export type Document = {
  id: string;
  name: string;
  category: DocumentCategory | null;
  file_url: string | null;
  related_contact_id: string | null;
  contact_name: string | null;
  upload_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  links: DocumentLink[];
};

const documentInput = z.object({
  name: z.string().trim().min(1, "Navn er påkrævet").max(200),
  category: z.enum(DOCUMENT_CATEGORIES).nullable(),
  related_contact_id: z.string().uuid().nullable().optional(),
  upload_date: z.string().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  file_path: z.string().trim().min(1).max(500).nullable().optional(),
});

const listFilters = z.object({
  category: z.enum(DOCUMENT_CATEGORIES).nullable().optional(),
  related_contact_id: z.string().uuid().nullable().optional(),
  entity_type: z.enum(ENTITY_TYPES).nullable().optional(),
  entity_id: z.string().uuid().nullable().optional(),
});

export const listDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => listFilters.nullable().optional().parse(data ?? {}))
  .handler(async ({ data, context }): Promise<Document[]> => {
    const filters = data ?? {};
    let query = context.supabase
      .from("documents")
      .select(
        "id, name, category, file_url, related_contact_id, upload_date, notes, created_at, updated_at, contacts:related_contact_id(name), document_links(id, entity_type, entity_id)",
      )
      .order("upload_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (filters.category) {
      query = query.eq("category", filters.category);
    }
    if (filters.related_contact_id) {
      query = query.eq("related_contact_id", filters.related_contact_id);
    }
    if (filters.entity_type && filters.entity_id) {
      query = query.eq("document_links.entity_type", filters.entity_type).eq(
        "document_links.entity_id",
        filters.entity_id,
      );
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    return (rows ?? []).map((r) => {
      const contact = r.contacts as { name?: string } | null;
      const links = (r.document_links as Array<Record<string, unknown>> | null) ?? [];
      return {
        id: r.id,
        name: r.name,
        category: r.category as DocumentCategory | null,
        file_url: r.file_url,
        related_contact_id: r.related_contact_id,
        contact_name: contact?.name ?? null,
        upload_date: r.upload_date,
        notes: r.notes,
        created_at: r.created_at,
        updated_at: r.updated_at,
        links: links.map((l) => ({
          id: l.id as string,
          document_id: r.id,
          entity_type: l.entity_type as EntityType,
          entity_id: l.entity_id as string,
          entity_name: null,
          created_at: l.created_at as string,
        })),
      };
    });
  });

export const createDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => documentInput.parse(data))
  .handler(async ({ data, context }): Promise<Document> => {
    const { file_path, ...rest } = data;
    const insert = {
      ...rest,
      file_url: file_path ? `${file_path}` : null,
    } as Database["public"]["Tables"]["documents"]["Insert"];
    const { data: row, error } = await context.supabase
      .from("documents")
      .insert(insert)
      .select("id, name, category, file_url, related_contact_id, upload_date, notes, created_at, updated_at, contacts:related_contact_id(name)")
      .single();
    if (error) throw new Error(error.message);
    const contact = row.contacts as { name?: string } | null;
    return {
      id: row.id,
      name: row.name,
      category: row.category as DocumentCategory | null,
      file_url: row.file_url,
      related_contact_id: row.related_contact_id,
      contact_name: contact?.name ?? null,
      upload_date: row.upload_date,
      notes: row.notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
      links: [],
    };
  });

export const updateDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).and(documentInput).parse(data))
  .handler(async ({ data, context }): Promise<Document> => {
    const { id, file_path, ...rest } = data;
    const update = {
      ...rest,
      file_url: file_path ? `${file_path}` : null,
    } as Database["public"]["Tables"]["documents"]["Update"];
    const { data: row, error } = await context.supabase
      .from("documents")
      .update(update)
      .eq("id", id)
      .select("id, name, category, file_url, related_contact_id, upload_date, notes, created_at, updated_at, contacts:related_contact_id(name), document_links(id, entity_type, entity_id)")
      .single();
    if (error) throw new Error(error.message);
    const contact = row.contacts as { name?: string } | null;
    const links = (row.document_links as Array<Record<string, unknown>> | null) ?? [];
    return {
      id: row.id,
      name: row.name,
      category: row.category as DocumentCategory | null,
      file_url: row.file_url,
      related_contact_id: row.related_contact_id,
      contact_name: contact?.name ?? null,
      upload_date: row.upload_date,
      notes: row.notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
      links: links.map((l) => ({
        id: l.id as string,
        document_id: row.id,
        entity_type: l.entity_type as EntityType,
        entity_id: l.entity_id as string,
        entity_name: null,
        created_at: l.created_at as string,
      })),
    };
  });

export const deleteDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    // Load the document first to know the file path, then delete the storage file and the row.
    const { data: doc, error: readError } = await context.supabase
      .from("documents")
      .select("file_url")
      .eq("id", data.id)
      .single();
    if (readError) throw new Error(readError.message);

    if (doc.file_url) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.storage.from("documents").remove([doc.file_url]);
    }

    const { error } = await context.supabase.from("documents").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      filename: z.string().trim().min(1).max(200),
      contentType: z.string().trim().max(100).optional(),
    }).parse(data)
  )
  .handler(async ({ data, context }): Promise<{ path: string; signedUrl: string; token: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ext = data.filename.split(".").pop() ?? "";
    const safeName = data.filename
      .toLowerCase()
      .replace(/[^a-z0-9æøå_.-]/g, "_")
      .replace(/_+/g, "_");
    const path = `${context.userId}/${crypto.randomUUID()}/${safeName}`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from("documents")
      .createSignedUploadUrl(path, { upsert: false });
    if (error) throw new Error(error.message);
    return { path, signedUrl: signed.signedUrl, token: signed.token };
  });

export const getSignedDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ documentId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<{ url: string }> => {
    const { data: doc, error: readError } = await context.supabase
      .from("documents")
      .select("file_url")
      .eq("id", data.documentId)
      .single();
    if (readError) throw new Error(readError.message);
    if (!doc.file_url) throw new Error("Dokumentet har ingen fil");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("documents")
      .createSignedUrl(doc.file_url, 60 * 60); // 1 hour
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });

const linkInput = z.object({
  document_id: z.string().uuid(),
  entity_type: z.enum(ENTITY_TYPES),
  entity_id: z.string().uuid(),
});

export const addDocumentLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => linkInput.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("document_links").insert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeDocumentLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("document_links").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
