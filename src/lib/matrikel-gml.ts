import { XMLParser, XMLValidator } from "fast-xml-parser";
import type { Feature, FeatureCollection, Polygon, MultiPolygon } from "geojson";

type XmlNode = Record<string, unknown>;
const node = (value: unknown): XmlNode => value && typeof value === "object" ? value as XmlNode : {};
const list = (value: unknown): unknown[] => value == null ? [] : Array.isArray(value) ? value : [value];
const text = (value: unknown): string => String(node(value)["#text"] ?? value ?? "");

function ring(value: unknown): number[][] {
  const linear = node(node(value).LinearRing);
  const values = text(linear.posList).trim().split(/\s+/).map(Number);
  const dimension = Number(node(linear.posList)["@_srsDimension"] ?? linear["@_srsDimension"] ?? 2);
  if (dimension !== 2 || values.length < 8 || values.length % 2 || values.some(v => !Number.isFinite(v))) {
    throw new Error("Ugyldige koordinater i matrikeldata");
  }
  return Array.from({ length: values.length / 2 }, (_, i) => [values[i * 2], values[i * 2 + 1]]);
}

function polygon(value: unknown): number[][][] {
  const p = node(value);
  return [ring(p.exterior), ...list(p.interior).map(ring)];
}

export function parseMatrikelGml(xml: string): FeatureCollection<Polygon | MultiPolygon> {
  if (XMLValidator.validate(xml) !== true) throw new Error("Ugyldigt svar fra matrikeltjenesten");
  const doc = new XMLParser({ removeNSPrefix: true, ignoreAttributes: false, parseTagValue: false }).parse(xml);
  if (!doc.FeatureCollection) throw new Error("Matrikeltjenesten returnerede ikke en kortsamling");
  const collection = node(doc.FeatureCollection);
  const members = list(collection.member);
  if (Number(collection["@_numberMatched"]) > members.length) throw new Error("Matrikelsamlingen er ufuldstændig");
  const features: Feature<Polygon | MultiPolygon>[] = members.map(member => {
    const parcel = node(node(member).Jordstykke_Gaeldende);
    const g = node(parcel.geometri);
    const geometry: Polygon | MultiPolygon = g.Polygon
      ? { type: "Polygon", coordinates: polygon(g.Polygon) }
      : { type: "MultiPolygon", coordinates: list(node(g.MultiSurface).surfaceMember).map(m => polygon(node(m).Polygon)) };
    if (!geometry.coordinates.length) throw new Error("Matriklen mangler officiel geometri");
    const area = (value: unknown) => value == null ? null : Number(text(value));
    return {
      type: "Feature", geometry,
      properties: {
        matrikelnr: text(parcel.matrikelnummer),
        ejerlavkode: text(parcel.ejerlavskode),
        ejerlavsnavn: "Harre By, Harre",
        registreretAreal: area(parcel.registreretAreal),
        vejareal: area(parcel.vejareal),
      },
    };
  });
  return { type: "FeatureCollection", features };
}