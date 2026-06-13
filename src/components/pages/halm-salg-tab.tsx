import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDownLeft, ArrowUpRight, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  BALE_TYPES,
  BALE_TYPE_LABEL,
  createStrawMovement,
  deleteStrawMovement,
  listStrawContacts,
  listStrawMovements,
  updateStrawMovement,
  type StrawMovementRow,
} from "@/lib/straw.functions";
import { formatDKK, formatDate, formatNumber } from "@/lib/format";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TableToolbar,
  SortableHeader,
  useTableFilters,
  type FilterColumn,
} from "@/components/table-filters";



const NONE = "__none__";

type FormState = {
  bale_type: string;
  quantity: string;
  direction: "in" | "out";
  contact_id: string | null;
  unit_price: string;
  movement_date: string;
  notes: string;
};

const empty: FormState = {
  bale_type: "bigballe",
  quantity: "",
  direction: "out",
  contact_id: null,
  unit_price: "",
  movement_date: new Date().toISOString().slice(0, 10),
  notes: "",
};

function labelFor(bt: string) {
  return (BALE_TYPE_LABEL as Record<string, string>)[bt] ?? bt;
}

export function HalmSalgPage() {
  const qc = useQueryClient();
  const list = useServerFn(listStrawMovements);
  const contactsFn = useServerFn(listStrawContacts);
  const create = useServerFn(createStrawMovement);
  const update = useServerFn(updateStrawMovement);
  const remove = useServerFn(deleteStrawMovement);

  const [filter, setFilter] = useState<"all" | "in" | "out">("all");

  const { data: allRows = [], isLoading } = useQuery({
    queryKey: ["straw-movements", filter],
    queryFn: () => list({ data: { direction: filter } }),
  });
  const movementCols: FilterColumn<StrawMovementRow>[] = [
    { key: "movement_date", label: "Dato", sortable: true, sortValue: (r) => r.movement_date ?? "" },
    { key: "direction", label: "Retning", type: "enum", get: (r) => r.direction, options: [{ value: "out", label: "Salg" }, { value: "in", label: "Køb" }], sortable: true, sortValue: (r) => r.direction },
    { key: "bale_type", label: "Balletype", type: "enum", get: (r) => r.bale_type, options: BALE_TYPES.map((t) => ({ value: t, label: BALE_TYPE_LABEL[t] })), sortable: true, sortValue: (r) => r.bale_type },
    { key: "contact", label: "Kontakt", type: "enum", get: (r) => r.contact_name ?? "", sortable: true, sortValue: (r) => r.contact_name ?? "" },
    { key: "quantity", label: "Antal", type: "number", get: (r) => r.quantity, sortable: true, sortValue: (r) => r.quantity },
    { key: "unit_price", label: "Pris/stk", type: "number", get: (r) => Number(r.unit_price), sortable: true, sortValue: (r) => Number(r.unit_price) },
    { key: "total_amount", label: "Beløb", type: "number", get: (r) => Number(r.total_amount ?? 0), sortable: true, sortValue: (r) => Number(r.total_amount ?? 0) },
  ];
  const tableFilters = useTableFilters({
    rows: allRows,
    columns: movementCols,
    searchFields: [(r) => r.contact_name ?? "", (r) => labelFor(r.bale_type), (r) => r.notes ?? ""],
  });
  const rows = tableFilters.rows;
  const { data: contacts = [] } = useQuery({
    queryKey: ["straw-contacts"],
    queryFn: () => contactsFn(),
  });

  const [editing, setEditing] = useState<StrawMovementRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<StrawMovementRow | null>(null);

  const open = creating || editing != null;

  const deleteMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Slettet");
      qc.invalidateQueries({ queryKey: ["straw-movements"] });
      setToDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totalSales = rows.filter((r) => r.direction === "out").reduce((s, r) => s + Number(r.total_amount ?? 0), 0);
  const totalPurchases = rows.filter((r) => r.direction === "in").reduce((s, r) => s + Number(r.total_amount ?? 0), 0);

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--brand-900)]">Halm — Salg & køb</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Bevægelser, kunder og leverandører</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-1" /> Ny bevægelse
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">
            <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" /> Salg (filtreret)
          </div>
          <div className="text-2xl font-semibold mt-1 tabular-nums">{formatDKK(totalSales)}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">
            <ArrowDownLeft className="h-3.5 w-3.5 text-amber-600" /> Køb (filtreret)
          </div>
          <div className="text-2xl font-semibold mt-1 tabular-nums">{formatDKK(totalPurchases)}</div>
        </div>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)} className="mb-4">
        <TabsList>
          <TabsTrigger value="all">Alle</TabsTrigger>
          <TabsTrigger value="out">Salg</TabsTrigger>
          <TabsTrigger value="in">Køb</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Dato</th>
              <th className="px-4 py-2.5 font-medium">Retning</th>
              <th className="px-4 py-2.5 font-medium">Balletype</th>
              <th className="px-4 py-2.5 font-medium">Kontakt</th>
              <th className="px-4 py-2.5 font-medium text-right">Antal</th>
              <th className="px-4 py-2.5 font-medium text-right">Pris/stk</th>
              <th className="px-4 py-2.5 font-medium text-right">Beløb</th>
              <th className="px-4 py-2.5 w-24"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">Indlæser…</td></tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">Ingen bevægelser endnu.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-muted/30">
                <td className="px-4 py-2.5 text-muted-foreground">{formatDate(r.movement_date)}</td>
                <td className="px-4 py-2.5">
                  {r.direction === "out" ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-emerald-100 text-emerald-900">
                      <ArrowUpRight className="h-3 w-3" /> Salg
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-amber-100 text-amber-900">
                      <ArrowDownLeft className="h-3 w-3" /> Køb
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5">{labelFor(r.bale_type)}</td>
                <td className="px-4 py-2.5">{r.contact_name ?? "—"}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatNumber(r.quantity)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatDKK(r.unit_price)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums font-medium">{formatDKK(r.total_amount ?? 0)}</td>
                <td className="px-4 py-2.5 text-right">
                  <button onClick={() => setEditing(r)} className="p-1.5 rounded hover:bg-muted" aria-label="Rediger"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => setToDelete(r)} className="p-1.5 rounded hover:bg-muted text-red-600" aria-label="Slet"><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <MovementDialog
        open={open}
        editing={editing}
        contacts={contacts}
        onOpenChange={(o) => { if (!o) { setCreating(false); setEditing(null); } }}
        onSubmit={async (v) => {
          const payload = {
            bale_type: v.bale_type,
            quantity: parseInt(v.quantity, 10) || 0,
            direction: v.direction,
            contact_id: v.contact_id,
            unit_price: Number(v.unit_price) || 0,
            movement_date: v.movement_date || null,
            notes: v.notes || null,
          };
          try {
            if (editing) {
              await update({ data: { id: editing.id, ...payload } });
              toast.success("Opdateret");
            } else {
              await create({ data: payload });
              toast.success("Oprettet");
            }
            qc.invalidateQueries({ queryKey: ["straw-movements"] });
            setCreating(false); setEditing(null);
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      />

      <AlertDialog open={toDelete != null} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet bevægelse</AlertDialogTitle>
            <AlertDialogDescription>
              Slet bevægelsen ({toDelete?.quantity} stk {labelFor(toDelete?.bale_type ?? "")})? Dette kan ikke fortrydes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annullér</AlertDialogCancel>
            <AlertDialogAction onClick={() => toDelete && deleteMut.mutate(toDelete.id)} className="bg-red-600 hover:bg-red-700">Slet</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MovementDialog({
  open, editing, contacts, onOpenChange, onSubmit,
}: {
  open: boolean;
  editing: StrawMovementRow | null;
  contacts: { id: string; name: string; type: string }[];
  onOpenChange: (o: boolean) => void;
  onSubmit: (v: FormState) => Promise<void>;
}) {
  const [values, setValues] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);
  const key = `${open}-${editing?.id ?? "new"}`;
  const [lastKey, setLastKey] = useState("");
  if (open && lastKey !== key) {
    setLastKey(key);
    setValues(
      editing
        ? {
            bale_type: editing.bale_type,
            quantity: String(editing.quantity),
            direction: editing.direction,
            contact_id: editing.contact_id,
            unit_price: String(editing.unit_price),
            movement_date: editing.movement_date ?? "",
            notes: editing.notes ?? "",
          }
        : empty,
    );
  }
  const total = (parseInt(values.quantity, 10) || 0) * (Number(values.unit_price) || 0);
  const filteredContacts = contacts.filter((c) =>
    values.direction === "in" ? c.type === "supplier" : c.type !== "supplier",
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Rediger bevægelse" : "Ny bevægelse"}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            try { await onSubmit(values); } finally { setSaving(false); }
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Retning</Label>
              <Select value={values.direction} onValueChange={(v) => setValues({ ...values, direction: v as "in" | "out", contact_id: null })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="out">Salg (ud)</SelectItem>
                  <SelectItem value="in">Køb (ind)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Balletype</Label>
              <Select value={values.bale_type} onValueChange={(v) => setValues({ ...values, bale_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BALE_TYPES.map((t) => <SelectItem key={t} value={t}>{BALE_TYPE_LABEL[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{values.direction === "in" ? "Leverandør" : "Kunde"}</Label>
            <Select
              value={values.contact_id ?? NONE}
              onValueChange={(v) => setValues({ ...values, contact_id: v === NONE ? null : v })}
            >
              <SelectTrigger><SelectValue placeholder="Vælg…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— Ingen —</SelectItem>
                {filteredContacts.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="qty">Antal</Label>
              <Input id="qty" type="number" step="1" min="1" value={values.quantity}
                onChange={(e) => setValues({ ...values, quantity: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="up">Pris/stk (kr)</Label>
              <Input id="up" type="number" step="0.01" min="0" value={values.unit_price}
                onChange={(e) => setValues({ ...values, unit_price: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="md">Dato</Label>
              <Input id="md" type="date" value={values.movement_date}
                onChange={(e) => setValues({ ...values, movement_date: e.target.value })} />
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Beløb: <span className="font-medium text-foreground">{formatDKK(total)}</span>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Noter</Label>
            <Textarea id="notes" rows={3} maxLength={2000} value={values.notes}
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
