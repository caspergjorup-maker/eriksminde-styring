import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

import { useMatrikelData, USE_TYPE_COLORS, USE_TYPE_LABELS, type MatrikelRow, type FieldRow } from "@/lib/use-matrikel";
import { updateParcel } from "@/lib/parcels.functions";
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
  TableToolbar,
  SortableHeader,
  useTableFilters,
  type FilterColumn,
} from "@/components/table-filters";

const NONE = "__none__";

const USE_TYPE_OPTIONS = [
  { value: "omdrift", label: "Omdrift" },
  { value: "skov", label: "Skov" },
  { value: "gaard", label: "Gårdsareal" },
] as const;

type UseType = "omdrift" | "skov" | "gaard";

const COLUMNS: FilterColumn<MatrikelRow>[] = [
  { key: "matrikelnr", label: "Matrikel", sortable: true, sortValue: (m) => m.matrikelnr },
  { key: "ejerlav", label: "Ejerlav", type: "enum", get: (m) => m.ejerlav, sortable: true, sortValue: (m) => m.ejerlav },
  {
    key: "use_type",
    label: "Type",
    type: "enum",
    get: (m) => m.use_type ?? "",
    options: [
      { value: "omdrift", label: "Omdrift" },
      { value: "skov", label: "Skov" },
      { value: "gaard", label: "Gårdsareal" },
      { value: "", label: "(ingen)" },
    ],
    sortable: true,
    sortValue: (m) => m.use_type ?? "",
  },
  {
    key: "field",
    label: "Mark",
    type: "enum",
    get: (m) => (m.fieldNames.length ? m.fieldNames[0] : ""),
    sortable: true,
    sortValue: (m) => m.fieldNames.join(", "),
  },
  {
    key: "registreret",
    label: "Registreret areal (ha)",
    type: "number",
    get: (m) => m.registreretAreaHa,
    sortable: true,
    sortValue: (m) => m.registreretAreaHa,
  },
  {
    key: "net",
    label: "Nettoareal (ha)",
    type: "number",
    get: (m) => m.netAreaHa,
    sortable: true,
    sortValue: (m) => m.netAreaHa,
  },
];

type ParcelUpdatePayload = {
  id: string;
  use_type: UseType | null;
  net_area_ha: number | null;
  notes: string | null;
};

export function MatriklerPage() {
  const { data, isLoading, error } = useMatrikelData();
  const allMatrikler = data?.matrikler ?? [];
  const allFields = data?.fields ?? [];

  const filters = useTableFilters({
    rows: allMatrikler,
    columns: COLUMNS,
    searchFields: [
      (m) => m.matrikelnr,
      (m) => m.ejerlav,
      (m) => m.fieldNames.join(" "),
    ],
  });
  const matrikler = filters.rows;

  const [tableEdit, setTableEdit] = useState(false);
  const [editing, setEditing] = useState<MatrikelRow | null>(null);
  const qc = useQueryClient();
  const update = useServerFn(updateParcel);

  const saveMut = useMutation({
    mutationFn: (payload: ParcelUpdatePayload) => update({ data: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["matrikel-data"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function patchParcel(m: MatrikelRow, patch: Partial<ParcelUpdatePayload>) {
    saveMut.mutate({
      id: m.parcelId,
      use_type: m.use_type,
      net_area_ha: m.netAreaHa,
      notes: m.notes,
      ...patch,
    });
  }

  const totalRegistreret = matrikler.reduce((s, m) => s + (m.registreretAreaHa ?? 0), 0);
  const totalNet = matrikler.reduce((s, m) => s + (m.netAreaHa ?? 0), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-5 gap-4">
        <div>
          <h1 className="text-lg font-medium mb-1">Matrikler</h1>
          <p className="text-sm text-muted-foreground">
            Oversigt over matrikler fra Datafordeler med tilknyttede marker.
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

      <TableToolbar api={filters} searchPlaceholder="Søg matrikel, ejerlav, mark…" />

      <div className="rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <SortableHeader label="Matrikel" sortKey="matrikelnr" sort={filters.sort} onToggle={filters.toggleSort} />
              <SortableHeader label="Ejerlav" sortKey="ejerlav" sort={filters.sort} onToggle={filters.toggleSort} />
              <SortableHeader label="Type" sortKey="use_type" sort={filters.sort} onToggle={filters.toggleSort} />
              <SortableHeader label="Mark" sortKey="field" sort={filters.sort} onToggle={filters.toggleSort} />
              <SortableHeader label="Registreret areal" sortKey="registreret" sort={filters.sort} onToggle={filters.toggleSort} align="right" />
              <SortableHeader label="Nettoareal" sortKey="net" sort={filters.sort} onToggle={filters.toggleSort} align="right" />
              <th className="px-3 py-2 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground text-xs">
                  Indlæser matrikler…
                </td>
              </tr>
            )}
            {error && !isLoading && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-destructive text-xs">
                  Kunne ikke hente matrikler.
                </td>
              </tr>
            )}
            {!isLoading && !error && matrikler.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground text-xs">
                  {allMatrikler.length === 0 ? "Ingen matrikler fundet." : "Ingen matrikler matcher filtrene."}
                </td>
              </tr>
            )}
            {matrikler.map((m) => (
              <tr key={m.parcelId} className="border-t border-border hover:bg-muted/40 transition-colors">
                <td className="px-3 py-2 font-medium">Matr. {m.matrikelnr}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{m.ejerlav}</td>
                <td className="px-3 py-2">
                  {tableEdit ? (
                    <Select
                      value={m.use_type ?? NONE}
                      onValueChange={(v) =>
                        patchParcel(m, { use_type: v === NONE ? null : (v as UseType) })
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
                  ) : m.use_type ? (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] text-white"
                      style={{ background: USE_TYPE_COLORS[m.use_type] }}
                    >
                      {USE_TYPE_LABELS[m.use_type]}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2 text-xs">
                  {tableEdit ? (
                    <Select
                      value={m.fieldId ?? NONE}
                      onValueChange={(v) => patchParcel(m, { field_id: v === NONE ? null : v })}
                    >
                      <SelectTrigger className="h-8 w-[160px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>—</SelectItem>
                        {allFields.map((f) => (
                          <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : m.fieldNames.length > 0 ? m.fieldNames.join(", ") : "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {m.registreretAreaHa != null ? `${m.registreretAreaHa} ha` : "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {tableEdit ? (
                    <InlineNumber
                      key={String(m.netAreaHa)}
                      value={m.netAreaHa}
                      onCommit={(v) => { if (v !== m.netAreaHa) patchParcel(m, { net_area_ha: v }); }}
                    />
                  ) : m.netAreaHa != null ? `${m.netAreaHa} ha` : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => setEditing(m)}
                    className="p-1.5 rounded hover:bg-muted"
                    aria-label="Rediger"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          {matrikler.length > 0 && (
            <tfoot>
              <tr className="border-t border-border bg-muted/30 font-medium">
                <td className="px-3 py-2" colSpan={4}>I alt ({matrikler.length}{matrikler.length !== allMatrikler.length ? ` af ${allMatrikler.length}` : ""})</td>
                <td className="px-3 py-2 text-right tabular-nums">{totalRegistreret.toFixed(2)} ha</td>
                <td className="px-3 py-2 text-right tabular-nums">{totalNet.toFixed(2)} ha</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <MatrikelDialog
        editing={editing}
        fields={allFields}
        onOpenChange={(o) => { if (!o) setEditing(null); }}
        onSave={(payload) => {
          saveMut.mutate(payload, {
            onSuccess: () => setEditing(null),
          });
        }}
        saving={saveMut.isPending}
      />
    </div>
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

function MatrikelDialog({
  editing, fields, onOpenChange, onSave, saving,
}: {
  editing: MatrikelRow | null;
  fields: FieldRow[];
  onOpenChange: (o: boolean) => void;
  onSave: (p: ParcelUpdatePayload) => void;
  saving: boolean;
}) {
  const open = editing != null;
  const [useType, setUseType] = useState<UseType | null>(null);
  const [fieldId, setFieldId] = useState<string | null>(null);
  const [netArea, setNetArea] = useState("");
  const [notes, setNotes] = useState("");

  // Reset when editing changes
  const editingId = editing?.parcelId ?? null;
  const [lastId, setLastId] = useState<string | null>(null);
  if (editingId !== lastId) {
    setLastId(editingId);
    if (editing) {
      setUseType(editing.use_type);
      setFieldId(editing.fieldId);
      setNetArea(editing.netAreaHa != null ? String(editing.netAreaHa) : "");
      setNotes(editing.notes ?? "");
    }
  }

  if (!editing) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Matr. {editing.matrikelnr} — {editing.ejerlav}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block">Type</Label>
              <Select
                value={useType ?? NONE}
                onValueChange={(v) => setUseType(v === NONE ? null : (v as UseType))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {USE_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block">Mark</Label>
              <Select
                value={fieldId ?? NONE}
                onValueChange={(v) => setFieldId(v === NONE ? null : v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {fields.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block">Nettoareal (ha)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={netArea}
              onChange={(e) => setNetArea(e.target.value)}
            />
          </div>
          <div>
            <Label className="mb-1.5 block">Noter</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuller</Button>
          <Button
            disabled={saving}
            onClick={() => onSave({
              id: editing.parcelId,
              use_type: useType,
              field_id: fieldId,
              net_area_ha: netArea.trim() === "" ? null : Number(netArea),
              notes: notes.trim() || null,
            })}
          >
            {saving ? "Gemmer…" : "Gem"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
