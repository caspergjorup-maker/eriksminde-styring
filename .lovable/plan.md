## Mål
Tilføj filter-muligheder (fritekst-søgning, kolonne-dropdowns, sortering, talintervaller) til alle tabeller i appen.

## Tilgang
Byg én **genbrugelig tabel-toolbar + hooks** så vi ikke kopierer logik ind i hver tab. Derefter integreres den i hver tabel-side.

### Ny infrastruktur
- `src/components/table-filters/use-table-filters.ts` — generisk hook:
  - `search` (fritekst over valgte felter)
  - `columnFilters` (multi-select dropdowns pr. kolonne)
  - `numericRanges` (min/max pr. talkolonne)
  - `sort` (kolonne + retning)
  - returnerer `filtered`, `sorted` data + state-settere
- `src/components/table-filters/table-toolbar.tsx` — UI:
  - Søgefelt (Input + ikon)
  - "Filtre"-popover med dropdowns og min/max-felter
  - "Ryd filtre" knap
  - Badge med antal aktive filtre
- `src/components/table-filters/sortable-header.tsx` — klikbar `<th>` med pil-ikon (asc/desc/none)

### Konfiguration pr. tabel
For hver tabel definerer vi en lille config:
```ts
{
  searchFields: ['name','owner',...],
  columns: [
    { key: 'status', label: 'Status', type: 'enum' },
    { key: 'area',   label: 'Areal', type: 'number' },
    { key: 'name',   label: 'Navn',  type: 'text', sortable: true },
  ]
}
```

### Tabeller der opdateres
1. Matrikler (`matrikler-tab.tsx`) — start her, mest brugt
2. Marker (`marker-tab.tsx`)
3. Forpagtning (`forpagtning-tab.tsx`)
4. Bygninger (`bygninger-tab.tsx`)
5. Bygningsplan (`bygningsplan-tab.tsx`)
6. Halm: lager, salg, økonomi
7. Skov: overblik, hugst

### Rækkefølge
1. Byg `table-filters/` infrastruktur + shadcn `Popover`/`Input`/`Select` (allerede til rådighed).
2. Integrér i Matrikler-tabellen som reference-implementering.
3. Rul ud til de øvrige tabeller — én ad gangen, samme mønster.

### Acceptkriterier
- Søgefelt øverst på hver tabel filtrerer i realtid.
- Mindst én dropdown-filter pr. tabel (fx ejer/status/type).
- Mindst én numerisk min/max pr. tabel hvor det giver mening (areal, pris, antal).
- Klik på kolonneheader sorterer asc → desc → ingen.
- "Ryd filtre" nulstiller alt.
- Footer-summer (fx total areal) afspejler kun synlige rækker.
