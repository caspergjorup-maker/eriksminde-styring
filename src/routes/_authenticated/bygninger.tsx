import { Suspense, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { BuildingMap } from "@/components/building-map/building-map";

import {
  BUILDING_TYPES,
  BUILDING_CONDITIONS,
  BUILDING_LEASE_STATUSES,
  HEATING_TYPES,
  LEASE_STATUSES,
  createBuilding,
  createBuildingLease,
  deleteBuilding,
  deleteBuildingLease,
  listBuildingLeases,
  listBuildings,
  listTenantOptions,
  updateBuilding,
  updateBuildingLease,
  type Building,
  type BuildingCondition,
  type BuildingLease,
  type BuildingLeaseStatus,
  type BuildingType,
  type HeatingType,
  type LeaseStatus,
} from "@/lib/buildings.functions";
import { formatDKK, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/bygninger")({
  component: BygningerPage,
});

const NONE = "__none__";

const BUILDING_TYPE_LABEL: Record<BuildingType, string> = {
  stuehus: "Stuehus",
  lade: "Lade",
  maskinhus: "Maskinhus",
  lagerhal: "Lagerhal",
  vaerksted: "Værksted",
  smedie: "Smedie",
  garage: "Garage",
};

const STATUS_LABEL: Record<LeaseStatus, string> = {
  active: "Aktiv",
  pending_payment: "Afventer betaling",
  expiring_soon: "Udløber snart",
  vacant: "Ledig",
};

const STATUS_TONE: Record<LeaseStatus, string> = {
  active: "bg-[var(--brand-50)] text-[var(--brand-900)]",
  pending_payment: "bg-amber-100 text-amber-900",
  expiring_soon: "bg-amber-100 text-amber-900",
  vacant: "bg-muted text-muted-foreground",
};

function BygningerPage() {
  const qc = useQueryClient();
  const listB = useServerFn(listBuildings);
  const listL = useServerFn(listBuildingLeases);
  const listT = useServerFn(listTenantOptions);

  const { data: buildings = [], isLoading: lb } = useQuery({ queryKey: ["buildings"], queryFn: () => listB() });
  const { data: leases = [], isLoading: ll } = useQuery({ queryKey: ["building-leases"], queryFn: () => listL() });
  const { data: tenants = [] } = useQuery({ queryKey: ["building-tenants"], queryFn: () => listT() });

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--brand-900)]">Bygninger</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Bygninger og lejemål</p>
      </div>

      <Suspense fallback={null}>
        <div className="bg-card border border-border rounded-xl p-4">
          <BuildingMap scale={0.6} interactive={false} showPanel={false} />
        </div>
      </Suspense>

      <BuildingsSection buildings={buildings} loading={lb} qc={qc} />
      <LeasesSection
        leases={leases}
        loading={ll}
        buildings={buildings}
        tenants={tenants}
        qc={qc}
      />
    </div>
  );
}

/* ---------- Buildings ---------- */

function BuildingsSection({
  buildings, loading, qc,
}: {
  buildings: Building[];
  loading: boolean;
  qc: ReturnType<typeof useQueryClient>;
}) {
  const create = useServerFn(createBuilding);
  const update = useServerFn(updateBuilding);
  const remove = useServerFn(deleteBuilding);

  const [editing, setEditing] = useState<Building | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<Building | null>(null);

  const deleteMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Bygning slettet");
      qc.invalidateQueries({ queryKey: ["buildings"] });
      qc.invalidateQueries({ queryKey: ["building-leases"] });
      setToDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-[var(--brand-900)]">Bygninger</h2>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-1" /> Ny bygning
        </Button>
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Navn</th>
              <th className="px-4 py-2.5 font-medium">Type</th>
              <th className="px-4 py-2.5 font-medium">Beskrivelse</th>
              <th className="px-4 py-2.5 w-24"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">Indlæser…</td></tr>}
            {!loading && buildings.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">Ingen bygninger endnu.</td></tr>
            )}
            {buildings.map((b) => (
              <tr key={b.id} className="hover:bg-muted/30">
                <td className="px-4 py-2.5 font-medium">{b.name}</td>
                <td className="px-4 py-2.5">{BUILDING_TYPE_LABEL[b.type] ?? b.type}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{b.description ?? "—"}</td>
                <td className="px-4 py-2.5 text-right">
                  <button onClick={() => setEditing(b)} className="p-1.5 rounded hover:bg-muted"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => setToDelete(b)} className="p-1.5 rounded hover:bg-muted text-red-600"><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <BuildingDialog
        open={creating || editing != null}
        editing={editing}
        onOpenChange={(o) => { if (!o) { setCreating(false); setEditing(null); } }}
        onSubmit={async (v) => {
          try {
            if (editing) {
              await update({ data: { id: editing.id, ...v } });
              toast.success("Opdateret");
            } else {
              await create({ data: v });
              toast.success("Oprettet");
            }
            qc.invalidateQueries({ queryKey: ["buildings"] });
            qc.invalidateQueries({ queryKey: ["building-leases"] });
            setCreating(false); setEditing(null);
          } catch (e) { toast.error((e as Error).message); }
        }}
      />

      <AlertDialog open={toDelete != null} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet bygning</AlertDialogTitle>
            <AlertDialogDescription>Slet "{toDelete?.name}"? Lejemål knyttet hertil mister referencen.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annullér</AlertDialogCancel>
            <AlertDialogAction onClick={() => toDelete && deleteMut.mutate(toDelete.id)} className="bg-red-600 hover:bg-red-700">Slet</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function BuildingDialog({
  open, editing, onOpenChange, onSubmit,
}: {
  open: boolean;
  editing: Building | null;
  onOpenChange: (o: boolean) => void;
  onSubmit: (v: { name: string; type: BuildingType; description: string | null }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<BuildingType>("lade");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const key = `${open}-${editing?.id ?? "new"}`;
  const [lastKey, setLastKey] = useState("");
  if (open && lastKey !== key) {
    setLastKey(key);
    setName(editing?.name ?? "");
    setType(editing?.type ?? "lade");
    setDescription(editing?.description ?? "");
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{editing ? "Rediger bygning" : "Ny bygning"}</DialogTitle></DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return;
            setSaving(true);
            try { await onSubmit({ name: name.trim(), type, description: description.trim() || null }); }
            finally { setSaving(false); }
          }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="bn">Navn *</Label>
            <Input id="bn" required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as BuildingType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BUILDING_TYPES.map((t) => <SelectItem key={t} value={t}>{BUILDING_TYPE_LABEL[t]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bd">Beskrivelse</Label>
            <Textarea id="bd" rows={3} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} />
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

/* ---------- Leases ---------- */

type LeaseForm = {
  building_id: string | null;
  tenant_id: string | null;
  monthly_rent: string;
  deposit: string;
  contract_start: string;
  contract_end: string;
  status: LeaseStatus;
  notes: string;
};

const emptyLease: LeaseForm = {
  building_id: null, tenant_id: null, monthly_rent: "", deposit: "",
  contract_start: "", contract_end: "", status: "active", notes: "",
};

function LeasesSection({
  leases, loading, buildings, tenants, qc,
}: {
  leases: BuildingLease[];
  loading: boolean;
  buildings: Building[];
  tenants: { id: string; name: string }[];
  qc: ReturnType<typeof useQueryClient>;
}) {
  const create = useServerFn(createBuildingLease);
  const update = useServerFn(updateBuildingLease);
  const remove = useServerFn(deleteBuildingLease);

  const [editing, setEditing] = useState<BuildingLease | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<BuildingLease | null>(null);

  const deleteMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Slettet");
      qc.invalidateQueries({ queryKey: ["building-leases"] });
      setToDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-[var(--brand-900)]">Lejemål</h2>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nyt lejemål
        </Button>
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Bygning</th>
              <th className="px-4 py-2.5 font-medium">Lejer</th>
              <th className="px-4 py-2.5 font-medium text-right">Mdl. leje</th>
              <th className="px-4 py-2.5 font-medium text-right">Depositum</th>
              <th className="px-4 py-2.5 font-medium">Periode</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 w-24"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">Indlæser…</td></tr>}
            {!loading && leases.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">Ingen lejemål endnu.</td></tr>
            )}
            {leases.map((l) => (
              <tr key={l.id} className="hover:bg-muted/30">
                <td className="px-4 py-2.5 font-medium">{l.building_name ?? "—"}</td>
                <td className="px-4 py-2.5">{l.tenant_name ?? "—"}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatDKK(l.monthly_rent)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatDKK(l.deposit)}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">
                  {formatDate(l.contract_start)} – {formatDate(l.contract_end)}
                </td>
                <td className="px-4 py-2.5">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] ${STATUS_TONE[l.status]}`}>
                    {STATUS_LABEL[l.status]}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button onClick={() => setEditing(l)} className="p-1.5 rounded hover:bg-muted"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => setToDelete(l)} className="p-1.5 rounded hover:bg-muted text-red-600"><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <LeaseDialog
        open={creating || editing != null}
        editing={editing}
        buildings={buildings}
        tenants={tenants}
        onOpenChange={(o) => { if (!o) { setCreating(false); setEditing(null); } }}
        onSubmit={async (v) => {
          const payload = {
            building_id: v.building_id,
            tenant_id: v.tenant_id,
            monthly_rent: Number(v.monthly_rent) || 0,
            deposit: Number(v.deposit) || 0,
            contract_start: v.contract_start || null,
            contract_end: v.contract_end || null,
            status: v.status,
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
            qc.invalidateQueries({ queryKey: ["building-leases"] });
            setCreating(false); setEditing(null);
          } catch (e) { toast.error((e as Error).message); }
        }}
      />

      <AlertDialog open={toDelete != null} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet lejemål</AlertDialogTitle>
            <AlertDialogDescription>
              Slet lejemål for "{toDelete?.building_name ?? "—"}" / "{toDelete?.tenant_name ?? "—"}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annullér</AlertDialogCancel>
            <AlertDialogAction onClick={() => toDelete && deleteMut.mutate(toDelete.id)} className="bg-red-600 hover:bg-red-700">Slet</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function LeaseDialog({
  open, editing, buildings, tenants, onOpenChange, onSubmit,
}: {
  open: boolean;
  editing: BuildingLease | null;
  buildings: Building[];
  tenants: { id: string; name: string }[];
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
      building_id: editing.building_id,
      tenant_id: editing.tenant_id,
      monthly_rent: String(editing.monthly_rent ?? ""),
      deposit: String(editing.deposit ?? ""),
      contract_start: editing.contract_start ?? "",
      contract_end: editing.contract_end ?? "",
      status: editing.status,
      notes: editing.notes ?? "",
    } : emptyLease);
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{editing ? "Rediger lejemål" : "Nyt lejemål"}</DialogTitle></DialogHeader>
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
              <Label>Bygning</Label>
              <Select value={values.building_id ?? NONE} onValueChange={(v) => setValues({ ...values, building_id: v === NONE ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Vælg…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— Ingen —</SelectItem>
                  {buildings.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Lejer</Label>
              <Select value={values.tenant_id ?? NONE} onValueChange={(v) => setValues({ ...values, tenant_id: v === NONE ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Vælg…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— Ingen —</SelectItem>
                  {tenants.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="mr">Mdl. leje (kr)</Label>
              <Input id="mr" type="number" min="0" step="1" value={values.monthly_rent}
                onChange={(e) => setValues({ ...values, monthly_rent: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dep">Depositum (kr)</Label>
              <Input id="dep" type="number" min="0" step="1" value={values.deposit}
                onChange={(e) => setValues({ ...values, deposit: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ls">Start</Label>
              <Input id="ls" type="date" value={values.contract_start}
                onChange={(e) => setValues({ ...values, contract_start: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="le">Slut</Label>
              <Input id="le" type="date" value={values.contract_end}
                onChange={(e) => setValues({ ...values, contract_end: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={values.status} onValueChange={(v) => setValues({ ...values, status: v as LeaseStatus })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LEASE_STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ln">Noter</Label>
            <Textarea id="ln" rows={3} maxLength={2000} value={values.notes}
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
