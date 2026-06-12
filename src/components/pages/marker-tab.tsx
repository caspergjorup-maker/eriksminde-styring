import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

import {
  MatrikelMap,
  type FieldSummary,
  type MatrikelMapHandle,
  USE_TYPE_COLORS,
  USE_TYPE_LABELS,
} from "@/components/matrikel-map";
import { SOIL_TYPES, updateField } from "@/lib/fields.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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

const NONE = "__none__";

const USE_TYPE_OPTIONS = [
  { value: "omdrift", label: "Omdrift" },
  { value: "skov", label: "Skov" },
  { value: "gaard", label: "Gårdsareal" },
] as const;

type FormState = {
  name: string;
  use_type: "omdrift" | "skov" | "gaard" | null;
  lease_area_ha: string;
  lease_price_per_ha: string;
  eligible_area_ha: string;
  non_eligible_area_ha: string;
  soil_type: string | null;
  is_drained: boolean;
  has_irrigation: boolean;
  notes: string;
};

function fromField(f: FieldSummary): FormState {
  return {
    name: f.name,
    use_type: f.use_type,
    lease_area_ha: f.lease_area_ha != null ? String(f.lease_area_ha) : "",
    lease_price_per_ha: f.lease_price_per_ha != null ? String(f.lease_price_per_ha) : "",
    eligible_area_ha: f.eligible_area_ha != null ? String(f.eligible_area_ha) : "",
    non_eligible_area_ha: f.non_eligible_area_ha != null ? String(f.non_eligible_area_ha) : "",
    soil_type: f.soil_type ?? null,
    is_drained: !!f.is_drained,
    has_irrigation: !!f.has_irrigation,
    notes: f.notes ?? "",
  };
}

function fmtKr(n: number | null | undefined) {
  return n != null ? `${n.toLocaleString("da-DK")} kr` : "—";
}

export function MarkerPage() {
  const mapRef = useRef<MatrikelMapHandle>(null);
  const [fields, setFields] = useState<FieldSummary[]>([]);
  const [editing, setEditing] = useState<FieldSummary | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const qc = useQueryClient();

  const handleRowClick = (id: string) => {
    mapRef.current?.highlightField(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-lg font-medium mb-1">Marker</h1>
      <p className="text-sm text-muted-foreground mb-5">
        Skift mellem mark- og matrikelvisning. Klik på en mark for at se areal, forpagter og
        kontraktoplysninger.
      </p>

      <MatrikelMap key={reloadKey} ref={mapRef} onFieldsReady={setFields} />

      <div className="mt-6 rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Mark</th>
              <th className="text-left px-3 py-2 font-medium">Matrikel</th>
              <th className="text-left px-3 py-2 font-medium">Type</th>
              <th className="text-right px-3 py-2 font-medium">Matrikelareal</th>
              <th className="text-right px-3 py-2 font-medium">Forpagtningsareal</th>
              <th className="text-right px-3 py-2 font-medium">Støtteberettiget</th>
              <th className="text-right px-3 py-2 font-medium">Pris/ha</th>
              <th className="text-right px-3 py-2 font-medium">Årlig afgift</th>
              <th className="text-left px-3 py-2 font-medium">Jordtype</th>
              <th className="text-left px-3 py-2 font-medium">Drænet</th>
              <th className="px-3 py-2 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {fields.length === 0 && (
              <tr>
                <td colSpan={11} className="px-3 py-6 text-center text-muted-foreground text-xs">
                  Indlæser marker…
                </td>
              </tr>
            )}
            {fields.map((f) => {
              const annual =
                f.lease_area_ha != null && f.lease_price_per_ha != null
                  ? f.lease_area_ha * f.lease_price_per_ha
                  : null;
              return (
                <tr
                  key={f.id}
                  onClick={() => handleRowClick(f.id)}
                  className="border-t border-border cursor-pointer hover:bg-muted/40 transition-colors"
                >
                  <td className="px-3 py-2 font-medium">{f.name}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{f.matrikler.join(", ")}</td>
                  <td className="px-3 py-2">
                    {f.use_type ? (
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] text-white"
                        style={{ background: USE_TYPE_COLORS[f.use_type] }}
                      >
                        {USE_TYPE_LABELS[f.use_type]}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{f.totalHa} ha</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {f.lease_area_ha != null ? `${f.lease_area_ha} ha` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {f.eligible_area_ha != null ? `${f.eligible_area_ha} ha` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtKr(f.lease_price_per_ha)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtKr(annual)}</td>
                  <td className="px-3 py-2 text-xs">{f.soil_type ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">{f.is_drained ? "Ja" : "Nej"}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditing(f);
                      }}
                      className="p-1.5 rounded hover:bg-muted"
                      aria-label="Rediger"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <FieldDialog
        editing={editing}
        onOpenChange={(o) => { if (!o) setEditing(null); }}
        onSaved={() => {
          qc.invalidateQueries();
          setReloadKey((k) => k + 1);
          setEditing(null);
        }}
      />
    </div>
  );
}

function FieldDialog({
  editing, onOpenChange, onSaved,
}: {
  editing: FieldSummary | null;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const update = useServerFn(updateField);
  const [values, setValues] = useState<FormState>(() =>
    editing ? fromField(editing) : {
      name: "", use_type: null, lease_area_ha: "", lease_price_per_ha: "",
      eligible_area_ha: "", non_eligible_area_ha: "", soil_type: null,
      is_drained: false, has_irrigation: false, notes: "",
    },
  );
  const [lastId, setLastId] = useState<string | null>(null);
  if (editing && editing.id !== lastId) {
    setLastId(editing.id);
    setValues(fromField(editing));
  }

  const mut = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error("No field");
      const numOrNull = (s: string) => (s.trim() === "" ? null : Number(s));
      return update({
        data: {
          id: editing.id,
          name: values.name.trim(),
          use_type: values.use_type,
          lease_area_ha: numOrNull(values.lease_area_ha),
          lease_price_per_ha: numOrNull(values.lease_price_per_ha),
          eligible_area_ha: numOrNull(values.eligible_area_ha),
          non_eligible_area_ha: numOrNull(values.non_eligible_area_ha),
          soil_type: values.soil_type,
          is_drained: values.is_drained,
          has_irrigation: values.has_irrigation,
          notes: values.notes.trim() || null,
        },
      });
    },
    onSuccess: () => { toast.success("Mark opdateret"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const leaseArea = Number(values.lease_area_ha);
  const leasePrice = Number(values.lease_price_per_ha);
  const annual = leaseArea > 0 && leasePrice > 0 ? leaseArea * leasePrice : null;

  return (
    <Dialog open={editing != null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Rediger mark</DialogTitle>
        </DialogHeader>
        {editing && (
          <form
            onSubmit={(e) => { e.preventDefault(); mut.mutate(); }}
            className="space-y-6"
          >
            {/* Generelt */}
            <section className="space-y-3">
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Generelt</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Marknavn</Label>
                  <Input id="name" required maxLength={200} value={values.name}
                    onChange={(e) => setValues({ ...values, name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select
                    value={values.use_type ?? NONE}
                    onValueChange={(v) => setValues({
                      ...values,
                      use_type: v === NONE ? null : (v as FormState["use_type"]),
                    })}
                  >
                    <SelectTrigger><SelectValue placeholder="Vælg…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>— Ingen —</SelectItem>
                      {USE_TYPE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Tilknyttede matrikler</Label>
                <div className="flex flex-wrap gap-1.5">
                  {editing.matrikler.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                  {editing.matrikler.map((m) => (
                    <span key={m} className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-muted">
                      Matr. {m}
                    </span>
                  ))}
                </div>
              </div>
            </section>

            {/* Arealer */}
            <section className="space-y-3">
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Arealer</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Matrikelareal (ha)</Label>
                  <Input readOnly value={editing.totalHa} className="bg-muted/40" />
                  <p className="text-[11px] text-muted-foreground">Hentes automatisk fra Datafordeler — kan ikke redigeres</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lease_area">Forpagtningsareal (ha)</Label>
                  <Input id="lease_area" type="number" step="0.01" min="0" value={values.lease_area_ha}
                    onChange={(e) => setValues({ ...values, lease_area_ha: e.target.value })} />
                  <p className="text-[11px] text-muted-foreground">Det areal der betales forpagtning for — aftalt i kontrakten</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="eligible">Støtteberettiget areal (ha)</Label>
                  <Input id="eligible" type="number" step="0.01" min="0" value={values.eligible_area_ha}
                    onChange={(e) => setValues({ ...values, eligible_area_ha: e.target.value })} />
                  <p className="text-[11px] text-muted-foreground">Fra IMK / Landbrugsstyrelsen</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="non_eligible">Ikke-støtteberettiget areal (ha)</Label>
                  <Input id="non_eligible" type="number" step="0.01" min="0" value={values.non_eligible_area_ha}
                    onChange={(e) => setValues({ ...values, non_eligible_area_ha: e.target.value })} />
                  <p className="text-[11px] text-muted-foreground">Hegn, grøfter, markveje mv.</p>
                </div>
              </div>
            </section>

            {/* Forpagtning & økonomi */}
            <section className="space-y-3">
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Forpagtning & økonomi</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="price">Forpagtningspris pr. ha (kr)</Label>
                  <Input id="price" type="number" step="1" min="0" value={values.lease_price_per_ha}
                    onChange={(e) => setValues({ ...values, lease_price_per_ha: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Beregnet årlig afgift</Label>
                  <Input readOnly value={annual != null ? `${annual.toLocaleString("da-DK")} kr` : "—"} className="bg-muted/40" />
                  <p className="text-[11px] text-muted-foreground">Beregnes automatisk: forpagtningsareal × pris pr. ha</p>
                </div>
              </div>
            </section>

            {/* Jordbund */}
            <section className="space-y-3">
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Jordbund</h3>
              <div className="space-y-1.5">
                <Label>Jordtype (JB-nummer)</Label>
                <Select
                  value={values.soil_type ?? NONE}
                  onValueChange={(v) => setValues({ ...values, soil_type: v === NONE ? null : v })}
                >
                  <SelectTrigger><SelectValue placeholder="Vælg…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>— Ingen —</SelectItem>
                    {SOIL_TYPES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                  <span className="text-sm">Drænlagt</span>
                  <Switch checked={values.is_drained} onCheckedChange={(v) => setValues({ ...values, is_drained: v })} />
                </div>
                <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                  <span className="text-sm">Vandingsret</span>
                  <Switch checked={values.has_irrigation} onCheckedChange={(v) => setValues({ ...values, has_irrigation: v })} />
                </div>
              </div>
            </section>

            {/* Noter */}
            <section className="space-y-3">
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Noter</h3>
              <div className="space-y-1.5">
                <Label htmlFor="notes">Interne noter</Label>
                <Textarea id="notes" rows={3} maxLength={2000} value={values.notes}
                  onChange={(e) => setValues({ ...values, notes: e.target.value })} />
              </div>
            </section>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annullér</Button>
              <Button type="submit" disabled={mut.isPending}>{mut.isPending ? "Gemmer…" : "Gem"}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
