import { createFileRoute } from "@tanstack/react-router";

type WfsFeature = {
  type: "Feature";
  properties: Record<string, unknown> & { matrikelnr?: string };
  geometry: unknown;
};

type WfsCollection = {
  type: "FeatureCollection";
  features: WfsFeature[];
};

export const Route = createFileRoute("/api/matrikel")({
  server: {
    handlers: {
      GET: async () => {
        // DAWA (Dataforsyningen) leverer matrikelkortet gratis som GeoJSON
        // uden authentication. Datafordelerens WFS understøtter ikke
        // CQL/GeoJSON pålideligt for Jordstykke_Gaeldende.
        const wfsUrl = new URL("https://api.dataforsyningen.dk/jordstykker");
        wfsUrl.searchParams.set("ejerlavkode", "850551"); // Harre By, Harre
        wfsUrl.searchParams.set("format", "geojson");
        wfsUrl.searchParams.set("srid", "4326");

        const TARGET_PARCELS = new Set([
          "57", "2cc", "2cb", "2a", "2cf", "2g", "58", "1m", "2cd", "3i", "45b",
        ]);

        let geojson: WfsCollection;
        try {
          const wfsRes = await fetch(wfsUrl.toString());
          const text = await wfsRes.text();
          if (!wfsRes.ok) {
            console.error("DAWA matrikel error", wfsRes.status, text.slice(0, 500));
            return Response.json(
              { error: "Matrikel-API fejl", status: wfsRes.status },
              { status: 502 },
            );
          }
          geojson = JSON.parse(text) as WfsCollection;
        } catch (err) {
          console.error("DAWA fetch failed", err);
          return Response.json({ error: "Matrikel-API kunne ikke kontaktes" }, { status: 502 });
        }


        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: parcels } = await supabaseAdmin
          .from("parcels")
          .select(
            `id, matrikel_id, ejerlav, use_type, net_area_ha, field_area_ha, notes, custom_geometry,
             field_parcels:field_parcels ( fields:field_id ( id, name, use_type, notes, lease_area_ha, lease_price_per_ha, soil_type, is_drained, has_irrigation, eligible_area_ha, non_eligible_area_ha, geometry ) ),
             land_leases:land_lease_id (
               annual_fee, price_per_ha, area_ha, contract_start, contract_end,
               leaseholder:leaseholder_id ( name, phone, email )
             )`,
          );

        type FieldRec = {
          id: string;
          name: string;
          use_type: string | null;
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
        type ParcelRec = Record<string, unknown> & {
          matrikel_id: string;
          custom_geometry?: unknown;
          field_parcels?: Array<{ fields: FieldRec | null }> | null;
        };
        const list = (parcels ?? []) as unknown as ParcelRec[];

        const inputFeatures = (geojson.features ?? []).filter((f) => {
          const props = f.properties as Record<string, unknown>;
          const matrikelnr = String(props?.matrikelnr ?? "");
          return TARGET_PARCELS.has(matrikelnr);
        });

        const outputFeatures: WfsFeature[] = [];
        for (const f of inputFeatures) {
          const props = f.properties as Record<string, unknown>;
          const matrikelnr = String(props?.matrikelnr ?? "");
          const matches = list.filter((p) => p.matrikel_id === matrikelnr);
          const baseProps = {
            ...props,
            ejerlavsnavn: props.ejerlavnavn ?? props.ejerlavsnavn,
            registreretAreal: props.registreretareal ?? props.registreretAreal,
            vejareal: props.vejareal ?? null,
          };
          if (matches.length === 0) {
            outputFeatures.push({
              ...f,
              properties: { ...baseProps, parcel: null, originalGeometry: f.geometry },
            });
          } else {
            // Emit one feature per (parcel × linked field). A parcel with no
            // field link still produces one feature with parcel.field = null,
            // so the matrikel view always renders the matrikel.
            for (const match of matches) {
              const geom = match.custom_geometry ?? f.geometry;
              const links = (match.field_parcels ?? [])
                .map((fp) => fp.fields)
                .filter((x): x is FieldRec => !!x);
              const fieldsList = links;
              if (fieldsList.length === 0) {
                const { field_parcels: _fp, ...parcelClean } = match;
                outputFeatures.push({
                  ...f,
                  geometry: geom,
                  properties: {
                    ...baseProps,
                    parcel: { ...parcelClean, field: null, field_id: null, fields: [] },
                    originalGeometry: f.geometry,
                  },
                });
              } else {
                for (const field of fieldsList) {
                  const { field_parcels: _fp, ...parcelClean } = match;
                  outputFeatures.push({
                    ...f,
                    geometry: geom,
                    properties: {
                      ...baseProps,
                      parcel: {
                        ...parcelClean,
                        field,
                        field_id: field.id,
                        fields: fieldsList,
                      },
                      originalGeometry: f.geometry,
                    },
                  });
                }
              }
            }
          }
        }
        geojson.features = outputFeatures;

        // Also load all fields so orphan fields (no parcel link) still appear in the UI
        const { data: allFields } = await supabaseAdmin
          .from("fields")
          .select("id, name, use_type, notes, lease_area_ha, lease_price_per_ha, soil_type, is_drained, has_irrigation, eligible_area_ha, non_eligible_area_ha, geometry");

        return Response.json(
          { ...geojson, allFields: allFields ?? [] },
          { headers: { "Cache-Control": "private, max-age=60" } },
        );
      },
    },
  },
});
