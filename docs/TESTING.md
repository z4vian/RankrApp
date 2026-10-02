# Pull request checks

`.github/workflows/ci.yml` runs on PRs targeting main, pushes to main, and manual dispatch. It grants read-only repository access and uses no production secrets.

Required check names:

- **App and browser tests**: clean npm install, TypeScript, Node unit/security tests, Expo web export, and Chromium UI tests at desktop/mobile widths.
- **Database migration tests**: PostgreSQL 15 in a disposable service, testing private photo/encrypted-content migrations and guest import in separate fixture databases.

Browser tests cover guest ordering, keyboard controls, comparison undo, reload persistence, signup handoff, failed import/retry, full/short walkthroughs, skip/replay, ten-item score visibility, and list deletion cancellation/failure/zero-row/success. Screenshots are uploaded as `browser-screenshots` for seven days, including when a test fails. Unexpected browser runtime errors and horizontal overflow fail the suite. Axe WCAG A/AA checks cover guest, signup, walkthrough and My Lists. Saved-list accessibility is not asserted yet because the existing bottom-sheet dependency exposes sliders without required ARIA values; this exception is explicit in the test.

All backend/provider browser requests are intercepted. Browser tests do not create live accounts or delete real lists. SQL tests use minimal fixture schemas: they do not prove live Supabase schema, email/OAuth callbacks, full RLS deployment, native behavior or production cleanup/cascades.

## Local commands

Use Node 22 or newer:

```bash
npm ci
npx playwright install chromium
npm run typecheck
npm run test:unit
npm run vercel-build
npm run test:web
```

`npm run test:ci` combines the application checks after Chromium is installed. The browser runner starts/stops its own loopback preview server on an available port; no manual server or accounts are needed. Results are written to ignored `test-results/`.

The database job can be run with an isolated PostgreSQL 15 server and psql. First run `tests/backend/migrations.sql` in a fresh database to create shared test roles, then run `tests/backend/guest-import.sql` in a separate fresh database. Never run these fixtures against production: they create synthetic auth/storage tables and roles.

## Before production

Open a PR into main and inspect both check results. Require both named checks in main branch protection, with the branch up to date. Vercel deploys main; a push workflow alone does not delay deployment, so the pre-merge required-check rule is the gate. Browser tests use Chromium only; native devices and real-account production save/delete should receive a separate smoke check.
