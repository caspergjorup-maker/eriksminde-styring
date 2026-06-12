import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  HUNTING_SPECIES,
  HUNTING_SPECIES_LABEL,
  createHuntingLease,
  createHuntingRecord,
  deleteHuntingLease,
  deleteHuntingRecord,
  listForestContacts,
  listHuntingLeases,
  listHuntingRecords,
  updateHuntingLease,
  updateHuntingRecord,
  type HuntingLeaseRow,
  type HuntingRecordRow,
} from "@/lib/forest.functions";
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

export const Route = createFileRoute("/_authenticated/jagtleje")({
  component: JagtlejePage,
});

const NONE = "__none__";

type LeaseForm = {
  name: string;
  tenant_id: string;
  area_ha: string;
  annual_fee: string;
  contract_start: string;
  contract_end: string;
  notes: string;
};
const emptyLease: LeaseForm = {
  name: "",
  tenant_id: NONE,
  area_ha: "",
  annual_fee: "",
  contract_start: "",
  contract_end: "",
  notes: "",
};

type RecordForm = {
  lease_id: string;
  season: string;
  species: string;
  quota: string;
  harvested: string;
  notes: string;
};
const emptyRecord: RecordForm = {
  lease_id: NONE,
  season: String(new Date().getFullYear()),
  species: "raavildt",
  quota: "",
  harvested: "",
  notes: "",
};

function expiryColor(days: number | null): string {
  if (days == null) return "bg-gray-100 text-gray-700";
  if (days < 0) return "bg-red-100 text-red-800";
  if (days < 90) return "bg-amber-100 text-amber-800";
  return "bg-emerald-100 text-emerald-800";
}

function JagtlejePage() {
  const qc = useQueryClient();
  const listLeases = useServerFn(listHuntingLeases);
  const listRecords = useServerFn(listHuntingRecords);
  const listContacts = useServerFn(listForestContacts);
  const createLease = useServerFn(createHuntingLease);
  const updateLease = useServerFn(updateHuntingLease);
  const removeLease = useServerFn(deleteHuntingLease);
  const createRecord = useServerFn(createHuntingRecord);
  const updateRecord = useServerFn(updateHuntingRecord);
  const removeRecord = useServerFn(deleteHuntingRecord);

  const { data: leases = [], isLoading: leasesLoading } = useQuery({
    queryKey: ["hunting-leases"],
    queryFn: () => listLeases(),
  });
  const { data: records = [], isLoading: recordsLoading } = useQuery({
    queryKey: ["hunting-records"],
    queryFn: () => listRecords(),
  });
  const { data: contacts = [] } = useQuery({
    queryKey: ["forest-contacts"],
    queryFn: () => listContacts(),
  });

  const [editingLease, setEditingLease] = useState<HuntingLeaseRow | null>(null);
  const [creatingLease, setCreatingLease] = useState(false);
  const [toDeleteLease, setToDeleteLease] = useState<HuntingLeaseRow | null>(null);

  const [editingRecord, setEditingRecord] = useState<HuntingRecordRow | null>(null);
  const [creatingRecord, setCreatingRecord] = useState(false);
  const [toDeleteRecord, setToDeleteRecord] = useState<HuntingRecordRow | null>(null);

  const totalFee = leases.reduce((s, l) => s + Number(l.annual_fee ?? 0), 0);
  const totalArea = leases.reduce((s, l) => s + Number(l.area_ha ?? 0), 0);

  const leaseDeleteMut = useMutation({
    mutationFn: (id: string) => removeLease({ data: { id } }),
    onSuccess: () => {
      toast.success("Slettet");
      qc.invalidateQueries({ queryKey: ["hunting-leases"] });
      qc.invalidateQueries({ queryKey: ["hunting-records"] });
      setToDeleteLease(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const recordDeleteMut = useMutation({
    mutationFn: (id: string) => removeRecord({ data: { id } }),
    onSuccess: () => {
      toast.success("Slettet");
      qc.invalidateQueries({ queryKey: ["hunting-records"] });
      setToDeleteRecord(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const leaseOpen = creatingLease || editingLease != null;
  const recordOpen = creatingRecord || editingRecord != null;

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--brand-900)]">Jagtleje</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Jagtlejeaftaler og afskydningsrapporter</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Aftaler</div>
          <div className="text-2xl font-semibold mt-1 tabular-nums">{leases.length}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Samlet areal (ha)</div>
          <div className="text-2xl font-semibold mt-1 tabular-nums">{totalArea.toLocaleString("da-DK")}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Årlig leje</div>
          <div className="text-2xl font-semibold mt-1 tabular-nums text-emerald-700">{formatDKK(totalFee)}</div>
        </div>
      </div>

      {/* LEASES */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Jagtlejeaftaler</h2>
          <Button onClick={() => setCreatingLease(true)}>
            <Plus className="h-4 w-4 mr-1" /> Ny aftale
          </Button>
        </div>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Navn</th>
                <th className="px-4 py-2.5 font-medium">Lejer</th>
                <th className="px-4 py-2.5 font-medium text-right">Areal (ha)</th>
                <th className="px-4 py-2.5 font-medium text-right">Årlig leje</th>
                <th className="px-4 py-2.5 font-medium">Periode</th>
                <th className="px-4 py-2.5 font-medium">Udløb</th>
                <th className="px-4 py-2.5 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {leasesLoading && <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">Indlæser…</td></tr>}
              {!leasesLoading && leases.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">Ingen aftaler endnu.</td></tr>
              )}
              {leases.map((l) => {
                const days = daysUntil(l.contract_end);
                return (
                  <tr key={l.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-medium">{l.name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{l.tenant_name ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{l.area_ha != null ? Number(l.area_ha).toLocaleString("da-DK") : "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{l.annual_fee != null ? formatDKK(Number(l.annual_fee)) : "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{formatDate(l.contract_start)} – {formatDate(l.contract_end)}</td>
                    <td className="px-4 py-2.5">
                      {days != null && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${expiryColor(days)}`}>
                          {days < 0 ? `Udløbet ${-days} d siden` : `${days} d`}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => setEditingLease(l)} className="p-1.5 rounded hover:bg-muted" aria-label="Rediger"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => setToDeleteLease(l)} className="p-1.5 rounded hover:bg-muted text-red-600" aria-label="Slet"><Trash2 className="h-4 w-4" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* RECORDS */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Afskydningsrapporter</h2>
          <Button onClick={() => setCreatingRecord(true)} disabled={leases.length === 0}>
            <Plus className="h-4 w-4 mr-1" /> Ny rapport
          </Button>
        </div>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Sæson</th>
                <th className="px-4 py-2.5 font-medium">Aftale</th>
                <th className="px-4 py-2.5 font-medium">Vildtart</th>
                <th className="px-4 py-2.5 font-medium text-right">Kvote</th>
                <th className="px-4 py-2.5 font-medium text-right">Skudt</th>
                <th className="px-4 py-2.5 font-medium text-right">%</th>
                <th className="px-4 py-2.5 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recordsLoading && <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">Indlæser…</td></tr>}
              {!recordsLoading && records.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">Ingen rapporter endnu.</td></tr>
              )}
              {records.map((r) => {
                const pct = r.quota && r.quota > 0 && r.harvested != null ? Math.round((r.harvested / r.quota) * 100) : null;
                return (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-medium">{r.season ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.lease_name ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.species ? (HUNTING_SPECIES_LABEL[r.species] ?? r.species) : "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{r.quota ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{r.harvested ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{pct != null ? `${pct}%` : "—"}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => setEditingRecord(r)} className="p-1.5 rounded hover:bg-muted" aria-label="Rediger"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => setToDeleteRecord(r)} className="p-1.5 rounded hover:bg-muted text-red-600" aria-label="Slet"><Trash2 className="h-4 w-4" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <LeaseDialog
        open={leaseOpen}
        editing={editingLease}
        contacts={contacts}
        onOpenChange={(o) => { if (!o) { setCreatingLease(false); setEditingLease(null); } }}
        onSubmit={async (v) => {
          const payload = {
            name: v.name.trim(),
            tenant_id: v.tenant_id === NONE ? null : v.tenant_id,
            area_ha: v.area_ha ? Number(v.area_ha) : null,
            annual_fee: v.annual_fee ? Number(v.annual_fee) : null,
            contract_start: v.contract_start || null,
            contract_end: v.contract_end || null,
            notes: v.notes || null,
          };
          try {
            if (editingLease) {
              await updateLease({ data: { id: editingLease.id, ...payload } });
              toast.success("Opdateret");
            } else {
              await createLease({ data: payload });
              toast.success("Oprettet");
            }
            qc.invalidateQueries({ queryKey: ["hunting-leases"] });
            setCreatingLease(false); setEditingLease(null);
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      />

      <RecordDialog
        open={recordOpen}
        editing={editingRecord}
        leases={leases}
        onOpenChange={(o) => { if (!o) { setCreatingRecord(false); setEditingRecord(null); } }}
        onSubmit={async (v) => {
          const payload = {
            lease_id: v.lease_id === NONE ? null : v.lease_id,
            season: v.season || null,
            species: v.species || null,
            quota: v.quota ? parseInt(v.quota, 10) : null,
            harvested: v.harvested ? parseInt(v.harvested, 10) : null,
            notes: v.notes || null,
          };
          try {
            if (editingRecord) {
              await updateRecord({ data: { id: editingRecord.id, ...payload } });
              toast.success("Opdateret");
            } else {
              await createRecord({ data: payload });
              toast.success("Oprettet");
            }
            qc.invalidateQueries({ queryKey: ["hunting-records"] });
            setCreatingRecord(false); setEditingRecord(null);
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      />

      <AlertDialog open={toDeleteLease != null} onOpenChange={(o) => !o && setToDeleteLease(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet aftale</AlertDialogTitle>
            <AlertDialogDescription>Slet "{toDeleteLease?.name}"? Tilknyttede rapporter slettes også.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annullér</AlertDialogCancel>
            <AlertDialogAction onClick={() => toDeleteLease && leaseDeleteMut.mutate(toDeleteLease.id)} className="bg-red-600 hover:bg-red-700">Slet</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={toDeleteRecord != null} onOpenChange={(o) => !o && setToDeleteRecord(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet rapport</AlertDialogTitle>
            <AlertDialogDescription>Slet denne rapport?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annullér</AlertDialogCancel>
            <AlertDialogAction onClick={() => toDeleteRecord && recordDeleteMut.mutate(toDeleteRecord.id)} className="bg-red-600 hover:bg-red-700">Slet</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function LeaseDialog({
  open, editing, contacts, onOpenChange, onSubmit,
}: {
  open: boolean;
  editing: HuntingLeaseRow | null;
  contacts: { id: string; name: string }[];
  onOpenChange: (o: boolean) => void;
  onSubmit: (v: LeaseForm) => Promise<void>;
}) {
  const [values, setValues] = useState<LeaseForm>(emptyLease);
  const [saving, setSaving] = useState(false);
  const key = `${open}-${editing?.id ?? "new"}`;
  const [lastKey, setLastKey] = useState("");
  if (open && lastKey !== key) {
    setLastKey(key);
    setValues(editing ? {
      name: editing.name,
      tenant_id: editing.tenant_id ?? NONE,
      area_ha: editing.area_ha != null ? String(editing.area_ha) : "",
      annual_fee: editing.annual_fee != null ? String(editing.annual_fee) : "",
      contract_start: editing.contract_start ?? "",
      contract_end: editing.contract_end ?? "",
      notes: editing.notes ?? "",
    } : emptyLease);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Rediger aftale" : "Ny jagtlejeaftale"}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={async (e) => { e.preventDefault(); setSaving(true); try { await onSubmit(values); } finally { setSaving(false); } }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="name">Navn</Label>
            <Input id="name" required maxLength={120} value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Lejer</Label>
            <Select value={values.tenant_id} onValueChange={(v) => setValues({ ...values, tenant_id: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {contacts.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="area">Areal (ha)</Label>
              <Input id="area" type="number" step="0.01" min="0" value={values.area_ha} onChange={(e) => setValues({ ...values, area_ha: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fee">Årlig leje (kr)</Label>
              <Input id="fee" type="number" step="0.01" min="0" value={values.annual_fee} onChange={(e) => setValues({ ...values, annual_fee: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cs">Start</Label>
              <Input id="cs" type="date" value={values.contract_start} onChange={(e) => setValues({ ...values, contract_start: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ce">Slut</Label>
              <Input id="ce" type="date" value={values.contract_end} onChange={(e) => setValues({ ...values, contract_end: e.target.value })} />
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

function RecordDialog({
  open, editing, leases, onOpenChange, onSubmit,
}: {
  open: boolean;
  editing: HuntingRecordRow | null;
  leases: HuntingLeaseRow[];
  onOpenChange: (o: boolean) => void;
  onSubmit: (v: RecordForm) => Promise<void>;
}) {
  const [values, setValues] = useState<RecordForm>(emptyRecord);
  const [saving, setSaving] = useState(false);
  const key = `${open}-${editing?.id ?? "new"}`;
  const [lastKey, setLastKey] = useState("");
  if (open && lastKey !== key) {
    setLastKey(key);
    setValues(editing ? {
      lease_id: editing.lease_id ?? NONE,
      season: editing.season ?? "",
      species: editing.species ?? "raavildt",
      quota: editing.quota != null ? String(editing.quota) : "",
      harvested: editing.harvested != null ? String(editing.harvested) : "",
      notes: editing.notes ?? "",
    } : emptyRecord);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Rediger rapport" : "Ny afskydningsrapport"}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={async (e) => { e.preventDefault(); setSaving(true); try { await onSubmit(values); } finally { setSaving(false); } }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label>Aftale</Label>
            <Select value={values.lease_id} onValueChange={(v) => setValues({ ...values, lease_id: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {leases.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="season">Sæson</Label>
              <Input id="season" maxLength={20} placeholder="fx 2025/26" value={values.season} onChange={(e) => setValues({ ...values, season: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Vildtart</Label>
              <Select value={values.species} onValueChange={(v) => setValues({ ...values, species: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HUNTING_SPECIES.map((s) => <SelectItem key={s} value={s}>{HUNTING_SPECIES_LABEL[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="quota">Kvote</Label>
              <Input id="quota" type="number" step="1" min="0" value={values.quota} onChange={(e) => setValues({ ...values, quota: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="harv">Skudt</Label>
              <Input id="harv" type="number" step="1" min="0" value={values.harvested} onChange={(e) => setValues({ ...values, harvested: e.target.value })} />
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
