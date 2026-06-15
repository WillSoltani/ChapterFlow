# Production-readiness remediation — residuals & follow-ups

Status of the parallel fix run on `audit/prod-readiness-2026-06-14`. **194 of 202 finding-IDs landed** (13 app batches + the deviceTokenSk fix), each merged only after `typecheck` + `test` + `next build` passed on the integrated branch. The items below are the deliberate follow-ups: agents stopped at their task's file boundary (the STOP-and-flag rule), so where a complete fix needed a file another task owned, the core landed and the remainder is listed here.

## Owner-action (cannot be done by an automated agent)
- **M50** — a stray **untracked** `book-packages/pmbok-guide.v21.json` sits in the working tree, and the real fix needs a `scripts/` build-time manifest generator (or a CI scan) to guarantee `bookPackages.ts` never imports an untracked file. Both are outside any app task's scope. Remove/commit the stray file and add the generator/CI check.

## Deferred (deliberate — low/maintainability, risk-adjusted)
- **L51** — `emailSuppressionPk` (`BOOKSUPPRESS#<lower(trim(email))>`) is hand-duplicated in `keys.ts` + `infra/lambda/lib/email-compliance.ts` + `infra/lambda/suppression-handler.ts` + the cron bundle. **No live divergence today** (all normalize identically). The real fix (one shared module imported by both the Next app and the infra esbuild builds + an equality test) crosses the app/infra build boundary, so it was left for a deliberate refactor rather than risked in this run.

## Cross-file finishes (core fix landed; a second, out-of-scope file completes it)
- **H28 (CSP):** baseline CSP shipped (keeps `'unsafe-inline'` for script/style) + a strict nonce policy in **Report-Only**. To enforce strict-dynamic: wire a per-request nonce `middleware → app/layout.tsx → the JSON-LD pages (app/page.tsx, app/books/page.tsx)`, add a `report-uri`/`report-to` endpoint, then promote.
- **L8 (transient auth):** server now returns **503** (`VERIFIER_UNAVAILABLE`) on a JWKS hiccup, but `components/auth/useAuthStatus.ts` still flips `loggedIn=false` on any non-OK (should retry on 5xx); and `http.ts` still maps it to 401 for book routes.
- **L64 / L77 (settings danger zone):** `DangerZone` now shows an inline error on a failed delete/deactivate, **but** `BookSettingsClient.onDelete/onDeactivate` still swallow failures (`showToast`+return) instead of `throw`, so the inline error won't engage until those handlers re-throw. L64 also leaves server-side **terms-acceptance stamping** for non-onboarding signup paths to the issue-11 legal initiative (login route → encrypted `state` → callback).
- **M9 (FSRS idempotency):** route-level dedupe window added; the last sub-millisecond race needs a `ConditionExpression`/`attribute_not_exists` in `fsrs-repo.ts:recordReview`.
- **M8 (streak):** `purchaseStreakShield` returns the real balance at the repo layer, but `me/streak/route.ts` still omits `balance` in its response and GET doesn't clamp `consistencyScore ≤ 100`. Deploy note: a **one-time, per-user** extra `streak_day` grant is possible on deploy day from the UTC→local dedup-key change.
- **M21 (L45):** the `booksCompleted` off-by-one fix is backward-compatible but **inert** until `me/progress/route.ts` passes a `chapterCounts` map into `summarizeProgress`.
- **M25 (L25):** the reflection +5 IP route now requires `reflectionText` server-side (length ≥ 20); the client posting to it must send `reflectionText` or it 400s.
- **M17:** `proSource="admin"` is written for comps but isn't in the `types.ts` `proSource` union → a single-user `getUserEntitlement` read coerces it to `undefined` (revenue/reconciliation routes are fine via the loose-typed snapshot). `ADMIN_AUDIT` rows are written but have **no reader UI** yet.
- **M26:** the `upgrade=1` deep-link marker is in place; the settings client should read it to auto-open the checkout/upgrade step.
- **M38:** the dead `getAchievementIP()` was removed, but the badges page still labels its cosmetic currency `IP`/`Insight Points` (in the badge **components**, out of scope) — relabel to "Badge Points".
- **M28 / M29 / L58:** `app/legal/cookies/page.tsx` still shows the stale **"April 2, 2026"** effective date and raw `support@chapterflow.ca` (privacy + cookies) — migrate to `SUPPORT_EMAIL` / `LEGAL_TERMS_VERSION`.
- **L38 / L39:** filter/book validation was added to the **POST** admin routes; the sibling **PATCH** routes (`segments/[segmentId]`, `events/[eventId]`) are still unvalidated (read-only this run; `validateSegmentFilters` is exported for them to adopt).
- **M46:** OpenDyslexic is still loaded from jsdelivr at runtime — self-host needs `public/fonts/*.woff2`; the P22 style-drift CI guard needs `scripts/`.
- **M49:** `.github/dependabot.yml` still has a now-dead `pdfjs-dist` ignore rule (config cleanup).

## Verified clean (no action)
- **Infra (H14/H15/H16/M6 + this pass):** `infra` `tsc` exits 0, and rebuilding both esbuild Lambda bundles produces **zero `git diff`** — the committed `infra/lambda/dist/*` bundles match source (CI freshness gate will pass).
- **L34/L47 (done):** `deviceTokenSk` now sha256s the full endpoint. Deploy note: pre-existing device rows (old `slice(-32)` key) orphan on deploy and clients re-register — no prod rows pre-launch.
