import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  ACTIVITY_TYPES,
  ACTIVITY_TYPE_LABEL,
  createForestActivity,
  deleteForestActivity,
  listForestActivities,
  listForestContacts,
  listForestParcels,
  updateForestActivity,
  type ForestActivityRow,
} from "@/lib/forest.functions";
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


type FormState = {
  parcel_id: string;
  activity_type: string;
  activity_date: string;
  contractor_id: string;
  volume_m3: string;
  quantity_units: string;
  cost: string;
  revenue: string;
  notes: string;
};

const NONE = "__none__";

const empty: FormState = {
  parcel_id: NONE,
  activity_type: "hugst",
  activity_date: new Date().toISOString().slice(0, 10),
  contractor_id: NONE,
  volume_m3: "",
  quantity_units: "",
  cost: "",
  revenue: "",
  notes: "",
};

export function HugstPage() {
  const qc = useQueryClient();
  const list = useServerFn(listForestActivities);
  const listParcels = useServerFn(listForestParcels);
  const listContacts = useServerFn(listForestContacts);
  const create = useServerFn(createForestActivity);
  const update = useServerFn(updateForestActivity);
  const remove = useServerFn(deleteForestActivity);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["forest-activities"],
    queryFn: () => list(),
  });
  const { data: parcels = [] } = useQuery({
    queryKey: ["forest-parcels"],
    queryFn: () => listParcels(),
  });
  const { data: contacts = [] } = useQuery({
    queryKey: ["forest-contacts"],
    queryFn: () => listContacts(),
  });

  const [editing, setEditing] = useState<ForestActivityRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<ForestActivityRow | null>(null);
  const [yearFilter, setYearFilter] = useState<string>("all");

  const years = useMemo(() => {
    const s = new Set<number>();
    for (const r of rows) {
      if (r.activity_date) s.add(new Date(r.activity_date).getFullYear());
    }
    return Array.from(s).sort((a, b) => b - a);
  }, [rows]);

  const filtered = yearFilter === "all"
    ? rows
    : rows.filter((r) => r.activity_date && new Date(r.activity_date).getFullYear() === Number(yearFilter));

  const totalCost = filtered.reduce((s, r) => s + Number(r.cost ?? 0), 0);
  const totalRevenue = filtered.reduce((s, r) => s + Number(r.revenue ?? 0), 0);
  const totalVolume = filtered.reduce((s, r) => s + Number(r.volume_m3 ?? 0), 0);

  const deleteMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Slettet");
      qc.invalidateQueries({ queryKey: ["forest-activities"] });
      setToDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const open = creating || editing != null;

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--brand-900)]">Hugst & aktivitet</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Skovaktiviteter, omkostninger og indtægter</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle år</SelectItem>
              {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-1" /> Ny aktivitet
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Volumen (m³)</div>
          <div className="text-2xl font-semibold mt-1 tabular-nums">{formatNumber(Math.round(totalVolume))}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Omkostninger</div>
          <div className="text-2xl font-semibold mt-1 tabular-nums">{formatDKK(totalCost)}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Indtægter</div>
          <div className="text-2xl font-semibold mt-1 tabular-nums text-emerald-700">{formatDKK(totalRevenue)}</div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Dato</th>
              <th className="px-4 py-2.5 font-medium">Aktivitet</th>
              <th className="px-4 py-2.5 font-medium">Parcel</th>
              <th className="px-4 py-2.5 font-medium">Entreprenør</th>
              <th className="px-4 py-2.5 font-medium text-right">Volumen m³</th>
              <th className="px-4 py-2.5 font-medium text-right">Omkostning</th>
              <th className="px-4 py-2.5 font-medium text-right">Indtægt</th>
              <th className="px-4 py-2.5 w-24"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && <tr><td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">Indlæser…</td></tr>}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">Ingen aktiviteter.</td></tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-muted/30">
                <td className="px-4 py-2.5 text-muted-foreground">{formatDate(r.activity_date)}</td>
                <td className="px-4 py-2.5 font-medium">{ACTIVITY_TYPE_LABEL[r.activity_type] ?? r.activity_type}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{r.parcel_name ?? "—"}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{r.contractor_name ?? "—"}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{r.volume_m3 != null ? formatNumber(Number(r.volume_m3)) : "—"}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{r.cost != null ? formatDKK(Number(r.cost)) : "—"}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-emerald-700">{r.revenue != null ? formatDKK(Number(r.revenue)) : "—"}</td>
                <td className="px-4 py-2.5 text-right">
                  <button onClick={() => setEditing(r)} className="p-1.5 rounded hover:bg-muted" aria-label="Rediger"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => setToDelete(r)} className="p-1.5 rounded hover:bg-muted text-red-600" aria-label="Slet"><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ActivityDialog
        open={open}
        editing={editing}
        parcels={parcels}
        contacts={contacts}
        onOpenChange={(o) => { if (!o) { setCreating(false); setEditing(null); } }}
        onSubmit={async (v) => {
          const payload = {
            parcel_id: v.parcel_id === NONE ? null : v.parcel_id,
            activity_type: v.activity_type,
            activity_date: v.activity_date || null,
            contractor_id: v.contractor_id === NONE ? null : v.contractor_id,
            volume_m3: v.volume_m3 ? Number(v.volume_m3) : null,
            quantity_units: v.quantity_units ? Number(v.quantity_units) : null,
            cost: v.cost ? Number(v.cost) : null,
            revenue: v.revenue ? Number(v.revenue) : null,
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
            qc.invalidateQueries({ queryKey: ["forest-activities"] });
            setCreating(false); setEditing(null);
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      />

      <AlertDialog open={toDelete != null} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet aktivitet</AlertDialogTitle>
            <AlertDialogDescription>Slet denne aktivitet? Dette kan ikke fortrydes.</AlertDialogDescription>
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

function ActivityDialog({
  open, editing, parcels, contacts, onOpenChange, onSubmit,
}: {
  open: boolean;
  editing: ForestActivityRow | null;
  parcels: { id: string; name: string }[];
  contacts: { id: string; name: string }[];
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
      parcel_id: editing.parcel_id ?? NONE,
      activity_type: editing.activity_type,
      activity_date: editing.activity_date ?? "",
      contractor_id: editing.contractor_id ?? NONE,
      volume_m3: editing.volume_m3 != null ? String(editing.volume_m3) : "",
      quantity_units: editing.quantity_units != null ? String(editing.quantity_units) : "",
      cost: editing.cost != null ? String(editing.cost) : "",
      revenue: editing.revenue != null ? String(editing.revenue) : "",
      notes: editing.notes ?? "",
    } : empty);
  }

  const margin = (Number(values.revenue) || 0) - (Number(values.cost) || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Rediger aktivitet" : "Ny aktivitet"}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={async (e) => { e.preventDefault(); setSaving(true); try { await onSubmit(values); } finally { setSaving(false); } }}
          className="space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Aktivitetstype</Label>
              <Select value={values.activity_type} onValueChange={(v) => setValues({ ...values, activity_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACTIVITY_TYPES.map((t) => <SelectItem key={t} value={t}>{ACTIVITY_TYPE_LABEL[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="date">Dato</Label>
              <Input id="date" type="date" value={values.activity_date} onChange={(e) => setValues({ ...values, activity_date: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Parcel</Label>
              <Select value={values.parcel_id} onValueChange={(v) => setValues({ ...values, parcel_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {parcels.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Entreprenør</Label>
              <Select value={values.contractor_id} onValueChange={(v) => setValues({ ...values, contractor_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {contacts.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="vol">Volumen (m³)</Label>
              <Input id="vol" type="number" step="0.1" min="0" value={values.volume_m3} onChange={(e) => setValues({ ...values, volume_m3: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qty">Antal enheder</Label>
              <Input id="qty" type="number" step="1" min="0" value={values.quantity_units} onChange={(e) => setValues({ ...values, quantity_units: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cost">Omkostning (kr)</Label>
              <Input id="cost" type="number" step="0.01" min="0" value={values.cost} onChange={(e) => setValues({ ...values, cost: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rev">Indtægt (kr)</Label>
              <Input id="rev" type="number" step="0.01" min="0" value={values.revenue} onChange={(e) => setValues({ ...values, revenue: e.target.value })} />
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Margin: <span className={`font-medium ${margin >= 0 ? "text-emerald-700" : "text-red-600"}`}>{formatDKK(margin)}</span>
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
