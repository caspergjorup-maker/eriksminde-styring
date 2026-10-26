## Budget calculations
- Keep loan month eligibility in `loanMonthly` and use it for annual totals, monthly results, liquidity, and loan-dialog estimates so all views agree.
- Budget monthly tables share one column definition, including reserved category and action columns, so months and totals align across all sections.

## Authentication
- Return broker OAuth to the public `/auth` page, verify the session after an in-place login, and navigate to `/overblik` only afterward so both popup and full-page logins reach the protected app.
- Keep one root identity-change subscription and defer router/cache invalidation outside its callback so session updates stay current without re-entering the auth lock or refetching on sign-out.

## Cadastral data
- Load official parcel boundaries from Datafordeler Matriklen2 WFS as CRS84 GML, parsed with fast-xml-parser; DAWA jordstykker is retired and user-drawn geometry must never replace parcel boundaries.
- Both parcel tables and the map use the shared bearer-authenticated request helper; the server verifies the caller and reads app metadata with the user's RLS-scoped client rather than admin access.
## Dinero
- All Dinero calls go through `src/lib/dinero.server.ts` (personal-integration token, org resolved from `/organizations`, never from a stored org id) so auth and error surfacing stay in one place.
- Bogførte P&L figures come from Dinero `/entries` per accounting year: accounts below 50000 are P&L (negative = income); deposit accounts give bank balances.
