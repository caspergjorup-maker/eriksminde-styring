import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Tractor, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  MACHINE_STATUSES,
  MACHINE_STATUS_LABEL,
  MACHINE_TYPES,
  MACHINE_TYPE_LABEL,
  OWNERSHIPS,
  OWNERSHIP_LABEL,
  createMachine,
  createServiceLog,
  deleteMachine,
  deleteServiceLog,
  listMachines,
  listServiceLogs,
  needsService,
  updateMachine,
  type MachineRow,
  type ServiceLogRow,
} from "@/lib/machines.functions";
import { listMaintenanceContacts, listMaintenanceTasks } from "@/lib/maintenance.functions";
import { daysUntil, formatDKK, formatDate } from "@/lib/format";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export const Route = createFileRoute("/_authenticated/maskiner")({
  component: MaskinerPage,
});

const NONE = "__none__";

const STATUS_BADGE: Record<string, string> = {
  i_drift: "bg-emerald-100 text-emerald-800",
  reparation: "bg-amber-100 text-amber-800",
  udgaaet: "bg-gray-100 text-gray-600",
};

function MaskinerPage() {
  const qc = useQueryClient();
  const list = useServerFn(listMachines);
  const listContacts = useServerFn(listMaintenanceContacts);
  const remove = useServerFn(deleteMachine);

  const { data: machines = [], isLoading } = useQuery({
    queryKey: ["machines"],
    queryFn: () => list(),
  });
  const { data: contacts = [] } = useQuery({
    queryKey: ["maintenance-contacts"],
    queryFn: () => listContacts(),
  });

  const [selected, setSelected] = useState<MachineRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<MachineRow | null>(null);

  const metrics = useMemo(
    () => ({
      total: machines.length,
      iDrift: machines.filter((m) => m.status === "i_drift").length,
      reparation: machines.filter((m) => m.status === "reparation").length,
      service: machines.filter(needsService).length,
    }),
    [machines],
  );

  const deleteMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Maskine slettet");
      qc.invalidateQueries({ queryKey: ["machines"] });
      setToDelete(null);
      setSelected(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--brand-900)]">Maskiner</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Overblik over maskinpark, servicestatus og næste vedligehold
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-1" /> Tilføj maskine
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <Metric label="Maskiner i alt" value={metrics.total} />
        <Metric label="I drift" value={metrics.iDrift} />
        <Metric label="Til reparation" value={metrics.reparation} highlight={metrics.reparation > 0 ? "amber" : undefined} />
        <Metric label="Service forfalden" value={metrics.service} highlight={metrics.service > 0 ? "amber" : undefined} />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Maskine</th>
              <th className="px-4 py-2.5 font-medium">Type</th>
              <th className="px-4 py-2.5 font-medium">Årgang</th>
              <th className="px-4 py-2.5 font-medium">Timetal</th>
              <th className="px-4 py-2.5 font-medium">Seneste service</th>
              <th className="px-4 py-2.5 font-medium">Næste service</th>
              <th className="px-4 py-2.5 font-medium">Foretrukken leverandør</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">Indlæser…</td></tr>
            )}
            {!isLoading && machines.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                <Tractor className="h-8 w-8 mx-auto mb-2 opacity-40" />
                Ingen maskiner endnu.
              </td></tr>
            )}
            {machines.map((m) => {
              const overdue = needsService(m);
              return (
                <tr key={m.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => setSelected(m)}>
                  <td className="px-4 py-2.5 font-medium">{m.name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{m.type ? MACHINE_TYPE_LABEL[m.type] : "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{m.year ?? "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground tabular-nums">{m.current_hours != null ? `${m.current_hours} t` : "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{m.last_service_date ? formatDate(m.last_service_date) : "—"}</td>
                  <td className={`px-4 py-2.5 ${overdue ? "text-amber-700 font-medium" : "text-muted-foreground"}`}>
                    {m.next_service_date ? formatDate(m.next_service_date) : m.next_service_hours != null ? `${m.next_service_hours} t` : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{m.preferred_supplier_name ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[m.status ?? "i_drift"]}`}>
                      {MACHINE_STATUS_LABEL[m.status ?? "i_drift"]}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <MachineDialog
        open={creating || selected != null}
        editing={selected}
        contacts={contacts}
        onOpenChange={(o) => { if (!o) { setCreating(false); setSelected(null); } }}
        onDelete={(m) => setToDelete(m)}
      />

      <AlertDialog open={toDelete != null} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet maskine</AlertDialogTitle>
            <AlertDialogDescription>Slet "{toDelete?.name}"? Servicelog slettes også.</AlertDialogDescription>
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

function Metric({ label, value, highlight }: { label: string; value: number; highlight?: "amber" }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold mt-1 tabular-nums ${highlight === "amber" ? "text-amber-700" : ""}`}>{value}</div>
    </div>
  );
}

type MachineForm = {
  name: string;
  type: string;
  brand: string;
  model: string;
  year: string;
  serial_number: string;
  registration_number: string;
  ownership: string;
  status: string;
  current_hours: string;
  last_service_date: string;
  last_service_hours: string;
  next_service_date: string;
  next_service_hours: string;
  service_interval_hours: string;
  service_interval_months: string;
  estimated_value: string;
  insurance_company: string;
  insurance_expiry: string;
  lease_expiry: string;
  preferred_supplier_id: string;
  image_url: string;
  notes: string;
};

const emptyMachine: MachineForm = {
  name: "", type: "traktor", brand: "", model: "", year: "", serial_number: "",
  registration_number: "", ownership: "eget", status: "i_drift",
  current_hours: "", last_service_date: "", last_service_hours: "",
  next_service_date: "", next_service_hours: "",
  service_interval_hours: "", service_interval_months: "",
  estimated_value: "", insurance_company: "", insurance_expiry: "",
  lease_expiry: "", preferred_supplier_id: NONE, image_url: "", notes: "",
};

function MachineDialog({
  open, editing, contacts, onOpenChange, onDelete,
}: {
  open: boolean;
  editing: MachineRow | null;
  contacts: { id: string; name: string }[];
  onOpenChange: (o: boolean) => void;
  onDelete: (m: MachineRow) => void;
}) {
  const qc = useQueryClient();
  const create = useServerFn(createMachine);
  const update = useServerFn(updateMachine);
  const [tab, setTab] = useState("info");
  const [values, setValues] = useState<MachineForm>(emptyMachine);
  const [saving, setSaving] = useState(false);
  const key = `${open}-${editing?.id ?? "new"}`;
  const [lastKey, setLastKey] = useState("");
  if (open && lastKey !== key) {
    setLastKey(key);
    setTab("info");
    setValues(editing ? {
      name: editing.name,
      type: editing.type ?? "traktor",
      brand: editing.brand ?? "",
      model: editing.model ?? "",
      year: editing.year != null ? String(editing.year) : "",
      serial_number: editing.serial_number ?? "",
      registration_number: editing.registration_number ?? "",
      ownership: editing.ownership ?? "eget",
      status: editing.status ?? "i_drift",
      current_hours: editing.current_hours != null ? String(editing.current_hours) : "",
      last_service_date: editing.last_service_date ?? "",
      last_service_hours: editing.last_service_hours != null ? String(editing.last_service_hours) : "",
      next_service_date: editing.next_service_date ?? "",
      next_service_hours: editing.next_service_hours != null ? String(editing.next_service_hours) : "",
      service_interval_hours: editing.service_interval_hours != null ? String(editing.service_interval_hours) : "",
      service_interval_months: editing.service_interval_months != null ? String(editing.service_interval_months) : "",
      estimated_value: editing.estimated_value != null ? String(editing.estimated_value) : "",
      insurance_company: editing.insurance_company ?? "",
      insurance_expiry: editing.insurance_expiry ?? "",
      lease_expiry: editing.lease_expiry ?? "",
      preferred_supplier_id: editing.preferred_supplier_id ?? NONE,
      image_url: editing.image_url ?? "",
      notes: editing.notes ?? "",
    } : emptyMachine);
  }

  async function save() {
    setSaving(true);
    try {
      const payload = {
        name: values.name.trim(),
        type: values.type as (typeof MACHINE_TYPES)[number],
        brand: values.brand || null,
        model: values.model || null,
        year: values.year ? Number(values.year) : null,
        serial_number: values.serial_number || null,
        registration_number: values.registration_number || null,
        ownership: values.ownership as (typeof OWNERSHIPS)[number],
        status: values.status as (typeof MACHINE_STATUSES)[number],
        current_hours: values.current_hours ? Number(values.current_hours) : null,
        last_service_date: values.last_service_date || null,
        last_service_hours: values.last_service_hours ? Number(values.last_service_hours) : null,
        next_service_date: values.next_service_date || null,
        next_service_hours: values.next_service_hours ? Number(values.next_service_hours) : null,
        service_interval_hours: values.service_interval_hours ? Number(values.service_interval_hours) : null,
        service_interval_months: values.service_interval_months ? Number(values.service_interval_months) : null,
        estimated_value: values.estimated_value ? Number(values.estimated_value) : null,
        insurance_company: values.insurance_company || null,
        insurance_expiry: values.insurance_expiry || null,
        lease_expiry: values.lease_expiry || null,
        preferred_supplier_id: values.preferred_supplier_id === NONE ? null : values.preferred_supplier_id,
        image_url: values.image_url || null,
        notes: values.notes || null,
      };
      if (editing) {
        await update({ data: { id: editing.id, ...payload } });
        toast.success("Maskine opdateret");
      } else {
        await create({ data: payload });
        toast.success("Maskine oprettet");
      }
      qc.invalidateQueries({ queryKey: ["machines"] });
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? editing.name : "Ny maskine"}</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="info">Oplysninger</TabsTrigger>
            <TabsTrigger value="service" disabled={!editing}>Servicelog</TabsTrigger>
            <TabsTrigger value="opgaver" disabled={!editing}>Vedligehold</TabsTrigger>
          </TabsList>

          <TabsContent value="info">
            <form onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Navn"><Input required value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} /></Field>
                <Field label="Type">
                  <Select value={values.type} onValueChange={(v) => setValues({ ...values, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MACHINE_TYPES.map((t) => <SelectItem key={t} value={t}>{MACHINE_TYPE_LABEL[t]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Mærke"><Input value={values.brand} onChange={(e) => setValues({ ...values, brand: e.target.value })} /></Field>
                <Field label="Model"><Input value={values.model} onChange={(e) => setValues({ ...values, model: e.target.value })} /></Field>
                <Field label="Årgang"><Input type="number" value={values.year} onChange={(e) => setValues({ ...values, year: e.target.value })} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Serienummer"><Input value={values.serial_number} onChange={(e) => setValues({ ...values, serial_number: e.target.value })} /></Field>
                <Field label="Registreringsnummer"><Input value={values.registration_number} onChange={(e) => setValues({ ...values, registration_number: e.target.value })} /></Field>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Ejerskab">
                  <Select value={values.ownership} onValueChange={(v) => setValues({ ...values, ownership: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {OWNERSHIPS.map((o) => <SelectItem key={o} value={o}>{OWNERSHIP_LABEL[o]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Status">
                  <Select value={values.status} onValueChange={(v) => setValues({ ...values, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MACHINE_STATUSES.map((s) => <SelectItem key={s} value={s}>{MACHINE_STATUS_LABEL[s]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Timetal"><Input type="number" value={values.current_hours} onChange={(e) => setValues({ ...values, current_hours: e.target.value })} /></Field>
              </div>

              <div className="border-t pt-3 mt-3">
                <div className="text-sm font-medium mb-2 text-muted-foreground">Vedligehold</div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Seneste service (dato)"><Input type="date" value={values.last_service_date} onChange={(e) => setValues({ ...values, last_service_date: e.target.value })} /></Field>
                  <Field label="Seneste service (timer)"><Input type="number" value={values.last_service_hours} onChange={(e) => setValues({ ...values, last_service_hours: e.target.value })} /></Field>
                  <Field label="Næste service (dato)"><Input type="date" value={values.next_service_date} onChange={(e) => setValues({ ...values, next_service_date: e.target.value })} /></Field>
                  <Field label="Næste service (timer)"><Input type="number" value={values.next_service_hours} onChange={(e) => setValues({ ...values, next_service_hours: e.target.value })} /></Field>
                  <Field label="Serviceinterval (timer)"><Input type="number" value={values.service_interval_hours} onChange={(e) => setValues({ ...values, service_interval_hours: e.target.value })} /></Field>
                  <Field label="Serviceinterval (mdr)"><Input type="number" value={values.service_interval_months} onChange={(e) => setValues({ ...values, service_interval_months: e.target.value })} /></Field>
                </div>
              </div>

              <div className="border-t pt-3 mt-3">
                <div className="text-sm font-medium mb-2 text-muted-foreground">Økonomi</div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Estimeret værdi (kr)"><Input type="number" value={values.estimated_value} onChange={(e) => setValues({ ...values, estimated_value: e.target.value })} /></Field>
                  <Field label="Forsikringsselskab"><Input value={values.insurance_company} onChange={(e) => setValues({ ...values, insurance_company: e.target.value })} /></Field>
                  <Field label="Forsikring udløber"><Input type="date" value={values.insurance_expiry} onChange={(e) => setValues({ ...values, insurance_expiry: e.target.value })} /></Field>
                  <Field label="Leasing udløber"><Input type="date" value={values.lease_expiry} onChange={(e) => setValues({ ...values, lease_expiry: e.target.value })} /></Field>
                </div>
              </div>

              <Field label="Foretrukken leverandør">
                <Select value={values.preferred_supplier_id} onValueChange={(v) => setValues({ ...values, preferred_supplier_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>—</SelectItem>
                    {contacts.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Billede URL"><Input value={values.image_url} onChange={(e) => setValues({ ...values, image_url: e.target.value })} /></Field>
              <Field label="Noter"><Textarea rows={3} value={values.notes} onChange={(e) => setValues({ ...values, notes: e.target.value })} /></Field>

              <DialogFooter>
                {editing && (
                  <Button type="button" variant="outline" className="mr-auto text-red-600" onClick={() => onDelete(editing)}>
                    <Trash2 className="h-4 w-4 mr-1" /> Slet
                  </Button>
                )}
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annullér</Button>
                <Button type="submit" disabled={saving}>{saving ? "Gemmer…" : "Gem"}</Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="service">
            {editing && <ServiceLogPanel machine={editing} contacts={contacts} />}
          </TabsContent>

          <TabsContent value="opgaver">
            {editing && <MachineTasksPanel machineId={editing.id} />}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function ServiceLogPanel({ machine, contacts }: { machine: MachineRow; contacts: { id: string; name: string }[] }) {
  const qc = useQueryClient();
  const listLogs = useServerFn(listServiceLogs);
  const createLog = useServerFn(createServiceLog);
  const removeLog = useServerFn(deleteServiceLog);
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["service-logs", machine.id],
    queryFn: () => listLogs({ data: { machine_id: machine.id } }),
  });
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    service_date: new Date().toISOString().slice(0, 10),
    hours_at_service: "",
    description: "",
    cost: "",
    supplier_id: NONE,
    next_service_date: "",
    next_service_hours: "",
  });
  const [saving, setSaving] = useState(false);

  async function add() {
    setSaving(true);
    try {
      await createLog({
        data: {
          machine_id: machine.id,
          service_date: form.service_date,
          hours_at_service: form.hours_at_service ? Number(form.hours_at_service) : null,
          description: form.description || null,
          cost: form.cost ? Number(form.cost) : null,
          supplier_id: form.supplier_id === NONE ? null : form.supplier_id,
          next_service_date: form.next_service_date || null,
          next_service_hours: form.next_service_hours ? Number(form.next_service_hours) : null,
        },
      });
      toast.success("Service registreret");
      qc.invalidateQueries({ queryKey: ["service-logs", machine.id] });
      qc.invalidateQueries({ queryKey: ["machines"] });
      setAdding(false);
      setForm({ ...form, hours_at_service: "", description: "", cost: "", next_service_date: "", next_service_hours: "" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function del(l: ServiceLogRow) {
    try {
      await removeLog({ data: { id: l.id } });
      qc.invalidateQueries({ queryKey: ["service-logs", machine.id] });
      toast.success("Slettet");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="pt-2 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{logs.length} registreringer</div>
        {!adding && <Button size="sm" onClick={() => setAdding(true)}><Plus className="h-4 w-4 mr-1" /> Registrér service</Button>}
      </div>

      {adding && (
        <div className="border border-border rounded-lg p-3 space-y-3 bg-muted/30">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Dato"><Input type="date" value={form.service_date} onChange={(e) => setForm({ ...form, service_date: e.target.value })} /></Field>
            <Field label="Timetal"><Input type="number" value={form.hours_at_service} onChange={(e) => setForm({ ...form, hours_at_service: e.target.value })} /></Field>
          </div>
          <Field label="Beskrivelse"><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Pris (kr)"><Input type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} /></Field>
            <Field label="Leverandør">
              <Select value={form.supplier_id} onValueChange={(v) => setForm({ ...form, supplier_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {contacts.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Næste service (dato)"><Input type="date" value={form.next_service_date} onChange={(e) => setForm({ ...form, next_service_date: e.target.value })} /></Field>
            <Field label="Næste service (timer)"><Input type="number" value={form.next_service_hours} onChange={(e) => setForm({ ...form, next_service_hours: e.target.value })} /></Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setAdding(false)}>Annullér</Button>
            <Button size="sm" disabled={saving} onClick={add}>{saving ? "Gemmer…" : "Gem service"}</Button>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Dato</th>
              <th className="px-3 py-2 font-medium">Timer</th>
              <th className="px-3 py-2 font-medium">Beskrivelse</th>
              <th className="px-3 py-2 font-medium">Leverandør</th>
              <th className="px-3 py-2 font-medium text-right">Pris</th>
              <th className="px-3 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && <tr><td colSpan={6} className="px-3 py-4 text-center text-muted-foreground">Indlæser…</td></tr>}
            {!isLoading && logs.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Ingen registreringer.</td></tr>}
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="px-3 py-2">{formatDate(l.service_date)}</td>
                <td className="px-3 py-2 tabular-nums text-muted-foreground">{l.hours_at_service ?? "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">{l.description ?? "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">{l.supplier_name ?? "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{l.cost != null ? formatDKK(Number(l.cost)) : "—"}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => del(l)} className="p-1 rounded hover:bg-muted text-red-600" aria-label="Slet">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MachineTasksPanel({ machineId }: { machineId: string }) {
  const listTasks = useServerFn(listMaintenanceTasks);
  const { data: tasks = [] } = useQuery({
    queryKey: ["maintenance-tasks"],
    queryFn: () => listTasks(),
  });
  const machineTasks = tasks.filter((t) => t.machine_id === machineId);

  return (
    <div className="pt-2">
      <div className="text-sm text-muted-foreground mb-3">{machineTasks.length} opgaver knyttet til denne maskine</div>
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Opgave</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Forfald</th>
              <th className="px-3 py-2 font-medium text-right">Estimat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {machineTasks.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">Ingen opgaver. Opret på Vedligehold-siden.</td></tr>}
            {machineTasks.map((t) => {
              const days = daysUntil(t.due_date);
              return (
                <tr key={t.id}>
                  <td className="px-3 py-2 font-medium">{t.title}</td>
                  <td className="px-3 py-2 text-muted-foreground">{t.status}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {t.due_date ? `${formatDate(t.due_date)}${days != null ? ` (${days < 0 ? `${-days} d for sent` : `om ${days} d`})` : ""}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{t.estimated_cost != null ? formatDKK(Number(t.estimated_cost)) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
