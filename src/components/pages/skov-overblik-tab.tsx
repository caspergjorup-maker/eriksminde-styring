import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, Plus, Trash2, Trees } from "lucide-react";
import { toast } from "sonner";

import {
  PARCEL_STATUS,
  PARCEL_STATUS_LABEL,
  TREE_SPECIES,
  TREE_SPECIES_LABEL,
  createForestParcel,
  deleteForestParcel,
  listForestParcels,
  updateForestParcel,
  type ForestParcelRow,
} from "@/lib/forest.functions";
import { formatNumber } from "@/lib/format";
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
  name: string;
  area_ha: string;
  tree_species: string;
  average_age_years: string;
  estimated_harvest_year_from: string;
  estimated_harvest_year_to: string;
  status: string;
  notes: string;
};

const empty: FormState = {
  name: "",
  area_ha: "",
  tree_species: "gran",
  average_age_years: "",
  estimated_harvest_year_from: "",
  estimated_harvest_year_to: "",
  status: "aktiv",
  notes: "",
};

const statusColor: Record<string, string> = {
  aktiv: "bg-emerald-100 text-emerald-800",
  plantet: "bg-blue-100 text-blue-800",
  afdrevet: "bg-amber-100 text-amber-800",
  fredet: "bg-purple-100 text-purple-800",
};

export function SkovOverblikPage() {
  const qc = useQueryClient();
  const list = useServerFn(listForestParcels);
  const create = useServerFn(createForestParcel);
  const update = useServerFn(updateForestParcel);
  const remove = useServerFn(deleteForestParcel);

  const { data: allRows = [], isLoading } = useQuery({
    queryKey: ["forest-parcels"],
    queryFn: () => list(),
  });
  const cols: FilterColumn<ForestParcelRow>[] = [
    { key: "name", label: "Navn", sortable: true, sortValue: (r) => r.name },
    { key: "tree_species", label: "Træart", type: "enum", get: (r) => r.tree_species ?? "", options: TREE_SPECIES.map((t) => ({ value: t, label: TREE_SPECIES_LABEL[t] })), sortable: true, sortValue: (r) => r.tree_species ?? "" },
    { key: "area_ha", label: "Areal (ha)", type: "number", get: (r) => r.area_ha != null ? Number(r.area_ha) : null, sortable: true, sortValue: (r) => r.area_ha != null ? Number(r.area_ha) : null },
    { key: "age", label: "Alder", type: "number", get: (r) => r.average_age_years, sortable: true, sortValue: (r) => r.average_age_years },
    { key: "harvest", label: "Hugst fra (år)", type: "number", get: (r) => r.estimated_harvest_year_from, sortable: true, sortValue: (r) => r.estimated_harvest_year_from },
    { key: "status", label: "Status", type: "enum", get: (r) => r.status ?? "", options: PARCEL_STATUS.map((t) => ({ value: t, label: PARCEL_STATUS_LABEL[t] })), sortable: true, sortValue: (r) => r.status ?? "" },
  ];
  const filters = useTableFilters({
    rows: allRows,
    columns: cols,
    searchFields: [(r) => r.name, (r) => r.notes ?? ""],
  });
  const rows = filters.rows;

  const [editing, setEditing] = useState<ForestParcelRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<ForestParcelRow | null>(null);

  const totalArea = rows.reduce((s, r) => s + Number(r.area_ha ?? 0), 0);
  const activeCount = rows.filter((r) => r.status === "aktiv").length;

  const deleteMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Slettet");
      qc.invalidateQueries({ queryKey: ["forest-parcels"] });
      setToDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const open = creating || editing != null;

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--brand-900)]">Skovoverblik</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Skovparceller, træart og status</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-1" /> Ny parcel
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Antal parceller</div>
          <div className="text-2xl font-semibold mt-1 tabular-nums">{rows.length}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Samlet areal (ha)</div>
          <div className="text-2xl font-semibold mt-1 tabular-nums">{formatNumber(Math.round(totalArea * 10) / 10)}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Aktive parceller</div>
          <div className="text-2xl font-semibold mt-1 tabular-nums">{activeCount}</div>
        </div>
      </div>

      <TableToolbar api={filters} searchPlaceholder="Søg parcel, noter…" />

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <SortableHeader label="Navn" sortKey="name" sort={filters.sort} onToggle={filters.toggleSort} className="px-4 py-2.5" />
              <SortableHeader label="Træart" sortKey="tree_species" sort={filters.sort} onToggle={filters.toggleSort} className="px-4 py-2.5" />
              <SortableHeader label="Areal (ha)" sortKey="area_ha" sort={filters.sort} onToggle={filters.toggleSort} align="right" className="px-4 py-2.5" />
              <SortableHeader label="Alder" sortKey="age" sort={filters.sort} onToggle={filters.toggleSort} align="right" className="px-4 py-2.5" />
              <SortableHeader label="Hugst (år)" sortKey="harvest" sort={filters.sort} onToggle={filters.toggleSort} className="px-4 py-2.5" />
              <SortableHeader label="Status" sortKey="status" sort={filters.sort} onToggle={filters.toggleSort} className="px-4 py-2.5" />
              <th className="px-4 py-2.5 w-24"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">Indlæser…</td></tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                <Trees className="h-8 w-8 mx-auto mb-2 opacity-40" />
                Ingen parceller endnu.
              </td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-muted/30">
                <td className="px-4 py-2.5 font-medium">{r.name}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{r.tree_species ? (TREE_SPECIES_LABEL[r.tree_species] ?? r.tree_species) : "—"}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{r.area_ha != null ? formatNumber(Number(r.area_ha)) : "—"}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{r.average_age_years ?? "—"}</td>
                <td className="px-4 py-2.5 text-muted-foreground tabular-nums">
                  {r.estimated_harvest_year_from || r.estimated_harvest_year_to
                    ? `${r.estimated_harvest_year_from ?? "?"}–${r.estimated_harvest_year_to ?? "?"}`
                    : "—"}
                </td>
                <td className="px-4 py-2.5">
                  {r.status ? (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[r.status] ?? "bg-gray-100 text-gray-700"}`}>
                      {PARCEL_STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  ) : "—"}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button onClick={() => setEditing(r)} className="p-1.5 rounded hover:bg-muted" aria-label="Rediger"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => setToDelete(r)} className="p-1.5 rounded hover:bg-muted text-red-600" aria-label="Slet"><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ParcelDialog
        open={open}
        editing={editing}
        onOpenChange={(o) => { if (!o) { setCreating(false); setEditing(null); } }}
        onSubmit={async (v) => {
          const payload = {
            name: v.name.trim(),
            area_ha: v.area_ha ? Number(v.area_ha) : null,
            tree_species: v.tree_species || null,
            average_age_years: v.average_age_years ? parseInt(v.average_age_years, 10) : null,
            estimated_harvest_year_from: v.estimated_harvest_year_from ? parseInt(v.estimated_harvest_year_from, 10) : null,
            estimated_harvest_year_to: v.estimated_harvest_year_to ? parseInt(v.estimated_harvest_year_to, 10) : null,
            status: v.status || null,
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
            qc.invalidateQueries({ queryKey: ["forest-parcels"] });
            setCreating(false); setEditing(null);
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      />

      <AlertDialog open={toDelete != null} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet parcel</AlertDialogTitle>
            <AlertDialogDescription>Slet "{toDelete?.name}"? Dette kan ikke fortrydes.</AlertDialogDescription>
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

function ParcelDialog({
  open, editing, onOpenChange, onSubmit,
}: {
  open: boolean;
  editing: ForestParcelRow | null;
  onOpenChange: (o: boolean) => void;
  onSubmit: (v: FormState) => Promise<void>;
}) {
  const [values, setValues] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);
  const key = `${open}-${editing?.id ?? "new"}`;
  const [lastKey, setLastKey] = useState("");
  if (open && lastKey !== key) {
    setLastKey(key);
    setValues(editing ? {
      name: editing.name,
      area_ha: editing.area_ha != null ? String(editing.area_ha) : "",
      tree_species: editing.tree_species ?? "gran",
      average_age_years: editing.average_age_years != null ? String(editing.average_age_years) : "",
      estimated_harvest_year_from: editing.estimated_harvest_year_from != null ? String(editing.estimated_harvest_year_from) : "",
      estimated_harvest_year_to: editing.estimated_harvest_year_to != null ? String(editing.estimated_harvest_year_to) : "",
      status: editing.status ?? "aktiv",
      notes: editing.notes ?? "",
    } : empty);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Rediger parcel" : "Ny parcel"}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={async (e) => { e.preventDefault(); setSaving(true); try { await onSubmit(values); } finally { setSaving(false); } }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="name">Navn</Label>
            <Input id="name" required maxLength={120} value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Træart</Label>
              <Select value={values.tree_species} onValueChange={(v) => setValues({ ...values, tree_species: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TREE_SPECIES.map((t) => <SelectItem key={t} value={t}>{TREE_SPECIES_LABEL[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={values.status} onValueChange={(v) => setValues({ ...values, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PARCEL_STATUS.map((t) => <SelectItem key={t} value={t}>{PARCEL_STATUS_LABEL[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="area">Areal (ha)</Label>
              <Input id="area" type="number" step="0.01" min="0" value={values.area_ha} onChange={(e) => setValues({ ...values, area_ha: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="age">Gns. alder (år)</Label>
              <Input id="age" type="number" step="1" min="0" value={values.average_age_years} onChange={(e) => setValues({ ...values, average_age_years: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="hf">Forventet hugst fra</Label>
              <Input id="hf" type="number" step="1" min="1900" max="2200" value={values.estimated_harvest_year_from} onChange={(e) => setValues({ ...values, estimated_harvest_year_from: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ht">Forventet hugst til</Label>
              <Input id="ht" type="number" step="1" min="1900" max="2200" value={values.estimated_harvest_year_to} onChange={(e) => setValues({ ...values, estimated_harvest_year_to: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Noter</Label>
            <Textarea id="notes" rows={3} maxLength={2000} value={values.notes} onChange={(e) => setValues({ ...values, notes: e.target.value })} />
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
