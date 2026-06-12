## Bygningsplan — interaktiv kortkomponent

### 1. Database (migration)
Tilføj kortlægningskolonner til `buildings`:
- `building_nr text`, `map_color text`, `map_section text`
- `map_x int`, `map_y int`, `map_w int`, `map_h int`
- `map_shape text default 'rect'`

Seed 12 bygninger (1–11 inkl. 8b) via `supabase--insert` med UPSERT-logik på `name` så vi ikke duplikerer eksisterende rækker. Bestående rækker opdateres med kortdata; nye indsættes.

### 2. Server function-udvidelse
I `src/lib/buildings.functions.ts`:
- Udvid `Building`-typen med de nye felter.
- Tilføj `listBuildingsWithLeases()` som returnerer bygninger joinet med deres seneste lease + tenant (`name, phone, email`), sorteret efter `building_nr`. Bruger `requireSupabaseAuth`.
- Udvid `buildingInput` Zod-schema til at acceptere de nye felter (alle optional/nullable) så eksisterende create/update fortsat virker.

### 3. `BuildingMap`-komponent
Ny fil `src/components/building-map/building-map.tsx`:
- Henter data via `useSuspenseQuery` + ny serverFn.
- 600×520 px container, baggrund `#EBF8F3`, afrundet, overflow hidden.
- Tegner veje (Fjordager lodret roteret 8°, Sønderbyen vandret) + vejskilte.
- Mapper bygninger til absolut-positionerede divs med `map_color`, rect/circle, rotation -8° for nr. 1–4.
- Border-farve via `getBorderColor(lease)`: blå (vacant), gul (pending_payment), rød (<90 dage til udløb), ellers transparent. Valgt bygning får mørk teal border + `brightness(0.82)`.
- Etiket inde i bygningen: nr + navn med tekstskygge.
- Prop `scale?: number` og `interactive?: boolean` så samme komponent kan bruges mini-version (skaleret container, vejskilte `pointer-events:none`).

Underkomponenter i samme mappe:
- `building-info-panel.tsx` — header med farvet cirkel + nr, type + status-badge, `MetricCard`-grid (Lejer / Månedlig leje / Kontraktudløb / Telefon / Email / Depositum), knapper "Se lejekontrakt" (→ `/dokumenter?building=<id>`) og "Rediger" (→ `/bygninger`).
- `building-map-legend.tsx` — farvelegende.
- `status-badge.tsx` — genbruger eksisterende Badge-varianter.
- `metric-card.tsx` — simpel label/value-celle.

Bruger eksisterende `formatDKK` / `formatDate` fra `src/lib/format.ts` (ingen ny `date-fns`-afhængighed).

### 4. Ny rute
`src/routes/_authenticated/bygningsplan.tsx`:
- Side-titel "Bygningsplan" + undertekst.
- Renderer `<BuildingMap />` + `<BuildingMapLegend />` + infopanel under kortet.
- Suspense-boundary + errorComponent/notFoundComponent.

### 5. Navigation
Tilføj i `src/components/app-sidebar.tsx` under "Drift" efter "Bygninger":
- `{ label: "Bygningsplan", to: "/bygningsplan", icon: Map }` (lucide `Map`-ikon).

### 6. Mini-version på Bygninger-siden
I `src/routes/_authenticated/bygninger.tsx` tilføjes øverst (over tabellen) en `<BuildingMap scale={0.5} interactive={false} />` som visuel oversigt (klik kan stadig vælge en bygning og scrolle til rækken — eller blot være dekorativ; jeg laver den klikbar og scroller til den valgte række).

### Tekniske noter
- Migrationen skal medbringe nye GRANTs ikke — bygnings-tabellen har dem allerede.
- Seed køres som separat `supabase--insert`-kald efter migrationen er godkendt.
- `building_nr` bruges som visuel identifier, ikke som unik nøgle (8 og 8b deler placering).
- Komponenten er client-only (interaktiv state) — ingen SSR-problemer da ruten er under `_authenticated/` (ssr: false).
