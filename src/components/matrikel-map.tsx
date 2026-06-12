import { useEffect, useRef, useState } from "react";
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
type Parcel = {
  id: string;
  matrikel_id: string;
  ejerlav: string;
  use_type: UseType | null;
  net_area_ha: number | null;
  notes: string | null;
  land_leases?: Lease | null;
};
type FeatureProps = {
  matrikelnr?: string;
  ejerlavsnavn?: string;
  registreretAreal?: number;
  parcel: Parcel | null;
};

export function MatrikelMap() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const [selected, setSelected] = useState<FeatureProps | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;

    const map = L.map(mapRef.current, { zoomControl: true }).setView(
      [56.7115, 8.92],
      14,
    );
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
        setLoading(false);
        let activeLayer: L.Path | null = null;

        const layer = L.geoJSON(geojson, {
          style: (feature) => {
            const useType = (feature?.properties?.parcel?.use_type ?? null) as UseType | null;
            const color = useType ? USE_TYPE_COLORS[useType] : "#888";
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
            const ha = p.parcel?.net_area_ha ? `${p.parcel.net_area_ha} ha` : "—";
            lyr.bindTooltip(`Matr. ${p.matrikelnr ?? "?"} · ${ha}`, { sticky: true });
            lyr.on("click", () => {
              if (activeLayer) {
                activeLayer.setStyle({ fillOpacity: 0.35, weight: 2 });
              }
              const path = lyr as L.Path;
              path.setStyle({ fillOpacity: 0.6, weight: 3 });
              activeLayer = path;
              setSelected(p);
            });
          },
        }).addTo(map);

        try {
          const bounds = layer.getBounds();
          if (bounds.isValid()) map.fitBounds(bounds, { padding: [20, 20] });
        } catch {
          /* ignore */
        }
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
        setError("Kunne ikke hente matrikeldata fra Datafordeler.");
      });

    return () => {
      map.remove();
      leafletMap.current = null;
    };
  }, []);

  return (
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

      {selected && (
        <div className="absolute bottom-3 left-3 right-3 z-[450] md:right-auto md:w-96 rounded-lg bg-background border border-border shadow-lg p-4">
          <div className="flex items-start gap-3">
            <div
              className="shrink-0 w-10 h-10 rounded-md flex items-center justify-center text-white text-sm font-medium"
              style={{
                background: selected.parcel?.use_type
                  ? USE_TYPE_COLORS[selected.parcel.use_type]
                  : "#888",
              }}
            >
              {selected.matrikelnr ?? "?"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">
                Matr. {selected.matrikelnr} · {selected.ejerlavsnavn ?? "Harre By, Harre"}
              </div>
              <div className="text-xs text-muted-foreground">
                {selected.parcel?.use_type
                  ? USE_TYPE_LABELS[selected.parcel.use_type]
                  : "Ikke registreret"}
              </div>
            </div>
            <button
              onClick={() => setSelected(null)}
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
                selected.registreretAreal != null
                  ? `${(selected.registreretAreal / 10000).toFixed(2)} ha`
                  : "—"
              }
            />
            <MetricCard
              label="Areal (netto)"
              value={
                selected.parcel?.net_area_ha != null
                  ? `${selected.parcel.net_area_ha} ha`
                  : "—"
              }
            />
            {selected.parcel?.use_type === "omdrift" && selected.parcel.land_leases && (
              <>
                <MetricCard
                  label="Forpagter"
                  value={selected.parcel.land_leases.leaseholder?.name ?? "—"}
                />
                <MetricCard
                  label="Årlig leje"
                  value={
                    selected.parcel.land_leases.annual_fee != null
                      ? formatDKK(selected.parcel.land_leases.annual_fee)
                      : "—"
                  }
                />
                <MetricCard
                  label="Kontrakt slut"
                  value={formatDate(selected.parcel.land_leases.contract_end) ?? "—"}
                />
              </>
            )}
          </div>

          {selected.parcel?.notes && (
            <p className="mt-3 text-xs text-muted-foreground whitespace-pre-wrap">
              {selected.parcel.notes}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/40 px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium truncate">{value}</div>
    </div>
  );
}
