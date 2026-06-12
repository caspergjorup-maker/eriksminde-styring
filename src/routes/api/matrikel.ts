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
            `id, matrikel_id, ejerlav, use_type, net_area_ha, field_area_ha, notes, field_id,
             field:field_id ( id, name, use_type, notes ),
             land_leases:land_lease_id (
               annual_fee, price_per_ha, area_ha, contract_start, contract_end,
               leaseholder:leaseholder_id ( name, phone, email )
             )`,
          );

        const list = (parcels ?? []) as Array<Record<string, unknown> & { matrikel_id: string }>;

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
          };
          if (matches.length === 0) {
            outputFeatures.push({ ...f, properties: { ...baseProps, parcel: null } });
          } else {
            // Emit one feature per parcel row so split matrikler appear in multiple fields
            for (const match of matches) {
              outputFeatures.push({ ...f, properties: { ...baseProps, parcel: match } });
            }
          }
        }
        geojson.features = outputFeatures;

        return Response.json(geojson, {
          headers: { "Cache-Control": "private, max-age=60" },
        });
      },
    },
  },
});
