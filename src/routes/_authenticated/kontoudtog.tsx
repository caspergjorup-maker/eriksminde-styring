import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { categorizeBankTransaction, importBankCsv, listBankTransactions, type BankTx } from "@/lib/bank.functions";
import type { BankKind } from "@/lib/bank-csv";
import { formatDKK } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/kontoudtog")({
  head: () => ({
    meta: [
      { title: "Kontoudtog — Eriksminde" },
      { name: "description", content: "Indlæs kontoudtog fra banken og kategoriser posteringerne." },
      { property: "og:title", content: "Kontoudtog — Eriksminde" },
      { property: "og:description", content: "Indlæs kontoudtog fra banken og kategoriser posteringerne." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

export const BANK_CATEGORIES: Record<string, string> = {
  forpagtning: "Forpagtning", bygningsudlejning: "Bygningsudlejning", halm: "Halm", jagtleje: "Jagtleje",
  skov: "Skov", stuehus: "Stuehus", "eu-tilskud": "EU-tilskud", forsikring: "Forsikring",
  ejendomsskat: "Ejendomsskat", energi: "Energi", administration: "Administration",
  maskinstation: "Maskinstation", vedligehold: "Vedligehold", finansiering: "Finansiering",
  etablering: "Etablering / køb", indskud: "Privat indskud / hævning", andet: "Andet",
};
const KIND_LABEL: Record<BankKind, string> = { income: "Indtægt", expense: "Udgift", capital: "Kapital (ikke drift)" };

function Page() {
  const qc = useQueryClient();
  const list = useServerFn(listBankTransactions);
  const imp = useServerFn(importBankCsv);
  const q = useQuery({ queryKey: ["bank-tx"], queryFn: () => list() });
  const importMut = useMutation({
    mutationFn: async (file: File) => {
      const buf = await file.arrayBuffer();
      let csv = new TextDecoder("utf-8", { fatal: false }).decode(buf);
      if (csv.includes("\uFFFD")) csv = new TextDecoder("windows-1252").decode(buf);
      return imp({ data: { csv } });
    },
    onSuccess: (r) => {
      toast.success(`${r.added} nye posteringer (${r.total - r.added} fandtes allerede). ${r.unknown} mangler kategori.`);
      qc.invalidateQueries({ queryKey: ["bank-tx"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = q.data ?? [];
  const unknown = rows.filter((r) => !r.kind);
  const known = rows.filter((r) => r.kind);
  const saldo = rows.find((r) => r.balance != null);

  return (
    <div className="px-6 py-6 w-full mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--brand-900)]">Kontoudtog</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Indlæs CSV fra netbanken. Kendte posteringer kategoriseres automatisk; nye spørger appen om.
          </p>
        </div>
        <div className="flex items-center gap-4">
          {saldo && (
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Saldo {saldo.booked_date.split("-").reverse().join(".")}</div>
              <div className="text-lg font-semibold tabular-nums">{formatDKK(saldo.balance ?? 0)}</div>
            </div>
          )}
          <label>
            <input type="file" accept=".csv,text/csv" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) importMut.mutate(f); e.target.value = ""; }} />
            <Button asChild disabled={importMut.isPending}>
              <span>{importMut.isPending ? "Indlæser…" : "Indlæs kontoudtog (CSV)"}</span>
            </Button>
          </label>
        </div>
      </div>

      {unknown.length > 0 && (
        <div className="bg-card border border-amber-300 rounded-xl p-4 space-y-2">
          <h2 className="font-semibold">Hvor hører disse til? ({unknown.length})</h2>
          <p className="text-xs text-muted-foreground">Appen husker dit valg til næste gang samme tekst dukker op.</p>
          {unknown.map((r) => <CategorizeRow key={r.id} tx={r} />)}
        </div>
      )}

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Dato</th><th className="px-3 py-2 text-left">Tekst</th>
              <th className="px-3 py-2 text-left">Type</th><th className="px-3 py-2 text-left">Kategori</th>
              <th className="px-3 py-2 text-right">Beløb</th><th className="px-3 py-2 text-right">Saldo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {known.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2">{r.booked_date.split("-").reverse().join(".")}</td>
                <td className="px-3 py-2">{r.text}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.kind ? KIND_LABEL[r.kind] : ""}</td>
                <td className="px-3 py-2 text-muted-foreground">{BANK_CATEGORIES[r.category ?? ""] ?? r.category}</td>
                <td className={`px-3 py-2 text-right ${r.amount < 0 ? "text-destructive" : ""}`}>{formatDKK(r.amount)}</td>
                <td className="px-3 py-2 text-right">{r.balance != null ? formatDKK(r.balance) : ""}</td>
              </tr>
            ))}
            {rows.length === 0 && !q.isLoading && (
              <tr><td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">Ingen posteringer endnu.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CategorizeRow({ tx }: { tx: BankTx }) {
  const qc = useQueryClient();
  const cat = useServerFn(categorizeBankTransaction);
  const [kind, setKind] = useState<BankKind>(tx.amount >= 0 ? "income" : "expense");
  const [category, setCategory] = useState<string>("");
  const m = useMutation({
    mutationFn: () => cat({ data: { id: tx.id, kind, category, remember: true } }),
    onSuccess: (r) => {
      if (r.alsoUpdated) toast.success(`Også anvendt på ${r.alsoUpdated} andre posteringer`);
      qc.invalidateQueries({ queryKey: ["bank-tx"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="flex items-center gap-3 flex-wrap border-t border-border pt-2">
      <span className="w-24 text-sm">{tx.booked_date.split("-").reverse().join(".")}</span>
      <span className="flex-1 min-w-48 text-sm">{tx.text}</span>
      <span className={`w-32 text-right text-sm tabular-nums ${tx.amount < 0 ? "text-destructive" : ""}`}>{formatDKK(tx.amount)}</span>
      <Select value={kind} onValueChange={(v) => setKind(v as BankKind)}>
        <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
        <SelectContent>
          {(Object.keys(KIND_LABEL) as BankKind[]).map((k) => <SelectItem key={k} value={k}>{KIND_LABEL[k]}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={category} onValueChange={setCategory}>
        <SelectTrigger className="w-52"><SelectValue placeholder="Vælg kategori" /></SelectTrigger>
        <SelectContent>
          {Object.entries(BANK_CATEGORIES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
        </SelectContent>
      </Select>
      <Button size="sm" disabled={!category || m.isPending} onClick={() => m.mutate()}>Gem</Button>
    </div>
  );
}
