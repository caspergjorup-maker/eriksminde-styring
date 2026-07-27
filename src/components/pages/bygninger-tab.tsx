import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, ChevronRight, MapPin, Pencil, Plus, Shapes, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { BuildingUnitEditor } from "@/components/building-map/building-unit-editor";


import {
  BUILDING_TYPES,
  BUILDING_CONDITIONS,
  BUILDING_LEASE_STATUSES,
  HEATING_TYPES,
  LEASE_STATUSES,
  createBuilding,
  createBuildingLease,
  deleteBuilding,
  deleteBuildingLease,
  listBuildingLeases,
  listBuildings,
  listTenantOptions,
  updateBuilding,
  updateBuildingLease,
  type Building,
  type BuildingCondition,
  type BuildingLease,
  type BuildingLeaseStatus,
  type BuildingType,
  type HeatingType,
  type LeaseStatus,
} from "@/lib/buildings.functions";
import {
  UNIT_LEASE_STATUSES,
  UNIT_LEASE_STATUS_LABEL,
  UNIT_LEASE_STATUS_TONE,
  createBuildingUnit,
  deleteBuildingUnit,
  listBuildingUnits,
  updateBuildingUnit,
  type BuildingUnit,
  type UnitLeaseStatus,
} from "@/lib/building-units.functions";
import { formatDKK, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import {
  TableToolbar,
  SortableHeader,
  useTableFilters,
  type FilterColumn,
} from "@/components/table-filters";



const NONE = "__none__";

const BUILDING_TYPE_LABEL: Record<BuildingType, string> = {
  stuehus: "Stuehus",
  lade: "Lade",
  maskinhus: "Maskinhus",
  lagerhal: "Lagerhal",
  vaerksted: "Værksted",
  smedie: "Smedie",
  garage: "Garage",
};

const CONDITION_LABEL: Record<BuildingCondition, string> = {
  god: "God",
  vedligeholdelse_nødvendig: "Vedligeholdelse nødvendig",
  renovering_nødvendig: "Renovering nødvendig",
};

const LEASE_STATUS_LABEL: Record<BuildingLeaseStatus, string> = {
  udlejet: "Udlejet",
  ledig: "Ledig",
  ikke_klar: "Ikke klar endnu",
  intern_brug: "Intern brug",
  udlejes_ikke: "Udlejes ikke",
};

export const LEASE_STATUS_TONE: Record<BuildingLeaseStatus, string> = {
  udlejet: "bg-emerald-100 text-emerald-900",
  ledig: "bg-blue-100 text-blue-900",
  ikke_klar: "bg-yellow-100 text-yellow-900",
  intern_brug: "bg-teal-100 text-teal-900",
  udlejes_ikke: "bg-gray-200 text-gray-800",
};

const HEATING_LABEL: Record<HeatingType, string> = {
  fjernvarme: "Fjernvarme",
  olie: "Olie",
  varmepumpe: "Varmepumpe",
  elvarme: "Elvarme",
  ingen: "Ingen",
};

const STATUS_LABEL: Record<LeaseStatus, string> = {
  active: "Aktiv",
  pending_payment: "Afventer betaling",
  expiring_soon: "Udløber snart",
  vacant: "Ledig",
};

const STATUS_TONE: Record<LeaseStatus, string> = {
  active: "bg-[var(--brand-50)] text-[var(--brand-900)]",
  pending_payment: "bg-amber-100 text-amber-900",
  expiring_soon: "bg-amber-100 text-amber-900",
  vacant: "bg-muted text-muted-foreground",
};

export function BygningerPage() {
  const qc = useQueryClient();
  const listB = useServerFn(listBuildings);
  const listL = useServerFn(listBuildingLeases);
  const listT = useServerFn(listTenantOptions);
  const listU = useServerFn(listBuildingUnits);

  const { data: buildings = [], isLoading: lb } = useQuery({ queryKey: ["buildings"], queryFn: () => listB() });
  const { data: leases = [], isLoading: ll } = useQuery({ queryKey: ["building-leases"], queryFn: () => listL() });
  const { data: tenants = [] } = useQuery({ queryKey: ["building-tenants"], queryFn: () => listT() });
  const { data: units = [] } = useQuery({ queryKey: ["building-units"], queryFn: () => listU() });

  return (
    <div className="space-y-8">
      <BuildingsSection buildings={buildings} units={units} loading={lb} qc={qc} />
      <LeasesSection
        leases={leases}
        loading={ll}
        buildings={buildings}
        units={units}
        tenants={tenants}
        qc={qc}
      />
    </div>
  );
}

/* ---------- Buildings ---------- */

function BuildingsSection({
  buildings, units, loading, qc,
}: {
  buildings: Building[];
  units: BuildingUnit[];
  loading: boolean;
  qc: ReturnType<typeof useQueryClient>;
}) {
  const create = useServerFn(createBuilding);
  const update = useServerFn(updateBuilding);
  const remove = useServerFn(deleteBuilding);

  const [editing, setEditing] = useState<Building | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<Building | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editingUnit, setEditingUnit] = useState<BuildingUnit | null>(null);
  const [creatingUnitFor, setCreatingUnitFor] = useState<Building | null>(null);
  const [drawingFor, setDrawingFor] = useState<Building | null>(null);
  const [tableEdit, setTableEdit] = useState(false);

  const patchMut = useMutation({
    mutationFn: (v: BuildingSubmit & { id: string }) => update({ data: v }),
    onSuccess: () => {
      toast.success("Gemt");
      qc.invalidateQueries({ queryKey: ["buildings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function patchBuilding(b: Building, patch: Partial<BuildingSubmit>) {
    patchMut.mutate({
      id: b.id,
      name: b.name,
      type: b.type,
      description: b.description ?? null,
      build_year: b.build_year ?? null,
      area_m2_gross: b.area_m2_gross ?? null,
      area_m2_net: b.area_m2_net ?? null,
      floors: b.floors ?? null,
      parcel_id: b.parcel_id ?? null,
      condition: b.condition ?? null,
      last_inspection: b.last_inspection ?? null,
      lease_status: b.lease_status ?? "ledig",
      lease_status_note: b.lease_status_note ?? null,
      estimated_monthly_rent: b.estimated_monthly_rent ?? null,
      has_electricity: !!b.has_electricity,
      has_water: !!b.has_water,
      has_heating: !!b.has_heating,
      heating_type: b.heating_type ?? null,
      has_sewage: !!b.has_sewage,
      has_internet: !!b.has_internet,
      internal_notes: b.internal_notes ?? null,
      ...patch,
    });
  }

  const unitsByBuilding = new Map<string, BuildingUnit[]>();
  for (const u of units) {
    if (!u.building_id) continue;
    const arr = unitsByBuilding.get(u.building_id) ?? [];
    arr.push(u);
    unitsByBuilding.set(u.building_id, arr);
  }

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const deleteMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Bygning slettet");
      qc.invalidateQueries({ queryKey: ["buildings"] });
      qc.invalidateQueries({ queryKey: ["building-leases"] });
      qc.invalidateQueries({ queryKey: ["building-units"] });
      setToDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const buildingCols: FilterColumn<Building>[] = [
    { key: "name", label: "Navn", sortable: true, sortValue: (b) => b.name },
    { key: "type", label: "Type", type: "enum", get: (b) => b.type, options: BUILDING_TYPES.map((t) => ({ value: t, label: BUILDING_TYPE_LABEL[t] ?? t })), sortable: true, sortValue: (b) => b.type },
    { key: "area_m2_gross", label: "Areal (m²)", type: "number", get: (b) => b.area_m2_gross, sortable: true, sortValue: (b) => b.area_m2_gross },
    { key: "condition", label: "Stand", type: "enum", get: (b) => b.condition ?? "", options: BUILDING_CONDITIONS.map((c) => ({ value: c, label: CONDITION_LABEL[c] ?? c })), sortable: true, sortValue: (b) => b.condition ?? "" },
    { key: "estimated_monthly_rent", label: "Udlejningspotentiale (md.)", type: "number", get: (b) => b.estimated_monthly_rent, sortable: true, sortValue: (b) => b.estimated_monthly_rent },
    { key: "on_map", label: "På bygningsplan", type: "enum", get: (b) => (isOnMap(b) ? "ja" : "nej"), options: [{ value: "ja", label: "Ja" }, { value: "nej", label: "Ikke placeret" }], sortable: true, sortValue: (b) => (isOnMap(b) ? 1 : 0) },
    { key: "lease_status", label: "Status", type: "enum", get: (b) => b.lease_status ?? "", options: BUILDING_LEASE_STATUSES.map((s) => ({ value: s, label: LEASE_STATUS_LABEL[s] ?? s })) },
  ];
  const tableFilters = useTableFilters({
    rows: buildings,
    columns: buildingCols,
    searchFields: [(b) => b.name, (b) => BUILDING_TYPE_LABEL[b.type] ?? b.type],
  });
  const filteredBuildings = tableFilters.rows;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-[var(--brand-900)]">Bygninger</h2>
        <div className="flex items-center gap-2">
          <Button variant={tableEdit ? "default" : "outline"} size="sm" onClick={() => setTableEdit((v) => !v)}>
            {tableEdit ? "Færdig" : "Rediger i tabel"}
          </Button>
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-1" /> Ny bygning
          </Button>
        </div>
      </div>
      <TableToolbar api={tableFilters} searchPlaceholder="Søg bygning…" />
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <SortableHeader label="Navn" sortKey="name" sort={tableFilters.sort} onToggle={tableFilters.toggleSort} className="px-4 py-2.5" />
              <SortableHeader label="Type" sortKey="type" sort={tableFilters.sort} onToggle={tableFilters.toggleSort} className="px-4 py-2.5" />
              <SortableHeader label="Areal" sortKey="area_m2_gross" sort={tableFilters.sort} onToggle={tableFilters.toggleSort} className="px-4 py-2.5" />
              <SortableHeader label="Stand" sortKey="condition" sort={tableFilters.sort} onToggle={tableFilters.toggleSort} className="px-4 py-2.5" />
              <SortableHeader label="Udlejningspot./md." sortKey="estimated_monthly_rent" sort={tableFilters.sort} onToggle={tableFilters.toggleSort} className="px-4 py-2.5" />
              <SortableHeader label="På plan" sortKey="on_map" sort={tableFilters.sort} onToggle={tableFilters.toggleSort} className="px-4 py-2.5" />
              <th className="px-4 py-2.5 font-medium">Status / lejer</th>
              <th className="px-4 py-2.5 w-32"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && <tr><td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">Indlæser…</td></tr>}
            {!loading && filteredBuildings.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">{buildings.length === 0 ? "Ingen bygninger endnu." : "Ingen bygninger matcher filtrene."}</td></tr>
            )}
            {filteredBuildings.map((b) => {
              const bUnits = unitsByBuilding.get(b.id) ?? [];
              const isExpanded = expanded.has(b.id);
              const hasUnits = bUnits.length > 0;
              return (
                <>
                  <tr
                    key={b.id}
                    className="hover:bg-muted/30 cursor-pointer"
                    onClick={() => hasUnits && toggleExpand(b.id)}
                  >
                    <td className="px-4 py-2.5 font-medium">
                      <div className="flex items-center gap-1.5">
                        {hasUnits ? (
                          isExpanded
                            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : <span className="w-3.5" />}
                        {tableEdit ? (
                          <Input
                            defaultValue={b.name}
                            className="h-7 text-sm"
                            onClick={(e) => e.stopPropagation()}
                            onBlur={(e) => {
                              const v = e.target.value.trim();
                              if (v && v !== b.name) patchBuilding(b, { name: v });
                            }}
                          />
                        ) : b.name}
                      </div>
                    </td>
                    <td className="px-4 py-2.5" onClick={(e) => tableEdit && e.stopPropagation()}>
                      {tableEdit ? (
                        <Select value={b.type} onValueChange={(v) => patchBuilding(b, { type: v as BuildingType })}>
                          <SelectTrigger className="h-7 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {BUILDING_TYPES.map((t) => (
                              <SelectItem key={t} value={t}>{BUILDING_TYPE_LABEL[t] ?? t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (BUILDING_TYPE_LABEL[b.type] ?? b.type)}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground tabular-nums">
                      {tableEdit ? (
                        <Input
                          type="number"
                          defaultValue={b.area_m2_gross ?? ""}
                          className="h-7 text-sm w-24"
                          onClick={(e) => e.stopPropagation()}
                          onBlur={(e) => {
                            const v = e.target.value === "" ? null : Number(e.target.value);
                            if (v !== (b.area_m2_gross ?? null)) patchBuilding(b, { area_m2_gross: v });
                          }}
                        />
                      ) : (b.area_m2_gross != null ? `${b.area_m2_gross} m²` : "—")}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground" onClick={(e) => tableEdit && e.stopPropagation()}>
                      {tableEdit ? (
                        <Select
                          value={b.condition ?? NONE}
                          onValueChange={(v) => patchBuilding(b, { condition: v === NONE ? null : (v as BuildingCondition) })}
                        >
                          <SelectTrigger className="h-7 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>—</SelectItem>
                            {BUILDING_CONDITIONS.map((c) => (
                              <SelectItem key={c} value={c}>{CONDITION_LABEL[c] ?? c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (b.condition ? CONDITION_LABEL[b.condition] : "—")}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                      {tableEdit ? (
                        <Input
                          type="number"
                          defaultValue={b.estimated_monthly_rent ?? ""}
                          className="h-7 text-sm w-28"
                          onClick={(e) => e.stopPropagation()}
                          onBlur={(e) => {
                            const v = e.target.value === "" ? null : Number(e.target.value);
                            if (v !== (b.estimated_monthly_rent ?? null)) patchBuilding(b, { estimated_monthly_rent: v });
                          }}
                        />
                      ) : (() => {
                        const unitSum = bUnits.reduce((s, u) => s + (u.estimated_monthly_rent ?? 0), 0);
                        const val = hasUnits && unitSum > 0 ? unitSum : b.estimated_monthly_rent;
                        return val ? `${formatDKK(val)}/md.` : "—";
                      })()}
                    </td>
                    <td className="px-4 py-2.5">
                      {isOnMap(b) ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-emerald-100 text-emerald-900">
                          <MapPin className="h-3 w-3" /> Ja
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-muted text-muted-foreground">
                          Ikke placeret
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {hasUnits ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-muted text-muted-foreground">
                          {bUnits.length} enheder
                        </span>
                      ) : b.lease_status ? (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] ${LEASE_STATUS_TONE[b.lease_status]}`}
                          title={b.lease_status_note ?? undefined}
                        >
                          {LEASE_STATUS_LABEL[b.lease_status]}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setCreatingUnitFor(b)}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground"
                        title="Tilføj enhed"
                      ><Plus className="h-4 w-4" /></button>
                      <button
                        onClick={() => setDrawingFor(b)}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground"
                        title="Tegn enheder på kort"
                        disabled={!hasUnits}
                      ><Shapes className="h-4 w-4" /></button>
                      <button onClick={() => setEditing(b)} className="p-1.5 rounded hover:bg-muted"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => setToDelete(b)} className="p-1.5 rounded hover:bg-muted text-red-600"><Trash2 className="h-4 w-4" /></button>
                    </td>
                  </tr>

                  {isExpanded && bUnits.map((u) => (
                    <tr key={u.id} className="bg-muted/30 text-[13px]">
                      <td className="px-4 py-2 pl-10 text-muted-foreground">↳ {u.name}</td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {u.area_m2 != null ? `${u.area_m2} m²` : "—"}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {u.lease?.tenant?.name ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground tabular-nums">
                        {u.lease?.monthly_rent ? formatDKK(u.lease.monthly_rent) : "—"}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground tabular-nums">
                        {u.estimated_monthly_rent ? `${formatDKK(u.estimated_monthly_rent)}/md.` : "—"}
                      </td>
                      <td className="px-4 py-2">
                        {u.map_geometry && u.map_kind ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700"><MapPin className="h-3.5 w-3.5" /> Ja</span>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] ${UNIT_LEASE_STATUS_TONE[u.lease_status]}`}
                          title={u.lease_status_note ?? undefined}
                        >
                          {UNIT_LEASE_STATUS_LABEL[u.lease_status]}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button onClick={() => setEditingUnit(u)} className="p-1.5 rounded hover:bg-muted">
                          <Pencil className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      <BuildingDialog
        open={creating || editing != null}
        editing={editing}
        onOpenChange={(o) => { if (!o) { setCreating(false); setEditing(null); } }}
        onSubmit={async (v) => {
          try {
            if (editing) {
              await update({ data: { id: editing.id, ...v } });
              toast.success("Opdateret");
            } else {
              await create({ data: v });
              toast.success("Oprettet");
            }
            qc.invalidateQueries({ queryKey: ["buildings"] });
            qc.invalidateQueries({ queryKey: ["building-leases"] });
            setCreating(false); setEditing(null);
          } catch (e) { toast.error((e as Error).message); }
        }}
      />

      <UnitDialog
        open={creatingUnitFor != null || editingUnit != null}
        editing={editingUnit}
        building={creatingUnitFor}
        onOpenChange={(o) => { if (!o) { setCreatingUnitFor(null); setEditingUnit(null); } }}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["building-units"] });
          qc.invalidateQueries({ queryKey: ["building-leases"] });
          setCreatingUnitFor(null);
          setEditingUnit(null);
        }}
      />

      {drawingFor && (
        <BuildingUnitEditor
          building={drawingFor}
          units={units}
          open={drawingFor != null}
          onOpenChange={(o) => !o && setDrawingFor(null)}
        />
      )}


      <AlertDialog open={toDelete != null} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet bygning</AlertDialogTitle>
            <AlertDialogDescription>Slet "{toDelete?.name}"? Lejemål og enheder slettes også.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annullér</AlertDialogCancel>
            <AlertDialogAction onClick={() => toDelete && deleteMut.mutate(toDelete.id)} className="bg-red-600 hover:bg-red-700">Slet</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

type BuildingForm = {
  name: string;
  type: BuildingType;
  description: string;
  build_year: string;
  area_m2_gross: string;
  area_m2_net: string;
  floors: string;
  parcel_id: string | null;
  condition: BuildingCondition | null;
  last_inspection: string;
  lease_status: BuildingLeaseStatus;
  lease_status_note: string;
  estimated_monthly_rent: string;
  has_electricity: boolean;
  has_water: boolean;
  has_heating: boolean;
  heating_type: HeatingType | null;
  has_sewage: boolean;
  has_internet: boolean;
  internal_notes: string;
};

const emptyBuilding: BuildingForm = {
  name: "", type: "lade", description: "",
  build_year: "", area_m2_gross: "", area_m2_net: "", floors: "1",
  parcel_id: null,
  condition: null, last_inspection: "",
  lease_status: "ledig", lease_status_note: "", estimated_monthly_rent: "",
  has_electricity: false, has_water: false, has_heating: false, heating_type: null,
  has_sewage: false, has_internet: false,
  internal_notes: "",
};

function toForm(b: Building): BuildingForm {
  return {
    name: b.name,
    type: b.type,
    description: b.description ?? "",
    build_year: b.build_year != null ? String(b.build_year) : "",
    area_m2_gross: b.area_m2_gross != null ? String(b.area_m2_gross) : "",
    area_m2_net: b.area_m2_net != null ? String(b.area_m2_net) : "",
    floors: b.floors != null ? String(b.floors) : "1",
    parcel_id: b.parcel_id,
    condition: b.condition,
    last_inspection: b.last_inspection ?? "",
    lease_status: b.lease_status ?? "ledig",
    lease_status_note: b.lease_status_note ?? "",
    estimated_monthly_rent: b.estimated_monthly_rent != null ? String(b.estimated_monthly_rent) : "",
    has_electricity: !!b.has_electricity,
    has_water: !!b.has_water,
    has_heating: !!b.has_heating,
    heating_type: b.heating_type,
    has_sewage: !!b.has_sewage,
    has_internet: !!b.has_internet,
    internal_notes: b.internal_notes ?? "",
  };
}

export type BuildingSubmit = {
  name: string; type: BuildingType; description: string | null;
  build_year: number | null; area_m2_gross: number | null; area_m2_net: number | null;
  floors: number | null; parcel_id: string | null;
  condition: BuildingCondition | null; last_inspection: string | null;
  lease_status: BuildingLeaseStatus; lease_status_note: string | null;
  estimated_monthly_rent: number | null;
  has_electricity: boolean; has_water: boolean; has_heating: boolean;
  heating_type: HeatingType | null;
  has_sewage: boolean; has_internet: boolean;
  internal_notes: string | null;
};




function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function BuildingDialog({
  open, editing, onOpenChange, onSubmit,
}: {
  open: boolean;
  editing: Building | null;
  onOpenChange: (o: boolean) => void;
  onSubmit: (v: BuildingSubmit) => Promise<void>;
}) {
  const [v, setV] = useState<BuildingForm>(emptyBuilding);
  const [saving, setSaving] = useState(false);
  const key = `${open}-${editing?.id ?? "new"}`;
  const [lastKey, setLastKey] = useState("");
  if (open && lastKey !== key) {
    setLastKey(key);
    setV(editing ? toForm(editing) : emptyBuilding);
  }
  const showLeaseNote = v.lease_status === "ikke_klar" || v.lease_status === "udlejes_ikke";
  const numOrNull = (s: string) => (s.trim() === "" ? null : Number(s));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? "Rediger bygning" : "Ny bygning"}</DialogTitle></DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!v.name.trim()) return;
            setSaving(true);
            try {
              await onSubmit({
                name: v.name.trim(),
                type: v.type,
                description: v.description.trim() || null,
                build_year: numOrNull(v.build_year),
                area_m2_gross: numOrNull(v.area_m2_gross),
                area_m2_net: numOrNull(v.area_m2_net),
                floors: numOrNull(v.floors),
                parcel_id: v.parcel_id,
                condition: v.condition,
                last_inspection: v.last_inspection || null,
                lease_status: v.lease_status,
                lease_status_note: showLeaseNote ? (v.lease_status_note.trim() || null) : null,
                estimated_monthly_rent: numOrNull(v.estimated_monthly_rent),
                has_electricity: v.has_electricity,
                has_water: v.has_water,
                has_heating: v.has_heating,
                heating_type: v.has_heating ? v.heating_type : null,
                has_sewage: v.has_sewage,
                has_internet: v.has_internet,
                internal_notes: v.internal_notes.trim() || null,
              });
            } finally { setSaving(false); }
          }}
          className="space-y-5"
        >
          <section className="space-y-3">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Generelt</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="bn">Navn *</Label>
                <Input id="bn" required maxLength={200} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={v.type} onValueChange={(x) => setV({ ...v, type: x as BuildingType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BUILDING_TYPES.map((t) => <SelectItem key={t} value={t}>{BUILDING_TYPE_LABEL[t]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="by">Byggeår</Label>
                <Input id="by" type="number" min={1500} max={2100} value={v.build_year} onChange={(e) => setV({ ...v, build_year: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fl">Etager</Label>
                <Input id="fl" type="number" min={0} max={50} value={v.floors} onChange={(e) => setV({ ...v, floors: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ag">Areal brutto (m²)</Label>
                <Input id="ag" type="number" min={0} value={v.area_m2_gross} onChange={(e) => setV({ ...v, area_m2_gross: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="an">Areal netto (m²)</Label>
                <Input id="an" type="number" min={0} value={v.area_m2_net} onChange={(e) => setV({ ...v, area_m2_net: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bd">Beskrivelse</Label>
              <Textarea id="bd" rows={2} maxLength={2000} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Stand</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Bygningsstand</Label>
                <Select
                  value={v.condition ?? NONE}
                  onValueChange={(x) => setV({ ...v, condition: x === NONE ? null : (x as BuildingCondition) })}
                >
                  <SelectTrigger><SelectValue placeholder="Vælg…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>— Ikke angivet —</SelectItem>
                    {BUILDING_CONDITIONS.map((c) => <SelectItem key={c} value={c}>{CONDITION_LABEL[c]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="li">Seneste bygningssyn</Label>
                <Input id="li" type="date" value={v.last_inspection} onChange={(e) => setV({ ...v, last_inspection: e.target.value })} />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Udlejning</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Udlejningsstatus</Label>
                <Select value={v.lease_status} onValueChange={(x) => setV({ ...v, lease_status: x as BuildingLeaseStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BUILDING_LEASE_STATUSES.map((s) => <SelectItem key={s} value={s}>{LEASE_STATUS_LABEL[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="emr">Estimeret månedlig markedsleje (kr)</Label>
                <Input id="emr" type="number" min={0} value={v.estimated_monthly_rent}
                  onChange={(e) => setV({ ...v, estimated_monthly_rent: e.target.value })} />
              </div>
            </div>
            {showLeaseNote && (
              <div className="space-y-1.5">
                <Label htmlFor="lsn">Årsag / note</Label>
                <Input id="lsn" maxLength={2000} value={v.lease_status_note}
                  onChange={(e) => setV({ ...v, lease_status_note: e.target.value })} />
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Forsyning</h3>
            <div className="grid grid-cols-2 gap-3">
              <ToggleRow label="El" checked={v.has_electricity} onChange={(x) => setV({ ...v, has_electricity: x })} />
              <ToggleRow label="Vand" checked={v.has_water} onChange={(x) => setV({ ...v, has_water: x })} />
              <ToggleRow label="Varme" checked={v.has_heating} onChange={(x) => setV({ ...v, has_heating: x })} />
              <ToggleRow label="Kloak / spildevand" checked={v.has_sewage} onChange={(x) => setV({ ...v, has_sewage: x })} />
              <ToggleRow label="Internet" checked={v.has_internet} onChange={(x) => setV({ ...v, has_internet: x })} />
            </div>
            {v.has_heating && (
              <div className="space-y-1.5">
                <Label>Varmetype</Label>
                <Select
                  value={v.heating_type ?? NONE}
                  onValueChange={(x) => setV({ ...v, heating_type: x === NONE ? null : (x as HeatingType) })}
                >
                  <SelectTrigger><SelectValue placeholder="Vælg…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>— Ikke angivet —</SelectItem>
                    {HEATING_TYPES.map((h) => <SelectItem key={h} value={h}>{HEATING_LABEL[h]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Interne noter</h3>
            <Textarea rows={3} maxLength={5000} placeholder="Ikke synlig for lejere"
              value={v.internal_notes} onChange={(e) => setV({ ...v, internal_notes: e.target.value })} />
          </section>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annullér</Button>
            <Button type="submit" disabled={saving}>{saving ? "Gemmer…" : "Gem"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Leases ---------- */

type LeaseForm = {
  building_id: string | null;
  unit_id: string | null;
  tenant_id: string | null;
  monthly_rent: string;
  deposit: string;
  contract_start: string;
  contract_end: string;
  status: LeaseStatus;
  notes: string;
};

const emptyLease: LeaseForm = {
  building_id: null, unit_id: null, tenant_id: null, monthly_rent: "", deposit: "",
  contract_start: "", contract_end: "", status: "active", notes: "",
};

function LeasesSection({
  leases, loading, buildings, units, tenants, qc,
}: {
  leases: BuildingLease[];
  loading: boolean;
  buildings: Building[];
  units: BuildingUnit[];
  tenants: { id: string; name: string }[];
  qc: ReturnType<typeof useQueryClient>;
}) {
  const create = useServerFn(createBuildingLease);
  const update = useServerFn(updateBuildingLease);
  const remove = useServerFn(deleteBuildingLease);

  const [editing, setEditing] = useState<BuildingLease | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<BuildingLease | null>(null);

  const deleteMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Slettet");
      qc.invalidateQueries({ queryKey: ["building-leases"] });
      setToDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const leaseCols: FilterColumn<BuildingLease>[] = [
    { key: "building", label: "Bygning", type: "enum", get: (l) => l.building_name ?? "", sortable: true, sortValue: (l) => l.building_name ?? "" },
    { key: "tenant", label: "Lejer", type: "enum", get: (l) => l.tenant_name ?? "", sortable: true, sortValue: (l) => l.tenant_name ?? "" },
    { key: "monthly_rent", label: "Mdl. leje", type: "number", get: (l) => l.monthly_rent, sortable: true, sortValue: (l) => l.monthly_rent },
    { key: "deposit", label: "Depositum", type: "number", get: (l) => l.deposit, sortable: true, sortValue: (l) => l.deposit },
    { key: "contract_end", label: "Slut", sortable: true, sortValue: (l) => l.contract_end ?? "" },
    { key: "status", label: "Status", type: "enum", get: (l) => l.status, options: LEASE_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] ?? s })), sortable: true, sortValue: (l) => l.status },
  ];
  const leaseFilters = useTableFilters({
    rows: leases,
    columns: leaseCols,
    searchFields: [(l) => l.building_name ?? "", (l) => l.unit_name ?? "", (l) => l.tenant_name ?? "", (l) => l.notes ?? ""],
  });
  const filteredLeases = leaseFilters.rows;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-[var(--brand-900)]">Lejemål</h2>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nyt lejemål
        </Button>
      </div>
      <TableToolbar api={leaseFilters} searchPlaceholder="Søg bygning, lejer, noter…" />
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <SortableHeader label="Bygning" sortKey="building" sort={leaseFilters.sort} onToggle={leaseFilters.toggleSort} className="px-4 py-2.5" />
              <SortableHeader label="Lejer" sortKey="tenant" sort={leaseFilters.sort} onToggle={leaseFilters.toggleSort} className="px-4 py-2.5" />
              <SortableHeader label="Mdl. leje" sortKey="monthly_rent" sort={leaseFilters.sort} onToggle={leaseFilters.toggleSort} align="right" className="px-4 py-2.5" />
              <SortableHeader label="Depositum" sortKey="deposit" sort={leaseFilters.sort} onToggle={leaseFilters.toggleSort} align="right" className="px-4 py-2.5" />
              <th className="px-4 py-2.5 font-medium">Periode</th>
              <SortableHeader label="Status" sortKey="status" sort={leaseFilters.sort} onToggle={leaseFilters.toggleSort} className="px-4 py-2.5" />
              <th className="px-4 py-2.5 w-24"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">Indlæser…</td></tr>}
            {!loading && filteredLeases.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">{leases.length === 0 ? "Ingen lejemål endnu." : "Ingen lejemål matcher filtrene."}</td></tr>
            )}
            {filteredLeases.map((l) => (
              <tr key={l.id} className="hover:bg-muted/30">
                <td className="px-4 py-2.5 font-medium">{l.building_name ?? "—"}{l.unit_name ? <span className="text-xs text-muted-foreground"> · {l.unit_name}</span> : null}</td>
                <td className="px-4 py-2.5">{l.tenant_name ?? "—"}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatDKK(l.monthly_rent)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatDKK(l.deposit)}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">
                  {formatDate(l.contract_start)} – {formatDate(l.contract_end)}
                </td>
                <td className="px-4 py-2.5">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] ${STATUS_TONE[l.status]}`}>
                    {STATUS_LABEL[l.status]}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button onClick={() => setEditing(l)} className="p-1.5 rounded hover:bg-muted"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => setToDelete(l)} className="p-1.5 rounded hover:bg-muted text-red-600"><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <LeaseDialog
        open={creating || editing != null}
        editing={editing}
        buildings={buildings}
        units={units}
        tenants={tenants}
        onOpenChange={(o) => { if (!o) { setCreating(false); setEditing(null); } }}
        onSubmit={async (v) => {
          const payload = {
            building_id: v.building_id,
            unit_id: v.unit_id,
            tenant_id: v.tenant_id,
            monthly_rent: Number(v.monthly_rent) || 0,
            deposit: Number(v.deposit) || 0,
            contract_start: v.contract_start || null,
            contract_end: v.contract_end || null,
            status: v.status,
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
            qc.invalidateQueries({ queryKey: ["building-leases"] });
            qc.invalidateQueries({ queryKey: ["building-units"] });
            setCreating(false); setEditing(null);
          } catch (e) { toast.error((e as Error).message); }
        }}
      />


      <AlertDialog open={toDelete != null} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet lejemål</AlertDialogTitle>
            <AlertDialogDescription>
              Slet lejemål for "{toDelete?.building_name ?? "—"}" / "{toDelete?.tenant_name ?? "—"}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annullér</AlertDialogCancel>
            <AlertDialogAction onClick={() => toDelete && deleteMut.mutate(toDelete.id)} className="bg-red-600 hover:bg-red-700">Slet</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function LeaseDialog({
  open, editing, buildings, units, tenants, onOpenChange, onSubmit,
}: {
  open: boolean;
  editing: BuildingLease | null;
  buildings: Building[];
  units: BuildingUnit[];
  tenants: { id: string; name: string }[];
  onOpenChange: (o: boolean) => void;
  onSubmit: (v: LeaseForm) => Promise<void>;
}) {
  const [values, setValues] = useState<LeaseForm>(emptyLease);
  const [saving, setSaving] = useState(false);
  const key = `${open}-${editing?.id ?? "new"}`;
  const [lastKey, setLastKey] = useState("");
  if (open && lastKey !== key) {
    setLastKey(key);
    setValues(editing ? {
      building_id: editing.building_id,
      unit_id: editing.unit_id,
      tenant_id: editing.tenant_id,
      monthly_rent: String(editing.monthly_rent ?? ""),
      deposit: String(editing.deposit ?? ""),
      contract_start: editing.contract_start ?? "",
      contract_end: editing.contract_end ?? "",
      status: editing.status,
      notes: editing.notes ?? "",
    } : emptyLease);
  }
  const buildingUnits = values.building_id
    ? units.filter((u) => u.building_id === values.building_id)
    : [];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{editing ? "Rediger lejemål" : "Nyt lejemål"}</DialogTitle></DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            try { await onSubmit(values); } finally { setSaving(false); }
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Bygning</Label>
              <Select value={values.building_id ?? NONE} onValueChange={(v) => setValues({ ...values, building_id: v === NONE ? null : v, unit_id: null })}>
                <SelectTrigger><SelectValue placeholder="Vælg…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— Ingen —</SelectItem>
                  {buildings.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Lejer</Label>
              <Select value={values.tenant_id ?? NONE} onValueChange={(v) => setValues({ ...values, tenant_id: v === NONE ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Vælg…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— Ingen —</SelectItem>
                  {tenants.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {buildingUnits.length > 0 && (
            <div className="space-y-1.5">
              <Label>Enhed</Label>
              <Select value={values.unit_id ?? NONE} onValueChange={(v) => setValues({ ...values, unit_id: v === NONE ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Vælg enhed eller hele bygningen…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— Hele bygningen —</SelectItem>
                  {buildingUnits.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="mr">Mdl. leje (kr)</Label>
              <Input id="mr" type="number" min="0" step="1" value={values.monthly_rent}
                onChange={(e) => setValues({ ...values, monthly_rent: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dep">Depositum (kr)</Label>
              <Input id="dep" type="number" min="0" step="1" value={values.deposit}
                onChange={(e) => setValues({ ...values, deposit: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ls">Start</Label>
              <Input id="ls" type="date" value={values.contract_start}
                onChange={(e) => setValues({ ...values, contract_start: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="le">Slut</Label>
              <Input id="le" type="date" value={values.contract_end}
                onChange={(e) => setValues({ ...values, contract_end: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={values.status} onValueChange={(v) => setValues({ ...values, status: v as LeaseStatus })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LEASE_STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ln">Noter</Label>
            <Textarea id="ln" rows={3} maxLength={2000} value={values.notes}
              onChange={(e) => setValues({ ...values, notes: e.target.value })} />
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

/* ---------- Units ---------- */

type UnitForm = {
  name: string;
  description: string;
  area_m2: string;
  lease_status: UnitLeaseStatus;
  lease_status_note: string;
  estimated_monthly_rent: string;
  inherit_utilities: boolean;
  has_electricity: boolean;
  has_water: boolean;
  has_heating: boolean;
  heating_type: string;
  has_sewage: boolean;
  has_internet: boolean;
  notes: string;
};

const emptyUnit: UnitForm = {
  name: "", description: "", area_m2: "", lease_status: "ledig",
  lease_status_note: "", estimated_monthly_rent: "",
  inherit_utilities: true,
  has_electricity: false, has_water: false, has_heating: false, heating_type: "",
  has_sewage: false, has_internet: false, notes: "",
};

function UnitDialog({
  open, editing, building, onOpenChange, onSaved,
}: {
  open: boolean;
  editing: BuildingUnit | null;
  building: Building | null;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const create = useServerFn(createBuildingUnit);
  const update = useServerFn(updateBuildingUnit);
  const remove = useServerFn(deleteBuildingUnit);
  const [v, setV] = useState<UnitForm>(emptyUnit);
  const [saving, setSaving] = useState(false);
  const key = `${open}-${editing?.id ?? "new"}-${building?.id ?? "-"}`;
  const [lastKey, setLastKey] = useState("");
  if (open && lastKey !== key) {
    setLastKey(key);
    setV(editing ? {
      name: editing.name,
      description: editing.description ?? "",
      area_m2: editing.area_m2 != null ? String(editing.area_m2) : "",
      lease_status: editing.lease_status,
      lease_status_note: editing.lease_status_note ?? "",
      estimated_monthly_rent: editing.estimated_monthly_rent != null ? String(editing.estimated_monthly_rent) : "",
      inherit_utilities: editing.has_electricity == null && editing.has_water == null && editing.has_heating == null && editing.has_sewage == null && editing.has_internet == null,
      has_electricity: !!editing.has_electricity,
      has_water: !!editing.has_water,
      has_heating: !!editing.has_heating,
      heating_type: editing.heating_type ?? "",
      has_sewage: !!editing.has_sewage,
      has_internet: !!editing.has_internet,
      notes: editing.notes ?? "",
    } : emptyUnit);
  }

  const showLeaseNote = v.lease_status === "ikke_klar" || v.lease_status === "udlejes_ikke";
  const buildingId = editing?.building_id ?? building?.id ?? null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!v.name.trim() || !buildingId) return;
    setSaving(true);
    try {
      const payload = {
        building_id: buildingId,
        name: v.name.trim(),
        description: v.description.trim() || null,
        area_m2: v.area_m2 ? Number(v.area_m2) : null,
        lease_status: v.lease_status,
        lease_status_note: showLeaseNote ? (v.lease_status_note.trim() || null) : null,
        estimated_monthly_rent: v.estimated_monthly_rent ? Number(v.estimated_monthly_rent) : null,
        has_electricity: v.inherit_utilities ? null : v.has_electricity,
        has_water: v.inherit_utilities ? null : v.has_water,
        has_heating: v.inherit_utilities ? null : v.has_heating,
        heating_type: v.inherit_utilities || !v.has_heating ? null : (v.heating_type || null),
        has_sewage: v.inherit_utilities ? null : v.has_sewage,
        has_internet: v.inherit_utilities ? null : v.has_internet,
        notes: v.notes.trim() || null,
      };
      if (editing) {
        await update({ data: { id: editing.id, ...payload } });
        toast.success("Enhed opdateret");
      } else {
        await create({ data: payload });
        toast.success("Enhed oprettet");
      }
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editing) return;
    try {
      await remove({ data: { id: editing.id } });
      toast.success("Enhed slettet");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const title = editing
    ? `Rediger enhed — ${editing.name}`
    : building ? `Ny enhed på ${building.name}` : "Ny enhed";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <section className="space-y-3">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Generelt</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="un">Navn *</Label>
                <Input id="un" required maxLength={200} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ua">Areal (m²)</Label>
                <Input id="ua" type="number" min={0} value={v.area_m2} onChange={(e) => setV({ ...v, area_m2: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ud">Beskrivelse</Label>
              <Textarea id="ud" rows={2} maxLength={2000} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Udlejning</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={v.lease_status} onValueChange={(x) => setV({ ...v, lease_status: x as UnitLeaseStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNIT_LEASE_STATUSES.map((s) => <SelectItem key={s} value={s}>{UNIT_LEASE_STATUS_LABEL[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="uemr">Est. mdl. leje (kr)</Label>
                <Input id="uemr" type="number" min={0} value={v.estimated_monthly_rent}
                  onChange={(e) => setV({ ...v, estimated_monthly_rent: e.target.value })} />
              </div>
            </div>
            {showLeaseNote && (
              <div className="space-y-1.5">
                <Label htmlFor="ulsn">Årsag / note</Label>
                <Input id="ulsn" maxLength={2000} value={v.lease_status_note}
                  onChange={(e) => setV({ ...v, lease_status_note: e.target.value })} />
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Forsyning</h3>
            <ToggleRow label="Arv fra bygning" checked={v.inherit_utilities} onChange={(x) => setV({ ...v, inherit_utilities: x })} />
            {!v.inherit_utilities && (
              <div className="grid grid-cols-2 gap-3">
                <ToggleRow label="El" checked={v.has_electricity} onChange={(x) => setV({ ...v, has_electricity: x })} />
                <ToggleRow label="Vand" checked={v.has_water} onChange={(x) => setV({ ...v, has_water: x })} />
                <ToggleRow label="Varme" checked={v.has_heating} onChange={(x) => setV({ ...v, has_heating: x })} />
                <ToggleRow label="Kloak" checked={v.has_sewage} onChange={(x) => setV({ ...v, has_sewage: x })} />
                <ToggleRow label="Internet" checked={v.has_internet} onChange={(x) => setV({ ...v, has_internet: x })} />
              </div>
            )}
          </section>

          <section className="space-y-1.5">
            <Label htmlFor="unotes">Noter</Label>
            <Textarea id="unotes" rows={3} maxLength={4000} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} />
          </section>

          <DialogFooter>
            {editing && (
              <Button type="button" variant="outline" className="mr-auto text-red-600" onClick={handleDelete}>
                <Trash2 className="h-4 w-4 mr-1" /> Slet enhed
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annullér</Button>
            <Button type="submit" disabled={saving}>{saving ? "Gemmer…" : "Gem"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

