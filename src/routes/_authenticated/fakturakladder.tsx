import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { createInvoiceDraft, deleteInvoiceDraft, exportInvoiceToDinero, listInvoiceDrafts } from "@/lib/dinero.functions";
import { listContacts } from "@/lib/contacts.functions";
import { formatDKK } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/fakturakladder")({
  head: () => ({
    meta: [
      { title: "Fakturakladder — Eriksminde" },
      { name: "description", content: "Opret fakturakladder og send dem til Dinero." },
      { property: "og:title", content: "Fakturakladder — Eriksminde" },
      { property: "og:description", content: "Opret fakturakladder og send dem til Dinero." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FakturaerPage,
});

const STATUS: Record<string, string> = { draft: "Kladde", exported_to_dinero: "Sendt til Dinero", paid: "Betalt" };

function FakturaerPage() {
  const qc = useQueryClient();
  const list = useServerFn(listInvoiceDrafts);
  const exportFn = useServerFn(exportInvoiceToDinero);
  const del = useServerFn(deleteInvoiceDraft);
  const q = useQuery({ queryKey: ["invoices"], queryFn: () => list() });
  const [creating, setCreating] = useState(false);

  const exportMut = useMutation({
    mutationFn: (id: string) => exportFn({ data: { id } }),
    onSuccess: () => { toast.success("Sendt til Dinero som kladde"); qc.invalidateQueries({ queryKey: ["invoices"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoices"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = q.data ?? [];
  return (
    <div className="px-6 py-6 w-full mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--brand-900)]">Fakturakladder</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Opret fakturaer her og send dem til Dinero, hvor de bogføres og afsendes.</p>
        </div>
        <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-1" /> Ny faktura</Button>
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5">Dato</th><th className="px-4 py-2.5">Kunde</th><th className="px-4 py-2.5">Tekst</th>
              <th className="px-4 py-2.5 text-right">Beløb</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5 w-48"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {q.isLoading && <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Indlæser…</td></tr>}
            {q.error && <tr><td colSpan={6} className="px-4 py-6 text-center text-destructive">{(q.error as Error).message}</td></tr>}
            {!q.isLoading && rows.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Ingen fakturakladder endnu.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2.5 tabular-nums">{r.invoice_date ?? "—"}</td>
                <td className="px-4 py-2.5">{r.contact_name ?? "—"}</td>
                <td className="px-4 py-2.5">{r.description ?? "—"}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatDKK(r.amount_excl_vat)}</td>
                <td className="px-4 py-2.5">{STATUS[r.status ?? "draft"] ?? r.status}</td>
                <td className="px-4 py-2.5 text-right space-x-1">
                  {!r.dinero_invoice_id && (
                    <>
                      <Button size="sm" variant="outline" disabled={exportMut.isPending} onClick={() => exportMut.mutate(r.id)}>
                        <Send className="h-3.5 w-3.5 mr-1" /> Send til Dinero
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Slet" onClick={() => delMut.mutate(r.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {creating && <NewInvoiceDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

function NewInvoiceDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const listC = useServerFn(listContacts);
  const create = useServerFn(createInvoiceDraft);
  const contacts = useQuery({ queryKey: ["contacts", "customers"], queryFn: () => listC({ data: { kind: "customers" } }) });
  const [contactId, setContactId] = useState("");
  const [desc, setDesc] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const mut = useMutation({
    mutationFn: () => create({ data: { contact_id: contactId, description: desc, invoice_date: date, amount_excl_vat: Number(amount.replace(/\./g, "").replace(",", ".")) } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["invoices"] }); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Ny faktura</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Kunde</Label>
            <Select value={contactId} onValueChange={setContactId}>
              <SelectTrigger><SelectValue placeholder="Vælg kunde" /></SelectTrigger>
              <SelectContent>{(contacts.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Tekst</Label><Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Fx Forpagtning 2027" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Dato</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div><Label>Beløb (kr., momsfrit)</Label><Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annullér</Button>
          <Button disabled={!contactId || !desc || !amount || mut.isPending} onClick={() => mut.mutate()}>Gem kladde</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
