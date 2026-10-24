import { expect, test } from "bun:test";
import { parseMatrikelGml } from "./matrikel-gml";

test("official parcel coordinates and areas remain unchanged", () => {
  const result = parseMatrikelGml(`<wfs:FeatureCollection xmlns:wfs="wfs" xmlns:mat="mat" xmlns:gml="gml" numberMatched="1"><wfs:member><mat:Jordstykke_Gaeldende><mat:matrikelnummer>2cc</mat:matrikelnummer><mat:ejerlavskode>850551</mat:ejerlavskode><mat:registreretAreal gml:uom="m2">120000</mat:registreretAreal><mat:vejareal gml:uom="m2">400</mat:vejareal><mat:geometri><gml:Polygon><gml:exterior><gml:LinearRing><gml:posList>8.9 56.7 8.91 56.7 8.91 56.71 8.9 56.7</gml:posList></gml:LinearRing></gml:exterior></gml:Polygon></mat:geometri></mat:Jordstykke_Gaeldende></wfs:member></wfs:FeatureCollection>`);
  expect(result.features[0].properties?.matrikelnr).toBe("2cc");
  expect(result.features[0].properties?.registreretAreal).toBe(120000);
  expect(result.features[0].properties?.vejareal).toBe(400);
  expect(result.features[0].geometry.coordinates).toEqual([[[8.9, 56.7], [8.91, 56.7], [8.91, 56.71], [8.9, 56.7]]]);
});

test("upstream errors cannot be mistaken for an empty parcel collection", () => {
  expect(() => parseMatrikelGml('<ExceptionReport><Exception>Denied</Exception></ExceptionReport>')).toThrow();
});