import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw";
import "leaflet-draw/dist/leaflet.draw.css";
import { useServerFn } from "@tanstack/react-start";
import union from "@turf/union";
import bbox from "@turf/bbox";
import bboxClip from "@turf/bbox-clip";
import { featureCollection } from "@turf/helpers";
import type { Feature, Polygon, MultiPolygon } from "geojson";

import { formatDKK, formatDate } from "@/lib/format";
import { saveFieldGeometry, createField } from "@/lib/fields-geometry.functions";


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
  lease_area_ha: number | null;
  lease_price_per_ha: number | null;
  soil_type: string | null;
  is_drained: boolean | null;
  has_irrigation: boolean | null;
  eligible_area_ha: number | null;
  non_eligible_area_ha: number | null;
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
};


export type MatrikelMapHandle = {
  highlightField: (fieldId: string) => void;
  startDrawField: (fieldId: string) => void;
};

type Props = {
  onFieldsReady?: (fields: FieldSummary[]) => void;
};

type ParcelFeature = Feature<Polygon | MultiPolygon, FeatureProps>;
type FieldFeature = Feature<Polygon | MultiPolygon, { field: FieldSummary }>;

export const MatrikelMap = forwardRef<MatrikelMapHandle, Props>(function MatrikelMap(
  { onFieldsReady },
  ref,
) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const parcelLayer = useRef<L.GeoJSON | null>(null);
  const fieldLayer = useRef<L.GeoJSON | null>(null);
  const fieldLayersById = useRef<Map<string, L.Path>>(new Map());
  const parcelLayers = useRef<L.Path[]>([]);
  const rawGeojson = useRef<{ type: "FeatureCollection"; features: ParcelFeature[] } | null>(null);
  const drawFeatureGroup = useRef<L.FeatureGroup | null>(null);
  const activeDrawHandler = useRef<{ disable: () => void } | null>(null);
  const backdropLayer = useRef<L.GeoJSON | null>(null);

  const [viewMode, setViewMode] = useState<"fields" | "parcels">("fields");
  const [selectedParcel, setSelectedParcel] = useState<FeatureProps | null>(null);
  const [selectedField, setSelectedField] = useState<FieldSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<{ id: string | null; name: string; parcelId?: string | null }  | null>(null);
  const [drawnGeometry, setDrawnGeometry] = useState<Polygon | MultiPolygon | null>(null);
  const [saving, setSaving] = useState(false);
  const saveGeometryFn = useServerFn(saveFieldGeometry);
  const createFieldFn = useServerFn(createField);


  const resetParcelStyles = () => {
    parcelLayers.current.forEach((lyr) => {
      const feature = (lyr as unknown as { feature?: ParcelFeature }).feature;
      const color = feature?.properties.parcel?.use_type
        ? USE_TYPE_COLORS[feature.properties.parcel.use_type]
        : "#888";
      lyr.setStyle({ color, fillColor: color, fillOpacity: 0.35, weight: 2, opacity: 0.9 });
    });
  };

  const resetFieldStyles = () => {
    fieldLayersById.current.forEach((lyr) => {
      const feature = (lyr as unknown as { feature?: FieldFeature }).feature;
      const ut = feature?.properties.field.use_type;
      const color = ut ? USE_TYPE_COLORS[ut] : "#aaa";
      lyr.setStyle({ color, fillColor: color, fillOpacity: 0.35, weight: 2, opacity: 0.9 });
    });
  };

  const highlightField = (fieldId: string) => {
    if (viewMode !== "fields") setViewMode("fields");
    resetFieldStyles();
    const lyr = fieldLayersById.current.get(fieldId);
    if (lyr) {
      lyr.setStyle({ fillOpacity: 0.62, weight: 3 });
      const feature = (lyr as unknown as { feature?: FieldFeature }).feature;
      if (feature) setSelectedField(feature.properties.field);
      try {
        const bounds = (lyr as unknown as L.Polygon).getBounds();
        if (bounds.isValid() && leafletMap.current)
          leafletMap.current.fitBounds(bounds, { padding: [30, 30] });
      } catch {
        /* ignore */
      }
    }
    setSelectedParcel(null);
  };

  useImperativeHandle(ref, () => ({ highlightField, startDrawField }));

  // Swap layers when viewMode changes
  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return;
    if (viewMode === "fields") {
      if (parcelLayer.current && map.hasLayer(parcelLayer.current)) map.removeLayer(parcelLayer.current);
      if (fieldLayer.current && !map.hasLayer(fieldLayer.current)) fieldLayer.current.addTo(map);
      resetFieldStyles();
      setSelectedParcel(null);
    } else {
      if (fieldLayer.current && map.hasLayer(fieldLayer.current)) map.removeLayer(fieldLayer.current);
      if (parcelLayer.current && !map.hasLayer(parcelLayer.current)) parcelLayer.current.addTo(map);
      resetParcelStyles();
      setSelectedField(null);
    }
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
      .then((geojson: { type: "FeatureCollection"; features: ParcelFeature[]; allFields?: Array<{ id: string; name: string; use_type: UseType | null; geometry: Polygon | MultiPolygon | null; lease_area_ha: number | null; lease_price_per_ha: number | null; soil_type: string | null; is_drained: boolean | null; has_irrigation: boolean | null; eligible_area_ha: number | null; non_eligible_area_ha: number | null; notes: string | null }> }) => {
        if (ignored) return;
        rawGeojson.current = geojson;
        setLoading(false);

        // Detect split matrikler (same matrikelnr appearing in multiple fields)
        // and slice their geometry proportionally along the N/S axis.
        const byMatrikel = new Map<string, ParcelFeature[]>();
        for (const f of geojson.features) {
          const mnr = f.properties.matrikelnr ?? "?";
          const arr = byMatrikel.get(mnr) ?? [];
          arr.push(f);
          byMatrikel.set(mnr, arr);
        }

        const slicedFeatures: ParcelFeature[] = [];
        byMatrikel.forEach((feats) => {
          if (feats.length <= 1) {
            slicedFeatures.push(...feats);
            return;
          }
          // If any parcel in this matrikel has its own drawn geometry, skip the
          // bbox-slice fallback — trust the geometry the API emitted per parcel.
          const hasCustom = feats.some(
            (f) => (f.properties.parcel as { custom_geometry?: unknown } | null)?.custom_geometry,
          );
          if (hasCustom) {
            slicedFeatures.push(...feats);
            return;
          }
          // bbox of the full matrikel
          const [minX, minY, maxX, maxY] = bbox(feats[0] as Feature<Polygon | MultiPolygon>);
          const totalArea = feats.reduce(
            (s, f) => s + (f.properties.parcel?.field_area_ha ?? 0),
            0,
          );
          // Sort: Syd (south) first → lowest latitude band
          const ordered = [...feats].sort((a, b) => {
            const an = a.properties.parcel?.field?.name?.toLowerCase() ?? "";
            const bn = b.properties.parcel?.field?.name?.toLowerCase() ?? "";
            const aSyd = an.includes("syd") ? 0 : an.includes("nord") ? 2 : 1;
            const bSyd = bn.includes("syd") ? 0 : bn.includes("nord") ? 2 : 1;
            return aSyd - bSyd;
          });
          let cursorY = minY;
          for (const f of ordered) {
            const share = totalArea > 0 ? (f.properties.parcel?.field_area_ha ?? 0) / totalArea : 1 / ordered.length;
            const sliceTop = cursorY + (maxY - minY) * share;
            const clipped = bboxClip(
              f as Feature<Polygon | MultiPolygon>,
              [minX, cursorY, maxX, sliceTop],
            ) as Feature<Polygon | MultiPolygon>;
            cursorY = sliceTop;
            slicedFeatures.push({
              ...f,
              geometry: clipped.geometry,
            });
          }
        });


        // Group sliced features by field_id and union per group
        const byField = new Map<string, ParcelFeature[]>();
        const ungrouped: ParcelFeature[] = [];
        for (const f of slicedFeatures) {
          const fid = f.properties.parcel?.field_id;
          if (fid) {
            const arr = byField.get(fid) ?? [];
            arr.push(f);
            byField.set(fid, arr);
          } else {
            ungrouped.push(f);
          }
        }

        const fieldFeatures: FieldFeature[] = [];
        const summaries: FieldSummary[] = [];

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
            features.find((m) => m.properties.parcel?.land_leases)?.properties.parcel
              ?.land_leases ?? null;
          const summary: FieldSummary = {
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
          };
          summaries.push(summary);

          let merged: Feature<Polygon | MultiPolygon> | null;
          // Prefer the field's own saved geometry over a union of parcel shapes
          const savedGeom = (features[0].properties.parcel?.field as { geometry?: Polygon | MultiPolygon } | undefined)?.geometry;
          if (savedGeom && (savedGeom.type === "Polygon" || savedGeom.type === "MultiPolygon")) {
            merged = { type: "Feature", geometry: savedGeom, properties: {} };
          } else if (features.length === 1) {
            merged = {
              type: "Feature",
              geometry: features[0].geometry,
              properties: {},
            };
          } else {
            try {
              const fc = featureCollection(
                features.map((f) => ({
                  type: "Feature" as const,
                  geometry: f.geometry,
                  properties: {},
                })),
              );
              merged = union(fc) as Feature<Polygon | MultiPolygon> | null;
            } catch (err) {
              console.error("turf union failed for field", fieldId, err);
              merged = null;
            }
          }

          if (!merged) {
            // Fallback: build a MultiPolygon manually so disjoint or
            // union-incompatible geometries still render.
            const polys: number[][][][] = [];
            for (const f of features) {
              const g = f.geometry as Polygon | MultiPolygon;
              if (g.type === "Polygon") polys.push(g.coordinates);
              else if (g.type === "MultiPolygon") polys.push(...g.coordinates);
            }
            if (polys.length === 0) return;
            merged = {
              type: "Feature",
              geometry: { type: "MultiPolygon", coordinates: polys },
              properties: {},
            };
          }
          fieldFeatures.push({
            type: "Feature",
            geometry: merged.geometry,
            properties: { field: summary },
          });
        });

        // Add orphan fields (no parcel link) that have their own geometry
        const linkedIds = new Set(summaries.map((s) => s.id));
        for (const af of geojson.allFields ?? []) {
          if (linkedIds.has(af.id)) continue;
          if (!af.geometry || (af.geometry.type !== "Polygon" && af.geometry.type !== "MultiPolygon")) continue;
          const summary: FieldSummary = {
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
          };
          summaries.push(summary);
          fieldFeatures.push({
            type: "Feature",
            geometry: af.geometry,
            properties: { field: summary },
          });
        }

        summaries.sort((a, b) => a.name.localeCompare(b.name, "da"));

        // Parcel layer (matrikler view)
        parcelLayer.current = L.geoJSON(geojson as unknown as GeoJSON.GeoJsonObject, {
          style: (feature) => {
            const p = (feature?.properties as FeatureProps | undefined)?.parcel ?? null;
            const color = p?.use_type ? USE_TYPE_COLORS[p.use_type] : "#888";
            return { color, fillColor: color, fillOpacity: 0.35, weight: 2, opacity: 0.9 };
          },
          onEachFeature: (feature, lyr) => {
            const p = feature.properties as FeatureProps;
            parcelLayers.current.push(lyr as L.Path);
            const ha = p.parcel?.net_area_ha != null ? `${p.parcel.net_area_ha} ha` : "—";
            lyr.bindTooltip(`Matr. ${p.matrikelnr ?? "?"} · ${ha}`, { sticky: true });
            lyr.on("click", () => {
              resetParcelStyles();
              (lyr as L.Path).setStyle({ fillOpacity: 0.6, weight: 3 });
              setSelectedParcel(p);
              setSelectedField(null);
            });
          },
        });

        // Field layer (merged polygons)
        fieldLayer.current = L.geoJSON(
          { type: "FeatureCollection", features: fieldFeatures } as GeoJSON.GeoJsonObject,
          {
            style: (feature) => {
              const f = (feature?.properties as { field?: FieldSummary } | undefined)?.field;
              const color = f?.use_type ? USE_TYPE_COLORS[f.use_type] : "#aaa";
              return { color, fillColor: color, fillOpacity: 0.35, weight: 2, opacity: 0.9 };
            },
            onEachFeature: (feature, lyr) => {
              const summary = (feature.properties as { field: FieldSummary }).field;
              fieldLayersById.current.set(summary.id, lyr as L.Path);
              lyr.bindTooltip(`${summary.name} · ${summary.totalHa} ha`, { sticky: true });
              lyr.on("click", () => {
                resetFieldStyles();
                (lyr as L.Path).setStyle({ fillOpacity: 0.62, weight: 3 });
                setSelectedField(summary);
                setSelectedParcel(null);
              });
            },
          },
        );

        // Start in fields view
        fieldLayer.current.addTo(map);

        try {
          const bounds = (fieldLayer.current as L.GeoJSON).getBounds();
          if (bounds.isValid()) map.fitBounds(bounds, { padding: [20, 20] });
        } catch {
          /* ignore */
        }

        onFieldsReady?.(summaries);

        if (ungrouped.length > 0) {
          console.warn(`${ungrouped.length} parcel(s) without field_id`);
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
      parcelLayer.current = null;
      fieldLayer.current = null;
      fieldLayersById.current = new Map();
      parcelLayers.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startDrawField = (fieldId: string, fallbackName?: string) => {
    const map = leafletMap.current;
    if (!map) return;
    // Find field name from existing fields
    let name = fallbackName ?? "Mark";
    fieldLayersById.current.forEach((lyr, id) => {
      if (id === fieldId) {
        const f = (lyr as unknown as { feature?: FieldFeature }).feature;
        if (f?.properties.field?.name) name = f.properties.field.name;
      }
    });
    setEditingField({ id: fieldId, name });
    setDrawnGeometry(null);
    setSelectedParcel(null);
    setSelectedField(null);
    if (fieldLayer.current && map.hasLayer(fieldLayer.current)) map.removeLayer(fieldLayer.current);
    if (parcelLayer.current && map.hasLayer(parcelLayer.current)) map.removeLayer(parcelLayer.current);

    // Show matrikel boundaries as a non-interactive backdrop so the user has a reference while drawing
    if (rawGeojson.current) {
      backdropLayer.current = L.geoJSON(rawGeojson.current as unknown as GeoJSON.GeoJsonObject, {
        interactive: false,
        style: () => ({
          color: "#1f2937",
          weight: 1.5,
          opacity: 0.85,
          dashArray: "4 3",
          fill: false,
        }),
        onEachFeature: (feature, lyr) => {
          const p = feature.properties as FeatureProps;
          (lyr as L.Path).bindTooltip(`Matr. ${p.matrikelnr ?? "?"}`, { sticky: true });
        },
      }).addTo(map);
    }

    const fg = new L.FeatureGroup().addTo(map);
    drawFeatureGroup.current = fg;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const drawHandler = new (L as any).Draw.Polygon(map, {
      shapeOptions: { color: "#1D9E75", weight: 3, fillOpacity: 0.35 },
      allowIntersection: false,
      showArea: false,
    });
    drawHandler.enable();
    activeDrawHandler.current = drawHandler;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map.once((L as any).Draw.Event.CREATED, (evt: any) => {
      const layer = evt.layer as L.Polygon;
      fg.addLayer(layer);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (layer as any).editing?.enable();
      const geo = layer.toGeoJSON() as Feature<Polygon>;
      setDrawnGeometry(geo.geometry);
      layer.on("edit", () => {
        const g = layer.toGeoJSON() as Feature<Polygon>;
        setDrawnGeometry(g.geometry);
      });
      activeDrawHandler.current = null;
    });
  };

  const cancelDrawing = () => {
    const map = leafletMap.current;
    if (activeDrawHandler.current) {
      try { activeDrawHandler.current.disable(); } catch { /* ignore */ }
      activeDrawHandler.current = null;
    }
    if (drawFeatureGroup.current && map) {
      map.removeLayer(drawFeatureGroup.current);
      drawFeatureGroup.current = null;
    }
    if (backdropLayer.current && map) {
      map.removeLayer(backdropLayer.current);
      backdropLayer.current = null;
    }
    setEditingField(null);
    setDrawnGeometry(null);
    if (map) {
      if (viewMode === "fields" && fieldLayer.current) fieldLayer.current.addTo(map);
      if (viewMode === "parcels" && parcelLayer.current) parcelLayer.current.addTo(map);
    }
  };

  const startDrawNewField = (parcelId?: string | null, presetName?: string) => {
    const name = presetName ?? window.prompt("Navn på den nye mark:");
    if (!name || !name.trim()) return;
    const map = leafletMap.current;
    if (!map) return;
    setEditingField({ id: null, name: name.trim(), parcelId: parcelId ?? null });
    setDrawnGeometry(null);
    setSelectedParcel(null);
    setSelectedField(null);
    if (fieldLayer.current && map.hasLayer(fieldLayer.current)) map.removeLayer(fieldLayer.current);
    if (parcelLayer.current && map.hasLayer(parcelLayer.current)) map.removeLayer(parcelLayer.current);
    if (rawGeojson.current) {
      backdropLayer.current = L.geoJSON(rawGeojson.current as unknown as GeoJSON.GeoJsonObject, {
        interactive: false,
        style: (feature) => {
          const p = (feature?.properties as FeatureProps | undefined);
          const isTarget = parcelId && p?.parcel?.id === parcelId;
          return {
            color: isTarget ? "#1D9E75" : "#1f2937",
            weight: isTarget ? 2.5 : 1.5,
            opacity: isTarget ? 1 : 0.85,
            dashArray: isTarget ? undefined : "4 3",
            fill: false,
          };
        },
        onEachFeature: (feature, lyr) => {
          const p = feature.properties as FeatureProps;
          (lyr as L.Path).bindTooltip(`Matr. ${p.matrikelnr ?? "?"}`, { sticky: true });
        },
      }).addTo(map);
    }
    const fg = new L.FeatureGroup().addTo(map);
    drawFeatureGroup.current = fg;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const drawHandler = new (L as any).Draw.Polygon(map, {
      shapeOptions: { color: "#1D9E75", weight: 3, fillOpacity: 0.35 },
      allowIntersection: false,
      showArea: false,
    });
    drawHandler.enable();
    activeDrawHandler.current = drawHandler;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map.once((L as any).Draw.Event.CREATED, (evt: any) => {
      const layer = evt.layer as L.Polygon;
      fg.addLayer(layer);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (layer as any).editing?.enable();
      const geo = layer.toGeoJSON() as Feature<Polygon>;
      setDrawnGeometry(geo.geometry);
      layer.on("edit", () => {
        const g = layer.toGeoJSON() as Feature<Polygon>;
        setDrawnGeometry(g.geometry);
      });
      activeDrawHandler.current = null;
    });
  };

  const commitDrawing = async () => {
    if (!editingField || !drawnGeometry) return;
    setSaving(true);
    try {
      if (editingField.id == null) {
        await createFieldFn({ data: { name: editingField.name, use_type: null, geometry: drawnGeometry } });
      } else {
        await saveGeometryFn({ data: { fieldId: editingField.id, geometry: drawnGeometry } });
      }
      window.location.reload();
    } catch (e) {
      console.error(e);
      setSaving(false);
      setError("Kunne ikke gemme geometri.");
    }
  };


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
        <div className="flex-1" />
        <button
          onClick={startDrawNewField}
          disabled={!!editingField}
          className="px-3.5 py-1.5 text-[13px] rounded-md bg-[#1D9E75] text-white hover:opacity-90 disabled:opacity-40"
        >
          + Ny mark
        </button>
      </div>

      <div className="relative w-full h-[70vh] rounded-lg overflow-hidden border border-border bg-muted">
        <div ref={mapRef} className="absolute inset-0" />

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
                  {selectedField.use_type
                    ? USE_TYPE_LABELS[selectedField.use_type]
                    : "Ikke registreret"}
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedField(null);
                  resetFieldStyles();
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
              <MetricCard
                label="Forpagtningsareal"
                value={selectedField.lease_area_ha != null ? `${selectedField.lease_area_ha} ha` : "—"}
              />
              <MetricCard
                label="Støtteberettiget"
                value={selectedField.eligible_area_ha != null ? `${selectedField.eligible_area_ha} ha` : "—"}
              />
              <MetricCard
                label="Pris pr. ha"
                value={
                  selectedField.lease_price_per_ha != null
                    ? `${selectedField.lease_price_per_ha.toLocaleString("da-DK")} kr`
                    : "—"
                }
              />
              <MetricCard
                label="Årlig afgift"
                value={
                  selectedField.lease_area_ha != null && selectedField.lease_price_per_ha != null
                    ? `${(selectedField.lease_area_ha * selectedField.lease_price_per_ha).toLocaleString("da-DK")} kr`
                    : "—"
                }
              />
              <MetricCard label="Jordtype" value={selectedField.soil_type ?? "—"} />
              <MetricCard label="Drænlagt" value={selectedField.is_drained ? "Ja" : "Nej"} />
              <MetricCard label="Vandingsret" value={selectedField.has_irrigation ? "Ja" : "Nej"} />
              <MetricCard label="Forpagter" value={selectedField.leaseholder ?? "—"} />
              <MetricCard
                label="Årlig leje (kontrakt)"
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

            <div className="mt-3 pt-3 border-t border-border flex justify-end">
              <button
                onClick={() => startDrawField(selectedField.id)}
                className="px-3 py-1.5 text-xs rounded-md bg-[#1D9E75] text-white hover:opacity-90"
              >
                Tegn / rediger geometri
              </button>
            </div>
          </div>
        )}

        {editingField && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] rounded-lg bg-background border border-border shadow-lg px-4 py-3 flex items-center gap-3">
            <div className="text-sm">
              {drawnGeometry
                ? `Tilpas hjørnerne eller gem polygonen for "${editingField.name}".`
                : `Klik på kortet for at tegne "${editingField.name}". Dobbeltklik for at afslutte.`}
            </div>
            <button
              onClick={cancelDrawing}
              disabled={saving}
              className="px-3 py-1 text-xs rounded-md border border-border hover:bg-muted"
            >
              Annullér
            </button>
            <button
              onClick={commitDrawing}
              disabled={!drawnGeometry || saving}
              className="px-3 py-1 text-xs rounded-md bg-[#1D9E75] text-white disabled:opacity-40"
            >
              {saving ? "Gemmer…" : "Gem"}
            </button>
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
                  resetParcelStyles();
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

            {selectedParcel.parcel?.field?.id && (
              <div className="mt-3 pt-3 border-t border-border flex justify-end">
                <button
                  onClick={() =>
                    startDrawField(
                      selectedParcel.parcel!.field!.id,
                      selectedParcel.parcel!.field!.name,
                    )
                  }
                  className="px-3 py-1.5 text-xs rounded-md bg-[#1D9E75] text-white hover:opacity-90"
                >
                  Tegn / rediger marken "{selectedParcel.parcel.field.name}"
                </button>
              </div>
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
