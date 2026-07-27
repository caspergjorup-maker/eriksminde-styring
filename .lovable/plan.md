## Mål

Væk med scenarie-tankegangen. Der er ét budget pr. år. Udgangspunktet er det eksisterende "Fjordager 11 – 2026", og man kan oprette næste års budget som en kopi af det nuværende.

## Sådan kommer det til at fungere

- Budgetsiden åbner direkte i årets budget — ingen scenarie-liste, ingen "primær"-stjerne.
- Øverst en simpel års-vælger (fx `2026 ▾`) der kun viser de år, der findes budget for.
- Knap: **"Opret budget for 2027"** — kopierer alle poster og lån fra det viste år, sætter lånenes startdato/restgæld videre, og åbner det nye år.
- Findes året allerede, er knappen skjult.
- Sletning af et års budget flyttes ind i en lille "..."-menu, så det ikke sker ved uheld.

## Oprydning i data

- Det tomme scenarie **"2026"** (0 poster, 0 lån) slettes.
- "Fjordager 11 – 2026" omdøbes til **"Budget 2026"** og bliver det ene budget for 2026.
- Regel fremadrettet: ét budget pr. år (unikt på årstal).

## Mine input / forslag

1. **Lån bør ikke kopieres blindt.** Ved kopi til næste år foreslår jeg at restgælden ved årets udgang bliver det nye lånebeløb, og løbetiden reduceres med 12 måneder — så finansieringslinjerne er rigtige uden manuel rettelse. (Alternativ: kopiér 1:1 — sig til hvis du foretrækker det.)
2. **Markér kopierede poster.** Nye poster får en note "kopieret fra 2026", så du kan se hvad du endnu ikke har gennemgået.
3. **Indeksering ved kopi.** Valgfrit felt i kopi-dialogen: "Reguler alle beløb med X %" (fx 2 % pristalsregulering). Kan slås fra.
4. **Sammenligning år-til-år.** En kolonne i budgettabellen der viser sidste års beløb ved siden af årets, så afvigelser er tydelige.
5. **Kobling til realiseret.** Senere kan Årsresultat-siden holde budgetlinjerne op mod faktiske indtægter/udgifter pr. kategori.

Punkt 1–2 bygger jeg med som standard. Punkt 3–5 tager jeg med, hvis du siger til.

## Teknisk

- Migration: slet tomt scenarie, omdøb det andet, fjern `is_primary` fra flowet (kolonnen kan blive stående), tilføj unik constraint på `year`.
- `src/lib/budget.functions.ts`: erstat `listScenarios`/`setPrimaryScenario` med `listBudgetYears`, `getBudgetByYear` og ny `copyBudgetToYear` (server-side kopi af poster + lån med restgælds-beregning via `buildAmortization`).
- `src/routes/_authenticated/budget.tsx`: fjern scenarie-liste og primær-toggle, indfør års-vælger + kopi-dialog; resten af tabellerne (poster, lån, amortisering, månedsfordeling) bevares uændret.
