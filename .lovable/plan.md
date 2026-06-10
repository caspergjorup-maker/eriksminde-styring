# Eriksminde — Byggeplan

En fuld-stack gårdstyringsapp til Familien Gjørup, bygget med rigtige tabeller, auth og relationer fra dag ét. Dette er en stor leverance, så jeg foreslår at bygge i 3 faser så du kan teste undervejs.

## Fase 1 — Fundament (denne leverance)

**Backend**
- Aktivér Lovable Cloud (Supabase under motorhjelmen)
- Migration med alle 14 tabeller + relationer + generated columns + RLS + GRANTs
- Seed-data som beskrevet (kontakter, jord, bygninger, halm, skov, jagt, budgetter)
- Supabase Auth (email/password) — enkeltbruger
- `_authenticated/` gate så hele appen kræver login

**Design system**
- Tailwind v4 tokens i `src/styles.css` med teal-paletten (#1D9E75, #085041, #E1F5EE, m.fl.)
- Georgia serif til logo + brand-typografi
- Logo-komponent: ERIKSMINDE-tekst, bølgelinje, FAMILIEN GJØRUP
- Sidebar (shadcn) med hvid baggrund, teal aktiv-border, sektioneret nav, kollaps på mobil
- Badge-varianter: grøn/gul/rød/blå
- DKK-formattering (tusindtalsseparator) + dansk datoformat helpers

**Navigation & shell**
- Alle ruter under `_authenticated/` jf. struktur:
  Drift (Overblik, Landbrugsjord, Bygninger), Halm (Lager, Salg & kunder, Økonomi),
  Skov (Skovoverblik, Hugst & aktivitet, Jagtleje), Økonomi (Overblik, Fakturakladder, Budget),
  Kontakter (Kunder, Leverandører), Andet (Dokumenter, Vedligehold)
- Login-side `/auth`

**Overblikssiden (dashboard)**
- 4 metric-cards: årets indtægt, halm på lager, åbne fakturakladder, næste kontraktudløb
- Kommende opgaver (kontrakter <90 dage, ubetalte lejemål, fakturakladder klar)
- Indtægtsoverblik med progress-bars realiseret vs. budget pr. kategori

## Fase 2 — CRUD pr. domæne (efter du har godkendt fase 1)
Liste-, detalje- og formular-sider for hver entitet: contacts, land_leases, buildings + building_leases, straw (inventory + movements), forest (parcels + activities), hunting (leases + records), invoices, expenses, budgets, documents. Klikbare rækker, badges, dansk formattering.

## Fase 3 — Økonomi & Dinero-forberedelse
- Aggregeringer realiseret vs. budget
- Faktura-workflow draft → ready → exported → paid
- API route `/api/dinero/export-invoice` med TODO-stub + docs-link
- Banner: "Dinero-integration ikke konfigureret"

## Tekniske detaljer
- TanStack Start file-routes under `src/routes/_authenticated/`
- Data fetching: `createServerFn` + `requireSupabaseAuth` + TanStack Query (`ensureQueryData` / `useSuspenseQuery`)
- Public schema GRANTs til `authenticated` + `service_role` på alle tabeller
- RLS: enkeltbruger-app → policies tillader alt for `authenticated` indtil vi udvider med roller
- Generated columns: `annual_fee`, `total_amount` (movements + invoices)
- Storage bucket til `documents.file_url` og `expenses.attachment_url`
- Dinero-integration: kun stub i fase 3, ingen API-kald

## Spørgsmål før jeg starter
1. **OK at jeg går i gang med Fase 1 nu?** (Database + design + shell + dashboard + auth + seed.) Fase 2 og 3 kommer som separate leverancer.
2. **Login**: skal jeg seede en demo-bruger, eller opretter du selv den første konto via signup?
