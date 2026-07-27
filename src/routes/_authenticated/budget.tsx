import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, Plus, Trash2, CalendarDays, Copy } from "lucide-react";
import { toast } from "sonner";

import {
  copyBudgetToYear,
  createBudgetLine,
  createLoan,
  createScenario,
  deleteBudgetLine,
  deleteBudgetYear,
  deleteLoan,
  getBudgetByYear,
  listBudgetYears,
  updateBudgetLine,
  updateLoan,
  updateScenario,
  type BudgetLine,
  type BudgetLoan,
  type LoanType,
} from "@/lib/budget.functions";
import { buildAmortization, calcLoan } from "@/lib/loan-math";
import { formatDKK } from "@/lib/format";

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
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/budget")({
  component: BudgetPage,
});

const CATEGORY_OPTIONS = [
  "forpagtning",
  "bygningsudlejning",
  "halm",
  "jagtleje",
  "skov",
  "stuehus",
  "eu-tilskud",
  "forsikring",
  "ejendomsskat",
  "energi",
  "administration",
  "maskinstation",
  "vedligehold",
  "finansiering",
  "andet",
] as const;

const CATEGORY_LABEL: Record<string, string> = {
  forpagtning: "Forpagtning",
  bygningsudlejning: "Bygningsudlejning",
  halm: "Halm",
  jagtleje: "Jagtleje",
  skov: "Skov",
  stuehus: "Stuehus",
  "eu-tilskud": "EU-tilskud",
  forsikring: "Forsikring",
  ejendomsskat: "Ejendomsskat",
  energi: "Energi",
  administration: "Administration",
  maskinstation: "Maskinstation",
  vedligehold: "Vedligehold",
  finansiering: "Finansiering",
  andet: "Andet",
};

const LOAN_TYPE_LABEL: Record<LoanType, string> = {
  annuity: "Annuitet",
  interest_only: "Rente-only",
  standing: "Stående / rente- og afdragsfrit",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"];

function BudgetPage() {
  const qc = useQueryClient();
  const fetchScenarios = useServerFn(listScenarios);
  const fetchScenario = useServerFn(getScenario);
  const createScenarioFn = useServerFn(createScenario);
  const setPrimaryFn = useServerFn(setPrimaryScenario);
  const updateScenarioFn = useServerFn(updateScenario);
  const deleteScenarioFn = useServerFn(deleteScenario);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [monthlyView, setMonthlyView] = useState(false);
  const [newScenarioOpen, setNewScenarioOpen] = useState(false);

  const scenariosQ = useQuery({
    queryKey: ["budget-scenarios"],
    queryFn: () => fetchScenarios(),
  });

  const currentId = selectedId ?? scenariosQ.data?.find((s) => s.is_primary)?.id ?? scenariosQ.data?.[0]?.id ?? null;

  const bundleQ = useQuery({
    queryKey: ["budget-scenario", currentId],
    queryFn: () => fetchScenario({ data: { id: currentId! } }),
    enabled: !!currentId,
  });

  const createScenarioMut = useMutation({
    mutationFn: (data: { name: string; year: number; notes: string | null }) => createScenarioFn({ data }),
    onSuccess: (res) => {
      toast.success("Scenarie oprettet");
      qc.invalidateQueries({ queryKey: ["budget-scenarios"] });
      setSelectedId(res.id);
      setNewScenarioOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setPrimaryMut = useMutation({
    mutationFn: (id: string) => setPrimaryFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budget-scenarios"] }),
  });

  const deleteScenarioMut = useMutation({
    mutationFn: (id: string) => deleteScenarioFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Scenarie slettet");
      setSelectedId(null);
      qc.invalidateQueries({ queryKey: ["budget-scenarios"] });
    },
  });

  const updateScenarioMut = useMutation({
    mutationFn: (data: { id: string; name: string; year: number; notes: string | null }) =>
      updateScenarioFn({ data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budget-scenarios"] });
      qc.invalidateQueries({ queryKey: ["budget-scenario"] });
    },
  });

  const bundle = bundleQ.data ?? null;
  const scenario = bundle?.scenario ?? null;
  const lines = bundle?.lines ?? [];
  const loans = bundle?.loans ?? [];

  const incomes = lines.filter((l) => l.kind === "income");
  const expenses = lines.filter((l) => l.kind === "expense");

  const totalIncome = incomes.reduce((s, l) => s + l.annual_amount, 0);
  const totalExpense = expenses.reduce((s, l) => s + l.annual_amount, 0);
  const totalLoanPayments = loans.reduce((s, l) => s + calcLoan(l).annualPayment, 0);
  const result = totalIncome - totalExpense - totalLoanPayments;

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--brand-900)]">Budget</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Drift og finansiering pr. scenarie</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={currentId ?? ""} onValueChange={(v) => setSelectedId(v)}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Vælg scenarie" />
            </SelectTrigger>
            <SelectContent>
              {(scenariosQ.data ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.is_primary ? "★ " : ""}{s.name} · {s.year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {scenario && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPrimaryMut.mutate(scenario.id)}
              title={scenario.is_primary ? "Primær" : "Sæt som primær"}
            >
              {scenario.is_primary ? <Star className="h-4 w-4 fill-current" /> : <StarOff className="h-4 w-4" />}
            </Button>
          )}
          <Button size="sm" onClick={() => setNewScenarioOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Nyt scenarie
          </Button>
        </div>
      </div>

      {!scenario && !scenariosQ.isLoading && (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <p className="text-muted-foreground mb-4">Der er ingen budget-scenarier endnu.</p>
          <Button onClick={() => setNewScenarioOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Opret dit første scenarie
          </Button>
        </div>
      )}

      {scenario && (
        <>
          <ScenarioHeader
            scenario={scenario}
            onUpdate={(patch) => updateScenarioMut.mutate({ id: scenario.id, ...patch })}
            onDelete={() => deleteScenarioMut.mutate(scenario.id)}
          />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="Indtægter / år" value={formatDKK(totalIncome)} sub={`${formatDKK(totalIncome / 12)} / md`} tone="green" />
            <Kpi label="Driftsudgifter / år" value={formatDKK(totalExpense)} sub={`${formatDKK(totalExpense / 12)} / md`} tone="red" />
            <Kpi label="Låneydelser / år" value={formatDKK(totalLoanPayments)} sub={`${formatDKK(totalLoanPayments / 12)} / md`} tone="red" />
            <Kpi
              label="Resultat / år"
              value={formatDKK(result)}
              sub={`${formatDKK(result / 12)} / md`}
              tone={result >= 0 ? "green" : "red"}
              emphasise
            />
          </div>

          <div className="flex items-center gap-3">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="monthly-toggle" className="text-sm">Vis månedsfordeling</Label>
            <Switch id="monthly-toggle" checked={monthlyView} onCheckedChange={setMonthlyView} />
          </div>

          <LinesTable
            title="Indtægter"
            kind="income"
            scenarioId={scenario.id}
            lines={incomes}
            monthlyView={monthlyView}
          />

          <LinesTable
            title="Driftsudgifter"
            kind="expense"
            scenarioId={scenario.id}
            lines={expenses}
            monthlyView={monthlyView}
          />

          <LoansSection scenarioId={scenario.id} loans={loans} />

          <div className="bg-card border-2 border-[var(--brand-500)] rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Årsresultat (indtægter − drift − låneydelser)</div>
                <div className={`text-3xl font-semibold ${result >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                  {formatDKK(result)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Pr. måned</div>
                <div className={`text-xl font-semibold ${result >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                  {formatDKK(result / 12)}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <NewScenarioDialog
        open={newScenarioOpen}
        onOpenChange={setNewScenarioOpen}
        onCreate={(data) => createScenarioMut.mutate(data)}
      />
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone,
  emphasise,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: "green" | "red";
  emphasise?: boolean;
}) {
  const color = tone === "green" ? "text-emerald-700" : "text-red-700";
  return (
    <div className={`bg-card border ${emphasise ? "border-[var(--brand-500)]" : "border-border"} rounded-xl p-4`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${color}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function ScenarioHeader({
  scenario,
  onUpdate,
  onDelete,
}: {
  scenario: { id: string; name: string; year: number; notes: string | null };
  onUpdate: (patch: { name: string; year: number; notes: string | null }) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(scenario.name);
  const [year, setYear] = useState(String(scenario.year));
  const [notes, setNotes] = useState(scenario.notes ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="text-lg font-semibold text-[var(--brand-900)]">{scenario.name} <span className="text-muted-foreground font-normal">· {scenario.year}</span></div>
        {scenario.notes && <div className="text-sm text-muted-foreground mt-1 whitespace-pre-line">{scenario.notes}</div>}
      </div>
      <div className="flex gap-2 shrink-0">
        <Button variant="outline" size="sm" onClick={() => { setName(scenario.name); setYear(String(scenario.year)); setNotes(scenario.notes ?? ""); setEditing(true); }}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => setConfirmDelete(true)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rediger scenarie</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Navn</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><Label>År</Label><Input type="number" value={year} onChange={(e) => setYear(e.target.value)} /></div>
            <div><Label>Noter</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(false)}>Annuller</Button>
            <Button onClick={() => { onUpdate({ name: name.trim(), year: Number(year), notes: notes.trim() || null }); setEditing(false); }}>Gem</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet scenarie?</AlertDialogTitle>
            <AlertDialogDescription>Alle linjer og lån i scenariet slettes også. Dette kan ikke fortrydes.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete}>Slet</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function NewScenarioDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreate: (data: { name: string; year: number; notes: string | null }) => void;
}) {
  const [name, setName] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [notes, setNotes] = useState("");

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (v) { setName(""); setYear(String(new Date().getFullYear())); setNotes(""); } }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nyt budget-scenarie</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Navn</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Fx Fjordager 11 – 2026" /></div>
          <div><Label>År</Label><Input type="number" value={year} onChange={(e) => setYear(e.target.value)} /></div>
          <div><Label>Noter</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuller</Button>
          <Button disabled={!name.trim()} onClick={() => onCreate({ name: name.trim(), year: Number(year), notes: notes.trim() || null })}>Opret</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Lines table ----------

function LinesTable({
  title,
  kind,
  scenarioId,
  lines,
  monthlyView,
}: {
  title: string;
  kind: "income" | "expense";
  scenarioId: string;
  lines: BudgetLine[];
  monthlyView: boolean;
}) {
  const qc = useQueryClient();
  const createFn = useServerFn(createBudgetLine);
  const updateFn = useServerFn(updateBudgetLine);
  const deleteFn = useServerFn(deleteBudgetLine);

  const [editing, setEditing] = useState<BudgetLine | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<BudgetLine | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["budget-scenario", scenarioId] });

  const createMut = useMutation({
    mutationFn: (data: {
      scenario_id: string; kind: "income" | "expense"; category: string; label: string;
      annual_amount: number; monthly_override: number[] | null; source_note: string | null; sort_order: number;
    }) => createFn({ data }),
    onSuccess: () => { toast.success("Linje tilføjet"); invalidate(); setCreating(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateMut = useMutation({
    mutationFn: (data: {
      id: string; category?: string; label?: string; annual_amount?: number;
      monthly_override?: number[] | null; source_note?: string | null; sort_order?: number;
    }) => updateFn({ data }),
    onSuccess: () => { invalidate(); setEditing(null); },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success("Linje slettet"); invalidate(); setConfirmDelete(null); },
  });

  const total = lines.reduce((s, l) => s + l.annual_amount, 0);

  const monthlyOf = (l: BudgetLine, m: number) =>
    l.monthly_override ? l.monthly_override[m] ?? 0 : l.annual_amount / 12;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between p-4 pb-2">
        <h2 className="font-semibold text-[var(--brand-900)]">{title}</h2>
        <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-1" /> Ny linje
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Post</TableHead>
              <TableHead>Kategori</TableHead>
              {monthlyView ? (
                MONTHS.map((m) => <TableHead key={m} className="text-right">{m}</TableHead>)
              ) : (
                <>
                  <TableHead className="text-right">Pr. år</TableHead>
                  <TableHead className="text-right">Pr. måned</TableHead>
                  <TableHead>Kilde</TableHead>
                </>
              )}
              <TableHead className="w-24 text-right">Handling</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-medium">{l.label}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{CATEGORY_LABEL[l.category] ?? l.category}</TableCell>
                {monthlyView ? (
                  MONTHS.map((_, m) => (
                    <TableCell key={m} className="text-right tabular-nums text-sm">{formatDKK(monthlyOf(l, m))}</TableCell>
                  ))
                ) : (
                  <>
                    <TableCell className="text-right tabular-nums">{formatDKK(l.annual_amount)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{formatDKK(l.annual_amount / 12)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{l.source_note ?? "—"}</TableCell>
                  </>
                )}
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(l)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(l)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {lines.length === 0 && (
              <TableRow>
                <TableCell colSpan={monthlyView ? 14 : 5} className="text-center text-muted-foreground py-6">
                  Ingen linjer endnu.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          {lines.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="font-semibold">I alt</TableCell>
                {monthlyView ? (
                  MONTHS.map((_, m) => (
                    <TableCell key={m} className="text-right tabular-nums font-semibold">
                      {formatDKK(lines.reduce((s, l) => s + monthlyOf(l, m), 0))}
                    </TableCell>
                  ))
                ) : (
                  <>
                    <TableCell className="text-right tabular-nums font-semibold">{formatDKK(total)}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{formatDKK(total / 12)}</TableCell>
                    <TableCell />
                  </>
                )}
                <TableCell />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>

      <LineDialog
        open={creating}
        onOpenChange={setCreating}
        title={`Ny ${kind === "income" ? "indtægt" : "udgift"}`}
        initial={null}
        kind={kind}
        onSubmit={(v) => createMut.mutate({ scenario_id: scenarioId, kind, sort_order: lines.length, ...v })}
      />
      <LineDialog
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
        title="Rediger linje"
        initial={editing}
        kind={kind}
        onSubmit={(v) => editing && updateMut.mutate({ id: editing.id, ...v })}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet linjen?</AlertDialogTitle>
            <AlertDialogDescription>{confirmDelete?.label}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDelete && deleteMut.mutate(confirmDelete.id)}>Slet</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function LineDialog({
  open,
  onOpenChange,
  title,
  initial,
  kind,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  initial: BudgetLine | null;
  kind: "income" | "expense";
  onSubmit: (v: {
    category: string;
    label: string;
    annual_amount: number;
    monthly_override: number[] | null;
    source_note: string | null;
  }) => void;
}) {
  const defaultCat = kind === "income" ? "forpagtning" : "vedligehold";
  const [label, setLabel] = useState(initial?.label ?? "");
  const [category, setCategory] = useState(initial?.category ?? defaultCat);
  const [annual, setAnnual] = useState(String(initial?.annual_amount ?? 0));
  const [source, setSource] = useState(initial?.source_note ?? "");
  const [useMonthly, setUseMonthly] = useState(!!initial?.monthly_override);
  const [monthly, setMonthly] = useState<string[]>(
    initial?.monthly_override?.map((n) => String(n)) ?? Array(12).fill("0"),
  );

  // Reset when initial changes
  useMemo(() => {
    setLabel(initial?.label ?? "");
    setCategory(initial?.category ?? defaultCat);
    setAnnual(String(initial?.annual_amount ?? 0));
    setSource(initial?.source_note ?? "");
    setUseMonthly(!!initial?.monthly_override);
    setMonthly(initial?.monthly_override?.map((n) => String(n)) ?? Array(12).fill("0"));
  }, [initial, defaultCat]);

  const submit = () => {
    const override = useMonthly ? monthly.map((v) => Number(v) || 0) : null;
    const annualNum = useMonthly && override ? override.reduce((s, v) => s + v, 0) : Number(annual) || 0;
    onSubmit({
      label: label.trim(),
      category,
      annual_amount: annualNum,
      monthly_override: override,
      source_note: source.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Post</Label><Input value={label} onChange={(e) => setLabel(e.target.value)} /></div>
          <div>
            <Label>Kategori</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {!useMonthly && (
            <div><Label>Beløb pr. år (kr.)</Label><Input type="number" value={annual} onChange={(e) => setAnnual(e.target.value)} /></div>
          )}
          <div className="flex items-center gap-2">
            <Switch checked={useMonthly} onCheckedChange={setUseMonthly} />
            <Label className="text-sm">Fordel pr. måned manuelt</Label>
          </div>
          {useMonthly && (
            <div className="grid grid-cols-4 gap-2">
              {MONTHS.map((m, i) => (
                <div key={m}>
                  <Label className="text-xs">{m}</Label>
                  <Input type="number" value={monthly[i]} onChange={(e) => {
                    const next = [...monthly]; next[i] = e.target.value; setMonthly(next);
                  }} />
                </div>
              ))}
            </div>
          )}
          <div><Label>Kilde / note</Label><Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Fx Note 3, skatteregnskab 2025" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuller</Button>
          <Button disabled={!label.trim()} onClick={submit}>Gem</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Loans ----------

function LoansSection({ scenarioId, loans }: { scenarioId: string; loans: BudgetLoan[] }) {
  const qc = useQueryClient();
  const createFn = useServerFn(createLoan);
  const updateFn = useServerFn(updateLoan);
  const deleteFn = useServerFn(deleteLoan);

  const [editing, setEditing] = useState<BudgetLoan | null>(null);
  const [creating, setCreating] = useState(false);
  const [amort, setAmort] = useState<BudgetLoan | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<BudgetLoan | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["budget-scenario", scenarioId] });

  const createMut = useMutation({
    mutationFn: (data: {
      scenario_id: string; name: string; principal: number; interest_rate: number;
      term_months: number; loan_type: LoanType; start_date: string | null; notes: string | null; sort_order: number;
    }) => createFn({ data }),
    onSuccess: () => { toast.success("Lån tilføjet"); invalidate(); setCreating(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateMut = useMutation({
    mutationFn: (data: {
      id: string; name?: string; principal?: number; interest_rate?: number;
      term_months?: number; loan_type?: LoanType; start_date?: string | null; notes?: string | null; sort_order?: number;
    }) => updateFn({ data }),
    onSuccess: () => { invalidate(); setEditing(null); },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success("Lån slettet"); invalidate(); setConfirmDelete(null); },
  });

  const totalPrincipal = loans.reduce((s, l) => s + l.principal, 0);
  const totalAnnual = loans.reduce((s, l) => s + calcLoan(l).annualPayment, 0);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between p-4 pb-2">
        <h2 className="font-semibold text-[var(--brand-900)]">Lån & finansiering</h2>
        <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nyt lån
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Navn</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Hovedstol</TableHead>
              <TableHead className="text-right">Rente</TableHead>
              <TableHead className="text-right">Løbetid</TableHead>
              <TableHead className="text-right">Årlig ydelse</TableHead>
              <TableHead className="text-right">/ md</TableHead>
              <TableHead className="w-32 text-right">Handling</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loans.map((l) => {
              const c = calcLoan(l);
              return (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{LOAN_TYPE_LABEL[l.loan_type]}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatDKK(l.principal)}</TableCell>
                  <TableCell className="text-right tabular-nums">{(l.interest_rate * 100).toFixed(3)}%</TableCell>
                  <TableCell className="text-right tabular-nums">{l.term_months > 0 ? `${Math.round(l.term_months / 12)} år` : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatDKK(c.annualPayment)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{formatDKK(c.monthlyPayment)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => setAmort(l)} title="Amortisering">📊</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(l)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(l)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {loans.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-6">Ingen lån endnu.</TableCell>
              </TableRow>
            )}
          </TableBody>
          {loans.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="font-semibold">I alt</TableCell>
                <TableCell className="text-right tabular-nums font-semibold">{formatDKK(totalPrincipal)}</TableCell>
                <TableCell colSpan={2} />
                <TableCell className="text-right tabular-nums font-semibold">{formatDKK(totalAnnual)}</TableCell>
                <TableCell className="text-right tabular-nums font-semibold">{formatDKK(totalAnnual / 12)}</TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>

      <LoanDialog
        open={creating}
        onOpenChange={setCreating}
        title="Nyt lån"
        initial={null}
        onSubmit={(v) => createMut.mutate({ scenario_id: scenarioId, sort_order: loans.length, ...v })}
      />
      <LoanDialog
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
        title="Rediger lån"
        initial={editing}
        onSubmit={(v) => editing && updateMut.mutate({ id: editing.id, ...v })}
      />

      <AmortDialog loan={amort} onOpenChange={(v) => !v && setAmort(null)} />

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet lån?</AlertDialogTitle>
            <AlertDialogDescription>{confirmDelete?.name}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDelete && deleteMut.mutate(confirmDelete.id)}>Slet</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function LoanDialog({
  open,
  onOpenChange,
  title,
  initial,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  initial: BudgetLoan | null;
  onSubmit: (v: {
    name: string;
    principal: number;
    interest_rate: number;
    term_months: number;
    loan_type: LoanType;
    start_date: string | null;
    notes: string | null;
  }) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [principal, setPrincipal] = useState(String(initial?.principal ?? 0));
  const [rate, setRate] = useState(String(((initial?.interest_rate ?? 0) * 100).toFixed(3)));
  const [years, setYears] = useState(String(initial?.term_months ? Math.round(initial.term_months / 12) : 30));
  const [type, setType] = useState<LoanType>(initial?.loan_type ?? "annuity");
  const [startDate, setStartDate] = useState(initial?.start_date ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  useMemo(() => {
    setName(initial?.name ?? "");
    setPrincipal(String(initial?.principal ?? 0));
    setRate(String(((initial?.interest_rate ?? 0) * 100).toFixed(3)));
    setYears(String(initial?.term_months ? Math.round(initial.term_months / 12) : 30));
    setType(initial?.loan_type ?? "annuity");
    setStartDate(initial?.start_date ?? "");
    setNotes(initial?.notes ?? "");
  }, [initial]);

  const preview = calcLoan({
    id: "", scenario_id: "", name, principal: Number(principal) || 0, interest_rate: (Number(rate) || 0) / 100,
    term_months: (Number(years) || 0) * 12, loan_type: type, start_date: null, notes: null, sort_order: 0,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Navn</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Fx Realkreditlån (LandkrediT)" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Hovedstol (kr.)</Label><Input type="number" value={principal} onChange={(e) => setPrincipal(e.target.value)} /></div>
            <div><Label>Rente (% p.a.)</Label><Input type="number" step="0.001" value={rate} onChange={(e) => setRate(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Løbetid (år)</Label><Input type="number" value={years} onChange={(e) => setYears(e.target.value)} /></div>
            <div>
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as LoanType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="annuity">Annuitet</SelectItem>
                  <SelectItem value="interest_only">Rente-only</SelectItem>
                  <SelectItem value="standing">Stående / rente- og afdragsfrit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Startdato</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
          <div><Label>Noter</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>

          <div className="rounded-lg bg-muted p-3 text-sm">
            <div className="flex justify-between"><span>Årlig ydelse</span><span className="tabular-nums font-semibold">{formatDKK(preview.annualPayment)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>Månedlig ydelse</span><span className="tabular-nums">{formatDKK(preview.monthlyPayment)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>Renter i alt</span><span className="tabular-nums">{formatDKK(preview.totalInterest)}</span></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuller</Button>
          <Button
            disabled={!name.trim()}
            onClick={() => onSubmit({
              name: name.trim(),
              principal: Number(principal) || 0,
              interest_rate: (Number(rate) || 0) / 100,
              term_months: (Number(years) || 0) * 12,
              loan_type: type,
              start_date: startDate || null,
              notes: notes.trim() || null,
            })}
          >
            Gem
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AmortDialog({ loan, onOpenChange }: { loan: BudgetLoan | null; onOpenChange: (v: boolean) => void }) {
  const rows = loan ? buildAmortization(loan) : [];
  return (
    <Dialog open={!!loan} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Amortisering — {loan?.name}</DialogTitle></DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>År</TableHead>
                <TableHead className="text-right">Ydelse</TableHead>
                <TableHead className="text-right">Rente</TableHead>
                <TableHead className="text-right">Afdrag</TableHead>
                <TableHead className="text-right">Restgæld</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.year}>
                  <TableCell>{r.year}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatDKK(r.payment)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatDKK(r.interest)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatDKK(r.principal)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatDKK(r.balance)}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">Ingen ydelser at vise.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
