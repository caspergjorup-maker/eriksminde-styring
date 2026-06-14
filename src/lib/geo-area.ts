// Geodesic area for GeoJSON Polygon / MultiPolygon (WGS84 coords as [lon, lat]).
// Uses spherical excess approximation (good to <0.5% for typical field sizes).

const R = 6378137; // Earth radius in metres (WGS84)
const toRad = (d: number) => (d * Math.PI) / 180;

function ringArea(ring: [number, number][]): number {
  const n = ring.length;
  if (n < 3) return 0;
  let total = 0;
  for (let i = 0; i < n; i++) {
    const [lon1, lat1] = ring[i];
    const [lon2, lat2] = ring[(i + 1) % n];
    total += toRad(lon2 - lon1) * (2 + Math.sin(toRad(lat1)) + Math.sin(toRad(lat2)));
  }
  return Math.abs((total * R * R) / 2);
}

function polygonArea(poly: [number, number][][]): number {
  if (!poly?.length) return 0;
  const outer = ringArea(poly[0]);
  let holes = 0;
  for (let i = 1; i < poly.length; i++) holes += ringArea(poly[i]);
  return Math.max(0, outer - holes);
}

export function geometryAreaHa(geom: unknown): number | null {
  if (!geom || typeof geom !== "object") return null;
  const g = geom as { type?: string; coordinates?: unknown };
  if (!g.type || !g.coordinates) return null;
  try {
    let m2 = 0;
    if (g.type === "Polygon") {
      m2 = polygonArea(g.coordinates as [number, number][][]);
    } else if (g.type === "MultiPolygon") {
      for (const poly of g.coordinates as [number, number][][][]) {
        m2 += polygonArea(poly);
      }
    } else return null;
    if (!isFinite(m2) || m2 <= 0) return null;
    return Number((m2 / 10000).toFixed(2));
  } catch {
    return null;
  }
}
