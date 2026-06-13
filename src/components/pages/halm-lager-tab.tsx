import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  BALE_TYPES,
  BALE_TYPE_LABEL,
  createStrawInventory,
  deleteStrawInventory,
  listStrawInventory,
  updateStrawInventory,
  type StrawInventoryRow,
} from "@/lib/straw.functions";
import { formatDKK, formatNumber } from "@/lib/format";
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
import {
  TableToolbar,
  SortableHeader,
  useTableFilters,
  type FilterColumn,
} from "@/components/table-filters";



type FormState = {
  bale_type: string;
  quantity: string;
  price_per_unit: string;
  harvest_year: string;
  notes: string;
};

const empty: FormState = {
  bale_type: "bigballe",
  quantity: "",
  price_per_unit: "",
  harvest_year: String(new Date().getFullYear()),
  notes: "",
};

function labelFor(bt: string) {
  return (BALE_TYPE_LABEL as Record<string, string>)[bt] ?? bt;
}

export function HalmLagerPage() {
  const qc = useQueryClient();
  const list = useServerFn(listStrawInventory);
  const create = useServerFn(createStrawInventory);
  const update = useServerFn(updateStrawInventory);
  const remove = useServerFn(deleteStrawInventory);

  const { data: allRows = [], isLoading } = useQuery({
    queryKey: ["straw-inventory"],
    queryFn: () => list(),
  });

  const columns: FilterColumn<StrawInventoryRow>[] = [
    { key: "bale_type", label: "Balletype", type: "enum", get: (r) => r.bale_type, options: BALE_TYPES.map((t) => ({ value: t, label: BALE_TYPE_LABEL[t] })), sortable: true, sortValue: (r) => r.bale_type },
    { key: "harvest_year", label: "Høstår", type: "enum", get: (r) => String(r.harvest_year ?? ""), sortable: true, sortValue: (r) => r.harvest_year ?? 0 },
    { key: "quantity", label: "Antal", type: "number", get: (r) => r.quantity, sortable: true, sortValue: (r) => r.quantity },
    { key: "price_per_unit", label: "Pris/stk", type: "number", get: (r) => Number(r.price_per_unit), sortable: true, sortValue: (r) => Number(r.price_per_unit) },
    { key: "value", label: "Værdi", type: "number", get: (r) => r.quantity * Number(r.price_per_unit), sortable: true, sortValue: (r) => r.quantity * Number(r.price_per_unit) },
  ];
  const filters = useTableFilters({
    rows: allRows,
    columns,
    searchFields: [(r) => labelFor(r.bale_type), (r) => r.notes ?? ""],
  });
  const rows = filters.rows;

  const [editing, setEditing] = useState<StrawInventoryRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<StrawInventoryRow | null>(null);

  const open = creating || editing != null;
  const totalValue = rows.reduce(
    (sum, r) => sum + r.quantity * Number(r.price_per_unit),
    0,
  );
  const totalQty = rows.reduce((sum, r) => sum + r.quantity, 0);

  const deleteMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Slettet");
      qc.invalidateQueries({ queryKey: ["straw-inventory"] });
      setToDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--brand-900)]">Halmlager</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Beholdning pr. balletype og høstår
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-1" /> Ny beholdning
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Antal baller</div>
          <div className="text-2xl font-semibold mt-1 tabular-nums">{formatNumber(totalQty)}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Lagerværdi</div>
          <div className="text-2xl font-semibold mt-1 tabular-nums">{formatDKK(totalValue)}</div>
        </div>
      </div>

      <TableToolbar api={filters} searchPlaceholder="Søg balletype, noter…" />

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <SortableHeader label="Balletype" sortKey="bale_type" sort={filters.sort} onToggle={filters.toggleSort} className="px-4 py-2.5" />
              <SortableHeader label="Høstår" sortKey="harvest_year" sort={filters.sort} onToggle={filters.toggleSort} className="px-4 py-2.5" />
              <SortableHeader label="Antal" sortKey="quantity" sort={filters.sort} onToggle={filters.toggleSort} align="right" className="px-4 py-2.5" />
              <SortableHeader label="Pris/stk" sortKey="price_per_unit" sort={filters.sort} onToggle={filters.toggleSort} align="right" className="px-4 py-2.5" />
              <SortableHeader label="Værdi" sortKey="value" sort={filters.sort} onToggle={filters.toggleSort} align="right" className="px-4 py-2.5" />
              <th className="px-4 py-2.5 font-medium">Noter</th>
              <th className="px-4 py-2.5 w-24"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">Indlæser…</td></tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">Ingen beholdning endnu.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-muted/30">
                <td className="px-4 py-2.5 font-medium">{labelFor(r.bale_type)}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{r.harvest_year ?? "—"}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatNumber(r.quantity)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatDKK(r.price_per_unit)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                  {formatDKK(r.quantity * Number(r.price_per_unit))}
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground truncate max-w-xs">{r.notes ?? "—"}</td>
                <td className="px-4 py-2.5 text-right">
                  <button onClick={() => setEditing(r)} className="p-1.5 rounded hover:bg-muted" aria-label="Rediger"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => setToDelete(r)} className="p-1.5 rounded hover:bg-muted text-red-600" aria-label="Slet"><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <InventoryDialog
        open={open}
        editing={editing}
        onOpenChange={(o) => { if (!o) { setCreating(false); setEditing(null); } }}
        onSubmit={async (v) => {
          const payload = {
            bale_type: v.bale_type,
            quantity: parseInt(v.quantity, 10) || 0,
            price_per_unit: Number(v.price_per_unit) || 0,
            harvest_year: v.harvest_year ? parseInt(v.harvest_year, 10) : null,
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
            qc.invalidateQueries({ queryKey: ["straw-inventory"] });
            setCreating(false); setEditing(null);
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      />

      <AlertDialog open={toDelete != null} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet beholdning</AlertDialogTitle>
            <AlertDialogDescription>
              Slet {labelFor(toDelete?.bale_type ?? "")} ({toDelete?.quantity} stk)? Dette kan ikke fortrydes.
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

function InventoryDialog({
  open, editing, onOpenChange, onSubmit,
}: {
  open: boolean;
  editing: StrawInventoryRow | null;
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
            price_per_unit: String(editing.price_per_unit),
            harvest_year: editing.harvest_year ? String(editing.harvest_year) : "",
            notes: editing.notes ?? "",
          }
        : empty,
    );
  }
  const value = (parseInt(values.quantity, 10) || 0) * (Number(values.price_per_unit) || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Rediger beholdning" : "Ny beholdning"}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            try { await onSubmit(values); } finally { setSaving(false); }
          }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label>Balletype</Label>
            <Select value={values.bale_type} onValueChange={(v) => setValues({ ...values, bale_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BALE_TYPES.map((t) => <SelectItem key={t} value={t}>{BALE_TYPE_LABEL[t]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="qty">Antal</Label>
              <Input id="qty" type="number" step="1" min="0" value={values.quantity}
                onChange={(e) => setValues({ ...values, quantity: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ppu">Pris/stk (kr)</Label>
              <Input id="ppu" type="number" step="0.01" min="0" value={values.price_per_unit}
                onChange={(e) => setValues({ ...values, price_per_unit: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hy">Høstår</Label>
              <Input id="hy" type="number" step="1" min="1990" max="2100" value={values.harvest_year}
                onChange={(e) => setValues({ ...values, harvest_year: e.target.value })} />
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Beregnet værdi: <span className="font-medium text-foreground">{formatDKK(value)}</span>
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
