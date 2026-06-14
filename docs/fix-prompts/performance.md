# Fix prompts — Performance

_8 items (1 high, 5 medium, 2 low). ChapterFlow production-readiness remediation — branch `main` (e90937368)._

## Shared context (every prompt below assumes this)

**App:** ChapterFlow — a Next.js 16 (App Router, React 19) "book learning" web app. **These prompts target the `main` branch** (commit e90937368, the freshly-merged post-UI-overhaul-integration state). Backend = DynamoDB single-table (`app/app/api/book/_lib/repo.ts`) behind Cognito JWT auth (`requireUser`/`requireActiveBookUser`/`requireAdminUser`), Stripe billing, S3 content, CDK infra (`infra/`). API routes live under `app/app/api/book/**` (URL `/app/api/book/**`). Error envelope = `withBookApiErrors`+`BookApiError`.

**Rules for every fix agent:**
1. Work on `main`. Change ONLY the cited files + direct deps. Do NOT touch `scripts/`, `book-packages/`, `content/`, `state/`, `graphify-out/`.
2. Match surrounding code style; reuse existing helpers (auth guards, `BookApiError`, repo functions, `keys.ts`, `lib/catalog-stats.ts`, `lib/pricing.ts`).
3. Never make a security/economy/paywall decision from client-supplied data — the server is the source of truth.
4. When done: run `npm install` (if deps stale), `npm run typecheck`, `npm run test`, and `npx eslint <changed files>`; report results + a short diff summary. Add/adjust a unit test for any security/money/correctness fix.
5. Line numbers were accurate at audit time — re-read each file and confirm before editing (other agents may be editing in parallel).

---

### H16 — Reminder cron full-table Scan + serial N+1 reads on 5-min timeout
`severity: high` · `effort: medium` · `files: infra/lambda/reading-reminder-cron.ts:57-66, infra/lambda/reading-reminder-cron.ts:95-101, infra/lambda/reading-reminder-cron.ts:109-115, infra/lambda/reading-reminder-cron.ts:183-187, infra/lib/chapterflow-backend-stack.ts:142-147`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: infra/lambda/reading-reminder-cron.ts:57-66, infra/lambda/reading-reminder-cron.ts:95-101, infra/lambda/reading-reminder-cron.ts:109-115, infra/lambda/reading-reminder-cron.ts:183-187, infra/lib/chapterflow-backend-stack.ts:142-147

PROBLEM:
handler() paginates a full-table ScanCommand filtering entity='BOOK_USER_SETTINGS' (lines 58-66). The app table defines only ONE GSI — quiz-scope-createdAt-index (backend-stack.ts:142-147) — there is NO GSI on `entity`, so this is a true full-table scan every hour (the filter runs after RCU is already consumed). Per matched user it does serial awaits: a Get for the dedup marker (95-101), a Get for the profile (109-115), an Update for the in-app notif, an optional SES send, and a Put for the dedup marker. Then Promise.allSettled fires the 3 nudge handlers (183-187), each of which ALSO iterates every accumulated user serially issuing more Gets (STREAK/PROFILE/ENGAGEMENT/LOOP queries). All on a 5-minute Lambda timeout (backend-stack.ts:432).

WHY IT MATTERS:
Work is O(users x serial awaits). At a few thousand active users the 5-minute timeout is hit and later users in the scan are silently dropped (no reminders/nudges for them), and the hourly Scan wastes RCU proportional to total table size, not just settings rows.

REQUIRED FIX:
Add a sparse GSI keyed on `entity` (or a dedicated reminder-schedule GSI keyed by reminder hour) so the cron Queries only settings rows; batch per-user reads with BatchGetItem and share the PROFILE/STREAK fetches across the reminder pass and the 3 nudge handlers instead of re-Getting; run users with bounded concurrency (e.g. p-limit) rather than one serial await chain; consider fan-out (SQS per-user) if user count grows. As an interim guard, raise the timeout and add a CloudWatch duration/timeout alarm on this function so silent drops are visible.

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

### M2 — economy-health full-table Scan runs synchronously inside the admin economy HTTP route — timeout/cost risk at scale
`severity: medium` · `effort: medium` · `files: app/app/api/book/_lib/economy-health.ts:58-87, app/app/api/book/_lib/economy-health.ts:51-54, app/app/api/book/admin/metrics/economy/route.ts:31-56, app/app/api/book/admin/reconciliation/route.ts:11`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/book/_lib/economy-health.ts:58-87, app/app/api/book/_lib/economy-health.ts:51-54, app/app/api/book/admin/metrics/economy/route.ts:31-56, app/app/api/book/admin/reconciliation/route.ts:11

PROBLEM:
computeEconomyHealth does an UNBOUNDED paginated ScanCommand over the whole main table filtering for BOOK_USER_ENGAGEMENT (do...while with no page cap, economy-health.ts:70-87), then estimatePeriodFlows scans the ledger (capped at 10 pages, line 253). Its own docstring says it is 'designed to run as a batch job, not in a request handler' (line 53-54) and 'In production, this should use a GSI or materialized view' (line 66). But the only caller is GET /admin/metrics/economy (route.ts:51), which sets no maxDuration. The infra comment confirms the design: chapterflow-frontend-stack.ts:169-175 — 'the admin metrics routes plus economy-health and soft-decay full-table-Scan to compute aggregates, and OpenNext runs EVERY route ... in this single server Lambda'. A server-side FilterExpression Scan reads every item in the table regardless of entity, so RCU/latency grow with total app data, not just engagement rows.

WHY IT MATTERS:
On a real user base the admin economy dashboard scan can exceed the Lambda timeout (or rack up RCU cost) and fall into the catch (route.ts:53-56), returning FALLBACK_METRICS (all zeros) with only a generic warning — admins silently see a broken economy dashboard. Also blocks one Lambda invocation for the scan duration.

REQUIRED FIX:
Lowest-risk now: set `export const maxDuration = 60` on app/app/api/book/admin/metrics/economy/route.ts (matching reconciliation/route.ts:11) AND add a page cap + Limit to the engagement Scan loop in economy-health.ts:70-87 so it cannot run unbounded inside a request (estimatePeriodFlows already does this with maxPages=10/Limit=1000). Real fix: move computeEconomyHealth to a scheduled Lambda writing a precomputed snapshot and have the route read it — but note no scheduled economy-health job actually exists today; the infra comment describes it running inline, so the original fix's claim that 'a scheduled economy-health job is intended' is aspirational, not implemented.

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

### M7 — Audio route writes a full per-user MP3 to S3 on every playback that is never read back
`severity: medium` · `effort: small` · `files: app/app/api/book/books/[bookId]/chapters/[chapterNumber]/audio/route.ts:469-493`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/book/books/[bookId]/chapters/[chapterNumber]/audio/route.ts:469-493

PROBLEM:
After stitching segments the route fire-and-forget PutObjects the full stitched MP3 to book-content/audio-stitched/{bookId}/ch{n}.{tone}.{variant}.{user.sub}.mp3 with Cache-Control 'public, max-age=3600' (lines 470-483). Grep confirms audio-stitched/stitchedKey is referenced ONLY at the write site — nothing reads that key; the handler always re-loads and re-stitches the individual segments. And the actual HTTP response is returned with Cache-Control 'no-cache' (line 491), so the stitched copy is doubly useless. Each Pro audio playback incurs a redundant full-file S3 write, accumulating one object per (user,chapter,tone,variant) forever with no lifecycle.

WHY IT MATTERS:
Unbounded S3 storage growth (per-user audio copies, no TTL), extra write cost and latency on every Pro audio request, and a misleading public Cache-Control on per-user content.

REQUIRED FIX:
Either (a) HeadObject/GetObject the stitched key first and short-circuit return it when present, making the write useful, AND add an S3 lifecycle/TTL rule for the audio-stitched prefix AND drop the user.sub from the key if the stitched content isn't actually user-specific; or (b) remove the stitched write entirely and rely on the already-cached per-segment objects. Do not advertise public caching on a user-namespaced key.

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

### M14 — Multiple metrics routes do unbounded full-table DynamoDB scans on every request under a 30s ceiling
`severity: medium` · `effort: large` · `files: app/app/api/book/_lib/admin-metrics.ts:374-449 (scanAllEntitlements), app/app/api/book/_lib/admin-metrics.ts:478-500 (scanAllUserSnapshots), app/app/api/book/_lib/economy-health.ts:70-87,256-285 (engagement + ledger scans), app/app/api/book/admin/metrics/acquisition/route.ts:34-53, app/app/api/book/admin/metrics/notifications/route.ts:38-121, app/app/api/book/admin/metrics/content/route.ts:26-70, app/app/api/book/admin/segments/preview/route.ts:25, app/app/api/book/admin/segments/[segmentId]/notify/route.ts:47`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/book/_lib/admin-metrics.ts:374-449 (scanAllEntitlements), app/app/api/book/_lib/admin-metrics.ts:478-500 (scanAllUserSnapshots), app/app/api/book/_lib/economy-health.ts:70-87,256-285 (engagement + ledger scans), app/app/api/book/admin/metrics/acquisition/route.ts:34-53, app/app/api/book/admin/metrics/notifications/route.ts:38-121, app/app/api/book/admin/metrics/content/route.ts:26-70, app/app/api/book/admin/segments/preview/route.ts:25, app/app/api/book/admin/segments/[segmentId]/notify/route.ts:47

PROBLEM:
scanAllEntitlements and scanAllUserSnapshots paginate the ENTIRE table with a FilterExpression (no GSI) on every call; buildSegmentUsers (segments/preview AND notify) runs BOTH on each request. computeEconomyHealth scans all BOOK_USER_ENGAGEMENT (unbounded) plus a 10-page ledger sample. The acquisition route scans all BOOK_USER_PROFILE; notifications route scans all BOOK_USER_NOTIFICATION (capped 5000) and all BOOK_USER_SETTINGS (uncapped). The content route loops up to 180 days sequentially (lastNDays(min(180,range))) with 4 paginated queries per day. The code itself flags 'In production, this should use a GSI or materialized view'. Mitigant confirmed: scans are wrapped in try/catch and degrade to warnings rather than crashing, so blast radius is limited today.

WHY IT MATTERS:
Admin dashboards (economy, billing, retention, devices, geography, funnels, acquisition, segments) slow down then start partial-warning/failing as the user table grows — well before meaningful scale — and each dashboard open drives several full-table scans (RCU cost).

REQUIRED FIX:
Precompute cross-cutting aggregates in a daily/hourly cron Lambda writing an ANALYTICS#ROLLUP item the dashboard reads; add GSIs for entitlement plan/source and engagement balances. Cache scanAllEntitlements/scanAllUserSnapshots for a short TTL so segments preview+notify and metrics routes don't each re-scan. Add explicit pagination caps where 'all' isn't strictly required (the unbounded settings scan in notifications/route.ts especially).

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

### M20 — Audio route writes a per-user stitched MP3 to S3 on every request but never reads it back; segment loads are serial
`severity: medium` · `effort: small` · `files: app/app/api/book/books/[bookId]/chapters/[chapterNumber]/audio/route.ts:362-367, app/app/api/book/books/[bookId]/chapters/[chapterNumber]/audio/route.ts:469-483, app/app/api/book/books/[bookId]/chapters/[chapterNumber]/audio/route.ts:17`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/book/books/[bookId]/chapters/[chapterNumber]/audio/route.ts:362-367, app/app/api/book/books/[bookId]/chapters/[chapterNumber]/audio/route.ts:469-483, app/app/api/book/books/[bookId]/chapters/[chapterNumber]/audio/route.ts:17

PROBLEM:
Every GET loads all segments (~11) from S3 in a SERIAL for-loop with await per key (line 364-367), re-stitches, and writes the full concatenated MP3 to a per-user key book-content/audio-stitched/.../{user.sub}.mp3 (line 470-483). grep confirms the string 'audio-stitched' appears ONLY at the write site — no GetObject ever reads it back, so the per-user stitched cache is write-only dead weight (a full-file S3 PutObject on every play, per user). HeadObjectCommand is imported (line 17) but never used (grep shows the import is its only occurrence), consistent with an abandoned 'check stitched cache first' implementation. Note the body segments (the expensive TTS-generated parts) ARE cached and reused via chapterBodySegmentS3Key, so the cost is the per-request stitched PUT + serial GET latency, not re-TTS.

WHY IT MATTERS:
Each audio play does ~11 sequential S3 GETs plus a full-file S3 PUT that is never reused — wasted S3 write cost/bandwidth and avoidable latency, multiplied across users and replays. A Pro feature that should be cache-fast re-stitches and re-uploads every time.

REQUIRED FIX:
Either implement the intended cache (HeadObject/GetObject the stitched key first and stream it directly when present — the obvious purpose of the unused HeadObjectCommand import), and parallelize the first-pass loads with Promise.all over loadSegmentFromS3; OR, if the per-user stitched cache isn't wanted (it depends on user-specific greeting/score segments so reuse is limited), drop the PutObject and the unused import. Parallelizing the segment GETs is the clear win regardless.

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

### M47 — Color-blind mode applies an SVG filter:url() to <html>, forcing full-page filtered repaints
`severity: medium` · `effort: medium` · `files: app/globals.css:1696-1704, app/layout.tsx:100-116`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/globals.css:1696-1704, app/layout.tsx:100-116

PROBLEM:
For protanopia/deuteranopia/tritanopia, globals.css 1696-1704 sets `html { filter: url(#cf-<mode>) }` referencing feColorMatrix filters defined inline in the root layout (app/layout.tsx:104-115). An SVG url() filter on the root element forces the browser to rasterize and re-filter the entire page on every paint (scroll, animation, hover) -- a well-known heavy GPU/jank source, far costlier than CSS color adjustments. Secondary: a filter on an ancestor makes it the containing block for position:fixed descendants (modal backdrop z-[100], sticky TopNav, fixed mobile nav); on viewport-sized <html> this is usually visually benign but is a fragile coupling.

WHY IT MATTERS:
Users who enable a color-vision adjustment get a globally janky, GPU-heavy experience, worst on the animated reader/dashboard (drifting orbs, shimmer, framer transitions) -- the accessibility setting penalizes its target users.

REQUIRED FIX:
Prefer per-token palette swaps for the colorblind modes: define [data-color-blind-mode='deuteranopia']{--accent-emerald:...; --accent-rose:...; --cr-success:...; --cr-error:...} etc. so success/error stay distinguishable without a global raster filter. If the simulation filter must stay, move it off <html> onto a single non-fixed content wrapper (and exclude the portal/fixed layers), document the perf cost, and disable the heavy ambient animations (orbs/shimmer) while a colorblind filter is active.

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

### L16 — Analytics beacon does a DynamoDB read per navigation event to re-check consent
`severity: low` · `effort: small` · `files: app/app/api/book/me/analytics/beacon/route.ts:33-37, app/book/hooks/useAnalyticsBeacon.ts:153-170`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/book/me/analytics/beacon/route.ts:33-37, app/book/hooks/useAnalyticsBeacon.ts:153-170

PROBLEM:
The beacon hook fires a 'navigation' beacon on every client route change (useAnalyticsBeacon.ts:160-166) plus session_context + performance per page load. For each beacon the server handler does a getUserSettingsItem GetItem (beacon/route.ts:33) to re-verify analyticsParticipation, even though the client already gated on the localStorage consent value (hook:141,154). I confirmed the write path analyticsTrackBeacon (analytics-repo.ts:869) is a blind Put/Update that does NOT read settings, so this consent GetItem is a genuinely separate, additional read per beacon — not foldable into an existing read.

WHY IT MATTERS:
Avoidable DynamoDB read volume + latency on a high-frequency endpoint; one extra GetItem per navigation purely to re-read a rarely-changing privacy flag. Bounded (only when opted in) so not urgent, but wasteful at scale.

REQUIRED FIX:
Keep the flag server-authoritative but cache the user's settings in the warm-container in-memory map (like location.ts's IP_CACHE) with a short TTL keyed by userId, ideally invalidated on settings PATCH; or accept the read and document it as intentional. Folding it into the write path is not viable since analyticsTrackBeacon does not currently read settings.

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

### L67 — Full book detail is re-fetched server-side on every chapter navigation
`severity: low` · `effort: small` · `files: app/book/library/[bookId]/chapter/[chapterId]/page.tsx:11-35, app/book/library/[bookId]/chapter/[chapterId]/page.tsx:45, app/app/api/book/_lib/library-catalog.ts:145-186`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/book/library/[bookId]/chapter/[chapterId]/page.tsx:11-35, app/book/library/[bookId]/chapter/[chapterId]/page.tsx:45, app/app/api/book/_lib/library-catalog.ts:145-186

PROBLEM:
ChapterReaderPage.loadBook calls getPublishedLibraryBookDetail on every chapter load just to resolve route chapterId → chapter and pass initialBook. getPublishedLibraryBookDetail (library-catalog.ts:150-154) does three reads in parallel each call — catalog DynamoDB get, S3 catalog-index read, and the published manifest read — with NO React cache()/unstable_cache wrapper or Next revalidate hint (confirmed: getPublishedLibraryBookDetail is a plain async function, not cache()-wrapped). Sequential chapter navigation (pass quiz → next chapter) re-loads the whole manifest each time.

WHY IT MATTERS:
Extra latency and DynamoDB/S3 cost on the hot chapter-to-chapter path; for long books the per-navigation manifest load is wasteful since the chapter list rarely changes within a session.

REQUIRED FIX:
Wrap the published-manifest/detail read in React cache() (per-request dedupe) and/or an in-memory/edge cache keyed by bookId + publishedVersion (already returned at line 183) with a short revalidate, so sequential navigations reuse the manifest instead of re-querying the full detail.

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
