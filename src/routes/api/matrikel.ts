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
        const username = process.env.DATAFORDELER_USERNAME;
        const password = process.env.DATAFORDELER_PASSWORD;
        if (!username || !password) {
          return Response.json(
            { error: "DATAFORDELER_USERNAME/PASSWORD mangler" },
            { status: 500 },
          );
        }

        const wfsUrl = new URL(
          "https://services.datafordeler.dk/MATRIKLEN2/MatGaeldendeOgForeloebigWFS/1.0.0/WFS",
        );
        wfsUrl.searchParams.set("SERVICE", "WFS");
        wfsUrl.searchParams.set("VERSION", "2.0.0");
        wfsUrl.searchParams.set("REQUEST", "GetFeature");
        wfsUrl.searchParams.set("TYPENAMES", "mat:Jordstykke_Gaeldende");
        wfsUrl.searchParams.set(
          "NAMESPACES",
          "xmlns(mat,http://data.gov.dk/schemas/matrikel/1)",
        );
        wfsUrl.searchParams.set("CQL_FILTER", "ejerlavsnavn='Harre By, Harre'");
        wfsUrl.searchParams.set("OUTPUTFORMAT", "application/json");
        wfsUrl.searchParams.set("username", username);
        wfsUrl.searchParams.set("password", password);

        let geojson: WfsCollection;
        try {
          const wfsRes = await fetch(wfsUrl.toString());
          if (!wfsRes.ok) {
            const body = await wfsRes.text();
            console.error("Datafordeler WFS error", wfsRes.status, body.slice(0, 500));
            return Response.json(
              { error: "Datafordeler fejl", status: wfsRes.status },
              { status: 502 },
            );
          }
          geojson = (await wfsRes.json()) as WfsCollection;
        } catch (err) {
          console.error("Datafordeler fetch failed", err);
          return Response.json({ error: "Datafordeler kunne ikke kontaktes" }, { status: 502 });
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
