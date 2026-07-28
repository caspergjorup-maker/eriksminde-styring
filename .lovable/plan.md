# Bygningsplan – realistisk 2D + vej til 3D

## Konklusion
Bygningsplanen bør **forblive integreret i appen** (under `Bygninger → Bygningsplan`). Den store gevinst ligger i at gøre den 2D-visualisering **visuelt troværdig** nu, og så vurdere 3D i en senere fase. Et separat tegne-værktøj vil du aldrig kunne konkurrere med AutoCAD/Revit/SketchUp på – men vi kan lave en lækker, informativ overbliksplan.

## Hvad vi bygger nu

### 1. Baggrundsbillede (største forbedring)
- Upload et luftfoto, kortudsnit eller en siteplan som baggrund på bygningsplanen.
- Bygninger tegnes ovenpå, så de ligger korrekt i forhold til virkeligheden.
- Baggrundsbilledet gemmes pr. gård/instans (lokal fil eller Supabase Storage).
- Mulighed for at trække i hjørner for at justere skala og placering, så baggrund og bygninger passer sammen.

### 2. Realistiske 2D-bygninger
- Erstat de flade farvebokse med bygningssilhuetter:
  - Tage med let perspektiv (fx en lidt mørkere tagflade øverst).
  - Døre og vinduer som små markeringer på facader.
  - Skyggekast under bygningerne efter "sol" fra øverst venstre.
  - Mere naturlige farver (røde teglstens-tage, grå beton, træbeklædning).
- Bygningerne kan stadig være rektangler/ovale baseret på eksisterende data, men vises med "huse"-stil.
- Type-farven bevares diskret (fx tagfarve eller kant-streg) så legenden stadig fungerer.

### 3. Omgivelser
- Tegn veje, stier, hække/træer og markgrænser som dekorative elementer.
- Dette gøres som SVG-overlejring ovenpå baggrundsbilledet.
- Brug data vi allerede har (marker, matrikler, bygninger) til at placere elementerne.

### 4. Målestok og måleværktøj
- Vis en fast målestokslinje nederst på planen (fx "0 — 50 m").
- Klik-to-måle-værktøj: klik to punkter og se afstanden i meter.
- Bygningernes areal vises i info-panelet (beregnet ud fra bredde × højde i kortkoordinater).

### 5. Redigering og data forbliver som nu
- Inline-redigering af bygningers position, størrelse, vinkel, type og farve.
- "På plan"-status og udlejningspotentiale fortsætter uændret.
- Klik på en bygning viser stadig detaljer, leje og underenheder.

## 3D – vurdering
3D er **ikke en del af denne plan**. Årsager:
- Det kræver 3D-modeller af hver bygning (højder, tagformer, detaljer), som vi ikke har.
- At bygge en brugbar 3D-editor i browseren er et stort projekt i sig selv.
- En bedre vej til 3D senere: eksporter bygningernes positioner og arealer til et rigtigt værktøj (SketchUp, Revit, Blender) eller brug en tjeneste som Google Photorealistic 3D Tiles / Mapbox 3D.
- Vi kan **forberede** data til 3D: tilføje `height_m`, `roof_type`, `roof_angle` på `buildings`-tabellen, så en fremtidig 3D-fase har noget at arbejde med.

## Teknisk tilgang
- Fortsæt med den nuværende SVG/DOM-baserede plan; den er hurtig, let at style og kræver ikke nye tunge biblioteker.
- Baggrundsbillede: `<image>` i SVG eller CSS `background-image` på plan-containeren med transform/pan-zoom.
- Forbedret visuel stil: SVG-filtre (drop-shadow), gradients, patterns og ikoner for døre/vinduer.
- Nye kolonner i `buildings`: `height_m`, `roof_type`, `roof_color`, `wall_color`, `map_angle` (hvis ikke vinklen allerede gemmes).
- Nye kolonner til underenheder: `map_kind` understøtter allerede `rect`/`polygon`; udvid med `circle`/`ellipse` og rotation.

## Forslag til faser
1. **Fase 1:** Baggrundsbillede + målestok + måleværktøj.
2. **Fase 2:** Realistiske 2D-bygninger med tag, skygge, døre/vinduer.
3. **Fase 3:** Omgivelser (veje, træer, hække) og legend-opdatering.
4. **Fase 4 (senere):** Forbered 3D-data og evaluer ekstern 3D-løsning.

## Hvad jeg anbefaler at starte med
Jeg foreslår at vi går i gang med **Fase 1 + 2**: baggrundsbillede og realistiske 2D-bygninger. Det giver den største visuelle forbedring og kan bruges med det samme. 3D skydes på til senere, når der findes gode data eller et passende værktøj.
