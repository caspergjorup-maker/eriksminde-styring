import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { formatDKK, formatDate } from "@/lib/format";

type UseType = "omdrift" | "skov" | "gaard";

const USE_TYPE_COLORS: Record<UseType, string> = {
  omdrift: "#1D9E75",
  skov: "#085041",
  gaard: "#378ADD",
};

const USE_TYPE_LABELS: Record<UseType, string> = {
  omdrift: "Omdriftsjord",
  skov: "Skov / natur",
  gaard: "Gårdsareal",
};

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
};
type Parcel = {
  id: string;
  matrikel_id: string;
  ejerlav: string;
  use_type: UseType | null;
  net_area_ha: number | null;
  notes: string | null;
  field_id?: string | null;
  field?: Field | null;
  land_leases?: Lease | null;
};
type FeatureProps = {
  matrikelnr?: string;
  ejerlavsnavn?: string;
  registreretAreal?: number;
  parcel: Parcel | null;
};

export type FieldSummary = {
  id: string;
  name: string;
  use_type: UseType | null;
  notes: string | null;
  matrikler: string[];
  totalHa: number;
  leaseholder: string | null;
  contractEnd: string | null;
  annualFee: number | null;
};

export type MatrikelMapHandle = {
  highlightField: (fieldId: string) => void;
};

type Props = {
  onFieldsReady?: (fields: FieldSummary[]) => void;
};

export const MatrikelMap = forwardRef<MatrikelMapHandle, Props>(function MatrikelMap(
  { onFieldsReady },
  ref,
) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const layersByFeature = useRef<Map<L.Layer, FeatureProps>>(new Map());
  const allLayers = useRef<L.Path[]>([]);
  const featuresRef = useRef<FeatureProps[]>([]);
  const viewModeRef = useRef<"fields" | "parcels">("fields");

  const [viewMode, setViewMode] = useState<"fields" | "parcels">("fields");
  const [selectedParcel, setSelectedParcel] = useState<FeatureProps | null>(null);
  const [selectedField, setSelectedField] = useState<FieldSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const colorFor = (p: Parcel | null | undefined) => {
    if (!p) return "#888";
    if (viewModeRef.current === "fields") {
      return (
        (p.field?.use_type && USE_TYPE_COLORS[p.field.use_type]) ||
        (p.use_type && USE_TYPE_COLORS[p.use_type]) ||
        "#aaa"
      );
    }
    return (p.use_type && USE_TYPE_COLORS[p.use_type]) || "#888";
  };

  const resetStyles = () => {
    allLayers.current.forEach((lyr) => {
      const props = layersByFeature.current.get(lyr) ?? null;
      lyr.setStyle({
        color: colorFor(props?.parcel),
        fillColor: colorFor(props?.parcel),
        fillOpacity: 0.35,
        weight: 2,
        opacity: 0.9,
      });
    });
  };

  const buildFieldSummary = (fieldId: string): FieldSummary | null => {
    const matches = featuresRef.current.filter((f) => f.parcel?.field_id === fieldId);
    if (matches.length === 0) return null;
    const field = matches[0].parcel?.field ?? null;
    if (!field) return null;
    const totalHa = matches.reduce((s, f) => s + (f.parcel?.net_area_ha ?? 0), 0);
    const lease = matches.find((m) => m.parcel?.land_leases)?.parcel?.land_leases ?? null;
    return {
      id: field.id,
      name: field.name,
      use_type: field.use_type,
      notes: field.notes,
      matrikler: matches.map((m) => m.matrikelnr ?? "?"),
      totalHa: Number(totalHa.toFixed(2)),
      leaseholder: lease?.leaseholder?.name ?? null,
      contractEnd: lease?.contract_end ?? null,
      annualFee: lease?.annual_fee ?? null,
    };
  };

  const highlightField = (fieldId: string) => {
    resetStyles();
    allLayers.current.forEach((lyr) => {
      const props = layersByFeature.current.get(lyr);
      if (props?.parcel?.field_id === fieldId) {
        lyr.setStyle({ fillOpacity: 0.62, weight: 3 });
      }
    });
    const summary = buildFieldSummary(fieldId);
    if (summary) setSelectedField(summary);
    setSelectedParcel(null);

    // Zoom to field bounds
    const group: L.Layer[] = [];
    allLayers.current.forEach((lyr) => {
      const props = layersByFeature.current.get(lyr);
      if (props?.parcel?.field_id === fieldId) group.push(lyr);
    });
    if (group.length > 0 && leafletMap.current) {
      try {
        const bounds = L.featureGroup(group as L.Layer[]).getBounds();
        if (bounds.isValid()) leafletMap.current.fitBounds(bounds, { padding: [30, 30] });
      } catch {
        /* ignore */
      }
    }
  };

  useImperativeHandle(ref, () => ({ highlightField }), []);

  useEffect(() => {
    viewModeRef.current = viewMode;
    resetStyles();
    setSelectedParcel(null);
    setSelectedField(null);
  }, [viewMode]);

  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;
    let ignored = false;

    const map = L.map(mapRef.current, { zoomControl: true }).setView([56.7115, 8.92], 14);
    leafletMap.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);

    fetch("/api/matrikel")
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((geojson) => {
        if (ignored) return;
        setLoading(false);

        const layer = L.geoJSON(geojson, {
          style: (feature) => {
            const p = (feature?.properties?.parcel ?? null) as Parcel | null;
            const color = colorFor(p);
            return {
              color,
              fillColor: color,
              fillOpacity: 0.35,
              weight: 2,
              opacity: 0.9,
            };
          },
          onEachFeature: (feature, lyr) => {
            const p = feature.properties as FeatureProps;
            featuresRef.current.push(p);
            layersByFeature.current.set(lyr, p);
            allLayers.current.push(lyr as L.Path);

            const tooltipFn = () => {
              const ha = p.parcel?.net_area_ha != null ? `${p.parcel.net_area_ha} ha` : "—";
              if (viewModeRef.current === "fields" && p.parcel?.field?.name) {
                return `${p.parcel.field.name} · Matr. ${p.matrikelnr ?? "?"}`;
              }
              return `Matr. ${p.matrikelnr ?? "?"} · ${ha}`;
            };
            lyr.bindTooltip(tooltipFn(), { sticky: true });
            lyr.on("mouseover", () => lyr.getTooltip()?.setContent(tooltipFn()));

            lyr.on("click", () => {
              if (viewModeRef.current === "fields" && p.parcel?.field_id) {
                highlightField(p.parcel.field_id);
              } else {
                resetStyles();
                (lyr as L.Path).setStyle({ fillOpacity: 0.6, weight: 3 });
                setSelectedParcel(p);
                setSelectedField(null);
              }
            });
          },
        }).addTo(map);

        try {
          const bounds = layer.getBounds();
          if (bounds.isValid()) map.fitBounds(bounds, { padding: [20, 20] });
        } catch {
          /* ignore */
        }

        // Build field summaries
        if (onFieldsReady) {
          const fieldIds = new Set<string>();
          featuresRef.current.forEach((f) => {
            if (f.parcel?.field_id) fieldIds.add(f.parcel.field_id);
          });
          const summaries: FieldSummary[] = [];
          fieldIds.forEach((id) => {
            const s = buildFieldSummary(id);
            if (s) summaries.push(s);
          });
          summaries.sort((a, b) => a.name.localeCompare(b.name, "da"));
          onFieldsReady(summaries);
        }
      })
      .catch((err) => {
        if (ignored) return;
        console.error(err);
        setLoading(false);
        setError("Kunne ikke hente matrikeldata fra Datafordeler.");
      });

    return () => {
      ignored = true;
      map.remove();
      leafletMap.current = null;
      layersByFeature.current = new Map();
      allLayers.current = [];
      featuresRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setViewMode("fields")}
          className="px-3.5 py-1.5 text-[13px] rounded-md border border-border transition-colors cursor-pointer"
          style={{
            background: viewMode === "fields" ? "#1D9E75" : "transparent",
            color: viewMode === "fields" ? "#fff" : "var(--muted-foreground)",
          }}
        >
          Marker
        </button>
        <button
          onClick={() => setViewMode("parcels")}
          className="px-3.5 py-1.5 text-[13px] rounded-md border border-border transition-colors cursor-pointer"
          style={{
            background: viewMode === "parcels" ? "#1D9E75" : "transparent",
            color: viewMode === "parcels" ? "#fff" : "var(--muted-foreground)",
          }}
        >
          Matrikler
        </button>
      </div>

      <div className="relative w-full h-[70vh] rounded-lg overflow-hidden border border-border bg-muted">
        <div ref={mapRef} className="absolute inset-0" />

        {/* Legende */}
        <div className="absolute top-3 right-3 z-[400] rounded-md bg-background/95 backdrop-blur p-3 shadow-sm border border-border text-xs space-y-1.5">
          {(Object.entries(USE_TYPE_LABELS) as [UseType, string][]).map(([key, label]) => (
            <div key={key} className="flex items-center gap-2">
              <span
                className="inline-block w-3 h-3 rounded-sm"
                style={{ background: USE_TYPE_COLORS[key] }}
              />
              <span>{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-sm bg-[#888]" />
            <span>Ikke registreret</span>
          </div>
        </div>

        {loading && (
          <div className="absolute inset-0 z-[500] flex items-center justify-center bg-background/60 text-sm text-muted-foreground">
            Henter matrikeldata…
          </div>
        )}
        {error && (
          <div className="absolute top-3 left-3 z-[500] rounded-md bg-destructive/10 text-destructive border border-destructive/30 px-3 py-2 text-xs max-w-xs">
            {error}
          </div>
        )}

        {selectedField && (
          <div className="absolute bottom-3 left-3 right-3 z-[450] md:right-auto md:w-96 rounded-lg bg-background border border-border shadow-lg p-4">
            <div className="flex items-start gap-3">
              <div
                className="shrink-0 w-10 h-10 rounded-md flex items-center justify-center text-white text-xs font-medium"
                style={{
                  background: selectedField.use_type
                    ? USE_TYPE_COLORS[selectedField.use_type]
                    : "#888",
                }}
              >
                {selectedField.name.slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{selectedField.name}</div>
                <div className="text-xs text-muted-foreground">
                  {selectedField.use_type ? USE_TYPE_LABELS[selectedField.use_type] : "Ikke registreret"}
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedField(null);
                  resetStyles();
                }}
                className="text-muted-foreground hover:text-foreground text-sm leading-none"
                aria-label="Luk"
              >
                ✕
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <MetricCard label="Samlet areal" value={`${selectedField.totalHa} ha`} />
              <MetricCard label="Matrikler" value={selectedField.matrikler.join(", ")} />
              <MetricCard label="Forpagter" value={selectedField.leaseholder ?? "—"} />
              <MetricCard
                label="Årlig leje"
                value={selectedField.annualFee != null ? formatDKK(selectedField.annualFee) : "—"}
              />
              <MetricCard
                label="Kontrakt slut"
                value={formatDate(selectedField.contractEnd) ?? "—"}
              />
            </div>
            {selectedField.notes && (
              <p className="mt-3 text-xs text-muted-foreground whitespace-pre-wrap">
                {selectedField.notes}
              </p>
            )}
          </div>
        )}

        {selectedParcel && (
          <div className="absolute bottom-3 left-3 right-3 z-[450] md:right-auto md:w-96 rounded-lg bg-background border border-border shadow-lg p-4">
            <div className="flex items-start gap-3">
              <div
                className="shrink-0 w-10 h-10 rounded-md flex items-center justify-center text-white text-sm font-medium"
                style={{
                  background: selectedParcel.parcel?.use_type
                    ? USE_TYPE_COLORS[selectedParcel.parcel.use_type]
                    : "#888",
                }}
              >
                {selectedParcel.matrikelnr ?? "?"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">
                  Matr. {selectedParcel.matrikelnr} ·{" "}
                  {selectedParcel.ejerlavsnavn ?? "Harre By, Harre"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {selectedParcel.parcel?.use_type
                    ? USE_TYPE_LABELS[selectedParcel.parcel.use_type]
                    : "Ikke registreret"}
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedParcel(null);
                  resetStyles();
                }}
                className="text-muted-foreground hover:text-foreground text-sm leading-none"
                aria-label="Luk"
              >
                ✕
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <MetricCard
                label="Areal (registreret)"
                value={
                  selectedParcel.registreretAreal != null
                    ? `${(selectedParcel.registreretAreal / 10000).toFixed(2)} ha`
                    : "—"
                }
              />
              <MetricCard
                label="Areal (netto)"
                value={
                  selectedParcel.parcel?.net_area_ha != null
                    ? `${selectedParcel.parcel.net_area_ha} ha`
                    : "—"
                }
              />
              {selectedParcel.parcel?.field?.name && (
                <MetricCard label="Mark" value={selectedParcel.parcel.field.name} />
              )}
              {selectedParcel.parcel?.use_type === "omdrift" &&
                selectedParcel.parcel.land_leases && (
                  <>
                    <MetricCard
                      label="Forpagter"
                      value={selectedParcel.parcel.land_leases.leaseholder?.name ?? "—"}
                    />
                    <MetricCard
                      label="Årlig leje"
                      value={
                        selectedParcel.parcel.land_leases.annual_fee != null
                          ? formatDKK(selectedParcel.parcel.land_leases.annual_fee)
                          : "—"
                      }
                    />
                    <MetricCard
                      label="Kontrakt slut"
                      value={formatDate(selectedParcel.parcel.land_leases.contract_end) ?? "—"}
                    />
                  </>
                )}
            </div>

            {selectedParcel.parcel?.notes && (
              <p className="mt-3 text-xs text-muted-foreground whitespace-pre-wrap">
                {selectedParcel.parcel.notes}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/40 px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium truncate">{value}</div>
    </div>
  );
}

export { USE_TYPE_COLORS, USE_TYPE_LABELS };
