import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, Plus, Trash2, CalendarDays, Copy, MoreHorizontal } from "lucide-react";
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
import { loanMonthly } from "@/components/budget-liquidity";

function loanYearTotal(l: BudgetLoan, year: number) {
  let t = 0;
  for (let m = 0; m < 12; m++) t += loanMonthly(l, year, m);
  return t;
}
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ---------- Spreadsheet helpers ----------

function parseAmount(s: string): number | null {
  const cleaned = s.replace(/\s|kr\.?/gi, "").replace(/\./g, "").replace(",", ".");
  if (cleaned === "" || cleaned === "-") return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/** Fordeler et beløb på de givne måneder i hele kroner; rest lægges i sidste måned. */
function distribute(total: number, monthIdx: number[]): number[] {
  const out = Array(12).fill(0) as number[];
  if (monthIdx.length === 0) return out;
  const each = Math.round(total / monthIdx.length);
  monthIdx.forEach((m) => (out[m] = each));
  out[monthIdx[monthIdx.length - 1]] += Math.round(total) - each * monthIdx.length;
  return out;
}

function scaleRounded(values: number[], factor: number, target: number): number[] {
  const out = values.map((v) => Math.round(v * factor));
  const diff = Math.round(target) - out.reduce((s, x) => s + x, 0);
  let last = -1;
  out.forEach((v, i) => { if (v !== 0) last = i; });
  out[last >= 0 ? last : 11] += diff;
  return out;
}

function EditableNumber({ value, onCommit }: { value: number; onCommit: (n: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const commit = () => {
    setEditing(false);
    const n = parseAmount(text);
    if (n !== null && n !== Math.round(value)) onCommit(n);
  };
  if (editing) {
    return (
      <input
        autoFocus
        inputMode="decimal"
        className="w-full min-w-16 text-right tabular-nums bg-background border border-[var(--brand-500)] rounded px-1.5 py-0.5 outline-none"
        value={text}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") setEditing(false);
        }}
      />
    );
  }
  return (
    <button
      type="button"
      title="Klik for at rette"
      className="w-full text-right tabular-nums rounded px-1.5 py-0.5 cursor-text hover:bg-muted hover:ring-1 hover:ring-border focus:outline-none focus:ring-1 focus:ring-[var(--brand-500)]"
      onClick={() => { setText(String(Math.round(value))); setEditing(true); }}
      onFocus={() => { setText(String(Math.round(value))); setEditing(true); }}
    >
      {formatDKK(value)}
    </button>
  );
}

function EditableText({ value, onCommit, placeholder }: { value: string; onCommit: (v: string) => void; placeholder?: string }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);
  const commit = () => {
    setEditing(false);
    if (text.trim() !== value) onCommit(text.trim());
  };
  if (editing) {
    return (
      <input
        autoFocus
        className="w-full bg-background border border-[var(--brand-500)] rounded px-1.5 py-0.5 outline-none"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") setEditing(false);
        }}
      />
    );
  }
  return (
    <button
      type="button"
      title="Klik for at rette"
      className="w-full text-left rounded px-1.5 py-0.5 cursor-text hover:bg-muted hover:ring-1 hover:ring-border"
      onClick={() => { setText(value); setEditing(true); }}
    >
      {value || <span className="text-muted-foreground">{placeholder ?? "—"}</span>}
    </button>
  );
}

function DistributionMenu({ total, onApply }: { total: number; onApply: (months: number[] | null) => void }) {
  const all = MONTHS.map((_, i) => i);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="ghost" title="Fordel på måneder">
          <CalendarDays className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Fordel {formatDKK(total)}
        </DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => onApply(null)}>Ligeligt (1/12)</DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Fra måned og resten af året</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {MONTHS.map((m, i) => (
              <DropdownMenuItem key={m} onSelect={() => onApply(distribute(total, all.slice(i)))}>
                Fra {m}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem onSelect={() => onApply(distribute(total, [0, 3, 6, 9]))}>Kvartalsvis (jan/apr/jul/okt)</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onApply(distribute(total, [2, 5, 8, 11]))}>Kvartalsvis bagud (mar/jun/sep/dec)</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onApply(distribute(total, [3, 9]))}>Halvårligt (apr/okt)</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onApply(distribute(total, [5, 11]))}>Halvårligt (jun/dec)</DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Engangsbeløb i måned</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {MONTHS.map((m, i) => (
              <DropdownMenuItem key={m} onSelect={() => onApply(distribute(total, [i]))}>{m}</DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-red-600" onSelect={() => onApply(Array(12).fill(0))}>
          Nulstil alle måneder
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function QuickAddRow({ colSpan, pending, onAdd }: { colSpan: number; pending: boolean; onAdd: (label: string, amount: number) => void }) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const submit = () => {
    if (!label.trim()) return;
    onAdd(label.trim(), parseAmount(amount) ?? 0);
    setLabel("");
    setAmount("");
  };
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="py-2">
        <div className="flex items-center gap-2">
          <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            className="h-8 max-w-xs"
            placeholder="Tilføj linje — skriv navn…"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          <Input
            className="h-8 w-36 text-right"
            placeholder="Beløb pr. år"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          <Button size="sm" variant="outline" disabled={!label.trim() || pending} onClick={submit}>Tilføj</Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

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


const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"];

function BudgetPage() {
  const qc = useQueryClient();
  const fetchYears = useServerFn(listBudgetYears);
  const fetchBudget = useServerFn(getBudgetByYear);
  const createScenarioFn = useServerFn(createScenario);
  const copyBudgetFn = useServerFn(copyBudgetToYear);
  const updateScenarioFn = useServerFn(updateScenario);
  const deleteYearFn = useServerFn(deleteBudgetYear);

  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [monthlyView, setMonthlyView] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);

  const yearsQ = useQuery({
    queryKey: ["budget-years"],
    queryFn: () => fetchYears(),
  });

  const years = yearsQ.data ?? [];
  const thisYear = new Date().getFullYear();
  const currentYear =
    selectedYear ?? (years.includes(thisYear) ? thisYear : (years[0] ?? null));

  const bundleQ = useQuery({
    queryKey: ["budget-year", currentYear],
    queryFn: () => fetchBudget({ data: { year: currentYear! } }),
    enabled: currentYear !== null,
  });

  const createScenarioMut = useMutation({
    mutationFn: (data: { name: string; year: number; notes: string | null }) => createScenarioFn({ data }),
    onSuccess: (_res, vars) => {
      toast.success("Budget oprettet");
      qc.invalidateQueries({ queryKey: ["budget-years"] });
      setSelectedYear(vars.year);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copyMut = useMutation({
    mutationFn: (data: { fromYear: number; toYear: number; adjustPct: number; rollForwardLoans: boolean }) =>
      copyBudgetFn({ data }),
    onSuccess: (res) => {
      toast.success(`Budget ${res.year} oprettet ud fra det forrige år`);
      qc.invalidateQueries({ queryKey: ["budget-years"] });
      setSelectedYear(res.year);
      setCopyOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteYearMut = useMutation({
    mutationFn: (year: number) => deleteYearFn({ data: { year } }),
    onSuccess: () => {
      toast.success("Budget slettet");
      setSelectedYear(null);
      qc.invalidateQueries({ queryKey: ["budget-years"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateScenarioMut = useMutation({
    mutationFn: (data: { id: string; name: string; year: number; notes: string | null }) =>
      updateScenarioFn({ data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budget-years"] });
      qc.invalidateQueries({ queryKey: ["budget-year"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bundle = bundleQ.data ?? null;
  const scenario = bundle?.scenario ?? null;
  const lines = bundle?.lines ?? [];
  const loans = bundle?.loans ?? [];

  const incomes = lines.filter((l) => l.kind === "income");
  const expenses = lines.filter((l) => l.kind === "expense");

  const totalIncome = incomes.reduce((s, l) => s + l.annual_amount, 0);
  const totalExpense = expenses.reduce((s, l) => s + l.annual_amount, 0);
  const totalLoanPayments = loans.reduce((s, l) => s + loanYearTotal(l, currentYear ?? thisYear), 0);
  const result = totalIncome - totalExpense - totalLoanPayments;

  const nextYear = currentYear !== null ? currentYear + 1 : thisYear + 1;
  const canCopy = currentYear !== null && !years.includes(nextYear);

  return (
    <div className="px-6 py-6 w-full mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--brand-900)]">Budget</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Drift og finansiering — ét budget pr. år</p>
        </div>
        <div className="flex items-center gap-2">
          {years.length > 0 && (
            <Select
              value={currentYear !== null ? String(currentYear) : ""}
              onValueChange={(v) => setSelectedYear(Number(v))}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Vælg år" />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {canCopy && (
            <Button size="sm" onClick={() => setCopyOpen(true)}>
              <Copy className="h-4 w-4 mr-1" /> Opret budget for {nextYear}
            </Button>
          )}
        </div>
      </div>

      {years.length === 0 && !yearsQ.isLoading && (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <p className="text-muted-foreground mb-4">Der er ingen budgetter endnu.</p>
          <Button
            onClick={() =>
              createScenarioMut.mutate({ name: `Budget ${thisYear}`, year: thisYear, notes: null })
            }
          >
            <Plus className="h-4 w-4 mr-1" /> Opret budget for {thisYear}
          </Button>
        </div>
      )}

      {scenario && (
        <>
          <ScenarioHeader
            scenario={scenario}
            onUpdate={(patch) => updateScenarioMut.mutate({ id: scenario.id, ...patch })}
            onDelete={() => deleteYearMut.mutate(scenario.year)}
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

          <LoansSection scenarioId={scenario.id} loans={loans} year={scenario.year} />

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

      {currentYear !== null && (
        <CopyBudgetDialog
          open={copyOpen}
          onOpenChange={setCopyOpen}
          fromYear={currentYear}
          toYear={nextYear}
          pending={copyMut.isPending}
          onConfirm={(opts) => copyMut.mutate({ fromYear: currentYear, toYear: nextYear, ...opts })}
        />
      )}
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
  const [notes, setNotes] = useState(scenario.notes ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="text-lg font-semibold text-[var(--brand-900)]">
          {scenario.name} <span className="text-muted-foreground font-normal">· {scenario.year}</span>
        </div>
        {scenario.notes && <div className="text-sm text-muted-foreground mt-1 whitespace-pre-line">{scenario.notes}</div>}
      </div>
      <div className="flex gap-2 shrink-0">
        <Button variant="outline" size="sm" onClick={() => { setName(scenario.name); setNotes(scenario.notes ?? ""); setEditing(true); }}>
          <Pencil className="h-4 w-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="text-red-600" onSelect={() => setConfirmDelete(true)}>
              <Trash2 className="h-4 w-4 mr-2" /> Slet budget {scenario.year}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rediger budget</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Navn</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><Label>Noter</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(false)}>Annuller</Button>
            <Button onClick={() => { onUpdate({ name: name.trim(), year: scenario.year, notes: notes.trim() || null }); setEditing(false); }}>Gem</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet budget {scenario.year}?</AlertDialogTitle>
            <AlertDialogDescription>Alle poster og lån i budgettet slettes også. Dette kan ikke fortrydes.</AlertDialogDescription>
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

function CopyBudgetDialog({
  open,
  onOpenChange,
  fromYear,
  toYear,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fromYear: number;
  toYear: number;
  pending: boolean;
  onConfirm: (opts: { adjustPct: number; rollForwardLoans: boolean }) => void;
}) {
  const [rollForward, setRollForward] = useState(true);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Opret budget for {toYear}</DialogTitle></DialogHeader>
        <div className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            Alle poster og lån fra budget {fromYear} kopieres til {toYear}. Kopierede poster får noten
            “Kopieret fra {fromYear}”, så du kan se hvad du endnu ikke har gennemgået.
          </p>
          <div className="flex items-start gap-3">
            <Switch id="roll-forward" checked={rollForward} onCheckedChange={setRollForward} />
            <div>
              <Label htmlFor="roll-forward">Videreført restgæld på lån</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Lånebeløbet sættes til restgælden ved udgangen af {fromYear}, og løbetiden reduceres med 12 måneder.
                Slå fra for at kopiere lånene uændret.
              </p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuller</Button>
          <Button disabled={pending} onClick={() => onConfirm({ adjustPct: 0, rollForwardLoans: rollForward })}>
            Opret {toYear}
          </Button>
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

  const invalidate = () => qc.invalidateQueries({ queryKey: ["budget-year"] });

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
                <>
                  {MONTHS.map((m) => <TableHead key={m} className="text-right">{m}</TableHead>)}
                  <TableHead className="text-right font-semibold">I alt</TableHead>
                </>
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
            {lines.map((l) => {
              const months = MONTHS.map((_, m) => monthlyOf(l, m));
              const setMonth = (m: number, val: number) => {
                const next = months.map((x) => Math.round(x));
                next[m] = val;
                updateMut.mutate({ id: l.id, monthly_override: next, annual_amount: next.reduce((s, x) => s + x, 0) });
              };
              const setAnnual = (val: number) => {
                if (!l.monthly_override) {
                  updateMut.mutate({ id: l.id, annual_amount: val });
                  return;
                }
                const sum = months.reduce((s, x) => s + x, 0);
                const active = months.map((x, i) => (x !== 0 ? i : -1)).filter((i) => i >= 0);
                const next = sum !== 0
                  ? scaleRounded(months, val / sum, val)
                  : distribute(val, active.length ? active : MONTHS.map((_, i) => i));
                updateMut.mutate({ id: l.id, annual_amount: val, monthly_override: next });
              };
              const applyDist = (next: number[] | null) => {
                const total = months.reduce((s, x) => s + x, 0);
                updateMut.mutate(
                  next === null
                    ? { id: l.id, monthly_override: null, annual_amount: Math.round(total) }
                    : { id: l.id, monthly_override: next, annual_amount: next.reduce((s, x) => s + x, 0) },
                );
              };
              return (
              <TableRow key={l.id}>
                <TableCell className="font-medium min-w-40">
                  <EditableText value={l.label} onCommit={(v) => v && updateMut.mutate({ id: l.id, label: v })} />
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{CATEGORY_LABEL[l.category] ?? l.category}</TableCell>
                {monthlyView ? (
                  <>
                    {months.map((v, m) => (
                      <TableCell key={m} className="text-right text-sm p-1 min-w-20">
                        <EditableNumber value={v} onCommit={(n) => setMonth(m, n)} />
                      </TableCell>
                    ))}
                    <TableCell className="text-right tabular-nums text-sm font-semibold">
                      {formatDKK(months.reduce((s, x) => s + x, 0))}
                    </TableCell>
                  </>
                ) : (
                  <>
                    <TableCell className="text-right p-1 min-w-28">
                      <EditableNumber value={l.annual_amount} onCommit={setAnnual} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatDKK(l.annual_amount / 12)}
                      {l.monthly_override && <div className="text-[10px]">manuel fordeling</div>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground min-w-40">
                      <EditableText value={l.source_note ?? ""} placeholder="—" onCommit={(v) => updateMut.mutate({ id: l.id, source_note: v || null })} />
                    </TableCell>
                  </>
                )}
                <TableCell className="text-right whitespace-nowrap">
                  <DistributionMenu total={months.reduce((s, x) => s + x, 0)} onApply={applyDist} />
                  <Button size="sm" variant="ghost" onClick={() => setEditing(l)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(l)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </TableCell>
              </TableRow>
              );
            })}
            {lines.length === 0 && (
              <TableRow>
                <TableCell colSpan={monthlyView ? 16 : 6} className="text-center text-muted-foreground py-6">
                  Ingen linjer endnu.
                </TableCell>
              </TableRow>
            )}
            <QuickAddRow
              colSpan={monthlyView ? 16 : 6}
              pending={createMut.isPending}
              onAdd={(label, amount) =>
                createMut.mutate({
                  scenario_id: scenarioId, kind, category: kind === "income" ? "andet" : "andet",
                  label, annual_amount: amount, monthly_override: null, source_note: null, sort_order: lines.length,
                })
              }
            />
          </TableBody>
          {lines.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="font-semibold">I alt</TableCell>
                {monthlyView ? (
                  <>
                    {MONTHS.map((_, m) => (
                      <TableCell key={m} className="text-right tabular-nums font-semibold">
                        {formatDKK(lines.reduce((s, l) => s + monthlyOf(l, m), 0))}
                      </TableCell>
                    ))}
                    <TableCell className="text-right tabular-nums font-bold">
                      {formatDKK(lines.reduce((s, l) => s + MONTHS.reduce((a, _, m) => a + monthlyOf(l, m), 0), 0))}
                    </TableCell>
                  </>
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

      {creating && (
        <LineDialog
          open
          onOpenChange={setCreating}
          title={`Ny ${kind === "income" ? "indtægt" : "udgift"}`}
          initial={null}
          kind={kind}
          onSubmit={(v) => createMut.mutate({ scenario_id: scenarioId, kind, sort_order: lines.length, ...v })}
        />
      )}
      {editing && (
        <LineDialog
          key={editing.id}
          open
          onOpenChange={(v) => !v && setEditing(null)}
          title="Rediger linje"
          initial={editing}
          kind={kind}
          onSubmit={(v) => updateMut.mutate({ id: editing.id, ...v })}
        />
      )}

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

function LoansSection({ scenarioId, loans, year }: { scenarioId: string; loans: BudgetLoan[]; year: number }) {
  const qc = useQueryClient();
  const createFn = useServerFn(createLoan);
  const updateFn = useServerFn(updateLoan);
  const deleteFn = useServerFn(deleteLoan);

  const [editing, setEditing] = useState<BudgetLoan | null>(null);
  const [creating, setCreating] = useState(false);
  const [amort, setAmort] = useState<BudgetLoan | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<BudgetLoan | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["budget-year"] });

  const createMut = useMutation({
    mutationFn: (data: {
      scenario_id: string; name: string; monthly_payment: number; sort_order: number;
    }) => createFn({ data: {
      ...data,
      principal: 0, interest_rate: 0, term_months: 0, loan_type: "standing" as LoanType,
      start_date: null, notes: null,
    } }),
    onSuccess: () => { toast.success("Lån tilføjet"); invalidate(); setCreating(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateMut = useMutation({
    mutationFn: (data: { id: string; name?: string; monthly_payment?: number }) => updateFn({ data }),
    onSuccess: () => { invalidate(); setEditing(null); },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success("Lån slettet"); invalidate(); setConfirmDelete(null); },
  });

  const totalAnnual = loans.reduce((s, l) => s + loanYearTotal(l, year), 0);

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
              <TableHead className="text-right">Månedlig ydelse</TableHead>
              <TableHead className="text-right">Årlig ydelse</TableHead>
              <TableHead className="w-32 text-right">Handling</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loans.map((l) => {
              const c = calcLoan(l);
              return (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatDKK(c.monthlyPayment)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{formatDKK(loanYearTotal(l, year))}</TableCell>
                  <TableCell className="text-right">
                    {l.monthly_payment == null && l.principal > 0 && (
                      <Button size="sm" variant="ghost" onClick={() => setAmort(l)} title="Amortisering">📊</Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setEditing(l)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(l)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {loans.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-6">Ingen lån endnu.</TableCell>
              </TableRow>
            )}
          </TableBody>
          {loans.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell className="font-semibold">I alt</TableCell>
                <TableCell className="text-right tabular-nums font-semibold">{formatDKK(totalAnnual / 12)}</TableCell>
                <TableCell className="text-right tabular-nums font-semibold">{formatDKK(totalAnnual)}</TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>

      {creating && (
        <LoanDialog
          open
          onOpenChange={setCreating}
          title="Nyt lån"
          initial={null}
          onSubmit={(v) => createMut.mutate({ scenario_id: scenarioId, sort_order: loans.length, ...v })}
        />
      )}
      {editing && (
        <LoanDialog
          key={editing.id}
          open
          onOpenChange={(v) => !v && setEditing(null)}
          title="Rediger lån"
          initial={editing}
          onSubmit={(v) => updateMut.mutate({ id: editing.id, ...v })}
        />
      )}

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
  onSubmit: (v: { name: string; monthly_payment: number }) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [monthly, setMonthly] = useState(
    initial ? String(initial.monthly_payment ?? Math.round(calcLoan(initial).monthlyPayment)) : "",
  );

  const monthlyNum = Number(monthly) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Navn</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Fx Realkreditlån (Nykredit)" /></div>
          <div><Label>Månedlig ydelse (kr.)</Label><Input type="number" value={monthly} onChange={(e) => setMonthly(e.target.value)} placeholder="Fx 18.965" /></div>
          <div className="rounded-lg bg-muted p-3 text-sm">
            <div className="flex justify-between"><span>Årlig ydelse</span><span className="tabular-nums font-semibold">{formatDKK(monthlyNum * 12)}</span></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuller</Button>
          <Button
            disabled={!name.trim() || monthlyNum <= 0}
            onClick={() => onSubmit({ name: name.trim(), monthly_payment: monthlyNum })}
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
