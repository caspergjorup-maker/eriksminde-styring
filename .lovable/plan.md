## Mål
Et budgetmodul der dækker drift (indtægter + udgifter) og finansiering (lån med amortisering) — pr. år, med mulighed for at overstyre enkelte linjer pr. måned. Stiftelsesomkostninger udelades. Realiseret-sammenligning bygges ikke nu.

## Datamodel (Lovable Cloud)

Den nuværende `budgets`-tabel er for simpel (én række pr. kategori). Den udvides/erstattes:

**`budget_scenarios`** — et budget/scenarie (fx "Fjordager 11 – 2026")
- name, year, notes, is_primary

**`budget_lines`** — én linje pr. post (fx "Forpagterleje – agerjord")
- scenario_id, kind (`income` | `expense`), category (samme enum som i dag: forpagtning, bygningsudlejning, halm, jagtleje, skov, udgifter, finansiering, andet), label, annual_amount, source_note
- monthly_override jsonb (nullable) — 12 tal hvis linjen skal fordeles manuelt; ellers = annual/12

**`budget_loans`** — lån knyttet til et scenarie
- scenario_id, name, principal, interest_rate, term_months, loan_type (`annuity` | `interest_only` | `standing`), start_date, notes
- Beregnet i UI/server-fn: årlig ydelse, rente-/afdragsdel, restgæld pr. år
- Årlig ydelse pushes automatisk ind som en `budget_lines`-post (kind=expense, category=finansiering) — eller vises som separat blok i budgettet; jeg foreslår **separat blok** så rente/afdrag kan splittes.

Migration inkluderer GRANT + RLS (kun `authenticated` via `is_member(auth.uid())`, samme mønster som øvrige tabeller). Eksisterende `budgets`-tabel bevares urørt indtil vi ved den ikke bruges andre steder.

## Server functions (`src/lib/budget.functions.ts`)
- `listScenarios`, `getScenario(id)` (inkl. lines + loans)
- `createScenario`, `updateScenario`, `deleteScenario`, `setPrimaryScenario`
- `upsertBudgetLine`, `deleteBudgetLine`
- `upsertLoan`, `deleteLoan`
- `getAmortization(loanId)` — returnerer array pr. år (ydelse, rente, afdrag, restgæld)

Alle med `requireSupabaseAuth`.

## UI

Ny rute `/_authenticated/budget` (erstatter `PagePlaceholder`).

Layout:
1. **Scenarie-vælger** øverst (dropdown + "Nyt scenarie", "Sæt som primær")
2. **KPI-strip**: Samlet indtægt/år, Driftsudgifter/år, Låneydelser/år, Resultat/år, Resultat/md
3. **Tabel: Indtægter** — kolonner: Post, Pr. år, Pr. måned, Kilde, handlinger. Inline-redigering. "+ Ny linje"
4. **Tabel: Driftsudgifter** — samme struktur
5. **Tabel: Lån & finansiering** — Navn, Hovedstol, Rente, Løbetid, Type, Årlig ydelse (beregnet), Restgæld i år (beregnet). "+ Nyt lån". Klik på lån → drawer med fuld amortiseringstabel (år for år) og rente-/afdragssplit
6. **Resultat-boks nederst** — indtægter − driftsudgifter − låneydelser, som år og måned
7. **Månedsvisning-toggle** — skifter tabellerne til 12 månedskolonner; celler er redigerbare og gemmer som `monthly_override`. Årlig sum vises som første kolonne.

Genbrug: shadcn `Table`, `Dialog`, `Popover`, `Input`, `Select`, den eksisterende `table-toolbar`. Formatér med `formatDKK` fra `src/lib/format.ts`.

## Amortiseringsformler
- Annuitet: `ydelse = P · r / (1 − (1+r)^-n)` (r = månedsrente, n = antal måneder). Årlig ydelse = 12 × månedsydelse.
- Stående lån: årlig ydelse = P · årlig rente; afdrag = 0 indtil udløb.
- Rente-/afdragsfrit (fx sælgerpantebrev): rente = 0 → ydelse = 0.

## Ikke i denne omgang
- Stiftelsesomkostninger
- Realiseret vs. budget (kobling til invoices/leases) — bygges når du siger til
- PDF/eksport
- Flere års-fremskrivning (kommer naturligt oven på loan-amortiseringen senere)

## Rækkefølge
1. Migration (`budget_scenarios`, `budget_lines`, `budget_loans` + RLS/GRANT)
2. `budget.functions.ts` + amortiseringshjælper
3. `/budget`-siden med scenarie-vælger, KPI-strip og de tre tabeller
4. Månedsvisning-toggle + `monthly_override`
5. Seed dit Fjordager-scenarie som første datasæt (kan gøres via UI eller migration — sig til hvis du vil have det forudfyldt)
