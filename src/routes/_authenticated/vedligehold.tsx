import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Pencil, Plus, Trash2, Wrench } from "lucide-react";
import { toast } from "sonner";

import {
  CATEGORIES,
  CATEGORY_LABEL,
  PRIORITIES,
  PRIORITY_LABEL,
  STATUSES,
  STATUS_LABEL,
  createMaintenanceTask,
  deleteMaintenanceTask,
  listMaintenanceBuildings,
  listMaintenanceContacts,
  listMaintenanceTasks,
  updateMaintenanceTask,
  type MaintenanceTaskRow,
} from "@/lib/maintenance.functions";
import { listMachines } from "@/lib/machines.functions";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export const Route = createFileRoute("/_authenticated/vedligehold")({
  component: VedligeholdPage,
});

const NONE = "__none__";

type LinkKind = "ingen" | "bygning" | "maskine";

type FormState = {
  title: string;
  description: string;
  link_kind: LinkKind;
  building_id: string;
  machine_id: string;
  assigned_contact_id: string;
  preferred_supplier_id: string;
  category: string;
  priority: (typeof PRIORITIES)[number];
  status: (typeof STATUSES)[number];
  due_date: string;
  completed_date: string;
  estimated_cost: string;
  actual_cost: string;
  notes: string;
};

const empty: FormState = {
  title: "",
  description: "",
  link_kind: "bygning",
  building_id: NONE,
  machine_id: NONE,
  assigned_contact_id: NONE,
  preferred_supplier_id: NONE,
  category: "bygning",
  priority: "medium",
  status: "open",
  due_date: "",
  completed_date: "",
  estimated_cost: "",
  actual_cost: "",
  notes: "",
};

const priorityColor: Record<string, string> = {
  low: "bg-gray-100 text-gray-700",
  medium: "bg-blue-100 text-blue-800",
  high: "bg-amber-100 text-amber-800",
  critical: "bg-red-100 text-red-800",
};

const statusColor: Record<string, string> = {
  open: "bg-slate-100 text-slate-800",
  in_progress: "bg-blue-100 text-blue-800",
  done: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-gray-100 text-gray-500",
};

function dueColor(days: number | null, status: string): string {
  if (status === "done" || status === "cancelled") return "text-muted-foreground";
  if (days == null) return "text-muted-foreground";
  if (days < 0) return "text-red-600 font-medium";
  if (days < 7) return "text-amber-700 font-medium";
  return "text-muted-foreground";
}

function VedligeholdPage() {
  const qc = useQueryClient();
  const list = useServerFn(listMaintenanceTasks);
  const listBuildings = useServerFn(listMaintenanceBuildings);
  const listContacts = useServerFn(listMaintenanceContacts);
  const listMachinesFn = useServerFn(listMachines);
  const create = useServerFn(createMaintenanceTask);
  const update = useServerFn(updateMaintenanceTask);
  const remove = useServerFn(deleteMaintenanceTask);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["maintenance-tasks"],
    queryFn: () => list(),
  });
  const { data: buildings = [] } = useQuery({
    queryKey: ["maintenance-buildings"],
    queryFn: () => listBuildings(),
  });
  const { data: contacts = [] } = useQuery({
    queryKey: ["maintenance-contacts"],
    queryFn: () => listContacts(),
  });
  const { data: machines = [] } = useQuery({
    queryKey: ["machines"],
    queryFn: () => listMachinesFn(),
  });

  const [editing, setEditing] = useState<MaintenanceTaskRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<MaintenanceTaskRow | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [scope, setScope] = useState<"alle" | "bygninger" | "maskiner">("alle");

  const filtered = useMemo(() => {
    let r = rows;
    if (scope === "bygninger") r = r.filter((x) => x.building_id);
    if (scope === "maskiner") r = r.filter((x) => x.machine_id);
    if (statusFilter === "active") r = r.filter((x) => x.status === "open" || x.status === "in_progress");
    else if (statusFilter !== "all") r = r.filter((x) => x.status === statusFilter);
    return r;
  }, [rows, statusFilter, scope]);

  const openCount = rows.filter((r) => r.status === "open" || r.status === "in_progress").length;
  const overdueCount = rows.filter((r) => {
    if (r.status === "done" || r.status === "cancelled" || !r.due_date) return false;
    const d = daysUntil(r.due_date);
    return d != null && d < 0;
  }).length;
  const ytdCost = rows
    .filter((r) => r.completed_date && new Date(r.completed_date).getFullYear() === new Date().getFullYear())
    .reduce((s, r) => s + Number(r.actual_cost ?? 0), 0);

  const deleteMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Slettet");
      qc.invalidateQueries({ queryKey: ["maintenance-tasks"] });
      setToDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const completeMut = useMutation({
    mutationFn: (r: MaintenanceTaskRow) =>
      update({
        data: {
          id: r.id,
          title: r.title,
          description: r.description,
          building_id: r.building_id,
          machine_id: r.machine_id,
          assigned_contact_id: r.assigned_contact_id,
          preferred_supplier_id: r.preferred_supplier_id,
          category: r.category,
          priority: r.priority as (typeof PRIORITIES)[number],
          status: "done" as const,
          due_date: r.due_date,
          completed_date: new Date().toISOString().slice(0, 10),
          estimated_cost: r.estimated_cost,
          actual_cost: r.actual_cost,
          notes: r.notes,
        },
      }),
    onSuccess: () => {
      toast.success("Markeret som færdig");
      qc.invalidateQueries({ queryKey: ["maintenance-tasks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const open = creating || editing != null;

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--brand-900)]">Vedligehold</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Opgaver på bygninger og maskiner</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Aktive</SelectItem>
              <SelectItem value="all">Alle</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-1" /> Ny opgave
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Åbne opgaver</div>
          <div className="text-2xl font-semibold mt-1 tabular-nums">{openCount}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Overskredet</div>
          <div className={`text-2xl font-semibold mt-1 tabular-nums ${overdueCount > 0 ? "text-red-600" : ""}`}>{overdueCount}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Faktisk omkostning YTD</div>
          <div className="text-2xl font-semibold mt-1 tabular-nums">{formatDKK(ytdCost)}</div>
        </div>
      </div>

      <Tabs value={scope} onValueChange={(v) => setScope(v as typeof scope)} className="mb-4">
        <TabsList>
          <TabsTrigger value="alle">Alle</TabsTrigger>
          <TabsTrigger value="bygninger">Bygninger</TabsTrigger>
          <TabsTrigger value="maskiner">Maskiner</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Opgave</th>
              <th className="px-4 py-2.5 font-medium">Kategori</th>
              <th className="px-4 py-2.5 font-medium">Tilknyttet</th>
              <th className="px-4 py-2.5 font-medium">Foretrukken leverandør</th>
              <th className="px-4 py-2.5 font-medium">Prioritet</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Forfald</th>
              <th className="px-4 py-2.5 font-medium text-right">Estimat</th>
              <th className="px-4 py-2.5 w-32"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && <tr><td colSpan={9} className="px-4 py-6 text-center text-muted-foreground">Indlæser…</td></tr>}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                <Wrench className="h-8 w-8 mx-auto mb-2 opacity-40" />
                Ingen opgaver.
              </td></tr>
            )}
            {filtered.map((r) => {
              const days = daysUntil(r.due_date);
              const isDone = r.status === "done" || r.status === "cancelled";
              const linked = r.building_name
                ? `🏠 ${r.building_name}`
                : r.machine_name
                  ? `🚜 ${r.machine_name}`
                  : "—";
              return (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <div className={`font-medium ${isDone ? "line-through text-muted-foreground" : ""}`}>{r.title}</div>
                    {r.description && <div className="text-xs text-muted-foreground truncate max-w-xs">{r.description}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{r.category ? (CATEGORY_LABEL[r.category] ?? r.category) : "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{linked}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{r.preferred_supplier_name ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${priorityColor[r.priority]}`}>
                      {PRIORITY_LABEL[r.priority]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[r.status]}`}>
                      {STATUS_LABEL[r.status]}
                    </span>
                  </td>
                  <td className={`px-4 py-2.5 text-xs ${dueColor(days, r.status)}`}>
                    {r.due_date ? (
                      <>
                        {formatDate(r.due_date)}
                        {!isDone && days != null && (
                          <div className="text-[10px]">
                            {days < 0 ? `${-days} d for sent` : days === 0 ? "I dag" : `om ${days} d`}
                          </div>
                        )}
                      </>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                    {r.estimated_cost != null ? formatDKK(Number(r.estimated_cost)) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {!isDone && (
                      <button onClick={() => completeMut.mutate(r)} className="p-1.5 rounded hover:bg-muted text-emerald-700" aria-label="Færdig"><CheckCircle2 className="h-4 w-4" /></button>
                    )}
                    <button onClick={() => setEditing(r)} className="p-1.5 rounded hover:bg-muted" aria-label="Rediger"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => setToDelete(r)} className="p-1.5 rounded hover:bg-muted text-red-600" aria-label="Slet"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <TaskDialog
        open={open}
        editing={editing}
        buildings={buildings}
        machines={machines.map((m) => ({ id: m.id, name: m.name, preferred_supplier_id: m.preferred_supplier_id }))}
        contacts={contacts}
        onOpenChange={(o) => { if (!o) { setCreating(false); setEditing(null); } }}
        onSubmit={async (v) => {
          const payload = {
            title: v.title.trim(),
            description: v.description || null,
            building_id: v.link_kind === "bygning" && v.building_id !== NONE ? v.building_id : null,
            machine_id: v.link_kind === "maskine" && v.machine_id !== NONE ? v.machine_id : null,
            assigned_contact_id: v.assigned_contact_id === NONE ? null : v.assigned_contact_id,
            preferred_supplier_id: v.preferred_supplier_id === NONE ? null : v.preferred_supplier_id,
            category: v.category || null,
            priority: v.priority,
            status: v.status,
            due_date: v.due_date || null,
            completed_date: v.completed_date || null,
            estimated_cost: v.estimated_cost ? Number(v.estimated_cost) : null,
            actual_cost: v.actual_cost ? Number(v.actual_cost) : null,
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
            qc.invalidateQueries({ queryKey: ["maintenance-tasks"] });
            setCreating(false); setEditing(null);
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      />

      <AlertDialog open={toDelete != null} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet opgave</AlertDialogTitle>
            <AlertDialogDescription>Slet "{toDelete?.title}"? Dette kan ikke fortrydes.</AlertDialogDescription>
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

function TaskDialog({
  open, editing, buildings, machines, contacts, onOpenChange, onSubmit,
}: {
  open: boolean;
  editing: MaintenanceTaskRow | null;
  buildings: { id: string; name: string }[];
  machines: { id: string; name: string; preferred_supplier_id: string | null }[];
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
      title: editing.title,
      description: editing.description ?? "",
      link_kind: editing.machine_id ? "maskine" : editing.building_id ? "bygning" : "ingen",
      building_id: editing.building_id ?? NONE,
      machine_id: editing.machine_id ?? NONE,
      assigned_contact_id: editing.assigned_contact_id ?? NONE,
      preferred_supplier_id: editing.preferred_supplier_id ?? NONE,
      category: editing.category ?? "bygning",
      priority: (editing.priority as (typeof PRIORITIES)[number]) ?? "medium",
      status: (editing.status as (typeof STATUSES)[number]) ?? "open",
      due_date: editing.due_date ?? "",
      completed_date: editing.completed_date ?? "",
      estimated_cost: editing.estimated_cost != null ? String(editing.estimated_cost) : "",
      actual_cost: editing.actual_cost != null ? String(editing.actual_cost) : "",
      notes: editing.notes ?? "",
    } : empty);
  }

  function onMachinePick(id: string) {
    const m = machines.find((x) => x.id === id);
    setValues({
      ...values,
      machine_id: id,
      preferred_supplier_id:
        values.preferred_supplier_id === NONE && m?.preferred_supplier_id
          ? m.preferred_supplier_id
          : values.preferred_supplier_id,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Rediger opgave" : "Ny vedligeholdsopgave"}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={async (e) => { e.preventDefault(); setSaving(true); try { await onSubmit(values); } finally { setSaving(false); } }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="title">Titel</Label>
            <Input id="title" required maxLength={200} value={values.title} onChange={(e) => setValues({ ...values, title: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="desc">Beskrivelse</Label>
            <Textarea id="desc" rows={2} maxLength={4000} value={values.description} onChange={(e) => setValues({ ...values, description: e.target.value })} />
          </div>

          <div className="space-y-1.5">
            <Label>Tilknyt til</Label>
            <RadioGroup
              value={values.link_kind}
              onValueChange={(v) => setValues({ ...values, link_kind: v as LinkKind })}
              className="flex gap-4"
            >
              <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="bygning" /> Bygning</label>
              <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="maskine" /> Maskine</label>
              <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="ingen" /> Ingen</label>
            </RadioGroup>
          </div>

          {values.link_kind === "bygning" && (
            <div className="space-y-1.5">
              <Label>Bygning</Label>
              <Select value={values.building_id} onValueChange={(v) => setValues({ ...values, building_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {buildings.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {values.link_kind === "maskine" && (
            <div className="space-y-1.5">
              <Label>Maskine</Label>
              <Select value={values.machine_id} onValueChange={onMachinePick}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {machines.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Kategori</Label>
              <Select value={values.category} onValueChange={(v) => setValues({ ...values, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Foretrukken leverandør</Label>
              <Select value={values.preferred_supplier_id} onValueChange={(v) => setValues({ ...values, preferred_supplier_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {contacts.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Prioritet</Label>
              <Select value={values.priority} onValueChange={(v) => setValues({ ...values, priority: v as (typeof PRIORITIES)[number] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={values.status} onValueChange={(v) => setValues({ ...values, status: v as (typeof STATUSES)[number] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Ansvarlig</Label>
              <Select value={values.assigned_contact_id} onValueChange={(v) => setValues({ ...values, assigned_contact_id: v })}>
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
              <Label htmlFor="due">Forfaldsdato</Label>
              <Input id="due" type="date" value={values.due_date} onChange={(e) => setValues({ ...values, due_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="comp">Udført dato</Label>
              <Input id="comp" type="date" value={values.completed_date} onChange={(e) => setValues({ ...values, completed_date: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="est">Estimeret omkostning (kr)</Label>
              <Input id="est" type="number" step="0.01" min="0" value={values.estimated_cost} onChange={(e) => setValues({ ...values, estimated_cost: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="act">Faktisk omkostning (kr)</Label>
              <Input id="act" type="number" step="0.01" min="0" value={values.actual_cost} onChange={(e) => setValues({ ...values, actual_cost: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Noter</Label>
            <Textarea id="notes" rows={3} maxLength={4000} value={values.notes} onChange={(e) => setValues({ ...values, notes: e.target.value })} />
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
