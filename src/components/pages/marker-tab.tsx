import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Pencil, MapPin, Trash2, Plus, X, Check } from "lucide-react";
import { toast } from "sonner";

import {
  useMatrikelData,
  USE_TYPE_COLORS,
  USE_TYPE_LABELS,
  type FieldRow,
  type MatrikelRow,
} from "@/lib/use-matrikel";
import { SOIL_TYPES, updateField, deleteField, setFieldParcels } from "@/lib/fields.functions";

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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  TableToolbar,
  SortableHeader,
  useTableFilters,
  type FilterColumn,
} from "@/components/table-filters";

const FIELD_COLUMNS: FilterColumn<FieldRow>[] = [
  { key: "name", label: "Mark", sortable: true, sortValue: (f) => f.name },
  { key: "matrikel", label: "Matrikel", sortable: true, sortValue: (f) => f.matrikler.join(", ") },
  {
    key: "use_type",
    label: "Type",
    type: "enum",
    get: (f) => f.use_type ?? "",
    options: [
      { value: "omdrift", label: "Omdrift" },
      { value: "skov", label: "Skov" },
      { value: "gaard", label: "Gårdsareal" },
      { value: "", label: "(ingen)" },
    ],
    sortable: true,
    sortValue: (f) => f.use_type ?? "",
  },
  { key: "totalHa", label: "Matrikelareal (ha)", type: "number", get: (f) => f.totalHa, sortable: true, sortValue: (f) => f.totalHa },
  { key: "lease_area_ha", label: "Forpagtningsareal (ha)", type: "number", get: (f) => f.lease_area_ha, sortable: true, sortValue: (f) => f.lease_area_ha },
  { key: "eligible_area_ha", label: "Støtteberettiget (ha)", type: "number", get: (f) => f.eligible_area_ha, sortable: true, sortValue: (f) => f.eligible_area_ha },
  { key: "lease_price_per_ha", label: "Pris/ha (kr)", type: "number", get: (f) => f.lease_price_per_ha, sortable: true, sortValue: (f) => f.lease_price_per_ha },
  {
    key: "annual",
    label: "Årlig afgift (kr)",
    type: "number",
    get: (f) => (f.lease_area_ha != null && f.lease_price_per_ha != null ? f.lease_area_ha * f.lease_price_per_ha : null),
    sortable: true,
    sortValue: (f) => (f.lease_area_ha != null && f.lease_price_per_ha != null ? f.lease_area_ha * f.lease_price_per_ha : null),
  },
  {
    key: "soil_type",
    label: "Jordtype",
    type: "enum",
    get: (f) => f.soil_type ?? "",
    sortable: true,
    sortValue: (f) => f.soil_type ?? "",
  },
  {
    key: "is_drained",
    label: "Drænet",
    type: "enum",
    get: (f) => (f.is_drained ? "Ja" : "Nej"),
    options: [
      { value: "Ja", label: "Ja" },
      { value: "Nej", label: "Nej" },
    ],
  },
];

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

function fromField(f: FieldRow): FormState {
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
  const { data, isLoading, error } = useMatrikelData();
  const allFields = data?.fields ?? [];
  const allMatrikler: MatrikelRow[] = data?.matrikler ?? [];
  const filters = useTableFilters({
    rows: allFields,
    columns: FIELD_COLUMNS,
    searchFields: [
      (f) => f.name,
      (f) => f.matrikler.join(" "),
      (f) => f.notes ?? "",
      (f) => f.soil_type ?? "",
    ],
  });
  const fields = filters.rows;
  const [editing, setEditing] = useState<FieldRow | null>(null);
  const [deleting, setDeleting] = useState<FieldRow | null>(null);
  const [tableEdit, setTableEdit] = useState(false);
  const qc = useQueryClient();
  const update = useServerFn(updateField);
  const del = useServerFn(deleteField);
  const navigate = useNavigate();

  const deleteMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Mark slettet");
      qc.invalidateQueries({ queryKey: ["matrikel-data"] });
      setDeleting(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  type UpdatePayload = {
    id: string;
    name: string;
    use_type: "omdrift" | "skov" | "gaard" | null;
    lease_area_ha: number | null;
    lease_price_per_ha: number | null;
    eligible_area_ha: number | null;
    non_eligible_area_ha: number | null;
    soil_type: string | null;
    is_drained: boolean;
    has_irrigation: boolean;
    notes: string | null;
  };
  const saveMut = useMutation({
    mutationFn: (payload: UpdatePayload) => update({ data: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["matrikel-data"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function patchField(f: FieldRow, patch: Partial<FormState>) {
    const base = fromField(f);
    const merged = { ...base, ...patch };
    const numOrNull = (s: string) => (s.trim() === "" ? null : Number(s));
    saveMut.mutate({
      id: f.id,
      name: merged.name.trim() || f.name,
      use_type: merged.use_type,
      lease_area_ha: numOrNull(merged.lease_area_ha),
      lease_price_per_ha: numOrNull(merged.lease_price_per_ha),
      eligible_area_ha: numOrNull(merged.eligible_area_ha),
      non_eligible_area_ha: numOrNull(merged.non_eligible_area_ha),
      soil_type: merged.soil_type,
      is_drained: merged.is_drained,
      has_irrigation: merged.has_irrigation,
      notes: merged.notes.trim() || null,
    });
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-5 gap-4">
        <div>
          <h1 className="text-lg font-medium mb-1">Marker</h1>
          <p className="text-sm text-muted-foreground">
            Oversigt over marker, arealer og forpagtning. Brug fanen "Kort" for kortvisning.
          </p>
        </div>
        <Button
          variant={tableEdit ? "default" : "outline"}
          size="sm"
          onClick={() => setTableEdit((v) => !v)}
        >
          {tableEdit ? "Færdig" : "Rediger i tabel"}
        </Button>
      </div>

      <TableToolbar api={filters} searchPlaceholder="Søg mark, matrikel, jordtype…" />

      <div className="rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <SortableHeader label="Mark" sortKey="name" sort={filters.sort} onToggle={filters.toggleSort} />
              <SortableHeader label="Matrikel" sortKey="matrikel" sort={filters.sort} onToggle={filters.toggleSort} />
              <SortableHeader label="Type" sortKey="use_type" sort={filters.sort} onToggle={filters.toggleSort} />
              <SortableHeader label="Matrikelareal" sortKey="totalHa" sort={filters.sort} onToggle={filters.toggleSort} align="right" />
              <SortableHeader label="Forpagtningsareal" sortKey="lease_area_ha" sort={filters.sort} onToggle={filters.toggleSort} align="right" />
              <SortableHeader label="Støtteberettiget" sortKey="eligible_area_ha" sort={filters.sort} onToggle={filters.toggleSort} align="right" />
              <SortableHeader label="Pris/ha" sortKey="lease_price_per_ha" sort={filters.sort} onToggle={filters.toggleSort} align="right" />
              <SortableHeader label="Årlig afgift" sortKey="annual" sort={filters.sort} onToggle={filters.toggleSort} align="right" />
              <SortableHeader label="Jordtype" sortKey="soil_type" sort={filters.sort} onToggle={filters.toggleSort} />
              <th className="text-left px-3 py-2 font-medium">Drænet</th>
              <th className="px-3 py-2 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={11} className="px-3 py-6 text-center text-muted-foreground text-xs">
                  Indlæser marker…
                </td>
              </tr>
            )}
            {error && !isLoading && (
              <tr>
                <td colSpan={11} className="px-3 py-6 text-center text-destructive text-xs">
                  Kunne ikke hente marker.
                </td>
              </tr>
            )}
            {!isLoading && !error && fields.length === 0 && (
              <tr>
                <td colSpan={11} className="px-3 py-6 text-center text-muted-foreground text-xs">
                  Ingen marker fundet.
                </td>
              </tr>
            )}
            {fields.map((f) => {
              const annual =
                f.lease_area_ha != null && f.lease_price_per_ha != null
                  ? f.lease_area_ha * f.lease_price_per_ha
                  : null;
              return (
                <tr key={f.id} className="border-t border-border hover:bg-muted/40 transition-colors">
                  <td className="px-3 py-2 font-medium">
                    {tableEdit ? (
                      <InlineText
                        key={f.name}
                        value={f.name}
                        onCommit={(v) => { if (v && v !== f.name) patchField(f, { name: v }); }}
                      />
                    ) : f.name}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span>{f.matrikler.length > 0 ? f.matrikler.join(", ") : "—"}</span>
                      {tableEdit && (
                        <ParcelPicker
                          field={f}
                          allMatrikler={allMatrikler}
                          trigger={
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded border border-dashed border-border px-1.5 py-0.5 text-[11px] hover:bg-muted"
                              title="Tilknyt matrikler"
                            >
                              <Plus className="h-3 w-3" /> Matrikel
                            </button>
                          }
                        />
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {tableEdit ? (
                      <Select
                        value={f.use_type ?? NONE}
                        onValueChange={(v) =>
                          patchField(f, { use_type: v === NONE ? null : (v as FormState["use_type"]) })
                        }
                      >
                        <SelectTrigger className="h-8 w-[130px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>—</SelectItem>
                          {USE_TYPE_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : f.use_type ? (
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
                    {tableEdit ? (
                      <InlineNumber
                        key={String(f.lease_area_ha)}
                        value={f.lease_area_ha}
                        onCommit={(v) => { if (v !== f.lease_area_ha) patchField(f, { lease_area_ha: v == null ? "" : String(v) }); }}
                      />
                    ) : f.lease_area_ha != null ? `${f.lease_area_ha} ha` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {tableEdit ? (
                      <InlineNumber
                        key={String(f.eligible_area_ha)}
                        value={f.eligible_area_ha}
                        onCommit={(v) => { if (v !== f.eligible_area_ha) patchField(f, { eligible_area_ha: v == null ? "" : String(v) }); }}
                      />
                    ) : f.eligible_area_ha != null ? `${f.eligible_area_ha} ha` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {tableEdit ? (
                      <InlineNumber
                        key={String(f.lease_price_per_ha)}
                        value={f.lease_price_per_ha}
                        onCommit={(v) => { if (v !== f.lease_price_per_ha) patchField(f, { lease_price_per_ha: v == null ? "" : String(v) }); }}
                      />
                    ) : fmtKr(f.lease_price_per_ha)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtKr(annual)}</td>
                  <td className="px-3 py-2 text-xs">
                    {tableEdit ? (
                      <Select
                        value={f.soil_type ?? NONE}
                        onValueChange={(v) => patchField(f, { soil_type: v === NONE ? null : v })}
                      >
                        <SelectTrigger className="h-8 w-[110px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>—</SelectItem>
                          {SOIL_TYPES.map((s) => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (f.soil_type ?? "—")}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {tableEdit ? (
                      <Switch
                        checked={!!f.is_drained}
                        onCheckedChange={(v) => patchField(f, { is_drained: v })}
                      />
                    ) : f.is_drained ? "Ja" : "Nej"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() =>
                          navigate({
                            to: "/landbrugsjord",
                            search: { tab: "kort", drawField: f.id },
                          })
                        }
                        className="p-1.5 rounded hover:bg-muted"
                        aria-label="Tegn på kort"
                        title="Tegn på kort"
                      >
                        <MapPin className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setEditing(f)}
                        className="p-1.5 rounded hover:bg-muted"
                        aria-label="Rediger"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleting(f)}
                        className="p-1.5 rounded hover:bg-muted text-destructive"
                        aria-label="Slet mark"
                        title="Slet mark"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {fields.length > 0 && (
            <tfoot>
              <tr className="border-t border-border bg-muted/30 font-medium">
                <td className="px-3 py-2" colSpan={3}>I alt ({fields.length})</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {fields.reduce((s, f) => s + (f.totalHa ?? 0), 0).toFixed(2)} ha
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {fields.reduce((s, f) => s + (f.lease_area_ha ?? 0), 0).toFixed(2)} ha
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {fields.reduce((s, f) => s + (f.eligible_area_ha ?? 0), 0).toFixed(2)} ha
                </td>
                <td className="px-3 py-2"></td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {fmtKr(fields.reduce((s, f) => {
                    const annual = f.lease_area_ha != null && f.lease_price_per_ha != null
                      ? f.lease_area_ha * f.lease_price_per_ha
                      : 0;
                    return s + annual;
                  }, 0))}
                </td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <FieldDialog
        editing={editing}
        allMatrikler={allMatrikler}
        onOpenChange={(o) => { if (!o) setEditing(null); }}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["matrikel-data"] });
          setEditing(null);
        }}
      />

      <AlertDialog open={deleting != null} onOpenChange={(o) => { if (!o) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet mark "{deleting?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && deleting.parcels.length > 0
                ? `Marken er knyttet til ${deleting.parcels.length} matrikel-parcel(ler). Tilknytningen fjernes, men matriklerne bevares.`
                : "Denne handling kan ikke fortrydes."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMut.isPending}>Annuller</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMut.isPending}
              onClick={(e) => { e.preventDefault(); if (deleting) deleteMut.mutate(deleting.id); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMut.isPending ? "Sletter…" : "Slet"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function InlineText({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [v, setV] = useState(value);
  return (
    <Input
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => onCommit(v.trim())}
      className="h-8"
    />
  );
}

function InlineNumber({ value, onCommit }: { value: number | null | undefined; onCommit: (v: number | null) => void }) {
  const [v, setV] = useState(value != null ? String(value) : "");
  return (
    <Input
      type="number"
      step="0.01"
      min="0"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => onCommit(v.trim() === "" ? null : Number(v))}
      className="h-8 text-right"
    />
  );
}

function FieldDialog({
  editing, allMatrikler, onOpenChange, onSaved,
}: {
  editing: FieldRow | null;
  allMatrikler: MatrikelRow[];
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
