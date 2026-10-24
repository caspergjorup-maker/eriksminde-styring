## Budget calculations
- Keep loan month eligibility in `loanMonthly` and use it for annual totals, monthly results, liquidity, and loan-dialog estimates so all views agree.

## Authentication
- Return broker OAuth to the public `/auth` page, verify the session after an in-place login, and navigate to `/overblik` only afterward so both popup and full-page logins reach the protected app.
- Keep one root identity-change subscription and defer router/cache invalidation outside its callback so session updates stay current without re-entering the auth lock or refetching on sign-out.