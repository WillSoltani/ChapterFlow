# Fix prompts — Correctness / Bugs

_45 items (1 critical, 1 high, 11 medium, 30 low, 2 polish). ChapterFlow production-readiness remediation — branch `main` (e90937368)._

## Shared context (every prompt below assumes this)

**App:** ChapterFlow — a Next.js 16 (App Router, React 19) "book learning" web app. **These prompts target the `main` branch** (commit e90937368, the freshly-merged post-UI-overhaul-integration state). Backend = DynamoDB single-table (`app/app/api/book/_lib/repo.ts`) behind Cognito JWT auth (`requireUser`/`requireActiveBookUser`/`requireAdminUser`), Stripe billing, S3 content, CDK infra (`infra/`). API routes live under `app/app/api/book/**` (URL `/app/api/book/**`). Error envelope = `withBookApiErrors`+`BookApiError`.

**Rules for every fix agent:**
1. Work on `main`. Change ONLY the cited files + direct deps. Do NOT touch `scripts/`, `book-packages/`, `content/`, `state/`, `graphify-out/`.
2. Match surrounding code style; reuse existing helpers (auth guards, `BookApiError`, repo functions, `keys.ts`, `lib/catalog-stats.ts`, `lib/pricing.ts`).
3. Never make a security/economy/paywall decision from client-supplied data — the server is the source of truth.
4. When done: run `npm install` (if deps stale), `npm run typecheck`, `npm run test`, and `npx eslint <changed files>`; report results + a short diff summary. Add/adjust a unit test for any security/money/correctness fix.
5. Line numbers were accurate at audit time — re-read each file and confirm before editing (other agents may be editing in parallel).

---

### X2 — CloudFront errorResponses rewrite ALL 403/404 to the homepage at HTTP 200, corrupting every API error response
`severity: critical` · `effort: small` · `files: infra/lib/chapterflow-frontend-stack.ts:740-753, app/app/api/book/_lib/http.ts:43-63, app/app/api/book/_lib/account-guard.ts:65-67, app/app/api/book/_lib/content-service.ts:62` · `⚠ carried/re-confirmed`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

NOTE: RE-CONFIRMED BY HAND on main (frontend-stack.ts is byte-identical; errorResponses still maps 403/404 -> responseHttpStatus 200 -> "/"). The automated main re-audit only mentioned this as a side-note in a medium finding — treat as a launch blocker.

FILES: infra/lib/chapterflow-frontend-stack.ts:740-753, app/app/api/book/_lib/http.ts:43-63, app/app/api/book/_lib/account-guard.ts:65-67, app/app/api/book/_lib/content-service.ts:62

PROBLEM:
The distribution's errorResponses maps both httpStatus 403 and 404 to responsePagePath '/' with responseHttpStatus 200, applied to the default (server-Lambda) behavior. CloudFront custom error responses fire on the ORIGIN status code regardless of path, so every JSON 403/404 the app legitimately returns is replaced with homepage HTML at status 200.

WHY IT MATTERS:
Core authenticated flows break: clients receive HTML+200 instead of structured 403/404 JSON. account_deleted gating, chapter_locked gating, book/version not-found, and all admin 404 paths malfunction; clients calling .json() on HTML crash or silently mis-handle. Every-user blast radius. (401 is NOT in the list, so unauthenticated 401s still pass through.)

REQUIRED FIX:
Remove the 403 and 404 entries from errorResponses so the server Lambda's own responses pass through (OpenNext renders its own 404 page). If a custom SPA fallback is genuinely wanted for browser navigations, scope it to a behavior that EXCLUDES the server/API paths — but for an OpenNext SSR app the correct fix is simply to delete both entries. Do not rewrite 4xx to 200.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Add or update a unit test that fails before and passes after the fix.

VERIFY before reporting done:
- npm run typecheck   (must pass)
- npm run test        (must pass)
- npx eslint <each changed file>   (no new errors)
- Summarize the change and paste the command output.
```

---

### H15 — Reminder emails hardcode legacy APP_BASE_URL — unsubscribe broken
`severity: high` · `effort: small` · `files: infra/lib/chapterflow-backend-stack.ts:437-438, infra/lambda/lib/email-compliance.ts:99, infra/lambda/lib/email-compliance.ts:131-148, .github/workflows/_deploy-infra.yml:73-79`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: infra/lib/chapterflow-backend-stack.ts:437-438, infra/lambda/lib/email-compliance.ts:99, infra/lambda/lib/email-compliance.ts:131-148, .github/workflows/_deploy-infra.yml:73-79

PROBLEM:
The reminder Lambda sets APP_BASE_URL = process.env.CHAPTERFLOW_APP_BASE_URL ?? 'https://chapterflow.siliconx.ca' (backend-stack.ts:437-438). _deploy-infra.yml's 'CDK deploy backend' step (lines 73-79) passes only CDK_DEFAULT_ACCOUNT, CHAPTERFLOW_ENV, CHAPTERFLOW_OPS_ALERT_EMAIL — it never sets CHAPTERFLOW_APP_BASE_URL, so the fallback to the legacy siliconx host always wins. resolveEmailConfig() (email-compliance.ts:131-148) overlays only EMAIL_POSTAL_ADDRESS/EMAIL_UNSUBSCRIBE_SECRET/EMAIL_SENDER_NAME/EMAIL_SUPPORT_ADDRESS from SSM — appBaseUrl is NOT overlaid, so it stays the value from getEmailConfig() which reads process.env.APP_BASE_URL (default chapterflow.siliconx.ca at email-compliance.ts:99). buildUnsubscribeUrl/emailFooter then build the one-click unsubscribe URL, List-Unsubscribe header, and prefs link against that wrong host.

WHY IT MATTERS:
Every reminder/streak/digest/welcome-back email links CTAs, the one-click unsubscribe URL, and List-Unsubscribe header to the legacy chapterflow.siliconx.ca domain instead of the live app host. If that domain no longer serves the app's /app/api/book/email/unsubscribe route, one-click unsubscribe fails — a CASL/CAN-SPAM compliance violation (working unsubscribe is mandatory).

REQUIRED FIX:
Pass CHAPTERFLOW_APP_BASE_URL into the backend deploy step env in _deploy-infra.yml AND/OR add an EMAIL_APP_BASE_URL (or reuse CHAPTERFLOW_APP_BASE_URL) overlay in resolveEmailConfig()'s SSM Promise.all so appBaseUrl is resolved from SSM like the other EMAIL_* values. Drop the siliconx.ca fallback (fail loudly / refuse to send rather than mint links to a dead host). Confirm the SSM param /chapterflow/<env>/CHAPTERFLOW_APP_BASE_URL is actually populated.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Add or update a unit test that fails before and passes after the fix.

VERIFY before reporting done:
- npm run typecheck   (must pass)
- npm run test        (must pass)
- npx eslint <each changed file>   (no new errors)
- Summarize the change and paste the command output.
```

---

### M6 — Depth-recommendation broken: wrong DynamoDB key casing (pk/sk) and updateDepthModel never called
`severity: medium` · `effort: small` · `files: app/app/api/book/_lib/depth-routing.ts:95, app/app/api/book/_lib/depth-routing.ts:160-169, app/app/api/book/me/books/[bookId]/depth-recommendation/route.ts:24, infra/lib/chapterflow-backend-stack.ts:132-133`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/book/_lib/depth-routing.ts:95, app/app/api/book/_lib/depth-routing.ts:160-169, app/app/api/book/me/books/[bookId]/depth-recommendation/route.ts:24, infra/lib/chapterflow-backend-stack.ts:132-133

PROBLEM:
getDepthModel issues GetCommand with Key: { pk, sk } (lowercase, line 95) and updateDepthModel writes Item with pk/sk (lines 164-165), but the book table key schema is PK/SK uppercase (infra/lib/chapterflow-backend-stack.ts:132-133). A Get whose key attribute names don't match the schema raises a DynamoDB ValidationException. The only caller (depth-recommendation route) runs getDepthModel inside withBookApiErrors, which maps non-BookApiError to a 500 (http.ts:61) — so the route returns a 500. Separately, updateDepthModel has ZERO callers (grep confirmed across app/ and scripts/), so even with the key fixed the model is never populated and the route always returns the hasData:false cold-start fallback.

WHY IT MATTERS:
The personalized reading-depth recommendation feature is entirely non-functional: it either 500s on every call, or (after the key fix) silently always returns the cold-start fallback so adaptive depth never adapts.

REQUIRED FIX:
Change both Key and Item to PK: bookUserPk(userId), SK: depthModelSk(bookId) to match the table schema. Then wire updateDepthModel into the quiz-submit / loop-complete pipeline (or a reading-session handler) so the feature vector is actually populated; otherwise delete the depth-recommendation route and depth-routing.ts as dead surface.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY before reporting done:
- npm run typecheck   (must pass)
- npm run test        (must pass)
- npx eslint <each changed file>   (no new errors)
- Summarize the change and paste the command output.
```

---

### M8 — Streak-day IP bonus anchored to UTC day while streak progresses on user-timezone day — denies the daily bonus to evening/morning readers in negative-offset timezones
`severity: medium` · `effort: small` · `files: app/app/api/book/_lib/streak-repo.ts:215-229, app/app/api/book/_lib/streak-repo.ts:325-338, app/app/api/book/_lib/streak-repo.ts:340-350`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/book/_lib/streak-repo.ts:215-229, app/app/api/book/_lib/streak-repo.ts:325-338, app/app/api/book/_lib/streak-repo.ts:340-350

PROBLEM:
updateStreakOnLoopComplete decides 'new streak day' on the user-tz day (today = getTodayInTimezone(userTimezone), compared to streak.lastActiveDate at line 229). But the +15 IP streak_day grant is keyed by the UTC day: utcToday = now.slice(0,10) where now = nowIso() (UTC ISO); awardFlowPoints({sourceType:'streak_day', sourceId: utcToday}) (lines 328-336). awardFlowPoints dedupes on flowPointsGrantSk(sourceType, sourceId) with attribute_not_exists (flow-points-repo.ts:538,548). For a negative UTC offset, two consecutive local days can map to the same UTC date (e.g. UTC-10: local 06-14 20:00 -> 06-15 06:00 UTC grants sourceId=2026-06-15; next local day 06-15 08:00 -> 06-15 18:00 UTC increments the streak but reuses sourceId 2026-06-15, so the grant is rejected as duplicate). The same UTC anchoring applies to welcome_back (lines 341-350).

WHY IT MATTERS:
Americas-timezone, evening-then-morning readers silently lose their 15 IP streak bonus on roughly half their legitimate streak days, making the advertised '+15 IP/day' (flow-points-economy.ts:194) false for them and depressing the faucet unevenly by geography. welcome_back is similarly mis-keyed but fires far more rarely.

REQUIRED FIX:
Key streak_day and welcome_back by the same user-tz day used for the streak decision, scoped per user, to dedupe correctly without UTC drift: sourceId = `${userId}:${today}` (today = getTodayInTimezone(userTimezone)). Per-user-per-local-day uniqueness still prevents farming (timezone switching can shift the boundary by at most one award, not multiply it). The cited 'update submit/route.ts:1010' is ANALYTICS-ONLY (analyticsTrackFlowPointsTransaction writes a separate analytics table, not the engagement ledger) so it has no correctness impact on the actual award; update it only for analytics consistency. The real fix is solely in streak-repo.ts.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY before reporting done:
- npm run typecheck   (must pass)
- npm run test        (must pass)
- npx eslint <each changed file>   (no new errors)
- Summarize the change and paste the command output.
```

---

### M9 — FSRS review submit is not idempotent — a double-submit corrupts the card schedule and writes duplicate review logs
`severity: medium` · `effort: medium` · `files: app/app/api/book/me/reviews/[cardId]/route.ts:45-50, app/app/api/book/_lib/fsrs-repo.ts:141-199, app/app/api/book/_lib/fsrs.ts (scheduleCard)`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/book/me/reviews/[cardId]/route.ts:45-50, app/app/api/book/_lib/fsrs-repo.ts:141-199, app/app/api/book/_lib/fsrs.ts (scheduleCard)

PROBLEM:
recordReview reads the card (GetCommand), calls scheduleCard, then unconditionally PUTs the updated card and a new review log keyed by a fresh crypto.randomUUID — no idempotency key, no optimistic-concurrency ConditionExpression, no rate limit. scheduleCard is pure and advances reps+1, stability, difficulty, and dueAt off elapsedDays. A double-click/retry/two-tab grade runs it twice: on the second run the card is already in 'review' state with lastReviewAt=now so elapsedDays≈0 and retrievability≈max, nextRecallStability advances again, reps becomes +2, dueAt is pushed further out than a single rating warrants, and two FSRSReviewLog rows are written (distinct reviewId/SK). Unlike awardFlowPoints (grant-key dedupe), there is no protection.

WHY IT MATTERS:
Spaced-repetition scheduling — the core learning mechanic — silently drifts on any retry/double-submit: cards get over-scheduled (shown far too late) and review stats (avgRetrievability, due counts) skew from phantom logs. No money lost; learning value degrades and is hard to detect.

REQUIRED FIX:
Make recordReview optimistic-concurrency safe: PUT the card with a ConditionExpression like 'lastReviewAt = :expected' (expected = the value read at the start of recordReview) or '#reps = :expectedReps', so a second concurrent submit fails the condition and no-ops/returns the already-scheduled card. Alternatively gate the review-log SK on a client-supplied reviewId with attribute_not_exists. At minimum, ignore submits where now - lastReviewAt is below a small threshold for the same card.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY before reporting done:
- npm run typecheck   (must pass)
- npm run test        (must pass)
- npx eslint <each changed file>   (no new errors)
- Summarize the change and paste the command output.
```

---

### M10 — share-events endpoint returns 400 on every request — requireString called with the body object instead of the field
`severity: medium` · `effort: trivial` · `files: app/app/api/book/me/share-events/route.ts:27-28, app/app/api/book/_lib/http.ts:72-90, app/book/_lib/share-card-url.ts:130`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/book/me/share-events/route.ts:27-28, app/app/api/book/_lib/http.ts:72-90, app/book/_lib/share-card-url.ts:130

PROBLEM:
requireString(value, field, opts) (http.ts:72) throws BookApiError(400,'invalid_input','<field> must be a string.') when typeof value !== 'string'. share-events/route.ts:27-28 calls requireString(body, 'cardType') and requireString(body, 'destination') — passing the whole body object as value, so every call throws 400 before validation. The client trackShareEvent (share-card-url.ts:122-137) POSTs a correct {cardType, destination, ...} body but fires it .catch(()=>{}) fire-and-forget, so the UI never breaks and zero share events are ever recorded. The sibling devices/register route (register/route.ts:16) correctly does requireString(body.endpoint, ...), proving this route is the outlier.

WHY IT MATTERS:
All share-funnel / referral-share analytics record nothing (putShareEvent never reached). Any growth/attribution dashboard on share events is permanently empty with no surfaced error — silent data loss on a growth-critical metric.

REQUIRED FIX:
Change lines 27-28 to: const cardType = requireString(body.cardType, 'cardType'); const destination = requireString(body.destination, 'destination'); — read the field off body, matching every other route. (referralCode/bookId/etc below already read body.field correctly.)

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY before reporting done:
- npm run typecheck   (must pass)
- npm run test        (must pass)
- npx eslint <each changed file>   (no new errors)
- Summarize the change and paste the command output.
```

---

### M15 — Admin email search is case-sensitive (contains on raw stored email) — admins can't find users by name-cased emails
`severity: medium` · `effort: small` · `files: app/app/api/book/_lib/admin-metrics.ts:252-282 (searchUsersByEmail), app/app/api/book/_lib/analytics-repo.ts:553-563 (email stored verbatim), app/app/api/book/admin/users/search/route.ts:28-30`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/book/_lib/admin-metrics.ts:252-282 (searchUsersByEmail), app/app/api/book/_lib/analytics-repo.ts:553-563 (email stored verbatim), app/app/api/book/admin/users/search/route.ts:28-30

PROBLEM:
searchUsersByEmail lowercases the query (q = query.toLowerCase().trim()) and filters with DynamoDB contains(#e, :q). The email is persisted verbatim from Cognito (analytics-repo.ts:555 sets values[':email']=args.email with no lowercasing; only emailDomain is derived). DynamoDB contains is byte-exact/case-sensitive, so a stored 'John.Doe@Gmail.com' won't match a search for 'john' or 'gmail'. The users/search route (search/route.ts:30) calls this directly for q-driven searches, returning an empty list (looks like 'no such user').

WHY IT MATTERS:
Admin support workflow (find a user by email to view entitlements, adjust points, change account status, erase) silently returns zero results for any user whose stored email has uppercase letters. Severity stays medium: real impact depends on Cognito's email casing, so 'most real users' may overstate it, but the bug is real and produces a silent empty result.

REQUIRED FIX:
Persist a normalized emailLower field on the snapshot at write time in analytics-repo.ts (alongside email/emailDomain) and have searchUsersByEmail filter contains(#emailLower, :q). Backfill existing snapshots once. A stopgap is to scan SK=SNAPSHOT and do case-insensitive JS filtering, but the persistent fix is the lowercase index field.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY before reporting done:
- npm run typecheck   (must pass)
- npm run test        (must pass)
- npx eslint <each changed file>   (no new errors)
- Summarize the change and paste the command output.
```

---

### M18 — Adaptive depth-routing is entirely dead/broken — wrong DynamoDB key casing, no writer, no consumer
`severity: medium` · `effort: small` · `files: app/app/api/book/_lib/depth-routing.ts:92-98, app/app/api/book/_lib/depth-routing.ts:160-169, app/app/api/book/me/books/[bookId]/depth-recommendation/route.ts:24-37, app/book/hooks/useDepthRecommendation.ts:21-46`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/book/_lib/depth-routing.ts:92-98, app/app/api/book/_lib/depth-routing.ts:160-169, app/app/api/book/me/books/[bookId]/depth-recommendation/route.ts:24-37, app/book/hooks/useDepthRecommendation.ts:21-46

PROBLEM:
getDepthModel reads with `Key: { pk: ..., sk: ... }` (lowercase, line 95) and updateDepthModel writes with `Item: { pk: ..., sk: ..., ... }` (lowercase, line 163-166), but the table key schema is uppercase PK/SK (infra/lib/chapterflow-backend-stack.ts:132-133; every other repo write uses PK/SK). A PutCommand whose Item omits the PK/SK attributes is rejected by DynamoDB with ValidationException, and a GetCommand with lowercase keys would also be rejected — so neither path can ever work. On top of that, grep over app/ + components/ (excluding build artifacts) shows updateDepthModel has ZERO callers (only its own definition) and useDepthRecommendation has ZERO consumers (only its own definition); the depth-recommendation route is reached only by that dead hook. So the model is never written and the route, even if its keys were fixed, would always return the cold-start hasData:false fallback.

WHY IT MATTERS:
A shipped 'adaptive depth' feature does nothing — it always returns the easy/default recommendation. Dead code that looks live: a maintenance trap and a feature that would silently never work if someone wired the existing UI to it as-is.

REQUIRED FIX:
Decide explicitly. (a) Delete depth-routing.ts, the depth-recommendation route, and useDepthRecommendation.ts as dead code; or (b) if keeping it: change both the Key (getDepthModel) and Item (updateDepthModel) literals to uppercase PK/SK to match the schema, wire updateDepthModel into the loop-completion path where quizScore/readingTime are known (e.g. quiz submit/loop-complete route), and wire useDepthRecommendation into the reader. Add a test asserting PK/SK presence so the casing regression can't recur.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY before reporting done:
- npm run typecheck   (must pass)
- npm run test        (must pass)
- npx eslint <each changed file>   (no new errors)
- Summarize the change and paste the command output.
```

---

### M21 — No QueryCommand in repo.ts paginates LastEvaluatedKey — every list silently truncates at 1MB
`severity: medium` · `effort: medium` · `files: app/app/api/book/_lib/repo.ts:196 (listPublishedCatalogItems), app/app/api/book/_lib/repo.ts:853 (listAllUserProgress), app/app/api/book/_lib/repo.ts:2504 (listSavedBooks), app/app/api/book/_lib/repo.ts:2649 (listAllUserBookStates), app/app/api/book/_lib/repo.ts:2730 (listUserChapterStates), app/app/api/book/_lib/repo.ts:2804 (listReadingDays), app/app/api/book/_lib/repo.ts:2834 (listBadgeAwards)`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/book/_lib/repo.ts:196 (listPublishedCatalogItems), app/app/api/book/_lib/repo.ts:853 (listAllUserProgress), app/app/api/book/_lib/repo.ts:2504 (listSavedBooks), app/app/api/book/_lib/repo.ts:2649 (listAllUserBookStates), app/app/api/book/_lib/repo.ts:2730 (listUserChapterStates), app/app/api/book/_lib/repo.ts:2804 (listReadingDays), app/app/api/book/_lib/repo.ts:2834 (listBadgeAwards)

PROBLEM:
grep confirms zero occurrences of LastEvaluatedKey or ExclusiveStartKey anywhere in repo.ts across its ~18 QueryCommand calls. Each cited list does a single send() with no Limit and no loop. They feed me/progress and me/dashboard (verified imports) and the data export. Notably the SIBLING files economy-health.ts/soft-decay.ts/admin-metrics.ts DO loop on LastEvaluatedKey — so this is an inconsistency in repo.ts, not a codebase-wide pattern, which makes a shared helper a clean fix.

WHY IT MATTERS:
Long-lived/power users silently see incomplete progress/history/streaks and incomplete export (GDPR/PIPEDA completeness). Catalog page (listPublishedCatalogItems, all books in one partition) is the most realistic near-term truncator as the catalog grows.

REQUIRED FIX:
Add a shared pagination helper (loop on ExclusiveStartKey until LastEvaluatedKey is undefined) and route every full-partition list through it. The exact pattern already exists in admin-metrics.ts — factor it out and reuse. For genuinely huge partitions add an explicit max-page cap.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY before reporting done:
- npm run typecheck   (must pass)
- npm run test        (must pass)
- npx eslint <each changed file>   (no new errors)
- Summarize the change and paste the command output.
```

---

### M22 — listLicenseKeys applies FilterExpression AFTER a single un-paginated 1MB read
`severity: medium` · `effort: small` · `files: app/app/api/book/_lib/repo.ts:3145-3175`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/book/_lib/repo.ts:3145-3175

PROBLEM:
listLicenseKeys queries the constant shared partition licenseIndexPk()='BOOKLICENSE#KEYS' with begins_with(SK,'CODE#'), an optional FilterExpression (#status=:statusFilter), no Limit, no pagination. DynamoDB applies FilterExpression after reading up to 1MB and before returning, so once this partition exceeds 1MB the admin list misses later keys and, with a status filter, under-counts (filter only sees the truncated page). All keys live in one partition (createLicenseKey writes an index item under the same constant PK).

WHY IT MATTERS:
Admin license-key page shows an incomplete/under-counted list as the program scales; available/revoked counts wrong → bad ops decisions (re-seeding existing keys).

REQUIRED FIX:
Paginate over LastEvaluatedKey and accumulate before client-side filtering; OR fold status into the SK / a GSI so a filtered query is exact. Note each index item is small (~150 bytes) so truncation only starts at ~6000+ keys — real but not imminent; the shared pagination helper from finding 2 covers this too.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY before reporting done:
- npm run typecheck   (must pass)
- npm run test        (must pass)
- npx eslint <each changed file>   (no new errors)
- Summarize the change and paste the command output.
```

---

### M28 — Recorded Terms-acceptance version (2026-06-10) does not match the displayed Terms/Privacy effective date (April 2, 2026)
`severity: medium` · `effort: trivial` · `files: lib/legal-entity.ts:29, app/legal/terms/page.tsx:18-19, app/legal/privacy/page.tsx:18-19, app/app/api/book/me/profile/route.ts:370-372, app/app/api/book/me/onboarding/complete/route.ts:287-288`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: lib/legal-entity.ts:29, app/legal/terms/page.tsx:18-19, app/legal/privacy/page.tsx:18-19, app/app/api/book/me/profile/route.ts:370-372, app/app/api/book/me/onboarding/complete/route.ts:287-288

PROBLEM:
LEGAL_TERMS_VERSION='2026-06-10' (legal-entity.ts:29) is stamped onto a user's consent record at profile completion (profile/route.ts:371-372) and onboarding completion (onboarding/complete/route.ts:287-288). But the published Terms and Privacy both display 'Effective date: April 2, 2026' (terms/page.tsx:18, privacy/page.tsx:18). The Refund, Copyright, and Data-Rights pages all carry 'June 10, 2026', confirming the Terms/Privacy dates were simply not bumped when the version was. The version comment (legal-entity.ts:24-28) explicitly aims to keep 'recorded consent auditable' — broken because the stored version string maps to no document bearing that effective date.

WHY IT MATTERS:
Consent audit trail is internally inconsistent: in a dispute over which Terms a user agreed to, the recorded version (2026-06-10) points to no published document with that effective date. Weakens the legal value of recorded consent for a live, paid product.

REQUIRED FIX:
Reconcile the dates: bump terms/page.tsx:18 and privacy/page.tsx:18 effective dates to 'June 10, 2026' to match LEGAL_TERMS_VERSION and the other three legal pages (preferred, since the docs describe June-era practices). Better long-term: derive the displayed effective date from LEGAL_TERMS_VERSION so they cannot drift.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY before reporting done:
- npm run typecheck   (must pass)
- npm run test        (must pass)
- npx eslint <each changed file>   (no new errors)
- Summarize the change and paste the command output.
```

---

### M32 — quizPassed is always false in the live flow (state.quizResult is never written client-side) — dead IP-reconciliation + dead practice gating
`severity: medium` · `effort: small` · `files: app/book/library/[bookId]/chapter/[chapterId]/ChapterReaderClient.tsx:257, app/book/library/[bookId]/chapter/[chapterId]/ChapterReaderClient.tsx:261-268, app/book/library/[bookId]/chapter/[chapterId]/hooks/usePhaseCompletion.ts:264-268, app/book/library/[bookId]/chapter/[chapterId]/hooks/usePhaseCompletion.ts:327-329, app/book/library/[bookId]/chapter/[chapterId]/hooks/useChapterState.ts:378-380`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/book/library/[bookId]/chapter/[chapterId]/ChapterReaderClient.tsx:257, app/book/library/[bookId]/chapter/[chapterId]/ChapterReaderClient.tsx:261-268, app/book/library/[bookId]/chapter/[chapterId]/hooks/usePhaseCompletion.ts:264-268, app/book/library/[bookId]/chapter/[chapterId]/hooks/usePhaseCompletion.ts:327-329, app/book/library/[bookId]/chapter/[chapterId]/hooks/useChapterState.ts:378-380

PROBLEM:
quizPassed = state.quizResult?.passed === true (ChapterReaderClient:257). setQuizResult exists on the hook (useChapterState:378-380) but is NEVER destructured in ChapterReaderClient's useChapterState call (verified the destructure list at lines 233-254 omits it), and a repo grep shows ChapterReaderClient:257 is the ONLY consumer of .quizResult outside the hook. The live quiz is driven by useQuizSession, which never calls setQuizResult. The state PATCH route stores rawState verbatim (state/route.ts:81), so quizResult persists as null. Consequences: (a) the §1.1 reconciliation effect (lines 261-268) that should re-claim loop-complete IP on an already-passed chapter NEVER fires; (b) usePhaseCompletion quiz-readiness via quizPassed (line 266) and practice accessibility via `completedPhases.has('quiz') && quizPassed` (line 328) are inert — masked today because completion is driven by markPhaseCompleted() and allPhasesCompletedOnce short-circuits accessibility (line 318), but it is fragile dead logic.

WHY IT MATTERS:
A reader who passes a quiz offline (provisional pass) and never lands the server IP claim can permanently miss loop-complete Insight Points; the reconciliation written to fix exactly this never runs. The unused gating is misleading for maintainers.

REQUIRED FIX:
Pick one source of truth. Either wire useQuizSession's pass result into setQuizResult so state.quizResult reflects reality (re-enabling the §1.1 effect and the gating), or derive quizPassed from the live session / completedPhases (e.g. quiz.session?.result?.passed === true || completedPhases.has('quiz')) and delete the dead state.quizResult path, setQuizResult, and the §1.1 effect.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY before reporting done:
- npm run typecheck   (must pass)
- npm run test        (must pass)
- npx eslint <each changed file>   (no new errors)
- Summarize the change and paste the command output.
```

---

### M36 — Progress page client redirect race bounces fresh-browser onboarded users off /book/progress
`severity: medium` · `effort: medium` · `files: components/progress/ProgressPage.tsx:402, app/book/hooks/useOnboardingState.ts:255, app/book/hooks/useOnboardingState.ts:265, app/book/page.tsx:21`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: components/progress/ProgressPage.tsx:402, app/book/hooks/useOnboardingState.ts:255, app/book/hooks/useOnboardingState.ts:265, app/book/page.tsx:21

PROBLEM:
useOnboardingState sets hydrated=true immediately after reading localStorage (useOnboardingState.ts:255), with state.setupComplete defaulting to false (defaultState.setupComplete=false, line 114) when localStorage is empty. A SEPARATE async effect (lines 265-279) then fetches /app/api/book/me/onboarding/progress to flip setupComplete. ProgressPage's redirect effect (lines 402-407) fires on `onboardingHydrated && !onboarding.setupComplete` and immediately router.replace('/book'). For an already-onboarded user on a new device / cleared cache, localStorage has no flag → hydrated=true with setupComplete=false → redirect to /book fires BEFORE the async server check resolves. /book then server-checks onboarding and redirects to /dashboard (app/book/page.tsx:21). Net: a returning user clicking 'Progress' lands on /dashboard. Notably, neither WorkspacePage nor LibraryPage has this client redirect — it is isolated to ProgressPage.

WHY IT MATTERS:
Legitimate returning/multi-device users are denied direct access to the Progress page on first visit per browser. It self-recovers (lands on dashboard, not a crash) and only happens once per fresh browser (the line 260 effect persists setupComplete to localStorage once the server check flips it), but the requested page never loads on that first attempt.

REQUIRED FIX:
Don't redirect on the optimistic localStorage default. Add an explicit 'onboarding status resolved' flag to useOnboardingState that becomes true only after the /onboarding/progress fetch settles (success OR catch), and gate ProgressPage.tsx:402 on that flag rather than on bare onboardingHydrated. Alternatively drop the client redirect entirely and rely on the route's server guard (app/book/progress/page.tsx already calls requireDashboardAccess; onboarding-completeness can be enforced server-side as app/book/page.tsx does). At minimum do not call router.replace until the server confirmation has had a chance to run.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY before reporting done:
- npm run typecheck   (must pass)
- npm run test        (must pass)
- npx eslint <each changed file>   (no new errors)
- Summarize the change and paste the command output.
```

---

### L2 — /auth/refresh parses Cognito's token response with un-guarded await tokenRes.json() — a non-JSON 200 surfaces as an uncaught 500
`severity: low` · `effort: trivial` · `files: app/auth/refresh/route.ts:89`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/auth/refresh/route.ts:89

PROBLEM:
The fetch to /oauth2/token is wrapped (refresh:62-78) and !tokenRes.ok is handled (refresh:80-87), but `const tokens = (await tokenRes.json())` at refresh:89 is outside any try/catch. If Cognito or an intervening proxy/WAF returns HTTP 200 with a non-JSON body (e.g. an HTML error/maintenance page during a partial outage), .json() rejects and the route throws → unhandled 500. TokenExpiryGuard treats non-401/non-ok as transient and retries (TokenExpiryGuard:78,86-91), so it self-heals, but the endpoint should return a clean 5xx, not crash.

WHY IT MATTERS:
During a Cognito/edge hiccup returning a 200 non-JSON body, the silent-renewal endpoint 500s instead of a clean 502; noisy errors and a marginally worse retry posture, no session loss.

REQUIRED FIX:
Wrap refresh:89 in try/catch: `let tokens: Record<string,unknown>; try { tokens = (await tokenRes.json()) as Record<string,unknown>; } catch { return NextResponse.json({ ok:false, error:'bad_upstream_body' }, { status:502 }); }`. The callback has the identical un-guarded json() at callback:119 but that one IS inside the route-level try/catch (callback:70-198) so it lands on /?auth=server_error — refresh has no such outer wrapper, hence the exposure is real only here.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY before reporting done:
- npm run typecheck   (must pass)
- npm run test        (must pass)
- npx eslint <each changed file>   (no new errors)
- Summarize the change and paste the command output.
```

---

### L10 — invoice.payment_failed records the wrong Stripe field as the failure reason — admin sees generic "payment_failed" not the decline code
`severity: low` · `effort: small` · `files: app/app/api/book/billing/webhook/route.ts:259-283, app/app/api/book/admin/metrics/billing/route.ts:121-124`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/book/billing/webhook/route.ts:259-283, app/app/api/book/admin/metrics/billing/route.ts:121-124

PROBLEM:
The handler types the invoice with last_finalization_error (route.ts:263) and writes failedPaymentLastReason = invoice.last_finalization_error?.code ?? 'payment_failed' (lines 281-282). Per the Stripe SDK type docstring (node_modules/stripe/types/Invoices.d.ts:293-296), last_finalization_error is 'The error encountered during the previous attempt to finalize the invoice. This field is cleared when the invoice is successfully finalized' — i.e. invoice-finalization failures, a distinct and rare category. The actual card-decline reason (card_declined, insufficient_funds, expired_card) lives on the associated PaymentIntent's last_payment_error.code (PaymentIntents.d.ts), not on the invoice object unless expanded. So in normal card-decline cases the field is undefined and falls back to the literal 'payment_failed'. The admin billing route counts past_due users gated on failedPaymentLastReason (billing/route.ts:122-124) and would surface 'payment_failed' for all of them.

WHY IT MATTERS:
Admin payment-failure intelligence cannot distinguish a declined card from insufficient funds, so dunning/outreach can't be targeted. Admin-only; no user-facing impact.

REQUIRED FIX:
In the invoice.payment_failed branch, read the decline reason from the PaymentIntent. With apiVersion 2024-06-20 the invoice still exposes a top-level payment_intent field (Invoices.d.ts:783), so either fetch the invoice with expand:['payment_intent'] or stripe.invoices.retrieve / paymentIntents.retrieve and use paymentIntent.last_payment_error?.code, falling back to last_finalization_error?.code then 'payment_failed'. This mirrors how invoice.paid already retrieves the charge for billing details (route.ts:317-323) and should be wrapped in the same best-effort try/catch so a retrieve failure never fails the past_due entitlement write.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY before reporting done:
- npm run typecheck   (must pass)
- npm run test        (must pass)
- npx eslint <each changed file>   (no new errors)
- Summarize the change and paste the command output.
```

---

### L12 — Trial-ending email can be re-sent on webhook redelivery (recordStripeWebhookEvent is the only idempotency gate and runs after the send)
`severity: low` · `effort: small` · `files: app/app/api/book/billing/webhook/route.ts:380-412, app/app/api/book/billing/webhook/route.ts:508-521, app/app/api/book/_lib/trial-ending-email.ts:46-121`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/book/billing/webhook/route.ts:380-412, app/app/api/book/billing/webhook/route.ts:508-521, app/app/api/book/_lib/trial-ending-email.ts:46-121

PROBLEM:
For customer.subscription.trial_will_end the durable user-visible side effect is sendTrialEndingEmail (route.ts:409). The event is only marked processed by recordStripeWebhookEvent at the very end (route.ts:518). sendTrialEndingEmail has no per-event dedup — it only checks suppression (trial-ending-email.ts:64). If the email send succeeds but recordStripeWebhookEvent then fails (or the metrics/putOpsMetric catch path rethrows), the handler 500s, Stripe retries, hasStripeWebhookEventBeenProcessed still returns false, and the email sends again.

WHY IT MATTERS:
A user could receive duplicate 'your trial ends soon' emails on a webhook retry. Low frequency, low harm, but it is a transactional pre-charge notice, so duplicates look unprofessional and could draw a spam complaint (which then feeds the suppression list).

REQUIRED FIX:
Gate the send on a ConditionExpression-protected marker write keyed by customer+trial_end (e.g. a conditional Put 'trial_ending_email_sent#<customer>#<trial_end>'); on ConditionalCheckFailed, skip the send. Cheapest acceptable alternative: document the rare duplicate as acceptable. Note the realistic re-send window here is narrow — the email is the LAST side effect before recordStripeWebhookEvent in this branch, so the only trigger is recordStripeWebhookEvent itself (or the outer catch) failing after a successful send; the finding's 'a later step in the same invocation fails' is slightly overstated for this specific branch.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY before reporting done:
- npm run typecheck   (must pass)
- npm run test        (must pass)
- npx eslint <each changed file>   (no new errors)
- Summarize the change and paste the command output.
```

---

### L13 — Disputed-then-paid race can re-activate a chargebacked subscriber (out-of-order webhook delivery)
`severity: low` · `effort: medium` · `files: app/app/api/book/billing/webhook/route.ts:439-487, app/app/api/book/billing/webhook/route.ts:295-354, app/app/api/book/_lib/repo.ts:1818-1819, app/app/api/book/_lib/repo.ts:1920-1921`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/book/billing/webhook/route.ts:439-487, app/app/api/book/billing/webhook/route.ts:295-354, app/app/api/book/_lib/repo.ts:1818-1819, app/app/api/book/_lib/repo.ts:1920-1921

PROBLEM:
charge.dispute.created downgrades to FREE/canceled (route.ts:481-486) with no proSource passed → proSourceValue becomes null (repo.ts:1818-1819: plan FREE ⇒ null). invoice.paid unconditionally sets plan PRO / proStatus active / proSource stripe (route.ts:325-338). The proSource guard (repo.ts:1920-1921) allows the write when proSource is absent OR 'stripe' OR null — and after a dispute it is null — so a delayed/redelivered invoice.paid landing after the dispute downgrade re-activates the chargebacked user to Pro. Stripe does not strictly order delivery across event types, so reordering is possible (low probability).

WHY IT MATTERS:
Edge-case revocation bypass: a user who filed a chargeback regains Pro access if a stale invoice.paid is reprocessed after the dispute. Rare, but a money/entitlement correctness gap on a security-adjacent path.

REQUIRED FIX:
Persist a chargeback/disputed marker on the entitlement when charge.dispute.created fires, and have invoice.paid (and customer.subscription.* PRO transitions) refuse to re-activate while an unresolved dispute marker is present (clear it on charge.dispute.closed with status='won'). Implement via a ConditionExpression on the PRO-activation write (e.g. attribute_not_exists(disputeOpen)). Alternatively, when the stored proStatus is 'canceled', gate invoice.paid re-activation on a live subscriptions.retrieve. The cleaner structural fix is to also make the dispute downgrade set a sticky marker rather than relying on proSource=null, which the guard treats as writable.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY before reporting done:
- npm run typecheck   (must pass)
- npm run test        (must pass)
- npx eslint <each changed file>   (no new errors)
- Summarize the change and paste the command output.
```

---

### L19 — Unsubscribe and settings writes are read-modify-write with no concurrency guard
`severity: low` · `effort: medium` · `files: app/app/api/book/email/unsubscribe/route.ts:159-166, app/app/api/book/me/settings/route.ts:88-124, app/app/api/book/_lib/repo.ts:2472-2502 (putUserSettingsItem)`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/book/email/unsubscribe/route.ts:159-166, app/app/api/book/me/settings/route.ts:88-124, app/app/api/book/_lib/repo.ts:2472-2502 (putUserSettingsItem)

PROBLEM:
Both the one-click unsubscribe POST (route.ts:159-166: getUserSettingsItem → applyUnsubscribe merge → putUserSettingsItem) and the settings PATCH (settings/route.ts:88-124: getUserSettingsItem → mergeSettings → putUserSettingsItem) do get→merge-in-memory→full PutItem. Confirmed putUserSettingsItem (repo.ts:2482-2495) is an unconditional PutCommand that replaces the whole settings object — no version attribute, no ConditionExpression. Two concurrent writers (a user toggling a setting in-app while a one-click unsubscribe lands from their mail client) can lose one update; last-writer-wins. The unsubscribe case is the more important: a clobber could silently re-enable an email category the user just opted out of.

WHY IT MATTERS:
Rare lost-update on settings; worst realistic case is an unsubscribe being overwritten by a near-simultaneous settings save, re-enabling a notification the user disabled — a CASL-relevant correctness concern. Low frequency.

REQUIRED FIX:
Add optimistic concurrency to putUserSettingsItem (store/compare an updatedAt or version attribute via ConditionExpression and retry on mismatch), or perform the unsubscribe flag flips as a targeted DynamoDB UpdateItem on the specific notifications keys (SET notifications.<key> = false) rather than a full-object Put — an UpdateItem on the specific path won't clobber unrelated concurrently-written keys and is the smaller, more robust change for the unsubscribe path specifically.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY before reporting done:
- npm run typecheck   (must pass)
- npm run test        (must pass)
- npx eslint <each changed file>   (no new errors)
- Summarize the change and paste the command output.
```

---

### L20 — Published-catalog query has no pagination (silent truncation as library grows)
`severity: low` · `effort: small` · `files: app/app/api/book/_lib/repo.ts:196-235, app/app/api/book/_lib/library-catalog.ts:124-143, app/app/api/book/books/route.ts:8-24`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/book/_lib/repo.ts:196-235, app/app/api/book/_lib/library-catalog.ts:124-143, app/app/api/book/books/route.ts:8-24

PROBLEM:
listPublishedCatalogItems issues a single QueryCommand (lines 197-207) with no Limit and no LastEvaluatedKey/ExclusiveStartKey loop, and reads res.Items once (line 209). DynamoDB Query returns at most 1MB per page; once the CATALOG partition's BOOK# items exceed ~1MB the query silently returns a partial set, so /books (the public, hour-cached library list) would drop books with no error. Fine for a few dozen books today, latent as the catalog grows.

WHY IT MATTERS:
Once the catalog grows past a single 1MB query page, some published books vanish from the library/catalog with no visible error — confusing and hard to diagnose.

REQUIRED FIX:
Add a pagination loop in listPublishedCatalogItems that follows LastEvaluatedKey (via ExclusiveStartKey) until exhausted, accumulating Items across pages. NOTE: the original fix said this is 'already done elsewhere in the repo' — that is INACCURATE; grep shows zero ExclusiveStartKey usage anywhere in repo.ts, so no existing loop can be copied (other queries cap via Limit instead). Implement the loop fresh; consider applying the same to any other unbounded full-partition scans.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY before reporting done:
- npm run typecheck   (must pass)
- npm run test        (must pass)
- npx eslint <each changed file>   (no new errors)
- Summarize the change and paste the command output.
```

---

### L21 — Local quiz answer key defaults to index 0 when missing, can silently mis-grade
`severity: low` · `effort: small` · `files: app/app/api/book/_lib/content-service.ts:163, app/app/api/book/_lib/quiz-session.ts:150-151, app/app/api/book/_lib/quiz-service.ts:43`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/book/_lib/content-service.ts:163, app/app/api/book/_lib/quiz-session.ts:150-151, app/app/api/book/_lib/quiz-service.ts:43

PROBLEM:
getLocalQuizQuestions defaults correctAnswerIndex to 0 (content-service.ts:163), and the LIVE grading/build path buildQuizAttemptQuestions also falls back to 0 (quiz-session.ts:150-151) when neither correctAnswerIndex nor correctIndex is present. If a quiz question ever ships without an answer-key field, choice index 0 is silently treated as correct with no error, so users are graded against an arbitrary key. Content pipeline is out of scope, but the server shouldn't silently invent an answer.

WHY IT MATTERS:
A single malformed quiz question would silently grade everyone against choice A, producing wrong pass/fail outcomes and corrupting scores/IP for that chapter, with no signal to operators.

REQUIRED FIX:
When correctAnswerIndex/correctIndex is undefined in buildQuizAttemptQuestions (quiz-session.ts:150) and getLocalQuizQuestions (content-service.ts:163), throw a BookApiError(500) or skip the question rather than defaulting to 0, so a content defect fails loudly. Add a publish-time validation that every quiz question has an in-range answer index. Note: the cited quiz-service.ts:43 location is in scoreQuizSubmission, which is DEAD (zero callers — the live submit path uses gradeQuizAttemptQuestions); fix the live paths (quiz-session.ts / content-service.ts) and consider deleting scoreQuizSubmission entirely.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY before reporting done:
- npm run typecheck   (must pass)
- npm run test        (must pass)
- npx eslint <each changed file>   (no new errors)
- Summarize the change and paste the command output.
```

---

### L24 — Consistency score double-counts today and can exceed 100%
`severity: low` · `effort: small` · `files: app/app/api/book/_lib/streak-repo.ts:172-194, app/app/api/book/_lib/streak-repo.ts:278-289, app/app/api/book/_lib/streak-repo.ts:305, app/app/api/book/me/streak/route.ts:34, app/app/api/book/_lib/achievement-repo.ts:246-257`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/book/_lib/streak-repo.ts:172-194, app/app/api/book/_lib/streak-repo.ts:278-289, app/app/api/book/_lib/streak-repo.ts:305, app/app/api/book/me/streak/route.ts:34, app/app/api/book/_lib/achievement-repo.ts:246-257

PROBLEM:
computeConsistencyLast30 (streak-repo.ts:172) COUNTs READINGDAY# records in a 30-day window. addReadingDayActivity (repo.ts:2763) writes today's READINGDAY from the reading-session beacon (reading-sessions/route.ts:76), gated on saveReadingHistory. updateStreakOnLoopComplete persists consistencyLast30 = count + 1 with comment 'today's activity counted' (line 305) and tracks consistencyAbove80Since via consistencyPercent = round(((count+1)/30)*100) (line 281). The GET route reports consistencyScore = round((consistencyLast30 / 30) * 100) with no clamp (route.ts:34). When the beacon already wrote today's READINGDAY, the count already includes today and the +1 double-counts, so a value of 31/30 -> 103% is possible. The Steady-State achievement gate reads consistencyAbove80Since (achievement-repo.ts:247), inheriting the +1 inflation.

WHY IT MATTERS:
Users can see a >100% consistency score and Steady-State can be reached up to a day early. When saveReadingHistory is OFF, no READINGDAY records are ever written so consistency is permanently ~3% (1/30) regardless of real activity — the metric is meaningless for privacy-opted-out users.

REQUIRED FIX:
Drop the artificial +1 (persist consistencyLast30 = count, since the query already includes today once the READINGDAY exists) and clamp the GET-route score with Math.min(100, ...). Better: derive consistency from the streak/loop activity itself (distinct active days) instead of READINGDAY records so it still works when reading history is disabled. Apply the same de-inflation to the consistencyAbove80Since computation at line 281.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY before reporting done:
- npm run typecheck   (must pass)
- npm run test        (must pass)
- npx eslint <each changed file>   (no new errors)
- Summarize the change and paste the command output.
```

---

### L26 — Concurrent redemption of the same one-time reward returns a raw 500 instead of a clean 409 (double-spend is prevented)
`severity: low` · `effort: trivial` · `files: app/app/api/book/me/flow-points/redeem/route.ts:60-68, app/app/api/book/_lib/flow-points-repo.ts:709-723, app/app/api/book/_lib/flow-points-repo.ts:769-781`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/book/me/flow-points/redeem/route.ts:60-68, app/app/api/book/_lib/flow-points-repo.ts:709-723, app/app/api/book/_lib/flow-points-repo.ts:769-781

PROBLEM:
The redeem route's existingClaim check (route.ts:66) is a non-atomic read. Two concurrent redemptions of the same oneTimePerUser reward can both pass it and call redeemFlowPointsReward. The reward-claim Put is TransactItem index 1 (flow-points-repo.ts:709-723) carrying attribute_not_exists, so DynamoDB cancels the losing transaction — no double spend. But the catch only special-cases isTransactionConditionFailedAt(error, 4) (the entitlement guard at index 4) and rethrows everything else, so the index-1 claim conflict surfaces as an unmapped 500 instead of 409 reward_already_claimed.

WHY IT MATTERS:
No financial loss (the second spend is blocked atomically). The user gets an opaque server error instead of 'already claimed', and the 500 pollutes error monitoring as a phantom fault. Only triggers on a genuine concurrent race; the sequential repeat-claim is already handled cleanly by the route-level existingClaim 409.

REQUIRED FIX:
In redeemFlowPointsReward's catch, also detect a cancellation at the reward-claim index (1) via isTransactionConditionFailedAt(error, 1) and throw BookApiError(409, 'reward_already_claimed', ...). Keep the index-4 entitlement case as the active_subscription 409. (Indices: 0=engagement spend, 1=rewardClaim, 2=redemption, 3=ledger, 4=entitlementUpdate — all verified.)

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY before reporting done:
- npm run typecheck   (must pass)
- npm run test        (must pass)
- npx eslint <each changed file>   (no new errors)
- Summarize the change and paste the command output.
```

---

### L30 — Pair invite accept is a TOCTOU with non-conditional writes — concurrent/duplicate accepts can clobber
`severity: low` · `effort: small` · `files: app/app/api/book/_lib/pair-repo.ts:60-141`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/book/_lib/pair-repo.ts:60-141

PROBLEM:
acceptPairInvite (pair-repo.ts:60-141) GETs the invite, checks status==='pending' (line 75), checks neither user already has an active pair (lines 80-83), then writes both pair records and the invite-accepted record via Promise.all with NO ConditionExpression on any of the three PutCommands (lines 97-138). The invite Put (lines 126-137) unconditionally overwrites the whole item to status:'accepted'. Two concurrent accepts of the same code (or an accept racing another pairing of the inviter) can both pass the read-time checks and both write; there is no attribute_not_exists guard on the pair PUTs nor a 'still pending' condition at write time. Note createPairInvite correctly uses ConditionExpression attribute_not_exists(PK) and deletePair uses attribute_exists(PK) — accept is the unguarded outlier.

WHY IT MATTERS:
Low likelihood (requires concurrent requests on the same low-value invite code) and no money/data loss — blast radius is an inconsistent/duplicated partner link or an invite marked accepted by the wrong party.

REQUIRED FIX:
Convert the three writes to a TransactWriteCommand (or add ConditionExpression: '#status = :pending' to the invite Put and attribute_not_exists(PK) AND attribute_not_exists(SK) to the pair Puts) so a losing concurrent accept fails cleanly and returns 'Invite already used' instead of clobbering.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY before reporting done:
- npm run typecheck   (must pass)
- npm run test        (must pass)
- npx eslint <each changed file>   (no new errors)
- Summarize the change and paste the command output.
```

---

### L31 — journeys/[journeyId]/start does not validate the journeyId exists in definitions
`severity: low` · `effort: trivial` · `files: app/app/api/book/me/journeys/[journeyId]/start/route.ts:12-32, app/app/api/book/me/journeys/[journeyId]/route.ts:20-25`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/book/me/journeys/[journeyId]/start/route.ts:12-32, app/app/api/book/me/journeys/[journeyId]/route.ts:20-25

PROBLEM:
start/route.ts creates a journey record for any arbitrary journeyId (it only enforces max-3-active at lines 19-23 and not-already-started at 26-28), then calls startJourney. Unlike the GET route (route.ts:20-25) which loads journeyDefinitions and 404s on unknown ids, start never validates journeyId against the definitions. A user can POST /me/journeys/garbage/start and persist a phantom journey that occupies one of their 3 active slots and can never complete (no definition -> checkAndAdvanceJourneys skips it).

WHY IT MATTERS:
Minor, self-inflicted: a user or buggy client can clutter their own journey list with non-existent journeys and consume active-journey slots. No cross-user impact.

REQUIRED FIX:
In start/route.ts, import journeyDefinitions (same source the GET route uses) and return bookErr(req, 404, 'not_found', 'Journey not found') when no def matches journeyId, before listUserJourneys/startJourney. (Definitions live under content/ which is out of audit scope, but the import already exists in the sibling GET route.)

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY before reporting done:
- npm run typecheck   (must pass)
- npm run test        (must pass)
- npx eslint <each changed file>   (no new errors)
- Summarize the change and paste the command output.
```

---

### L32 — events join does not validate the event exists/is active
`severity: low` · `effort: trivial` · `files: app/app/api/book/me/events/[eventId]/join/route.ts:12-26, app/app/api/book/_lib/events-repo.ts:11-45, app/app/api/book/_lib/admin-events-repo.ts:23`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/book/me/events/[eventId]/join/route.ts:12-26, app/app/api/book/_lib/events-repo.ts:11-45, app/app/api/book/_lib/admin-events-repo.ts:23

PROBLEM:
join/route.ts checks only for an existing participation (getEventProgress at line 18) then calls joinEvent (events-repo.ts:11-45) which persists an EVENT_PARTICIPATION record for any eventId with no check against the event-definitions store or active window. A user can join a nonexistent or expired event; it just sits in their list. recordEventChapter only credits joined+active events (submit/route.ts:761-781 filters by active window), so there is no reward exploit — just junk participation rows.

WHY IT MATTERS:
Minor self-inflicted clutter; no reward or cross-user impact.

REQUIRED FIX:
In join/route.ts, call getEventDefinition(tableName, eventId) (admin-events-repo.ts:23) first and return bookErr(req, 404, 'not_found', ...) if missing (optionally reject events outside their start/end window) before joinEvent.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY before reporting done:
- npm run typecheck   (must pass)
- npm run test        (must pass)
- npx eslint <each changed file>   (no new errors)
- Summarize the change and paste the command output.
```

---

### L33 — recordEventChapter dereferences eventDef.badge unconditionally in the completion notification
`severity: low` · `effort: trivial` · `files: app/app/api/book/_lib/events-repo.ts:146-164, app/app/api/book/me/quiz/[bookId]/[chapterNumber]/submit/route.ts:758-791`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/book/_lib/events-repo.ts:146-164, app/app/api/book/me/quiz/[bookId]/[chapterNumber]/submit/route.ts:758-791

PROBLEM:
On event completion the badge persist is guarded by if (eventDef.badge?.badgeId) (events-repo.ts:146), correctly treating badge as possibly-absent, but the createNotification call reads eventDef.badge.badgeId without optional chaining (line 161). For a badge-less event definition, line 161 throws a synchronous TypeError while building the metadata object — before the createNotification(...).catch() promise is created, so the .catch does NOT catch it. The sole caller (submit/route.ts:758-791) wraps recordEventChapter in an event_tracking try/catch, so there is no request crash, but the completion notification is lost and event_tracking is logged as a partial failure (and IP award + badge persist, which run before line 154, do complete).

WHY IT MATTERS:
Defensive/robustness: for a badge-less event, completers silently get no completion notification and a partial-failure error is logged. Bounded because the admin create route currently enforces badge, but the seed-from-JSON path is not validated here.

REQUIRED FIX:
Change line 161 to badgeId: eventDef.badge?.badgeId ?? null (match the guard already used on line 146).

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY before reporting done:
- npm run typecheck   (must pass)
- npm run test        (must pass)
- npx eslint <each changed file>   (no new errors)
- Summarize the change and paste the command output.
```

---

### L34 — Device token SK truncates endpoint to last 32 alphanumerics — collision can drop a user's device
`severity: low` · `effort: small` · `files: app/app/api/book/_lib/keys.ts:254-257, app/app/api/book/me/devices/register/route.ts:25-40`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/book/_lib/keys.ts:254-257, app/app/api/book/me/devices/register/route.ts:25-40

PROBLEM:
deviceTokenSk(endpoint) = `DEVICE#` + endpoint.slice(-32).replace(/[^a-zA-Z0-9]/g,'') (keys.ts:254-257). Using only the last 32 alphanumeric chars of the push endpoint as the key risks two distinct endpoints colliding to the same SK. The register PutCommand (register/route.ts:25-40) has NO ConditionExpression, so a second device whose endpoint shares those trailing chars overwrites the first device's record. Register/unregister use the same hash so they stay self-consistent, but the notification fanout (begins_with DEVICE#) would then only ever see one of the colliding devices.

WHY IT MATTERS:
Low probability (real push endpoints have high-entropy distinct tails) but on collision a user silently loses push on one device. No security impact (send is allowlist-guarded regardless).

REQUIRED FIX:
Key the device record on a stable hash of the FULL endpoint (e.g. createHash('sha256').update(endpoint).digest('base64url')) in deviceTokenSk, keeping register/unregister using the same function so they stay aligned.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY before reporting done:
- npm run typecheck   (must pass)
- npm run test        (must pass)
- npx eslint <each changed file>   (no new errors)
- Summarize the change and paste the command output.
```

---

### L37 — Filtered scan with Limit returns fewer rows than expected (ingestion jobs / metrics) — silent under-counting
`severity: low` · `effort: small` · `files: app/app/api/book/admin/metrics/ops/route.ts:144-164 (fetchIngestionJobs)`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/book/admin/metrics/ops/route.ts:144-164 (fetchIngestionJobs)

PROBLEM:
fetchIngestionJobs issues a single ScanCommand with FilterExpression entity=BOOK_INGEST_JOB and Limit:50, then sorts and slices the first 20. In DynamoDB, Limit caps items SCANNED (pre-filter), not items MATCHED, and there is no LastEvaluatedKey loop. If the table has many non-ingest-job items, the 50-item scan window can be consumed by unrelated rows and return 0-few jobs even when dozens exist. The notifications-route reference cited in the original finding is actually the acceptable, warned, capped path — the real defect is isolated to fetchIngestionJobs.

WHY IT MATTERS:
The Ops dashboard's recent-ingestions panel can show stale or no jobs even when recent ingestions exist.

REQUIRED FIX:
Paginate fetchIngestionJobs until enough matching jobs are collected (bounded page count, like listRecentOpsFailures does), OR store ingestion jobs under a queryable PK (e.g. PK=BOOK_INGEST_JOBS, SK=createdAt) and Query so Limit applies to matches and ScanIndexForward gives recency for free.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY before reporting done:
- npm run typecheck   (must pass)
- npm run test        (must pass)
- npx eslint <each changed file>   (no new errors)
- Summarize the change and paste the command output.
```

---

### L38 — Segment filters stored without server-side validation of field/operator/value
`severity: low` · `effort: small` · `files: app/app/api/book/admin/segments/route.ts:35-50, app/app/api/book/admin/segments/[segmentId]/route.ts:43-53, app/app/api/book/_lib/segment-engine.ts:69-111`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/book/admin/segments/route.ts:35-50, app/app/api/book/admin/segments/[segmentId]/route.ts:43-53, app/app/api/book/_lib/segment-engine.ts:69-111

PROBLEM:
POST validates only that filters is a non-empty array, then persists body.filters verbatim (typed as SegmentFilter[] with no runtime check). PATCH does even less — it spreads body.filters in if present, with no array or element validation. evaluateFilter falls through to `return false` for unknown fields, and compareString/compareNumber return false for unknown operators, so a malformed/stale filter silently matches zero users. A saved segment can quietly become empty (e.g. a renamed field), and a notify against it targets 0 users with no signal the definition is invalid.

WHY IT MATTERS:
An admin can save a segment that silently matches nobody (typo'd field/operator, or a field renamed later), then send a campaign believing it targeted users. Admin-only, low blast radius, but causes confusing dead segments.

REQUIRED FIX:
Validate each filter on write in BOTH POST and PATCH against the SegmentFilterField/SegmentFilterOperator unions: reject unknown field/operator, require value where the operator needs one, coerce numeric values, bound the array length. Return a 400 naming the offending filter rather than persisting it.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY before reporting done:
- npm run typecheck   (must pass)
- npm run test        (must pass)
- npx eslint <each changed file>   (no new errors)
- Summarize the change and paste the command output.
```

---

### L39 — events POST casts body.books to string[] without per-element validation
`severity: low` · `effort: trivial` · `files: app/app/api/book/admin/events/route.ts:46-49, app/app/api/book/admin/events/[eventId]/route.ts:55`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/book/admin/events/route.ts:46-49, app/app/api/book/admin/events/[eventId]/route.ts:55

PROBLEM:
Seasonal-event create validates books is a non-empty array but then `const books = body.books as string[]` with no per-element type check (route.ts:46-49). PATCH does `Array.isArray(body.books) ? (body.books as string[]) : existing.books` (eventId/route.ts:55), also unchecked. A payload like {books:[1,null,{}]} is persisted as-is, and downstream event/badge logic that joins these into book lookups mishandles non-string IDs.

WHY IT MATTERS:
Malformed event definitions can be saved and later break the user-facing seasonal-event experience (broken book references) with no validation error at create/update time.

REQUIRED FIX:
Validate body.books.every(b => typeof b === 'string' && b.length > 0) (and bound the array length) before persisting in both the POST and PATCH handlers; reject with a 400 otherwise.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY before reporting done:
- npm run typecheck   (must pass)
- npm run test        (must pass)
- npx eslint <each changed file>   (no new errors)
- Summarize the change and paste the command output.
```

---

### L45 — summarizeProgress 'booksCompleted' uses a fragile chapter-number-vs-count heuristic
`severity: low` · `effort: medium` · `files: app/app/api/book/_lib/repo.ts:2179-2187, app/app/api/book/me/progress/route.ts:23`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/book/_lib/repo.ts:2179-2187, app/app/api/book/me/progress/route.ts:23

PROBLEM:
booksCompleted++ when `p.completedChapters.length > 0 && p.currentChapterNumber <= p.completedChapters.length`. This compares a chapter NUMBER to a COUNT and never references the book's real chapterCount. Concrete over-count: a 10-chapter book where the user finished ch1-3 and is parked on ch3 (currentChapterNumber=3, completedChapters.length=3) is counted 'completed' though 7 chapters remain. Out-of-order completion mis-counts in both directions. Feeds me/progress summary (verified caller).

WHY IT MATTERS:
Profile/dashboard 'books completed' can over- or under-count, undermining a primary gamification surface.

REQUIRED FIX:
Join progress to the catalog/manifest chapterCount and require completedChapters.length >= chapterCount. Effort is medium because summarizeProgress is a pure function over progress entries — it needs the per-book chapterCount threaded in (e.g. a Map<bookId,chapterCount> from listPublishedCatalogItems/manifests).

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY before reporting done:
- npm run typecheck   (must pass)
- npm run test        (must pass)
- npx eslint <each changed file>   (no new errors)
- Summarize the change and paste the command output.
```

---

### L46 — getLambdaHealth reports the MEDIAN of per-bucket percentiles instead of the percentile
`severity: low` · `effort: small` · `files: app/app/api/book/_lib/cloudwatch-metrics.ts:158-186, app/app/api/book/_lib/cloudwatch-metrics.ts:98-105`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/book/_lib/cloudwatch-metrics.ts:158-186, app/app/api/book/_lib/cloudwatch-metrics.ts:98-105

PROBLEM:
Duration is fetched in 1h buckets (Period:3600) with ExtendedStatistics p50/p95/p99. Each bucket's p95 is collected into p95s[], sorted, then durationP95Ms = Math.round(quantile(p95s, 50)). quantile(sorted,50) returns sorted[floor(0.5*len)] — the median of the 24 hourly p95s, not the 24h p95. Same for P50 and P99 (all wrap quantile(...,50)). This systematically under-reports tail latency. coldStarts is hardcoded 0 with a 'placeholder' comment.

WHY IT MATTERS:
Admin Lambda-health dashboard understates p95/p99, masking a tail-latency regression before launch. Admin-only, informational.

REQUIRED FIX:
Fetch a single 24h-period datapoint (Period:86400) with ExtendedStatistics p50/p95/p99 so CloudWatch computes the true percentile; OR at minimum use max(p95s) as a conservative bound. Remove the quantile(...,50) wrapper. Implement coldStarts (init-duration metric) or drop the field.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY before reporting done:
- npm run typecheck   (must pass)
- npm run test        (must pass)
- npx eslint <each changed file>   (no new errors)
- Summarize the change and paste the command output.
```

---

### L47 — deviceTokenSk hashes only the last 32 chars of the endpoint, risking key collisions
`severity: low` · `effort: trivial` · `files: app/app/api/book/_lib/keys.ts:254-257`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/book/_lib/keys.ts:254-257

PROBLEM:
deviceTokenSk = 'DEVICE#' + endpoint.slice(-32).replace(/[^a-zA-Z0-9]/g,''). Used as the SK for device tokens (register/unregister routes). The code is as described, BUT the finding's collision rationale is wrong: real web-push endpoints (FCM https://fcm.googleapis.com/fcm/send/<token>, Mozilla autopush .../wpush/v2/<token>) carry their COMMON host/path at the FRONT and their UNIQUE high-entropy token at the END. slice(-32) keeps the TAIL, i.e. the distinguishing token, and drops the shared prefix — the opposite of 'endpoints share long common suffixes'. So the realistic collision probability for the major providers is very low (the trailing 32 alphanumerics sit inside the random token).

WHY IT MATTERS:
Two of a user's device endpoints colliding (one silently overwriting the other) is possible in principle but unlikely for FCM/Mozilla because the entropy lives in the trailing 32 chars. Low blast radius today.

REQUIRED FIX:
Still cheap and strictly safer: SK = 'DEVICE#' + sha256(endpoint).slice(0,N) over the FULL endpoint, guaranteeing distinct endpoints map to distinct keys regardless of provider format. Trivial change.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY before reporting done:
- npm run typecheck   (must pass)
- npm run test        (must pass)
- npx eslint <each changed file>   (no new errors)
- Summarize the change and paste the command output.
```

---

### L56 — Hero/Problem make unsourced absolute retention claims ('only proven method', 'forget the majority within weeks')
`severity: low` · `effort: trivial` · `files: components/sections/Hero.tsx:100-103, components/sections/Problem.tsx:230-236`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: components/sections/Hero.tsx:100-103, components/sections/Problem.tsx:230-236

PROBLEM:
Hero.tsx:100 states 'Most readers forget the majority of a book within weeks' as fact. Problem.tsx:234-235 attribution asserts 'Based on Ebbinghaus's Forgetting Curve — active recall is the only proven method to beat it.' 'Only proven method' is an overstatement (spaced repetition, the testing effect, elaboration, interleaving are also evidence-backed — and SocialProof itself credibly cites 'spaced repetition AND active recall'), and the forgetting-curve figure carries no citation. SocialProof.tsx:12-17 documents a deliberate truth rule (no fabricated personas), so these absolute claims are inconsistent with the site's own honesty posture.

WHY IT MATTERS:
Pre-launch marketing-claim risk: absolute/unsourced efficacy statements are weaker to defend than the hedged copy used elsewhere.

REQUIRED FIX:
Soften Problem.tsx attribution to e.g. 'active recall is one of the most reliably proven ways to beat it' and either cite Ebbinghaus or frame the Hero line as 'research on the forgetting curve shows...'. Keep consistency with SocialProof's truth-rule comment and its own 'spaced repetition and active recall' phrasing.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY before reporting done:
- npm run typecheck   (must pass)
- npm run test        (must pass)
- npx eslint <each changed file>   (no new errors)
- Summarize the change and paste the command output.
```

---

### L58 — Privacy Policy effective date (April 2, 2026) predates the data practices it describes; CASL/analytics sections are newer than the stated date
`severity: low` · `effort: trivial` · `files: app/legal/privacy/page.tsx:18-19, app/legal/privacy/page.tsx:36-45, app/legal/privacy/page.tsx:150-171`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/legal/privacy/page.tsx:18-19, app/legal/privacy/page.tsx:36-45, app/legal/privacy/page.tsx:150-171

PROBLEM:
Privacy is dated 'April 2, 2026' but documents practices that match the June 2026 build: opt-in analytics with ip-api.com geolocation (privacy:36-45, 89), the Anthropic scenario-review pipeline (privacy:88), CASL email controls (privacy:150-171), and the refresh-token/auth_expires_at session model (privacy:73). The Refund/Copyright/Data-Rights pages all carry 'June 10, 2026', so the April date is a missed bump rather than an intentional older snapshot. This overlaps the version-mismatch finding (#3) but is flagged separately because it also affects users who expect the effective date to reflect when these specific analytics/location/CASL provisions took effect.

WHY IT MATTERS:
Minor accuracy/consistency issue; an effective date earlier than the practices it documents looks careless and could be cited in a privacy complaint as evidence the policy was not kept current. Largely subsumed by finding #3's fix.

REQUIRED FIX:
Bump privacy/page.tsx:18 (and terms/page.tsx:18) effective dates to June 10, 2026 to align with the other three legal pages and LEGAL_TERMS_VERSION; keep them in sync going forward (ideally derive from LEGAL_TERMS_VERSION). Fixing #3 resolves this.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY before reporting done:
- npm run typecheck   (must pass)
- npm run test        (must pass)
- npx eslint <each changed file>   (no new errors)
- Summarize the change and paste the command output.
```

---

### L62 — UnlockCelebration currentStreak prop is never wired; route's real streak/points are parsed then discarded
`severity: low` · `effort: small` · `files: app/onboarding/components/OnboardingFlow.tsx:82-86, app/onboarding/components/StepFirstLoop.tsx:221-224, app/onboarding/components/UnlockCelebration.tsx:18,55-57`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/onboarding/components/OnboardingFlow.tsx:82-86, app/onboarding/components/StepFirstLoop.tsx:221-224, app/onboarding/components/UnlockCelebration.tsx:18,55-57

PROBLEM:
UnlockCelebration accepts an optional currentStreak prop (line 18) and renders dayStreak = (currentStreak>0 ? currentStreak : 1) (55-57). StepFirstLoop renders <UnlockCelebration quizScore={quizScore} onFinish={...}/> with no currentStreak (221-224). OnboardingFlow.handleFinish does `try { await resp.json(); } catch {}` (82-86), parsing then discarding the route body (which returns points + currentStreak). So dayStreak always falls back to 1 and Insight Points to the static INSIGHT_POINTS_AMOUNTS sum. For a first completion these coincide with reality (streak=1), so it's cosmetic today but the plumbing is dead and will desync on any grant/streak change (e.g. idempotent re-completion granting 0).

WHY IT MATTERS:
Numbers are right by coincidence today; the celebration doesn't read server truth, so future changes to grant/streak logic silently desync the celebration from the account.

REQUIRED FIX:
Have handleFinish capture the parsed { points, currentStreak } and thread it back (return value or lifted state) through StepFirstLoop into UnlockCelebration's currentStreak prop, so the screen shows what the route actually credited rather than the hardcoded 1.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY before reporting done:
- npm run typecheck   (must pass)
- npm run test        (must pass)
- npx eslint <each changed file>   (no new errors)
- Summarize the change and paste the command output.
```

---

### L73 — Reflection filter and "reflection" entry type never produced by the notebook API (always-empty filter)
`severity: low` · `effort: trivial` · `files: app/book/notebook/NotebookClient.tsx:157-170,24,31, app/app/api/book/me/notebook/route.ts:50-112`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/book/notebook/NotebookClient.tsx:157-170,24,31, app/app/api/book/me/notebook/route.ts:50-112

PROBLEM:
NotebookClient renders a fixed filter set ['all','note','reflection','bookmark','commitment'] (line 157) with a 'Reflection' label (TYPE_LABELS line 31) and icon (line 24). The /me/notebook route only ever emits type 'note' (route.ts:54), 'bookmark' (line 73), and 'commitment' (line 107) — never 'reflection'. Selecting the 'Reflection' filter always yields the empty 'No entries match' state.

WHY IT MATTERS:
A permanently-dead filter tab that always returns zero results, implying the user has no reflections.

REQUIRED FIX:
Cheapest: drop 'reflection' from the NotebookClient filter list (and remove its now-unused TYPE_LABELS/icon entries). Alternatively have the API classify commitment follow-through as type 'reflection' so the tab has content.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY before reporting done:
- npm run typecheck   (must pass)
- npm run test        (must pass)
- npx eslint <each changed file>   (no new errors)
- Summarize the change and paste the command output.
```

---

### L75 — Division-by-zero NaN width on journey/event progress bars when a journey has 0 books
`severity: low` · `effort: trivial` · `files: app/book/journeys/JourneysClient.tsx:112,154, app/book/journeys/[journeyId]/JourneyDetailClient.tsx:150-151`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/book/journeys/JourneysClient.tsx:112,154, app/book/journeys/[journeyId]/JourneyDetailClient.tsx:150-151

PROBLEM:
JourneysClient sets the active-journey bar width as `${(completedCount / totalBooks) * 100}%` (line 154) with totalBooks = journey.books.length (line 112) and no zero-guard; an empty books array makes width 'NaN%' (invalid style). JourneyDetailClient already guards the same computation with `totalBooks > 0 ? ... : 0` (line 151), so the list view is inconsistent with its own detail view. Only fires on a malformed/empty journey definition; current content ships non-empty journeys.

WHY IT MATTERS:
A malformed/empty journey definition renders a broken NaN% progress bar in the list view. Limited because current content has books.

REQUIRED FIX:
In JourneysClient line 154 mirror the detail view: style={{ width: totalBooks > 0 ? `${(completedCount/totalBooks)*100}%` : '0%' }}.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY before reporting done:
- npm run typecheck   (must pass)
- npm run test        (must pass)
- npx eslint <each changed file>   (no new errors)
- Summarize the change and paste the command output.
```

---

### L76 — BadgeCelebration hero effect has stale-closure deps and uncleared staggered timeouts
`severity: low` · `effort: small` · `files: app/book/badges/components/BadgeCelebration.tsx:64-118`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/book/badges/components/BadgeCelebration.tsx:64-118

PROBLEM:
The hero-celebration useEffect depends only on [heroBadge, dismissed, reduced] (line 88) but reads heroLevel, sorted, onDismiss and calls handleDismissHero (which reads remainingBadges/onDismiss) — none in deps — so it captures stale values across re-renders. handleDismissHero schedules a chain of setTimeout toast pushes (lines 96-105, 108-113) that are never tracked or cleared on unmount or when newlyEarned changes mid-sequence, risking setState-after-unmount and replayed/late toasts. getCelebrationLevel maps silver/gold->modal and platinum/secret->epic (lines 31-34), and the modal/epic dismiss paths are exactly the ones that schedule the uncleared timeouts, so this is reachable on any non-bronze burst. Mostly benign on the common path because newlyEarned clears on dismiss.

WHY IT MATTERS:
Edge-case React state-after-unmount warnings and possible duplicated/late toasts during rapid badge bursts; not a crash on the common path.

REQUIRED FIX:
Track the staggered timeout ids in a ref and clear them in the effect cleanup and on dismiss; wrap handleDismissHero in useCallback and add the read values (heroLevel, sorted, onDismiss) to the effect dependency array (or pass them in).

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY before reporting done:
- npm run typecheck   (must pass)
- npm run test        (must pass)
- npx eslint <each changed file>   (no new errors)
- Summarize the change and paste the command output.
```

---

### L79 — Streak alerts can stay enabled (and fire) after streak mode is turned off
`severity: low` · `effort: trivial` · `files: app/book/settings/BookSettingsClient.tsx:1222-1245, app/book/settings/BookSettingsClient.tsx:331-338, infra/lambda/lib/streak-at-risk.ts:51-52, app/app/api/book/_lib/streak-repo.ts:229-316`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/book/settings/BookSettingsClient.tsx:1222-1245, app/book/settings/BookSettingsClient.tsx:331-338, infra/lambda/lib/streak-at-risk.ts:51-52, app/app/api/book/_lib/streak-repo.ts:229-316

PROBLEM:
The 'Streak alerts' toggle (streakReminderEnabled) is only rendered when ext.streakMode !== 'off' (BookSettingsClient.tsx:1224). handleStreakModeChange (331-338) only patchExt({ streakMode }) and setOnboardingStreakMode(...) — it leaves streakReminderEnabled at its prior value (e.g. true). The streak-at-risk Lambda gates only on settings.notifications.streakReminderEnabled === false (streak-at-risk.ts:52); it never consults streakMode. Confirmed further: server-side streak accrual in streak-repo.ts (called from quiz submit / audio routes) updates currentStreak/lastActiveDate regardless of streakMode, so a user who turns streak tracking off still has a live streak record that satisfies the Lambda's currentStreak >= 2 check.

WHY IT MATTERS:
A user who disables streak tracking can still receive 'streak about to expire' emails/in-app nudges they thought they turned off — contradicts the explicit 'No streak tracking' setting. Low: notification noise/inconsistency, not data loss.

REQUIRED FIX:
In handleStreakModeChange, when mode === 'off' also patchSection('notifications', { streakReminderEnabled: false }) so the server stops sending streak alerts (and re-enable or leave to user when turning back on). Defense in depth: have processStreakAtRisk additionally skip users whose streak tracking is disabled (would require surfacing streakMode/streakTrackingEnabled into the settings the Lambda scans).

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY before reporting done:
- npm run typecheck   (must pass)
- npm run test        (must pass)
- npx eslint <each changed file>   (no new errors)
- Summarize the change and paste the command output.
```

---

### L81 — Currency-formatted KPIs always render a bare '$' though amounts are CAD
`severity: low` · `effort: small` · `files: app/book/admin/_components/KPITile.tsx:92-98, app/book/admin/_clients/RevenueClient.tsx:104-115, app/book/admin/_clients/BillingClient.tsx:109-120`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/book/admin/_components/KPITile.tsx:92-98, app/book/admin/_clients/RevenueClient.tsx:104-115, app/book/admin/_clients/BillingClient.tsx:109-120

PROBLEM:
KPITile.formatValue (KPITile.tsx:94) hardcodes `$${value.toLocaleString()}` for format='currency'. The revenue/billing endpoints return currency:'CAD' (RevenueClient mrr.currency / arr.currency, BillingClient data.currency), but MRR/ARR/Real-MRR tiles show e.g. '$12,345' with the currency code appearing only in the small hint text (RevenueClient.tsx:108,114; BillingClient.tsx:113,119). A bare '$' reads as USD to anyone scanning the KPIs.

WHY IT MATTERS:
Revenue KPIs are ambiguous and can be misread as USD by anyone scanning (investors, finance), potentially overstating real money by the CAD/USD spread. Low severity since the code is present in the hint.

REQUIRED FIX:
Add a `currency?: string` prop to KPITile and render it in formatValue, e.g. `$${value.toLocaleString()}${currency ? ` ${currency}` : ''}` or use Intl.NumberFormat(undefined,{style:'currency',currency}). Pass data.mrr.currency/arr.currency (RevenueClient) and data.currency (BillingClient) through the prop.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY before reporting done:
- npm run typecheck   (must pass)
- npm run test        (must pass)
- npx eslint <each changed file>   (no new errors)
- Summarize the change and paste the command output.
```

---

### L85 — Reading 'Sans-Serif' option maps to Inter, which is never loaded
`severity: low` · `effort: trivial` · `files: app/book/hooks/useBookPreferences.ts:879-884`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/book/hooks/useBookPreferences.ts:879-884

PROBLEM:
fontMap['sans-serif'] = '"Inter", "system-ui", sans-serif' (line 881), and it is also the default fallback (line 884: `|| fontMap["sans-serif"]`). Inter is not loaded anywhere -- layout.tsx loads Plus Jakarta Sans, JetBrains Mono, and local Satoshi; grep for 'Inter' in layout/globals finds only the substring in the comment 'Interactive'. So selecting the Sans-Serif reading font (and the default state) renders in system-ui, never Inter, and never the body brand font (Jakarta). The option is effectively 'system default' mislabeled and visually inconsistent with the app font.

WHY IT MATTERS:
Minor: the sans-serif reading preference (and default) does not deliver the intended typeface; reading surface font diverges from the rest of the app. Worse than 'just one option' because it is also the fallback default.

REQUIRED FIX:
Map 'sans-serif' to the already-loaded brand var: '"sans-serif": `var(--font-jakarta), system-ui, sans-serif`' (matches body brand font), or load Inter via next/font/google if Inter specifically is intended. Update both line 881 and the fallback expression at 884.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY before reporting done:
- npm run typecheck   (must pass)
- npm run test        (must pass)
- npx eslint <each changed file>   (no new errors)
- Summarize the change and paste the command output.
```

---

### L86 — Dialog/Sheet has no nested-dialog stack: a second open overlay breaks Escape and the focus trap
`severity: low` · `effort: medium` · `files: components/ui/Dialog.tsx:76-139`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: components/ui/Dialog.tsx:76-139

PROBLEM:
OverlayShell registers its Escape (76-86) and Tab focus-trap (92-139) handlers on `document`, one set per open instance. If two overlays are open at once: (a) Escape's e.stopPropagation() does not stop the OTHER document-level keydown listener (sibling document listeners are unaffected by stopPropagation), so one Escape closes BOTH; (b) both focus-trap handlers run and fight over which panel gets focus; (c) there is no z-index/topmost tracking (every overlay uses z-[100]). The shared primitive is used by many modals (ExportModal, DangerZone, RefreshPreferencesModal in settings; ChapterCompleteModal, SessionModeOverlay, NotesDrawer in the reader; BadgeCelebration, BadgeDetailModal in badges). No current flow demonstrably opens two simultaneously today (so it does not reproduce now), but co-located modals (e.g. a NotesDrawer Sheet open when ChapterCompleteModal fires, or a confirm inside a settings modal) make it likely the first time a nested flow ships.

WHY IT MATTERS:
Latent: any future nested-modal flow will close both layers on Escape and have a confused focus trap -- an a11y/UX regression. Low because it does not reproduce on current routes.

REQUIRED FIX:
Maintain a module-level stack of open overlay ids. On open, push a unique id; on cleanup, pop. Only the topmost overlay (id === stack[stack.length-1]) handles Escape and runs the Tab focus trap; non-top overlays no-op their handlers. Optionally derive z-index from stack depth so a nested overlay renders above its parent. This makes the primitive safe for nesting without changing the public API.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY before reporting done:
- npm run typecheck   (must pass)
- npm run test        (must pass)
- npx eslint <each changed file>   (no new errors)
- Summarize the change and paste the command output.
```

---

### P7 — estimateMonthlyCost uses hardcoded US-region on-demand prices and a 30-day month
`severity: polish` · `effort: small` · `files: app/app/api/book/_lib/cloudwatch-metrics.ts:292-334`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/book/_lib/cloudwatch-metrics.ts:292-334

PROBLEM:
Hardcodes DynamoDB $1.25/M writes, $0.25/M reads, $0.25/GB storage; Lambda $0.20/M + $0.0000166667/GB-s; S3 ($0.023/GB further down). daysPerMonth=30. dynamoWritesLast24h/ReadsLast24h are optional and default to 0, so a caller omitting them reports DynamoDB cost as storage-only. Admin-only 'rough' estimate.

WHY IT MATTERS:
Admin cost dashboard can be materially off (region/price drift, missing read/write inputs). Labeled rough, not used for billing.

REQUIRED FIX:
Move price constants into one documented config tagged with region + date-of-pricing; require the read/write inputs (or label the output 'storage-only' when absent).

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY before reporting done:
- npm run typecheck   (must pass)
- npm run test        (must pass)
- npx eslint <each changed file>   (no new errors)
- Summarize the change and paste the command output.
```

---

### P8 — CurrentYear renders on the server, risking a stale copyright year and a year-boundary hydration mismatch
`severity: polish` · `effort: trivial` · `files: components/sections/CurrentYear.tsx:1-3, components/sections/Footer.tsx:103, app/books/page.tsx:16`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: components/sections/CurrentYear.tsx:1-3, components/sections/Footer.tsx:103, app/books/page.tsx:16

PROBLEM:
CurrentYear.tsx is a plain (non-'use client') server component calling new Date().getFullYear(), used in the server-rendered Footer (Footer.tsx:103). For statically/ISR-rendered pages (/books has revalidate=3600; the home page is largely static) the year is captured at render/build time on the server, so it can lag the real year until the next revalidation, and a client re-render exactly at a New Year boundary could mismatch the server year (hydration warning — though layout.tsx sets suppressHydrationWarning on <html>, which would mask it for the whole tree).

WHY IT MATTERS:
Minor: the footer could show last year's copyright for a window after Jan 1 on cached pages, plus an edge-case hydration nuance. Cosmetic/robustness only.

REQUIRED FIX:
Make CurrentYear a client component ('use client') and compute the year in a mount effect (render a stable placeholder during SSR), or pass a year prop from a dynamic boundary. Simplest: client-only for a copyright line. (Note: <html suppressHydrationWarning> in layout.tsx already suppresses the warning globally, so the real residual risk is the stale-year-on-cached-page, not a visible console warning.)

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY before reporting done:
- npm run typecheck   (must pass)
- npm run test        (must pass)
- npx eslint <each changed file>   (no new errors)
- Summarize the change and paste the command output.
```
