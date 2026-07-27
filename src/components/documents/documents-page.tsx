"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  FilePlus,
  Download,
  Pencil,
  Trash2,
  Link as LinkIcon,
  X,
  FileText,
  CalendarDays,
  Tag,
  User,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  TableToolbar,
  SortableHeader,
  useTableFilters,
  type FilterColumn,
} from "@/components/table-filters";

import {
  listDocuments,
  createDocument,
  updateDocument,
  deleteDocument,
  getUploadUrl,
  getSignedDownloadUrl,
  addDocumentLink,
  removeDocumentLink,
  CATEGORY_LABELS,
  ENTITY_TYPE_LABELS,
  DOCUMENT_CATEGORIES,
  ENTITY_TYPES,
  type Document,
  type DocumentLink,
  type DocumentCategory,
  type EntityType,
} from "@/lib/documents.functions";
import { listAllContacts, type Contact } from "@/lib/contacts.functions";
import { listBuildings } from "@/lib/buildings.functions";
import { listMachines, type MachineRow } from "@/lib/machines.functions";
import { listFields, type FieldListItem } from "@/lib/fields.functions";
import { listParcels, type ParcelListItem } from "@/lib/parcels.functions";

type EntityOption = {
  id: string;
  name: string;
};

type EntityList = {
  contact: EntityOption[];
  building: EntityOption[];
  building_unit: EntityOption[];
  machine: EntityOption[];
  field: EntityOption[];
  parcel: EntityOption[];
  land_lease: EntityOption[];
  building_lease: EntityOption[];
  hunting_lease: EntityOption[];
  task: EntityOption[];
  maintenance_task: EntityOption[];
};

const DOCUMENT_COLUMNS: FilterColumn<Document>[] = [
  { key: "name", label: "Navn", sortable: true, sortValue: (d) => d.name },
  {
    key: "category",
    label: "Kategori",
    type: "enum",
    get: (d) => d.category ?? "",
    options: [
      ...DOCUMENT_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] })),
      { value: "", label: "(ingen)" },
    ],
    sortable: true,
    sortValue: (d) => d.category ?? "",
  },
  { key: "contact_name", label: "Kontakt", sortable: true, sortValue: (d) => d.contact_name ?? "" },
  {
    key: "upload_date",
    label: "Dato",
    sortable: true,
    sortValue: (d) => d.upload_date ?? d.created_at,
  },
  {
    key: "links",
    label: "Tilknytninger",
    sortable: false,
  },
  { key: "notes", label: "Noter", sortable: false },
  { key: "actions", label: "", sortable: false },
];

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

function defaultDate(): string {
  return new Date().toISOString().split("T")[0];
}

export function DocumentsPage() {
  const queryClient = useQueryClient();

  const [uploadOpen, setUploadOpen] = useState(false);
  const [editDoc, setEditDoc] = useState<Document | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<Document | null>(null);
  const [downloadDoc, setDownloadDoc] = useState<Document | null>(null);

  const listDocumentsFn = useServerFn(listDocuments);
  const createDocumentFn = useServerFn(createDocument);
  const updateDocumentFn = useServerFn(updateDocument);
  const deleteDocumentFn = useServerFn(deleteDocument);
  const getUploadUrlFn = useServerFn(getUploadUrl);
  const getSignedDownloadUrlFn = useServerFn(getSignedDownloadUrl);
  const addDocumentLinkFn = useServerFn(addDocumentLink);
  const removeDocumentLinkFn = useServerFn(removeDocumentLink);
  const listAllContactsFn = useServerFn(listAllContacts);
  const listBuildingsFn = useServerFn(listBuildings);
  const listMachinesFn = useServerFn(listMachines);
  const listFieldsFn = useServerFn(listFields);
  const listParcelsFn = useServerFn(listParcels);

  const { data: documents, isLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: () => listDocumentsFn({ data: {} }),
  });

  const { data: contacts } = useQuery({
    queryKey: ["contacts-all"],
    queryFn: () => listAllContactsFn(),
  });

  const { data: buildings } = useQuery({
    queryKey: ["buildings"],
    queryFn: () => listBuildingsFn(),
  });

  const { data: machines } = useQuery({
    queryKey: ["machines"],
    queryFn: () => listMachinesFn(),
  });

  const { data: fields } = useQuery({
    queryKey: ["fields"],
    queryFn: () => listFieldsFn(),
  });

  const { data: parcels } = useQuery({
    queryKey: ["parcels"],
    queryFn: () => listParcelsFn(),
  });

  const entityLists: EntityList = useMemo(
    () => ({
      contact: (contacts ?? []).map((c) => ({ id: c.id, name: c.name })),
      building: (buildings ?? []).map((b) => ({ id: b.id, name: b.name })),
      building_unit: [],
      machine: (machines ?? []).map((m) => ({ id: m.id, name: m.name })),
      field: (fields ?? []).map((f) => ({ id: f.id, name: f.name })),
      parcel: (parcels ?? []).map((p) => ({ id: p.id, name: `${p.ejerlav} ${p.matrikel_id}` })),
      land_lease: [],
      building_lease: [],
      hunting_lease: [],
      task: [],
      maintenance_task: [],
    }),
    [contacts, buildings, machines, fields, parcels],
  );

  const filters = useTableFilters({
    rows: documents ?? [],
    columns: DOCUMENT_COLUMNS,
    searchFields: [(d) => d.name, (d) => d.notes, (d) => d.contact_name],
    initialSort: { key: "upload_date", dir: "desc" },
  });

  const createMutation = useMutation({
    mutationFn: async (args: {
      file: File;
      name: string;
      category: DocumentCategory | null;
      related_contact_id: string | null;
      upload_date: string | null;
      notes: string | null;
    }) => {
      const { path, signedUrl } = await getUploadUrlFn({
        data: { filename: args.file.name, contentType: args.file.type },
      });

      const uploadRes = await fetch(signedUrl, {
        method: "PUT",
        body: args.file,
        headers: { "Content-Type": args.file.type },
      });
      if (!uploadRes.ok) {
        throw new Error("Upload til lageret fejlede");
      }

      return createDocumentFn({
        data: {
          name: args.name,
          category: args.category,
          related_contact_id: args.related_contact_id,
          upload_date: args.upload_date,
          notes: args.notes,
          file_path: path,
        },
      });
    },
    onSuccess: () => {
      toast.success("Dokument uploadet");
      setUploadOpen(false);
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (err) => {
      toast.error(`Upload fejlede: ${err.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: {
      id: string;
      name: string;
      category: DocumentCategory | null;
      related_contact_id: string | null;
      upload_date: string | null;
      notes: string | null;
    }) => updateDocumentFn({ data: { ...data, file_path: null } }),
    onSuccess: () => {
      toast.success("Dokument opdateret");
      setEditDoc(null);
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (err) => toast.error(`Opdatering fejlede: ${err.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDocumentFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Dokument slettet");
      setDeleteDoc(null);
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (err) => toast.error(`Sletning fejlede: ${err.message}`),
  });

  const downloadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { url } = await getSignedDownloadUrlFn({ data: { documentId: id } });
      window.open(url, "_blank", "noopener,noreferrer");
    },
    onError: (err) => toast.error(`Download fejlede: ${err.message}`),
    onSettled: () => setDownloadDoc(null),
  });

  useEffect(() => {
    if (downloadDoc) {
      downloadMutation.mutate(downloadDoc.id);
    }
  }, [downloadDoc]);

  const visibleDocs = filters.rows;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dokumenter</h1>
          <p className="text-muted-foreground mt-1">
            Upload, organisér og tilknyt dokumenter til kontakter, bygninger, maskiner og marker.
          </p>
        </div>
        <Button onClick={() => setUploadOpen(true)}>
          <FilePlus className="mr-2 h-4 w-4" />
          Upload dokument
        </Button>
      </div>

      <TableToolbar
        api={filters}
        searchPlaceholder="Søg efter navn, noter eller kontakt..."
      />

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {visibleDocs.length} {visibleDocs.length === 1 ? "dokument" : "dokumenter"}
        </span>
      </div>

      <div className="rounded-md border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {DOCUMENT_COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className="px-3 py-2.5 text-left font-medium text-muted-foreground"
                  >
                    {col.sortable ? (
                      <SortableHeader
                        label={col.label}
                        sortKey={col.key}
                        sort={filters.state.sort}
                        onToggle={filters.toggleSort}
                      />
                    ) : (
                      col.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={DOCUMENT_COLUMNS.length} className="px-3 py-8 text-center text-muted-foreground">
                    Indlæser dokumenter...
                  </td>
                </tr>
              )}
              {!isLoading && visibleDocs.length === 0 && (
                <tr>
                  <td colSpan={DOCUMENT_COLUMNS.length} className="px-3 py-8 text-center text-muted-foreground">
                    Ingen dokumenter matcher din søgning.
                  </td>
                </tr>
              )}
              {visibleDocs.map((doc) => (
                <DocumentRow
                  key={doc.id}
                  doc={doc}
                  entityLists={entityLists}
                  onEdit={() => setEditDoc(doc)}
                  onDownload={() => setDownloadDoc(doc)}
                  onDelete={() => setDeleteDoc(doc)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        contacts={contacts ?? []}
        onSubmit={(data) => createMutation.mutate(data)}
        isPending={createMutation.isPending}
      />

      {editDoc && (
        <EditDialog
          doc={editDoc}
          open={!!editDoc}
          onOpenChange={(open) => !open && setEditDoc(null)}
          contacts={contacts ?? []}
          entityLists={entityLists}
          onSubmit={(data) => updateMutation.mutate(data)}
          onAddLink={(entity_type, entity_id) =>
            addDocumentLinkFn({ data: { document_id: editDoc.id, entity_type, entity_id } }).then(() => {
              toast.success("Tilknytning tilføjet");
              queryClient.invalidateQueries({ queryKey: ["documents"] });
            })
          }
          onRemoveLink={(id) =>
            removeDocumentLinkFn({ data: { id } }).then(() => {
              toast.success("Tilknytning fjernet");
              queryClient.invalidateQueries({ queryKey: ["documents"] });
            })
          }
          isPending={updateMutation.isPending}
        />
      )}

      <AlertDialog open={!!deleteDoc} onOpenChange={(open) => !open && setDeleteDoc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet dokument</AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på, at du vil slette <strong>{deleteDoc?.name}</strong>? Filen fjernes også fra lageret.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteDoc(null)}>Annuller</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDoc && deleteMutation.mutate(deleteDoc.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Slet
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DocumentRow({
  doc,
  entityLists,
  onEdit,
  onDownload,
  onDelete,
}: {
  doc: Document;
  entityLists: EntityList;
  onEdit: () => void;
  onDownload: () => void;
  onDelete: () => void;
}) {
  const linkNames = useMemo(() => {
    return doc.links.map((link) => {
      const list = entityLists[link.entity_type];
      const match = list.find((e) => e.id === link.entity_id);
      return { ...link, label: match?.name ?? ENTITY_TYPE_LABELS[link.entity_type] };
    });
  }, [doc.links, entityLists]);

  return (
    <tr className="border-t hover:bg-muted/30 transition-colors">
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-medium">{doc.name}</span>
        </div>
      </td>
      <td className="px-3 py-2">
        {doc.category ? (
          <Badge variant="secondary" className="font-normal">
            <Tag className="mr-1 h-3 w-3" />
            {CATEGORY_LABELS[doc.category]}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-2">
        {doc.contact_name ? (
          <span className="flex items-center gap-1 text-muted-foreground">
            <User className="h-3.5 w-3.5" />
            {doc.contact_name}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        {doc.upload_date ? (
          <span className="flex items-center gap-1 text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />
            {doc.upload_date}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap gap-1">
          {linkNames.length === 0 && <span className="text-muted-foreground">—</span>}
          {linkNames.map((link) => (
            <Badge key={link.id} variant="outline" className="font-normal text-xs">
              <LinkIcon className="mr-1 h-3 w-3" />
              {ENTITY_TYPE_LABELS[link.entity_type]}: {link.label}
            </Badge>
          ))}
        </div>
      </td>
      <td className="px-3 py-2 max-w-xs">
        {doc.notes ? (
          <span className="text-muted-foreground truncate block" title={doc.notes}>
            {doc.notes}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDownload} title="Download">
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit} title="Rediger">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDelete} title="Slet">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

function UploadDialog({
  open,
  onOpenChange,
  contacts,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: Contact[];
  onSubmit: (data: {
    file: File;
    name: string;
    category: DocumentCategory | null;
    related_contact_id: string | null;
    upload_date: string | null;
    notes: string | null;
  }) => void;
  isPending: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<DocumentCategory | null>(null);
  const [relatedContactId, setRelatedContactId] = useState<string | null>(null);
  const [uploadDate, setUploadDate] = useState(defaultDate());
  const [notes, setNotes] = useState("");
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setName("");
      setCategory(null);
      setRelatedContactId(null);
      setUploadDate(defaultDate());
      setNotes("");
    }
  }, [open]);

  useEffect(() => {
    if (file && !name) {
      setName(file.name.replace(/\.[^/.]+$/, ""));
    }
  }, [file, name]);

  const handleFiles = (files: FileList | null) => {
    if (files && files[0]) {
      setFile(files[0]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload dokument</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFiles(e.dataTransfer.files);
            }}
          >
            <Input
              type="file"
              className="hidden"
              id="document-upload"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <label htmlFor="document-upload" className="cursor-pointer block">
              <FilePlus className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm font-medium">
                {file ? file.name : "Træk en fil hertil, eller klik for at vælge"}
              </p>
              {file && (
                <p className="text-xs text-muted-foreground mt-1">
                  {formatFileSize(file.size)} · {file.type || "ukendt type"}
                </p>
              )}
            </label>
          </div>

          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="doc-name">Navn</Label>
              <Input id="doc-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label>Kategori</Label>
                <Select
                  value={category ?? "__none__"}
                  onValueChange={(v) => setCategory(v === "__none__" ? null : (v as DocumentCategory))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Vælg kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">(ingen)</SelectItem>
                    {DOCUMENT_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {CATEGORY_LABELS[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Dato</Label>
                <Input type="date" value={uploadDate} onChange={(e) => setUploadDate(e.target.value)} />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>Kontakt</Label>
              <Select
                value={relatedContactId ?? "__none__"}
                onValueChange={(v) => setRelatedContactId(v === "__none__" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vælg kontakt" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">(ingen)</SelectItem>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label>Noter</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuller
          </Button>
          <Button
            disabled={!file || !name.trim() || isPending}
            onClick={() =>
              file &&
              onSubmit({
                file,
                name: name.trim(),
                category,
                related_contact_id: relatedContactId,
                upload_date: uploadDate || null,
                notes: notes.trim() || null,
              })
            }
          >
            {isPending ? "Uploader..." : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({
  doc,
  open,
  onOpenChange,
  contacts,
  entityLists,
  onSubmit,
  onAddLink,
  onRemoveLink,
  isPending,
}: {
  doc: Document;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: Contact[];
  entityLists: EntityList;
  onSubmit: (data: {
    id: string;
    name: string;
    category: DocumentCategory | null;
    related_contact_id: string | null;
    upload_date: string | null;
    notes: string | null;
  }) => void;
  onAddLink: (entity_type: EntityType, entity_id: string) => Promise<void>;
  onRemoveLink: (id: string) => Promise<void>;
  isPending: boolean;
}) {
  const [name, setName] = useState(doc.name);
  const [category, setCategory] = useState<DocumentCategory | null>(doc.category);
  const [relatedContactId, setRelatedContactId] = useState<string | null>(doc.related_contact_id);
  const [uploadDate, setUploadDate] = useState(doc.upload_date ?? defaultDate());
  const [notes, setNotes] = useState(doc.notes ?? "");
  const [linkEntityType, setLinkEntityType] = useState<EntityType | "">("");
  const [linkEntityId, setLinkEntityId] = useState<string>("");

  const availableOptions = linkEntityType ? entityLists[linkEntityType] ?? [] : [];

  const handleAddLink = () => {
    if (!linkEntityType || !linkEntityId) return;
    onAddLink(linkEntityType, linkEntityId).then(() => {
      setLinkEntityType("");
      setLinkEntityId("");
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Rediger dokument</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-2">
          <div className="space-y-4">
            <div className="grid gap-1.5">
              <Label>Navn</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label>Kategori</Label>
                <Select
                  value={category ?? "__none__"}
                  onValueChange={(v) => setCategory(v === "__none__" ? null : (v as DocumentCategory))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Vælg kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">(ingen)</SelectItem>
                    {DOCUMENT_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {CATEGORY_LABELS[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Dato</Label>
                <Input type="date" value={uploadDate} onChange={(e) => setUploadDate(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Kontakt</Label>
              <Select
                value={relatedContactId ?? "__none__"}
                onValueChange={(v) => setRelatedContactId(v === "__none__" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vælg kontakt" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">(ingen)</SelectItem>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Noter</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid gap-1.5">
              <Label>Tilknytninger</Label>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Select value={linkEntityType} onValueChange={(v) => setLinkEntityType(v as EntityType | "")}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Vælg type</SelectItem>
                      {ENTITY_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {ENTITY_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={linkEntityId} onValueChange={setLinkEntityId} disabled={!linkEntityType}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder={linkEntityType ? "Vælg enhed" : "Vælg type først"} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableOptions.map((opt) => (
                        <SelectItem key={opt.id} value={opt.id}>
                          {opt.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={!linkEntityType || !linkEntityId}
                    onClick={handleAddLink}
                  >
                    <LinkIcon className="h-4 w-4" />
                  </Button>
                </div>

                <div className="border rounded-md p-2 min-h-[120px]">
                  {doc.links.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Ingen tilknytninger endnu.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {doc.links.map((link) => {
                        const list = entityLists[link.entity_type];
                        const match = list.find((e) => e.id === link.entity_id);
                        return (
                          <li
                            key={link.id}
                            className="flex items-center justify-between text-sm bg-muted/50 rounded px-2 py-1.5"
                          >
                            <span>
                              <span className="text-muted-foreground">{ENTITY_TYPE_LABELS[link.entity_type]}:</span>{" "}
                              {match?.name ?? "Ukendt"}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => onRemoveLink(link.id)}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuller
          </Button>
          <Button
            disabled={!name.trim() || isPending}
            onClick={() =>
              onSubmit({
                id: doc.id,
                name: name.trim(),
                category,
                related_contact_id: relatedContactId,
                upload_date: uploadDate || null,
                notes: notes.trim() || null,
              })
            }
          >
            {isPending ? "Gemmer..." : "Gem"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
