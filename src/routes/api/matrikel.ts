import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { parseMatrikelGml } from "@/lib/matrikel-gml";

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
      GET: async ({ request }) => {
        const authorization = request.headers.get("Authorization");
        if (!authorization?.startsWith("Bearer ")) return Response.json({ error: "Log ind for at hente matrikler." }, { status: 401 });
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_PUBLISHABLE_KEY;
        const apiKey = process.env.DATAFORDELER_API_KEY;
        if (!url || !key || !apiKey) return Response.json({ error: "Adgang til matrikeltjenesten mangler." }, { status: 503 });
        const supabase = createClient<Database>(url, key, {
          global: { headers: { Authorization: authorization } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: auth, error: authError } = await supabase.auth.getUser(authorization.slice(7));
        if (authError || !auth.user) return Response.json({ error: "Log ind igen for at hente matrikler." }, { status: 401 });

        // DAWA is retired. The official replacement returns GML in longitude/latitude order.
        const wfsUrl = new URL("https://wfs.datafordeler.dk/MATRIKLEN2/MatGaeldendeOgForeloebigWFS/1.0.0/WFS");
        wfsUrl.searchParams.set("apikey", apiKey);
        wfsUrl.searchParams.set("service", "WFS");
        wfsUrl.searchParams.set("version", "2.0.0");
        wfsUrl.searchParams.set("request", "GetFeature");
        wfsUrl.searchParams.set("typenames", "mat:Jordstykke_Gaeldende");
        wfsUrl.searchParams.set("srsName", "urn:ogc:def:crs:OGC::CRS84");
        wfsUrl.searchParams.set("count", "500");
        wfsUrl.searchParams.set("filter", '<fes:Filter xmlns:fes="http://www.opengis.net/fes/2.0"><fes:PropertyIsEqualTo><fes:ValueReference>mat:ejerlavskode</fes:ValueReference><fes:Literal>850551</fes:Literal></fes:PropertyIsEqualTo></fes:Filter>');

        const TARGET_PARCELS = new Set([
          "57", "2cc", "2cb", "2a", "2cf", "2g", "58", "1m", "2cd", "3i", "45b",
        ]);

        let geojson: WfsCollection;
        try {
          const wfsRes = await fetch(wfsUrl.toString(), { signal: AbortSignal.timeout(30_000) });
          const text = await wfsRes.text();
          if (!wfsRes.ok) {
            console.error("Datafordeler matrikel status", wfsRes.status);
            return Response.json(
              { error: "Datafordeleren kunne ikke levere matrikelkortet.", status: wfsRes.status },
              { status: 502 },
            );
          }
          geojson = parseMatrikelGml(text) as WfsCollection;
        } catch (err) {
          // Never log a fetch error containing the credential-bearing upstream URL.
          console.error("Datafordeler matrikel request failed", err instanceof Error ? err.name : "UnknownError");
          return Response.json({ error: "Matrikel-API kunne ikke kontaktes" }, { status: 502 });
        }


        const { data: parcels, error: parcelError } = await supabase
          .from("parcels")
          .select(
            `id, matrikel_id, ejerlav, use_type, net_area_ha, field_area_ha, notes, custom_geometry,
             field_parcels:field_parcels ( fields:field_id ( id, name, use_type, notes, lease_area_ha, lease_price_per_ha, soil_type, is_drained, has_irrigation, eligible_area_ha, non_eligible_area_ha, geometry ) ),
             land_leases:land_lease_id (
               annual_fee, price_per_ha, area_ha, contract_start, contract_end,
               leaseholder:leaseholder_id ( name, phone, email )
             )`,
          );
        if (parcelError) return Response.json({ error: "Matrikeloplysninger kunne ikke hentes." }, { status: 500 });

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
              const geom = f.geometry;
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
        const { data: allFields, error: fieldError } = await supabase
          .from("fields")
          .select("id, name, use_type, notes, lease_area_ha, lease_price_per_ha, soil_type, is_drained, has_irrigation, eligible_area_ha, non_eligible_area_ha, geometry");
        if (fieldError) return Response.json({ error: "Markoplysninger kunne ikke hentes." }, { status: 500 });

        return Response.json(
          { ...geojson, allFields: allFields ?? [] },
          { headers: { "Cache-Control": "private, no-store" } },
        );
      },
    },
  },
});
