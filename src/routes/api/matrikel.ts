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
            `id, matrikel_id, ejerlav, use_type, net_area_ha, notes,
             land_leases:land_lease_id (
               annual_fee, price_per_ha, area_ha, contract_start, contract_end,
               leaseholder:leaseholder_id ( name, phone, email )
             )`,
          );

        const list = (parcels ?? []) as Array<Record<string, unknown> & { matrikel_id: string }>;

        geojson.features = (geojson.features ?? []).map((f) => {
          const matrikelnr = String(f.properties?.matrikelnr ?? "");
          const match = list.find((p) => p.matrikel_id === matrikelnr) ?? null;
          return {
            ...f,
            properties: { ...f.properties, parcel: match },
          };
        });

        return Response.json(geojson, {
          headers: { "Cache-Control": "private, max-age=60" },
        });
      },
    },
  },
});
