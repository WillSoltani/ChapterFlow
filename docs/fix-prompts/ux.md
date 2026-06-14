# Fix prompts — UX / Flows

_28 items (1 high, 6 medium, 16 low, 5 polish). ChapterFlow production-readiness remediation — branch `main` (e90937368)._

## Shared context (every prompt below assumes this)

**App:** ChapterFlow — a Next.js 16 (App Router, React 19) "book learning" web app. **These prompts target the `main` branch** (commit e90937368, the freshly-merged post-UI-overhaul-integration state). Backend = DynamoDB single-table (`app/app/api/book/_lib/repo.ts`) behind Cognito JWT auth (`requireUser`/`requireActiveBookUser`/`requireAdminUser`), Stripe billing, S3 content, CDK infra (`infra/`). API routes live under `app/app/api/book/**` (URL `/app/api/book/**`). Error envelope = `withBookApiErrors`+`BookApiError`.

**Rules for every fix agent:**
1. Work on `main`. Change ONLY the cited files + direct deps. Do NOT touch `scripts/`, `book-packages/`, `content/`, `state/`, `graphify-out/`.
2. Match surrounding code style; reuse existing helpers (auth guards, `BookApiError`, repo functions, `keys.ts`, `lib/catalog-stats.ts`, `lib/pricing.ts`).
3. Never make a security/economy/paywall decision from client-supplied data — the server is the source of truth.
4. When done: run `npm install` (if deps stale), `npm run typecheck`, `npm run test`, and `npx eslint <changed files>`; report results + a short diff summary. Add/adjust a unit test for any security/money/correctness fix.
5. Line numbers were accurate at audit time — re-read each file and confirm before editing (other agents may be editing in parallel).

---

### H25 — Notebook page is unreachable from navigation and missing the server access guard
`severity: high` · `effort: small` · `files: app/book/notebook/page.tsx:1-9, app/book/home/components/TopNav.tsx:56-79, app/_lib/require-dashboard-access.ts:79-92, middleware.ts:65-87`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/book/notebook/page.tsx:1-9, app/book/home/components/TopNav.tsx:56-79, app/_lib/require-dashboard-access.ts:79-92, middleware.ts:65-87

PROBLEM:
(1) /book/notebook has zero inbound links: a repo-wide grep for book/notebook hrefs/pushes (excluding the page/route/client files themselves) returns nothing, and it is absent from TopNav navItems, desktopOnlyNavItems, and moreNavItems. Users cannot reach the Notebook or its CSV/Markdown export. (2) notebook/page.tsx renders <NotebookClient/> with NO server guard, while every sibling (badges/saved/journeys/events/rewards) calls await requireDashboardAccess() in page.tsx. requireDashboardAccess verifies the JWT via requireUser and redirects deleted accounts (require-dashboard-access.ts:90-92) and reactivates deactivated ones; middleware (lines 65-87) only does a cookie-presence/expiry check and explicitly defers full JWT verification, so a deleted user or a present-but-INVALID_TOKEN cookie renders the Notebook shell where every other page would redirect. Note the data itself is still protected by requireActiveBookUser in /me/notebook, so this is a defense-in-depth/UX-consistency gap, not a data-exposure hole.

WHY IT MATTERS:
A built feature with server APIs and export is dead to users (lost functionality). The missing guard is a consistency/defense-in-depth gap: deleted/deactivated/invalid-token users get a broken shell instead of the proper redirect, unlike every sibling page.

REQUIRED FIX:
Add a Notebook entry to TopNav.moreNavItems ({ id: "notebook", label: "Notebook", href: "/book/notebook", icon: NotebookPen }) and extend BookNavTab with "notebook" (TopNav.tsx:31). Make notebook/page.tsx async and await requireDashboardAccess() before returning <NotebookClient/>. Since /notebook has no nav tab, pass no activeTab to TopNav (the activeTab? prop is already optional and documented for exactly this Notebook case at TopNav.tsx:36-37).

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

### M26 — Prominent 'Start 14-day free trial' CTA dumps logged-out users into the reader, never into a trial/checkout flow
`severity: medium` · `effort: small` · `files: components/sections/Pricing.tsx:117-118, components/sections/Pricing.tsx:370-377, lib/pricing.ts:72`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: components/sections/Pricing.tsx:117-118, components/sections/Pricing.tsx:370-377, lib/pricing.ts:72

PROBLEM:
TRIAL_CTA_LABEL = 'Start 14-day free trial' (lib/pricing.ts:72). The Pro card CTA (Pricing.tsx:370-377) uses proHref = loggedIn ? '/book/settings' : AUTH_LOGIN_BOOK_URL, where AUTH_LOGIN_BOOK_URL='/auth/login?returnTo=%2Fbook' (chapterflow-brand.ts:100). So a logged-out visitor who clicks the trial button is sent to login and then to /book (the reader), NOT to checkout or any trial-start surface. The fine print directly above (lines 351-367) promises 'A card is required; you won't be charged until the trial ends' — a checkout moment this href does not deliver. For logged-in users the destination is /book/settings, which is plausibly where the billing/upgrade UI lives, so that path is more defensible; the broken promise is specifically the logged-out path landing in the free reader.

WHY IT MATTERS:
The single most important monetization CTA on the marketing site doesn't begin the advertised trial for new (logged-out) visitors — they land in the free reader with no checkout, a confusing dead-end vs the button copy that likely depresses trial-start conversion.

REQUIRED FIX:
Point the logged-out Pro CTA at a returnTo that lands on the upgrade/checkout surface (e.g. '/auth/login?returnTo=%2Fbook%2Fsettings%3Fupgrade%3D1' or a dedicated upgrade route that opens Stripe checkout) rather than %2Fbook. Verify /book/settings actually surfaces the Stripe checkout/start-trial action for the logged-in path; if it just shows settings without a prominent upgrade step, route it (or deep-link) to the checkout action so the destination immediately presents the trial-start step.

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

### M31 — Pair-accept 401 (expired/invalid token) dead-ends with only 'Go to dashboard', no re-login path
`severity: medium` · `effort: small` · `files: app/book/pair-accept/page.tsx:62-79,101-108, app/book/_lib/book-api.ts:37-67`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/book/pair-accept/page.tsx:62-79,101-108, app/book/_lib/book-api.ts:37-67

PROBLEM:
PairAcceptInner auto-POSTs to /app/api/book/me/pairs/accept/[code] on mount (handleAccept, lines 62-88). On any failure the catch (71-78) sets state='error' and the error card (101-108) renders only a 'Go to dashboard' button. There is no status-specific handling, so a 401 (cookie present at the shell but access token expired/invalid at the API) shows a generic failure with no way to re-authenticate and complete the invite. fetchBookJson throws BookClientError(message, response.status, ...) (book-api.ts:67), so err.status is available to branch on.

WHY IT MATTERS:
A reading-partner invite can become uncompletable during the token-expiry window with a confusing dead-end, losing a social-loop conversion. Narrow window (fully-logged-out is handled by middleware), hence medium.

REQUIRED FIX:
In the catch, capture err.status; in the error branch special-case 401 to render a primary action linking to /auth/login?returnTo=<relative /book/pair-accept?code=...> instead of 'Go to dashboard', so the user can re-auth and the auto-accept retries on return. Keep 'Go to dashboard' as secondary for non-401 errors. (If finding 2's relative-returnTo fix lands, the existing middleware redirect would also cover the fully-expired case, but a mid-mount 401 after the shell rendered still needs this in-page affordance.)

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

### M35 — Library 'Active Reads' silently drops the 2nd in-progress book (exactly-two case)
`severity: medium` · `effort: trivial` · `files: components/library/LibraryPage.tsx:286, components/library/ActiveReads.tsx:22`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: components/library/LibraryPage.tsx:286, components/library/ActiveReads.tsx:22

PROBLEM:
LibraryPage.tsx:286 renders `{otherInProgress.length >= 1 && <ActiveReads books={otherInProgress} />}`, where otherInProgress = inProgressBooks minus the hero book (LibraryPage.tsx:186-188). But ActiveReads.tsx:22 early-returns null when `books.length < 2`. With exactly two in-progress books: hero shows one, otherInProgress = 1 element, the `>= 1` guard passes, ActiveReads receives a 1-element array and renders nothing. The second active book is omitted from the dedicated 'Pick up where you left off' surface (it still appears in Browse All).

WHY IT MATTERS:
Free users are capped at ~2 books, so 'exactly two in progress' is a very common state — precisely those users get a resume section that hides their other active read, hurting the core continue-reading loop.

REQUIRED FIX:
Make the thresholds consistent. Simplest: change ActiveReads.tsx:22 to `if (books.length < 1) return null;` so a single 'other' book renders (the section header 'Pick up where you left off' still reads fine for one card; the grid already uses slice(0,3)). The LibraryPage `>= 1` guard is already correct for this. Confirm the heading copy reads acceptably with a single card.

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

### M39 — Failed reward redemption is shown in a success-styled (accent) banner
`severity: medium` · `effort: small` · `files: app/book/hooks/useInsightPoints.ts:142-159, app/rewards/RewardsPageClient.tsx:251-264`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/book/hooks/useInsightPoints.ts:142-159, app/rewards/RewardsPageClient.tsx:251-264

PROBLEM:
redeemReward sets state.redeemMessage to the success payload.message on success (useInsightPoints.ts:145) and to the error string on failure (line 156) — the same field, no tone discriminator (it also returns the error string at 158, but the page renders only the state field). RewardsPageClient renders redeemMessage in one banner styled with cf-accent-border/cf-accent-soft/cf-accent (RewardsPageClient.tsx:258) regardless of tone. A failed redemption (insufficient IP, server error, already-claimed race) therefore appears in the green/accent 'success' palette. Note the load-error path (line 242-247) correctly uses the cf-danger palette with role=alert, so the pattern to mirror already exists.

WHY IT MATTERS:
On an economy-adjacent action, redemption failures render as if they succeeded, which can lead users to think a reward was granted when it wasn't.

REQUIRED FIX:
Return/store a tone with the message ({ message, tone: 'error'|'success' }) from redeemReward, and switch the banner to the cf-danger-border/cf-danger-soft/cf-danger palette with role=alert when tone === 'error', mirroring the existing load-error banner.

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

### M43 — Bulk 'Notify segment' sends to thousands with no pre-send count or confirmation
`severity: medium` · `effort: small` · `files: app/book/admin/_clients/SegmentBuilderClient.tsx:438-447, app/book/admin/_clients/SegmentBuilderClient.tsx:452-481, app/book/admin/_clients/SegmentBuilderClient.tsx:519-528`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/book/admin/_clients/SegmentBuilderClient.tsx:438-447, app/book/admin/_clients/SegmentBuilderClient.tsx:452-481, app/book/admin/_clients/SegmentBuilderClient.tsx:519-528

PROBLEM:
NotifyModal (SegmentBuilderClient.tsx:452-541) lets an admin notify an entire saved segment with one 'Send now' click. It never re-runs the segment to show how many users will be targeted; targetedCount is only revealed AFTER the send via the onSuccess alert() (line 474 -> 444). There is no confirm() guard. The server (segments/[segmentId]/notify/route.ts:51) hard-caps at 5000, but one click can still blast up to 5000 in-app/email notifications. The send button is enabled as soon as title+message are non-empty (line 523).

WHY IT MATTERS:
An admin can accidentally spam up to 5000 real users (and trigger SES email volume) with no chance to reconsider; a mistake in the saved segment's filters is irreversible once fired, and the admin is sending blind to the live match count.

REQUIRED FIX:
Reuse the existing /segments/preview endpoint (it already returns matchCount): on modal open, POST the segment.filters to /segments/preview and render 'This will notify N users' prominently. Gate the send() behind a confirm()/inline-confirm that echoes the count, and replace the post-send alert() with the in-page toast pattern used by AdminEventsClient/ScenarioReviewClient. A dedicated count endpoint is unnecessary since preview already provides matchCount.

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

### M52 — Badges page blanks out on a dashboard API failure
`severity: medium` · `effort: small` · `files: app/book/badges/BookBadgesClient.tsx:191, app/book/badges/BookBadgesClient.tsx:63-66, app/book/hooks/useBadgeSystem.ts:423, app/book/hooks/useBadgeSystem.ts:475-487, app/book/hooks/useBookAnalytics.ts:822-833`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/book/badges/BookBadgesClient.tsx:191, app/book/badges/BookBadgesClient.tsx:63-66, app/book/hooks/useBadgeSystem.ts:423, app/book/hooks/useBadgeSystem.ts:475-487, app/book/hooks/useBookAnalytics.ts:822-833

PROBLEM:
When GET /app/api/book/me/dashboard fails, useBookAnalytics's catch sets hydrated=true while leaving analytics=null (useBookAnalytics.ts:830-832). useBadgeSystem destructures only { analytics, hydrated } (line 423) and its badgeStats useMemo returns null when !analytics (lines 475-476), so badges resolves to []. BookBadgesClient's only loading/blocking gate is `if (!onboardingHydrated || !badgeSystem.hydrated || !onboarding.setupComplete)` (line 191) — it does not check analytics or any error — so on failure it falls through and renders the full page with an empty BadgeShowcase/BadgeGrid/Recommendations and a 0/0 header, with no error message and no retry. The user must manually reload.

WHY IT MATTERS:
A transient dashboard 401/500 produces a fully-rendered but empty/broken badges page (0 of 0 earned, empty catalog) that misrepresents the account as having no badges, with no in-app recovery affordance.

REQUIRED FIX:
Plumb error+refetch through the hook: useBadgeSystem already calls useBookAnalytics — also pull { error, refetch } there and add them to UseBadgeSystemResult (the hook currently returns only hydrated/analytics at lines 587-603). Then in BookBadgesClient, after the loading gate, add `if (badgeSystem.error && !badgeSystem.analytics) return <ErrorBanner title="We couldn’t load your badges" message={badgeSystem.error} onRetry={badgeSystem.refetch} />` inside the page shell (TopNav + section), reusing app/book/components/ui/ErrorBanner.tsx. This mirrors WorkspacePage.tsx (`error && !data` -> ErrorBanner with onRetry={refetch}). Prefer refetch over window.location.reload() so the badge /me/badges GET and event fetch aren't needlessly re-run from scratch.

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

### L6 — Brief refresh race: id_token cookie expires (~1h) on its own maxAge while a silent refresh is in flight, so a navigation in that window is bounced to /auth/login
`severity: low` · `effort: medium` · `files: app/auth/callback/route.ts:133, app/auth/callback/route.ts:139, middleware.ts:67, middleware.ts:72, components/auth/TokenExpiryGuard.tsx:103`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/auth/callback/route.ts:133, app/auth/callback/route.ts:139, middleware.ts:67, middleware.ts:72, components/auth/TokenExpiryGuard.tsx:103

PROBLEM:
id_token/access_token are set with maxAge=expiresIn (~3600s; callback:133-140, refresh:129-132) while auth_expires_at and refresh_token live 30 days (callback:158-162, REFRESH_TOKEN_MAX_AGE). TokenExpiryGuard renews at T-5min (RENEW_BEFORE_SECONDS, TokenExpiryGuard:6,103) so id_token is normally rewritten before it lapses. But renewal only fires while the tab is foregrounded and the timer/focus/visibilitychange handler runs (TokenExpiryGuard:129-132). If a backgrounded tab has its interval throttled past the id_token maxAge AND the user navigates a protected route in the gap before the wake-triggered refresh completes, middleware (middleware:67-72) sees no id_token cookie (the browser already evicted it) and redirects to /auth/login (middleware:72-80) even though refresh_token is still valid. Mitigations present: there ARE focus + visibilitychange listeners (TokenExpiryGuard:130-132), which narrow but don't eliminate the window (the refresh is async and the navigation can win the race).

WHY IT MATTERS:
Occasional, self-recovering: a user returning to a long-idle tab and immediately clicking a protected link can get a full-login bounce (the live IdP session usually re-mints transparently) instead of a seamless refresh. Annoying, not data-affecting.

REQUIRED FIX:
Make middleware refresh-aware: when id_token is absent/expired but refresh_token is present and auth_expires_at is still inside the 30-day window, redirect to a tiny refresh-and-continue handler (or a page that POSTs /auth/refresh then returns to the original target) instead of straight to /auth/login. NOTE: middleware currently reads only id_token and auth_expires_at (middleware:67-68) — it would need to also read the refresh_token cookie presence (it's httpOnly but middleware runs server-side so it can read it). Simpler partial mitigation: a pagehide/pageshow listener and/or shortening RENEW_BEFORE_SECONDS won't fully close it but reduces frequency.

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

### L7 — Middleware-built absolute returnTo is silently dropped to /book if the serving host's origin isn't the configured APP_BASE_URL
`severity: low` · `effort: trivial` · `files: middleware.ts:74, middleware.ts:79, app/auth/_lib/return-to.ts:61, app/auth/_lib/return-to.ts:69`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: middleware.ts:74, middleware.ts:79, app/auth/_lib/return-to.ts:61, app/auth/_lib/return-to.ts:69

PROBLEM:
On an unauthenticated hit, middleware builds returnTo as a FULL absolute URL from the live request origin: currentTarget = new URL(pathname+search, resolveRequestOrigin(req)) then loginUrl.searchParams.set('returnTo', currentTarget.toString()) (middleware:73-79). login then runs it through sanitizeReturnTo, whose absolute-URL branch (return-to:67-72) only accepts origins in allowedOrigins(). allowedOrigins() (return-to:19-48) contains only configured env origins because usesDedicatedChapterFlowHosts() is hardcoded false (verified at chapterflow-brand.ts:43-45). So on any host whose origin differs from APP_BASE_URL/site-URL envs (a new CloudFront alias, a staging/preview domain, host mismatch), the absolute returnTo fails the allowlist and falls back to /book — the user's deep destination is lost.

WHY IT MATTERS:
On the canonical prod host it works (origin matches APP_BASE_URL). On previews/alternate/aliased domains, deep-link return-after-login is silently lost (lands on /book), e.g. a gift/reader deep link.

REQUIRED FIX:
Emit a RELATIVE returnTo from middleware so sanitizeReturnTo's same-origin branch (return-to:61-63 → isSafeInternalPath) preserves it host-independently: replace middleware:73-79 with `loginUrl.searchParams.set('returnTo', `${req.nextUrl.pathname}${req.nextUrl.search}`)`. This also matches the known prior HANDOFF (middleware relative returnTo) noted in the ui-overhaul/auth memory. The currentTarget/resolveRequestOrigin construction can then be dropped for the returnTo (still needed for the loginUrl base).

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

### L29 — Journeys feature is orphaned post-merge (no reachable nav link) and dashboard no longer surfaces partner/commitment/event cards
`severity: low` · `effort: medium` · `files: app/book/home/components/TopNav.tsx:57-79,264,552, app/book/home/components/JourneyBanner.tsx, app/book/home/components/CommitmentFollowUpCard.tsx, components/workspace/WorkspacePage.tsx:741`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/book/home/components/TopNav.tsx:57-79,264,552, app/book/home/components/JourneyBanner.tsx, app/book/home/components/CommitmentFollowUpCard.tsx, components/workspace/WorkspacePage.tsx:741

PROBLEM:
REFUTED for journeys/events reachability: the live dashboard (WorkspacePage) DOES render TopNav (WorkspacePage.tsx:16,741), and TopNav exposes Journeys (/book/journeys) and Events (/book/events) in the desktop nav (desktopOnlyNavItems merged at TopNav.tsx:264) and in the mobile 'More' sheet (moreNavItems at TopNav.tsx:75-79,552). So /book/journeys and /book/events ARE reachable from the live nav, contradicting the finding's core claim. CONFIRMED for the discovery-card/commitment part: the social cards JourneyBanner, EventBanner, CommitmentFollowUpCard, PartnerProgressCard live only in the dead app/book/home/components/* tree and are rendered nowhere; the dashboard surfaces none of them. There is NO standalone commitments page at all (only API routes under me/commitments), so the commitment follow-up prompt is invisible to users.

WHY IT MATTERS:
Lower than reported: journeys/events are discoverable via nav. The real residual gap is that the proactive engagement cards (journey progress banner, commitment follow-up reminder, partner accountability) are not surfaced on the dashboard, so the gamification loop is passive rather than prompted — and commitments have no first-class page or reminder at all.

REQUIRED FIX:
Drop the 'no reachable nav link to journeys' claim (false). For the cards: decide per feature — port CommitmentFollowUpCard (and optionally JourneyBanner) into components/workspace/WorkspacePage to re-introduce the dashboard prompts, or delete the orphaned app/book/home/components/* files if cut. At minimum re-introduce the commitment follow-up prompt somewhere reachable since commitments have no page.

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

### L53 — /pricing SEO description advertises 'Challenge mode' that the pricing page never surfaces (copy drift)
`severity: low` · `effort: trivial` · `files: app/pricing/page.tsx:7-9, components/sections/Pricing.tsx:137-145`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/pricing/page.tsx:7-9, components/sections/Pricing.tsx:137-145

PROBLEM:
app/pricing/page.tsx:8 metadata description claims Pro gives '...all reading depths, and Challenge mode.' Grep confirms 'Challenge mode' appears in marketing copy ONLY here — the Pricing component's proFeatures (Pricing.tsx:137-145) lists 'Deeper depth mode', 'Priority new title requests', etc. and never mentions Challenge mode, and nothing on the marketing pages explains or Pro-gates it. Challenge mode is a real in-app feature (referenced in app/book/settings, flow-points-economy.ts, ChapterReaderClient, etc.) but the SEO snippet promises a feature the visible pricing page does not corroborate.

WHY IT MATTERS:
Mismatch between the search-result snippet and the actual pricing page content — minor trust/clarity hit and a copy-maintenance inconsistency.

REQUIRED FIX:
Either add 'Challenge mode' to the Pro feature list in Pricing.tsx (only if it is genuinely Pro-gated — verify against entitlements/flow-points-economy before claiming) or remove 'and Challenge mode' from the description in app/pricing/page.tsx so the snippet matches the page.

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

### L54 — Contact page sticky header uses invalid inline CSS 'var(--bg-base)/80' so its background never renders
`severity: low` · `effort: trivial` · `files: app/contact/page.tsx:17, app/legal/layout.tsx:8`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/contact/page.tsx:17, app/legal/layout.tsx:8

PROBLEM:
Contact page sticky header (contact/page.tsx:17) sets style={{ background: 'var(--bg-base)/80' }}. The '/80' is Tailwind opacity-modifier syntax, NOT valid CSS; as an inline style the browser discards the entire background declaration. With backdrop-blur-md the header gets no opaque fill, so content scrolling under it shows through with poor contrast. The identical invalid token is also present at app/legal/layout.tsx:8 (verified by grep; technically outside this slice but the same bug on a launch page). The Navbar and BrowseLibraryPage FilterBar use the correct color-mix(in srgb, var(--bg-base) X%, transparent) pattern.

WHY IT MATTERS:
On Contact (and legal pages) the sticky header has a transparent/illegible background while scrolling — a visible polish defect on launch pages.

REQUIRED FIX:
Replace with valid CSS: background: 'color-mix(in srgb, var(--bg-base) 80%, transparent)' (matching Navbar.tsx / BrowseLibraryPage FilterBar at lines 508-510). Apply the same fix to app/legal/layout.tsx:8.

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

### L59 — Data-Rights page links to /book/settings, which requires authentication (redirects logged-out visitors to login)
`severity: low` · `effort: trivial` · `files: app/legal/data-rights/page.tsx:27, app/legal/data-rights/page.tsx:64-73, app/contact/page.tsx:52, app/contact/page.tsx:59-60, middleware.ts:72-87`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/legal/data-rights/page.tsx:27, app/legal/data-rights/page.tsx:64-73, app/contact/page.tsx:52, app/contact/page.tsx:59-60, middleware.ts:72-87

PROBLEM:
Data-Rights (a public, footer-linked legal page) directs most rights to /book/settings (data-rights/page.tsx:27, plus the deactivate/delete bullets at 64-73); Contact does likewise (contact/page.tsx:52). For a logged-out visitor or regulator evaluating the privacy posture, clicking 'Settings' hits an auth-gated route. CORRECTION to the original: middleware.ts:72-87 redirects unauthenticated /book/* to /auth/login WITH a returnTo set to the original path, so the user is NOT dropped into a context-less dead end — after sign-in they land back on Settings. The remaining real nit is that the page never tells a logged-out reader that Settings requires sign-in, and offers no in-page explanation of how to exercise rights without an account beyond the email address (which IS present at data-rights:29,72,106).

WHY IT MATTERS:
Minor: a prospective user/auditor clicking the primary CTA gets bounced to a login screen. The email path (SUPPORT_EMAIL) is already prominent, and the returnTo means the flow completes after login, so the practical harm is small.

REQUIRED FIX:
On data-rights/page.tsx, clarify that Settings requires being signed in (e.g. 'Sign in and open Settings') and keep SUPPORT_EMAIL prominent as the universally-available path for logged-out/regulator readers. The optional returnTo-after-login fallback the original suggested already exists (middleware.ts:78-79), so no code change is needed there — just the copy clarification.

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

### L60 — AuthErrorBanner retry hardcodes returnTo=/book and dismiss strips all query params
`severity: low` · `effort: small` · `files: components/auth/AuthErrorBanner.tsx:15,36-39,68-73`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: components/auth/AuthErrorBanner.tsx:15,36-39,68-73

PROBLEM:
RETRY_URL is the literal '/auth/login?returnTo=%2Fbook' (line 15) and the 'Try again' link uses it verbatim (68-69), so an auth error during a deep-link flow retries toward /book, losing the original destination. handleDismiss does router.replace('/', {scroll:false}) (38), which navigates to root and strips ALL query params (returnTo, utm_*, etc.) rather than just clearing the auth flag.

WHY IT MATTERS:
An auth hiccup mid-deep-link sends the user to the generic dashboard on retry and discards attribution params on dismiss. Minor UX/attribution loss.

REQUIRED FIX:
Build RETRY_URL dynamically from the preserved returnTo: `/auth/login?returnTo=${encodeURIComponent(searchParams.get('returnTo') || '/book')}`. On dismiss, rebuild the current URL with only the `auth` param removed (e.g. new URLSearchParams(searchParams); delete('auth'); router.replace(`${pathname}?${params}`)) instead of replacing with '/'. NOTE the two-part dependency: the callback error redirects are /?auth=error|token_error|server_error and currently do NOT carry returnTo (callback/route.ts:80,116,125,197), so for the retry to actually preserve the destination the callback must also append returnTo to its error redirects (it has returnTo in scope at lines 85/94).

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

### L65 — AudioPlayer resets playback speed to 1x on every (re)load while UI still shows the chosen speed
`severity: low` · `effort: trivial` · `files: app/book/library/[bookId]/chapter/[chapterId]/components/AudioPlayer.tsx:217-222, app/book/library/[bookId]/chapter/[chapterId]/components/AudioPlayer.tsx:133-145, app/book/library/[bookId]/chapter/[chapterId]/components/AudioPlayer.tsx:55-124`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/book/library/[bookId]/chapter/[chapterId]/components/AudioPlayer.tsx:217-222, app/book/library/[bookId]/chapter/[chapterId]/components/AudioPlayer.tsx:133-145, app/book/library/[bookId]/chapter/[chapterId]/components/AudioPlayer.tsx:55-124

PROBLEM:
playbackRate is assigned ONLY inside cycleSpeed (line 221). When loadAudio sets a new src (first open, settings change forcing reload, or error 'try again'), the <audio> element's playbackRate reverts to the default 1x, but the speed state (and the Nx pill) is unchanged. onCanPlay (lines 133-145) sets duration and auto-plays but never reapplies playbackRate.

WHY IT MATTERS:
A reader who set 1.5x then changes reading depth/tone (forcing an audio reload) hears 1x while the control still reads 1.5x — their preference is silently ignored.

REQUIRED FIX:
In onCanPlay set audio.playbackRate = speed before auto-play. Because the audio-events effect deps are [open] (line 195), read speed from a ref (a speedRef kept in sync) so the latest value is applied after each load rather than a stale closure value. Optionally also set it right after assigning src in loadAudio.

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

### L68 — Progress 'Reading Activity' empty-state CTA renders literal '→' instead of an arrow
`severity: low` · `effort: trivial` · `files: components/progress/ReadingActivity.tsx:191, components/progress/EmptyState.tsx:63`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: components/progress/ReadingActivity.tsx:191, components/progress/EmptyState.tsx:63

PROBLEM:
ReadingActivity.tsx:191 passes ctaLabel as a JSX attribute string literal `ctaLabel="Start Reading →"`. The actual source text is the six characters backslash-u-2-1-9-2 (NOT a literal arrow character as the original finding implied). JSX attribute string values are not processed for backslash escape sequences, so EmptyState renders the verbatim text via {ctaLabel} (EmptyState.tsx:63). Every other arrow/em-dash in these files is correctly written as a JS expression child, e.g. {"→"}; line 191 is the only attribute-literal instance.

WHY IT MATTERS:
A first-run user with no reading data sees a broken CTA reading 'Start Reading →' on the Progress page's Reading Activity card — a visibly unpolished bug on a primary first-run surface.

REQUIRED FIX:
Change ReadingActivity.tsx:191 to `ctaLabel={"Start Reading →"}` (JS expression so the escape is interpreted) or use the literal arrow glyph directly: `ctaLabel="Start Reading →"`. Note the original fix text mis-stated that the current value already contains a literal arrow; it does not — it contains the raw escape sequence, which is exactly why this reproduces.

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

### L69 — Daily quests bonus IP collapses to '+0 IP earned' the moment all quests complete
`severity: low` · `effort: small` · `files: components/progress/ProgressPage.tsx:269, components/progress/DailyQuests.tsx:80, components/progress/DailyQuests.tsx:93`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: components/progress/ProgressPage.tsx:269, components/progress/DailyQuests.tsx:80, components/progress/DailyQuests.tsx:93

PROBLEM:
ProgressPage.tsx:269 computes `questBonusFP: wiredQuests.filter((q) => !q.completed).length * 25` (25 IP per still-incomplete quest) and passes it to DailyQuests as bonusIP (ProgressPage.tsx:588). DailyQuests renders the header `🎁 +{bonusIP} IP for all` (line 80) and, when allComplete, the celebration banner `🎉 All quests complete! +{bonusIP} IP earned` (line 93). Because the value keys off incomplete quests, completing the last quest drives bonusIP to 0, so the success banner reads '+0 IP earned'. Quest completion itself is real (driven by analytics: minutesReadToday, today's chapters, daily review count).

WHY IT MATTERS:
The reward the page just promised collapses to '+0 IP earned' at the exact moment of completion, undercutting the gamification payoff and looking like a calculation bug.

REQUIRED FIX:
Use a stable total for display: set ProgressPage.tsx:269 to `questBonusFP: wiredQuests.length * 25` (full bonus pool), or pass a separate remainingBonus for the in-progress nudge and a fixed totalBonus for the header/celebration. Separately (out of this slice) confirm quest completion actually awards IP server-side — nothing on this page mutates the balance, so the '+IP' copy may be aspirational.

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

### L72 — Dashboard 'next reward' always points at the first catalog reward, not the next unearned one
`severity: low` · `effort: small` · `files: components/workspace/WorkspacePage.tsx:332, components/workspace/RewardsCard.tsx:19`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: components/workspace/WorkspacePage.tsx:332, components/workspace/RewardsCard.tsx:19

PROBLEM:
WorkspacePage.tsx:333-334 hardcodes nextReward = {name: INSIGHT_POINTS_REWARDS[0].name, pointsRequired: INSIGHT_POINTS_REWARDS[0].costPoints} regardless of balance. The catalog is sorted ascending by cost (900, 2400, 6500). RewardsCard.tsx:19 renders `progress = min(insightPoints/pointsRequired*100, 100)`. A user with more than 900 IP sees a permanently 100%-full bar still labeled with the cheapest reward as 'next', never advancing to a genuinely next goal.

WHY IT MATTERS:
The rewards progress indicator becomes meaningless for users past the first tier — caps at 100% and never advances. Cosmetic, limited to the dashboard rewards card.

REQUIRED FIX:
Select the first reward whose costPoints exceeds the current balance, falling back to the highest when all are affordable: `INSIGHT_POINTS_REWARDS.find(r => r.costPoints > analytics.insightPoints) ?? INSIGHT_POINTS_REWARDS.at(-1)`, and feed that into nextReward. Works because the catalog is cost-ascending. Ideally also skip already-claimed oneTimePerUser rewards, but that claim state isn't passed into this mapper (it lives in the flow-points route), so the cost-based fix is the appropriate in-slice improvement.

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

### L77 — Delete/Deactivate modals close on failure, hiding the error behind a transient toast
`severity: low` · `effort: small` · `files: app/book/settings/components/DangerZone.tsx:28-47, app/book/settings/BookSettingsClient.tsx:1500-1527`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/book/settings/components/DangerZone.tsx:28-47, app/book/settings/BookSettingsClient.tsx:1500-1527

PROBLEM:
DangerZone.handleConfirmDelete (DangerZone.tsx:28-39) and handleConfirmDeactivate (41-47) await onDelete()/onDeactivate() then unconditionally setLoading(false) and close the modal. The handlers in BookSettingsClient (1500-1527) catch fetch failures internally and only call showToast(...) — they never throw or return a failure signal — so on a failed delete/deactivate the awaited promise resolves successfully, the modal closes, and only a transient toast remains. On success window.location.href redirects to /auth/logout (so the success path is fine), but the failure path closes the destructive modal as if it worked.

WHY IT MATTERS:
On a backend failure during account deletion/deactivation, the destructive modal closes silently with only a 2-3s toast — on the most sensitive flow, the user who just typed DELETE may believe it succeeded. Low because the endpoints exist and the happy path redirects; the gap is failure UX only.

REQUIRED FIX:
Have onDelete/onDeactivate signal failure: in BookSettingsClient throw on !res.ok (and in catch) instead of swallowing with showToast. In DangerZone wrap the await in try/catch — on rejection, setLoading(false) but keep the modal open and render an inline error (e.g. a state string shown above the buttons); only close/redirect on success. The Dialog already prevents close-while-loading, so this is a localized change.

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

### L78 — Settings search index omits the privacy/analytics consent toggle and welcome-back emails
`severity: low` · `effort: trivial` · `files: app/book/settings/constants/searchKeywords.ts:224-273, app/book/settings/BookSettingsClient.tsx:1355-1365, app/book/settings/BookSettingsClient.tsx:1307-1318, app/book/settings/hooks/useSettingsSearch.ts:16-34`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/book/settings/constants/searchKeywords.ts:224-273, app/book/settings/BookSettingsClient.tsx:1355-1365, app/book/settings/BookSettingsClient.tsx:1307-1318, app/book/settings/hooks/useSettingsSearch.ts:16-34

PROBLEM:
SETTINGS_SEARCH_INDEX (searchKeywords.ts) has no entry for the 'Share usage analytics' privacy toggle (rendered at BookSettingsClient.tsx:1355, id='analytics') nor for 'Welcome-back emails' (id='welcome-back', line 1307). A targeted grep confirms the words privacy/telemetry/consent/welcome/data-sharing do not appear anywhere in the index (only unrelated 'tracking' on letter-spacing and streak). useSettingsSearch matches against label+description+section+keywords and requires all query words present; the page (isSectionVisible) filters at section granularity. Result: searching 'analytics', 'privacy', 'consent', 'telemetry', or 'welcome back' returns no results and the section is hidden. Searching 'account' still works because each item carries section:'account' in its searchable string.

WHY IT MATTERS:
Users searching for their primary privacy/consent control (analytics) or welcome-back emails get a no-results screen, making a consent control hard to find. Minor but unfortunate for a privacy control.

REQUIRED FIX:
Add SETTINGS_SEARCH_INDEX entries: id 'analytics' (section 'account', keywords: analytics, privacy, tracking, data, telemetry, consent, usage) and id 'welcome-back' (section 'notifications', keywords: welcome, back, return, comeback, email). Optionally, since matching is section-granular, auto-expand a matched-but-collapsed section so the matched row is visible (the page currently shows the section but does not force-expand it).

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

### L80 — Retention 'Reading frequency' card shows all-zeros during load instead of a skeleton
`severity: low` · `effort: trivial` · `files: app/book/admin/_clients/RetentionClient.tsx:99-106`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/book/admin/_clients/RetentionClient.tsx:99-106

PROBLEM:
Unlike the sibling cohort heatmap and streak-distribution cards (which both gate on `loading && !data ? <ChartSkeleton/> :`, lines 90 and 111), the 'Reading frequency' AdminCard (lines 99-106) has no loading guard. While the request is in flight it renders four FreqRow bars with `data?.frequency.* ?? 0` and `total = 0`, painting 0 / 0% / 'of 0' before snapping to real numbers — looks like real (wrong) data, not a loading state.

WHY IT MATTERS:
Admins briefly see a fabricated-looking all-zero frequency breakdown on every page load, undermining trust in the numbers. Low severity (transient, single card).

REQUIRED FIX:
Wrap the FreqRow block in `loading && !data ? (<div className='space-y-2'>{Array.from({length:4}).map((_,i)=>(<div key={i} className='h-8 animate-pulse rounded bg-(--cf-surface-muted)'/>))}</div>) : (...)`, mirroring the ChartSkeleton/animate-pulse pattern of the sibling cards.

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

### L82 — Ops ingestion 'view' error link is a dead element (no href/action)
`severity: low` · `effort: small` · `files: app/book/admin/_clients/OpsClient.tsx:389-395`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/book/admin/_clients/OpsClient.tsx:389-395

PROBLEM:
In the Recent ingestion jobs table, when a job has an errorReportKey the cell renders `<span className='text-(--cf-danger-text)'>view</span>` (OpsClient.tsx:390-392) — styled red like an actionable link but with no onClick and no href. Clicking does nothing. The errorReportKey (the S3 key to fetch the report) is present on the row but unused.

WHY IT MATTERS:
Admins triaging a failed book ingestion see a 'view' affordance that is a no-op, dead-ending the debugging flow. Low severity (cosmetic affordance; key is still visible to ops via other means).

REQUIRED FIX:
Either make it real — render a button/anchor that hits an admin presigned-URL route keyed by j.errorReportKey to fetch/download the report — or, if no viewer exists yet, replace the red 'view' span with plain non-interactive text like 'error' so it doesn't look clickable.

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

### L83 — User-detail drawer dumps raw entitlement/erase JSON, exposing internal fields and PII
`severity: low` · `effort: small` · `files: app/book/admin/_clients/UsersClient.tsx:408-414, app/book/admin/_clients/UsersClient.tsx:622-626`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/book/admin/_clients/UsersClient.tsx:408-414, app/book/admin/_clients/UsersClient.tsx:622-626

PROBLEM:
The Entitlement section (UsersClient.tsx:408-414) and the erase-result summary (622-626) render JSON.stringify(detail.entitlement / eraseSummary, null, 2) in a <pre>. This dumps raw internal fields (potentially Stripe customer/subscription IDs and internal keys) as an unformatted blob — functional but unpolished for a production admin surface, and shows sensitive identifiers verbatim.

WHY IT MATTERS:
Sensitive billing identifiers are shown without structure or redaction; harder to read and increases incidental exposure (screenshots/shoulder-surfing). Low severity — this is an admin-only surface already behind double auth gating, so exposure is to staff, not end users.

REQUIRED FIX:
Render the entitlement as labeled StatBox rows (plan, proStatus, proSource, currentPeriodEnd, etc.) mirroring the Snapshot section, masking or omitting raw Stripe IDs; keep the raw JSON behind a collapsible <details>'Show raw' for debugging. Same StatBox/labeled treatment for the erase summary.

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

### P1 — Signup Enter-to-submit and OAuth buttons no-op silently when the consent box is unchecked
`severity: polish` · `effort: trivial` · `files: app/signup/page.tsx:47, app/signup/page.tsx:51, app/signup/page.tsx:155`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/signup/page.tsx:47, app/signup/page.tsx:51, app/signup/page.tsx:155

PROBLEM:
startOAuth (signup:46-49) and startEmail (signup:51-56) both early-return on !consented with no feedback. The OAuth/Continue buttons ARE disabled when !consented (signup:117,127,162 disabled={!consented}/{!emailReady}), so those paths are visually gated. BUT the email input's onKeyDown Enter handler (signup:155: `onKeyDown={(e) => e.key === 'Enter' && startEmail()}`) calls startEmail() unconditionally — so a user who types an email and presses Enter without ticking consent gets a silent no-op with zero indication why. Confirmed.

WHY IT MATTERS:
Minor top-of-funnel confusion: pressing Enter with consent unchecked does nothing and gives no pointer to the consent checkbox — a small conversion paper-cut.

REQUIRED FIX:
Surface a hint when blocked by !consented: set an error state ('Please agree to the Terms to continue') or briefly highlight the consent row, instead of the silent return in startEmail/startOAuth. Or at minimum gate the Enter handler to match the button: `onKeyDown={(e) => e.key === 'Enter' && emailReady && startEmail()}` (emailReady already = consented && email non-empty, signup:58) so behavior is consistent — though that still gives no reason, so pairing with a visible hint is better.

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

### P12 — AskBookDrawer follow-up suggestions use a biased Math.random sort over a tiny pool
`severity: polish` · `effort: trivial` · `files: app/book/components/AskBookDrawer.tsx:34-41, app/book/components/AskBookDrawer.tsx:255-262`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/book/components/AskBookDrawer.tsx:34-41, app/book/components/AskBookDrawer.tsx:255-262

PROBLEM:
pickFollowUps (lines 34-41) shuffles with available.sort(() => Math.random() - 0.5) — a biased, non-uniform shuffle — over a fixed 4-item pool, filtering only against verbatim (lowercased) user-typed questions. Clicking a follow-up adds it as a user message so it's excluded next turn, but the pool exhausts quickly and the biased shuffle can resurface the same pair. The finding's claim that it re-shuffles per render is overstated: lines 257-262 already memoize the result by messages.length (followUpsRef keyed on followUpsKey), so it is stable within a turn — only the shuffle quality and small-pool exhaustion remain.

WHY IT MATTERS:
Slightly repetitive / non-uniformly distributed follow-up suggestions; no functional break.

REQUIRED FIX:
Replace the sort-comparator shuffle with a proper Fisher-Yates (the exact seeded pattern already in QuizPanel.tsx:569-578). The per-turn stability the finding suggests is already achieved by the followUpsRef memoization; optionally enlarge the pool.

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

### P15 — Rewards page TopNav highlights the wrong active tab (badges)
`severity: polish` · `effort: trivial` · `files: app/rewards/RewardsPageClient.tsx:210-219`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/rewards/RewardsPageClient.tsx:210-219

PROBLEM:
RewardsPageClient passes activeTab="badges" to TopNav (line 213). BookNavTab has no 'rewards' member (TopNav.tsx:31) and there is no rewards nav item, so this highlights the Badges tab while the user is on Rewards. activeTab is an optional prop documented to be omitted on secondary surfaces.

WHY IT MATTERS:
Minor nav disorientation — the highlighted tab doesn't match the current page.

REQUIRED FIX:
Omit activeTab on /rewards so nothing is mis-highlighted (the prop is optional and TopNav's own doc-comment recommends this for nav-less surfaces), or add a real 'rewards' tab.

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

### P20 — Admin client mutations use native alert()/confirm() instead of in-app dialogs
`severity: polish` · `effort: small` · `files: app/book/admin/_clients/SegmentBuilderClient.tsx:186, app/book/admin/_clients/SegmentBuilderClient.tsx:444, app/book/admin/_components/csv.ts:13`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/book/admin/_clients/SegmentBuilderClient.tsx:186, app/book/admin/_clients/SegmentBuilderClient.tsx:444, app/book/admin/_components/csv.ts:13

PROBLEM:
Segment delete uses window.confirm() (SegmentBuilderClient.tsx:186), notify success uses window.alert() (line 444, via onSuccess), and downloadCSV uses alert('Nothing to export') (csv.ts:13). The rest of the admin surface has a consistent toast + inline-error design system (AdminEventsClient/ScenarioReviewClient toasts, ErrorAlert). Native dialogs are unstyled, not theme/dark-mode aware, and block the main thread.

WHY IT MATTERS:
Inconsistent, off-brand feedback on destructive/bulk admin actions; native dialogs ignore design tokens and can be suppressed by the browser's 'prevent additional dialogs' prompt. Polish-level.

REQUIRED FIX:
Replace alert()/confirm() with the existing toast component plus a small inline confirm (the NotifyModal / erase-confirm patterns already in this codebase) for segment delete and the CSV-empty case. This dovetails with finding #2 (the notify pre-send confirm).

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

### P21 — EmptyState CTA renders a raw <a href> (full page reload) instead of Next Link, and the branch is dead
`severity: polish` · `effort: trivial` · `files: components/ui/EmptyState.tsx:28-53`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: components/ui/EmptyState.tsx:28-53

PROBLEM:
When actionHref is provided, EmptyState renders a plain <a href> (lines 29-39) with hardcoded color:'#FFFFFF' on background var(--accent-cyan). A plain anchor triggers a full document navigation (loses client state, slower) rather than SPA routing. Confirmed dead: grep for actionHref across app+components (excluding EmptyState.tsx) returns nothing -- all EmptyState usages use onCtaClick. So the anchor branch is unreachable today but is a footgun if used, and the hardcoded white bypasses tokens.

WHY IT MATTERS:
Cosmetic/robustness: an unreachable code path that, if used, would full-reload internal links and use a non-token color.

REQUIRED FIX:
Either delete the actionHref prop + anchor branch (it is unused), or swap the <a> for next/link's Link to preserve SPA navigation and replace color:'#FFFFFF' with an on-accent token (e.g. --cf-accent-contrast if defined). Given zero consumers, deletion is cleanest.

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
