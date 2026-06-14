import { useQuery } from "@tanstack/react-query";
import { geometryAreaHa } from "@/lib/geo-area";


export type UseType = "omdrift" | "skov" | "gaard";

type Leaseholder = { name?: string | null; phone?: string | null; email?: string | null };
type Lease = {
  annual_fee?: number | null;
  price_per_ha?: number | null;
  area_ha?: number | null;
  contract_start?: string | null;
  contract_end?: string | null;
  leaseholder?: Leaseholder | null;
};
type Field = {
  id: string;
  name: string;
  use_type: UseType | null;
  notes: string | null;
  lease_area_ha: number | null;
  lease_price_per_ha: number | null;
  soil_type: string | null;
  is_drained: boolean | null;
  has_irrigation: boolean | null;
  eligible_area_ha: number | null;
  non_eligible_area_ha: number | null;
  geometry?: unknown;
};

type Parcel = {
  id: string;
  matrikel_id: string;
  ejerlav: string;
  use_type: UseType | null;
  net_area_ha: number | null;
  field_area_ha: number | null;
  notes: string | null;
  field_id?: string | null;
  field?: Field | null;
  land_leases?: Lease | null;
};

type Feature = {
  type: "Feature";
  properties: {
    matrikelnr?: string;
    ejerlavsnavn?: string;
    registreretAreal?: number;
    parcel: Parcel | null;
  };
  geometry: unknown;
};

export type FieldRow = {
  id: string;
  name: string;
  use_type: UseType | null;
  notes: string | null;
  matrikler: string[];
  parcels: { id: string; matrikelnr: string }[];
  totalHa: number;
  leaseholder: string | null;
  contractEnd: string | null;
  annualFee: number | null;
  lease_area_ha: number | null;
  lease_price_per_ha: number | null;
  soil_type: string | null;
  is_drained: boolean | null;
  has_irrigation: boolean | null;
  eligible_area_ha: number | null;
  non_eligible_area_ha: number | null;
  mapAreaHa: number | null;
};


export type MatrikelRow = {
  parcelId: string;
  matrikelnr: string;
  ejerlav: string;
  use_type: UseType | null;
  registreretAreaHa: number | null;
  netAreaHa: number | null;
  fieldAreaHa: number | null;
  fieldId: string | null;
  fieldName: string | null;
  fieldNames: string[];
  notes: string | null;
};

type AllFieldRow = {
  id: string;
  name: string;
  use_type: UseType | null;
  notes: string | null;
  lease_area_ha: number | null;
  lease_price_per_ha: number | null;
  soil_type: string | null;
  is_drained: boolean | null;
  has_irrigation: boolean | null;
  eligible_area_ha: number | null;
  non_eligible_area_ha: number | null;
  geometry?: unknown;
};


async function fetchMatrikel(): Promise<{ fields: FieldRow[]; matrikler: MatrikelRow[] }> {
  const r = await fetch("/api/matrikel");
  if (!r.ok) throw new Error(`Kunne ikke hente matrikeldata (HTTP ${r.status})`);
  const gj = (await r.json()) as { features: Feature[]; allFields?: AllFieldRow[] };

  const byField = new Map<string, Feature[]>();
  const matrikelByKey = new Map<string, MatrikelRow>();

  for (const f of gj.features ?? []) {
    const p = f.properties.parcel;
    if (!p) continue;
    if (p.field_id) {
      const arr = byField.get(p.field_id) ?? [];
      arr.push(f);
      byField.set(p.field_id, arr);
    }
    const key = `${p.matrikel_id}__${p.ejerlav}`;
    const existing = matrikelByKey.get(key);
    const fieldName = p.field?.name ?? null;
    const regHa =
      f.properties.registreretAreal != null
        ? Number((f.properties.registreretAreal / 10000).toFixed(2))
        : null;
    if (!existing) {
      matrikelByKey.set(key, {
        parcelId: p.id,
        matrikelnr: p.matrikel_id,
        ejerlav: p.ejerlav,
        use_type: p.use_type,
        registreretAreaHa: regHa,
        netAreaHa: p.net_area_ha,
        fieldAreaHa: p.field_area_ha,
        fieldId: p.field_id ?? null,
        fieldName,
        fieldNames: fieldName ? [fieldName] : [],
        notes: p.notes,
      });
    } else {
      if (fieldName && !existing.fieldNames.includes(fieldName)) {
        existing.fieldNames.push(fieldName);
      }
      existing.fieldAreaHa = (existing.fieldAreaHa ?? 0) + (p.field_area_ha ?? 0);
    }
  }
  const matrikler: MatrikelRow[] = Array.from(matrikelByKey.values());

  const fields: FieldRow[] = [];
  byField.forEach((features, fieldId) => {
    const fieldMeta = features[0].properties.parcel?.field;
    if (!fieldMeta) return;
    const totalHa = features.reduce(
      (s, f) =>
        s +
        (f.properties.parcel?.field_area_ha ??
          f.properties.parcel?.net_area_ha ??
          (f.properties.registreretAreal ? f.properties.registreretAreal / 10000 : 0)),
      0,
    );
    const lease =
      features.find((m) => m.properties.parcel?.land_leases)?.properties.parcel?.land_leases ??
      null;
    fields.push({
      id: fieldId,
      name: fieldMeta.name,
      use_type: fieldMeta.use_type,
      notes: fieldMeta.notes,
      matrikler: features.map((m) => m.properties.matrikelnr ?? "?"),
      parcels: features
        .map((m) => ({
          id: m.properties.parcel?.id ?? "",
          matrikelnr: m.properties.matrikelnr ?? "?",
        }))
        .filter((p) => p.id),
      totalHa: Number(totalHa.toFixed(2)),
      leaseholder: lease?.leaseholder?.name ?? null,
      contractEnd: lease?.contract_end ?? null,
      annualFee: lease?.annual_fee ?? null,
      lease_area_ha: fieldMeta.lease_area_ha ?? null,
      lease_price_per_ha: fieldMeta.lease_price_per_ha ?? null,
      soil_type: fieldMeta.soil_type ?? null,
      is_drained: fieldMeta.is_drained ?? null,
      has_irrigation: fieldMeta.has_irrigation ?? null,
      eligible_area_ha: fieldMeta.eligible_area_ha ?? null,
      non_eligible_area_ha: fieldMeta.non_eligible_area_ha ?? null,
      mapAreaHa:
        geometryAreaHa(fieldMeta.geometry) ??
        (() => {
          // Fallback: sum the linked parcels' geometry (custom or original matrikelpolygon)
          let sum = 0;
          let any = false;
          for (const feat of features) {
            const a = geometryAreaHa(feat.geometry);
            if (a != null) { sum += a; any = true; }
          }
          return any ? Number(sum.toFixed(2)) : null;
        })(),


    });
  });

  // Add any orphan fields (no parcel link) so they still appear in the UI
  const seen = new Set(fields.map((f) => f.id));
  for (const af of gj.allFields ?? []) {
    if (seen.has(af.id)) continue;
    fields.push({
      id: af.id,
      name: af.name,
      use_type: af.use_type,
      notes: af.notes,
      matrikler: [],
      parcels: [],
      totalHa: 0,
      leaseholder: null,
      contractEnd: null,
      annualFee: null,
      lease_area_ha: af.lease_area_ha,
      lease_price_per_ha: af.lease_price_per_ha,
      soil_type: af.soil_type,
      is_drained: af.is_drained,
      has_irrigation: af.has_irrigation,
      eligible_area_ha: af.eligible_area_ha,
      non_eligible_area_ha: af.non_eligible_area_ha,
      mapAreaHa: geometryAreaHa(af.geometry),

    });
  }

  fields.sort((a, b) => a.name.localeCompare(b.name, "da"));
  matrikler.sort((a, b) => a.matrikelnr.localeCompare(b.matrikelnr, "da", { numeric: true }));
  return { fields, matrikler };
}

export function useMatrikelData() {
  return useQuery({
    queryKey: ["matrikel-data"],
    queryFn: fetchMatrikel,
    staleTime: 60_000,
  });
}

export const USE_TYPE_COLORS: Record<UseType, string> = {
  omdrift: "#1D9E75",
  skov: "#085041",
  gaard: "#378ADD",
};
export const USE_TYPE_LABELS: Record<UseType, string> = {
  omdrift: "Omdriftsjord",
  skov: "Skov / natur",
  gaard: "Gårdsareal",
};
