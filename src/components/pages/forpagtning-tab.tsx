import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  createLandLease,
  deleteLandLease,
  listLandLeases,
  listLeaseholders,
  updateLandLease,
  type LandLease,
} from "@/lib/land-leases.functions";
import { formatDKK, formatDate, daysUntil } from "@/lib/format";
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

const LEASE_COLUMNS: FilterColumn<LandLease>[] = [
  {
    key: "leaseholder",
    label: "Forpagter",
    type: "enum",
    get: (r) => r.leaseholder_name ?? "",
    sortable: true,
    sortValue: (r) => r.leaseholder_name ?? "",
  },
  { key: "area_ha", label: "Areal (ha)", type: "number", get: (r) => r.area_ha, sortable: true, sortValue: (r) => r.area_ha },
  { key: "price_per_ha", label: "Pris/ha", type: "number", get: (r) => r.price_per_ha, sortable: true, sortValue: (r) => r.price_per_ha },
  { key: "annual_fee", label: "Årlig leje", type: "number", get: (r) => r.annual_fee ?? null, sortable: true, sortValue: (r) => r.annual_fee ?? null },
  { key: "contract_end", label: "Udløb", sortable: true, sortValue: (r) => r.contract_end ?? "" },
];


const NONE = "__none__";

type FormState = {
  leaseholder_id: string | null;
  area_ha: string;
  price_per_ha: string;
  contract_start: string;
  contract_end: string;
  notes: string;
};

const empty: FormState = {
  leaseholder_id: null,
  area_ha: "",
  price_per_ha: "",
  contract_start: "",
  contract_end: "",
  notes: "",
};

export function LandbrugsjordPage() {
  const qc = useQueryClient();
  const list = useServerFn(listLandLeases);
  const leaseholders = useServerFn(listLeaseholders);
  const create = useServerFn(createLandLease);
  const update = useServerFn(updateLandLease);
  const remove = useServerFn(deleteLandLease);

  const { data: allRows = [], isLoading } = useQuery({
    queryKey: ["land-leases"],
    queryFn: () => list(),
  });
  const filters = useTableFilters({
    rows: allRows,
    columns: LEASE_COLUMNS,
    searchFields: [
      (r) => r.leaseholder_name ?? "",
      (r) => r.field_names.join(" "),
      (r) => r.notes ?? "",
    ],
  });
  const rows = filters.rows;
  const { data: holders = [] } = useQuery({
    queryKey: ["contacts-leaseholders"],
    queryFn: () => leaseholders(),
  });

  const [editing, setEditing] = useState<LandLease | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<LandLease | null>(null);

  const open = creating || editing != null;
  const deleteMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Slettet");
      qc.invalidateQueries({ queryKey: ["land-leases"] });
      setToDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--brand-900)]">Landbrugsjord</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Forpagtninger og forpagtere</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-1" /> Ny forpagtning
        </Button>
      </div>

      <TableToolbar api={filters} searchPlaceholder="Søg forpagter, mark, noter…" />

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <SortableHeader label="Forpagter" sortKey="leaseholder" sort={filters.sort} onToggle={filters.toggleSort} className="px-4 py-2.5" />
              <th className="px-4 py-2.5 font-medium">Marker</th>
              <SortableHeader label="Areal (ha)" sortKey="area_ha" sort={filters.sort} onToggle={filters.toggleSort} align="right" className="px-4 py-2.5" />
              <SortableHeader label="Pris/ha" sortKey="price_per_ha" sort={filters.sort} onToggle={filters.toggleSort} align="right" className="px-4 py-2.5" />
              <SortableHeader label="Årlig leje" sortKey="annual_fee" sort={filters.sort} onToggle={filters.toggleSort} align="right" className="px-4 py-2.5" />
              <th className="px-4 py-2.5 font-medium">Periode</th>
              <SortableHeader label="Udløb" sortKey="contract_end" sort={filters.sort} onToggle={filters.toggleSort} className="px-4 py-2.5" />
              <th className="px-4 py-2.5 w-24"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">Indlæser…</td></tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">Ingen forpagtninger endnu.</td></tr>
            )}
            {rows.map((r) => {
              const days = daysUntil(r.contract_end);
              const tone =
                days == null ? "muted" : days < 0 ? "red" : days < 30 ? "red" : days < 90 ? "yellow" : "green";
              const toneCls = {
                muted: "bg-muted text-muted-foreground",
                green: "bg-[var(--brand-50)] text-[var(--brand-900)]",
                yellow: "bg-amber-100 text-amber-900",
                red: "bg-red-100 text-red-900",
              }[tone];
              return (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium">{r.leaseholder_name ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    {r.field_names.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {r.field_names.map((n) => (
                          <span key={n} className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-muted text-foreground">
                            {n}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.area_ha.toLocaleString("da-DK")}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatDKK(r.price_per_ha)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-medium">{formatDKK(r.annual_fee ?? 0)}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {formatDate(r.contract_start)} – {formatDate(r.contract_end)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] ${toneCls}`}>
                      {days == null ? "—" : days < 0 ? `${-days} d siden` : `${days} dage`}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => setEditing(r)} className="p-1.5 rounded hover:bg-muted" aria-label="Rediger"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => setToDelete(r)} className="p-1.5 rounded hover:bg-muted text-red-600" aria-label="Slet"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <LandLeaseDialog
        open={open}
        editing={editing}
        holders={holders}
        onOpenChange={(o) => { if (!o) { setCreating(false); setEditing(null); } }}
        onSubmit={async (v) => {
          const payload = {
            leaseholder_id: v.leaseholder_id,
            area_ha: Number(v.area_ha) || 0,
            price_per_ha: Number(v.price_per_ha) || 0,
            contract_start: v.contract_start || null,
            contract_end: v.contract_end || null,
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
            qc.invalidateQueries({ queryKey: ["land-leases"] });
            setCreating(false); setEditing(null);
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      />

      <AlertDialog open={toDelete != null} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet forpagtning</AlertDialogTitle>
            <AlertDialogDescription>
              Slet forpagtning med "{toDelete?.leaseholder_name ?? "—"}"? Dette kan ikke fortrydes.
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

function LandLeaseDialog({
  open, editing, holders, onOpenChange, onSubmit,
}: {
  open: boolean;
  editing: LandLease | null;
  holders: { id: string; name: string }[];
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
            leaseholder_id: editing.leaseholder_id,
            area_ha: String(editing.area_ha ?? ""),
            price_per_ha: String(editing.price_per_ha ?? ""),
            contract_start: editing.contract_start ?? "",
            contract_end: editing.contract_end ?? "",
            notes: editing.notes ?? "",
          }
        : empty,
    );
  }
  const annual = (Number(values.area_ha) || 0) * (Number(values.price_per_ha) || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Rediger forpagtning" : "Ny forpagtning"}</DialogTitle>
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
            <Label>Forpagter</Label>
            <Select
              value={values.leaseholder_id ?? NONE}
              onValueChange={(v) => setValues({ ...values, leaseholder_id: v === NONE ? null : v })}
            >
              <SelectTrigger><SelectValue placeholder="Vælg…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— Ingen —</SelectItem>
                {holders.map((h) => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="area">Areal (ha)</Label>
              <Input id="area" type="number" step="0.01" min="0" value={values.area_ha}
                onChange={(e) => setValues({ ...values, area_ha: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pricepha">Pris pr. ha (kr)</Label>
              <Input id="pricepha" type="number" step="1" min="0" value={values.price_per_ha}
                onChange={(e) => setValues({ ...values, price_per_ha: e.target.value })} />
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Beregnet årlig leje: <span className="font-medium text-foreground">{formatDKK(annual)}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cs">Kontrakt start</Label>
              <Input id="cs" type="date" value={values.contract_start}
                onChange={(e) => setValues({ ...values, contract_start: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ce">Kontrakt slut</Label>
              <Input id="ce" type="date" value={values.contract_end}
                onChange={(e) => setValues({ ...values, contract_end: e.target.value })} />
            </div>
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
