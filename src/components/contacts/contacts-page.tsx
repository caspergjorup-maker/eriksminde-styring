import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  CONTACT_TYPES,
  type Contact,
  type ContactType,
  createContact,
  deleteContact,
  listContacts,
  updateContact,
} from "@/lib/contacts.functions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

const TYPE_LABELS: Record<ContactType, string> = {
  customer: "Kunde",
  tenant: "Lejer",
  leaseholder: "Forpagter",
  hunting_tenant: "Jagtlejer",
  supplier: "Leverandør",
};

const CUSTOMER_TYPES: ContactType[] = ["customer", "tenant", "leaseholder", "hunting_tenant"];

export function ContactsPage({
  kind,
  title,
  description,
}: {
  kind: "customers" | "suppliers";
  title: string;
  description: string;
}) {
  const qc = useQueryClient();
  const list = useServerFn(listContacts);
  const create = useServerFn(createContact);
  const update = useServerFn(updateContact);
  const remove = useServerFn(deleteContact);

  const queryKey = ["contacts", kind];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => list({ data: { kind } }),
  });

  const [editing, setEditing] = useState<Contact | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<Contact | null>(null);

  const onSaved = () => {
    qc.invalidateQueries({ queryKey });
    setEditing(null);
    setCreating(false);
  };

  const deleteMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Slettet");
      qc.invalidateQueries({ queryKey });
      setToDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = data ?? [];

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--brand-900)]">{title}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-1" /> Ny {kind === "suppliers" ? "leverandør" : "kontakt"}
        </Button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Navn</th>
              <th className="px-4 py-2.5 font-medium">Type</th>
              <th className="px-4 py-2.5 font-medium">Telefon</th>
              <th className="px-4 py-2.5 font-medium">Email</th>
              <th className="px-4 py-2.5 font-medium">CVR</th>
              <th className="px-4 py-2.5 w-24"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Indlæser…</td></tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Ingen kontakter endnu.</td></tr>
            )}
            {rows.map((c) => (
              <tr key={c.id} className="hover:bg-muted/30">
                <td className="px-4 py-2.5 font-medium">{c.name}</td>
                <td className="px-4 py-2.5">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-[var(--brand-50)] text-[var(--brand-900)]">
                    {TYPE_LABELS[c.type]}
                  </span>
                </td>
                <td className="px-4 py-2.5 tabular-nums">{c.phone ?? "—"}</td>
                <td className="px-4 py-2.5">{c.email ?? "—"}</td>
                <td className="px-4 py-2.5 tabular-nums">{c.cvr ?? "—"}</td>
                <td className="px-4 py-2.5 text-right">
                  <button onClick={() => setEditing(c)} className="p-1.5 rounded hover:bg-muted" aria-label="Rediger">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => setToDelete(c)} className="p-1.5 rounded hover:bg-muted text-red-600" aria-label="Slet">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ContactDialog
        open={creating || editing != null}
        onOpenChange={(o) => { if (!o) { setCreating(false); setEditing(null); } }}
        kind={kind}
        contact={editing}
        onSubmit={async (values) => {
          try {
            if (editing) {
              await update({ data: { id: editing.id, ...values } });
              toast.success("Opdateret");
            } else {
              await create({ data: values });
              toast.success("Oprettet");
            }
            onSaved();
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      />

      <AlertDialog open={toDelete != null} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet kontakt</AlertDialogTitle>
            <AlertDialogDescription>
              Slet "{toDelete?.name}"? Dette kan ikke fortrydes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annullér</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toDelete && deleteMut.mutate(toDelete.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Slet
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type FormValues = {
  type: ContactType;
  name: string;
  cvr: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
};

function ContactDialog({
  open,
  onOpenChange,
  kind,
  contact,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  kind: "customers" | "suppliers";
  contact: Contact | null;
  onSubmit: (v: FormValues) => Promise<void>;
}) {
  const defaultType: ContactType = kind === "suppliers" ? "supplier" : "customer";
  const [values, setValues] = useState<FormValues>({
    type: defaultType,
    name: "",
    cvr: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  // Reset form when dialog opens
  const initKey = `${open}-${contact?.id ?? "new"}`;
  const [lastKey, setLastKey] = useState("");
  if (open && lastKey !== initKey) {
    setLastKey(initKey);
    setValues({
      type: contact?.type ?? defaultType,
      name: contact?.name ?? "",
      cvr: contact?.cvr ?? "",
      phone: contact?.phone ?? "",
      email: contact?.email ?? "",
      address: contact?.address ?? "",
      notes: contact?.notes ?? "",
    });
  }

  const typeOptions = kind === "suppliers" ? (["supplier"] as ContactType[]) : CUSTOMER_TYPES;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{contact ? "Rediger kontakt" : "Ny kontakt"}</DialogTitle>
          <DialogDescription>Stamdata gemmes med det samme.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!values.name.trim()) return;
            setSaving(true);
            try {
              await onSubmit(values);
            } finally {
              setSaving(false);
            }
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="type">Type</Label>
              <Select
                value={values.type}
                onValueChange={(v) => setValues({ ...values, type: v as ContactType })}
                disabled={kind === "suppliers"}
              >
                <SelectTrigger id="type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {typeOptions.map((t) => (
                    <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name">Navn *</Label>
              <Input id="name" required maxLength={200} value={values.name}
                onChange={(e) => setValues({ ...values, name: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="phone">Telefon</Label>
              <Input id="phone" maxLength={40} value={values.phone}
                onChange={(e) => setValues({ ...values, phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" maxLength={255} value={values.email}
                onChange={(e) => setValues({ ...values, email: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cvr">CVR</Label>
            <Input id="cvr" maxLength={20} value={values.cvr}
              onChange={(e) => setValues({ ...values, cvr: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="address">Adresse</Label>
            <Input id="address" maxLength={500} value={values.address}
              onChange={(e) => setValues({ ...values, address: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Noter</Label>
            <Textarea id="notes" maxLength={2000} rows={3} value={values.notes}
              onChange={(e) => setValues({ ...values, notes: e.target.value })} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annullér</Button>
            <Button type="submit" disabled={saving}>{saving ? "Gemmer…" : "Gem"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Ensure CONTACT_TYPES is referenced so tree-shake keeps types aligned
void CONTACT_TYPES;
