import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, ListTodo, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  CATEGORIES,
  CATEGORY_LABEL,
  PRIORITIES,
  PRIORITY_LABEL,
  STATUSES,
  STATUS_LABEL,
  createTask,
  deleteTask,
  listTasks,
  updateTask,
  type TaskRow,
} from "@/lib/tasks.functions";
import { listMaintenanceContacts } from "@/lib/maintenance.functions";
import { daysUntil, formatDate } from "@/lib/format";
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

export const Route = createFileRoute("/_authenticated/opgaver")({
  component: OpgaverPage,
});

const NONE = "__none__";

type FormState = {
  title: string;
  description: string;
  assigned_contact_id: string;
  category: string;
  priority: (typeof PRIORITIES)[number];
  status: (typeof STATUSES)[number];
  due_date: string;
  completed_date: string;
  notes: string;
};

const empty: FormState = {
  title: "",
  description: "",
  assigned_contact_id: NONE,
  category: "administration",
  priority: "medium",
  status: "open",
  due_date: "",
  completed_date: "",
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

function OpgaverPage() {
  const qc = useQueryClient();
  const list = useServerFn(listTasks);
  const listContacts = useServerFn(listMaintenanceContacts);
  const create = useServerFn(createTask);
  const update = useServerFn(updateTask);
  const remove = useServerFn(deleteTask);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => list(),
  });
  const { data: contacts = [] } = useQuery({
    queryKey: ["maintenance-contacts"],
    queryFn: () => listContacts(),
  });

  const [editing, setEditing] = useState<TaskRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<TaskRow | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("active");

  const filtered = useMemo(() => {
    let r = rows;
    if (statusFilter === "active") r = r.filter((x) => x.status === "open" || x.status === "in_progress");
    else if (statusFilter !== "all") r = r.filter((x) => x.status === statusFilter);
    return r;
  }, [rows, statusFilter]);

  const openCount = rows.filter((r) => r.status === "open" || r.status === "in_progress").length;
  const overdueCount = rows.filter((r) => {
    if (r.status === "done" || r.status === "cancelled" || !r.due_date) return false;
    const d = daysUntil(r.due_date);
    return d != null && d < 0;
  }).length;
  const doneCount = rows.filter((r) => r.status === "done").length;

  const deleteMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Slettet");
      qc.invalidateQueries({ queryKey: ["tasks"] });
      setToDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const completeMut = useMutation({
    mutationFn: (r: TaskRow) =>
      update({
        data: {
          id: r.id,
          title: r.title,
          description: r.description,
          assigned_contact_id: r.assigned_contact_id,
          category: r.category,
          priority: r.priority as (typeof PRIORITIES)[number],
          status: "done" as const,
          due_date: r.due_date,
          completed_date: new Date().toISOString().slice(0, 10),
          notes: r.notes,
        },
      }),
    onSuccess: () => {
      toast.success("Markeret som færdig");
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const open = creating || editing != null;

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--brand-900)]">Opgaver</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Generelle opgaver og to-do'er</p>
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
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Færdige</div>
          <div className="text-2xl font-semibold mt-1 tabular-nums">{doneCount}</div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Opgave</th>
              <th className="px-4 py-2.5 font-medium">Kategori</th>
              <th className="px-4 py-2.5 font-medium">Ansvarlig</th>
              <th className="px-4 py-2.5 font-medium">Prioritet</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Forfald</th>
              <th className="px-4 py-2.5 w-32"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">Indlæser…</td></tr>}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                <ListTodo className="h-8 w-8 mx-auto mb-2 opacity-40" />
                Ingen opgaver.
              </td></tr>
            )}
            {filtered.map((r) => {
              const days = daysUntil(r.due_date);
              const isDone = r.status === "done" || r.status === "cancelled";
              return (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <div className={`font-medium ${isDone ? "line-through text-muted-foreground" : ""}`}>{r.title}</div>
                    {r.description && <div className="text-xs text-muted-foreground truncate max-w-xs">{r.description}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{r.category ? (CATEGORY_LABEL[r.category] ?? r.category) : "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{r.contact_name ?? "—"}</td>
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
        contacts={contacts}
        onOpenChange={(o) => { if (!o) { setCreating(false); setEditing(null); } }}
        onSubmit={async (v) => {
          const payload = {
            title: v.title.trim(),
            description: v.description || null,
            assigned_contact_id: v.assigned_contact_id === NONE ? null : v.assigned_contact_id,
            category: v.category || null,
            priority: v.priority,
            status: v.status,
            due_date: v.due_date || null,
            completed_date: v.completed_date || null,
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
            qc.invalidateQueries({ queryKey: ["tasks"] });
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
  open, editing, contacts, onOpenChange, onSubmit,
}: {
  open: boolean;
  editing: TaskRow | null;
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
      assigned_contact_id: editing.assigned_contact_id ?? NONE,
      category: editing.category ?? "administration",
      priority: (editing.priority as (typeof PRIORITIES)[number]) ?? "medium",
      status: (editing.status as (typeof STATUSES)[number]) ?? "open",
      due_date: editing.due_date ?? "",
      completed_date: editing.completed_date ?? "",
      notes: editing.notes ?? "",
    } : empty);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Rediger opgave" : "Ny opgave"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label>Titel *</Label>
            <Input value={values.title} onChange={(e) => setValues({ ...values, title: e.target.value })} />
          </div>
          <div className="col-span-2">
            <Label>Beskrivelse</Label>
            <Textarea rows={2} value={values.description} onChange={(e) => setValues({ ...values, description: e.target.value })} />
          </div>
          <div>
            <Label>Kategori</Label>
            <Select value={values.category} onValueChange={(v) => setValues({ ...values, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Ansvarlig</Label>
            <Select value={values.assigned_contact_id} onValueChange={(v) => setValues({ ...values, assigned_contact_id: v })}>
              <SelectTrigger><SelectValue placeholder="Ingen" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Ingen</SelectItem>
                {contacts.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Prioritet</Label>
            <Select value={values.priority} onValueChange={(v) => setValues({ ...values, priority: v as (typeof PRIORITIES)[number] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={values.status} onValueChange={(v) => setValues({ ...values, status: v as (typeof STATUSES)[number] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Forfaldsdato</Label>
            <Input type="date" value={values.due_date} onChange={(e) => setValues({ ...values, due_date: e.target.value })} />
          </div>
          <div>
            <Label>Færdig dato</Label>
            <Input type="date" value={values.completed_date} onChange={(e) => setValues({ ...values, completed_date: e.target.value })} />
          </div>
          <div className="col-span-2">
            <Label>Noter</Label>
            <Textarea rows={3} value={values.notes} onChange={(e) => setValues({ ...values, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annullér</Button>
          <Button
            disabled={!values.title.trim() || saving}
            onClick={async () => {
              setSaving(true);
              try { await onSubmit(values); } finally { setSaving(false); }
            }}
          >
            {saving ? "Gemmer…" : "Gem"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
