# ChapterFlow — parallel fix tasks (complete, self-contained prompts)

All 202 findings from the production-readiness re-audit of `main`, **consolidated into 132 tasks (one per primary file)** and sorted by priority. Each `## Task N` block is a single copy-paste prompt that makes one agent do EVERYTHING itself: create an isolated git worktree + branch, fix its finding(s), verify, and commit.

## How to run (parallel)
1. Copy a `## Task N` block → give it to one agent. It runs STEP 1 to create `../cf-fix-<ID>` on branch `fix/<ID>`, fixes, verifies, and commits.
2. Launch as many tasks concurrently as you want. Each owns a **different primary file**, so their working trees and commits are independent.
3. **Review then merge** each finished branch with the integrate line it prints (top-to-bottom severity order is a sensible merge order). Merging is the only step left to you (so concurrent merges can't race).

## Coordination (shared files)
By construction each task **owns one primary file**, so agents editing only their primary never collide. **Rule:** if a fix actually modifies a file outside its primary, don't run that task in parallel with the listed partner — merge one, then run/merge the other. If in doubt, edit only your primary file and flag the rest in your report.

**Hot files** touched (or referenced) by many tasks: `app/app/api/book/_lib/repo.ts`, `app/book/settings/BookSettingsClient.tsx`, `app/globals.css`, `middleware.ts`. Several tasks read these for context; only a few actually edit them. If your fix edits one of these, rebase on the latest branch before committing and merge sequentially.

**Small-cluster overlaps** (excluding hot files) — run these pairs serially, not in parallel:
- `C1` (`app/_lib/site-url.ts`) may share `app/_lib/chapterflow-brand.ts`, `app/robots.ts`, `app/sitemap.ts` with Task `X1`/`M27`
- `X1` (`middleware.ts`) may share `app/_lib/chapterflow-brand.ts`, `app/app/api/book/billing/webhook/route.ts` with Task `C1`/`H8`/`L10`
- `H1` (`app/app/api/book/admin/metrics/billing/route.ts`) may share `app/app/api/book/admin/metrics/billing/route.ts`, `lib/pricing.ts` with Task `L10`/`M26`/`M29`
- `H2` (`app/app/api/book/me/export/route.ts`) may share `app/app/api/book/me/export/route.ts` with Task `H19`
- `H3` (`app/app/api/book/_lib/quiz-session.ts`) may share `app/app/api/book/_lib/content-service.ts`, `app/app/api/book/_lib/quiz-session.ts` with Task `H4`/`L21`
- `H4` (`app/app/api/book/me/books/[bookId]/state/route.ts`) may share `app/app/api/book/_lib/content-service.ts`, `app/book/library/hooks/useBookProgress.ts` with Task `H3`/`L21`/`H23`
- `H5` (`components/progress/ProgressPage.tsx`) may share `components/progress/ProgressPage.tsx`, `components/progress/progressMockData.ts` with Task `L92`
- `H7` (`app/book/home/components/PartnerProgressCard.tsx`) may share `app/app/api/book/_lib/pair-repo.ts`, `app/book/home/page.tsx`, `components/workspace/WorkspacePage.tsx` with Task `L30`/`M34`/`L29`/`L70`
- `H8` (`app/app/api/book/_lib/referral-escalation.ts`) may share `app/app/api/book/_lib/ensure-book-started.ts`, `app/app/api/book/billing/webhook/route.ts` with Task `M11`/`X1`/`L10`
- `H9` (`app/app/api/book/admin/segments/[segmentId]/notify/route.ts`) may share `app/app/api/book/admin/metrics/notifications/route.ts`, `open-next.config.ts` with Task `M14`/`M13`
- `H12` (`app/app/api/_lib/aws.ts`) may share `app/app/api/_lib/aws.ts` with Task `L90`
- `H14` (`infra/lib/chapterflow-backend-stack.ts`) may share `infra/lambda/lib/email-compliance.ts`, `infra/lambda/lib/streak-at-risk.ts`, `infra/lambda/reading-reminder-cron.ts`, `infra/lib/chapterflow-backend-stack.ts` with Task `L34`/`H26`/`H16`/`M6`
- `H16` (`infra/lambda/reading-reminder-cron.ts`) may share `infra/lambda/reading-reminder-cron.ts` with Task `H14`
- `H19` (`app/legal/data-rights/page.tsx`) may share `app/app/api/book/me/export/route.ts`, `app/contact/page.tsx`, `app/legal/privacy/page.tsx` with Task `H2`/`L54`/`M28`/`L58`
- `H20` (`app/legal/cookies/page.tsx`) may share `app/auth/callback/route.ts`, `app/auth/refresh/route.ts` with Task `M1`/`L2`
- `H21` (`app/onboarding/components/OnboardingFlow.tsx`) may share `app/book/hooks/useBookPreferences.ts`, `app/book/library/[bookId]/chapter/[chapterId]/ChapterReaderClient.tsx` with Task `H27`/`M32`
- `H23` (`app/book/library/[bookId]/BookDetailClient.tsx`) may share `app/book/library/hooks/useBookProgress.ts` with Task `H4`
- `H25` (`app/book/notebook/page.tsx`) may share `app/book/home/components/TopNav.tsx` with Task `L29`
- `H26` (`app/book/settings/BookSettingsClient.tsx`) may share `app/app/api/book/_lib/streak-repo.ts`, `app/app/api/book/me/profile/route.ts`, `app/app/api/book/me/settings/route.ts`, `infra/lambda/lib/streak-at-risk.ts` with Task `M8`/`M28`/`L28`/`H27`/`L19`/`H14`
- `H27` (`app/book/hooks/useBookPreferences.ts`) may share `app/app/api/book/me/settings/route.ts`, `app/book/hooks/useBookPreferences.ts` with Task `H26`/`L19`/`H21`
- `H28` (`next.config.ts`) may share `next.config.ts` with Task `M51`
- `H29` (`app/book/profile/BookProfileClient.tsx`) may share `app/book/hooks/useBookAnalytics.ts` with Task `M52`
- `M1` (`app/auth/callback/route.ts`) may share `app/app/api/_lib/auth.ts`, `app/auth/callback/route.ts` with Task `L8`/`H20`
- `M2` (`app/app/api/book/_lib/economy-health.ts`) may share `app/app/api/book/admin/reconciliation/route.ts` with Task `M13`
- `M6` (`app/app/api/book/_lib/depth-routing.ts`) may share `infra/lib/chapterflow-backend-stack.ts` with Task `H14`
- `M8` (`app/app/api/book/_lib/streak-repo.ts`) may share `app/app/api/book/_lib/streak-repo.ts` with Task `H26`
- `M10` (`app/app/api/book/me/share-events/route.ts`) may share `app/app/api/book/_lib/http.ts` with Task `L50`
- `M11` (`app/app/api/book/_lib/ensure-book-started.ts`) may share `app/app/api/book/_lib/ensure-book-started.ts` with Task `H8`
- `M13` (`app/app/api/book/admin/reconciliation/route.ts`) may share `app/app/api/book/admin/reconciliation/route.ts`, `open-next.config.ts` with Task `M2`/`H9`
- `M14` (`app/app/api/book/_lib/admin-metrics.ts`) may share `app/app/api/book/admin/metrics/notifications/route.ts` with Task `H9`
- `M26` (`components/sections/Pricing.tsx`) may share `components/sections/Pricing.tsx`, `lib/pricing.ts` with Task `L53`/`H1`/`M29`
- `M27` (`app/sitemap.ts`) may share `app/robots.ts`, `app/sitemap.ts` with Task `C1`
- `M28` (`lib/legal-entity.ts`) may share `app/app/api/book/me/onboarding/complete/route.ts`, `app/app/api/book/me/profile/route.ts`, `app/legal/privacy/page.tsx`, `app/legal/terms/page.tsx`, `lib/legal-entity.ts` with Task `L28`/`H26`/`H19`/`L58`/`M29`
- `M29` (`app/legal/terms/page.tsx`) may share `app/legal/terms/page.tsx`, `lib/legal-entity.ts`, `lib/pricing.ts` with Task `M28`/`H1`/`M26`
- `M32` (`app/book/library/[bookId]/chapter/[chapterId]/ChapterReaderClient.tsx`) may share `app/book/library/[bookId]/chapter/[chapterId]/ChapterReaderClient.tsx` with Task `H21`
- `M34` (`app/book/home/page.tsx`) may share `app/book/home/page.tsx` with Task `H7`
- `M35` (`components/library/LibraryPage.tsx`) may share `components/library/LibraryPage.tsx` with Task `L94`
- `M38` (`app/book/badges/lib/badge-utils.ts`) may share `app/book/_lib/flow-points-economy.ts` with Task `L25`/`L28`
- `M39` (`app/book/hooks/useInsightPoints.ts`) may share `app/rewards/RewardsPageClient.tsx` with Task `P15`
- `M42` (`app/book/admin/_components/csv.ts`) may share `app/book/admin/_clients/SegmentBuilderClient.tsx`, `app/book/admin/_clients/UsersClient.tsx`, `app/book/admin/_components/csv.ts` with Task `M43`/`L83`
- `M43` (`app/book/admin/_clients/SegmentBuilderClient.tsx`) may share `app/book/admin/_clients/SegmentBuilderClient.tsx`, `app/book/admin/_components/csv.ts` with Task `M42`
- `M51` (`.github/workflows/ci.yml`) may share `next.config.ts` with Task `H28`
- `M52` (`app/book/badges/BookBadgesClient.tsx`) may share `app/book/hooks/useBookAnalytics.ts` with Task `H29`
- `L2` (`app/auth/refresh/route.ts`) may share `app/auth/refresh/route.ts` with Task `H20`
- `L8` (`app/app/api/_lib/auth.ts`) may share `app/app/api/_lib/auth.ts` with Task `M1`
- `L10` (`app/app/api/book/billing/webhook/route.ts`) may share `app/app/api/book/_lib/keys.ts`, `app/app/api/book/_lib/trial-ending-email.ts`, `app/app/api/book/admin/metrics/billing/route.ts`, `app/app/api/book/billing/webhook/route.ts` with Task `L34`/`L17`/`H1`/`X1`/`H8`
- `L17` (`app/app/api/book/_lib/trial-ending-email.ts`) may share `app/app/api/book/_lib/trial-ending-email.ts` with Task `L10`
- `L19` (`app/app/api/book/email/unsubscribe/route.ts`) may share `app/app/api/book/me/settings/route.ts` with Task `H26`/`H27`
- `L21` (`app/app/api/book/_lib/content-service.ts`) may share `app/app/api/book/_lib/content-service.ts`, `app/app/api/book/_lib/quiz-session.ts` with Task `H3`/`H4`
- `L25` (`app/app/api/book/me/reflections/[bookId]/[chapterNumber]/route.ts`) may share `app/book/_lib/flow-points-economy.ts` with Task `M38`/`L28`
- `L28` (`app/book/_lib/flow-points-economy.ts`) may share `app/app/api/book/me/onboarding/complete/route.ts`, `app/app/api/book/me/profile/route.ts`, `app/book/_lib/flow-points-economy.ts` with Task `M28`/`H26`/`M38`/`L25`
- `L29` (`app/book/home/components/TopNav.tsx`) may share `app/book/home/components/TopNav.tsx`, `components/workspace/WorkspacePage.tsx` with Task `H25`/`H7`/`L70`
- `L30` (`app/app/api/book/_lib/pair-repo.ts`) may share `app/app/api/book/_lib/pair-repo.ts` with Task `H7`
- `L32` (`app/app/api/book/me/events/[eventId]/join/route.ts`) may share `app/app/api/book/_lib/events-repo.ts` with Task `L33`
- `L33` (`app/app/api/book/_lib/events-repo.ts`) may share `app/app/api/book/_lib/events-repo.ts` with Task `L32`
- `L34` (`app/app/api/book/_lib/keys.ts`) may share `app/app/api/book/_lib/keys.ts`, `app/app/api/book/me/devices/register/route.ts`, `infra/lambda/lib/email-compliance.ts` with Task `L10`/`L35`/`H14`
- `L35` (`app/app/api/book/me/devices/register/route.ts`) may share `app/app/api/book/me/devices/register/route.ts` with Task `L34`
- `L50` (`app/app/api/book/_lib/http.ts`) may share `app/app/api/book/_lib/http.ts` with Task `M10`
- `L53` (`app/pricing/page.tsx`) may share `components/sections/Pricing.tsx` with Task `M26`
- `L54` (`app/contact/page.tsx`) may share `app/contact/page.tsx` with Task `H19`
- `L58` (`app/legal/privacy/page.tsx`) may share `app/legal/privacy/page.tsx` with Task `H19`/`M28`
- `L70` (`components/workspace/WorkspacePage.tsx`) may share `components/workspace/WorkspacePage.tsx` with Task `H7`/`L29`
- `L71` (`components/library/BrowseAll.tsx`) may share `components/library/libraryData.ts` with Task `L92`/`P14`
- `L83` (`app/book/admin/_clients/UsersClient.tsx`) may share `app/book/admin/_clients/UsersClient.tsx` with Task `M42`
- `L90` (`docs/README.md`) may share `app/app/api/_lib/aws.ts` with Task `H12`
- `L92` (`components/progress/progressMockData.ts`) may share `components/library/libraryData.ts`, `components/progress/ProgressPage.tsx`, `components/progress/progressMockData.ts` with Task `L71`/`P14`/`H5`
- `L94` (`components/library/dashboardToLibraryUi.ts`) may share `components/library/LibraryPage.tsx` with Task `M35`
- `P14` (`components/library/libraryData.ts`) may share `components/library/libraryData.ts` with Task `L71`/`L92`
- `P15` (`app/rewards/RewardsPageClient.tsx`) may share `app/rewards/RewardsPageClient.tsx` with Task `M39`

## Notes
- **Base branch:** `audit/prod-readiness-2026-06-14`. **node_modules** is symlinked per worktree (supports typecheck/test/eslint, not `next build`).
- ⚠ items `X1`/`X2` are carry-overs the automated pass missed — re-confirmed by hand; treat as real launch blockers.

> **Dispatch the launch blockers first:** `X1`, `X2`, `C1`, `H4`, `H3`, `H12`, `H15`, `H14`, `H1`, `H2`, `H19`, `H20`, `H22`, `H23`, `H26`, `H27`, `H28`.

**Tasks by lead severity:** 3 critical · 26 high · 36 medium · 57 low · 10 polish — 132 total.

---

## Task 1: C1 — Production canonical/OG/sitemap URL silently defaults to wrong domain (https://soltani.org) with no env guard
**Lead:** `critical` · **Covers:** C1 · **Edits:** `app/_lib/chapterflow-brand.ts`, `app/_lib/site-url.ts`, `app/books/page.tsx`, `app/robots.ts`, `app/sitemap.ts` · context: `app/layout.tsx`, `app/page.tsx` · ⚠ shares a file with Task X1/M27

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/C1 ../cf-fix-C1 audit/prod-readiness-2026-06-14
cd ../cf-fix-C1
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/_lib/chapterflow-brand.ts, app/_lib/site-url.ts, app/books/page.tsx, app/robots.ts, app/sitemap.ts.
- Read-only context (do NOT edit, just read for understanding): app/layout.tsx, app/page.tsx.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `app/_lib/chapterflow-brand.ts`, `app/robots.ts`, `app/sitemap.ts`, which Task X1/M27 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- C1 · critical · app/_lib/site-url.ts:11-13, app/_lib/chapterflow-brand.ts:32-37, app/page.tsx:26-89, app/sitemap.ts:4-13, app/robots.ts:4-14, app/layout.tsx:48-71, app/books/page.tsx:19-35
PROBLEM: getChapterFlowSiteUrl() -> siteBaseUrl() -> getSiteUrl(). getSiteUrl() returns NEXT_PUBLIC_SITE_URL || APP_BASE_URL, and when neither is set in production it returns the hardcoded literal 'https://soltani.org' (site-url.ts:11-13). Because getSiteUrl() always returns a non-empty string in production, the `|| (NODE_ENV==='production' ? DEFAULT_CHAPTERFLOW_SITE_URL ...)` fallback in chapterflow-brand.ts siteBaseUrl() (lines 33-36) — which would yield 'https://siliconx.ca' — is unreachable dead code. There is no build/runtime assertion that the env var is configured. Every SEO surface depends on getChapterFlowSiteUrl(): metadataBase + alternates.canonical + OG/Twitter url in layout.tsx and page.tsx, the Organization/WebSite/Product JSON-LD in page.tsx, the ItemList JSON-LD in books/page.tsx, every sitemap.ts entry, and the robots.ts sitemap URL. Three domains float through the tree (soltani.org hardcoded, siliconx.ca dead, chapterflow.ca as support).
WHY:     On go-live, if the URL env var is not perfectly set, search engines and social cards index/scrape https://soltani.org, canonical tags point off-site, the sitemap/robots advertise the wrong host, and link previews break — a silent, hard-to-detect launch failure that poisons SEO and sharing from day one with no error surfaced. The presence of three different domain literals makes the misconfiguration easy.
FIX:     In app/_lib/site-url.ts, when process.env.NODE_ENV==='production' and neither NEXT_PUBLIC_SITE_URL nor APP_BASE_URL is set, throw to fail the build/boot rather than returning a hardcoded domain. Replace the soltani.org literal with the one true production domain (or require it via env). Either delete the now-dead siliconx.ca fallback in chapterflow-brand.ts siteBaseUrl() or reconcile it to the single canonical default so there is exactly one production default. Confirm the real launch domain with the owner (chapterflow.ca is the support domain; siliconx.ca is the legal entity; neither matches the soltani.org fallback).

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/_lib/chapterflow-brand.ts app/_lib/site-url.ts app/books/page.tsx app/robots.ts app/sitemap.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/_lib/chapterflow-brand.ts app/_lib/site-url.ts app/books/page.tsx app/robots.ts app/sitemap.ts
git commit -m "fix(ops): C1 — Production canonical/OG/sitemap URL silently default"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE C1: committed on fix/C1 (worktree ../cf-fix-C1). Covered: C1."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/C1 && git worktree remove ../cf-fix-C1 && git branch -d fix/C1"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 2: X1 (+2) — Auth middleware redirects the Stripe webhook to /auth/login, breaking webhook processing in production
**Lead:** `critical` · **Covers:** X1, M30, L7 · **Edits:** `app/_lib/chapterflow-brand.ts`, `app/app/api/book/billing/webhook/route.ts`, `app/auth/_lib/return-to.ts`, `middleware.ts` · ⚠ shares a file with Task C1/H8/L10

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 3 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/X1 ../cf-fix-X1 audit/prod-readiness-2026-06-14
cd ../cf-fix-X1
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/_lib/chapterflow-brand.ts, app/app/api/book/billing/webhook/route.ts, app/auth/_lib/return-to.ts, middleware.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `app/_lib/chapterflow-brand.ts`, `app/app/api/book/billing/webhook/route.ts`, which Task C1/H8/L10 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- X1 · critical · middleware.ts:28-94, app/app/api/book/billing/webhook/route.ts:66-88 · ⚠ CARRIED/RE-CONFIRMED (the automated re-audit missed this; it is real)
PROBLEM: The Next.js routing root is /Users/radinsoltani/ChapterFlow/app (it contains the top-level layout.tsx + page.tsx), so the directory app/app/api/book/billing/webhook/route.ts serves at URL /app/api/book/billing/webhook. middleware.ts config.matcher is ["/app/:path*","/book/:path*","/dashboard/:path*"], so the webhook is matched. The only carve-out before the auth check is /app/api/book/email/unsubscribe (lines 34-36). In production (NODE_ENV=production so isDevAuthBypassEnabled is false and the dev Cognito-missing skip at 52-63 does not apply), the cookie-presence check at line 67 finds no id_token (Stripe sends no cookies) and the block at 72-87 issues a 302 redirect to /auth/login. Stripe treats any non-2xx (including 302) as a failed delivery, retries, then disables the endpoint.
WHY:     Every Stripe webhook in production is intercepted before reaching the handler: checkout.session.completed never grants Pro (users pay, get nothing), customer.subscription.* never downgrades cancellations, charge.dispute.created never revokes access, invoice.paid/charge.refunded never persist. Money + access-control failure on the core monetization path; admin MRR/reconciliation drift permanently. The webhook's own correctness (signature, idempotency, proSource guard) is irrelevant because the request never arrives.
FIX:     Add a pass-through at the very top of middleware() before the protectedSurface computation, mirroring the unsubscribe carve-out: `if (pathname.startsWith("/app/api/book/billing/webhook")) return NextResponse.next();`. Stronger and recommended: stop running auth middleware on API routes entirely — every /app/api/book route already enforces requireUser/requireActiveBookUser/requireAdminUser or a signature check at the route level, so the matcher should cover only UI surfaces (/app non-api pages, /book, /dashboard) and explicitly exclude /app/api/*. Validate end-to-end with `stripe trigger checkout.session.completed` against the deployed URL and confirm a 200 (not a 302) before launch. Add a CloudWatch alarm on the existing StripeWebhookFailure metric AND on webhook 3xx/4xx responses so a regression is caught.

--- M30 · medium · middleware.ts:72-80, middleware.ts:12-26, app/auth/_lib/return-to.ts:19-48,50-76, app/_lib/chapterflow-brand.ts:43-45
PROBLEM: Middleware builds returnTo as an absolute URL from the request host (currentTarget = new URL(pathname+search, resolveRequestOrigin(req)); loginUrl.searchParams.set('returnTo', currentTarget.toString()), middleware.ts:73-79). /auth/login then sanitizeReturnTo's it (login/route.ts:79). For absolute URLs sanitizeReturnTo accepts only origins in allowedOrigins() (return-to.ts:67-72), which is built SOLELY from env vars (APP_BASE_URL/NEXT_PUBLIC_SITE_URL/etc.) because usesDedicatedChapterFlowHosts() hard-returns false (chapterflow-brand.ts:43-45). If those env vars are unset or don't match the deployed/forwarded host, the absolute returnTo is rejected and falls back to '/book', dropping the original destination (e.g. /book/pair-accept?code=..., gift links routed through protected /book paths).
WHY:     Growth-loop deep links can silently lose their target on login for logged-out recipients in any environment where the site-URL allowlist doesn't exactly match the serving host. This matches a known HANDOFF in the auth-wave memory ('middleware relative returnTo'). Conditional on env misconfiguration, hence medium, not high.
FIX:     Emit a RELATIVE returnTo from middleware: loginUrl.searchParams.set('returnTo', `${req.nextUrl.pathname}${req.nextUrl.search}`). sanitizeReturnTo's relative-path branch (return-to.ts:61-62) accepts same-origin paths via isSafeInternalPath unconditionally (return-to-core.ts:29-36), so the destination always survives without depending on the cross-origin allowlist. Keep the absolute-URL allowlist only for genuine cross-host SSO.

--- L7 · low · middleware.ts:74, middleware.ts:79, app/auth/_lib/return-to.ts:61, app/auth/_lib/return-to.ts:69
PROBLEM: On an unauthenticated hit, middleware builds returnTo as a FULL absolute URL from the live request origin: currentTarget = new URL(pathname+search, resolveRequestOrigin(req)) then loginUrl.searchParams.set('returnTo', currentTarget.toString()) (middleware:73-79). login then runs it through sanitizeReturnTo, whose absolute-URL branch (return-to:67-72) only accepts origins in allowedOrigins(). allowedOrigins() (return-to:19-48) contains only configured env origins because usesDedicatedChapterFlowHosts() is hardcoded false (verified at chapterflow-brand.ts:43-45). So on any host whose origin differs from APP_BASE_URL/site-URL envs (a new CloudFront alias, a staging/preview domain, host mismatch), the absolute returnTo fails the allowlist and falls back to /book — the user's deep destination is lost.
WHY:     On the canonical prod host it works (origin matches APP_BASE_URL). On previews/alternate/aliased domains, deep-link return-after-login is silently lost (lands on /book), e.g. a gift/reader deep link.
FIX:     Emit a RELATIVE returnTo from middleware so sanitizeReturnTo's same-origin branch (return-to:61-63 → isSafeInternalPath) preserves it host-independently: replace middleware:73-79 with `loginUrl.searchParams.set('returnTo', `${req.nextUrl.pathname}${req.nextUrl.search}`)`. This also matches the known prior HANDOFF (middleware relative returnTo) noted in the ui-overhaul/auth memory. The currentTarget/resolveRequestOrigin construction can then be dropped for the returnTo (still needed for the loginUrl base).

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/_lib/chapterflow-brand.ts app/app/api/book/billing/webhook/route.ts app/auth/_lib/return-to.ts middleware.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/_lib/chapterflow-brand.ts app/app/api/book/billing/webhook/route.ts app/auth/_lib/return-to.ts middleware.ts
git commit -m "fix(ops): X1, M30, L7 — Auth middleware redirects the Stripe webhook to /aut"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE X1: committed on fix/X1 (worktree ../cf-fix-X1). Covered: X1, M30, L7."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/X1 && git worktree remove ../cf-fix-X1 && git branch -d fix/X1"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 3: X2 (+3) — CloudFront errorResponses rewrite ALL 403/404 to the homepage at HTTP 200, corrupting every API error response
**Lead:** `critical` · **Covers:** X2, H13, M23, M24 · **Edits:** `app/app/_lib/server-origin.ts`, `infra/lib/chapterflow-frontend-stack.ts` · context: `app/app/api/book/_lib/account-guard.ts`, `app/app/api/book/_lib/content-service.ts`, `app/app/api/book/_lib/http.ts`, `infra/lib/chapterflow-backend-stack.ts`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 4 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/X2 ../cf-fix-X2 audit/prod-readiness-2026-06-14
cd ../cf-fix-X2
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/_lib/server-origin.ts, infra/lib/chapterflow-frontend-stack.ts.
- Read-only context (do NOT edit, just read for understanding): app/app/api/book/_lib/account-guard.ts, app/app/api/book/_lib/content-service.ts, app/app/api/book/_lib/http.ts, infra/lib/chapterflow-backend-stack.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- X2 · critical · infra/lib/chapterflow-frontend-stack.ts:740-753, app/app/api/book/_lib/http.ts:43-63, app/app/api/book/_lib/account-guard.ts:65-67, app/app/api/book/_lib/content-service.ts:62 · ⚠ CARRIED/RE-CONFIRMED (the automated re-audit missed this; it is real)
PROBLEM: The distribution's errorResponses maps both httpStatus 403 and 404 to responsePagePath '/' with responseHttpStatus 200, applied to the default (server-Lambda) behavior. CloudFront custom error responses fire on the ORIGIN status code regardless of path, so every JSON 403/404 the app legitimately returns is replaced with homepage HTML at status 200.
WHY:     Core authenticated flows break: clients receive HTML+200 instead of structured 403/404 JSON. account_deleted gating, chapter_locked gating, book/version not-found, and all admin 404 paths malfunction; clients calling .json() on HTML crash or silently mis-handle. Every-user blast radius. (401 is NOT in the list, so unauthenticated 401s still pass through.)
FIX:     Remove the 403 and 404 entries from errorResponses so the server Lambda's own responses pass through (OpenNext renders its own 404 page). If a custom SPA fallback is genuinely wanted for browser navigations, scope it to a behavior that EXCLUDES the server/API paths — but for an OpenNext SSR app the correct fix is simply to delete both entries. Do not rewrite 4xx to 200.

--- H13 · high · infra/lib/chapterflow-frontend-stack.ts:397-400, infra/lib/chapterflow-frontend-stack.ts:424-426, infra/lib/chapterflow-frontend-stack.ts:579-590, app/app/_lib/server-origin.ts:50-56
PROBLEM: serverFnUrl (line 397) and imageFnUrl (line 424) both use authType FunctionUrlAuthType.NONE. The CloudFront origin only sets a plain x-forwarded-host custom header (line 583-585) and uses HttpOrigin — there is no FunctionUrlOrigin.withOriginAccessControl, no IAM auth, no shared secret header. Nothing prevents a direct hit to the public Function URL, which bypasses CloudFront entirely (no rate limiting/bot control) and lets the caller forge x-forwarded-host. grep confirms NO WAFv2/WebACL anywhere in infra/.
WHY:     The auth/billing SSR app sits on an unauthenticated, publicly-reachable endpoint with no edge rate-limiting or WAF. Host forgery IS possible for code that reads x-forwarded-host. However the author's 'breaks OAuth/Stripe' claim is overstated: app/app/_lib/server-origin.ts (the only thing that trusts x-forwarded-host) is consumed by exactly ONE route — the pair-invite link builder (app/app/api/book/me/pairs/invite/route.ts). Stripe checkout uses getAppBaseUrl() which resolves CHAPTERFLOW_APP_BASE_URL from env/SSM and THROWS in prod if unset (book/_lib/env.ts:57-72, billing/checkout-session/route.ts:130-131), and OAuth uses a fixed COGNITO_REDIRECT_URI. So the live forgery blast radius is the pair-invite URL plus the missing rate-limiting/DDoS posture, not auth/billing redirect hijack.
FIX:     Lock the Function URLs to CloudFront: use origins.FunctionUrlOrigin.withOriginAccessControl(serverFnUrl/imageFnUrl) (CDK now supports OAC for Function URLs and auto-grants lambda:InvokeFunctionUrl) and set both URLs to authType AWS_IAM; OR inject a secret x-origin-verify custom header at the origin and reject mismatches in the OpenNext middleware. Attach a WAFv2 WebACL (managed common rule set + a rate-based rule) to the distribution. Separately, harden server-origin.ts to ignore x-forwarded-host unless APP_BASE_URL/CHAPTERFLOW_APP_BASE_URL is set (it already prefers APP_BASE_URL, but that env var is not injected into the server Lambda, so prod falls through to the forgeable header).

--- M23 · medium · infra/lib/chapterflow-frontend-stack.ts:358-377, infra/lib/chapterflow-frontend-stack.ts:383-486, infra/lib/chapterflow-frontend-stack.ts:158-352
PROBLEM: commonEnv (358-377) merges props.serverEnv, which carries all secrets injected in bin/app.ts:97-157 (Stripe secret/webhook/price keys, Anthropic + ElevenLabs API keys, AUTH_STATE_SECRET, full Cognito config). This same commonEnv object is passed as the environment to ServerFn (393), ImageFn (419 via spread), RevalidationFn (442), DynamoProviderFn (464), and WarmerFn (483 via spread). All five also share the single lambdaRole (role: lambdaRole on each), which grants Cognito AdminDeleteUser+ListUsers (327-337), dynamodb:Scan on both app+analytics tables (183-200), and ses:SendEmail (314-320).
WHY:     Secret blast radius is multiplied across 5 functions: a leak/compromise of any of the 4 auxiliary functions (image optimizer, revalidation, dynamo provider, warmer) exposes Stripe + AI keys + auth secrets and confers the ability to AdminDeleteUser Cognito users, Scan/mutate both tables, and send SES email — none of which those aux functions need. Least-privilege is violated for the auxiliary functions.
FIX:     Split env: a secrets-free baseInfraEnv (cache/queue/table-name vars only) for ImageFn/RevalidationFn/DynamoProviderFn/WarmerFn, and the secret-bearing commonEnv only for ServerFn. Give each aux function its own minimal role (Image: assets bucket only; Revalidation: cache table + queue; DynamoProvider: cache table; Warmer: lambda:InvokeFunction on ServerFn only). Keep the broad role (Scan/Cognito/SES) on ServerFn alone, ideally splitting admin Scan/Cognito-delete paths into a dedicated function later (the code comment at 168-175 already acknowledges this).

--- M24 · medium · infra/lib/chapterflow-frontend-stack.ts:383-486, infra/lib/chapterflow-backend-stack.ts:426-449, infra/lib/chapterflow-backend-stack.ts:529-537, infra/lib/chapterflow-frontend-stack.ts:740-753
PROBLEM: grep confirms NO lambda.Function in either stack sets logRetention (and no RetentionDays anywhere). CDK defaults un-set logRetention to RETAIN-FOREVER (Never Expire) on the auto-created /aws/lambda log groups for all 7 functions (ServerFn, ImageFn, RevalidationFn, DynamoProviderFn, WarmerFn, ReadingReminderCron, EmailSuppressionHandler). The cron logs include truncated user IDs (reading-reminder-cron.ts:156 logs userId.slice(0,8)) and the suppression handler logs email prefixes (suppression-handler.ts). Separately the CloudFront distribution errorResponses (frontend-stack.ts:740-753) rewrite BOTH 403 and 404 to HTTP 200 serving '/' with ttl 0.
WHY:     Lambda logs accumulate forever → unbounded CloudWatch Logs storage cost and indefinite retention of PII fragments (user-id prefixes, email prefixes). The 403/404→200 rewrite means genuine not-found and forbidden responses are indistinguishable from a real homepage 200: deep links to removed content silently render the homepage, breaking SEO (soft-404s, crawl/index dilution) and masking real authorization failures.
FIX:     Set logRetention (e.g. logs.RetentionDays.ONE_MONTH) on every lambda.Function in both stacks (or a stack-level aspect). Remove the 403/404 errorResponses entries so CloudFront passes through the origin's real status codes; if a branded edge page is wanted, scope it to 5xx only (and/or let OpenNext serve the Next.js not-found page with a real 404 status).

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/_lib/server-origin.ts infra/lib/chapterflow-frontend-stack.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/_lib/server-origin.ts infra/lib/chapterflow-frontend-stack.ts
git commit -m "fix(correctness): X2, H13, M23, M24 — CloudFront errorResponses rewrite ALL 403/404 to the"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE X2: committed on fix/X2 (worktree ../cf-fix-X2). Covered: X2, H13, M23, M24."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/X2 && git worktree remove ../cf-fix-X2 && git branch -d fix/X2"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 4: H1 (+1) — Admin "Real MRR/ARR" sums annual subscription amounts as if monthly — inflates MRR ~12x per annual subscriber
**Lead:** `high` · **Covers:** H1, L15 · **Edits:** `app/app/api/book/admin/metrics/billing/route.ts`, `lib/pricing.ts` · context: `app/app/api/book/billing/webhook/route.ts`, `app/book/admin/_clients/BillingClient.tsx` · ⚠ shares a file with Task L10/M26/M29

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 2 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/H1 ../cf-fix-H1 audit/prod-readiness-2026-06-14
cd ../cf-fix-H1
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/book/admin/metrics/billing/route.ts, lib/pricing.ts.
- Read-only context (do NOT edit, just read for understanding): app/app/api/book/billing/webhook/route.ts, app/book/admin/_clients/BillingClient.tsx.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `app/app/api/book/admin/metrics/billing/route.ts`, `lib/pricing.ts`, which Task L10/M26/M29 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- H1 · high · app/app/api/book/admin/metrics/billing/route.ts:55-58, app/app/api/book/admin/metrics/billing/route.ts:168-169, app/app/api/book/admin/metrics/billing/route.ts:76-84, app/app/api/book/admin/metrics/billing/route.ts:142-155, app/app/api/book/billing/webhook/route.ts:221-238, app/book/admin/_clients/BillingClient.tsx:109-119
PROBLEM: realMrr = stripePro.reduce((sum,e)=>sum + (e.subscriptionAmountCents ?? 0),0) (billing/route.ts:55-58), realArr = mrrCents*12 (line 169). subscriptionAmountCents is stored straight from the subscription price's unit_amount (webhook route.ts:221 firstItem?.unit_amount, written at route.ts:236). For the monthly plan that is one month (799¢). For annual it is the FULL YEAR: lib/pricing.ts ANNUAL_TOTAL_AMOUNT=71.88 (7188¢) and annualUpfrontAmount=59.99 (5999¢). Summing those into a 'monthly' recurring figure counts each annual subscriber as ~12 months in MRR and ~144x in ARR. The normalizer already exists — subscriptionInterval is captured on the webhook (route.ts:223,238), typed on EntitlementSnapshot (admin-metrics.ts:14) and projected/mapped by scanAllEntitlements (admin-metrics.ts:387,409) — but the MRR calc never reads it. The same un-normalized total feeds revenueByCountry (route.ts:80) and topPayingUsers (route.ts:143-152).
WHY:     The headline KPI tiles on the admin Billing dashboard (Real MRR, Real ARR, labeled 'actual Stripe revenue' in BillingClient.tsx:110-119) and revenue-by-country are materially wrong the moment any customer is on an annual plan — and annual/annual_upfront are offered at checkout (checkout-session/route.ts:46). Runway/pricing/country decisions made off these numbers will be based on a ~12x-overstated MRR for the annual cohort; ARR is doubly wrong.
FIX:     In billing/route.ts derive a per-entitlement monthly amount before summing: const monthly = e.subscriptionInterval === 'year' ? Math.round((e.subscriptionAmountCents ?? 0)/12) : (e.subscriptionAmountCents ?? 0). Sum monthly into mrrCents and use the same normalized value for byCountry (line 80) AND topPayingUsers (lines 143-152) so the 'top payers' ranking isn't dominated by annual subscribers. realArr = mrrCents*12 then holds. For legacy rows missing subscriptionInterval, fall back to treating as monthly and push a coverage warning. Note that the webhook only stores `interval` ('month'/'year'), not interval_count — if any multi-month interval_count is ever used it would need /interval_count too; capture interval_count on the webhook for robustness. Also update the BillingClient footnote (lines 283-288, which currently says 'sum of actual Stripe subscription amounts' with no normalization mention) to state amounts are interval-normalized to a monthly figure.

--- L15 · low · app/app/api/book/admin/metrics/billing/route.ts:55-74, app/app/api/book/billing/webhook/route.ts:212-220, lib/pricing.ts:61-69
PROBLEM: The system is single-CAD (lib/pricing.ts BILLING_CURRENCY = PRICING.currency = 'CAD'). The webhook only console.warns when a subscription's currency != BILLING_CURRENCY (route.ts:217-219) and never rejects (deliberately, to avoid desyncing the entitlement). The admin billing route pushes a warnings[] string when >1 distinct currency is seen (route.ts:68-73) but STILL computes a single realMrr by summing subscriptionAmountCents across all currencies (route.ts:55-58) and reports it as the headline KPI (route.ts:168). So a misconfigured Stripe Price or future non-CAD market makes MRR add e.g. CAD+USD cents as if identical units.
WHY:     If a non-CAD subscription ever exists, reported MRR/ARR is silently nonsensical apart from a warning chip an admin may not read. Today single-currency, so impact is latent; it compounds with the annual-MRR bug above.
FIX:     When distinctCurrencies.length > 1, either return realMrr/realArr as null alongside the warning, or group MRR per currency in the response (and per currency in revenueByCountry/topPayingUsers) rather than summing across currencies. This pairs naturally with the interval-normalization fix for finding #1 — both should land together in the MRR computation.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/book/admin/metrics/billing/route.ts lib/pricing.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/book/admin/metrics/billing/route.ts lib/pricing.ts
git commit -m "fix(data): H1, L15 — Admin 'Real MRR/ARR' sums annual subscription amount"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE H1: committed on fix/H1 (worktree ../cf-fix-H1). Covered: H1, L15."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/H1 && git worktree remove ../cf-fix-H1 && git branch -d fix/H1"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 5: H2 (+1) — GDPR/CCPA data export silently truncates for heavy users — unpaginated DynamoDB Queries
**Lead:** `high` · **Covers:** H2, M3 · **Edits:** `app/app/api/book/me/export/route.ts` · context: `app/app/api/book/_lib/repo.ts` · ⚠ shares a file with Task H19

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 2 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/H2 ../cf-fix-H2 audit/prod-readiness-2026-06-14
cd ../cf-fix-H2
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/book/me/export/route.ts.
- Read-only context (do NOT edit, just read for understanding): app/app/api/book/_lib/repo.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `app/app/api/book/me/export/route.ts`, which Task H19 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- H2 · high · app/app/api/book/me/export/route.ts:91-109, app/app/api/book/_lib/repo.ts:2730-2761 (listUserChapterStates), app/app/api/book/_lib/repo.ts:2804-2832 (listReadingDays), app/app/api/book/_lib/repo.ts:853-867 (listAllUserProgress), app/app/api/book/_lib/repo.ts:2649-2700 (listAllUserBookStates), app/app/api/book/_lib/repo.ts:2834+ (listBadgeAwards), app/app/api/book/_lib/repo.ts:2504+ (listSavedBooks)
PROBLEM: The export route fans out to listUserChapterStates, listReadingDays, listAllUserProgress, listAllUserBookStates, listSavedBooks and listBadgeAwards. I confirmed every one of these issues a single QueryCommand and returns only res.Items — none reads or loops on LastEvaluatedKey/ExclusiveStartKey. DynamoDB caps a Query at 1MB, so a heavy user (one READINGDAY# item per active day over years, or hundreds of chapter states with notes + quizAnswers + quizResult) is silently cut off at the first page with no error. This is presented to users as 'Download all your data' (app/legal/privacy/page.tsx:103) and the docstring claims 'all user data'.
WHY:     Power users receive an incomplete data export with no indication anything is missing — a GDPR Art.15 / CCPA right-of-access completeness failure and a credibility/legal risk for a product that advertises full export. The contrast is sharp: account-erasure.ts DOES paginate (queryAllItems), so a user can be fully ERASED but only partially EXPORTED.
FIX:     Add a paginate-until-LastEvaluatedKey loop to each list* function used by the export (mirror queryAllItems in account-erasure.ts:52-71). Cleanest: refactor the six list functions to loop on ExclusiveStartKey (they are also used by other read paths that would benefit), or add export-specific paginated variants. At minimum surface a truncation flag in the payload if a page boundary is hit so the user/operator knows to request a full copy. Note: the analytics-events portion (getUserEvents, capped at 200 by design) is a deliberate cap, not this bug — leave it, but the main-table lists must be fixed.

--- M3 · medium · app/app/api/book/me/export/route.ts:130-131, app/app/api/book/me/export/route.ts:196-201, app/app/api/book/me/export/route.ts:466-478
PROBLEM: analyticsAndLocation (lines 130-131) reads 'Usage analytics and approximate-location telemetry ... are not included in this self-serve export. To request a copy, contact support@chapterflow.ca.' But the same response object unconditionally includes the analytics field populated from getUserSnapshot (approximate location/device) and the last 200 events from getUserEvents (fetched at 103-108, assembled at 196-201). The markdown formatter even renders a 'Usage Analytics' section (466-478) explicitly labeled 'includes approximate location and device'. The disclaimer is stale copy that directly contradicts the data in the file.
WHY:     A privacy-conscious user reading the disclaimer would wrongly believe their analytics/location is withheld and would email support for data they already received — a misleading statement embedded in a legal-access artifact. Low data-leak risk (the data is the user's own); it is a trust/accuracy defect on a compliance surface.
FIX:     Replace the analyticsAndLocation string at export/route.ts:130-131 with accurate copy (e.g. 'Usage analytics and approximate-location telemetry are included below under "analytics" when you have enabled Share Usage Analytics.') or remove the field entirely now that the analytics section is genuinely included. Trivial.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/book/me/export/route.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/book/me/export/route.ts
git commit -m "fix(data): H2, M3 — GDPR/CCPA data export silently truncates for heavy u"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE H2: committed on fix/H2 (worktree ../cf-fix-H2). Covered: H2, M3."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/H2 && git worktree remove ../cf-fix-H2 && git branch -d fix/H2"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 6: H3 — Quiz answer key (correctChoiceId/correctIndex) leaked to client on every quiz fetch
**Lead:** `high` · **Covers:** H3 · **Edits:** `app/app/api/book/_lib/content-service.ts`, `app/app/api/book/_lib/quiz-session.ts` · context: `app/app/api/book/books/[bookId]/chapters/[chapterNumber]/quiz/route.ts`, `app/book/library/[bookId]/chapter/[chapterId]/components/QuizPanel.tsx`, `app/book/library/[bookId]/chapter/[chapterId]/hooks/useQuizSession.ts` · ⚠ shares a file with Task H4/L21

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/H3 ../cf-fix-H3 audit/prod-readiness-2026-06-14
cd ../cf-fix-H3
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/book/_lib/content-service.ts, app/app/api/book/_lib/quiz-session.ts.
- Read-only context (do NOT edit, just read for understanding): app/app/api/book/books/[bookId]/chapters/[chapterNumber]/quiz/route.ts, app/book/library/[bookId]/chapter/[chapterId]/components/QuizPanel.tsx, app/book/library/[bookId]/chapter/[chapterId]/hooks/useQuizSession.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `app/app/api/book/_lib/content-service.ts`, `app/app/api/book/_lib/quiz-session.ts`, which Task H4/L21 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- H3 · high · app/app/api/book/_lib/quiz-session.ts:414-435, app/app/api/book/books/[bookId]/chapters/[chapterNumber]/quiz/route.ts:127-145, app/app/api/book/_lib/content-service.ts:99-144, app/book/library/[bookId]/chapter/[chapterId]/components/QuizPanel.tsx:225,607, app/book/library/[bookId]/chapter/[chapterId]/hooks/useQuizSession.ts:209
PROBLEM: buildQuizClientSession returns correctChoiceId (line 428) and correctIndex (line 429) for every question UNCONDITIONALLY, while selectedChoiceId/isCorrect are gated on status (lines 424-433). The GET quiz route returns this verbatim. So on a fresh, unanswered quiz any authenticated user can read payload.quiz.questions[*].correctChoiceId from the network tab and answer perfectly. Server grading is authoritative (submit/route.ts:316-333 re-derives the key server-side via buildQuizAttemptQuestions and does NOT trust client correctness), so this is not a server bypass — but it lets a user always pass, claim the first-attempt and perfect-score IP bonuses (flow-points-economy.ts: firstAttempt vs retry differential + perfectBonusIP), and skip the learning loop. IP converts to Pro, so it farms the economy. sanitizeQuizForClient (content-service.ts:99-144) strips the key but is confirmed dead (zero callers anywhere).
WHY:     Quiz integrity is null for any user who opens dev tools; pass-gated progression and the IP→Pro economy are trivially gamed, and quiz analytics/scores become meaningless. For a learning product this guts the core value prop and the economy's monetization safety.
FIX:     The author's proposed fix (gate correctChoiceId/correctIndex the same way selectedChoiceId is gated) is INCOMPLETE and would break the product: the live client (QuizPanel.handleAnswer line 607, the showAsCorrect rendering line 225, useQuizSession local fallback line 209, and buildCarryForwardAnswers in quizScoring.ts) structurally depends on having correctChoiceId client-side to show immediate per-question correct/incorrect feedback with retries BEFORE submission. Pick one of: (a) move per-answer feedback grading server-side (an answer-check round trip that returns only isCorrect, never the key) so the key never reaches the client; or (b) accept that inline feedback inherently reveals the key and instead remove the gameable economy incentive — stop awarding the first-attempt and perfectBonusIP purely on raw client-submitted score, or only award them when the chapter's reading-time / interaction signals are plausible. At minimum, decouple chapter-unlock and IP bonuses from being claimable on a single read-the-key submission. Either way, delete the dead sanitizeQuizForClient or make it the one canonical client projection.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/book/_lib/content-service.ts app/app/api/book/_lib/quiz-session.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/book/_lib/content-service.ts app/app/api/book/_lib/quiz-session.ts
git commit -m "fix(data): H3 — Quiz answer key (correctChoiceId/correctIndex) leake"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE H3: committed on fix/H3 (worktree ../cf-fix-H3). Covered: H3."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/H3 && git worktree remove ../cf-fix-H3 && git branch -d fix/H3"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 7: H4 — Chapter unlock gating bypassable via client-trusted state-sync PATCH
**Lead:** `high` · **Covers:** H4 · **Edits:** `app/app/api/book/_lib/content-service.ts`, `app/app/api/book/me/books/[bookId]/state/route.ts`, `app/book/library/hooks/useBookProgress.ts` · ⚠ shares a file with Task H3/L21/H23

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/H4 ../cf-fix-H4 audit/prod-readiness-2026-06-14
cd ../cf-fix-H4
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/book/_lib/content-service.ts, app/app/api/book/me/books/[bookId]/state/route.ts, app/book/library/hooks/useBookProgress.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `app/app/api/book/_lib/content-service.ts`, `app/book/library/hooks/useBookProgress.ts`, which Task H3/L21/H23 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- H4 · high · app/app/api/book/me/books/[bookId]/state/route.ts:154-235, app/book/library/hooks/useBookProgress.ts:240-255, app/app/api/book/_lib/content-service.ts:61,89
PROBLEM: PATCH /me/books/[bookId]/state reads client-supplied unlockedChapterIds (line 155) and completedChapterIds (line 154), unions them with existing server state (mergedUnlocked also folds in mergedCompleted, lines 159-167), maps them through the publicly-fetchable manifest to numbers, and writes unlockedThroughChapterNumber = Math.max(...unlockedNumbers) (line 224) and completedChapters = completedNumbers (line 227) into BOOK_PROGRESS via upsertUserProgress. There is NO check that any unlock was earned by passing a quiz. The live reader persists its progress object to localStorage (useBookProgress.ts:242) and auto-PATCHes it on every change (lines 246-255), so a user who edits localStorage (or POSTs directly) with all chapterIds in unlockedChapterIds/completedChapterIds immediately unlocks and 'completes' every chapter. Content/quiz reads gate purely on progress.unlockedThroughChapterNumber (content-service.ts:61 and :89), so this fully bypasses the buildProgressAfterQuizPass gate. By contrast the legitimate unlock route (me/chapters/[bookId]/[chapterNumber]/unlock/route.ts:42-54) correctly requires quizState.passed.
WHY:     The central 'pass the quiz to unlock the next chapter' mechanic can be skipped entirely by any user. Completion/score data is corrupted (completedChapters and bestScoreByChapter written without quizzes), polluting analytics, achievement eligibility, and book-completion signals.
FIX:     Make this PATCH read-only for gating fields: never raise unlockedThroughChapterNumber or add completedChapters from the request body — derive those exclusively from quiz-pass writes (recordQuizAttemptOutcome / buildProgressAfterQuizPass) and the quiz-gated unlock route. Allow the PATCH to update only non-gating UI fields (currentChapterId/lastReadChapterId/lastOpenedAt). If optimistic client unlock is desired, validate each claimed unlock against getUserQuizState(chapter).passed before persisting. Note the per-chapter PATCH at me/books/[bookId]/chapters/[chapterNumber]/state/route.ts is fine — it stores opaque chapter state and does not touch progress.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/book/_lib/content-service.ts app/app/api/book/me/books/[bookId]/state/route.ts app/book/library/hooks/useBookProgress.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/book/_lib/content-service.ts app/app/api/book/me/books/[bookId]/state/route.ts app/book/library/hooks/useBookProgress.ts
git commit -m "fix(data): H4 — Chapter unlock gating bypassable via client-trusted "

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE H4: committed on fix/H4 (worktree ../cf-fix-H4). Covered: H4."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/H4 && git worktree remove ../cf-fix-H4 && git branch -d fix/H4"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 8: H5 (+3) — Live progress page renders fabricated daily-quest reward ("+75 IP for all") that is never awarded server-side
**Lead:** `high` · **Covers:** H5, H6, M36, L69 · **Edits:** `app/book/_lib/spaced-repetition.ts`, `app/book/home/components/ReviewDueWidget.tsx`, `app/book/hooks/useOnboardingState.ts`, `app/book/page.tsx`, `app/book/progress/page.tsx`, `components/progress/DailyQuests.tsx`, `components/progress/ProgressPage.tsx`, `components/progress/progressMockData.ts` · ⚠ shares a file with Task L92

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 4 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/H5 ../cf-fix-H5 audit/prod-readiness-2026-06-14
cd ../cf-fix-H5
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/book/_lib/spaced-repetition.ts, app/book/home/components/ReviewDueWidget.tsx, app/book/hooks/useOnboardingState.ts, app/book/page.tsx, app/book/progress/page.tsx, components/progress/DailyQuests.tsx, components/progress/ProgressPage.tsx, components/progress/progressMockData.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `components/progress/ProgressPage.tsx`, `components/progress/progressMockData.ts`, which Task L92 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- H5 · high · components/progress/ProgressPage.tsx:269, components/progress/ProgressPage.tsx:586-592, components/progress/DailyQuests.tsx:80-93, components/progress/progressMockData.ts:54-83, app/book/progress/page.tsx
PROBLEM: The live /book/progress route (app/book/progress/page.tsx -> ProgressPage) builds Daily Quests from mockProgressData.dailyQuests and computes questBonusFP = wiredQuests.filter(q => !q.completed).length * 25 (ProgressPage.tsx:269). With 3 quests this is the advertised 75 (progressMockData.ts:83 questBonusFP:75). DailyQuests.tsx:80 renders '🎁 +{bonusIP} IP for all' and DailyQuests.tsx:93 renders '🎉 All quests complete! +{bonusIP} IP earned'. Completing q3 only calls setShowReviewSession(true) (ProgressPage.tsx:590) which opens the localStorage ReviewSession and awards nothing.
WHY:     On a primary engagement surface users are repeatedly shown 'earned' IP that never reaches their real balance (served truthfully by /me/flow-points), a visible economy lie that erodes trust.
FIX:     Either (a) drop the bonusIP prop and the '+IP for all'/'+IP earned' copy from DailyQuests.tsx so quests are habit nudges with no currency promise, or (b) build a real POST /me/quests/claim that validates each quest server-side and calls awardFlowPoints with a per-day idempotent sourceId, then drive questBonusFP/completion from that response. Option (a) is the cheap honest fix.

--- H6 · high · components/progress/ProgressPage.tsx:25-33, components/progress/ProgressPage.tsx:250-251, components/progress/ProgressPage.tsx:270-276, components/progress/ProgressPage.tsx:685-693, app/book/_lib/spaced-repetition.ts:5-7, app/book/home/components/ReviewDueWidget.tsx:6,62
PROBLEM: The progress page's reviews block (overdueCount/dueTodayCount/upcomingThisWeekCount/totalConceptsLearned/forecast, ProgressPage.tsx:270-276) is sourced from app/book/_lib/spaced-repetition.ts, a device-local localStorage SRS (STORAGE_KEY 'book-accelerator:spaced-rep:v1'), and 'Start review' / q3 open the localStorage ReviewSession (ProgressPage.tsx:685-693). The real spaced-repetition system is the server FSRS store (fsrs-repo.ts, /me/reviews, seeded in submit/route.ts:579-604 via initializeCardsForChapter) which the home page uses via ReviewSessionFSRS + /me/reviews?mode=stats (ReviewDueWidget.tsx:6,21,62). The two systems share no data. freezesEquipped/freezesAvailable are hardcoded to 0 (ProgressPage.tsx:250-251) while the server tracks streakShieldsHeld (streak-repo.ts).
WHY:     Two competing, unsynchronized SRS/streak systems show contradictory numbers across two core pages: doing reviews in the home FSRS widget never changes the progress page counts (and vice versa), and progress-page SRS is per-device localStorage that vanishes on a new device/browser. Launch-visible 'better implementation is live, older client is dead/stale' divergence.
FIX:     Point KnowledgeReview at the server FSRS API: replace the spaced-repetition.ts count helpers with GET /app/api/book/me/reviews?mode=stats (and ?mode=all for forecast) data, swap the localStorage <ReviewSession> for <ReviewSessionFSRS> (already used by ReviewDueWidget), and wire freezesAvailable from GET /me/streak (shieldsHeld). Note: the progress page's streak counts (currentDays/bestDays/consistency) come from useBookAnalytics, not from /me/streak, so those are a separate divergence to reconcile. Then delete the now-dead spaced-repetition.ts / reading-streaks.ts / ReviewSession.tsx once no live route imports them.

--- M36 · medium · components/progress/ProgressPage.tsx:402, app/book/hooks/useOnboardingState.ts:255, app/book/hooks/useOnboardingState.ts:265, app/book/page.tsx:21
PROBLEM: useOnboardingState sets hydrated=true immediately after reading localStorage (useOnboardingState.ts:255), with state.setupComplete defaulting to false (defaultState.setupComplete=false, line 114) when localStorage is empty. A SEPARATE async effect (lines 265-279) then fetches /app/api/book/me/onboarding/progress to flip setupComplete. ProgressPage's redirect effect (lines 402-407) fires on `onboardingHydrated && !onboarding.setupComplete` and immediately router.replace('/book'). For an already-onboarded user on a new device / cleared cache, localStorage has no flag → hydrated=true with setupComplete=false → redirect to /book fires BEFORE the async server check resolves. /book then server-checks onboarding and redirects to /dashboard (app/book/page.tsx:21). Net: a returning user clicking 'Progress' lands on /dashboard. Notably, neither WorkspacePage nor LibraryPage has this client redirect — it is isolated to ProgressPage.
WHY:     Legitimate returning/multi-device users are denied direct access to the Progress page on first visit per browser. It self-recovers (lands on dashboard, not a crash) and only happens once per fresh browser (the line 260 effect persists setupComplete to localStorage once the server check flips it), but the requested page never loads on that first attempt.
FIX:     Don't redirect on the optimistic localStorage default. Add an explicit 'onboarding status resolved' flag to useOnboardingState that becomes true only after the /onboarding/progress fetch settles (success OR catch), and gate ProgressPage.tsx:402 on that flag rather than on bare onboardingHydrated. Alternatively drop the client redirect entirely and rely on the route's server guard (app/book/progress/page.tsx already calls requireDashboardAccess; onboarding-completeness can be enforced server-side as app/book/page.tsx does). At minimum do not call router.replace until the server confirmation has had a chance to run.

--- L69 · low · components/progress/ProgressPage.tsx:269, components/progress/DailyQuests.tsx:80, components/progress/DailyQuests.tsx:93
PROBLEM: ProgressPage.tsx:269 computes `questBonusFP: wiredQuests.filter((q) => !q.completed).length * 25` (25 IP per still-incomplete quest) and passes it to DailyQuests as bonusIP (ProgressPage.tsx:588). DailyQuests renders the header `🎁 +{bonusIP} IP for all` (line 80) and, when allComplete, the celebration banner `🎉 All quests complete! +{bonusIP} IP earned` (line 93). Because the value keys off incomplete quests, completing the last quest drives bonusIP to 0, so the success banner reads '+0 IP earned'. Quest completion itself is real (driven by analytics: minutesReadToday, today's chapters, daily review count).
WHY:     The reward the page just promised collapses to '+0 IP earned' at the exact moment of completion, undercutting the gamification payoff and looking like a calculation bug.
FIX:     Use a stable total for display: set ProgressPage.tsx:269 to `questBonusFP: wiredQuests.length * 25` (full bonus pool), or pass a separate remainingBonus for the in-progress nudge and a fixed totalBonus for the header/celebration. Separately (out of this slice) confirm quest completion actually awards IP server-side — nothing on this page mutates the balance, so the '+IP' copy may be aspirational.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/book/_lib/spaced-repetition.ts app/book/home/components/ReviewDueWidget.tsx app/book/hooks/useOnboardingState.ts app/book/page.tsx app/book/progress/page.tsx components/progress/DailyQuests.tsx components/progress/ProgressPage.tsx components/progress/progressMockData.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/book/_lib/spaced-repetition.ts app/book/home/components/ReviewDueWidget.tsx app/book/hooks/useOnboardingState.ts app/book/page.tsx app/book/progress/page.tsx components/progress/DailyQuests.tsx components/progress/ProgressPage.tsx components/progress/progressMockData.ts
git commit -m "fix(data): H5, H6, M36, L69 — Live progress page renders fabricated daily-quest re"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE H5: committed on fix/H5 (worktree ../cf-fix-H5). Covered: H5, H6, M36, L69."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/H5 && git worktree remove ../cf-fix-H5 && git branch -d fix/H5"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 9: H7 (+1) — Reading-partner (pairs) feature has no UI entry point — entirely unreachable
**Lead:** `high` · **Covers:** H7, M12 · **Edits:** `app/app/api/book/_lib/pair-repo.ts`, `app/book/home/components/PartnerProgressCard.tsx`, `app/book/home/page.tsx`, `app/pair/[code]/route.ts`, `components/workspace/WorkspacePage.tsx` · context: `app/app/api/book/me/pairs/route.ts` · ⚠ shares a file with Task L30/M34/L29/L70

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 2 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/H7 ../cf-fix-H7 audit/prod-readiness-2026-06-14
cd ../cf-fix-H7
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/book/_lib/pair-repo.ts, app/book/home/components/PartnerProgressCard.tsx, app/book/home/page.tsx, app/pair/[code]/route.ts, components/workspace/WorkspacePage.tsx.
- Read-only context (do NOT edit, just read for understanding): app/app/api/book/me/pairs/route.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `app/app/api/book/_lib/pair-repo.ts`, `app/book/home/page.tsx`, `components/workspace/WorkspacePage.tsx`, which Task L30/M34/L29/L70 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- H7 · high · app/book/home/components/PartnerProgressCard.tsx:10, app/book/home/page.tsx:1-5, components/workspace/WorkspacePage.tsx, app/pair/[code]/route.ts
PROBLEM: The full pairs backend is implemented (createPairInvite/acceptPairInvite/nudge/deletePair, bidirectional records) and the ONLY component that lets a user generate a pair invite (createInvite -> POST /me/pairs/invite, PartnerProgressCard.tsx:52-71) or nudge a partner is PartnerProgressCard. grep confirms PartnerProgressCard is imported/rendered NOWHERE — it appears only at its own definition. The legacy home (app/book/home/page.tsx) redirect()s to /dashboard; /dashboard renders components/workspace/WorkspacePage which has no partner/pairs surface (HeroSessionCard's only 'partner' match is the string 'Start Your Reading Journey'). The only reachable pairs page is /book/pair-accept (via /pair/[code] redirect), but it requires an invite link no user can ever produce.
WHY:     A social/accountability feature the product implies exists is completely unusable: users cannot pair, invite, or nudge anyone. Backend-complete, UI-absent dead weight (routes, DB schema, account-erasure handling all maintained for nothing).
FIX:     Either (a) render PartnerProgressCard in components/workspace/WorkspacePage.tsx wired to onboarding state (and add the partner-progress/name endpoint per the separate finding), or (b) if pairs is cut for launch, delete PartnerProgressCard, app/book/pair-accept/page.tsx, app/pair/[code]/route.ts, app/app/api/book/me/pairs/**, and pair-repo.ts to stop maintaining unreachable surface.

--- M12 · medium · app/book/home/components/PartnerProgressCard.tsx:213-247, app/app/api/book/me/pairs/route.ts:10-18, app/app/api/book/_lib/pair-repo.ts:143-160
PROBLEM: GET /me/pairs returns only { pair } — the bare BookUserPairItem (partnerId sub, status, pairedAt) from getUserActivePair (pair-repo.ts:143-160). The 'has partner' UI (PartnerProgressCard.tsx:213-247) renders only 'Reading Partner / Paired since {date}' plus a Nudge button and an end-partnership X — no partner name, streak, current book, or activity. grep for partnerProgress/partnerName/getPartner/partnerDisplayName returns nothing; no endpoint fetches a partner's profile or progress. The accountability premise (see how your partner is doing) is unfulfilled.
WHY:     Even if wired into the live UI, the card is hollow: a user can nudge but never see whether the partner is active, reading, or abandoned. Defeats the stated purpose of reading partners and reads as broken/abandoned.
FIX:     Add a partner-summary endpoint (extend GET /me/pairs to also return the partner's displayName from their profile and a minimal progress summary — current streak, books-in-progress count, last-active recency — exposing only non-PII fields, mirroring the gift-preview displayName-only pattern). Render those in PartnerProgressCard's 'has partner' state, gated behind partner consent or limited to coarse activity signals. (Lower priority than wiring the card in at all — see finding #1.)

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/book/_lib/pair-repo.ts app/book/home/components/PartnerProgressCard.tsx app/book/home/page.tsx app/pair/[code]/route.ts components/workspace/WorkspacePage.tsx

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/book/_lib/pair-repo.ts app/book/home/components/PartnerProgressCard.tsx app/book/home/page.tsx app/pair/[code]/route.ts components/workspace/WorkspacePage.tsx
git commit -m "fix(dead-code): H7, M12 — Reading-partner (pairs) feature has no UI entry poin"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE H7: committed on fix/H7 (worktree ../cf-fix-H7). Covered: H7, M12."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/H7 && git worktree remove ../cf-fix-H7 && git branch -d fix/H7"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 10: H8 — Referral escalation tier rewards (4,600 IP + exclusive frames/themes/badges) are never awarded — checkReferralEscalation is dead code
**Lead:** `high` · **Covers:** H8 · **Edits:** `app/app/api/book/_lib/ensure-book-started.ts`, `app/app/api/book/_lib/referral-escalation.ts`, `app/app/api/book/billing/webhook/route.ts` · ⚠ shares a file with Task M11/X1/L10

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/H8 ../cf-fix-H8 audit/prod-readiness-2026-06-14
cd ../cf-fix-H8
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/book/_lib/ensure-book-started.ts, app/app/api/book/_lib/referral-escalation.ts, app/app/api/book/billing/webhook/route.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `app/app/api/book/_lib/ensure-book-started.ts`, `app/app/api/book/billing/webhook/route.ts`, which Task M11/X1/L10 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- H8 · high · app/app/api/book/_lib/referral-escalation.ts:73, app/app/api/book/_lib/ensure-book-started.ts:291-351, app/app/api/book/billing/webhook/route.ts:52-64
PROBLEM: checkReferralEscalation (awards 3/5/10/25-activation milestones: 300/600/1200/2500 IP + mentor-frame/meridian-theme/advocate-badge) and ESCALATION_MILESTONES are exported but called from nowhere — grep across app+components returns only their own file. The referral activation path in ensure-book-started.ts:338 calls markReferralActivationRewarded (which ADDs activatedInvites at flow-points-repo.ts:827) but never invokes the escalation check. The billing webhook documents that the removed per-conversion reward was 'redistributed into escalation tier bonuses (§6.3)' and maybeAwardReferralProConversion is now an explicit no-op (webhook/route.ts:56-64) — but the escalation code meant to receive that value is unwired. Inviters who hit milestones get zero.
WHY:     The headline referral incentive (and the stated replacement for the removed Pro-conversion reward) silently pays out nothing. If the program advertises these tiers it is false advertising / churn risk among top advocates; otherwise a large block of dead, misleadingly-commented code.
FIX:     In ensure-book-started.ts, inside the fraud.allowed branch AFTER the awaited markReferralActivationRewarded (so activatedInvites is incremented first), call checkReferralEscalation(tableName, referralClaim.inviterUserId, inviterPlan) and persist the returned exclusiveReward cosmetics where the cosmetics/inventory system lives (IP is awarded internally via awardFlowPoints). Resolve inviterPlan from the inviter's entitlement (FREE/PRO). Add a test that a 3rd activation grants the 300 IP mentor-frame milestone. Note: checkReferralEscalation reads activatedInvites from the profile, so ordering after the increment is required.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/book/_lib/ensure-book-started.ts app/app/api/book/_lib/referral-escalation.ts app/app/api/book/billing/webhook/route.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/book/_lib/ensure-book-started.ts app/app/api/book/_lib/referral-escalation.ts app/app/api/book/billing/webhook/route.ts
git commit -m "fix(data): H8 — Referral escalation tier rewards (4,600 IP + exclusi"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE H8: committed on fix/H8 (worktree ../cf-fix-H8). Covered: H8."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/H8 && git worktree remove ../cf-fix-H8 && git branch -d fix/H8"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 11: H9 (+1) — Segment bulk-notify fans out up to 5000 sequential notification sends in one 30s request (SES + push per user) — will time out and partially send
**Lead:** `high` · **Covers:** H9, P6 · **Edits:** `app/app/api/book/admin/metrics/notifications/route.ts`, `app/app/api/book/admin/segments/[segmentId]/notify/route.ts`, `open-next.config.ts` · context: `app/app/api/book/_lib/notifications-repo.ts`, `infra/lib/chapterflow-frontend-stack.ts` · ⚠ shares a file with Task M14/M13

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 2 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/H9 ../cf-fix-H9 audit/prod-readiness-2026-06-14
cd ../cf-fix-H9
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/book/admin/metrics/notifications/route.ts, app/app/api/book/admin/segments/[segmentId]/notify/route.ts, open-next.config.ts.
- Read-only context (do NOT edit, just read for understanding): app/app/api/book/_lib/notifications-repo.ts, infra/lib/chapterflow-frontend-stack.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `app/app/api/book/admin/metrics/notifications/route.ts`, `open-next.config.ts`, which Task M14/M13 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- H9 · high · app/app/api/book/admin/segments/[segmentId]/notify/route.ts:59-90, app/app/api/book/_lib/notifications-repo.ts:38-147, infra/lib/chapterflow-frontend-stack.ts:391, open-next.config.ts:3-14
PROBLEM: POST /admin/segments/[segmentId]/notify runs buildSegmentUsers (two full-table scans), then loops over matches (hard cap 5000) and AWAITs createNotification per user in a sequential for-loop. createNotification does: getUserSettingsItem read, a PutCommand for the in-app row, an optional SES sendEmail (which itself does an isEmailSuppressed read + token signing + compliance config fetch), and an optional push path that runs ANOTHER DynamoDB Query for DEVICE# tokens then sends per device. The single OpenNext default ServerFn is capped at cdk.Duration.seconds(30) (frontend-stack.ts:391; open-next.config.ts shows no per-route split). The audit entry (writeAuditEntry) runs AFTER the loop and is wrapped in .catch(()=>{}), so a Lambda hard-timeout mid-loop skips it entirely. createNotification has no idempotency key, so a retry re-sends to everyone already notified.
WHY:     Segment sends beyond a few hundred users time out, deliver to a random partial subset, double-send on retry, and leave no audit record — a broken core admin capability and a CASL/compliance risk (uncontrolled partial commercial-email blasts).
FIX:     Enqueue the send rather than doing it inline: write a segment-send job + matched userIds to SQS/Dynamo and process in a background worker Lambda (the infra already has an SQS email path). At minimum: bound concurrency with chunked Promise.all (e.g. p-limit of ~10-20), write/checkpoint the audit entry incrementally (and BEFORE the loop, updating counts as you go), add per-(segmentId,userId,dispatchId) idempotency so retries don't re-send, and lower the synchronous cap far below what fits in 30s. The Next maxDuration export will NOT help here because OpenNext ignores it; the real fix is moving work off the request.

--- P6 · polish · app/app/api/book/admin/segments/[segmentId]/notify/route.ts:59, app/app/api/book/admin/metrics/notifications/route.ts:82-88,124-133
PROBLEM: notify/route.ts:59 labels the loop '// Fire-and-forget notifications' but every createNotification at :64 is awaited — the comment hides the cost that drives the timeout finding. Separately, notifications/route.ts:82 builds dailyVolume as days.map(d => ({date:d, value:0})) and :85-88 contains a dead `if (scanned > 0) { /* comment only */ }` block, so the daily-volume chart always renders flat zero, reading as fabricated/empty data to the operator. The notification scan's ProjectionExpression already includes createdAt (route.ts:45), so a real per-day computation is feasible without new reads.
WHY:     Misleading comment masks a real perf problem; the notifications dashboard shows a permanently-zero daily-volume chart that looks like a data outage or fake data.
FIX:     Fix the notify comment to reflect synchronous sends (or make sends actually async/batched per finding 1). For dailyVolume, bucket the already-scanned notifications by createdAt slice(0,10) into the days array (createdAt is already projected) — or remove the chart until backed by real data so it isn't mistaken for a zeroed metric. Delete the dead if-block.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/book/admin/metrics/notifications/route.ts app/app/api/book/admin/segments/[segmentId]/notify/route.ts open-next.config.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/book/admin/metrics/notifications/route.ts app/app/api/book/admin/segments/[segmentId]/notify/route.ts open-next.config.ts
git commit -m "fix(ops): H9, P6 — Segment bulk-notify fans out up to 5000 sequential n"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE H9: committed on fix/H9 (worktree ../cf-fix-H9). Covered: H9, P6."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/H9 && git worktree remove ../cf-fix-H9 && git branch -d fix/H9"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 12: H10 (+3) — Ask-the-Book daily rate limit is bypassable via a race (parallel requests) and aborted streams consume tokens free
**Lead:** `high` · **Covers:** H10, M19, L23, L43 · **Edits:** `app/app/api/book/books/[bookId]/ask/route.ts` · context: `app/app/api/book/books/[bookId]/chapters/[chapterNumber]/audio/route.ts`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 4 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/H10 ../cf-fix-H10 audit/prod-readiness-2026-06-14
cd ../cf-fix-H10
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/book/books/[bookId]/ask/route.ts.
- Read-only context (do NOT edit, just read for understanding): app/app/api/book/books/[bookId]/chapters/[chapterNumber]/audio/route.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- H10 · high · app/app/api/book/books/[bookId]/ask/route.ts:53-64, app/app/api/book/books/[bookId]/ask/route.ts:295-312
PROBLEM: The daily question cap is a non-atomic read-modify-write. The handler GETs the count (line 53-56), compares `currentCount >= limit` (line 62), and only increments in the stream's `finally` block AND only when `streamSuccess === true` (line 295-312). The UpdateCommand is `SET #count = if_not_exists(#count,:zero) + :one` with NO ConditionExpression (grep confirms zero ConditionExpression in this file). Two real holes: (a) N parallel POSTs all read the same currentCount before any increment lands, so all N pass the gate and all N invoke Claude — the 5/day (free) / 20/day (Pro) cap is trivially exceeded; (b) on client abort the recordAiUsage path classifies outcome as 'client_abort' (line 289) and streamSuccess stays false, so tokens were billed by Anthropic but the count is never incremented — abort-and-retry is unlimited free LLM usage.
WHY:     Unbounded Claude (Haiku) spend on an authed but otherwise open endpoint. A scripted user can far exceed the intended per-day cap, turning a cost-controlled feature into an open cost vector at launch.
FIX:     Make the reservation atomic and decoupled from stream success. Before opening the stream, do a single conditional UpdateCommand `UpdateExpression: 'SET #count = if_not_exists(#count,:zero) + :one, ...'` with `ConditionExpression: 'attribute_not_exists(#count) OR #count < :limit'` and `:limit` set to the plan limit; on ConditionalCheckFailedException return 429. This both serializes concurrent requests (last writer increments, others fail the condition) and counts the attempt the moment Claude is invoked so aborts can't farm free tokens. Optionally compensate (decrement) only on a pre-stream failure (e.g. missing API key / book-not-found) before any tokens flow.

--- M19 · medium · app/app/api/book/books/[bookId]/ask/route.ts:76-79, app/app/api/book/books/[bookId]/chapters/[chapterNumber]/audio/route.ts:61, app/app/api/book/books/[bookId]/chapters/[chapterNumber]/audio/route.ts:275-276
PROBLEM: Ask calls getBookPackageByIdForTone(bookId,'direct') (line 76) and Audio calls getBookPackageByIdForTone(bookId,tone) (lines 61, 275) — both resolve from the in-repo BOOK_PACKAGES array (bookPackages.ts:1164, plus a fixed set of auto-registered JSON imports at ~1934+). The reader's chapter route uses content-service (getUserAccessibleChapter → S3 manifest + chapter JSON) and the quiz/scenarios routes likewise use getPublishedBookManifest. For any catalog book that exists in S3/Dynamo (ingested via the pipeline) but is NOT compiled into the in-repo package set, the reader works while Ask returns 404 'Book not found' (line 77-79) and Audio returns 404 (line 276). Content can also drift between what the reader renders (S3) and what Ask answers about (in-repo snapshot).
WHY:     Ask-the-Book and Audio silently break for any catalog book not also hardcoded in the repo — a confusing dead feature on those titles plus a correctness gap (Ask answers from a different source than the reader shows).
FIX:     Source Ask and Audio chapter content from the same content-service the reader uses (getPublishedBookManifest + S3 chapter JSON) so all book-content surfaces share one source of truth. If the in-repo packages are deliberately the only supported set, gate the catalog/reader to that same set so behavior is consistent across features (and add a test/asserting check that catalog membership == Ask/Audio support).

--- L23 · low · app/app/api/book/books/[bookId]/ask/route.ts:31-46, app/app/api/book/books/[bookId]/ask/route.ts:235-250
PROBLEM: The ask route accepts a client-provided history array of {role:'user'|'assistant', content} (lines 31-46) and forwards it verbatim to Claude as prior turns: messages: [...history, {role:'user', content:question}] (line 250). A user can fabricate assistant turns to steer the model and soften the 'only answer about the book' guardrail (prompt injection). The per-day question limit is count-based, so fabricated history is free within the cap. Impact is bounded: history is capped at 20 turns / 2000 chars each, the question at 500 chars, max_tokens 400, and the server system prompt (lines 238-249) is always present and not overridable.
WHY:     Users can partially bypass the topical guardrail and shape AI output by injecting fake assistant history, and run somewhat larger prompts than intended within the rate limit.
FIX:     Persist conversation history server-side keyed by a session id and reconstruct it from the store instead of trusting the request body; or at minimum treat client 'assistant' turns with suspicion (collapse/relabel them) and cap total history tokens. Keep the existing length caps and the server system prompt.

--- L43 · low · app/app/api/book/books/[bookId]/ask/route.ts:31-46, app/app/api/book/books/[bookId]/ask/route.ts:250
PROBLEM: body.history is accepted and passed into the Claude messages array as `messages: [...history, {role:'user', content:question}]` (line 250). The filter (31-46) only checks role ∈ {user,assistant}, slices to the last 20 turns, and truncates each to 2000 chars — it does not verify the assistant turns were actually produced by the model. A client can fabricate assistant turns (e.g. an assistant message that 'agrees' to ignore restrictions) to try to steer Raymond off-topic / past the 'only answer book questions' guard. The 20 turns x 2000 chars also bounds token cost only loosely.
WHY:     Limited blast radius: the Anthropic `system` parameter (lines 238-249) is structurally privileged and always applied, the model is Haiku answering book questions, and content is server-loaded. Worst case is reputational (off-brand answers), not data loss. Token cost is loosely bounded.
FIX:     Treat client history as untrusted: persist real conversation turns server-side and reconstruct from storage, OR (cheaper) keep the strong system prompt (already a separate privileged param), add an explicit instruction that prior assistant turns are not authoritative and the topic restriction is absolute, and tighten the per-turn char cap + total-history token budget. Note the cache path already only caches standalone (no-history) questions, which is correct.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/book/books/[bookId]/ask/route.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/book/books/[bookId]/ask/route.ts
git commit -m "fix(security): H10, M19, L23, L43 — Ask-the-Book daily rate limit is bypassable via a ra"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE H10: committed on fix/H10 (worktree ../cf-fix-H10). Covered: H10, M19, L23, L43."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/H10 && git worktree remove ../cf-fix-H10 && git branch -d fix/H10"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 13: H11 — Reflection-feedback endpoint: client-controlled exampleId defeats the rate limit and uncapped prompt fields inflate token cost
**Lead:** `high` · **Covers:** H11 · **Edits:** `app/app/api/book/_lib/ai-service.ts`, `app/app/api/book/me/reflections/[bookId]/[chapterNumber]/feedback/route.ts`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/H11 ../cf-fix-H11 audit/prod-readiness-2026-06-14
cd ../cf-fix-H11
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/book/_lib/ai-service.ts, app/app/api/book/me/reflections/[bookId]/[chapterNumber]/feedback/route.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- H11 · high · app/app/api/book/me/reflections/[bookId]/[chapterNumber]/feedback/route.ts:29-53, app/app/api/book/_lib/ai-service.ts:95-118
PROBLEM: exampleId is read raw from the body (`typeof body.exampleId === 'string' ? body.exampleId : ''`, line 29) with no validation that it corresponds to a real example in the chapter, then used as both the rate-limit key `feedbackLimitSk(today, exampleId)` (line 47) and the cache key `reflectionFeedbackSk(bookId, chapter, exampleId)` (line 56). The 'already requested today' guard (line 51) is therefore per-exampleId — a caller sending a fresh random exampleId on every request never trips it and gets unlimited Sonnet streams. Separately, scenario/whatToDo/whyItMatters/chapterTitle are read from the body (lines 31-34) with NO length cap (grep confirms only reflectionText has the 20/2000 bounds at lines 36-41) and are interpolated verbatim into the Sonnet user message in streamReflectionFeedback (ai-service.ts:113-116). A caller can stuff large strings into whatToDo to drive up input-token cost per call.
WHY:     Unbounded Sonnet-4-6 spend ($3/$15 per MTok — the most expensive of the three features). Cost-abuse launch blocker on a paid product, plus a mild prompt-injection surface since the fields are echoed into the prompt.
FIX:     Rate-limit per (user, chapter) instead of per client exampleId, OR validate exampleId against the chapter's real examples (load via content-service getPublishedBookManifest / chapter JSON and confirm the example exists) before using it as the limit/cache key. Independently, cap scenario/whatToDo/whyItMatters/chapterTitle server-side (e.g. the same maxLength ~2500 the scenarios route applies via requireString) before passing them to streamReflectionFeedback. Validating exampleId also fixes the cache key, which currently caches per arbitrary client id.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/book/_lib/ai-service.ts app/app/api/book/me/reflections/[bookId]/[chapterNumber]/feedback/route.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/book/_lib/ai-service.ts app/app/api/book/me/reflections/[bookId]/[chapterNumber]/feedback/route.ts
git commit -m "fix(security): H11 — Reflection-feedback endpoint: client-controlled exam"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE H11: committed on fix/H11 (worktree ../cf-fix-H11). Covered: H11."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/H11 && git worktree remove ../cf-fix-H11 && git branch -d fix/H11"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 14: H12 — DocumentClient convertEmptyValues:true rewrites empty Sets (and empty strings) to NULL, breaking entitlement set-initialization
**Lead:** `high` · **Covers:** H12 · **Edits:** `app/app/api/_lib/aws.ts` · context: `app/app/api/book/_lib/repo.ts` · ⚠ shares a file with Task L90

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/H12 ../cf-fix-H12 audit/prod-readiness-2026-06-14
cd ../cf-fix-H12
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/_lib/aws.ts.
- Read-only context (do NOT edit, just read for understanding): app/app/api/book/_lib/repo.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `app/app/api/_lib/aws.ts`, which Task L90 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- H12 · high · app/app/api/_lib/aws.ts:20-22, app/app/api/book/_lib/repo.ts:1833 (+1845 :emptySet), app/app/api/book/_lib/repo.ts:1952/1961, app/app/api/book/_lib/repo.ts:1988/1995, app/app/api/book/_lib/repo.ts:2039, app/app/api/book/_lib/repo.ts:3029/3047, app/app/api/book/_lib/repo.ts:708 (ADD unlockedBookIds :bookSet)
PROBLEM: ddbDoc is built with marshallOptions {removeUndefinedValues:true, convertEmptyValues:true}. I empirically ran the installed @aws-sdk/util-dynamodb 3.996.2: marshall({s:'',set:new Set()},{convertEmptyValues:true}) yields {s:{NULL:true},set:{NULL:true}}. Every entitlement-creation path that runs `unlockedBookIds = if_not_exists(unlockedBookIds, :emptySet)` with `:emptySet = new Set<string>()` (updateUserEntitlementFromStripe 1833, attachStripeCustomerToEntitlement 1952, attachStripeCustomerIfAbsent 1988, adminUpdateUserEntitlement 2039, redeemLicenseKey TransactWrite 3029) therefore writes unlockedBookIds as a NULL attribute, not an empty SS. reserveBookEntitlement (line 708) then runs `ADD unlockedBookIds :bookSet`; ADD accepts only Number/Set operands, so applied to an existing NULL attribute DynamoDB throws ValidationException. redeemLicenseKey/attach* create the entitlement item with no precondition that it already exists, so a Stripe/license/admin-provisioned user who has never reserved a book gets unlockedBookIds=NULL and 500s on their first reserve (even an active-license PRO user, who is allowed to reserve, hits it). The ConditionExpression branch `attribute_not_exists(unlockedBookIds)` does NOT save it because a NULL attribute still EXISTS.
WHY:     Pro/license/admin-provisioned users get a 500 (server_error) when reserving their first book. Plus broad latent drift: 83 `|| ''` read-fallbacks in repo.ts paper over '' fields that round-trip to NULL.
FIX:     Two changes that MUST land together (order matters): (1) remove `convertEmptyValues:true` from aws.ts marshallOptions; (2) stop writing empty sets — with the flag off, marshall(new Set()) THROWS ('Pass a non-empty set, or options.convertEmptyValues=true'), so leaving the `:emptySet = new Set()` initializers in place would break every entitlement path immediately at marshal time. Drop the `unlockedBookIds = if_not_exists(unlockedBookIds, :emptySet)` clause entirely from all 5 sites and let the first `ADD unlockedBookIds :bookSet` create the SS (parseStringArray already returns [] for a missing attribute, so reads are safe). For existing prod items already written as NULL, add a one-time backfill (REMOVE unlockedBookIds where it is NULL) or have reserve REMOVE-then-ADD. Empty strings then store natively as S:''.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/_lib/aws.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/_lib/aws.ts
git commit -m "fix(data): H12 — DocumentClient convertEmptyValues:true rewrites empt"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE H12: committed on fix/H12 (worktree ../cf-fix-H12). Covered: H12."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/H12 && git worktree remove ../cf-fix-H12 && git branch -d fix/H12"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 15: H14 (+3) — App table never enables TTL though cron+app write ttl
**Lead:** `high` · **Covers:** H14, H15, M25, L52 · **Edits:** `.github/workflows/_deploy-infra.yml`, `infra/bin/app.ts`, `infra/iam/github-actions-dev-policy.json`, `infra/lambda/lib/email-compliance.ts`, `infra/lambda/lib/streak-at-risk.ts`, `infra/lambda/lib/weekly-digest.ts`, `infra/lambda/lib/welcome-back-nudge.ts`, `infra/lambda/reading-reminder-cron.ts`, `infra/lib/chapterflow-backend-stack.ts` · context: `infra/lib/chapterflow-frontend-stack.ts` · ⚠ shares a file with Task L34/H26/H16/M6

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 4 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/H14 ../cf-fix-H14 audit/prod-readiness-2026-06-14
cd ../cf-fix-H14
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: .github/workflows/_deploy-infra.yml, infra/bin/app.ts, infra/iam/github-actions-dev-policy.json, infra/lambda/lib/email-compliance.ts, infra/lambda/lib/streak-at-risk.ts, infra/lambda/lib/weekly-digest.ts, infra/lambda/lib/welcome-back-nudge.ts, infra/lambda/reading-reminder-cron.ts, infra/lib/chapterflow-backend-stack.ts.
- Read-only context (do NOT edit, just read for understanding): infra/lib/chapterflow-frontend-stack.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `infra/lambda/lib/email-compliance.ts`, `infra/lambda/lib/streak-at-risk.ts`, `infra/lambda/reading-reminder-cron.ts`, `infra/lib/chapterflow-backend-stack.ts`, which Task L34/H26/H16/M6 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- H14 · high · infra/lib/chapterflow-backend-stack.ts:130-140, infra/lambda/lib/welcome-back-nudge.ts:60-61, infra/lambda/lib/welcome-back-nudge.ts:101, infra/lambda/lib/streak-at-risk.ts:157-162, infra/lambda/lib/weekly-digest.ts:117,152, infra/lambda/reading-reminder-cron.ts:169
PROBLEM: ChapterFlowAppTable (backend-stack.ts:130-140) is defined with NO timeToLiveAttribute. grep confirms timeToLiveAttribute exists only in the frontend stack's cache table (revalidatedAt). Meanwhile every writer stamps a numeric `ttl` field: reading-reminder-cron.ts:169 (REMINDER_SENT#<date>), streak-at-risk.ts:157-162 (NUDGE_SENT#streak_at_risk#<date>), weekly-digest.ts:117/152 (NUDGE_SENT#weekly_digest#<weekKey>), welcome-back-nudge.ts:101/129 (NUDGE_SENT#welcome_back), and app/app/api/book/_lib/pair-repo.ts:23,212. Critically, welcome-back uses a NON-rotating dedup key `NUDGE_SENT#welcome_back` (line 61) that relies entirely on TTL expiry (30-day) to ever allow a re-send.
WHY:     With TTL disabled, the welcome-back dedup record never expires, so the welcome-back email/nudge fires exactly ONCE per user for their entire lifetime (the 30-day re-engagement loop is dead). Date-rotating dedup markers (reminder/streak/digest) plus the NOTIF# items and pair TTL records also never get reaped → unbounded partition bloat on every active user, growing RCU/storage cost and item-collection sizes forever. IaC drift: the table behavior silently diverges from what the handlers assume.
FIX:     Add `timeToLiveAttribute: 'ttl'` to the ChapterFlowAppTable definition (backend-stack.ts:130). Verify no other entity stores a `ttl` attribute it does NOT want auto-deleted before enabling (a one-time scan of attribute usage). Trivial one-line CDK change; enabling TTL on an existing prod table is a non-destructive online operation.

--- H15 · high · infra/lib/chapterflow-backend-stack.ts:437-438, infra/lambda/lib/email-compliance.ts:99, infra/lambda/lib/email-compliance.ts:131-148, .github/workflows/_deploy-infra.yml:73-79
PROBLEM: The reminder Lambda sets APP_BASE_URL = process.env.CHAPTERFLOW_APP_BASE_URL ?? 'https://chapterflow.siliconx.ca' (backend-stack.ts:437-438). _deploy-infra.yml's 'CDK deploy backend' step (lines 73-79) passes only CDK_DEFAULT_ACCOUNT, CHAPTERFLOW_ENV, CHAPTERFLOW_OPS_ALERT_EMAIL — it never sets CHAPTERFLOW_APP_BASE_URL, so the fallback to the legacy siliconx host always wins. resolveEmailConfig() (email-compliance.ts:131-148) overlays only EMAIL_POSTAL_ADDRESS/EMAIL_UNSUBSCRIBE_SECRET/EMAIL_SENDER_NAME/EMAIL_SUPPORT_ADDRESS from SSM — appBaseUrl is NOT overlaid, so it stays the value from getEmailConfig() which reads process.env.APP_BASE_URL (default chapterflow.siliconx.ca at email-compliance.ts:99). buildUnsubscribeUrl/emailFooter then build the one-click unsubscribe URL, List-Unsubscribe header, and prefs link against that wrong host.
WHY:     Every reminder/streak/digest/welcome-back email links CTAs, the one-click unsubscribe URL, and List-Unsubscribe header to the legacy chapterflow.siliconx.ca domain instead of the live app host. If that domain no longer serves the app's /app/api/book/email/unsubscribe route, one-click unsubscribe fails — a CASL/CAN-SPAM compliance violation (working unsubscribe is mandatory).
FIX:     Pass CHAPTERFLOW_APP_BASE_URL into the backend deploy step env in _deploy-infra.yml AND/OR add an EMAIL_APP_BASE_URL (or reuse CHAPTERFLOW_APP_BASE_URL) overlay in resolveEmailConfig()'s SSM Promise.all so appBaseUrl is resolved from SSM like the other EMAIL_* values. Drop the siliconx.ca fallback (fail loudly / refuse to send rather than mint links to a dead host). Confirm the SSM param /chapterflow/<env>/CHAPTERFLOW_APP_BASE_URL is actually populated.

--- M25 · medium · infra/lib/chapterflow-backend-stack.ts:404-430, infra/lib/chapterflow-backend-stack.ts:525-533, infra/bin/app.ts:97-157, infra/lib/chapterflow-backend-stack.ts:237-294, infra/lib/chapterflow-backend-stack.ts:327-337, infra/lib/chapterflow-backend-stack.ts:561-563, infra/iam/github-actions-dev-policy.json:35-55, .github/workflows/_deploy-infra.yml:73-98
PROBLEM: Three sub-claims, all verified. (1) Stale-bundle risk: ReadingReminderCron and EmailSuppressionHandler deploy lambda.Code.fromAsset('../lambda/dist') (lines 430, 533); the esbuild commands are comment-only (404-408, 525-528). git ls-files confirms reading-reminder-cron.js + suppression-handler.js are COMMITTED. _deploy-infra.yml never runs esbuild. I rebuilt reading-reminder-cron.ts with the documented esbuild command and diffed against the committed bundle: identical (28791 bytes, 0 diff lines) — so bundles match source TODAY, but any future .ts edit ships stale with no error. (2) No prod-secret guard: bin/app.ts:97-157 injects every secret via conditional spreads (...(process.env.X && {X})) with no assertion that launch-critical secrets are present when env=prod. (3) Dead App Runner IAM: appRunnerRuntimeRole (237) is assumed by tasks.apprunner.amazonaws.com and grants broad DDB/S3/SSM; its ARN is a CfnOutput (561). The app deploys to OpenNext Lambda (_deploy-app.yml runs `open-next build` + cdk deploy ChapterFlowFrontend, no App Runner). The dev policy's AppRunnerDeploy (apprunner:Describe/Update/ListOperations) and PassRoleToAppRunner (iam:PassRole to ChapterFlowAppRuntimeRole) are correspondingly dead.
WHY:     Stale Lambda code can ship invisibly (a future cron/handler .ts change would not reach prod). A missing launch-critical secret produces a silently degraded prod deploy instead of a hard failure. The unused App Runner role is standing broad privilege with no consumer, and the CI dev policy carries unnecessary apprunner:* + PassRole grants (excess attack surface / least-privilege drift).
FIX:     (1) Replace fromAsset('../lambda/dist') with CDK NodejsFunction bundling (esbuild at synth) OR add an esbuild step in _deploy-infra.yml before cdk deploy plus a CI 'rebuild and git diff --exit-code lambda/dist' drift check. (2) In bin/app.ts, when cfg.env==='prod' assert presence of the launch-critical secrets (Stripe secret/webhook, Cognito config, AUTH_STATE_SECRET, AI keys as applicable) and throw if any is missing. (3) Delete appRunnerRuntimeRole + its policies + the AppRunnerRuntimeRoleArn output, and remove the AppRunnerDeploy + PassRoleToAppRunner statements from github-actions-dev-policy.json.

--- L52 · low · infra/lib/chapterflow-backend-stack.ts:207-235, infra/lib/chapterflow-frontend-stack.ts:725-730, infra/lib/chapterflow-backend-stack.ts:149-160, infra/lib/chapterflow-backend-stack.ts:30-62, infra/lib/chapterflow-backend-stack.ts:183-196, infra/lib/chapterflow-backend-stack.ts:412-413
PROBLEM: (a) ContentBucket (207-213) sets blockPublicPolicy:false + restrictPublicBuckets:false specifically to allow the PublicReadLibraryCovers resource policy (227-235) granting s3:GetObject to AnyPrincipal on book-content/library/covers/*. Covers are published to this bucket by scripts/book/publish-library-assets.ts (BOOK_CONTENT_BUCKET) and served via the public policy — the CloudFront 'book-covers/*' behavior (frontend-stack.ts:725) points at the S3 _assets origin, a different path, so library covers are NOT fronted by CloudFront/OAC. This removes the account-level public-access guardrail on a bucket that also holds paid book content. (b) AnalyticsTable declares stream: NEW_AND_OLD_IMAGES (158) but grep finds no DynamoEventSource/StartingPosition/grantStreamRead consumer anywhere in infra or app — dead stream. (c) resolveAllowedWebOrigins() (30-62) always includes http://localhost:3000, https://siliconx.ca + *.siliconx.ca, and all chapterflow domains, applied to the ingest bucket CORS (190) in EVERY env including prod (no envName parameter). (d) Reminder SES sender hardcoded to info@chapterflow.ca and the SES identity scoped to chapterflow.ca (412-413, 456) for ALL envs; dev/staging lack that verified identity so sends would fail — currently masked by the EMAIL_POSTAL_ADDRESS kill-switch (email-compliance.ts:228-237, default '' in non-prod).
WHY:     (a) Reduced defense-in-depth on a content bucket holding paid material. (b) Minor wasted DynamoDB stream cost + confusion (looks like an intended consumer is missing). (c) Sloppy prod CORS surface — prod ingest accepts localhost + legacy siliconx origins. (d) dev/staging cron email sends would fail outright if the postal-address kill-switch were ever set there.
FIX:     (a) Serve library covers through CloudFront with OAC from the content bucket (or a dedicated public covers prefix/bucket) and restore blockPublicPolicy:true/restrictPublicBuckets:true. (b) Remove stream: NEW_AND_OLD_IMAGES from the analytics table unless a consumer is planned. (c) Make resolveAllowedWebOrigins env-aware (drop localhost + siliconx in prod, key off envName). (d) Make the SES sender email/identity env-aware (per-env verified domain) instead of hardcoding chapterflow.ca.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint infra/bin/app.ts infra/lambda/lib/email-compliance.ts infra/lambda/lib/streak-at-risk.ts infra/lambda/lib/weekly-digest.ts infra/lambda/lib/welcome-back-nudge.ts infra/lambda/reading-reminder-cron.ts infra/lib/chapterflow-backend-stack.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add .github/workflows/_deploy-infra.yml infra/bin/app.ts infra/iam/github-actions-dev-policy.json infra/lambda/lib/email-compliance.ts infra/lambda/lib/streak-at-risk.ts infra/lambda/lib/weekly-digest.ts infra/lambda/lib/welcome-back-nudge.ts infra/lambda/reading-reminder-cron.ts infra/lib/chapterflow-backend-stack.ts
git commit -m "fix(data): H14, H15, M25, L52 — App table never enables TTL though cron+app write tt"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE H14: committed on fix/H14 (worktree ../cf-fix-H14). Covered: H14, H15, M25, L52."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/H14 && git worktree remove ../cf-fix-H14 && git branch -d fix/H14"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 16: H16 — Reminder cron full-table Scan + serial N+1 reads on 5-min timeout
**Lead:** `high` · **Covers:** H16 · **Edits:** `infra/lambda/reading-reminder-cron.ts` · context: `infra/lib/chapterflow-backend-stack.ts` · ⚠ shares a file with Task H14

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/H16 ../cf-fix-H16 audit/prod-readiness-2026-06-14
cd ../cf-fix-H16
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: infra/lambda/reading-reminder-cron.ts.
- Read-only context (do NOT edit, just read for understanding): infra/lib/chapterflow-backend-stack.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `infra/lambda/reading-reminder-cron.ts`, which Task H14 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- H16 · high · infra/lambda/reading-reminder-cron.ts:57-66, infra/lambda/reading-reminder-cron.ts:95-101, infra/lambda/reading-reminder-cron.ts:109-115, infra/lambda/reading-reminder-cron.ts:183-187, infra/lib/chapterflow-backend-stack.ts:142-147
PROBLEM: handler() paginates a full-table ScanCommand filtering entity='BOOK_USER_SETTINGS' (lines 58-66). The app table defines only ONE GSI — quiz-scope-createdAt-index (backend-stack.ts:142-147) — there is NO GSI on `entity`, so this is a true full-table scan every hour (the filter runs after RCU is already consumed). Per matched user it does serial awaits: a Get for the dedup marker (95-101), a Get for the profile (109-115), an Update for the in-app notif, an optional SES send, and a Put for the dedup marker. Then Promise.allSettled fires the 3 nudge handlers (183-187), each of which ALSO iterates every accumulated user serially issuing more Gets (STREAK/PROFILE/ENGAGEMENT/LOOP queries). All on a 5-minute Lambda timeout (backend-stack.ts:432).
WHY:     Work is O(users x serial awaits). At a few thousand active users the 5-minute timeout is hit and later users in the scan are silently dropped (no reminders/nudges for them), and the hourly Scan wastes RCU proportional to total table size, not just settings rows.
FIX:     Add a sparse GSI keyed on `entity` (or a dedicated reminder-schedule GSI keyed by reminder hour) so the cron Queries only settings rows; batch per-user reads with BatchGetItem and share the PROFILE/STREAK fetches across the reminder pass and the 3 nudge handlers instead of re-Getting; run users with bounded concurrency (e.g. p-limit) rather than one serial await chain; consider fan-out (SQS per-user) if user count grows. As an interim guard, raise the timeout and add a CloudWatch duration/timeout alarm on this function so silent drops are visible.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint infra/lambda/reading-reminder-cron.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add infra/lambda/reading-reminder-cron.ts
git commit -m "fix(performance): H16 — Reminder cron full-table Scan + serial N+1 reads on "

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE H16: committed on fix/H16 (worktree ../cf-fix-H16). Covered: H16."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/H16 && git worktree remove ../cf-fix-H16 && git branch -d fix/H16"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 17: H17 — Reduced-motion users get the mobile sticky CTA bar pinned over content from first paint, with all scroll/visibility gating bypassed
**Lead:** `high` · **Covers:** H17 · **Edits:** `components/landing/MobileStickyBar.tsx`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/H17 ../cf-fix-H17 audit/prod-readiness-2026-06-14
cd ../cf-fix-H17
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: components/landing/MobileStickyBar.tsx.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- H17 · high · components/landing/MobileStickyBar.tsx:45-51
PROBLEM: Line 50: animate y = `prefersReducedMotion ? 0 : (visible && !dismissed && !pricingInView ? 0 : 100)`. When prefersReducedMotion is true the bar y is unconditionally 0 (shown), so the visible(scrollY>600), pricingInView, and dismissed predicates are entirely skipped. Line 49 also sets initial y=0 for reduced-motion so it is shown on first paint. The only escape is line 45 `if (prefersReducedMotion && dismissed) return null;` which requires the user to first manually dismiss. Net: reduced-motion users see the fixed bottom CTA bar from page load (before any scroll), it never auto-hides over the pricing section, and it overlaps the footer/content until dismissed.
WHY:     Users with reduced-motion enabled see a persistent CTA bar covering the bottom of every mobile screen from load, obscuring content/footer and ignoring the intended hide-when-pricing-is-shown behavior — a visible regression for the exact accessibility cohort the gating serves.
FIX:     Compute the visibility predicate once regardless of motion preference and only vary the transition: `const shown = visible && !dismissed && !pricingInView;` then `initial={{ y: 100 }}` always, `animate={{ y: shown ? 0 : 100 }}`, and `transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.3 }}`. (With initial y:100 always, the reduced-motion-only early-return at line 45 becomes unnecessary.)

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint components/landing/MobileStickyBar.tsx

============ STEP 5 — COMMIT (only after checks pass) ============
git add components/landing/MobileStickyBar.tsx
git commit -m "fix(accessibility): H17 — Reduced-motion users get the mobile sticky CTA bar p"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE H17: committed on fix/H17 (worktree ../cf-fix-H17). Covered: H17."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/H17 && git worktree remove ../cf-fix-H17 && git branch -d fix/H17"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 18: H18 — Public book-request endpoint has no rate limiting or abuse controls (writes DynamoDB + sends SES email per request)
**Lead:** `high` · **Covers:** H18 · **Edits:** `app/api/book-requests/route.ts`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/H18 ../cf-fix-H18 audit/prod-readiness-2026-06-14
cd ../cf-fix-H18
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/api/book-requests/route.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- H18 · high · app/api/book-requests/route.ts:57-111, app/api/book-requests/route.ts:152-237
PROBLEM: POST /api/book-requests is intentionally public (the header comment and middleware.ts:38-44 confirm only /app, /book, /dashboard are protected; this top-level route is reachable logged-out). Each valid submission persists an item to the operational DynamoDB table (persist(), lines 152-197) and fires a best-effort SES email to the team (notifyTeam(), lines 199-237). The only input checks are title length>=2 and an email regex (lines 72-77); cleanString caps lengths and strips CRLF (good header-injection defense), but there is no rate limit, captcha, origin/CSRF check, or per-IP throttle. Grep confirms the repo's only rate limiting lives in /app/api/book/* routes as per-user DynamoDB markers (e.g. quiz/feedback) — none of it is wired into or reusable by this public route. The handler reads x-forwarded-for only to store it, not to throttle.
WHY:     Pre-launch this is an open, unauthenticated write+email amplification surface: unbounded DynamoDB writes, unbounded SES sends (cost + SES quota/reputation risk), and team-inbox flooding/spam relay via title/author/note fields. Trivially scriptable once the site is public.
FIX:     Add a per-IP throttle before persist() (an in-memory token bucket is weak in serverless/multi-instance; prefer a DynamoDB TTL counter keyed on the x-forwarded-for IP, e.g. a REQLIMIT# item with conditional increment, capping to a few/hour) and gate notifyTeam behind the same limit so a burst can't fan out emails. Add a honeypot field and/or Turnstile/hCaptcha token on the public form. At minimum cap SES sends per window.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/api/book-requests/route.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/api/book-requests/route.ts
git commit -m "fix(security): H18 — Public book-request endpoint has no rate limiting or"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE H18: committed on fix/H18 (worktree ../cf-fix-H18). Covered: H18."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/H18 && git worktree remove ../cf-fix-H18 && git branch -d fix/H18"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 19: H19 (+1) — Privacy & Data-Rights pages claim analytics/location are excluded from self-serve export, but the export route returns them
**Lead:** `high` · **Covers:** H19, L59 · **Edits:** `app/app/api/book/me/export/route.ts`, `app/contact/page.tsx`, `app/legal/data-rights/page.tsx`, `app/legal/privacy/page.tsx`, `middleware.ts` · ⚠ shares a file with Task H2/L54/M28/L58

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 2 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/H19 ../cf-fix-H19 audit/prod-readiness-2026-06-14
cd ../cf-fix-H19
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/book/me/export/route.ts, app/contact/page.tsx, app/legal/data-rights/page.tsx, app/legal/privacy/page.tsx, middleware.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `app/app/api/book/me/export/route.ts`, `app/contact/page.tsx`, `app/legal/privacy/page.tsx`, which Task H2/L54/M28/L58 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- H19 · high · app/legal/data-rights/page.tsx:41-46, app/legal/privacy/page.tsx:103, app/app/api/book/me/export/route.ts:103-108, app/app/api/book/me/export/route.ts:130-131, app/app/api/book/me/export/route.ts:196-201, app/app/api/book/me/export/route.ts:466-478
PROBLEM: The Data-Rights page (data-rights/page.tsx:43-45) states usage analytics and approximate-location telemetry 'are not part of the self-serve export — to request a copy, email us', and the Privacy page Your-Controls bullet (privacy/page.tsx:103) describes the export without analytics. But export/route.ts fetches getUserSnapshot + getUserEvents(...,200) (lines 103-108) and embeds them under data.analytics in the JSON format (lines 198-201) and renders a full 'Usage Analytics' Markdown section that explicitly says 'includes approximate location and device' (lines 466-477). The route also carries a self-contradictory banner string data.analyticsAndLocation (lines 130-131) asserting the data is NOT included while the same response object includes it. CSV is the only format that omits analytics, so behavior is inconsistent across formats too.
WHY:     A published privacy/data-rights representation materially understates what the self-serve export discloses: users and regulators are told the access/export right behaves one way while it behaves another. Misstates a GDPR/CCPA access-right surface, risks a misrepresentation-of-data-practices claim, and confuses UX (users email support for data they already downloaded).
FIX:     Pick one source of truth. Since the export already includes analytics in JSON/MD, update data-rights/page.tsx:43-45 and the privacy Data-export bullet (privacy/page.tsx:103) to state analytics + approximate-location ARE included in JSON/Markdown exports, and delete the stale banner string at export/route.ts:130-131 (and remove analyticsAndLocation from the ExportData type at line 40). For format parity, either add an analytics section to exportToCsv() or have the policy note CSV omits it. (Alternative, if exclusion is the intended product behavior: drop the analytics fetch at lines 103-108 and the JSON/MD embeds at lines 196-201 and 465-478.)

--- L59 · low · app/legal/data-rights/page.tsx:27, app/legal/data-rights/page.tsx:64-73, app/contact/page.tsx:52, app/contact/page.tsx:59-60, middleware.ts:72-87
PROBLEM: Data-Rights (a public, footer-linked legal page) directs most rights to /book/settings (data-rights/page.tsx:27, plus the deactivate/delete bullets at 64-73); Contact does likewise (contact/page.tsx:52). For a logged-out visitor or regulator evaluating the privacy posture, clicking 'Settings' hits an auth-gated route. CORRECTION to the original: middleware.ts:72-87 redirects unauthenticated /book/* to /auth/login WITH a returnTo set to the original path, so the user is NOT dropped into a context-less dead end — after sign-in they land back on Settings. The remaining real nit is that the page never tells a logged-out reader that Settings requires sign-in, and offers no in-page explanation of how to exercise rights without an account beyond the email address (which IS present at data-rights:29,72,106).
WHY:     Minor: a prospective user/auditor clicking the primary CTA gets bounced to a login screen. The email path (SUPPORT_EMAIL) is already prominent, and the returnTo means the flow completes after login, so the practical harm is small.
FIX:     On data-rights/page.tsx, clarify that Settings requires being signed in (e.g. 'Sign in and open Settings') and keep SUPPORT_EMAIL prominent as the universally-available path for logged-out/regulator readers. The optional returnTo-after-login fallback the original suggested already exists (middleware.ts:78-79), so no code change is needed there — just the copy clarification.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/book/me/export/route.ts app/contact/page.tsx app/legal/data-rights/page.tsx app/legal/privacy/page.tsx middleware.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/book/me/export/route.ts app/contact/page.tsx app/legal/data-rights/page.tsx app/legal/privacy/page.tsx middleware.ts
git commit -m "fix(data): H19, L59 — Privacy & Data-Rights pages claim analytics/location"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE H19: committed on fix/H19 (worktree ../cf-fix-H19). Covered: H19, L59."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/H19 && git worktree remove ../cf-fix-H19 && git branch -d fix/H19"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 20: H20 — Cookie Policy omits the persistent refresh_token cookie and cf_acq_* acquisition cookies; states auth_expires_at duration is 1 hour when its cookie lifetime is 30 days
**Lead:** `high` · **Covers:** H20 · **Edits:** `app/auth/callback/route.ts`, `app/auth/refresh/route.ts`, `app/legal/cookies/page.tsx` · ⚠ shares a file with Task M1/L2

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/H20 ../cf-fix-H20 audit/prod-readiness-2026-06-14
cd ../cf-fix-H20
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/auth/callback/route.ts, app/auth/refresh/route.ts, app/legal/cookies/page.tsx.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `app/auth/callback/route.ts`, `app/auth/refresh/route.ts`, which Task M1/L2 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- H20 · high · app/legal/cookies/page.tsx:48-67, app/auth/callback/route.ts:19, app/auth/callback/route.ts:146-162, app/auth/callback/route.ts:176-190, app/auth/refresh/route.ts:11, app/auth/refresh/route.ts:133-143
PROBLEM: The essential-cookies table (cookies/page.tsx:48-67) lists only id_token, access_token, auth_expires_at, and cf_device. The auth callback sets a persistent httpOnly 'refresh_token' cookie with maxAge REFRESH_TOKEN_MAX_AGE = 30*24*60*60 = 30 days (callback/route.ts:19, 147-150; also re-set on rotation in refresh/route.ts:133-138) — undisclosed. auth_expires_at is listed with Duration '1 hour' (cookies:61) but its maxAge is REFRESH_TOKEN_MAX_AGE (30 days) at callback/route.ts:158-162 (the cookie VALUE is the access-token expiry, but its lifetime spans the refresh window). The callback also sets cf_acq_ref/cf_acq_us/cf_acq_um/cf_acq_uc acquisition cookies (callback/route.ts:176-190, 30-min lifetime, capturing referer + UTM source/medium/campaign) which are undisclosed and sit in tension with the policy's 'no cross-site tracking'/'no advertising' framing (they are first-party attribution cookies, but should still be listed).
WHY:     A live product publishing a cookie inventory that omits a long-lived 30-day auth cookie plus attribution cookies, and misstates a cookie's lifetime by 30x, is an inaccurate cookie disclosure (ePrivacy/CASL/CCPA cookie-transparency exposure) and undercuts the 'minimal, fully-disclosed cookies' positioning.
FIX:     In cookies/page.tsx essential-cookies table add a 'refresh_token' row (Secure, httpOnly, Duration 30 days, purpose: silent session renewal) and correct the auth_expires_at Duration from '1 hour' to '30 days' (optionally note the stored value is the ~1h access-token expiry while the cookie persists for the refresh window). Add cf_acq_ref/us/um/uc (first-party, ~30 minutes, attributes signup source) to the functional-cookies table or the transient sign-in note. Consider sourcing the 30-day duration from REFRESH_TOKEN_MAX_AGE so it cannot drift.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/auth/callback/route.ts app/auth/refresh/route.ts app/legal/cookies/page.tsx

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/auth/callback/route.ts app/auth/refresh/route.ts app/legal/cookies/page.tsx
git commit -m "fix(data): H20 — Cookie Policy omits the persistent refresh_token coo"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE H20: committed on fix/H20 (worktree ../cf-fix-H20). Covered: H20."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/H20 && git worktree remove ../cf-fix-H20 && git branch -d fix/H20"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 21: H21 (+1) — Onboarding tone/chapter-order choices never reach the reader (legacy localStorage key only gets setupComplete; reader seeds from different field names / settings.extended)
**Lead:** `high` · **Covers:** H21, L62 · **Edits:** `app/book/hooks/useBookPreferences.ts`, `app/book/library/[bookId]/chapter/[chapterId]/ChapterReaderClient.tsx`, `app/onboarding/components/OnboardingFlow.tsx` · context: `app/app/api/book/me/onboarding/complete/route.ts`, `app/book/hooks/useOnboardingState.ts`, `app/onboarding/components/StepFirstLoop.tsx`, `app/onboarding/components/UnlockCelebration.tsx` · ⚠ shares a file with Task H27/M32

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 2 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/H21 ../cf-fix-H21 audit/prod-readiness-2026-06-14
cd ../cf-fix-H21
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/book/hooks/useBookPreferences.ts, app/book/library/[bookId]/chapter/[chapterId]/ChapterReaderClient.tsx, app/onboarding/components/OnboardingFlow.tsx.
- Read-only context (do NOT edit, just read for understanding): app/app/api/book/me/onboarding/complete/route.ts, app/book/hooks/useOnboardingState.ts, app/onboarding/components/StepFirstLoop.tsx, app/onboarding/components/UnlockCelebration.tsx.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `app/book/hooks/useBookPreferences.ts`, `app/book/library/[bookId]/chapter/[chapterId]/ChapterReaderClient.tsx`, which Task H27/M32 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- H21 · high · app/onboarding/components/OnboardingFlow.tsx:91-103, app/book/hooks/useBookPreferences.ts:793-819, app/book/hooks/useBookPreferences.ts:367-379, app/book/hooks/useBookPreferences.ts:825-836, app/book/hooks/useOnboardingState.ts:69,258-279, app/book/library/[bookId]/chapter/[chapterId]/ChapterReaderClient.tsx:148-164, app/app/api/book/me/onboarding/complete/route.ts:130-159
PROBLEM: The new /onboarding flow collects tone(gentle/direct/competitive), dailyGoal, chapterOrder, interests, starterShelf. handleFinish POSTs them to /app/api/book/me/onboarding/complete which saves settings.onboarding AND hoists tone/dailyGoal/chapterOrder to top-level settings (route.ts:130-159). It also writes the legacy key book-accelerator:onboarding:v5 — but ONLY {...legacy, setupComplete, completedAt} (OnboardingFlow.tsx:95-102), never the field names the reader seeds from. The reader's tone/learning personalization comes from useBookPreferences().extended.contentTone/learningMode (ChapterReaderClient.tsx:149-150), which is seeded from the legacy key's ob.motivationStyle/ob.learningStyle/ob.quizIntensity (useBookPreferences.ts:799-809) OR from server settings.extended via parseStored (line 379 reads parsed.extended, NOT settings.onboarding.tone / hoisted settings.tone). Chapter-start order comes from useOnboardingState().chapterStartMode (ChapterReaderClient.tsx:164), which reads only the legacy key's chapterStartMode and never the server chapterOrder. So tone and chapter-start order silently fall back to defaults. IMPORTANT CORRECTION to the original finding: it overstates 'nothing in the reader path reads server settings.onboarding' — useBookAnalytics.ts:461-480 (dashboard recommendations) and useStarterPrescription.ts:44-48 DO read settings.onboarding for interests/starterShelf/motivation/dailyGoal/starterPrescription, so book recommendations DO get personalized. quizStyle isn't even consumed in ChapterReaderClient (grep returns nothing), so the quiz-intensity claim is weak. The real, confirmed loss is reader TONE and CHAPTER-START ORDER.
WHY:     The onboarding promise that tone 'sets how every chapter talks to you' and that chapter order is honored is not delivered: a user who picks 'gentle' or 'competitive' and 'scenarios first' still gets the reader's default contentTone and balanced chapter-start order. Book-recommendation personalization (which books surface) does work via server settings, so the gap is narrower than 'entire onboarding discarded' but still defeats a headline claim. Also affects fresh devices since server-side tone/order are never read by the reader hooks either.
FIX:     Best fix: hydrate the reader from the already-persisted server settings. In useBookPreferences' /me/settings effect (lines 825-836) and/or parseStored, map settings.onboarding.tone (or hoisted settings.tone) -> extended.contentTone, settings.onboarding.dailyGoal -> dailyGoalPreset, and have useOnboardingState map settings.onboarding.chapterOrder ('scenarios_first'->'scenarios','summary_first'->'summary') -> chapterStartMode when localStorage lacks it. Cheaper stopgap: in OnboardingFlow.handleFinish, when stamping the legacy key also write motivationStyle=onboarding.tone, chapterStartMode=(onboarding.chapterOrder==='scenarios_first'?'scenarios':'summary'/'balanced'), dailyGoalMinutes=onboarding.dailyGoal, selectedCategories=onboarding.interests, selectedBookIds=normalized starterShelf — matching the field names the reader's seed code reads. Prefer the server-hydration path so it also covers fresh devices.

--- L62 · low · app/onboarding/components/OnboardingFlow.tsx:82-86, app/onboarding/components/StepFirstLoop.tsx:221-224, app/onboarding/components/UnlockCelebration.tsx:18,55-57
PROBLEM: UnlockCelebration accepts an optional currentStreak prop (line 18) and renders dayStreak = (currentStreak>0 ? currentStreak : 1) (55-57). StepFirstLoop renders <UnlockCelebration quizScore={quizScore} onFinish={...}/> with no currentStreak (221-224). OnboardingFlow.handleFinish does `try { await resp.json(); } catch {}` (82-86), parsing then discarding the route body (which returns points + currentStreak). So dayStreak always falls back to 1 and Insight Points to the static INSIGHT_POINTS_AMOUNTS sum. For a first completion these coincide with reality (streak=1), so it's cosmetic today but the plumbing is dead and will desync on any grant/streak change (e.g. idempotent re-completion granting 0).
WHY:     Numbers are right by coincidence today; the celebration doesn't read server truth, so future changes to grant/streak logic silently desync the celebration from the account.
FIX:     Have handleFinish capture the parsed { points, currentStreak } and thread it back (return value or lifted state) through StepFirstLoop into UnlockCelebration's currentStreak prop, so the screen shows what the route actually credited rather than the hardcoded 1.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/book/hooks/useBookPreferences.ts app/book/library/[bookId]/chapter/[chapterId]/ChapterReaderClient.tsx app/onboarding/components/OnboardingFlow.tsx

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/book/hooks/useBookPreferences.ts app/book/library/[bookId]/chapter/[chapterId]/ChapterReaderClient.tsx app/onboarding/components/OnboardingFlow.tsx
git commit -m "fix(data): H21, L62 — Onboarding tone/chapter-order choices never reach th"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE H21: committed on fix/H21 (worktree ../cf-fix-H21). Covered: H21, L62."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/H21 && git worktree remove ../cf-fix-H21 && git branch -d fix/H21"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 22: H22 — Chapter notes (and other reader state) silently overwritten by server state on load — data loss
**Lead:** `high` · **Covers:** H22 · **Edits:** `app/book/library/[bookId]/chapter/[chapterId]/hooks/useChapterState.ts`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/H22 ../cf-fix-H22 audit/prod-readiness-2026-06-14
cd ../cf-fix-H22
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/book/library/[bookId]/chapter/[chapterId]/hooks/useChapterState.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- H22 · high · app/book/library/[bookId]/chapter/[chapterId]/hooks/useChapterState.ts:265-287, app/book/library/[bookId]/chapter/[chapterId]/hooks/useChapterState.ts:276, app/book/library/[bookId]/chapter/[chapterId]/hooks/useChapterState.ts:132
PROBLEM: On mount useChapterState hydrates from localStorage (incl. notes) then GETs the chapter state route. The server payload.state.state is run through parseStored(), which fills EVERY field with a default — notes default is the empty string (line 132) — and the result is applied as setState((prev) => ({ ...prev, ...parsed })) (line 276). Because parsed.notes is always a string (server's value OR ""), it unconditionally overwrites prev.notes. There is no per-field merge: bookmarkedTakeaways is replaced (not unioned), and notes is replaced. Contrast useBookProgress.ts:187-228, which carefully unions completedChapterIds/unlockedChapterIds and Math.max-es scores. The clobber is gated by `if (!payload.state?.state) return` (line 271), so it only fires when the server holds SOME persisted chapter-state object whose notes are empty/older — exactly the 'earlier device / debounced PATCH never landed' scenario.
WHY:     Readers lose handwritten chapter notes (and bookmarked takeaways) when the local copy is newer than the server copy — a trust-destroying, irreversible loss of explicitly user-authored content on a core reader surface.
FIX:     In the GET-merge effect, merge per-field instead of spreading: never let an empty server notes replace a non-empty local notes (keep prev.notes when parsed.notes is empty), union bookmarkedTakeaways, and only adopt server values for fields the local copy lacks. Best: persist a notesUpdatedAt on both sides and last-write-wins on it (mirror the lastOpenedAt comparison useBookProgress already uses). At minimum guard notes.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/book/library/[bookId]/chapter/[chapterId]/hooks/useChapterState.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/book/library/[bookId]/chapter/[chapterId]/hooks/useChapterState.ts
git commit -m "fix(data): H22 — Chapter notes (and other reader state) silently over"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE H22: committed on fix/H22 (worktree ../cf-fix-H22). Covered: H22."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/H22 && git worktree remove ../cf-fix-H22 && git branch -d fix/H22"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 23: H23 (+1) — Reset progress only mutates local state and can be resurrected by the server union-merge
**Lead:** `high` · **Covers:** H23, L95 · **Edits:** `app/book/library/[bookId]/BookDetailClient.tsx`, `app/book/library/[bookId]/components/BookHero.tsx`, `app/book/library/hooks/useBookProgress.ts` · ⚠ shares a file with Task H4

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 2 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/H23 ../cf-fix-H23 audit/prod-readiness-2026-06-14
cd ../cf-fix-H23
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/book/library/[bookId]/BookDetailClient.tsx, app/book/library/[bookId]/components/BookHero.tsx, app/book/library/hooks/useBookProgress.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `app/book/library/hooks/useBookProgress.ts`, which Task H4 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- H23 · high · app/book/library/[bookId]/BookDetailClient.tsx:544-548, app/book/library/hooks/useBookProgress.ts:394-396, app/book/library/hooks/useBookProgress.ts:187-228, app/book/library/hooks/useBookProgress.ts:246-255
PROBLEM: ResetProgressModal.onConfirm is synchronous: resetProgress(); setShowResetModal(false). resetProgress (useBookProgress.ts:394-396) only does setProgress(initialProgress(chapters)) — no server call. There is NO dedicated reset endpoint (confirmed: no DELETE/reset route under app/app/api/book/me/books; only saved/ and pairs/ have DELETE). The reset relies on the generic 200ms-debounced PATCH (lines 246-255). Problem (1): the effect cleanup clears the timeout (line 254), so unmount/navigation within 200ms means the empty state is never PATCHed and the server keeps old IDs. Problem (2): on the NEXT load the GET-merge unions local+server completedChapterIds/unlockedChapterIds (lines 188-196) and Math.max-es scores (lines 197-200), so any completion still present on the server (or re-pushed by a stale reader tab / another device) is merged back, undoing the reset. Note: once the empty PATCH DOES land, a single-device sequential reload won't resurrect — resurrection requires another source still carrying completion, which the finding correctly states.
WHY:     'Reset progress' looks like it works (UI clears) but completed chapters/scores can silently return on reload, another tab, or another device, making the destructive action unreliable and eroding trust.
FIX:     Add an explicit server reset endpoint (e.g. POST /me/books/[bookId]/state/reset) that hard-overwrites server progress to initial; make onConfirm async, await it (with spinner/failure UI) before closing the modal — do not depend on the debounced merge-PATCH. Also clear the per-chapter reader state and any phase-completion localStorage keys so chapters can't re-unlock via the union merge / a stale tab.

--- L95 · low · app/book/library/[bookId]/BookDetailClient.tsx:109, app/book/library/[bookId]/BookDetailClient.tsx:110, app/book/library/[bookId]/BookDetailClient.tsx:287, app/book/library/[bookId]/components/BookHero.tsx:146
PROBLEM: Confirmed: when book.pages is absent, BookDetailClient computes `pages = book.pages ?? Math.max(120, Math.round(book.estimatedMinutes * 2.8))` (line 109-110) and passes it to BookHero (line 287), which renders it as a bare "{pages} pages" pill (BookHero.tsx:146) with no 'approx'/'~' qualifier. The fallback is real-world reachable: `pages` is an optional field (library-data.ts:24) populated only when the book package supplies extra.pages (library-catalog.ts:91-93) — and the catalog metadata JSON has 0 entries with a pages field, so absent extras means the estimate is what renders. A 200-minute book would display a fabricated-looking '560 pages' as if exact.
WHY:     Minor authenticity issue: a reader may treat the page count as exact when it is invented; unusual estimatedMinutes values can produce obviously-off figures. Plausible-but-fabricated number rendered with the authority of a real attribute.
FIX:     Only render a page-count pill when book.pages is a real value; otherwise omit it (the header already shows real estimatedMinutes and chapter count). If a length proxy is desired when pages is missing, label it explicitly (e.g. '~X min read' or '~N pages') rather than implying a precise count. Original fix is correct.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/book/library/[bookId]/BookDetailClient.tsx app/book/library/[bookId]/components/BookHero.tsx app/book/library/hooks/useBookProgress.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/book/library/[bookId]/BookDetailClient.tsx app/book/library/[bookId]/components/BookHero.tsx app/book/library/hooks/useBookProgress.ts
git commit -m "fix(data): H23, L95 — Reset progress only mutates local state and can be r"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE H23: committed on fix/H23 (worktree ../cf-fix-H23). Covered: H23, L95."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/H23 && git worktree remove ../cf-fix-H23 && git branch -d fix/H23"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 24: H24 — Event detail fabricates "Eligible Books" titles by title-casing the bookId slug instead of using the real catalog title
**Lead:** `high` · **Covers:** H24 · **Edits:** `app/book/events/[eventId]/EventDetailClient.tsx`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/H24 ../cf-fix-H24 audit/prod-readiness-2026-06-14
cd ../cf-fix-H24
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/book/events/[eventId]/EventDetailClient.tsx.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- H24 · high · app/book/events/[eventId]/EventDetailClient.tsx:264-279
PROBLEM: The 'Eligible Books' list maps over event.books and derives the display name with bookId.split("-").map(w => w.charAt(0).toUpperCase()+w.slice(1)).join(" "). EventDefinition.books is typed string[] (types.ts:1076) — i.e. bookId slugs — so this prints title-cased slugs (e.g. 'seven-powers' -> 'Seven Powers', 'you-cant-hurt-me' -> 'You Cant Hurt Me') with dropped apostrophes, wrong numerals, and missing subtitles. getBookById is already exported from app/book/data/booksCatalog.ts and the link already targets /book/library/{bookId}, so the real title is one call away.
WHY:     Every event detail page shows mis-spelled / mis-formatted book names on a primary user-facing surface — looks broken and untrustworthy on a live product.
FIX:     Import getBookById from @/app/book/data/booksCatalog and render {getBookById(bookId)?.title ?? bookId} (optionally the author/cover too). Remove the slug title-casing entirely. EventsClient.tsx only renders event.books.length so it is unaffected.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/book/events/[eventId]/EventDetailClient.tsx

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/book/events/[eventId]/EventDetailClient.tsx
git commit -m "fix(data): H24 — Event detail fabricates 'Eligible Books' titles by t"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE H24: committed on fix/H24 (worktree ../cf-fix-H24). Covered: H24."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/H24 && git worktree remove ../cf-fix-H24 && git branch -d fix/H24"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 25: H25 — Notebook page is unreachable from navigation and missing the server access guard
**Lead:** `high` · **Covers:** H25 · **Edits:** `app/_lib/require-dashboard-access.ts`, `app/book/home/components/TopNav.tsx`, `app/book/notebook/page.tsx` · context: `middleware.ts` · ⚠ shares a file with Task L29

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/H25 ../cf-fix-H25 audit/prod-readiness-2026-06-14
cd ../cf-fix-H25
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/_lib/require-dashboard-access.ts, app/book/home/components/TopNav.tsx, app/book/notebook/page.tsx.
- Read-only context (do NOT edit, just read for understanding): middleware.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `app/book/home/components/TopNav.tsx`, which Task L29 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- H25 · high · app/book/notebook/page.tsx:1-9, app/book/home/components/TopNav.tsx:56-79, app/_lib/require-dashboard-access.ts:79-92, middleware.ts:65-87
PROBLEM: (1) /book/notebook has zero inbound links: a repo-wide grep for book/notebook hrefs/pushes (excluding the page/route/client files themselves) returns nothing, and it is absent from TopNav navItems, desktopOnlyNavItems, and moreNavItems. Users cannot reach the Notebook or its CSV/Markdown export. (2) notebook/page.tsx renders <NotebookClient/> with NO server guard, while every sibling (badges/saved/journeys/events/rewards) calls await requireDashboardAccess() in page.tsx. requireDashboardAccess verifies the JWT via requireUser and redirects deleted accounts (require-dashboard-access.ts:90-92) and reactivates deactivated ones; middleware (lines 65-87) only does a cookie-presence/expiry check and explicitly defers full JWT verification, so a deleted user or a present-but-INVALID_TOKEN cookie renders the Notebook shell where every other page would redirect. Note the data itself is still protected by requireActiveBookUser in /me/notebook, so this is a defense-in-depth/UX-consistency gap, not a data-exposure hole.
WHY:     A built feature with server APIs and export is dead to users (lost functionality). The missing guard is a consistency/defense-in-depth gap: deleted/deactivated/invalid-token users get a broken shell instead of the proper redirect, unlike every sibling page.
FIX:     Add a Notebook entry to TopNav.moreNavItems ({ id: "notebook", label: "Notebook", href: "/book/notebook", icon: NotebookPen }) and extend BookNavTab with "notebook" (TopNav.tsx:31). Make notebook/page.tsx async and await requireDashboardAccess() before returning <NotebookClient/>. Since /notebook has no nav tab, pass no activeTab to TopNav (the activeTab? prop is already optional and documented for exactly this Notebook case at TopNav.tsx:36-37).

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/_lib/require-dashboard-access.ts app/book/home/components/TopNav.tsx app/book/notebook/page.tsx

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/_lib/require-dashboard-access.ts app/book/home/components/TopNav.tsx app/book/notebook/page.tsx
git commit -m "fix(ux): H25 — Notebook page is unreachable from navigation and mis"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE H25: committed on fix/H25 (worktree ../cf-fix-H25). Covered: H25."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/H25 && git worktree remove ../cf-fix-H25 && git branch -d fix/H25"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 26: H26 (+2) — Reminder time & timezone chosen in Settings never reach the reminder cron — all reminders fire at default 20:00 UTC
**Lead:** `high` · **Covers:** H26, M41, L79 · **Edits:** `app/app/api/book/_lib/streak-repo.ts`, `app/app/api/book/me/profile/route.ts`, `app/app/api/book/me/settings/route.ts`, `app/book/settings/BookSettingsClient.tsx`, `infra/lambda/lib/streak-at-risk.ts` · context: `app/book/hooks/useBookPreferences.ts`, `infra/lambda/reading-reminder-cron.ts` · ⚠ shares a file with Task M8/M28/L28/H27/L19/H14

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 3 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/H26 ../cf-fix-H26 audit/prod-readiness-2026-06-14
cd ../cf-fix-H26
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/book/_lib/streak-repo.ts, app/app/api/book/me/profile/route.ts, app/app/api/book/me/settings/route.ts, app/book/settings/BookSettingsClient.tsx, infra/lambda/lib/streak-at-risk.ts.
- Read-only context (do NOT edit, just read for understanding): app/book/hooks/useBookPreferences.ts, infra/lambda/reading-reminder-cron.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `app/app/api/book/_lib/streak-repo.ts`, `app/app/api/book/me/profile/route.ts`, `app/app/api/book/me/settings/route.ts`, `infra/lambda/lib/streak-at-risk.ts`, which Task M8/M28/L28/H27/L19/H14 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- H26 · high · app/book/settings/BookSettingsClient.tsx:1210-1214, app/book/settings/BookSettingsClient.tsx:222-251, infra/lambda/reading-reminder-cron.ts:82-88, app/app/api/book/me/settings/route.ts:37, app/app/api/book/me/profile/route.ts:215-218
PROBLEM: The 'Reminder time' TimePicker onChange calls only setReminderTime(v) (onboarding state). That value is persisted to /app/api/book/me/profile as profile.reminderTime (BookSettingsClient.tsx:222-251 PATCHes /me/profile with the onboarding snapshot; profile/route.ts:215-218 stores it). It is NEVER written into settings.notifications. The reading-reminder cron Lambda reads the per-user send time exclusively from settings.notifications.reminderTimeLocal and settings.notifications.reminderTimezone (cron:82-83), falling back to '20:00' / 'UTC'. A repo-wide grep confirms reminderTimeLocal/reminderTimezone appear only in the type def (types.ts:558-559), the settings allow-list (settings/route.ts:37), and the Lambda — never written by any app route. No lambda reads profile.reminderTime either. Net: the readingReminderEnabled toggle works, but the chosen time/timezone are invisible to the cron.
WHY:     Every user who changes the reminder time receives it at the wrong hour and wrong timezone — the cron's resolveHour() fires only when the local hour in 'UTC' equals 20, i.e. 20:00 UTC (1pm PDT / 4pm EDT) for everyone. A shipped, user-configurable notification feature is silently broken, undermining the habit loop and looking broken to anyone who explicitly set a time.
FIX:     Write the canonical fields into settings.notifications. In the TimePicker onChange at BookSettingsClient.tsx:1212, in addition to setReminderTime(v), call patchSection('notifications', { reminderTimeLocal: v, reminderTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone }) — both keys are already on the settings allow-list and in the notifications schema-validator, and v is already HH:MM which matches what the cron's resolveHour expects. Also set them once at hydration if missing so existing users get a sane timezone. (Reading from profile.reminderTime in the Lambda is an alternative, but it lacks a stored timezone, so writing both into settings.notifications is cleaner.)

--- M41 · medium · app/book/settings/BookSettingsClient.tsx:1369-1379, app/book/hooks/useBookPreferences.ts:133,242,730-732
PROBLEM: The 'Personalized recommendations' toggle (BookSettingsClient.tsx:1369-1379) persists privacy.personalizedRecommendations, described as 'Use your reading history to suggest books you'll love.' A filtered repo-wide grep (excluding .next/cdk.out/dist build artifacts) finds the field referenced ONLY in the settings UI (read+write) and the preferences hook (default true at 242, parse at 730-732). There is no consumer in any API route, library, or recommendation code path. The toggle makes a privacy promise nothing in the product keeps.
WHY:     A consent control that does nothing is a privacy/compliance liability at launch (users believe disabling it stops history-based suggestions when nothing changes) and is misleading UX. Medium because it is a consent-labeled control; the false promise is the risk.
FIX:     Either wire the flag into wherever book suggestions are generated so disabling it actually suppresses history-driven recommendations, or — if no such engine exists yet — remove the toggle (and the description's privacy claim) until the behavior is real. Do not ship a consent toggle with no effect. Track the same way as saveQuizHistory/saveNotes (separate dead-code finding).

--- L79 · low · app/book/settings/BookSettingsClient.tsx:1222-1245, app/book/settings/BookSettingsClient.tsx:331-338, infra/lambda/lib/streak-at-risk.ts:51-52, app/app/api/book/_lib/streak-repo.ts:229-316
PROBLEM: The 'Streak alerts' toggle (streakReminderEnabled) is only rendered when ext.streakMode !== 'off' (BookSettingsClient.tsx:1224). handleStreakModeChange (331-338) only patchExt({ streakMode }) and setOnboardingStreakMode(...) — it leaves streakReminderEnabled at its prior value (e.g. true). The streak-at-risk Lambda gates only on settings.notifications.streakReminderEnabled === false (streak-at-risk.ts:52); it never consults streakMode. Confirmed further: server-side streak accrual in streak-repo.ts (called from quiz submit / audio routes) updates currentStreak/lastActiveDate regardless of streakMode, so a user who turns streak tracking off still has a live streak record that satisfies the Lambda's currentStreak >= 2 check.
WHY:     A user who disables streak tracking can still receive 'streak about to expire' emails/in-app nudges they thought they turned off — contradicts the explicit 'No streak tracking' setting. Low: notification noise/inconsistency, not data loss.
FIX:     In handleStreakModeChange, when mode === 'off' also patchSection('notifications', { streakReminderEnabled: false }) so the server stops sending streak alerts (and re-enable or leave to user when turning back on). Defense in depth: have processStreakAtRisk additionally skip users whose streak tracking is disabled (would require surfacing streakMode/streakTrackingEnabled into the settings the Lambda scans).

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/book/_lib/streak-repo.ts app/app/api/book/me/profile/route.ts app/app/api/book/me/settings/route.ts app/book/settings/BookSettingsClient.tsx infra/lambda/lib/streak-at-risk.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/book/_lib/streak-repo.ts app/app/api/book/me/profile/route.ts app/app/api/book/me/settings/route.ts app/book/settings/BookSettingsClient.tsx infra/lambda/lib/streak-at-risk.ts
git commit -m "fix(data): H26, M41, L79 — Reminder time & timezone chosen in Settings never re"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE H26: committed on fix/H26 (worktree ../cf-fix-H26). Covered: H26, M41, L79."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/H26 && git worktree remove ../cf-fix-H26 && git branch -d fix/H26"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 27: H27 (+3) — Cross-device settings clobber: server settings only applied when localStorage is empty; stale device silently overwrites newer settings
**Lead:** `high` · **Covers:** H27, M44, L85, P17 · **Edits:** `app/app/api/book/me/settings/route.ts`, `app/book/hooks/useBookPreferences.ts`, `app/book/layout.tsx`, `app/book/settings/BookSettingsClient.tsx` · ⚠ shares a file with Task H26/L19/H21

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 4 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/H27 ../cf-fix-H27 audit/prod-readiness-2026-06-14
cd ../cf-fix-H27
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/book/me/settings/route.ts, app/book/hooks/useBookPreferences.ts, app/book/layout.tsx, app/book/settings/BookSettingsClient.tsx.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `app/app/api/book/me/settings/route.ts`, `app/book/hooks/useBookPreferences.ts`, which Task H26/L19/H21 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- H27 · high · app/book/hooks/useBookPreferences.ts:825-844, app/book/hooks/useBookPreferences.ts:927-940, app/app/api/book/me/settings/route.ts:72-130
PROBLEM: useBookPreferences fetches /me/settings on mount but applies the server copy only when localStorageHadData.current is false (hook:833) — i.e. only on a brand-new device. On any device with existing localStorage, server data is fetched and discarded. The save effect (hook:927-940) then PATCHes the FULL local state ({ settings: state }) 500ms after any change. The server's mergeSettings (settings/route.ts:55-70, deep recursive) overwrites every leaf the client sends, so a stale full snapshot clobbers newer server values for sections never touched on the stale device. The GET already returns updatedAt (settings/route.ts:80) but the client never reads it; there is no version/timestamp reconciliation.
WHY:     Settings changed on Device B are silently lost the next time the user edits anything on Device A (which holds stale localStorage) — a confusing, hard-to-reproduce data-loss bug for any multi-device user (phone + laptop is common for a reading product). Preferences mysteriously revert.
FIX:     Reconcile on load instead of all-or-nothing. Store a local last-synced timestamp alongside STORAGE_KEY; in the GET handler compare payload.updatedAt against it and, when the server item is newer, apply it (set skipNextServerSave.current = true before setState) even if localStorage is non-empty. Better long-term: diff against the last-synced snapshot and PATCH only changed sections so untouched sections can never clobber the server. At minimum, stop unconditionally discarding server data whenever localStorage exists.

--- M44 · medium · app/book/hooks/useBookPreferences.ts:903-925, app/book/hooks/useBookPreferences.ts:851-871, app/book/settings/BookSettingsClient.tsx:1040-1086, app/book/layout.tsx:26-39
PROBLEM: The audit claims NOTHING reads scheduledDarkMode/darkModeFrom/darkModeTo and the toggle is fully inert. That is FALSE: a real scheduler exists at useBookPreferences.ts:903-925 that parses From/To, correctly handles the wrap-past-midnight case (start>end), toggles document.documentElement `.dark` and colorScheme, and re-checks on a 60s interval. So the toggle is not pure dead plumbing. However there IS a genuine, different defect: (1) the scheduler lives inside useBookPreferences, which is only mounted on the Settings page (BookSettingsClient) and the Chapter Reader (ChapterReaderClient) -- app/book/layout.tsx mounts no global theme/preferences client -- so on home/library/badges/profile/saved/etc. the schedule never runs and dark mode is not applied at the scheduled time; (2) on the Settings/Reader pages where it IS mounted, the separate theme effect at lines 851-871 calls applyDocumentTheme (which sets `.dark` from appearance.theme = light) and its deps do not include the schedule keys, so the two effects fight and the scheduler's `.dark=true` can be reverted on any appearance change; (3) when the user navigates away from those two pages the interval is torn down and `.dark` is never reverted to light at the window's end. Net user-visible result is close to the audit's symptom (scheduled dark mode does not reliably switch the theme), but the root cause and fix are different from what was written.
WHY:     A presented Settings control behaves inconsistently: scheduled dark mode may flip on the Settings/Reader screens but not on the rest of the app, and may flicker as effects fight. Users will perceive it as broken/flaky rather than simply absent. Trust/data-integrity on a launch surface, but less severe than a control that does literally nothing.
FIX:     Consolidate the schedule into the theme pipeline instead of a second classList toggle: (a) fold the schedule evaluation into resolveDocumentThemeMode/applyDocumentTheme in app/_lib/document-theme.ts so a single source decides `.dark` (passing scheduledDarkMode/from/to through DocumentThemeSettings), and (b) mount the scheduler + applyStoredDocumentTheme in a global client component rendered from app/book/layout.tsx (and ideally the root layout for parity with the bootstrap script) so it runs on every route and reverts to light at the window boundary. Re-evaluate on an interval AND on book-theme-change. Drop the standalone effect at 903-925 once the schedule is part of applyDocumentTheme so the two no longer race. If not implementing globally before launch, gate/hide the toggle. NOTE the audit's stated fix ('nothing reads the keys, add a scheduler') is partly redundant since a scheduler already exists.

--- L85 · low · app/book/hooks/useBookPreferences.ts:879-884
PROBLEM: fontMap['sans-serif'] = '"Inter", "system-ui", sans-serif' (line 881), and it is also the default fallback (line 884: `|| fontMap["sans-serif"]`). Inter is not loaded anywhere -- layout.tsx loads Plus Jakarta Sans, JetBrains Mono, and local Satoshi; grep for 'Inter' in layout/globals finds only the substring in the comment 'Interactive'. So selecting the Sans-Serif reading font (and the default state) renders in system-ui, never Inter, and never the body brand font (Jakarta). The option is effectively 'system default' mislabeled and visually inconsistent with the app font.
WHY:     Minor: the sans-serif reading preference (and default) does not deliver the intended typeface; reading surface font diverges from the rest of the app. Worse than 'just one option' because it is also the fallback default.
FIX:     Map 'sans-serif' to the already-loaded brand var: '"sans-serif": `var(--font-jakarta), system-ui, sans-serif`' (matches body brand font), or load Inter via next/font/google if Inter specifically is intended. Update both line 881 and the fallback expression at 884.

--- P17 · polish · app/book/hooks/useBookPreferences.ts:135-136,244-245,738-744, app/book/settings/BookSettingsClient.tsx:1352-1393
PROBLEM: BookPreferencesState.privacy declares saveQuizHistory and saveNotes (hook:135-136) with defaults true (244-245) and they are parsed/persisted (738-744), but the Settings Privacy subsection (BookSettingsClient.tsx:1352-1393) renders toggles only for analyticsParticipation, personalizedRecommendations, and saveReadingHistory. A filtered grep (excluding build artifacts) finds saveQuizHistory/saveNotes only in the hook — no UI control and no server gating anywhere (contrast saveReadingHistory, which IS gated in dashboard/reading-sessions/export routes).
WHY:     Dead schema surface that implies privacy controls which don't exist; maintainability/clarity cost and a latent compliance gap if these were meant to be user consents. Polish severity is right.
FIX:     Either add the corresponding toggles to the Privacy subsection AND gate the relevant storage server-side (mirror how saveReadingHistory is honored in reading-sessions/dashboard/export routes), or remove saveQuizHistory/saveNotes from BookPreferencesState, its defaults, and parseStored until the behavior is implemented. Pair this with the personalizedRecommendations no-op decision.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/book/me/settings/route.ts app/book/hooks/useBookPreferences.ts app/book/layout.tsx app/book/settings/BookSettingsClient.tsx

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/book/me/settings/route.ts app/book/hooks/useBookPreferences.ts app/book/layout.tsx app/book/settings/BookSettingsClient.tsx
git commit -m "fix(data): H27, M44, L85, P17 — Cross-device settings clobber: server settings only "

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE H27: committed on fix/H27 (worktree ../cf-fix-H27). Covered: H27, M44, L85, P17."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/H27 && git worktree remove ../cf-fix-H27 && git branch -d fix/H27"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 28: H28 (+1) — No document-level Content-Security-Policy header for an auth + payments product
**Lead:** `high` · **Covers:** H28, L88 · **Edits:** `middleware.ts`, `next.config.ts` · ⚠ shares a file with Task M51

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 2 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/H28 ../cf-fix-H28 audit/prod-readiness-2026-06-14
cd ../cf-fix-H28
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: middleware.ts, next.config.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `next.config.ts`, which Task M51 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- H28 · high · next.config.ts:35-54, next.config.ts:33, middleware.ts
PROBLEM: Verified: next.config.ts headers() on /(.*) (l38-51) sets X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, HSTS, and Permissions-Policy but NO Content-Security-Policy. The only CSP in the repo is the image-optimizer sandbox policy at next.config.ts:33 (`default-src 'self'; script-src 'none'; sandbox;`), which Next applies only to optimized /_next/image responses, not HTML documents. git grep for Content-Security-Policy / frame-ancestors across app/, lib/, components/, middleware.ts, next.config.ts returns nothing outside that image policy. middleware.ts sets no CSP/nonce. The app renders Stripe flows, Cognito session cookies, and AI/user-generated content (Ask-the-Book, community/reflections), so a missing CSP is a real defense-in-depth gap.
WHY:     Any reflected/stored XSS (AI-rendered markdown, community scenario/reflection text, or a future 3rd-party script) executes with full origin privileges — session/Stripe-redirect abuse. X-Frame-Options DENY does cover clickjacking, but there is zero script/connect/frame source restriction for a payments+PII product.
FIX:     Add a Content-Security-Policy on the /(.*) headers() source. Because Next emits inline bootstrap scripts, the robust path is a per-request nonce injected via middleware.ts (strict-dynamic + 'nonce-...' for script-src) — middleware already runs on the app, so extend it to set the nonce header and the CSP. Stage as Content-Security-Policy-Report-Only first to discover required sources (Cognito Hosted UI, Stripe.js/js.stripe.com in script-src + frame-src, the S3 cover host in img-src, connect-src for the API), then promote to enforcing. At minimum add `frame-ancestors 'none'` and a baseline default-src 'self' to complement the existing headers.

--- L88 · low · next.config.ts:55-73
PROBLEM: Verified: all three legacy redirects (/book/workspace, /book/workspace/:path*, /book/home → /dashboard) declare permanent: true (l60, l65, l70; grep -c 'permanent: true' = 3), emitting HTTP 308. Browsers/CloudFront cache 308 indefinitely; if any of these paths is ever repurposed or the target changes from /dashboard, returning users keep the cached redirect with no server recourse. For a route map still settling post-UI-overhaul this is a (low) risk.
WHY:     If these routes are repurposed or the target changes post-launch, returning users keep getting 308-redirected to the stale destination from browser cache — effectively un-fixable per-user without a cache clear.
FIX:     Change permanent: true → permanent: false (307 Temporary) for the three redirects until the route map is confirmed stable post-launch; promote to 308 only once /dashboard is permanent and /book/workspace + /book/home are confirmed dead forever.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint middleware.ts next.config.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add middleware.ts next.config.ts
git commit -m "fix(security): H28, L88 — No document-level Content-Security-Policy header for"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE H28: committed on fix/H28 (worktree ../cf-fix-H28). Covered: H28, L88."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/H28 && git worktree remove ../cf-fix-H28 && git branch -d fix/H28"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 29: H29 (+3) — Profile page hardcodes a stale, overstated catalog size ("93+ more books", "21 categories") that contradicts the live 68-book / 13-category catalog
**Lead:** `high` · **Covers:** H29, M37, M53, L74 · **Edits:** `app/book/hooks/useBookAnalytics.ts`, `app/book/profile/BookProfileClient.tsx`, `app/book/profile/components/ProfilePrimitives.tsx` · context: `lib/catalog-stats.ts` · ⚠ shares a file with Task M52

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 4 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/H29 ../cf-fix-H29 audit/prod-readiness-2026-06-14
cd ../cf-fix-H29
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/book/hooks/useBookAnalytics.ts, app/book/profile/BookProfileClient.tsx, app/book/profile/components/ProfilePrimitives.tsx.
- Read-only context (do NOT edit, just read for understanding): lib/catalog-stats.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `app/book/hooks/useBookAnalytics.ts`, which Task M52 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- H29 · high · app/book/profile/BookProfileClient.tsx:718, app/book/profile/BookProfileClient.tsx:719, app/book/profile/BookProfileClient.tsx:947, app/book/profile/components/ProfilePrimitives.tsx:1450, app/book/profile/components/ProfilePrimitives.tsx:1458, lib/catalog-stats.ts:22
PROBLEM: The profile page (mounted live at /book/profile via app/book/profile/page.tsx) hardcodes two catalog claims. The Pro upgrade copy fed to every free user reads "Unlock 93+ more books..." in BOTH branches of `upgradeMessage` (BookProfileClient.tsx:718 and :719). The CategoryMap is passed `totalCategories={21}` (line 947), which ProfilePrimitives.tsx renders verbatim as "{explored.length} of {totalCategories}" (lines 1450, 1458) and uses for a `remaining` count. The live catalog is 68 books and 13 distinct `category` values (I counted booksCatalog.metadata.json directly: 68 entries, 13 unique categories; BOOKS_CATALOG has no published-filter so CATALOG_BOOK_COUNT === 68). So a free user is promised ~25+ books that don't exist, and a reader who explores all 13 categories can only ever reach "13 of 21". The catalog-stats module was built specifically to retire this hardcoding (its header even calls out the old "93 more books" lie), and the landing surface (components/sections/SocialProof.tsx:8,44) already consumes it — but the profile page was never migrated.
WHY:     Overstatement of inventory shown to a logged-in user (false book-count advertising), plus a permanently-incomplete progress metric ("X of 21" can never reach 21, even at 100% category exploration). The numbers silently drift further from reality as the catalog changes because they're disconnected from the derived source.
FIX:     In BookProfileClient.tsx import { CATALOG_BOOK_COUNT, CATALOG_CATEGORY_COUNT } from "@/lib/catalog-stats". Replace `totalCategories={21}` (line 947) with `totalCategories={CATALOG_CATEGORY_COUNT}`. For the two upgrade strings (718-719) prefer a value relative to what the user can access — e.g. `Unlock ${Math.max(0, CATALOG_BOOK_COUNT - unlockedCount)} more books...` where unlockedCount is the user's accessible-book count (the page already knows plan/entitlement) — or, if that count isn't readily available, use the conservative CATALOG_BOOK_COUNT_DISPLAY ("60+ more books"). NOTE on the original fix: the live book count is 68, not 67. Also note the catalog-stats header *mentions* a CI guard but none actually exists in the app test surface (only lib/book-covers.test.ts exists; the catalog tests live under scripts/ which is the pipeline) — so the suggested "CI assertion" must be newly written (a small test asserting no app/components file matches a hardcoded books/categories count regex), not merely referenced.

--- M37 · medium · app/book/profile/BookProfileClient.tsx:717-719, app/book/profile/BookProfileClient.tsx:947, app/book/profile/components/ProfilePrimitives.tsx:1450-1458,1472-1476
PROBLEM: Upgrade copy hardcodes 'Unlock 93+ more books' (lines 718-719) but booksCatalog.metadata.json has 68 books, overstating the library. CategoryMap is passed totalCategories={21} (line 947) and renders '{explored.length} of {totalCategories}'; exploredCategories (BookProfileClient.tsx:507-518) is built from distinct per-book snapshot.book.category values, and the catalog actually has 33 distinct categories — so a reader who explores >21 categories shows a self-contradicting fraction like '33 of 21'. One nuance vs the original finding: the '+{remaining} more to discover' text is guarded by `remaining > 0` (ProfilePrimitives.tsx:1472), so it will NOT render a negative number — but `remaining` is still computed against the fixed 21 (line 1450) and the 'of 21' fraction is visibly wrong.
WHY:     Wrong, self-contradicting numbers on a primary surface: overstated library size in the upgrade pitch and an incorrect (and potentially-inverted) categories-explored fraction.
FIX:     Import BOOKS_CATALOG and derive both: use BOOKS_CATALOG.length (minus free starts) for the upgrade copy, and pass totalCategories = new Set(BOOKS_CATALOG.flatMap(b => b.categories)).size. The '+more' negative case is already guarded, but still clamp remaining to >= 0 for safety after deriving the real denominator.

--- M53 · medium · app/book/profile/BookProfileClient.tsx:259-262, app/book/profile/BookProfileClient.tsx:446-460, app/book/profile/BookProfileClient.tsx:696-702, app/book/hooks/useBookAnalytics.ts:822-833
PROBLEM: BookProfileClient destructures only `{ analytics, hydrated: analyticsHydrated }` from useBookAnalytics (lines 259-262) — never error or refetch. The single blocking gate is `if (!onboardingHydrated || !analyticsHydrated || !badgeSystem.hydrated || !profileHydrated || !onboarding.setupComplete)` (line 696), which checks hydration but not whether analytics is non-null. On a failed dashboard fetch the hook sets hydrated=true with analytics=null, so the gate passes and the page renders. statsSummary then resolves every stat via `analytics?.X ?? 0` (lines 450-459: streak 0, longestStreak 0, booksCompleted 0, totalChaptersCompleted 0, avgQuizScore 0, etc.), so a user with real history sees a zeroed profile with no error/retry.
WHY:     A returning user with progress sees their streak/books/chapters/quiz history apparently wiped to zero on a transient API blip — alarming and a data-integrity/trust problem, with no in-app recovery besides a manual reload.
FIX:     Pull `error` and `refetch` from useBookAnalytics in BookProfileClient (the hook already returns them at useBookAnalytics.ts:843-848). After the loading gate at line 696, add `if (analyticsError && !analytics) return <main className="cf-app-shell"><TopNav .../><section ...><ErrorBanner title="We couldn’t load your profile" message={analyticsError} onRetry={refetch} /></section></main>;` reusing app/book/components/ui/ErrorBanner.tsx. This matches the existing WorkspacePage pattern (error && !data -> ErrorBanner onRetry={refetch}) and is consistent with ProgressPage, which already shows an error screen (ProgressPage.tsx:502) because it gates on derived null data. Use refetch (sets error=null, bumps revision) rather than window.location.reload().

--- L74 · low · app/book/profile/BookProfileClient.tsx:1187,1190-1196
PROBLEM: The 'Pinned takeaways' StatCard value is Math.min(localInsights.notes.length, 3) (line 1187) and the 'Pinned ideas' list just renders the first 3 notes' first lines via PinnedTakeawayCard (1193-1195). There is no pinning mechanism — any user with >=3 notes always shows '3 pinned takeaways' and the first three notes are framed 'Pinned'. Minor nuance: the StatCard helper text already reads 'Top recent insights', so the label and helper already contradict each other (label says Pinned, helper says recent).
WHY:     Mildly misleading stat/labeling implying a 'pinned' curation feature that doesn't exist. Low blast radius.
FIX:     Relabel the StatCard and 'Pinned ideas' heading to 'Recent takeaways'/'Top recent insights' (matching the existing helper), or implement real pinning. Drop the synthetic Math.min(...,3) count and the 'Pinned' framing.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/book/hooks/useBookAnalytics.ts app/book/profile/BookProfileClient.tsx app/book/profile/components/ProfilePrimitives.tsx

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/book/hooks/useBookAnalytics.ts app/book/profile/BookProfileClient.tsx app/book/profile/components/ProfilePrimitives.tsx
git commit -m "fix(data): H29, M37, M53, L74 — Profile page hardcodes a stale, overstated catalog s"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE H29: committed on fix/H29 (worktree ../cf-fix-H29). Covered: H29, M37, M53, L74."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/H29 && git worktree remove ../cf-fix-H29 && git branch -d fix/H29"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 30: M1 (+2) — OAuth callback never validates the state nonce — CSRF defense rests solely on encrypted-state integrity, and the cookie-fallback path has no anti-CSRF check at all
**Lead:** `medium` · **Covers:** M1, L5, L6 · **Edits:** `app/app/api/_lib/auth.ts`, `app/auth/callback/route.ts` · context: `app/auth/_lib/state-crypto.ts`, `app/auth/login/route.ts`, `app/auth/refresh/route.ts`, `components/auth/TokenExpiryGuard.tsx`, `middleware.ts` · ⚠ shares a file with Task L8/H20

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 3 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/M1 ../cf-fix-M1 audit/prod-readiness-2026-06-14
cd ../cf-fix-M1
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/_lib/auth.ts, app/auth/callback/route.ts.
- Read-only context (do NOT edit, just read for understanding): app/auth/_lib/state-crypto.ts, app/auth/login/route.ts, app/auth/refresh/route.ts, components/auth/TokenExpiryGuard.tsx, middleware.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `app/app/api/_lib/auth.ts`, `app/auth/callback/route.ts`, which Task L8/H20 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- M1 · medium · app/auth/callback/route.ts:54, app/auth/callback/route.ts:85, app/auth/login/route.ts:97, app/auth/login/route.ts:132, app/auth/_lib/state-crypto.ts:18
PROBLEM: Login mints nonce=crypto.randomUUID() (login:97), stores it in the encrypted state field `n` and in the oauth_state cookie (login:132). In the callback, nonce is recovered both from decrypted state (callback:41) and the oauth_state cookie fallback (callback:54), and destructured at callback:85 — but grep confirms it is NEVER compared to anything; callback:85 is its last reference. For the PRIMARY path this is fine: state is AES-256-GCM encrypted with a server secret, so an attacker can't forge a valid state carrying their own PKCE verifier, and verifier-binding gives implicit CSRF protection. The residual gap is the documented FALLBACK path (resolveAuthState callback:51-60), which reads pkce_verifier and post_auth_redirect from plain cookies with no check that the IdP-echoed state equals the oauth_state cookie. If decryptState ever returns null (AUTH_STATE_SECRET unset/rotated/short — state-crypto:32-40 throws, encryptState catches and returns null, so login falls back to `state = encrypted ?? nonce` = raw nonce at login:107), the flow degrades to a cookie-only exchange with zero state validation.
WHY:     Today, low real risk because the encrypted-state path is the norm and the secret is required (>=32 chars) for encryption to succeed. But the moment the fallback path is exercised (secret unset/rotated during a rolling deploy, or an attacker who suppresses encrypted state and supplies their own code + oauth_state cookie), there is no CSRF binding between the IdP response and the user's flow-initiation — a classic login-CSRF / session-fixation surface.
FIX:     In resolveAuthState's fallback branch (callback:51-60), require req.cookies.get('oauth_state')?.value === stateParam (when decryption failed, the raw state param equals the nonce per login:107). On mismatch return verifier:null so the handler restarts the flow via the existing callback:90-96 redirect. Alternatively, since encrypted-state integrity already IS the CSRF control on the live path, delete the now-misleading nonce/oauth_state machinery entirely (login:97,132 + callback:41,54,85,166) and document that decision so the dead nonce doesn't imply a check that isn't there.

--- L5 · low · app/auth/callback/route.ts:140, app/auth/refresh/route.ts:132, app/app/api/_lib/auth.ts:14
PROBLEM: Every successful login (callback:140) and refresh (refresh:132) sets an access_token cookie; logout (logout:19,35) and refresh's deleted-account branch (refresh:115) and login's deleted branch (login:62) clear it. But identity is verified/read exclusively from id_token (auth.ts COOKIE_NAME='id_token', auth.ts:14,66). grep across app/ and components/ for access_token finds only: the set/clear sites in the four auth routes, and a documentation row in app/legal/cookies/page.tsx:54 ('API authorization token. Secure, httpOnly.'). No route, lib, or component ever READS the access_token value — confirmed dead as a credential. It would only be needed for a Cognito resource-server / API Gateway authorizer call, which this app doesn't make.
WHY:     Minor: a longer-lived sensitive token persisted to the browser with no consumer slightly enlarges the credential attack surface and confuses auditors of the flow.
FIX:     Either stop setting access_token (callback:140, refresh:132) and drop its clears (login:62, logout:19+35, middleware:84, refresh:115) and its legal/cookies row, OR add a one-line comment at the two set sites noting it's reserved for future resource-server calls so it isn't read as dead code. Given no resource server is on the roadmap, removal is cleaner.

--- L6 · low · app/auth/callback/route.ts:133, app/auth/callback/route.ts:139, middleware.ts:67, middleware.ts:72, components/auth/TokenExpiryGuard.tsx:103
PROBLEM: id_token/access_token are set with maxAge=expiresIn (~3600s; callback:133-140, refresh:129-132) while auth_expires_at and refresh_token live 30 days (callback:158-162, REFRESH_TOKEN_MAX_AGE). TokenExpiryGuard renews at T-5min (RENEW_BEFORE_SECONDS, TokenExpiryGuard:6,103) so id_token is normally rewritten before it lapses. But renewal only fires while the tab is foregrounded and the timer/focus/visibilitychange handler runs (TokenExpiryGuard:129-132). If a backgrounded tab has its interval throttled past the id_token maxAge AND the user navigates a protected route in the gap before the wake-triggered refresh completes, middleware (middleware:67-72) sees no id_token cookie (the browser already evicted it) and redirects to /auth/login (middleware:72-80) even though refresh_token is still valid. Mitigations present: there ARE focus + visibilitychange listeners (TokenExpiryGuard:130-132), which narrow but don't eliminate the window (the refresh is async and the navigation can win the race).
WHY:     Occasional, self-recovering: a user returning to a long-idle tab and immediately clicking a protected link can get a full-login bounce (the live IdP session usually re-mints transparently) instead of a seamless refresh. Annoying, not data-affecting.
FIX:     Make middleware refresh-aware: when id_token is absent/expired but refresh_token is present and auth_expires_at is still inside the 30-day window, redirect to a tiny refresh-and-continue handler (or a page that POSTs /auth/refresh then returns to the original target) instead of straight to /auth/login. NOTE: middleware currently reads only id_token and auth_expires_at (middleware:67-68) — it would need to also read the refresh_token cookie presence (it's httpOnly but middleware runs server-side so it can read it). Simpler partial mitigation: a pagehide/pageshow listener and/or shortening RENEW_BEFORE_SECONDS won't fully close it but reduces frequency.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/_lib/auth.ts app/auth/callback/route.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/_lib/auth.ts app/auth/callback/route.ts
git commit -m "fix(security): M1, L5, L6 — OAuth callback never validates the state nonce — CSR"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE M1: committed on fix/M1 (worktree ../cf-fix-M1). Covered: M1, L5, L6."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/M1 && git worktree remove ../cf-fix-M1 && git branch -d fix/M1"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 31: M2 — economy-health full-table Scan runs synchronously inside the admin economy HTTP route — timeout/cost risk at scale
**Lead:** `medium` · **Covers:** M2 · **Edits:** `app/app/api/book/_lib/economy-health.ts`, `app/app/api/book/admin/metrics/economy/route.ts`, `app/app/api/book/admin/reconciliation/route.ts` · ⚠ shares a file with Task M13

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/M2 ../cf-fix-M2 audit/prod-readiness-2026-06-14
cd ../cf-fix-M2
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/book/_lib/economy-health.ts, app/app/api/book/admin/metrics/economy/route.ts, app/app/api/book/admin/reconciliation/route.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `app/app/api/book/admin/reconciliation/route.ts`, which Task M13 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- M2 · medium · app/app/api/book/_lib/economy-health.ts:58-87, app/app/api/book/_lib/economy-health.ts:51-54, app/app/api/book/admin/metrics/economy/route.ts:31-56, app/app/api/book/admin/reconciliation/route.ts:11
PROBLEM: computeEconomyHealth does an UNBOUNDED paginated ScanCommand over the whole main table filtering for BOOK_USER_ENGAGEMENT (do...while with no page cap, economy-health.ts:70-87), then estimatePeriodFlows scans the ledger (capped at 10 pages, line 253). Its own docstring says it is 'designed to run as a batch job, not in a request handler' (line 53-54) and 'In production, this should use a GSI or materialized view' (line 66). But the only caller is GET /admin/metrics/economy (route.ts:51), which sets no maxDuration. The infra comment confirms the design: chapterflow-frontend-stack.ts:169-175 — 'the admin metrics routes plus economy-health and soft-decay full-table-Scan to compute aggregates, and OpenNext runs EVERY route ... in this single server Lambda'. A server-side FilterExpression Scan reads every item in the table regardless of entity, so RCU/latency grow with total app data, not just engagement rows.
WHY:     On a real user base the admin economy dashboard scan can exceed the Lambda timeout (or rack up RCU cost) and fall into the catch (route.ts:53-56), returning FALLBACK_METRICS (all zeros) with only a generic warning — admins silently see a broken economy dashboard. Also blocks one Lambda invocation for the scan duration.
FIX:     Lowest-risk now: set `export const maxDuration = 60` on app/app/api/book/admin/metrics/economy/route.ts (matching reconciliation/route.ts:11) AND add a page cap + Limit to the engagement Scan loop in economy-health.ts:70-87 so it cannot run unbounded inside a request (estimatePeriodFlows already does this with maxPages=10/Limit=1000). Real fix: move computeEconomyHealth to a scheduled Lambda writing a precomputed snapshot and have the route read it — but note no scheduled economy-health job actually exists today; the infra comment describes it running inline, so the original fix's claim that 'a scheduled economy-health job is intended' is aspirational, not implemented.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/book/_lib/economy-health.ts app/app/api/book/admin/metrics/economy/route.ts app/app/api/book/admin/reconciliation/route.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/book/_lib/economy-health.ts app/app/api/book/admin/metrics/economy/route.ts app/app/api/book/admin/reconciliation/route.ts
git commit -m "fix(performance): M2 — economy-health full-table Scan runs synchronously in"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE M2: committed on fix/M2 (worktree ../cf-fix-M2). Covered: M2."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/M2 && git worktree remove ../cf-fix-M2 && git branch -d fix/M2"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 32: M4 — audio-name route swallows auth/4xx into 500, is an unrate-limited paid-TTS abuse surface, and has no caller (greeting feature itself is NOT broken)
**Lead:** `medium` · **Covers:** M4 · **Edits:** `app/app/api/book/me/audio-name/route.ts`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/M4 ../cf-fix-M4 audit/prod-readiness-2026-06-14
cd ../cf-fix-M4
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/book/me/audio-name/route.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- M4 · medium · app/app/api/book/me/audio-name/route.ts:27-88, app/app/api/book/me/audio-name/route.ts:84-87, app/app/api/book/me/audio-name/route.ts:45-61
PROBLEM: Two of the three sub-claims are confirmed, one is refuted. CONFIRMED (error handling): the handler uses a bare try/catch (lines 84-87) instead of withBookApiErrors, so when requireActiveBookUser() throws AuthError (unauthenticated) or BookApiError(403, account_deleted) those are converted to a generic 500 'internal_error' and console.error-logged as a server fault — I verified withBookApiErrors (http.ts:50-54) maps AuthError→401 and BookApiError→its real status, which this route bypasses. CONFIRMED (abuse): it loops over morning/afternoon/evening calling the PAID ElevenLabs TTS API three times per request (lines 45-61) with no rate limit or idempotency. CONFIRMED (no caller): grep found zero invocations of 'audio-name' in app/ or components/. REFUTED (feature broken): the greeting MP3s are NOT silently un-generated — the chapter audio route (books/[bookId]/chapters/[chapterNumber]/audio/route.ts:386-416) auto-generates all three greeting clips on-the-fly when missing using the same userGreetingS3Key/getUserGreetingScript and caches them to S3. So audio-name is a redundant/orphaned eager-generation endpoint, not the sole generator.
WHY:     An unused, authenticated POST endpoint is an unnecessary cost/abuse surface (3 paid-TTS calls/request, no rate limit) and returns misleading 500s that pollute error monitoring and would confuse any future client. The greeting feature itself still works via the on-demand path in the chapter-audio route — the 'clips never generated' claim is wrong.
FIX:     Delete the route — it is fully redundant with the on-demand generation in the chapter-audio route, which already handles the same three clips, caching, and the missing-clip case. If instead it is kept for eager pre-warming: wrap the handler in withBookApiErrors (AuthError→401, BookApiError→correct status) and add an idempotency guard (skip regeneration if the three S3 keys already exist for the same name) plus a per-user rate limit so it cannot be spammed to burn ElevenLabs credits.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/book/me/audio-name/route.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/book/me/audio-name/route.ts
git commit -m "fix(ops): M4 — audio-name route swallows auth/4xx into 500, is an u"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE M4: committed on fix/M4 (worktree ../cf-fix-M4). Covered: M4."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/M4 && git worktree remove ../cf-fix-M4 && git branch -d fix/M4"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 33: M5 — User IP sent to third-party geolocation provider over plaintext HTTP
**Lead:** `medium` · **Covers:** M5 · **Edits:** `app/app/api/book/_lib/location.ts`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/M5 ../cf-fix-M5 audit/prod-readiness-2026-06-14
cd ../cf-fix-M5
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/book/_lib/location.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- M5 · medium · app/app/api/book/_lib/location.ts:88-93
PROBLEM: fetchLocationByIp calls `http://ip-api.com/json/<ip>?fields=...` over cleartext HTTP (line 90-91). The end user's real IP is in the URL and the resolved country/region/city/coords come back unencrypted, observable by any intermediary between the Lambda and ip-api.com. The privacy policy discloses the IP may be sent to ip-api.com (page.tsx:44,89) but the Security section (page.tsx:133) claims 'encrypted connections (HTTPS)' — the plaintext call is in tension with that. This path runs only when the user opted into analytics (verified: resolveLocation is invoked behind analyticsParticipation gates in reading-sessions:98 and profile:470), narrowing blast radius.
WHY:     PII (client IP) and derived approximate location transmitted in cleartext to a third party, contrary to the HTTPS security claim. Network observers or a hostile resolver/MITM can read or tamper with the geolocation lookups.
FIX:     Prefer the CDN edge headers (inferLocationFromHeaders already runs first inside resolveLocation, for free over the existing TLS) and treat the ip-api fallback as best-effort. When the fallback is used, switch to ip-api.com's HTTPS pro endpoint with a key (https://pro.ip-api.com/json/...?key=...) or a provider whose free tier supports HTTPS (ipinfo.io, ipwho.is). Either way the outbound geolocation call must be HTTPS, and the privacy policy's HTTPS claim should be made literally true.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/book/_lib/location.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/book/_lib/location.ts
git commit -m "fix(security): M5 — User IP sent to third-party geolocation provider ove"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE M5: committed on fix/M5 (worktree ../cf-fix-M5). Covered: M5."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/M5 && git worktree remove ../cf-fix-M5 && git branch -d fix/M5"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 34: M6 (+1) — Depth-recommendation broken: wrong DynamoDB key casing (pk/sk) and updateDepthModel never called
**Lead:** `medium` · **Covers:** M6, M18 · **Edits:** `app/app/api/book/_lib/depth-routing.ts`, `app/book/hooks/useDepthRecommendation.ts`, `infra/lib/chapterflow-backend-stack.ts` · context: `app/app/api/book/me/books/[bookId]/depth-recommendation/route.ts` · ⚠ shares a file with Task H14

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 2 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/M6 ../cf-fix-M6 audit/prod-readiness-2026-06-14
cd ../cf-fix-M6
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/book/_lib/depth-routing.ts, app/book/hooks/useDepthRecommendation.ts, infra/lib/chapterflow-backend-stack.ts.
- Read-only context (do NOT edit, just read for understanding): app/app/api/book/me/books/[bookId]/depth-recommendation/route.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `infra/lib/chapterflow-backend-stack.ts`, which Task H14 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- M6 · medium · app/app/api/book/_lib/depth-routing.ts:95, app/app/api/book/_lib/depth-routing.ts:160-169, app/app/api/book/me/books/[bookId]/depth-recommendation/route.ts:24, infra/lib/chapterflow-backend-stack.ts:132-133
PROBLEM: getDepthModel issues GetCommand with Key: { pk, sk } (lowercase, line 95) and updateDepthModel writes Item with pk/sk (lines 164-165), but the book table key schema is PK/SK uppercase (infra/lib/chapterflow-backend-stack.ts:132-133). A Get whose key attribute names don't match the schema raises a DynamoDB ValidationException. The only caller (depth-recommendation route) runs getDepthModel inside withBookApiErrors, which maps non-BookApiError to a 500 (http.ts:61) — so the route returns a 500. Separately, updateDepthModel has ZERO callers (grep confirmed across app/ and scripts/), so even with the key fixed the model is never populated and the route always returns the hasData:false cold-start fallback.
WHY:     The personalized reading-depth recommendation feature is entirely non-functional: it either 500s on every call, or (after the key fix) silently always returns the cold-start fallback so adaptive depth never adapts.
FIX:     Change both Key and Item to PK: bookUserPk(userId), SK: depthModelSk(bookId) to match the table schema. Then wire updateDepthModel into the quiz-submit / loop-complete pipeline (or a reading-session handler) so the feature vector is actually populated; otherwise delete the depth-recommendation route and depth-routing.ts as dead surface.

--- M18 · medium · app/app/api/book/_lib/depth-routing.ts:92-98, app/app/api/book/_lib/depth-routing.ts:160-169, app/app/api/book/me/books/[bookId]/depth-recommendation/route.ts:24-37, app/book/hooks/useDepthRecommendation.ts:21-46
PROBLEM: getDepthModel reads with `Key: { pk: ..., sk: ... }` (lowercase, line 95) and updateDepthModel writes with `Item: { pk: ..., sk: ..., ... }` (lowercase, line 163-166), but the table key schema is uppercase PK/SK (infra/lib/chapterflow-backend-stack.ts:132-133; every other repo write uses PK/SK). A PutCommand whose Item omits the PK/SK attributes is rejected by DynamoDB with ValidationException, and a GetCommand with lowercase keys would also be rejected — so neither path can ever work. On top of that, grep over app/ + components/ (excluding build artifacts) shows updateDepthModel has ZERO callers (only its own definition) and useDepthRecommendation has ZERO consumers (only its own definition); the depth-recommendation route is reached only by that dead hook. So the model is never written and the route, even if its keys were fixed, would always return the cold-start hasData:false fallback.
WHY:     A shipped 'adaptive depth' feature does nothing — it always returns the easy/default recommendation. Dead code that looks live: a maintenance trap and a feature that would silently never work if someone wired the existing UI to it as-is.
FIX:     Decide explicitly. (a) Delete depth-routing.ts, the depth-recommendation route, and useDepthRecommendation.ts as dead code; or (b) if keeping it: change both the Key (getDepthModel) and Item (updateDepthModel) literals to uppercase PK/SK to match the schema, wire updateDepthModel into the loop-completion path where quizScore/readingTime are known (e.g. quiz submit/loop-complete route), and wire useDepthRecommendation into the reader. Add a test asserting PK/SK presence so the casing regression can't recur.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/book/_lib/depth-routing.ts app/book/hooks/useDepthRecommendation.ts infra/lib/chapterflow-backend-stack.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/book/_lib/depth-routing.ts app/book/hooks/useDepthRecommendation.ts infra/lib/chapterflow-backend-stack.ts
git commit -m "fix(correctness): M6, M18 — Depth-recommendation broken: wrong DynamoDB key casi"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE M6: committed on fix/M6 (worktree ../cf-fix-M6). Covered: M6, M18."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/M6 && git worktree remove ../cf-fix-M6 && git branch -d fix/M6"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 35: M7 (+3) — Audio route writes a full per-user MP3 to S3 on every playback that is never read back
**Lead:** `medium` · **Covers:** M7, M20, L42, P2 · **Edits:** `app/app/api/book/_lib/audio-narration.ts`, `app/app/api/book/books/[bookId]/chapters/[chapterNumber]/audio/route.ts` · context: `app/app/api/book/books/[bookId]/ask/route.ts`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 4 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/M7 ../cf-fix-M7 audit/prod-readiness-2026-06-14
cd ../cf-fix-M7
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/book/_lib/audio-narration.ts, app/app/api/book/books/[bookId]/chapters/[chapterNumber]/audio/route.ts.
- Read-only context (do NOT edit, just read for understanding): app/app/api/book/books/[bookId]/ask/route.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- M7 · medium · app/app/api/book/books/[bookId]/chapters/[chapterNumber]/audio/route.ts:469-493
PROBLEM: After stitching segments the route fire-and-forget PutObjects the full stitched MP3 to book-content/audio-stitched/{bookId}/ch{n}.{tone}.{variant}.{user.sub}.mp3 with Cache-Control 'public, max-age=3600' (lines 470-483). Grep confirms audio-stitched/stitchedKey is referenced ONLY at the write site — nothing reads that key; the handler always re-loads and re-stitches the individual segments. And the actual HTTP response is returned with Cache-Control 'no-cache' (line 491), so the stitched copy is doubly useless. Each Pro audio playback incurs a redundant full-file S3 write, accumulating one object per (user,chapter,tone,variant) forever with no lifecycle.
WHY:     Unbounded S3 storage growth (per-user audio copies, no TTL), extra write cost and latency on every Pro audio request, and a misleading public Cache-Control on per-user content.
FIX:     Either (a) HeadObject/GetObject the stitched key first and short-circuit return it when present, making the write useful, AND add an S3 lifecycle/TTL rule for the audio-stitched prefix AND drop the user.sub from the key if the stitched content isn't actually user-specific; or (b) remove the stitched write entirely and rely on the already-cached per-segment objects. Do not advertise public caching on a user-namespaced key.

--- M20 · medium · app/app/api/book/books/[bookId]/chapters/[chapterNumber]/audio/route.ts:362-367, app/app/api/book/books/[bookId]/chapters/[chapterNumber]/audio/route.ts:469-483, app/app/api/book/books/[bookId]/chapters/[chapterNumber]/audio/route.ts:17
PROBLEM: Every GET loads all segments (~11) from S3 in a SERIAL for-loop with await per key (line 364-367), re-stitches, and writes the full concatenated MP3 to a per-user key book-content/audio-stitched/.../{user.sub}.mp3 (line 470-483). grep confirms the string 'audio-stitched' appears ONLY at the write site — no GetObject ever reads it back, so the per-user stitched cache is write-only dead weight (a full-file S3 PutObject on every play, per user). HeadObjectCommand is imported (line 17) but never used (grep shows the import is its only occurrence), consistent with an abandoned 'check stitched cache first' implementation. Note the body segments (the expensive TTS-generated parts) ARE cached and reused via chapterBodySegmentS3Key, so the cost is the per-request stitched PUT + serial GET latency, not re-TTS.
WHY:     Each audio play does ~11 sequential S3 GETs plus a full-file S3 PUT that is never reused — wasted S3 write cost/bandwidth and avoidable latency, multiplied across users and replays. A Pro feature that should be cache-fast re-stitches and re-uploads every time.
FIX:     Either implement the intended cache (HeadObject/GetObject the stitched key first and stream it directly when present — the obvious purpose of the unused HeadObjectCommand import), and parallelize the first-pass loads with Promise.all over loadSegmentFromS3; OR, if the per-user stitched cache isn't wanted (it depends on user-specific greeting/score segments so reuse is limited), drop the PutObject and the unused import. Parallelizing the segment GETs is the clear win regardless.

--- L42 · low · app/app/api/book/books/[bookId]/chapters/[chapterNumber]/audio/route.ts:389, app/app/api/book/books/[bookId]/chapters/[chapterNumber]/audio/route.ts:347-383, app/app/api/book/_lib/audio-narration.ts:60-62
PROBLEM: The audio handler logs the user's display name in `Generating greeting clip for "${userName}"` (line 389), and the greeting S3 keys it logs (lines 379/412) embed user.sub via userGreetingS3Key (audio-narration.ts:60-62 → `.../names/${userId}-${timeOfDay}.mp3`). It also emits ~10+ console.log lines per request (plan summary at 347-349, per-segment loaded/missing/skipped at 373-383/454, stitch stats at 465-467, takeaway count at 145). The ask route similarly console.warn/console.error with raw errors. This writes a user's name + stable Cognito subject into CloudWatch and is operational noise at scale.
WHY:     User name + Cognito sub in logs is low-grade PII exposure that complicates erasure/privacy guarantees; the volume of per-request logging is operational noise and a minor cost at scale.
FIX:     Remove userName from log strings (log at most a truncated hash of user.sub) and gate the per-request [audio]/[ask-book] console.log lines behind a debug flag (e.g. an env-checked logger), keeping only genuine error logs. Note the stitched-cache S3 key (line 470) also embeds user.sub and is logged at 480 — same treatment.

--- P2 · polish · app/app/api/book/books/[bookId]/chapters/[chapterNumber]/audio/route.ts:145,244,347,375-383,389,412,425,439,443,454,465,480, app/app/api/book/books/[bookId]/ask/route.ts:214
PROBLEM: The audio route emits ~15 console.log lines per request (takeaway counts line 145, per-segment cache writes line 244, plan line 347, per-segment load/miss lines 375-383, greeting generation 389/412, body-segment generation 425/439/443, skipped segments 454, stitch summary 465, stitched-cache write 480), and the ask route warns on cache miss (line 214). These run on every Pro audio playback / question, adding log volume and latency in production with no structured-metrics value, and some include user-derived strings (e.g. line 389 logs userName).
WHY:     Noisy CloudWatch logs raise cost and bury real errors; some logs include user-derived strings.
FIX:     Gate these behind a debug flag or downgrade to structured metric emissions (putOpsMetric) instead of console.log on the request hot path; keep only console.error for genuine failures.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/book/_lib/audio-narration.ts app/app/api/book/books/[bookId]/chapters/[chapterNumber]/audio/route.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/book/_lib/audio-narration.ts app/app/api/book/books/[bookId]/chapters/[chapterNumber]/audio/route.ts
git commit -m "fix(performance): M7, M20, L42, P2 — Audio route writes a full per-user MP3 to S3 on ever"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE M7: committed on fix/M7 (worktree ../cf-fix-M7). Covered: M7, M20, L42, P2."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/M7 && git worktree remove ../cf-fix-M7 && git branch -d fix/M7"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 36: M8 (+2) — Streak-day IP bonus anchored to UTC day while streak progresses on user-timezone day — denies the daily bonus to evening/morning readers in negative-offset timezones
**Lead:** `medium` · **Covers:** M8, L24, P3 · **Edits:** `app/app/api/book/_lib/achievement-repo.ts`, `app/app/api/book/_lib/streak-repo.ts` · context: `app/app/api/book/me/streak/route.ts` · ⚠ shares a file with Task H26

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 3 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/M8 ../cf-fix-M8 audit/prod-readiness-2026-06-14
cd ../cf-fix-M8
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/book/_lib/achievement-repo.ts, app/app/api/book/_lib/streak-repo.ts.
- Read-only context (do NOT edit, just read for understanding): app/app/api/book/me/streak/route.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `app/app/api/book/_lib/streak-repo.ts`, which Task H26 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- M8 · medium · app/app/api/book/_lib/streak-repo.ts:215-229, app/app/api/book/_lib/streak-repo.ts:325-338, app/app/api/book/_lib/streak-repo.ts:340-350
PROBLEM: updateStreakOnLoopComplete decides 'new streak day' on the user-tz day (today = getTodayInTimezone(userTimezone), compared to streak.lastActiveDate at line 229). But the +15 IP streak_day grant is keyed by the UTC day: utcToday = now.slice(0,10) where now = nowIso() (UTC ISO); awardFlowPoints({sourceType:'streak_day', sourceId: utcToday}) (lines 328-336). awardFlowPoints dedupes on flowPointsGrantSk(sourceType, sourceId) with attribute_not_exists (flow-points-repo.ts:538,548). For a negative UTC offset, two consecutive local days can map to the same UTC date (e.g. UTC-10: local 06-14 20:00 -> 06-15 06:00 UTC grants sourceId=2026-06-15; next local day 06-15 08:00 -> 06-15 18:00 UTC increments the streak but reuses sourceId 2026-06-15, so the grant is rejected as duplicate). The same UTC anchoring applies to welcome_back (lines 341-350).
WHY:     Americas-timezone, evening-then-morning readers silently lose their 15 IP streak bonus on roughly half their legitimate streak days, making the advertised '+15 IP/day' (flow-points-economy.ts:194) false for them and depressing the faucet unevenly by geography. welcome_back is similarly mis-keyed but fires far more rarely.
FIX:     Key streak_day and welcome_back by the same user-tz day used for the streak decision, scoped per user, to dedupe correctly without UTC drift: sourceId = `${userId}:${today}` (today = getTodayInTimezone(userTimezone)). Per-user-per-local-day uniqueness still prevents farming (timezone switching can shift the boundary by at most one award, not multiply it). The cited 'update submit/route.ts:1010' is ANALYTICS-ONLY (analyticsTrackFlowPointsTransaction writes a separate analytics table, not the engagement ledger) so it has no correctness impact on the actual award; update it only for analytics consistency. The real fix is solely in streak-repo.ts.

--- L24 · low · app/app/api/book/_lib/streak-repo.ts:172-194, app/app/api/book/_lib/streak-repo.ts:278-289, app/app/api/book/_lib/streak-repo.ts:305, app/app/api/book/me/streak/route.ts:34, app/app/api/book/_lib/achievement-repo.ts:246-257
PROBLEM: computeConsistencyLast30 (streak-repo.ts:172) COUNTs READINGDAY# records in a 30-day window. addReadingDayActivity (repo.ts:2763) writes today's READINGDAY from the reading-session beacon (reading-sessions/route.ts:76), gated on saveReadingHistory. updateStreakOnLoopComplete persists consistencyLast30 = count + 1 with comment 'today's activity counted' (line 305) and tracks consistencyAbove80Since via consistencyPercent = round(((count+1)/30)*100) (line 281). The GET route reports consistencyScore = round((consistencyLast30 / 30) * 100) with no clamp (route.ts:34). When the beacon already wrote today's READINGDAY, the count already includes today and the +1 double-counts, so a value of 31/30 -> 103% is possible. The Steady-State achievement gate reads consistencyAbove80Since (achievement-repo.ts:247), inheriting the +1 inflation.
WHY:     Users can see a >100% consistency score and Steady-State can be reached up to a day early. When saveReadingHistory is OFF, no READINGDAY records are ever written so consistency is permanently ~3% (1/30) regardless of real activity — the metric is meaningless for privacy-opted-out users.
FIX:     Drop the artificial +1 (persist consistencyLast30 = count, since the query already includes today once the READINGDAY exists) and clamp the GET-route score with Math.min(100, ...). Better: derive consistency from the streak/loop activity itself (distinct active days) instead of READINGDAY records so it still works when reading history is disabled. Apply the same de-inflation to the consistencyAbove80Since computation at line 281.

--- P3 · polish · app/app/api/book/_lib/streak-repo.ts:408-415, app/app/api/book/_lib/streak-repo.ts:480-496, app/app/api/book/me/streak/route.ts:76-81
PROBLEM: purchaseStreakShield returns balance: 0 in the success branch (line 494, comment 'Caller should re-fetch if needed'), the insufficient-balance branch (486), and the shields-full branch (413). The POST route never re-fetches and does not return balance to the client (route.ts:76-81), so the post-purchase IP balance shown in the UI is stale until the next /me/flow-points refresh. The shieldsHeld count is returned correctly; only balance is the gap.
WHY:     Cosmetic: after buying a shield the user's IP balance in the UI lags by one interaction until refresh. No correctness/economy impact (the TransactWrite atomically guards points >= cost).
FIX:     Either have purchaseStreakShield return the real post-transaction balance (a follow-up GetCommand on engagement after the TransactWrite, or compute streak.balance - cost) and surface it in the streak POST response, or have the client refresh /me/flow-points after a successful shield purchase. The route already returns shieldsHeld correctly.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/book/_lib/achievement-repo.ts app/app/api/book/_lib/streak-repo.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/book/_lib/achievement-repo.ts app/app/api/book/_lib/streak-repo.ts
git commit -m "fix(correctness): M8, L24, P3 — Streak-day IP bonus anchored to UTC day while streak"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE M8: committed on fix/M8 (worktree ../cf-fix-M8). Covered: M8, L24, P3."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/M8 && git worktree remove ../cf-fix-M8 && git branch -d fix/M8"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 37: M9 — FSRS review submit is not idempotent — a double-submit corrupts the card schedule and writes duplicate review logs
**Lead:** `medium` · **Covers:** M9 · **Edits:** `app/app/api/book/me/reviews/[cardId]/route.ts` · context: `app/app/api/book/_lib/fsrs-repo.ts`, `app/app/api/book/_lib/fsrs.ts`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/M9 ../cf-fix-M9 audit/prod-readiness-2026-06-14
cd ../cf-fix-M9
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/book/me/reviews/[cardId]/route.ts.
- Read-only context (do NOT edit, just read for understanding): app/app/api/book/_lib/fsrs-repo.ts, app/app/api/book/_lib/fsrs.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- M9 · medium · app/app/api/book/me/reviews/[cardId]/route.ts:45-50, app/app/api/book/_lib/fsrs-repo.ts:141-199, app/app/api/book/_lib/fsrs.ts (scheduleCard)
PROBLEM: recordReview reads the card (GetCommand), calls scheduleCard, then unconditionally PUTs the updated card and a new review log keyed by a fresh crypto.randomUUID — no idempotency key, no optimistic-concurrency ConditionExpression, no rate limit. scheduleCard is pure and advances reps+1, stability, difficulty, and dueAt off elapsedDays. A double-click/retry/two-tab grade runs it twice: on the second run the card is already in 'review' state with lastReviewAt=now so elapsedDays≈0 and retrievability≈max, nextRecallStability advances again, reps becomes +2, dueAt is pushed further out than a single rating warrants, and two FSRSReviewLog rows are written (distinct reviewId/SK). Unlike awardFlowPoints (grant-key dedupe), there is no protection.
WHY:     Spaced-repetition scheduling — the core learning mechanic — silently drifts on any retry/double-submit: cards get over-scheduled (shown far too late) and review stats (avgRetrievability, due counts) skew from phantom logs. No money lost; learning value degrades and is hard to detect.
FIX:     Make recordReview optimistic-concurrency safe: PUT the card with a ConditionExpression like 'lastReviewAt = :expected' (expected = the value read at the start of recordReview) or '#reps = :expectedReps', so a second concurrent submit fails the condition and no-ops/returns the already-scheduled card. Alternatively gate the review-log SK on a client-supplied reviewId with attribute_not_exists. At minimum, ignore submits where now - lastReviewAt is below a small threshold for the same card.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/book/me/reviews/[cardId]/route.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/book/me/reviews/[cardId]/route.ts
git commit -m "fix(correctness): M9 — FSRS review submit is not idempotent — a double-subm"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE M9: committed on fix/M9 (worktree ../cf-fix-M9). Covered: M9."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/M9 && git worktree remove ../cf-fix-M9 && git branch -d fix/M9"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 38: M10 — share-events endpoint returns 400 on every request — requireString called with the body object instead of the field
**Lead:** `medium` · **Covers:** M10 · **Edits:** `app/app/api/book/_lib/http.ts`, `app/app/api/book/me/share-events/route.ts`, `app/book/_lib/share-card-url.ts` · ⚠ shares a file with Task L50

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/M10 ../cf-fix-M10 audit/prod-readiness-2026-06-14
cd ../cf-fix-M10
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/book/_lib/http.ts, app/app/api/book/me/share-events/route.ts, app/book/_lib/share-card-url.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `app/app/api/book/_lib/http.ts`, which Task L50 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- M10 · medium · app/app/api/book/me/share-events/route.ts:27-28, app/app/api/book/_lib/http.ts:72-90, app/book/_lib/share-card-url.ts:130
PROBLEM: requireString(value, field, opts) (http.ts:72) throws BookApiError(400,'invalid_input','<field> must be a string.') when typeof value !== 'string'. share-events/route.ts:27-28 calls requireString(body, 'cardType') and requireString(body, 'destination') — passing the whole body object as value, so every call throws 400 before validation. The client trackShareEvent (share-card-url.ts:122-137) POSTs a correct {cardType, destination, ...} body but fires it .catch(()=>{}) fire-and-forget, so the UI never breaks and zero share events are ever recorded. The sibling devices/register route (register/route.ts:16) correctly does requireString(body.endpoint, ...), proving this route is the outlier.
WHY:     All share-funnel / referral-share analytics record nothing (putShareEvent never reached). Any growth/attribution dashboard on share events is permanently empty with no surfaced error — silent data loss on a growth-critical metric.
FIX:     Change lines 27-28 to: const cardType = requireString(body.cardType, 'cardType'); const destination = requireString(body.destination, 'destination'); — read the field off body, matching every other route. (referralCode/bookId/etc below already read body.field correctly.)

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/book/_lib/http.ts app/app/api/book/me/share-events/route.ts app/book/_lib/share-card-url.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/book/_lib/http.ts app/app/api/book/me/share-events/route.ts app/book/_lib/share-card-url.ts
git commit -m "fix(correctness): M10 — share-events endpoint returns 400 on every request —"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE M10: committed on fix/M10 (worktree ../cf-fix-M10). Covered: M10."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/M10 && git worktree remove ../cf-fix-M10 && git branch -d fix/M10"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 39: M11 — Referral fraud same-device / same-IP checks are dead — inviter device/IP always passed as null
**Lead:** `medium` · **Covers:** M11 · **Edits:** `app/app/api/book/_lib/ensure-book-started.ts`, `app/app/api/book/_lib/referral-fraud.ts` · context: `app/app/api/book/_lib/referral-fraud-core.ts` · ⚠ shares a file with Task H8

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/M11 ../cf-fix-M11 audit/prod-readiness-2026-06-14
cd ../cf-fix-M11
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/book/_lib/ensure-book-started.ts, app/app/api/book/_lib/referral-fraud.ts.
- Read-only context (do NOT edit, just read for understanding): app/app/api/book/_lib/referral-fraud-core.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `app/app/api/book/_lib/ensure-book-started.ts`, which Task H8 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- M11 · medium · app/app/api/book/_lib/ensure-book-started.ts:296-311, app/app/api/book/_lib/referral-fraud.ts:54-76, app/app/api/book/_lib/referral-fraud-core.ts:54-65
PROBLEM: evaluateReferralFraud's sameDevice (core:54-57) and sameIp (core:63-64) signals are computed as Boolean(invitee && inviter && equal) (referral-fraud.ts:54-56,76). The sole caller (ensure-book-started.ts:302-304) hardcodes inviterDeviceId:null, inviteeIp:null, inviterIp:null and supplies only inviteeDeviceId. So sameDevice and sameIp can NEVER be true. The inviter's device/IP ARE stored as risk events (recordRiskSignals, queryable by fingerprint) but never looked up here. The only live signals are deviceVelocityCount (>=3 distinct users on the invitee device in 30d), disposable-email, and cross-referral.
WHY:     The most common referral abuse — a second account on the same device/network to self-refer — is not caught until a THIRD account appears on that device (DEVICE_VELOCITY_THRESHOLD=3). A two-account farm on one phone/IP passes screening and drains the IP economy (IP buys Pro). Fraud prevention is materially weaker than the spec/UI implies; partly mitigated by deviceVelocity but the 2nd account slips through.
FIX:     In ensure-book-started.ts before checkReferralFraud, look up the inviter's most recent recorded device/IP (via the risk-events store keyed by inviter userId, or persist deviceId/ipHash on the referral profile) and pass real inviterDeviceId / inviteeIp / inviterIp. Alternatively lower DEVICE_VELOCITY_THRESHOLD to 2 or add an explicit invitee-IP-equals-inviter-IP block. Add a test that a same-device second account is blocked at the 2nd activation.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/book/_lib/ensure-book-started.ts app/app/api/book/_lib/referral-fraud.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/book/_lib/ensure-book-started.ts app/app/api/book/_lib/referral-fraud.ts
git commit -m "fix(security): M11 — Referral fraud same-device / same-IP checks are dead"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE M11: committed on fix/M11 (worktree ../cf-fix-M11). Covered: M11."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/M11 && git worktree remove ../cf-fix-M11 && git branch -d fix/M11"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 40: M13 — Reconciliation route declares maxDuration=60 but the server Lambda timeout is 30s — long reconciliations are silently killed
**Lead:** `medium` · **Covers:** M13 · **Edits:** `app/app/api/book/admin/reconciliation/route.ts`, `open-next.config.ts` · context: `app/app/api/book/_lib/reconciliation.ts`, `infra/lib/chapterflow-frontend-stack.ts` · ⚠ shares a file with Task M2/H9

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/M13 ../cf-fix-M13 audit/prod-readiness-2026-06-14
cd ../cf-fix-M13
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/book/admin/reconciliation/route.ts, open-next.config.ts.
- Read-only context (do NOT edit, just read for understanding): app/app/api/book/_lib/reconciliation.ts, infra/lib/chapterflow-frontend-stack.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `app/app/api/book/admin/reconciliation/route.ts`, `open-next.config.ts`, which Task M2/H9 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- M13 · medium · app/app/api/book/admin/reconciliation/route.ts:10-11, infra/lib/chapterflow-frontend-stack.ts:391, open-next.config.ts:3-14, app/app/api/book/_lib/reconciliation.ts:38-71
PROBLEM: reconciliation/route.ts:11 sets `export const maxDuration = 60` with a comment about scanning entitlements + paginating Stripe. OpenNext bundles all routes into the single default ServerFn (open-next.config.ts has no per-route function split) whose CDK timeout is hard-set to 30s (frontend-stack.ts:391). The Next.js maxDuration export is a Vercel-platform hint that OpenNext/Lambda does not honor, so the function is forcibly terminated at 30s. reconcileStripeEntitlements does a full scanAllEntitlements (paginated full-table scan) PLUS a paginated Stripe subscriptions.list loop (100/page) — for a non-trivial subscription count plus a large entitlement table this exceeds 30s and 504s.
WHY:     Billing reconciliation (the tool meant to catch missed Stripe webhooks before trusting MRR) times out for any account with more than a handful of subscriptions, giving false confidence or no result exactly when it matters.
FIX:     Move reconciliation off the request ServerFn into a dedicated lambda.Function with a real 60s+ timeout (invoked async by the route, results polled), OR remove the misleading maxDuration=60 and document/enforce the 30s cap (the lib already supports a maxPages truncation flag — surface 'truncated' clearly). Do not raise the shared ServerFn timeout, as that affects all routes.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/book/admin/reconciliation/route.ts open-next.config.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/book/admin/reconciliation/route.ts open-next.config.ts
git commit -m "fix(ops): M13 — Reconciliation route declares maxDuration=60 but the"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE M13: committed on fix/M13 (worktree ../cf-fix-M13). Covered: M13."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/M13 && git worktree remove ../cf-fix-M13 && git branch -d fix/M13"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 41: M14 (+1) — Multiple metrics routes do unbounded full-table DynamoDB scans on every request under a 30s ceiling
**Lead:** `medium` · **Covers:** M14, M15 · **Edits:** `app/app/api/book/_lib/admin-metrics.ts`, `app/app/api/book/_lib/analytics-repo.ts`, `app/app/api/book/admin/metrics/notifications/route.ts`, `app/app/api/book/admin/users/search/route.ts` · context: `app/app/api/book/_lib/economy-health.ts`, `app/app/api/book/admin/metrics/acquisition/route.ts`, `app/app/api/book/admin/metrics/content/route.ts`, `app/app/api/book/admin/segments/[segmentId]/notify/route.ts`, `app/app/api/book/admin/segments/preview/route.ts` · ⚠ shares a file with Task H9

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 2 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/M14 ../cf-fix-M14 audit/prod-readiness-2026-06-14
cd ../cf-fix-M14
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/book/_lib/admin-metrics.ts, app/app/api/book/_lib/analytics-repo.ts, app/app/api/book/admin/metrics/notifications/route.ts, app/app/api/book/admin/users/search/route.ts.
- Read-only context (do NOT edit, just read for understanding): app/app/api/book/_lib/economy-health.ts, app/app/api/book/admin/metrics/acquisition/route.ts, app/app/api/book/admin/metrics/content/route.ts, app/app/api/book/admin/segments/[segmentId]/notify/route.ts, app/app/api/book/admin/segments/preview/route.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `app/app/api/book/admin/metrics/notifications/route.ts`, which Task H9 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- M14 · medium · app/app/api/book/_lib/admin-metrics.ts:374-449 (scanAllEntitlements), app/app/api/book/_lib/admin-metrics.ts:478-500 (scanAllUserSnapshots), app/app/api/book/_lib/economy-health.ts:70-87,256-285 (engagement + ledger scans), app/app/api/book/admin/metrics/acquisition/route.ts:34-53, app/app/api/book/admin/metrics/notifications/route.ts:38-121, app/app/api/book/admin/metrics/content/route.ts:26-70, app/app/api/book/admin/segments/preview/route.ts:25, app/app/api/book/admin/segments/[segmentId]/notify/route.ts:47
PROBLEM: scanAllEntitlements and scanAllUserSnapshots paginate the ENTIRE table with a FilterExpression (no GSI) on every call; buildSegmentUsers (segments/preview AND notify) runs BOTH on each request. computeEconomyHealth scans all BOOK_USER_ENGAGEMENT (unbounded) plus a 10-page ledger sample. The acquisition route scans all BOOK_USER_PROFILE; notifications route scans all BOOK_USER_NOTIFICATION (capped 5000) and all BOOK_USER_SETTINGS (uncapped). The content route loops up to 180 days sequentially (lastNDays(min(180,range))) with 4 paginated queries per day. The code itself flags 'In production, this should use a GSI or materialized view'. Mitigant confirmed: scans are wrapped in try/catch and degrade to warnings rather than crashing, so blast radius is limited today.
WHY:     Admin dashboards (economy, billing, retention, devices, geography, funnels, acquisition, segments) slow down then start partial-warning/failing as the user table grows — well before meaningful scale — and each dashboard open drives several full-table scans (RCU cost).
FIX:     Precompute cross-cutting aggregates in a daily/hourly cron Lambda writing an ANALYTICS#ROLLUP item the dashboard reads; add GSIs for entitlement plan/source and engagement balances. Cache scanAllEntitlements/scanAllUserSnapshots for a short TTL so segments preview+notify and metrics routes don't each re-scan. Add explicit pagination caps where 'all' isn't strictly required (the unbounded settings scan in notifications/route.ts especially).

--- M15 · medium · app/app/api/book/_lib/admin-metrics.ts:252-282 (searchUsersByEmail), app/app/api/book/_lib/analytics-repo.ts:553-563 (email stored verbatim), app/app/api/book/admin/users/search/route.ts:28-30
PROBLEM: searchUsersByEmail lowercases the query (q = query.toLowerCase().trim()) and filters with DynamoDB contains(#e, :q). The email is persisted verbatim from Cognito (analytics-repo.ts:555 sets values[':email']=args.email with no lowercasing; only emailDomain is derived). DynamoDB contains is byte-exact/case-sensitive, so a stored 'John.Doe@Gmail.com' won't match a search for 'john' or 'gmail'. The users/search route (search/route.ts:30) calls this directly for q-driven searches, returning an empty list (looks like 'no such user').
WHY:     Admin support workflow (find a user by email to view entitlements, adjust points, change account status, erase) silently returns zero results for any user whose stored email has uppercase letters. Severity stays medium: real impact depends on Cognito's email casing, so 'most real users' may overstate it, but the bug is real and produces a silent empty result.
FIX:     Persist a normalized emailLower field on the snapshot at write time in analytics-repo.ts (alongside email/emailDomain) and have searchUsersByEmail filter contains(#emailLower, :q). Backfill existing snapshots once. A stopgap is to scan SK=SNAPSHOT and do case-insensitive JS filtering, but the persistent fix is the lowercase index field.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/book/_lib/admin-metrics.ts app/app/api/book/_lib/analytics-repo.ts app/app/api/book/admin/metrics/notifications/route.ts app/app/api/book/admin/users/search/route.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/book/_lib/admin-metrics.ts app/app/api/book/_lib/analytics-repo.ts app/app/api/book/admin/metrics/notifications/route.ts app/app/api/book/admin/users/search/route.ts
git commit -m "fix(performance): M14, M15 — Multiple metrics routes do unbounded full-table Dyna"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE M14: committed on fix/M14 (worktree ../cf-fix-M14). Covered: M14, M15."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/M14 && git worktree remove ../cf-fix-M14 && git branch -d fix/M14"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 42: M16 (+1) — Admin insight-point adjustment marks the target user as active (lastActiveAt = now), corrupting retention/active metrics
**Lead:** `medium` · **Covers:** M16, P5 · **Edits:** `app/app/api/book/_lib/admin-auth.ts`, `app/app/api/book/admin/insight-points/adjust/route.ts` · context: `app/app/api/book/_lib/analytics-repo.ts`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 2 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/M16 ../cf-fix-M16 audit/prod-readiness-2026-06-14
cd ../cf-fix-M16
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/book/_lib/admin-auth.ts, app/app/api/book/admin/insight-points/adjust/route.ts.
- Read-only context (do NOT edit, just read for understanding): app/app/api/book/_lib/analytics-repo.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- M16 · medium · app/app/api/book/admin/insight-points/adjust/route.ts:135-148, app/app/api/book/_lib/analytics-repo.ts:790-840 (analyticsTrackFlowPointsTransaction)
PROBLEM: The manual IP adjustment fires analyticsTrackFlowPointsTransaction with sourceType 'admin_adjustment'. That function unconditionally sets '#lastActiveAt = :now' on the user's SNAPSHOT and writes a flow_points_earned/flow_points_spent EVENT under the userId. So an admin granting/deducting points to a dormant user stamps them active 'now' and emits an activity event. This pollutes DAU/active counts (activeUsersByPlan reads plan-updatedAt; overview proActive metrics), retention cohorts (buildCohortRetention reads readingDays/firstSeenAt), and any event-count-driven metric.
WHY:     Engagement/retention KPIs are inflated by admin back-office actions; a comped or refunded user looks active, skewing the metrics the founder reports and decides on.
FIX:     For admin-originated transactions, skip the lastActiveAt SET and the activity-counting event. Add an `adminOriginated` (or sourceType-based) flag to analyticsTrackFlowPointsTransaction so 'admin_adjustment' updates the points balance/ledger only, not lastActiveAt, and routes the event to a non-engagement event type (or omits it). Verify engagement queries exclude that event type. Note: updatedAt is the plan-GSI sort key, so be careful — bumping updatedAt also affects activeUsersByPlan/listRecentUsersByPlan; ideally leave updatedAt unbumped too for admin transactions, or accept that only lastActiveAt-based metrics need fixing.

--- P5 · polish · app/app/api/book/admin/insight-points/adjust/route.ts:38-44, app/app/api/book/_lib/admin-auth.ts:5-15
PROBLEM: Every other admin route calls the shared requireAdminUser(). insight-points/adjust inlines the equivalent: requireActiveBookUser() then a manual getBookAdminGroupName() + admin.groups?.includes(adminGroup) check (route.ts:38-44). It is currently functionally identical to admin-auth.ts:5-15, but the duplication means a future hardening change to admin-auth (MFA, a second admin group, step-up auth) would silently skip this money-adjacent endpoint.
WHY:     Drift risk: an admin-auth policy change would not apply to the IP-adjustment endpoint, one of the more sensitive economy-affecting routes.
FIX:     Replace the inline check with `const admin = await requireAdminUser();` (which returns the same user object, preserving admin.sub/admin.email usage downstream) and drop the manual getBookAdminGroupName/includes block plus the now-unused import. Keeps all admin authz centralized.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/book/_lib/admin-auth.ts app/app/api/book/admin/insight-points/adjust/route.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/book/_lib/admin-auth.ts app/app/api/book/admin/insight-points/adjust/route.ts
git commit -m "fix(data): M16, P5 — Admin insight-point adjustment marks the target user"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE M16: committed on fix/M16 (worktree ../cf-fix-M16). Covered: M16, P5."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/M16 && git worktree remove ../cf-fix-M16 && git branch -d fix/M16"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 43: M17 — Manual entitlement override (plan/proStatus/freeBookSlots) writes no audit trail
**Lead:** `medium` · **Covers:** M17 · **Edits:** `app/app/api/book/_lib/repo.ts`, `app/app/api/book/admin/users/[userId]/entitlements/route.ts`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/M17 ../cf-fix-M17 audit/prod-readiness-2026-06-14
cd ../cf-fix-M17
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/book/_lib/repo.ts, app/app/api/book/admin/users/[userId]/entitlements/route.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- M17 · medium · app/app/api/book/admin/users/[userId]/entitlements/route.ts:59-103, app/app/api/book/_lib/repo.ts:2005-2060 (adminUpdateUserEntitlement)
PROBLEM: PATCH /admin/users/[userId]/entitlements lets an admin grant PRO, set proStatus, or set freeBookSlots (money-equivalent comps). adminUpdateUserEntitlement just UpdateItems the entitlement and returns — no ADMIN_AUDIT record, no required reason, and it never sets proSource. By contrast account-status records changedBy='admin:<sub>', insight-points/adjust writes a ledger entry with adminUserId+reason, and segment notify calls writeAuditEntry. A comp PRO grant here is invisible in the audit log AND, lacking proSource='stripe', is excluded from stripe-source MRR filters while still counting in proTotal — untraceable in both audit and revenue reconciliation.
WHY:     Comped/granted entitlements are untraceable and unauditable — a problem for fraud investigation, billing reconciliation, and accountability with multiple operators or a compromised account.
FIX:     In the entitlements PATCH handler, require a reason string (mirror insight-points/adjust's 10-char minimum) and write an audit record (action 'entitlement_override') capturing adminUserId, target userId, before/after plan/proStatus/freeBookSlots. NOTE: the existing writeAuditEntry in admin-segments-repo.ts is segment-shaped (requires segmentId/affectedUserCount), so either generalize it or add a small writeAdminAudit(adminUserId, action, targetUserId, params) helper. Set proSource='admin' on manual PRO grants in adminUpdateUserEntitlement so revenue/reconciliation routes can distinguish comps from Stripe.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/book/_lib/repo.ts app/app/api/book/admin/users/[userId]/entitlements/route.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/book/_lib/repo.ts app/app/api/book/admin/users/[userId]/entitlements/route.ts
git commit -m "fix(data): M17 — Manual entitlement override (plan/proStatus/freeBook"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE M17: committed on fix/M17 (worktree ../cf-fix-M17). Covered: M17."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/M17 && git worktree remove ../cf-fix-M17 && git branch -d fix/M17"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 44: M21 (+3) — No QueryCommand in repo.ts paginates LastEvaluatedKey — every list silently truncates at 1MB
**Lead:** `medium` · **Covers:** M21, M22, L20, L45 · **Edits:** `app/app/api/book/_lib/repo.ts` · context: `app/app/api/book/_lib/library-catalog.ts`, `app/app/api/book/books/route.ts`, `app/app/api/book/me/progress/route.ts`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 4 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/M21 ../cf-fix-M21 audit/prod-readiness-2026-06-14
cd ../cf-fix-M21
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/book/_lib/repo.ts.
- Read-only context (do NOT edit, just read for understanding): app/app/api/book/_lib/library-catalog.ts, app/app/api/book/books/route.ts, app/app/api/book/me/progress/route.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- M21 · medium · app/app/api/book/_lib/repo.ts:196 (listPublishedCatalogItems), app/app/api/book/_lib/repo.ts:853 (listAllUserProgress), app/app/api/book/_lib/repo.ts:2504 (listSavedBooks), app/app/api/book/_lib/repo.ts:2649 (listAllUserBookStates), app/app/api/book/_lib/repo.ts:2730 (listUserChapterStates), app/app/api/book/_lib/repo.ts:2804 (listReadingDays), app/app/api/book/_lib/repo.ts:2834 (listBadgeAwards)
PROBLEM: grep confirms zero occurrences of LastEvaluatedKey or ExclusiveStartKey anywhere in repo.ts across its ~18 QueryCommand calls. Each cited list does a single send() with no Limit and no loop. They feed me/progress and me/dashboard (verified imports) and the data export. Notably the SIBLING files economy-health.ts/soft-decay.ts/admin-metrics.ts DO loop on LastEvaluatedKey — so this is an inconsistency in repo.ts, not a codebase-wide pattern, which makes a shared helper a clean fix.
WHY:     Long-lived/power users silently see incomplete progress/history/streaks and incomplete export (GDPR/PIPEDA completeness). Catalog page (listPublishedCatalogItems, all books in one partition) is the most realistic near-term truncator as the catalog grows.
FIX:     Add a shared pagination helper (loop on ExclusiveStartKey until LastEvaluatedKey is undefined) and route every full-partition list through it. The exact pattern already exists in admin-metrics.ts — factor it out and reuse. For genuinely huge partitions add an explicit max-page cap.

--- M22 · medium · app/app/api/book/_lib/repo.ts:3145-3175
PROBLEM: listLicenseKeys queries the constant shared partition licenseIndexPk()='BOOKLICENSE#KEYS' with begins_with(SK,'CODE#'), an optional FilterExpression (#status=:statusFilter), no Limit, no pagination. DynamoDB applies FilterExpression after reading up to 1MB and before returning, so once this partition exceeds 1MB the admin list misses later keys and, with a status filter, under-counts (filter only sees the truncated page). All keys live in one partition (createLicenseKey writes an index item under the same constant PK).
WHY:     Admin license-key page shows an incomplete/under-counted list as the program scales; available/revoked counts wrong → bad ops decisions (re-seeding existing keys).
FIX:     Paginate over LastEvaluatedKey and accumulate before client-side filtering; OR fold status into the SK / a GSI so a filtered query is exact. Note each index item is small (~150 bytes) so truncation only starts at ~6000+ keys — real but not imminent; the shared pagination helper from finding 2 covers this too.

--- L20 · low · app/app/api/book/_lib/repo.ts:196-235, app/app/api/book/_lib/library-catalog.ts:124-143, app/app/api/book/books/route.ts:8-24
PROBLEM: listPublishedCatalogItems issues a single QueryCommand (lines 197-207) with no Limit and no LastEvaluatedKey/ExclusiveStartKey loop, and reads res.Items once (line 209). DynamoDB Query returns at most 1MB per page; once the CATALOG partition's BOOK# items exceed ~1MB the query silently returns a partial set, so /books (the public, hour-cached library list) would drop books with no error. Fine for a few dozen books today, latent as the catalog grows.
WHY:     Once the catalog grows past a single 1MB query page, some published books vanish from the library/catalog with no visible error — confusing and hard to diagnose.
FIX:     Add a pagination loop in listPublishedCatalogItems that follows LastEvaluatedKey (via ExclusiveStartKey) until exhausted, accumulating Items across pages. NOTE: the original fix said this is 'already done elsewhere in the repo' — that is INACCURATE; grep shows zero ExclusiveStartKey usage anywhere in repo.ts, so no existing loop can be copied (other queries cap via Limit instead). Implement the loop fresh; consider applying the same to any other unbounded full-partition scans.

--- L45 · low · app/app/api/book/_lib/repo.ts:2179-2187, app/app/api/book/me/progress/route.ts:23
PROBLEM: booksCompleted++ when `p.completedChapters.length > 0 && p.currentChapterNumber <= p.completedChapters.length`. This compares a chapter NUMBER to a COUNT and never references the book's real chapterCount. Concrete over-count: a 10-chapter book where the user finished ch1-3 and is parked on ch3 (currentChapterNumber=3, completedChapters.length=3) is counted 'completed' though 7 chapters remain. Out-of-order completion mis-counts in both directions. Feeds me/progress summary (verified caller).
WHY:     Profile/dashboard 'books completed' can over- or under-count, undermining a primary gamification surface.
FIX:     Join progress to the catalog/manifest chapterCount and require completedChapters.length >= chapterCount. Effort is medium because summarizeProgress is a pure function over progress entries — it needs the per-book chapterCount threaded in (e.g. a Map<bookId,chapterCount> from listPublishedCatalogItems/manifests).

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/book/_lib/repo.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/book/_lib/repo.ts
git commit -m "fix(correctness): M21, M22, L20, L45 — No QueryCommand in repo.ts paginates LastEvaluatedKe"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE M21: committed on fix/M21 (worktree ../cf-fix-M21). Covered: M21, M22, L20, L45."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/M21 && git worktree remove ../cf-fix-M21 && git branch -d fix/M21"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 45: M26 — Prominent 'Start 14-day free trial' CTA dumps logged-out users into the reader, never into a trial/checkout flow
**Lead:** `medium` · **Covers:** M26 · **Edits:** `components/sections/Pricing.tsx`, `lib/pricing.ts` · ⚠ shares a file with Task L53/H1/M29

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/M26 ../cf-fix-M26 audit/prod-readiness-2026-06-14
cd ../cf-fix-M26
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: components/sections/Pricing.tsx, lib/pricing.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `components/sections/Pricing.tsx`, `lib/pricing.ts`, which Task L53/H1/M29 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- M26 · medium · components/sections/Pricing.tsx:117-118, components/sections/Pricing.tsx:370-377, lib/pricing.ts:72
PROBLEM: TRIAL_CTA_LABEL = 'Start 14-day free trial' (lib/pricing.ts:72). The Pro card CTA (Pricing.tsx:370-377) uses proHref = loggedIn ? '/book/settings' : AUTH_LOGIN_BOOK_URL, where AUTH_LOGIN_BOOK_URL='/auth/login?returnTo=%2Fbook' (chapterflow-brand.ts:100). So a logged-out visitor who clicks the trial button is sent to login and then to /book (the reader), NOT to checkout or any trial-start surface. The fine print directly above (lines 351-367) promises 'A card is required; you won't be charged until the trial ends' — a checkout moment this href does not deliver. For logged-in users the destination is /book/settings, which is plausibly where the billing/upgrade UI lives, so that path is more defensible; the broken promise is specifically the logged-out path landing in the free reader.
WHY:     The single most important monetization CTA on the marketing site doesn't begin the advertised trial for new (logged-out) visitors — they land in the free reader with no checkout, a confusing dead-end vs the button copy that likely depresses trial-start conversion.
FIX:     Point the logged-out Pro CTA at a returnTo that lands on the upgrade/checkout surface (e.g. '/auth/login?returnTo=%2Fbook%2Fsettings%3Fupgrade%3D1' or a dedicated upgrade route that opens Stripe checkout) rather than %2Fbook. Verify /book/settings actually surfaces the Stripe checkout/start-trial action for the logged-in path; if it just shows settings without a prominent upgrade step, route it (or deep-link) to the checkout action so the destination immediately presents the trial-start step.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint components/sections/Pricing.tsx lib/pricing.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add components/sections/Pricing.tsx lib/pricing.ts
git commit -m "fix(ux): M26 — Prominent 'Start 14-day free trial' CTA dumps logged"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE M26: committed on fix/M26 (worktree ../cf-fix-M26). Covered: M26."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/M26 && git worktree remove ../cf-fix-M26 && git branch -d fix/M26"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 46: M27 — Sitemap and robots advertise login-gated /book/* routes as public indexable URLs
**Lead:** `medium` · **Covers:** M27 · **Edits:** `app/chapterflow/page.tsx`, `app/robots.ts`, `app/sitemap.ts`, `middleware.ts` · ⚠ shares a file with Task C1

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/M27 ../cf-fix-M27 audit/prod-readiness-2026-06-14
cd ../cf-fix-M27
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/chapterflow/page.tsx, app/robots.ts, app/sitemap.ts, middleware.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `app/robots.ts`, `app/sitemap.ts`, which Task C1 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- M27 · medium · app/sitemap.ts:6-13, app/robots.ts:9-12, middleware.ts:38-44,93, app/chapterflow/page.tsx:4-6
PROBLEM: sitemap.ts lists /book, /book/library, /book/profile, /book/progress, /chapterflow; robots.ts allows ['/', '/book', '/book/library', '/chapterflow']. middleware.ts protects /app, /book, /dashboard (protectedSurface lines 38-41; matcher line 93 ['/app/:path*','/book/:path*','/dashboard/:path*']) and redirects unauthenticated visitors to login with returnTo. /chapterflow (app/chapterflow/page.tsx) redirect()s to /book — itself login-gated. The genuinely public, indexable browse surface is /books (plural), which has full metadata + ItemList JSON-LD (app/books/page.tsx) but is NOT in the sitemap. /pricing, /contact, /legal/* are also public and missing from the sitemap.
WHY:     Crawlers following the sitemap/robots hit auth redirects (soft-404/redirect signals) and waste crawl budget, while the real indexable content (/books, /pricing, /contact, /legal/*) is omitted — hurting discoverability of the public surface.
FIX:     In sitemap.ts, replace the /book/* and /chapterflow entries with the public pages: /, /books, /pricing, /contact, and the /legal/* pages. In robots.ts, drop /book and /book/library from allow (they redirect to login) and stop allowing /chapterflow (a redirect); keep / and add nothing that 302s. Optionally add /book* to disallow to make the intent explicit.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/chapterflow/page.tsx app/robots.ts app/sitemap.ts middleware.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/chapterflow/page.tsx app/robots.ts app/sitemap.ts middleware.ts
git commit -m "fix(ops): M27 — Sitemap and robots advertise login-gated /book/* rou"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE M27: committed on fix/M27 (worktree ../cf-fix-M27). Covered: M27."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/M27 && git worktree remove ../cf-fix-M27 && git branch -d fix/M27"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 47: M28 — Recorded Terms-acceptance version (2026-06-10) does not match the displayed Terms/Privacy effective date (April 2, 2026)
**Lead:** `medium` · **Covers:** M28 · **Edits:** `app/app/api/book/me/onboarding/complete/route.ts`, `app/app/api/book/me/profile/route.ts`, `app/legal/privacy/page.tsx`, `app/legal/terms/page.tsx`, `lib/legal-entity.ts` · ⚠ shares a file with Task L28/H26/H19/L58/M29

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/M28 ../cf-fix-M28 audit/prod-readiness-2026-06-14
cd ../cf-fix-M28
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/book/me/onboarding/complete/route.ts, app/app/api/book/me/profile/route.ts, app/legal/privacy/page.tsx, app/legal/terms/page.tsx, lib/legal-entity.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `app/app/api/book/me/onboarding/complete/route.ts`, `app/app/api/book/me/profile/route.ts`, `app/legal/privacy/page.tsx`, `app/legal/terms/page.tsx`, `lib/legal-entity.ts`, which Task L28/H26/H19/L58/M29 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- M28 · medium · lib/legal-entity.ts:29, app/legal/terms/page.tsx:18-19, app/legal/privacy/page.tsx:18-19, app/app/api/book/me/profile/route.ts:370-372, app/app/api/book/me/onboarding/complete/route.ts:287-288
PROBLEM: LEGAL_TERMS_VERSION='2026-06-10' (legal-entity.ts:29) is stamped onto a user's consent record at profile completion (profile/route.ts:371-372) and onboarding completion (onboarding/complete/route.ts:287-288). But the published Terms and Privacy both display 'Effective date: April 2, 2026' (terms/page.tsx:18, privacy/page.tsx:18). The Refund, Copyright, and Data-Rights pages all carry 'June 10, 2026', confirming the Terms/Privacy dates were simply not bumped when the version was. The version comment (legal-entity.ts:24-28) explicitly aims to keep 'recorded consent auditable' — broken because the stored version string maps to no document bearing that effective date.
WHY:     Consent audit trail is internally inconsistent: in a dispute over which Terms a user agreed to, the recorded version (2026-06-10) points to no published document with that effective date. Weakens the legal value of recorded consent for a live, paid product.
FIX:     Reconcile the dates: bump terms/page.tsx:18 and privacy/page.tsx:18 effective dates to 'June 10, 2026' to match LEGAL_TERMS_VERSION and the other three legal pages (preferred, since the docs describe June-era practices). Better long-term: derive the displayed effective date from LEGAL_TERMS_VERSION so they cannot drift.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/book/me/onboarding/complete/route.ts app/app/api/book/me/profile/route.ts app/legal/privacy/page.tsx app/legal/terms/page.tsx lib/legal-entity.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/book/me/onboarding/complete/route.ts app/app/api/book/me/profile/route.ts app/legal/privacy/page.tsx app/legal/terms/page.tsx lib/legal-entity.ts
git commit -m "fix(correctness): M28 — Recorded Terms-acceptance version (2026-06-10) does "

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE M28: committed on fix/M28 (worktree ../cf-fix-M28). Covered: M28."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/M28 && git worktree remove ../cf-fix-M28 && git branch -d fix/M28"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 48: M29 — Terms, Privacy, and Cookies pages hardcode entity name, support email, and pricing instead of importing the single-source-of-truth modules
**Lead:** `medium` · **Covers:** M29 · **Edits:** `app/legal/terms/page.tsx`, `lib/legal-entity.ts`, `lib/pricing.ts` · context: `app/legal/cookies/page.tsx`, `app/legal/privacy/page.tsx` · ⚠ shares a file with Task M28/H1/M26

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/M29 ../cf-fix-M29 audit/prod-readiness-2026-06-14
cd ../cf-fix-M29
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/legal/terms/page.tsx, lib/legal-entity.ts, lib/pricing.ts.
- Read-only context (do NOT edit, just read for understanding): app/legal/cookies/page.tsx, app/legal/privacy/page.tsx.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `app/legal/terms/page.tsx`, `lib/legal-entity.ts`, `lib/pricing.ts`, which Task M28/H1/M26 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- M29 · medium · app/legal/terms/page.tsx:27, app/legal/terms/page.tsx:56-59, app/legal/terms/page.tsx:132-133, app/legal/terms/page.tsx:148-149, app/legal/privacy/page.tsx:105, app/legal/privacy/page.tsx:178, app/legal/cookies/page.tsx:158, lib/legal-entity.ts:10, lib/pricing.ts:25-40
PROBLEM: legal-entity.ts and pricing.ts are the documented single sources of truth, yet Terms hardcodes 'SiliconX Software Solutions' (terms/page.tsx:27, 132-133, 148-149, 161), the pricing prose '$7.99 CAD per month, $5.99 CAD/month billed annually ($71.88/year), or $59.99 CAD/year' (terms/page.tsx:56-59), and 'support@chapterflow.ca' as raw mailto strings (terms:181,213; privacy:105,124,180; cookies:158). Refund (imports PRICING), Copyright (imports LEGAL_ENTITY_NAME/LEGAL_CONTACT_EMAIL), Contact (imports SUPPORT_EMAIL/LEGAL_ENTITY_NAME/LEGAL_ENTITY_LOCATION), and Data-Rights (imports SUPPORT_EMAIL) DO use the modules, so the codebase is half-migrated. pricing.ts:8-11 even warns that a number change here must be mirrored into terms/page.tsx prose manually — a documented drift trap.
WHY:     High risk of copy drift: a price change or entity rename updates pricing/refund/checkout surfaces but leaves stale, legally-binding numbers/names in the Terms, producing contradictory published prices (consumer-protection problem for a paid product) and an inconsistent entity name across legal docs.
FIX:     In terms/page.tsx replace 'SiliconX Software Solutions' literals with LEGAL_ENTITY_NAME and the pricing prose with interpolated values: formatAmountWithCurrency(PRICING.monthlyAmount), formatAmount(PRICING.annualMonthlyAmount), formatAmount(ANNUAL_TOTAL_AMOUNT), formatAmount(PRICING.annualUpfrontAmount), PRICING.trialDays, PRICING.freeBookLimit (as refund/page.tsx already does). Replace raw 'support@chapterflow.ca' mailto strings in terms/privacy/cookies with SUPPORT_EMAIL from legal-entity.ts. Then delete the manual-sync warning in pricing.ts:8-11.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/legal/terms/page.tsx lib/legal-entity.ts lib/pricing.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/legal/terms/page.tsx lib/legal-entity.ts lib/pricing.ts
git commit -m "fix(maintainability): M29 — Terms, Privacy, and Cookies pages hardcode entity na"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE M29: committed on fix/M29 (worktree ../cf-fix-M29). Covered: M29."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/M29 && git worktree remove ../cf-fix-M29 && git branch -d fix/M29"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 49: M31 — Pair-accept 401 (expired/invalid token) dead-ends with only 'Go to dashboard', no re-login path
**Lead:** `medium` · **Covers:** M31 · **Edits:** `app/book/_lib/book-api.ts`, `app/book/pair-accept/page.tsx`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/M31 ../cf-fix-M31 audit/prod-readiness-2026-06-14
cd ../cf-fix-M31
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/book/_lib/book-api.ts, app/book/pair-accept/page.tsx.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- M31 · medium · app/book/pair-accept/page.tsx:62-79,101-108, app/book/_lib/book-api.ts:37-67
PROBLEM: PairAcceptInner auto-POSTs to /app/api/book/me/pairs/accept/[code] on mount (handleAccept, lines 62-88). On any failure the catch (71-78) sets state='error' and the error card (101-108) renders only a 'Go to dashboard' button. There is no status-specific handling, so a 401 (cookie present at the shell but access token expired/invalid at the API) shows a generic failure with no way to re-authenticate and complete the invite. fetchBookJson throws BookClientError(message, response.status, ...) (book-api.ts:67), so err.status is available to branch on.
WHY:     A reading-partner invite can become uncompletable during the token-expiry window with a confusing dead-end, losing a social-loop conversion. Narrow window (fully-logged-out is handled by middleware), hence medium.
FIX:     In the catch, capture err.status; in the error branch special-case 401 to render a primary action linking to /auth/login?returnTo=<relative /book/pair-accept?code=...> instead of 'Go to dashboard', so the user can re-auth and the auto-accept retries on return. Keep 'Go to dashboard' as secondary for non-401 errors. (If finding 2's relative-returnTo fix lands, the existing middleware redirect would also cover the fully-expired case, but a mid-mount 401 after the shell rendered still needs this in-page affordance.)

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/book/_lib/book-api.ts app/book/pair-accept/page.tsx

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/book/_lib/book-api.ts app/book/pair-accept/page.tsx
git commit -m "fix(ux): M31 — Pair-accept 401 (expired/invalid token) dead-ends wi"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE M31: committed on fix/M31 (worktree ../cf-fix-M31). Covered: M31."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/M31 && git worktree remove ../cf-fix-M31 && git branch -d fix/M31"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 50: M32 (+1) — quizPassed is always false in the live flow (state.quizResult is never written client-side) — dead IP-reconciliation + dead practice gating
**Lead:** `medium` · **Covers:** M32, L66 · **Edits:** `app/book/library/[bookId]/chapter/[chapterId]/ChapterReaderClient.tsx` · context: `app/book/library/[bookId]/chapter/[chapterId]/components/ExamplesList.tsx`, `app/book/library/[bookId]/chapter/[chapterId]/hooks/useChapterState.ts`, `app/book/library/[bookId]/chapter/[chapterId]/hooks/usePhaseCompletion.ts`, `components/ui/Dialog.tsx` · ⚠ shares a file with Task H21

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 2 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/M32 ../cf-fix-M32 audit/prod-readiness-2026-06-14
cd ../cf-fix-M32
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/book/library/[bookId]/chapter/[chapterId]/ChapterReaderClient.tsx.
- Read-only context (do NOT edit, just read for understanding): app/book/library/[bookId]/chapter/[chapterId]/components/ExamplesList.tsx, app/book/library/[bookId]/chapter/[chapterId]/hooks/useChapterState.ts, app/book/library/[bookId]/chapter/[chapterId]/hooks/usePhaseCompletion.ts, components/ui/Dialog.tsx.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `app/book/library/[bookId]/chapter/[chapterId]/ChapterReaderClient.tsx`, which Task H21 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- M32 · medium · app/book/library/[bookId]/chapter/[chapterId]/ChapterReaderClient.tsx:257, app/book/library/[bookId]/chapter/[chapterId]/ChapterReaderClient.tsx:261-268, app/book/library/[bookId]/chapter/[chapterId]/hooks/usePhaseCompletion.ts:264-268, app/book/library/[bookId]/chapter/[chapterId]/hooks/usePhaseCompletion.ts:327-329, app/book/library/[bookId]/chapter/[chapterId]/hooks/useChapterState.ts:378-380
PROBLEM: quizPassed = state.quizResult?.passed === true (ChapterReaderClient:257). setQuizResult exists on the hook (useChapterState:378-380) but is NEVER destructured in ChapterReaderClient's useChapterState call (verified the destructure list at lines 233-254 omits it), and a repo grep shows ChapterReaderClient:257 is the ONLY consumer of .quizResult outside the hook. The live quiz is driven by useQuizSession, which never calls setQuizResult. The state PATCH route stores rawState verbatim (state/route.ts:81), so quizResult persists as null. Consequences: (a) the §1.1 reconciliation effect (lines 261-268) that should re-claim loop-complete IP on an already-passed chapter NEVER fires; (b) usePhaseCompletion quiz-readiness via quizPassed (line 266) and practice accessibility via `completedPhases.has('quiz') && quizPassed` (line 328) are inert — masked today because completion is driven by markPhaseCompleted() and allPhasesCompletedOnce short-circuits accessibility (line 318), but it is fragile dead logic.
WHY:     A reader who passes a quiz offline (provisional pass) and never lands the server IP claim can permanently miss loop-complete Insight Points; the reconciliation written to fix exactly this never runs. The unused gating is misleading for maintainers.
FIX:     Pick one source of truth. Either wire useQuizSession's pass result into setQuizResult so state.quizResult reflects reality (re-enabling the §1.1 effect and the gating), or derive quizPassed from the live session / completedPhases (e.g. quiz.session?.result?.passed === true || completedPhases.has('quiz')) and delete the dead state.quizResult path, setQuizResult, and the §1.1 effect.

--- L66 · low · app/book/library/[bookId]/chapter/[chapterId]/ChapterReaderClient.tsx:1238-1287, app/book/library/[bookId]/chapter/[chapterId]/components/ExamplesList.tsx:635-663, components/ui/Dialog.tsx
PROBLEM: The '?' shortcuts overlay (ChapterReaderClient:1238-1287) is a raw role="dialog" div: focus is not moved in on open, not trapped (Tab leaves to the page behind), not restored on close, and there is no aria-modal; background is not inert. Escape closes (global shortcut) and backdrop click closes. AddScenarioModal (ExamplesList:635-663) is similar — it DOES have aria-modal=true (line 655), an Escape handler (643-649) and a body-scroll lock (635-641), but no focus trap, no initial-focus move, and no focus restore. Both reimplement bespoke fixed-inset overlays instead of the shared components/ui/Dialog OverlayShell, whose header comment confirms it provides portal + role=dialog + aria-modal + focus trap + initial focus + focus restore + Escape + backdrop + scroll lock (and is already used by NotesDrawer via Sheet).
WHY:     Keyboard and screen-reader users can Tab out of the open dialog into the obscured page and lose focus after close — a known a11y gap for launch.
FIX:     Render both overlays through the shared Dialog (center) component used by NotesDrawer/ResetProgressModal/ChapterCompleteModal, which gives focus-trap, scroll-lock, aria-modal and focus restore for free, instead of the bespoke fixed-inset divs.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/book/library/[bookId]/chapter/[chapterId]/ChapterReaderClient.tsx

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/book/library/[bookId]/chapter/[chapterId]/ChapterReaderClient.tsx
git commit -m "fix(correctness): M32, L66 — quizPassed is always false in the live flow (state.q"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE M32: committed on fix/M32 (worktree ../cf-fix-M32). Covered: M32, L66."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/M32 && git worktree remove ../cf-fix-M32 && git branch -d fix/M32"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 51: M33 — Reflection-IP award flow in ExamplesList is fully dead (endpoint never called)
**Lead:** `medium` · **Covers:** M33 · **Edits:** `app/book/library/[bookId]/chapter/[chapterId]/components/ExamplesList.tsx`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/M33 ../cf-fix-M33 audit/prod-readiness-2026-06-14
cd ../cf-fix-M33
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/book/library/[bookId]/chapter/[chapterId]/components/ExamplesList.tsx.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- M33 · medium · app/book/library/[bookId]/chapter/[chapterId]/components/ExamplesList.tsx:317-348, app/book/library/[bookId]/chapter/[chapterId]/components/ExamplesList.tsx:290-315, app/book/library/[bookId]/chapter/[chapterId]/components/ExamplesList.tsx:86-110, app/book/library/[bookId]/chapter/[chapterId]/components/ExamplesList.tsx:561, app/book/library/[bookId]/chapter/[chapterId]/components/ExamplesList.tsx:571-593
PROBLEM: ExamplesList builds a full reflection-award system: handleSubmitReflection POSTs /app/api/book/me/reflections/[bookId]/[n] (lines 317-348), manages a reflectionAwards localStorage set (290-315), and renders '+N IP for thinking deeply' toasts (571-593). It is passed to ScenarioCard as onSubmitReflection={handleSubmitReflection} (line 561). But ScenarioCard's destructured params (lines 86-96) do NOT include onSubmitReflection — the prop only appears on its type (line 107, explicitly marked 'Deprecated: textarea-based reflection was removed'). handleReveal (lines 145-151) calls only onInteraction. So handleSubmitReflection is never invoked, the toasts never appear, and /me/reflections (route confirmed to exist) is unreachable from the reader.
WHY:     An economy feature (reflection IP) is silently disabled on the primary examples surface; ~60 lines of state/effects/toasts plus a live API route are dead weight and a maintenance trap.
FIX:     Decide intent. If revealing the analysis should reward IP, call onSubmitReflection(example.id, ...) from ScenarioCard.handleReveal (and add it to the destructured params). If not, delete handleSubmitReflection, the reflectionAwards state+effects, reflectionToasts and its render block, the deprecated onSubmitReflection prop/type, and the /me/reflections wiring.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/book/library/[bookId]/chapter/[chapterId]/components/ExamplesList.tsx

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/book/library/[bookId]/chapter/[chapterId]/components/ExamplesList.tsx
git commit -m "fix(dead-code): M33 — Reflection-IP award flow in ExamplesList is fully de"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE M33: committed on fix/M33 (worktree ../cf-fix-M33). Covered: M33."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/M33 && git worktree remove ../cf-fix-M33 && git branch -d fix/M33"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 52: M34 (+1) — Entire app/book/home/components tree's 11 widgets are dead code (~1577 LOC)
**Lead:** `medium` · **Covers:** M34, L93 · **Edits:** `app/book/data/mockProgress.ts`, `app/book/home/page.tsx`, `app/book/hooks/useBookState.ts` · context: `app/book/home/components/BookMiniCard.tsx`, `app/book/home/components/CommitmentFollowUpCard.tsx`, `app/book/home/components/CurrentlyReadingCard.tsx`, `app/book/home/components/EventBanner.tsx`, `app/book/home/components/FlowPointsSection.tsx`, `app/book/home/components/GoalMeter.tsx`, `app/book/home/components/JourneyBanner.tsx`, `app/book/home/components/PartnerProgressCard.tsx`, `app/book/home/components/ReviewDueWidget.tsx`, `app/book/home/components/StarterRecommendationCard.tsx`, `app/book/home/components/TodaySessionCard.tsx` · ⚠ shares a file with Task H7

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 2 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/M34 ../cf-fix-M34 audit/prod-readiness-2026-06-14
cd ../cf-fix-M34
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/book/data/mockProgress.ts, app/book/home/page.tsx, app/book/hooks/useBookState.ts.
- Read-only context (do NOT edit, just read for understanding): app/book/home/components/BookMiniCard.tsx, app/book/home/components/CommitmentFollowUpCard.tsx, app/book/home/components/CurrentlyReadingCard.tsx, app/book/home/components/EventBanner.tsx, app/book/home/components/FlowPointsSection.tsx, app/book/home/components/GoalMeter.tsx, app/book/home/components/JourneyBanner.tsx, app/book/home/components/PartnerProgressCard.tsx, app/book/home/components/ReviewDueWidget.tsx, app/book/home/components/StarterRecommendationCard.tsx, app/book/home/components/TodaySessionCard.tsx.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `app/book/home/page.tsx`, which Task H7 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- M34 · medium · app/book/home/page.tsx:1, app/book/home/components/StarterRecommendationCard.tsx, app/book/home/components/CommitmentFollowUpCard.tsx, app/book/home/components/CurrentlyReadingCard.tsx, app/book/home/components/EventBanner.tsx, app/book/home/components/FlowPointsSection.tsx, app/book/home/components/BookMiniCard.tsx, app/book/home/components/TodaySessionCard.tsx, app/book/home/components/PartnerProgressCard.tsx, app/book/home/components/GoalMeter.tsx, app/book/home/components/JourneyBanner.tsx, app/book/home/components/ReviewDueWidget.tsx
PROBLEM: app/book/home/page.tsx is just `redirect('/dashboard')`. The live dashboard is components/workspace/WorkspacePage. Of the files in app/book/home/components, only TopNav (15 importers), SearchBox, GlobalSearchPanel (4 importers) and InfoModal (1 importer, the profile client) are live. The 11 listed widgets have zero external referencers and do not import each other (verified by grep across app/components/lib).
WHY:     ~1577 lines of unreferenced code ship and confuse maintainers — the classic 'legacy duplicate client' trap (editing StarterRecommendationCard/CommitmentFollowUpCard expecting the dashboard to change does nothing). Bloats the surface auditors must reason about.
FIX:     Delete the 11 orphaned files. Keep TopNav.tsx, SearchBox.tsx, GlobalSearchPanel.tsx, InfoModal.tsx (still live). Optionally move those four to a neutral location (e.g. components/nav/) so a redirect-only route folder stops implying a live 'home' surface, and retarget the admin links (app/book/admin/layout.tsx:13 redirect, AdminShell.tsx:147/229) from /book/home to /dashboard so app/book/home/page.tsx can be removed too.

--- L93 · low · app/book/home/page.tsx:4, app/book/home/components/CurrentlyReadingCard.tsx, app/book/home/components/TodaySessionCard.tsx, app/book/home/components/FlowPointsSection.tsx, app/book/home/components/StarterRecommendationCard.tsx, app/book/home/components/CommitmentFollowUpCard.tsx, app/book/home/components/BookMiniCard.tsx, app/book/home/components/EventBanner.tsx, app/book/home/components/GoalMeter.tsx, app/book/home/components/JourneyBanner.tsx, app/book/home/components/PartnerProgressCard.tsx, app/book/home/components/ReviewDueWidget.tsx, app/book/hooks/useBookState.ts, app/book/data/mockProgress.ts
PROBLEM: Confirmed: app/book/home/page.tsx is now just `redirect("/dashboard")`. The 6 named cards (CurrentlyReadingCard, TodaySessionCard, FlowPointsSection, StarterRecommendationCard, CommitmentFollowUpCard, BookMiniCard) have ZERO importers anywhere. The only files actually imported from home/components by live pages are TopNav, InfoModal, SearchBox, and GlobalSearchPanel. EXPANSION beyond the original finding: 5 MORE files in that directory are also fully unimported — EventBanner, GoalMeter, JourneyBanner, PartnerProgressCard, ReviewDueWidget (all 0 importers). Additionally app/book/hooks/useBookState.ts (0 consumers) and the misleadingly-named app/book/data/mockProgress.ts are dead-by-transitive-closure: mockProgress.ts is consumed only by the dead home cards (type imports) and by the dead useBookState.ts. mockProgress.ts itself is NOT fabricated render data — it is a set of legitimate builders (buildRecentBooks/buildTodaySessionTasks/buildBadges) derived from the real catalog — so it's a naming/dead-code issue, not a data-authenticity lie.
WHY:     No runtime impact. Maintenance cost and audit confusion: a wider dead surface than the finding stated. Someone fixing a 'home screen' bug edits never-rendered files; the misleading mockProgress.ts name makes the tree read as if mock data is live.
FIX:     After confirming importer sets (done), delete all 11 unimported home cards: CurrentlyReadingCard, TodaySessionCard, FlowPointsSection, StarterRecommendationCard, CommitmentFollowUpCard, BookMiniCard, EventBanner, GoalMeter, JourneyBanner, PartnerProgressCard, ReviewDueWidget. Keep TopNav/InfoModal/SearchBox/GlobalSearchPanel (live pages import them). Also delete app/book/hooks/useBookState.ts (0 consumers). Then app/book/data/mockProgress.ts loses all its consumers — either delete it too, or if any of its builders are wanted later, at minimum rename it (it is not mock data) and relocate it out of the dead path. Verify a typecheck after deletion since the dead cards type-import from mockProgress.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/book/data/mockProgress.ts app/book/home/page.tsx app/book/hooks/useBookState.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/book/data/mockProgress.ts app/book/home/page.tsx app/book/hooks/useBookState.ts
git commit -m "fix(dead-code): M34, L93 — Entire app/book/home/components tree's 11 widgets ar"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE M34: committed on fix/M34 (worktree ../cf-fix-M34). Covered: M34, L93."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/M34 && git worktree remove ../cf-fix-M34 && git branch -d fix/M34"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 53: M35 — Library 'Active Reads' silently drops the 2nd in-progress book (exactly-two case)
**Lead:** `medium` · **Covers:** M35 · **Edits:** `components/library/ActiveReads.tsx`, `components/library/LibraryPage.tsx` · ⚠ shares a file with Task L94

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/M35 ../cf-fix-M35 audit/prod-readiness-2026-06-14
cd ../cf-fix-M35
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: components/library/ActiveReads.tsx, components/library/LibraryPage.tsx.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `components/library/LibraryPage.tsx`, which Task L94 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- M35 · medium · components/library/LibraryPage.tsx:286, components/library/ActiveReads.tsx:22
PROBLEM: LibraryPage.tsx:286 renders `{otherInProgress.length >= 1 && <ActiveReads books={otherInProgress} />}`, where otherInProgress = inProgressBooks minus the hero book (LibraryPage.tsx:186-188). But ActiveReads.tsx:22 early-returns null when `books.length < 2`. With exactly two in-progress books: hero shows one, otherInProgress = 1 element, the `>= 1` guard passes, ActiveReads receives a 1-element array and renders nothing. The second active book is omitted from the dedicated 'Pick up where you left off' surface (it still appears in Browse All).
WHY:     Free users are capped at ~2 books, so 'exactly two in progress' is a very common state — precisely those users get a resume section that hides their other active read, hurting the core continue-reading loop.
FIX:     Make the thresholds consistent. Simplest: change ActiveReads.tsx:22 to `if (books.length < 1) return null;` so a single 'other' book renders (the section header 'Pick up where you left off' still reads fine for one card; the grid already uses slice(0,3)). The LibraryPage `>= 1` guard is already correct for this. Confirm the heading copy reads acceptably with a single card.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint components/library/ActiveReads.tsx components/library/LibraryPage.tsx

============ STEP 5 — COMMIT (only after checks pass) ============
git add components/library/ActiveReads.tsx components/library/LibraryPage.tsx
git commit -m "fix(ux): M35 — Library 'Active Reads' silently drops the 2nd in-pro"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE M35: committed on fix/M35 (worktree ../cf-fix-M35). Covered: M35."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/M35 && git worktree remove ../cf-fix-M35 && git branch -d fix/M35"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 54: M38 — Badges page presents an "IP" level/currency derived from badge points the server never grants (diverges from real Insight Points)
**Lead:** `medium` · **Covers:** M38 · **Edits:** `app/book/_lib/flow-points-economy.ts`, `app/book/badges/lib/badge-utils.ts` · context: `app/app/api/book/me/badges/route.ts`, `app/book/badges/components/BadgePageHeader.tsx`, `app/book/badges/components/BadgeSystemCards.tsx` · ⚠ shares a file with Task L25/L28

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/M38 ../cf-fix-M38 audit/prod-readiness-2026-06-14
cd ../cf-fix-M38
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/book/_lib/flow-points-economy.ts, app/book/badges/lib/badge-utils.ts.
- Read-only context (do NOT edit, just read for understanding): app/app/api/book/me/badges/route.ts, app/book/badges/components/BadgePageHeader.tsx, app/book/badges/components/BadgeSystemCards.tsx.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `app/book/_lib/flow-points-economy.ts`, which Task L25/L28 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- M38 · medium · app/book/badges/lib/badge-utils.ts:98-119, app/book/badges/components/BadgePageHeader.tsx:58-62, app/book/badges/components/BadgeSystemCards.tsx:109,209-210,296,393-394, app/app/api/book/me/badges/route.ts:18-21,62-64, app/book/_lib/flow-points-economy.ts:242
PROBLEM: computeProfile sums each earned badge's fpValue into totalFP and runs it through getLevel (badge-utils.ts:104-115). BadgePageHeader renders '{profile.fpToNextLevel} IP to next level' (line 60); BadgeSystemCards labels badges '{flowPoints} IP' (109, 296) and BadgeDetailPanel states '{badge.flowPoints} Insight Points on earn' (393-394); SystemCards even computes totalIP/earnedIP (209-210). But /me/badges is explicitly cosmetic-only — it never logs an IP transaction (route.ts:18-21, 62-64) and validates badgeId server-side. Real, redeemable IP comes from achievement-definitions.ts via achievement-repo.ts (checkAchievementsAfterLoopComplete, confirmed wired), a separate catalog. So the badges-page IP total/level/"on earn" promises do not match the user's real balance shown on /rewards. getAchievementIP (flow-points-economy.ts:242), which reads the UI badge flowPoints, has zero callers (dead).
WHY:     Users are promised 'Insight Points' for badges and shown a badges-page IP total/level that contradicts the real, redeemable balance on /rewards — a confusing economy inconsistency and an implicit broken promise on a live product.
FIX:     Pick one truth. Preferred (a): relabel the badges-page currency as 'Badge Points'/'Prestige' and the detail panel as cosmetic, dropping 'IP'/'Insight Points' framing so it is clearly distinct from the redeemable economy; then delete the dead getAchievementIP. Alternative (b): actually grant the badge flowPoints as IP server-side when a badge is recorded (this would change the trust model — the route's whole point is that badges are client-recordable and therefore must NOT mint IP, so (a) is strongly recommended).

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/book/_lib/flow-points-economy.ts app/book/badges/lib/badge-utils.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/book/_lib/flow-points-economy.ts app/book/badges/lib/badge-utils.ts
git commit -m "fix(data): M38 — Badges page presents an 'IP' level/currency derived "

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE M38: committed on fix/M38 (worktree ../cf-fix-M38). Covered: M38."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/M38 && git worktree remove ../cf-fix-M38 && git branch -d fix/M38"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 55: M39 — Failed reward redemption is shown in a success-styled (accent) banner
**Lead:** `medium` · **Covers:** M39 · **Edits:** `app/book/hooks/useInsightPoints.ts`, `app/rewards/RewardsPageClient.tsx` · ⚠ shares a file with Task P15

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/M39 ../cf-fix-M39 audit/prod-readiness-2026-06-14
cd ../cf-fix-M39
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/book/hooks/useInsightPoints.ts, app/rewards/RewardsPageClient.tsx.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `app/rewards/RewardsPageClient.tsx`, which Task P15 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- M39 · medium · app/book/hooks/useInsightPoints.ts:142-159, app/rewards/RewardsPageClient.tsx:251-264
PROBLEM: redeemReward sets state.redeemMessage to the success payload.message on success (useInsightPoints.ts:145) and to the error string on failure (line 156) — the same field, no tone discriminator (it also returns the error string at 158, but the page renders only the state field). RewardsPageClient renders redeemMessage in one banner styled with cf-accent-border/cf-accent-soft/cf-accent (RewardsPageClient.tsx:258) regardless of tone. A failed redemption (insufficient IP, server error, already-claimed race) therefore appears in the green/accent 'success' palette. Note the load-error path (line 242-247) correctly uses the cf-danger palette with role=alert, so the pattern to mirror already exists.
WHY:     On an economy-adjacent action, redemption failures render as if they succeeded, which can lead users to think a reward was granted when it wasn't.
FIX:     Return/store a tone with the message ({ message, tone: 'error'|'success' }) from redeemReward, and switch the banner to the cf-danger-border/cf-danger-soft/cf-danger palette with role=alert when tone === 'error', mirroring the existing load-error banner.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/book/hooks/useInsightPoints.ts app/rewards/RewardsPageClient.tsx

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/book/hooks/useInsightPoints.ts app/rewards/RewardsPageClient.tsx
git commit -m "fix(ux): M39 — Failed reward redemption is shown in a success-style"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE M39: committed on fix/M39 (worktree ../cf-fix-M39). Covered: M39."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/M39 && git worktree remove ../cf-fix-M39 && git branch -d fix/M39"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 56: M40 — Free-tier book count hardcoded to "2" instead of reading freeBookSlots from the entitlement payload
**Lead:** `medium` · **Covers:** M40 · **Edits:** `app/app/api/book/_lib/env.ts`, `app/app/api/book/me/entitlements/route.ts`, `app/book/hooks/useBookEntitlements.ts`, `app/book/settings/BookSettingsClient.tsx`, `app/book/settings/components/SubscriptionCard.tsx`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/M40 ../cf-fix-M40 audit/prod-readiness-2026-06-14
cd ../cf-fix-M40
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/book/_lib/env.ts, app/app/api/book/me/entitlements/route.ts, app/book/hooks/useBookEntitlements.ts, app/book/settings/BookSettingsClient.tsx, app/book/settings/components/SubscriptionCard.tsx.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- M40 · medium · app/book/settings/components/SubscriptionCard.tsx:155, app/book/settings/BookSettingsClient.tsx:409, app/app/api/book/me/entitlements/route.ts:27,47-48, app/app/api/book/_lib/env.ts:22-27, app/book/hooks/useBookEntitlements.ts:21
PROBLEM: SubscriptionCard renders the literal 'You have access to 2 books.' (SubscriptionCard.tsx:155) and getAccountSummary returns 'Free plan · 2 books' (BookSettingsClient.tsx:409). The real free-slot count is server-driven: the entitlements route returns entitlement.freeBookSlots (entitlements/route.ts:27,47), defaulting to 2 via BOOK_FREE_SLOTS_DEFAULT (env.ts:22-27) but configurable globally and overridable per-user (entitlement.freeBookSlots). The value is present on billingState.payload.entitlement.freeBookSlots (typed at useBookEntitlements.ts:21) but is never passed to SubscriptionCard, so the UI shows a constant 2.
WHY:     Billing/entitlement display can contradict the user's actual access — a guaranteed lie if BOOK_FREE_SLOTS_DEFAULT is ever tuned (e.g. promo to 1 or 3) or any user has a custom freeBookSlots. Trust/clarity problem on the subscription surface, though most users today see the true default of 2.
FIX:     Thread the value through: pass freeBookSlots={billingState.payload?.entitlement.freeBookSlots ?? 2} into <SubscriptionCard> (BookSettingsClient.tsx:1337-1347), render `You have access to {n} book{n === 1 ? '' : 's'}.` at SubscriptionCard.tsx:155, and make getAccountSummary use the same value with pluralization at line 409.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/book/_lib/env.ts app/app/api/book/me/entitlements/route.ts app/book/hooks/useBookEntitlements.ts app/book/settings/BookSettingsClient.tsx app/book/settings/components/SubscriptionCard.tsx

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/book/_lib/env.ts app/app/api/book/me/entitlements/route.ts app/book/hooks/useBookEntitlements.ts app/book/settings/BookSettingsClient.tsx app/book/settings/components/SubscriptionCard.tsx
git commit -m "fix(data): M40 — Free-tier book count hardcoded to '2' instead of rea"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE M40: committed on fix/M40 (worktree ../cf-fix-M40). Covered: M40."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/M40 && git worktree remove ../cf-fix-M40 && git branch -d fix/M40"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 57: M42 — CSV export is vulnerable to formula (CSV) injection on user-controlled fields
**Lead:** `medium` · **Covers:** M42 · **Edits:** `app/book/admin/_clients/SegmentBuilderClient.tsx`, `app/book/admin/_clients/UsersClient.tsx`, `app/book/admin/_components/csv.ts` · context: `app/book/admin/_clients/GeographyClient.tsx` · ⚠ shares a file with Task M43/L83

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/M42 ../cf-fix-M42 audit/prod-readiness-2026-06-14
cd ../cf-fix-M42
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/book/admin/_clients/SegmentBuilderClient.tsx, app/book/admin/_clients/UsersClient.tsx, app/book/admin/_components/csv.ts.
- Read-only context (do NOT edit, just read for understanding): app/book/admin/_clients/GeographyClient.tsx.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `app/book/admin/_clients/SegmentBuilderClient.tsx`, `app/book/admin/_clients/UsersClient.tsx`, `app/book/admin/_components/csv.ts`, which Task M43/L83 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- M42 · medium · app/book/admin/_components/csv.ts:27-34, app/book/admin/_clients/UsersClient.tsx:170-175, app/book/admin/_clients/GeographyClient.tsx:110-115, app/book/admin/_clients/SegmentBuilderClient.tsx:329-334
PROBLEM: downloadCSV's escape() (csv.ts:27-34) only wraps a value in quotes when it contains a comma/quote/newline; it does NOT neutralize spreadsheet formula triggers (= + - @ or leading tab/CR). The exporter handles user-influenced text — most importantly the email field (Users CSV via UsersClient.tsx:170-175, Segment-preview CSV via SegmentBuilderClient.tsx:329-334) and city/country (Geography CSV). When an admin opens such a file in Excel/Sheets, a cell beginning with a formula char executes. This is a legitimate defense-in-depth gap in a shared admin exporter.
WHY:     If an exported text field begins with a formula trigger, formulas/links can execute in an admin's spreadsheet app on open, risking data/credential exfiltration or local code execution against staff. Exploitability is LOWER than the original write-up implies: email is verified by the Cognito IdP (most providers reject addresses starting with = + - @), and Geography city/country are NOT free-text — country comes from CloudFront/Vercel viewer-country headers (2-letter codes) and city from a server-side geo-IP lookup (ip-api.com), so neither is a directly attacker-typed value. The realistic worst case is a crafted display/email value or a future user-controlled export column.
FIX:     In csv.ts escape(), after computing `str`, neutralize leading formula triggers BEFORE the comma/quote/newline quoting, for every cell (data and headers): `if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;` then apply the existing quote-escaping. This is the standard OWASP CSV-injection mitigation and is trivial and centralized.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/book/admin/_clients/SegmentBuilderClient.tsx app/book/admin/_clients/UsersClient.tsx app/book/admin/_components/csv.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/book/admin/_clients/SegmentBuilderClient.tsx app/book/admin/_clients/UsersClient.tsx app/book/admin/_components/csv.ts
git commit -m "fix(security): M42 — CSV export is vulnerable to formula (CSV) injection "

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE M42: committed on fix/M42 (worktree ../cf-fix-M42). Covered: M42."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/M42 && git worktree remove ../cf-fix-M42 && git branch -d fix/M42"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 58: M43 (+1) — Bulk 'Notify segment' sends to thousands with no pre-send count or confirmation
**Lead:** `medium` · **Covers:** M43, P20 · **Edits:** `app/book/admin/_clients/SegmentBuilderClient.tsx`, `app/book/admin/_components/csv.ts` · ⚠ shares a file with Task M42

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 2 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/M43 ../cf-fix-M43 audit/prod-readiness-2026-06-14
cd ../cf-fix-M43
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/book/admin/_clients/SegmentBuilderClient.tsx, app/book/admin/_components/csv.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `app/book/admin/_clients/SegmentBuilderClient.tsx`, `app/book/admin/_components/csv.ts`, which Task M42 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- M43 · medium · app/book/admin/_clients/SegmentBuilderClient.tsx:438-447, app/book/admin/_clients/SegmentBuilderClient.tsx:452-481, app/book/admin/_clients/SegmentBuilderClient.tsx:519-528
PROBLEM: NotifyModal (SegmentBuilderClient.tsx:452-541) lets an admin notify an entire saved segment with one 'Send now' click. It never re-runs the segment to show how many users will be targeted; targetedCount is only revealed AFTER the send via the onSuccess alert() (line 474 -> 444). There is no confirm() guard. The server (segments/[segmentId]/notify/route.ts:51) hard-caps at 5000, but one click can still blast up to 5000 in-app/email notifications. The send button is enabled as soon as title+message are non-empty (line 523).
WHY:     An admin can accidentally spam up to 5000 real users (and trigger SES email volume) with no chance to reconsider; a mistake in the saved segment's filters is irreversible once fired, and the admin is sending blind to the live match count.
FIX:     Reuse the existing /segments/preview endpoint (it already returns matchCount): on modal open, POST the segment.filters to /segments/preview and render 'This will notify N users' prominently. Gate the send() behind a confirm()/inline-confirm that echoes the count, and replace the post-send alert() with the in-page toast pattern used by AdminEventsClient/ScenarioReviewClient. A dedicated count endpoint is unnecessary since preview already provides matchCount.

--- P20 · polish · app/book/admin/_clients/SegmentBuilderClient.tsx:186, app/book/admin/_clients/SegmentBuilderClient.tsx:444, app/book/admin/_components/csv.ts:13
PROBLEM: Segment delete uses window.confirm() (SegmentBuilderClient.tsx:186), notify success uses window.alert() (line 444, via onSuccess), and downloadCSV uses alert('Nothing to export') (csv.ts:13). The rest of the admin surface has a consistent toast + inline-error design system (AdminEventsClient/ScenarioReviewClient toasts, ErrorAlert). Native dialogs are unstyled, not theme/dark-mode aware, and block the main thread.
WHY:     Inconsistent, off-brand feedback on destructive/bulk admin actions; native dialogs ignore design tokens and can be suppressed by the browser's 'prevent additional dialogs' prompt. Polish-level.
FIX:     Replace alert()/confirm() with the existing toast component plus a small inline confirm (the NotifyModal / erase-confirm patterns already in this codebase) for segment delete and the CSV-empty case. This dovetails with finding #2 (the notify pre-send confirm).

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/book/admin/_clients/SegmentBuilderClient.tsx app/book/admin/_components/csv.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/book/admin/_clients/SegmentBuilderClient.tsx app/book/admin/_components/csv.ts
git commit -m "fix(ux): M43, P20 — Bulk 'Notify segment' sends to thousands with no pre"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE M43: committed on fix/M43 (worktree ../cf-fix-M43). Covered: M43, P20."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/M43 && git worktree remove ../cf-fix-M43 && git branch -d fix/M43"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 59: M45 — accentColor, interfaceDensity, focusRingStrength are dead theming plumbing (no CSS consumers, no Settings UI)
**Lead:** `medium` · **Covers:** M45 · **Edits:** `app/_lib/document-theme.ts`, `app/globals.css`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/M45 ../cf-fix-M45 audit/prod-readiness-2026-06-14
cd ../cf-fix-M45
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/_lib/document-theme.ts, app/globals.css.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- M45 · medium · app/_lib/document-theme.ts:149-150, app/_lib/document-theme.ts:153, app/_lib/document-theme.ts:228, app/globals.css
PROBLEM: applyDocumentTheme writes root.dataset.accent / density / focusRing on every load and the inline bootstrap script (buildDocumentThemeBootstrapScript, line 228, run render-blocking in <head>) sets data-accent/data-density/data-focus-ring too; AccentColor/InterfaceDensity/FocusRingStrength are full types with pickers + persistence + merge. But grep of globals.css shows ZERO rules keyed on [data-accent], [data-density], or [data-focus-ring] -- only data-motion, data-color-blind-mode, and data-contrast are consumed. And there is NO Settings UI control that sets accentColor/interfaceDensity/focusRingStrength (the appearance section in BookSettingsClient only sets theme, scheduledDarkMode, reducedMotion; grep for accentColor/interfaceDensity/focusRingStrength setters under app/book/settings returned nothing). :focus-visible uses a fixed outline regardless of focusRingStrength.
WHY:     Maintainability + bundle/perf: render-blocking bootstrap script does extra work writing three DOM attributes nothing reads, plus a latent trap that future code may assume these are wired. Not user-visible today.
FIX:     Pick a direction. To prune (recommended given no UI exists): remove accentColor/interfaceDensity/focusRingStrength from DocumentThemeSettings and DEFAULT_THEME_SETTINGS, drop the dataset writes at document-theme.ts:149-150,153 and the matching branches of buildDocumentThemeBootstrapScript (line 228), and remove the unused picker/persistence paths. To make them real: add [data-accent='emerald'|'amber'|'rose'|'sky']{--accent-cyan:...} overrides, a [data-density] spacing scale, a [data-focus-ring] outline-width scale on :focus-visible, AND the missing Settings controls.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/_lib/document-theme.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/_lib/document-theme.ts app/globals.css
git commit -m "fix(dead-code): M45 — accentColor, interfaceDensity, focusRingStrength are"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE M45: committed on fix/M45 (worktree ../cf-fix-M45). Covered: M45."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/M45 && git worktree remove ../cf-fix-M45 && git branch -d fix/M45"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 60: M46 (+3) — High-contrast mode flattens every semantic border color to one gray via `* !important`
**Lead:** `medium` · **Covers:** M46, M47, L84, P22 · **Edits:** `app/globals.css`, `app/layout.tsx` · context: `app/book/hooks/useBookPreferences.ts`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 4 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/M46 ../cf-fix-M46 audit/prod-readiness-2026-06-14
cd ../cf-fix-M46
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/globals.css, app/layout.tsx.
- Read-only context (do NOT edit, just read for understanding): app/book/hooks/useBookPreferences.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- M46 · medium · app/globals.css:1725-1727
PROBLEM: `html[data-contrast="high"] * { border-color: var(--cf-border) !important; }` overrides border-color on EVERY element with !important. Verified that semantic state classes set border-color: .cf-banner-success (--cf-success-border), .cf-banner-warning, .cf-banner-danger (1053-1069), .cf-pill-info/success/warning/danger (1081-1099), .cf-chip-active (931), and the quiz state classes .cr-answer-correct (border-color var(--cr-success), border-width 2px) / .cr-answer-incorrect (var(--cr-error)) at 1670-1680. The bare `*` rule (outside any @layer) outranks those layered component rules, so for a high-contrast user all of these collapse to the same neutral gray, erasing the color-coded success/error/warning/info affordances.
WHY:     High-contrast mode degrades semantic differentiation for the exact users who need it most: quiz correct vs incorrect and banner danger vs success vs info become visually indistinguishable by border. An a11y regression inside an a11y feature.
FIX:     Drop the blanket `*` border override. The intended neutralization is already achieved by redefining --cf-border/--cf-border-strong at 1709-1724, which every neutral border consumes. If a forced uniform neutral border on generic elements is still wanted, scope it to exclude state classes (`html[data-contrast="high"] *:not(.cf-banner-danger):not(.cf-banner-success):not(.cf-banner-warning):not(.cf-pill-info):not(.cf-pill-success):not(.cf-pill-warning):not(.cf-pill-danger):not(.cr-answer-correct):not(.cr-answer-incorrect):not(.cf-chip-active)`) OR add higher-specificity high-contrast variants for those classes after line 1727 that set border-color to the strong semantic text color (so they get MORE contrast, not less).

--- M47 · medium · app/globals.css:1696-1704, app/layout.tsx:100-116
PROBLEM: For protanopia/deuteranopia/tritanopia, globals.css 1696-1704 sets `html { filter: url(#cf-<mode>) }` referencing feColorMatrix filters defined inline in the root layout (app/layout.tsx:104-115). An SVG url() filter on the root element forces the browser to rasterize and re-filter the entire page on every paint (scroll, animation, hover) -- a well-known heavy GPU/jank source, far costlier than CSS color adjustments. Secondary: a filter on an ancestor makes it the containing block for position:fixed descendants (modal backdrop z-[100], sticky TopNav, fixed mobile nav); on viewport-sized <html> this is usually visually benign but is a fragile coupling.
WHY:     Users who enable a color-vision adjustment get a globally janky, GPU-heavy experience, worst on the animated reader/dashboard (drifting orbs, shimmer, framer transitions) -- the accessibility setting penalizes its target users.
FIX:     Prefer per-token palette swaps for the colorblind modes: define [data-color-blind-mode='deuteranopia']{--accent-emerald:...; --accent-rose:...; --cr-success:...; --cr-error:...} etc. so success/error stay distinguishable without a global raster filter. If the simulation filter must stay, move it off <html> onto a single non-fixed content wrapper (and exclude the portal/fixed layers), document the perf cost, and disable the heavy ambient animations (orbs/shimmer) while a colorblind filter is active.

--- L84 · low · app/globals.css:16-29, app/book/hooks/useBookPreferences.ts:879-884
PROBLEM: globals.css 16-29 declares two @font-face rules for 'OpenDyslexic' with src pointing at https://cdn.jsdelivr.net/npm/open-dyslexic@1.0.3/woff/... (Regular + Bold), unlike Satoshi (self-hosted via next/font/local) and Jakarta/JetBrains (next/font/google, self-hosted at build). useBookPreferences fontMap maps 'opendyslexic' to '"OpenDyslexic", sans-serif' (line 882). When a dyslexic user selects this font, the page fetches woff files cross-origin from jsdelivr; if jsdelivr is blocked (firewall/blockers), slow, or a future font-src 'self' CSP is added, the font silently fails to system sans-serif, and the user's IP/timing leak to a third party precisely when the a11y setting is on.
WHY:     Unreliable accessibility feature on restricted networks; third-party request tied to an a11y feature; a future CSP would break it without an explicit font-src allowlist entry.
FIX:     Self-host OpenDyslexic: add the woff2 files under public/fonts and either declare a local @font-face with a relative src (url('/fonts/OpenDyslexic-Regular.woff2')) or load via next/font/local mirroring Satoshi. Remove the jsdelivr URLs at globals.css:16-29. Verify the woff/woff2 licensing permits redistribution (OpenDyslexic is OFL/Bitstream-Vera-derived, redistributable).

--- P22 · polish · app/globals.css:82-388, app/globals.css:1543-1600
PROBLEM: globals.css carries five overlapping token families that must be kept in sync per theme: shadcn (--card/--primary/... surfaced via `@theme inline` at 82+), semantic (--bg-*/--text-*/--border-*), unified accents (--accent-* -- 56 definitions counted), legacy CF (--cf-* -- 139 definitions counted), and reader (--cr-* -- 38 definitions counted). Many are pure aliases. The file is internally consistent and compiles (no build-breaking classes; Tailwind v4 parenthesis syntax used throughout), so this is consolidation-in-progress, not breakage. But every new color or a third theme must be defined across all relevant families or a surface silently drifts off-brand. (Note: raw def counts here are 56/139/38 for accent/cf/cr; the audit's '~178 total' is in the right ballpark.)
WHY:     Slows and risks any palette change; easy to update one family and miss an alias, producing per-surface color drift. Not user-facing today.
FIX:     Continue the in-progress consolidation: make --accent-*/--bg-*/--text-*/--border-* canonical, redefine --cf-* and --cr-* purely as aliases of the canonical set (most already are), and add a CI guard (extend scripts/ci/scan-style-drift.mjs) that fails if a raw hex is introduced outside the canonical :root / html:not(.dark) blocks. Track the explicitly DEPRECATED aliases for removal once consumers migrate.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/layout.tsx

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/globals.css app/layout.tsx
git commit -m "fix(accessibility): M46, M47, L84, P22 — High-contrast mode flattens every semantic border co"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE M46: committed on fix/M46 (worktree ../cf-fix-M46). Covered: M46, M47, L84, P22."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/M46 && git worktree remove ../cf-fix-M46 && git branch -d fix/M46"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 61: M48 — Multiple divergent copy-pasted ProgressRing implementations (more than the audit found)
**Lead:** `medium` · **Covers:** M48 · **Edits:** `app/book/badges/components/ProgressRing.tsx`, `app/book/library/[bookId]/chapter/[chapterId]/components/QuizPanel.tsx`, `app/book/library/[bookId]/components/ProgressRing.tsx`, `components/library/ProgressRing.tsx`, `components/ui/ProgressRing.tsx`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/M48 ../cf-fix-M48 audit/prod-readiness-2026-06-14
cd ../cf-fix-M48
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/book/badges/components/ProgressRing.tsx, app/book/library/[bookId]/chapter/[chapterId]/components/QuizPanel.tsx, app/book/library/[bookId]/components/ProgressRing.tsx, components/library/ProgressRing.tsx, components/ui/ProgressRing.tsx.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- M48 · medium · components/ui/ProgressRing.tsx, components/library/ProgressRing.tsx, app/book/library/[bookId]/components/ProgressRing.tsx, app/book/badges/components/ProgressRing.tsx, app/book/library/[bookId]/chapter/[chapterId]/components/QuizPanel.tsx:79-120
PROBLEM: Confirmed and slightly worse than reported. components/ui/ProgressRing.tsx is the well-built shared primitive (role=progressbar/ARIA, framer useReducedMotion, parameterized color/track/decorative/ariaLabel). components/library/ProgressRing.tsx correctly wraps it. But TWO live-route reimplementations exist: (1) app/book/library/[bookId]/components/ProgressRing.tsx uses prop `percent`, has role=progressbar, but hardcodes a cyan drop-shadow + delay:0.5 and a hardcoded cyan label color; (2) app/book/badges/components/ProgressRing.tsx uses a DIFFERENT prop name `progress`, is aria-hidden="true" (no progressbar semantics for SR users), hardcodes fillColor '#f59e0b' (off-token amber), and uses a CSS `transition: stroke-dashoffset 0.6s ease` with NO reduced-motion guard (so the in-app data-motion toggle does not stop it; only the OS-media reduced-motion path would, and globals.css does not target this inline style). It is rendered on a live route (BadgePageHeader.tsx:32). The audit MISSED a fifth: an inline ProgressRing in QuizPanel.tsx (79-120) using props correctAnswers/totalQuestions, --cr-success/--cr-error tokens, and again a bare CSS transition (no reduced-motion guard).
WHY:     Copy-paste drift: divergent ARIA (badges ring + QuizPanel ring invisible to or unannounced for screen readers), divergent reduced-motion behavior (two rings ignore the in-app toggle), off-token amber, and 4 separate places to fix any ring bug. Inconsistent visuals across library/badges/reader.
FIX:     Replace app/book/library/[bookId]/components/ProgressRing.tsx and app/book/badges/components/ProgressRing.tsx with imports of components/ui/ProgressRing (it already supports size/strokeWidth/color/trackColor/decorative/ariaLabel and reduced motion). For the badges ring pass color='var(--accent-amber)' and either decorative (if truly decorative) or let it expose progressbar role with an ariaLabel. For QuizPanel's inline ring, either use the shared primitive with color={passed ? 'var(--cr-success)' : 'var(--cr-error)'} and a center children slot, or at minimum add a useReducedMotion guard. Then delete the two duplicate files. Update the badges import (BadgePageHeader) accordingly.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/book/badges/components/ProgressRing.tsx app/book/library/[bookId]/chapter/[chapterId]/components/QuizPanel.tsx app/book/library/[bookId]/components/ProgressRing.tsx components/library/ProgressRing.tsx components/ui/ProgressRing.tsx

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/book/badges/components/ProgressRing.tsx app/book/library/[bookId]/chapter/[chapterId]/components/QuizPanel.tsx app/book/library/[bookId]/components/ProgressRing.tsx components/library/ProgressRing.tsx components/ui/ProgressRing.tsx
git commit -m "fix(maintainability): M48 — Multiple divergent copy-pasted ProgressRing implemen"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE M48: committed on fix/M48 (worktree ../cf-fix-M48). Covered: M48."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/M48 && git worktree remove ../cf-fix-M48 && git branch -d fix/M48"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 62: M49 (+1) — Unused heavy dependencies shipped (aws-sdk v2, pdf-lib, pdfjs-dist) + app-unused openai — 3 of 6 moderate CVEs; bundle-bloat claim overstated
**Lead:** `medium` · **Covers:** M49, L87 · **Edits:** `app/app/api/book/_lib/ai-config.ts`, `package.json` · context: `open-next.config.ts`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 2 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/M49 ../cf-fix-M49 audit/prod-readiness-2026-06-14
cd ../cf-fix-M49
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/book/_lib/ai-config.ts, package.json.
- Read-only context (do NOT edit, just read for understanding): open-next.config.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- M49 · medium · package.json:36, package.json:46, package.json:47, package.json:45, open-next.config.ts:1-17
PROBLEM: Verified: package.json declares aws-sdk@^2.1693.0 (l36), pdf-lib@^1.17.1 (l46), pdfjs-dist@^5.5.207 (l47), openai@^6.34.0 (l45). git grep across app/, lib/, components/, *.ts/*.tsx shows ZERO imports of aws-sdk, pdf-lib, or pdfjs-dist (only @aws-sdk/* v3 modular clients are used). openai is imported ONLY by scripts/book/.../providers/openai-api.ts (the out-of-scope content pipeline). aws-sdk 2.1693.0 and pdf-lib are confirmed installed in package-lock. `npm audit --omit=dev` returns exactly 6 moderate; aws-sdk contributes 2 of them (region-injection + its transitive uuid buffer-bounds). So the unused-dep and CVE-attribution claims are accurate.
WHY:     Carrying known-vulnerable, never-imported code (aws-sdk v2 region-injection, transitive uuid bounds) in the dependency tree; persistent npm audit/Dependabot noise that can mask future real advisories; extra node_modules install/CI weight. NOT a meaningful production Lambda cold-start cost (see verifyNotes).
FIX:     Remove aws-sdk, pdf-lib, pdfjs-dist from package.json dependencies and run npm install; re-run `npm audit --omit=dev` to confirm 6→~4 (remaining moderate: @anthropic-ai/sdk, next→postcss, geist→next, and possibly a now-orphaned uuid if pulled elsewhere). Verify `npm run build` + `npx open-next build` still pass (they will — nothing imports these). Do NOT remove openai from THIS package.json without checking whether scripts/book (the pipeline) resolves it from this same root node_modules — it is imported by scripts/book/.../providers/openai-api.ts, so dropping it could break the (out-of-scope) pipeline; if the pipeline shares this manifest, leave openai or move it to a pipeline-local package.

--- L87 · low · package.json:21, app/app/api/book/_lib/ai-config.ts:76-80
PROBLEM: Verified: package.json:21 pins @anthropic-ai/sdk@^0.88.0. npm audit reports it moderate (GHSA-p7fg-763f-g4gf, insecure default file permissions in the local-filesystem memory tool) with affected range 0.79.0–0.91.0 and fixAvailable 0.104.1. The SDK IS used by the app: ai-config.ts:77 lazily `await import('@anthropic-ai/sdk')` and call sites use client.messages.create (ai-service.ts:57) and client.messages.stream (ai-service.ts:108, ask/route.ts:235). The memory-tool surface is not exercised by these call sites, so direct risk is low.
WHY:     Low direct exposure (memory tool unused), but keeps a flagged dep in every audit, masking future advisories. Mostly audit-cleanliness.
FIX:     Bump @anthropic-ai/sdk to ^0.104.1 in package.json:21, npm install, then run the unit tests + typecheck. NOTE (correction to original): npm reports fixAvailable.isSemVerMajor=true (0.88→0.104 crosses the 0.x minor-as-major boundary), so this is NOT 'non-breaking-ish' — treat it as a major bump and re-verify the messages.create/messages.stream call sites in ai-service.ts and the ask/feedback/scenario routes compile and stream correctly before merging.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/book/_lib/ai-config.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/book/_lib/ai-config.ts package.json
git commit -m "fix(ops): M49, L87 — Unused heavy dependencies shipped (aws-sdk v2, pdf-l"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE M49: committed on fix/M49 (worktree ../cf-fix-M49). Covered: M49, L87."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/M49 && git worktree remove ../cf-fix-M49 && git branch -d fix/M49"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 63: M50 — Static JSON book-package imports against a directory with untracked files — latent CI build-break trap (does not currently reproduce)
**Lead:** `medium` · **Covers:** M50 · **Edits:** `app/book/data/bookPackages.ts`, `book-packages/pmbok-guide.v21.json`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/M50 ../cf-fix-M50 audit/prod-readiness-2026-06-14
cd ../cf-fix-M50
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/book/data/bookPackages.ts, book-packages/pmbok-guide.v21.json.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- M50 · medium · app/book/data/bookPackages.ts:1-68, book-packages/pmbok-guide.v21.json
PROBLEM: Verified: bookPackages.ts statically imports 68 distinct @/book-packages/*.v21.json files (tsconfig resolveJsonModule + moduleResolution bundler resolve them at build). Diffed the 68 imported names against `git ls-files book-packages/` (107 tracked): every imported file IS tracked, so CI is green today. The working tree contains an untracked stray (book-packages/pmbok-guide.v21.json, per git status). bookPackages.ts is NOT dead — it is consumed by production paths (content-service.ts, ask/quiz/audio routes, useQuizSession.ts, v21-adapter.ts, bookChapters.ts). The CI app-checks job runs typecheck + next build, so a new import of an untracked package would fail there (TS2307), but only after merge attempt and with an opaque module-not-found error.
WHY:     Future CI red / blocked merges with an opaque 'Cannot find module @/book-packages/<x>.v21.json' whenever a contributor wires up a new bundled book whose JSON they forgot to `git add`. No current production break.
FIX:     Prefer a build-time-generated manifest: replace the 68 hand-written imports with a generated index sourced from `git ls-files book-packages/*.v21.json` so the import set can never reference an untracked file. Cheaper interim: add a CI/pre-commit check asserting every @/book-packages/* import in bookPackages.ts resolves to a git-tracked file (mirrors the existing scan-* tooling pattern). Immediately: commit or delete the stray book-packages/pmbok-guide.v21.json to shrink the untracked surface.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/book/data/bookPackages.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/book/data/bookPackages.ts book-packages/pmbok-guide.v21.json
git commit -m "fix(maintainability): M50 — Static JSON book-package imports against a directory"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE M50: committed on fix/M50 (worktree ../cf-fix-M50). Covered: M50."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/M50 && git worktree remove ../cf-fix-M50 && git branch -d fix/M50"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 64: M51 (+2) — E2E CI gate only smoke-tests the Turbopack dev build with auth bypassed — never exercises the production artifact or real-data/error paths
**Lead:** `medium` · **Covers:** M51, L89, L91 · **Edits:** `.github/workflows/_deploy-app.yml`, `.github/workflows/ci.yml`, `e2e/smoke.spec.ts`, `eslint.config.mjs`, `next.config.ts`, `playwright.config.ts` · context: `app/app/api/_lib/server-env.ts` · ⚠ shares a file with Task H28

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 3 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/M51 ../cf-fix-M51 audit/prod-readiness-2026-06-14
cd ../cf-fix-M51
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: .github/workflows/_deploy-app.yml, .github/workflows/ci.yml, e2e/smoke.spec.ts, eslint.config.mjs, next.config.ts, playwright.config.ts.
- Read-only context (do NOT edit, just read for understanding): app/app/api/_lib/server-env.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `next.config.ts`, which Task H28 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- M51 · medium · .github/workflows/ci.yml:59-95, playwright.config.ts:23-30, e2e/smoke.spec.ts:44-57
PROBLEM: Verified: the e2e job (ci.yml:59-95) runs `npm run test:e2e`, whose playwright.config.ts webServer command is `npm run dev` (l24) — the Turbopack DEV server with DEV_AUTH_BYPASS=1 + NEXT_DIST_DIR=.next-chapterflow (from the dev script), NOT `next start` on the prod build. The job intentionally omits BOOK_TABLE_NAME/Cognito (ci.yml:64-69), so the smoke spec validates routes only in dev-bypass mode with no data plane. The spec (smoke.spec.ts) asserts public pages render and the authed shell (/dashboard, /book, /book/library, /book/progress) renders without an error overlay and is non-blank — all under auth-bypass. The prod bundle IS built by app-checks (next build + open-next build) but never browser-driven pre-deploy; real-auth bounce and DynamoDB-backed pages are never smoke-tested in CI. The deploy health gate curls /, /pricing, /api/health (HTTP status only, post-deploy).
WHY:     Prod-build-only crashes, dev-vs-prod hydration mismatches, auth-required redirect loops, and data-page 500s can pass all of CI and surface only at the post-deploy health gate or to users. The smoke suite gives false confidence that the authed shell works when it's only verified with auth bypassed and no DB.
FIX:     Add a second Playwright project/job against the production server: `next build` (NEXT_DIST_DIR set) then `next start`, with DEV_AUTH_BYPASS unset, asserting at least the unauthenticated→/auth/login bounce explicitly (and, with a disposable test backend, a data-backed page). Keep the fast dev-bypass smoke for shell coverage. At minimum, document in ci.yml that the e2e gate is dev-mode-only so it isn't mistaken for prod-build coverage.

--- L89 · low · .github/workflows/ci.yml:97-138, eslint.config.mjs:8-14, next.config.ts
PROBLEM: Verified: the lint job is continue-on-error: true (ci.yml:106) with an inline `exit 0` (l138) and a comment instructing it be kept OUT of required branch-protection checks (l98-101). next.config.ts has no eslint block, and Next 16 `next build` does not run ESLint by default (no `next lint` in CI; the build step is just `npm run build`). So ESLint never blocks anything. eslint.config.mjs:9-13 additionally disables react-hooks/set-state-in-effect for the whole app/book/** tree. The style-drift and secret scans ARE hard gates, but JS/TS correctness lint (exhaustive-deps, no-unused, no-floating-promises) is purely informational.
WHY:     Correctness-class lint regressions (missing effect deps, floating promises, unused error handlers) ship without resistance; the lint-debt baseline can grow indefinitely since nothing enforces 'no NEW errors'.
FIX:     Adopt a ratcheting gate mirroring the repo's existing baseline model (scan-style-drift's allowlist): snapshot current ESLint errors into a committed baseline count and add a blocking CI step that fails only on NEW errors (eslint --max-warnings tied to the baseline, or a diff-against-baseline). This blocks new debt without forcing a big-bang cleanup.

--- L91 · low · .github/workflows/ci.yml:19-25, .github/workflows/_deploy-app.yml:131-185, app/app/api/_lib/server-env.ts
PROBLEM: Verified: app-checks injects COGNITO_REGION/COGNITO_USER_POOL_ID/BOOK_TABLE_NAME placeholders (ci.yml:23-25) 'so server modules that read config don't throw during next build.' Reasonable for a build, but it means a NEW required var (mustServerEnv'd but not module-init-read) still builds green. There is no committed .env.example (only an untracked .env.local; git ls-files shows no tracked .env) to machine-check the contract against. The deploy health gate (_deploy-app.yml:131-163) is BLOCKING but checks only HTTP status of /, /pricing, /api/health; the deep readiness smoke (l170-185, /api/health?deep=1) is continue-on-error and the endpoint always returns 200, so a degraded auth/billing/content dependency is surfaced but never fails the deploy — including for prod. Launch-blockers like CHAPTERFLOW_APP_BASE_URL, AUTH_STATE_SECRET length, VAPID/email SSM params are not asserted by any blocking gate.
WHY:     A new hard-required env var or a typo in the deploy secret list passes CI and only fails at prod deploy time; several documented launch-blockers fail soft (degraded auth/billing/content) and can reach live users without stopping the deploy.
FIX:     Add a committed .env.example enumerating every ENVIRONMENT.md var with required/optional markers, plus a small CI/script check that asserts the contract. Most impactful: make prod readiness fail loud — for inputs.environment=='prod', promote the deep /api/health?deep=1 readiness step (_deploy-app.yml:170-185) from continue-on-error to blocking (and/or have the deep endpoint return non-200 when a critical dependency is degraded), so a broken auth/billing/content dependency stops the prod deploy instead of merely being tabled.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint e2e/smoke.spec.ts next.config.ts playwright.config.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add .github/workflows/_deploy-app.yml .github/workflows/ci.yml e2e/smoke.spec.ts eslint.config.mjs next.config.ts playwright.config.ts
git commit -m "fix(ops): M51, L89, L91 — E2E CI gate only smoke-tests the Turbopack dev build"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE M51: committed on fix/M51 (worktree ../cf-fix-M51). Covered: M51, L89, L91."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/M51 && git worktree remove ../cf-fix-M51 && git branch -d fix/M51"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 65: M52 — Badges page blanks out on a dashboard API failure
**Lead:** `medium` · **Covers:** M52 · **Edits:** `app/book/badges/BookBadgesClient.tsx`, `app/book/hooks/useBookAnalytics.ts` · context: `app/book/hooks/useBadgeSystem.ts` · ⚠ shares a file with Task H29

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/M52 ../cf-fix-M52 audit/prod-readiness-2026-06-14
cd ../cf-fix-M52
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/book/badges/BookBadgesClient.tsx, app/book/hooks/useBookAnalytics.ts.
- Read-only context (do NOT edit, just read for understanding): app/book/hooks/useBadgeSystem.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `app/book/hooks/useBookAnalytics.ts`, which Task H29 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- M52 · medium · app/book/badges/BookBadgesClient.tsx:191, app/book/badges/BookBadgesClient.tsx:63-66, app/book/hooks/useBadgeSystem.ts:423, app/book/hooks/useBadgeSystem.ts:475-487, app/book/hooks/useBookAnalytics.ts:822-833
PROBLEM: When GET /app/api/book/me/dashboard fails, useBookAnalytics's catch sets hydrated=true while leaving analytics=null (useBookAnalytics.ts:830-832). useBadgeSystem destructures only { analytics, hydrated } (line 423) and its badgeStats useMemo returns null when !analytics (lines 475-476), so badges resolves to []. BookBadgesClient's only loading/blocking gate is `if (!onboardingHydrated || !badgeSystem.hydrated || !onboarding.setupComplete)` (line 191) — it does not check analytics or any error — so on failure it falls through and renders the full page with an empty BadgeShowcase/BadgeGrid/Recommendations and a 0/0 header, with no error message and no retry. The user must manually reload.
WHY:     A transient dashboard 401/500 produces a fully-rendered but empty/broken badges page (0 of 0 earned, empty catalog) that misrepresents the account as having no badges, with no in-app recovery affordance.
FIX:     Plumb error+refetch through the hook: useBadgeSystem already calls useBookAnalytics — also pull { error, refetch } there and add them to UseBadgeSystemResult (the hook currently returns only hydrated/analytics at lines 587-603). Then in BookBadgesClient, after the loading gate, add `if (badgeSystem.error && !badgeSystem.analytics) return <ErrorBanner title="We couldn’t load your badges" message={badgeSystem.error} onRetry={badgeSystem.refetch} />` inside the page shell (TopNav + section), reusing app/book/components/ui/ErrorBanner.tsx. This mirrors WorkspacePage.tsx (`error && !data` -> ErrorBanner with onRetry={refetch}). Prefer refetch over window.location.reload() so the badge /me/badges GET and event fetch aren't needlessly re-run from scratch.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/book/badges/BookBadgesClient.tsx app/book/hooks/useBookAnalytics.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/book/badges/BookBadgesClient.tsx app/book/hooks/useBookAnalytics.ts
git commit -m "fix(ux): M52 — Badges page blanks out on a dashboard API failure"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE M52: committed on fix/M52 (worktree ../cf-fix-M52). Covered: M52."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/M52 && git worktree remove ../cf-fix-M52 && git branch -d fix/M52"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 66: L1 — /auth/login throws an unhandled 500 (raw Next error page) when Cognito env is missing; the friendly 500 guard below it is dead code
**Lead:** `low` · **Covers:** L1 · **Edits:** `app/auth/login/route.ts`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L1 ../cf-fix-L1 audit/prod-readiness-2026-06-14
cd ../cf-fix-L1
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/auth/login/route.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- L1 · low · app/auth/login/route.ts:71, app/auth/login/route.ts:72, app/auth/login/route.ts:73, app/auth/login/route.ts:75
PROBLEM: login:71-73 call resolveCognitoDomain() and two mustServerEnv(...) with NO try/catch. mustServerEnv throws 'Missing env var: …' when COGNITO_DOMAIN/COGNITO_CLIENT_ID/COGNITO_REDIRECT_URI are unset, so a misconfigured deploy yields an unhandled exception → generic Next 500 on the primary sign-in entry point. The `if (!domain || !clientId || !redirectUri) return 500` guard at login:75-77 can never run because the throw at 71-73 happens first — confirmed dead. Contrast callback/route.ts which correctly wraps everything in try/catch and redirects to /?auth=server_error (callback:70,193-198).
WHY:     If a required Cognito env var is missing/typo'd at launch, every user hitting Sign in gets an opaque 500 instead of a graceful redirect, and the unreachable guard misleads reviewers into thinking it's handled.
FIX:     Wrap the body of GET (after the resolvePublicOrigin call so `origin` is available) in try/catch mirroring the callback: on error console.error and `return NextResponse.redirect(new URL('/?auth=server_error', origin))`. Then delete the unreachable login:75-77 guard. Note the deleted-account early-return at login:58-69 also calls getAuthCookieBase but not Cognito env, so it stays correct inside the try.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/auth/login/route.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/auth/login/route.ts
git commit -m "fix(ops): L1 — /auth/login throws an unhandled 500 (raw Next error "

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L1: committed on fix/L1 (worktree ../cf-fix-L1). Covered: L1."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L1 && git worktree remove ../cf-fix-L1 && git branch -d fix/L1"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 67: L2 (+1) — /auth/refresh parses Cognito's token response with un-guarded await tokenRes.json() — a non-JSON 200 surfaces as an uncaught 500
**Lead:** `low` · **Covers:** L2, L3 · **Edits:** `app/auth/refresh/route.ts` · context: `app/auth/callback/route.ts` · ⚠ shares a file with Task H20

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 2 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L2 ../cf-fix-L2 audit/prod-readiness-2026-06-14
cd ../cf-fix-L2
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/auth/refresh/route.ts.
- Read-only context (do NOT edit, just read for understanding): app/auth/callback/route.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `app/auth/refresh/route.ts`, which Task H20 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- L2 · low · app/auth/refresh/route.ts:89
PROBLEM: The fetch to /oauth2/token is wrapped (refresh:62-78) and !tokenRes.ok is handled (refresh:80-87), but `const tokens = (await tokenRes.json())` at refresh:89 is outside any try/catch. If Cognito or an intervening proxy/WAF returns HTTP 200 with a non-JSON body (e.g. an HTML error/maintenance page during a partial outage), .json() rejects and the route throws → unhandled 500. TokenExpiryGuard treats non-401/non-ok as transient and retries (TokenExpiryGuard:78,86-91), so it self-heals, but the endpoint should return a clean 5xx, not crash.
WHY:     During a Cognito/edge hiccup returning a 200 non-JSON body, the silent-renewal endpoint 500s instead of a clean 502; noisy errors and a marginally worse retry posture, no session loss.
FIX:     Wrap refresh:89 in try/catch: `let tokens: Record<string,unknown>; try { tokens = (await tokenRes.json()) as Record<string,unknown>; } catch { return NextResponse.json({ ok:false, error:'bad_upstream_body' }, { status:502 }); }`. The callback has the identical un-guarded json() at callback:119 but that one IS inside the route-level try/catch (callback:70-198) so it lands on /?auth=server_error — refresh has no such outer wrapper, hence the exposure is real only here.

--- L3 · low · app/auth/refresh/route.ts:47, app/auth/callback/route.ts:107
PROBLEM: grep -ri 'rate.?limit|throttle' across app/auth returns nothing (confirmed, exit 1). /auth/refresh POSTs the httpOnly refresh_token to Cognito's token endpoint on every call with no app-level limiter. Because the auth cookies are SameSite=lax, a cross-site fetch can't drive this, but a misbehaving/looping first-party client can hammer Cognito's token endpoint and burn quota/cost. The book API has a sophisticated abuse module (app/app/api/book/_lib/abuse.ts) but it is DynamoDB-velocity-based for free-unlock fraud, not a generic per-IP request limiter, so there is no off-the-shelf throttle to drop in here.
WHY:     Low: Cognito enforces its own throttling and the refresh_token is httpOnly (no JS exfiltration). But the app exposes a cookie-only amplification path to Cognito with zero local guard.
FIX:     Add a lightweight per-device-id / per-IP limiter around POST /auth/refresh (a few attempts per minute → 429). getOrCreateDeviceId(req) from abuse.ts gives a stable device key; readIp logic there can be reused. Note the original fix's claim that abuse.ts is 'already imported in callback' is only half-right — callback imports getOrCreateDeviceId/applyDeviceIdCookie, not a rate limiter, and refresh imports neither; a new minimal limiter (even in-memory per-instance) is the realistic change. TokenExpiryGuard already self-throttles (RETRY_COOLDOWN 30s, TokenExpiryGuard:11), so a generous cap won't hit legit clients.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/auth/refresh/route.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/auth/refresh/route.ts
git commit -m "fix(correctness): L2, L3 — /auth/refresh parses Cognito's token response with u"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L2: committed on fix/L2 (worktree ../cf-fix-L2). Covered: L2, L3."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L2 && git worktree remove ../cf-fix-L2 && git branch -d fix/L2"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 68: L4 (+2) — Two parallel design-token systems split across the auth components (--cf-* vs --accent-amber/--bg-elevated/--text-*)
**Lead:** `low` · **Covers:** L4, L60, L61 · **Edits:** `components/auth/AuthErrorBanner.tsx` · context: `components/auth/AuthScreen.tsx`, `components/auth/TokenExpiryGuard.tsx`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 3 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L4 ../cf-fix-L4 audit/prod-readiness-2026-06-14
cd ../cf-fix-L4
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: components/auth/AuthErrorBanner.tsx.
- Read-only context (do NOT edit, just read for understanding): components/auth/AuthScreen.tsx, components/auth/TokenExpiryGuard.tsx.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- L4 · low · components/auth/AuthErrorBanner.tsx:47, components/auth/AuthErrorBanner.tsx:54, components/auth/AuthErrorBanner.tsx:67, components/auth/TokenExpiryGuard.tsx:150, components/auth/AuthScreen.tsx:16
PROBLEM: Confirmed namespace drift: TokenExpiryGuard/AuthScreen/signup use --cf-* (--cf-surface, --cf-border-strong, --cf-text-1/2/3, --cf-accent, --cf-warning-text, --cf-shadow-lg — all defined in globals.css), while AuthErrorBanner uses the legacy namespace (--accent-amber, --bg-elevated, --border-subtle, --shadow-card, --text-secondary/-muted/-heading — also all defined). Nothing is broken. HOWEVER, the finding's central impact claim — that the two banners are 'co-located … rendering side-by-side surfaces' and 'won't look like siblings' — is REFUTED by render-site verification: AuthErrorBanner is mounted ONLY on the landing page (app/page.tsx:129); TokenExpiryGuard is mounted ONLY in app/book/layout.tsx:34 and app/dashboard/layout.tsx:11. They never appear on the same page, so there is no side-by-side visual mismatch.
WHY:     Real but lower than stated: pure maintenance drift (a theme tweak in one namespace silently won't carry to the other). No co-located visual inconsistency exists because the two components render on disjoint surfaces.
FIX:     Port AuthErrorBanner.tsx to --cf-*: --bg-elevated→--cf-surface, --border-subtle→--cf-border, --shadow-card→--cf-shadow-lg, --text-secondary→--cf-text-2, --text-muted→--cf-text-3, --text-heading→--cf-text-1, --accent-amber→--cf-warning-text. All target tokens verified present in globals.css (light+dark). This is a repo-wide drift (per the UI-audit memory: 5 token systems), so treat as a small consistency pass, not a visual-bug fix.

--- L60 · low · components/auth/AuthErrorBanner.tsx:15,36-39,68-73
PROBLEM: RETRY_URL is the literal '/auth/login?returnTo=%2Fbook' (line 15) and the 'Try again' link uses it verbatim (68-69), so an auth error during a deep-link flow retries toward /book, losing the original destination. handleDismiss does router.replace('/', {scroll:false}) (38), which navigates to root and strips ALL query params (returnTo, utm_*, etc.) rather than just clearing the auth flag.
WHY:     An auth hiccup mid-deep-link sends the user to the generic dashboard on retry and discards attribution params on dismiss. Minor UX/attribution loss.
FIX:     Build RETRY_URL dynamically from the preserved returnTo: `/auth/login?returnTo=${encodeURIComponent(searchParams.get('returnTo') || '/book')}`. On dismiss, rebuild the current URL with only the `auth` param removed (e.g. new URLSearchParams(searchParams); delete('auth'); router.replace(`${pathname}?${params}`)) instead of replacing with '/'. NOTE the two-part dependency: the callback error redirects are /?auth=error|token_error|server_error and currently do NOT carry returnTo (callback/route.ts:80,116,125,197), so for the retry to actually preserve the destination the callback must also append returnTo to its error redirects (it has returnTo in scope at lines 85/94).

--- L61 · low · components/auth/AuthErrorBanner.tsx:47-91, components/auth/TokenExpiryGuard.tsx, components/auth/AuthScreen.tsx
PROBLEM: AuthErrorBanner styles with legacy tokens (--border-subtle, --bg-elevated, --accent-amber, --text-secondary, --text-muted, --text-heading, --shadow-card). AuthScreen uses --cf-page-bg/--cf-accent-muted; TokenExpiryGuard uses --cf-surface/--cf-border-strong/--cf-shadow-lg/--cf-warning-text/--cf-text-1/2/3/--cf-accent; signup/pair-accept use --cf-*. Both token sets exist in globals.css so it renders, but the banner can visually diverge from the sibling session banner and is copy-paste drift.
WHY:     Two competing token systems on adjacent auth components risk visual inconsistency (amber accent, surface/shadow) and make theme changes error-prone.
FIX:     Port AuthErrorBanner to --cf-* tokens matching TokenExpiryGuard: --bg-elevated->--cf-surface, --border-subtle->--cf-border-strong (or --cf-border), --shadow-card->--cf-shadow-lg, --accent-amber->--cf-warning-text (or --cf-accent), --text-secondary/--text-muted/--text-heading->--cf-text-2/3/1.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint components/auth/AuthErrorBanner.tsx

============ STEP 5 — COMMIT (only after checks pass) ============
git add components/auth/AuthErrorBanner.tsx
git commit -m "fix(maintainability): L4, L60, L61 — Two parallel design-token systems split across the a"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L4: committed on fix/L4 (worktree ../cf-fix-L4). Covered: L4, L60, L61."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L4 && git worktree remove ../cf-fix-L4 && git branch -d fix/L4"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 69: L8 — /api/auth/session and /api/me cannot distinguish 'logged out' from 'Cognito/JWKS temporarily unverifiable', so a verification outage shows users as logged out
**Lead:** `low` · **Covers:** L8 · **Edits:** `app/app/api/_lib/auth.ts`, `app/app/api/auth/session/route.ts`, `app/app/api/me/route.ts` · ⚠ shares a file with Task M1

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L8 ../cf-fix-L8 audit/prod-readiness-2026-06-14
cd ../cf-fix-L8
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/_lib/auth.ts, app/app/api/auth/session/route.ts, app/app/api/me/route.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `app/app/api/_lib/auth.ts`, which Task M1 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- L8 · low · app/app/api/_lib/auth.ts:72, app/app/api/_lib/auth.ts:73, app/app/api/_lib/auth.ts:75, app/app/api/auth/session/route.ts:18, app/app/api/me/route.ts:16
PROBLEM: requireUser() wraps jwtVerify in try/catch and throws AuthError('INVALID_TOKEN') for ANY failure (auth.ts:72-75), conflating 'token invalid/expired' with 'couldn't reach/parse the JWKS' (transport error on a cold/uncached kid). session/route.ts catches everything and returns {loggedIn:false} status 200 (session/route:18-19); me/route.ts returns {authenticated:false} 401 for AuthError (me/route:17-18). useAuthStatus then treats !res.ok OR loggedIn!==true as logged-out (useAuthStatus:20,25,35). So during a JWKS hiccup affecting an uncached key, a genuinely-logged-in user's Navbar/Pricing flips to logged-out. Real but bounded: jose's createRemoteJWKSet (auth.ts:32) caches keys (~10min) with a cooldown, so warm instances keep verifying even if the endpoint blips; exposure is cold starts + key-rotation windows. The getAuthConfig promise-cache nulls on failure (auth.ts:38-40) so config errors retry, but a per-verify JWKS fetch failure still surfaces as INVALID_TOKEN.
WHY:     Low, mostly cold-start bounded: during a Cognito JWKS hiccup on an uncached key, logged-in users momentarily see logged-out UI / spurious 401s, possibly prompting needless re-logins.
FIX:     In auth.ts distinguish the failure class: jose throws JWKSNoMatchingKey / JWTExpired / JWSSignatureVerificationFailed (genuine invalid) vs fetch/transport errors when retrieving JWKS (transient). Inspect the caught error (err.code / err.name / instanceof) and throw a distinct AuthError('VERIFIER_UNAVAILABLE'); have /api/me return 503 for that case (not 401) and have useAuthStatus NOT set loggedIn=false on 5xx (retry instead). /api/auth/session could return a third state ('unknown') or simply omit the flip on 5xx. Note this widens the AuthError union (currently 'UNAUTHENTICATED'|'INVALID_TOKEN' at auth.ts:8).

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/_lib/auth.ts app/app/api/auth/session/route.ts app/app/api/me/route.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/_lib/auth.ts app/app/api/auth/session/route.ts app/app/api/me/route.ts
git commit -m "fix(ops): L8 — /api/auth/session and /api/me cannot distinguish 'lo"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L8: committed on fix/L8 (worktree ../cf-fix-L8). Covered: L8."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L8 && git worktree remove ../cf-fix-L8 && git branch -d fix/L8"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 70: L9 — logout() relies on Cognito to reject an attacker-supplied returnTo; redundant cookieStore.delete() calls are no-ops for domain-scoped cookies
**Lead:** `low` · **Covers:** L9 · **Edits:** `app/auth/logout/route.ts`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L9 ../cf-fix-L9 audit/prod-readiness-2026-06-14
cd ../cf-fix-L9
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/auth/logout/route.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- L9 · low · app/auth/logout/route.ts:18, app/auth/logout/route.ts:22, app/auth/logout/route.ts:34
PROBLEM: Two sub-claims. (1) Open-redirect: logout builds logout_uri = sanitizeReturnTo(returnTo, logoutRedirect) (logout:22-31). sanitizeReturnTo only allows absolute URLs whose origin is in allowedOrigins(), else falls back to logoutRedirect (an absolute external URL) — so an off-allowlist returnTo is already neutralized server-side BEFORE Cognito ever sees it. The finding's framing that protection 'relies on Cognito' is thus overstated: the app's own sanitizeReturnTo is the primary gate and Cognito's sign-out-URL allowlist is defense-in-depth. NOT exploitable today — refuting the 'relies on Cognito' premise but the residual defense-in-depth point holds. (2) Cookie deletes: cookieStore.delete() (logout:18-21) does NOT carry the cookie domain attribute. When AUTH_COOKIE_DOMAIN is configured in prod (auth-cookie.ts:17-21,25; wired conditionally in infra/bin/app.ts:127-128), the auth cookies are set with Domain=.<host>, and a browser will NOT clear a domain-scoped cookie via a Set-Cookie that omits Domain — so those delete() calls are no-ops in that config. The res.cookies.set('', maxAge:0) calls (logout:34-37) DO include the domain via getAuthCookieBase(), so they are what actually clears the cookies. Confirmed redundancy.
WHY:     No exploitable open redirect (double-gated, app-side sanitize is primary). The four cookieStore.delete() calls are dead/ineffective whenever a cookie domain is configured and could mislead a reader into thinking deletion happens there.
FIX:     Remove the four cookieStore.delete() calls (logout:18-21); the res.cookies.set(maxAge:0) lines (logout:34-37) already clear with the correct domain. Optionally tighten logout returnTo to internal paths only (isSafeInternalPath) since legitimate post-logout targets are app pages — but note logoutRedirect itself is an absolute external URL fallback, so a pure-internal constraint would need the fallback handled separately. Keep the sanitizeReturnTo gate.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/auth/logout/route.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/auth/logout/route.ts
git commit -m "fix(security): L9 — logout() relies on Cognito to reject an attacker-sup"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L9: committed on fix/L9 (worktree ../cf-fix-L9). Covered: L9."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L9 && git worktree remove ../cf-fix-L9 && git branch -d fix/L9"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 71: L10 (+4) — invoice.payment_failed records the wrong Stripe field as the failure reason — admin sees generic "payment_failed" not the decline code
**Lead:** `low` · **Covers:** L10, L11, L12, L13, L14 · **Edits:** `app/app/api/book/_lib/keys.ts`, `app/app/api/book/_lib/repo.ts`, `app/app/api/book/_lib/trial-ending-email.ts`, `app/app/api/book/admin/metrics/billing/route.ts`, `app/app/api/book/billing/webhook/route.ts` · ⚠ shares a file with Task L34/L17/H1/X1/H8

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 5 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L10 ../cf-fix-L10 audit/prod-readiness-2026-06-14
cd ../cf-fix-L10
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/book/_lib/keys.ts, app/app/api/book/_lib/repo.ts, app/app/api/book/_lib/trial-ending-email.ts, app/app/api/book/admin/metrics/billing/route.ts, app/app/api/book/billing/webhook/route.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `app/app/api/book/_lib/keys.ts`, `app/app/api/book/_lib/trial-ending-email.ts`, `app/app/api/book/admin/metrics/billing/route.ts`, `app/app/api/book/billing/webhook/route.ts`, which Task L34/L17/H1/X1/H8 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- L10 · low · app/app/api/book/billing/webhook/route.ts:259-283, app/app/api/book/admin/metrics/billing/route.ts:121-124
PROBLEM: The handler types the invoice with last_finalization_error (route.ts:263) and writes failedPaymentLastReason = invoice.last_finalization_error?.code ?? 'payment_failed' (lines 281-282). Per the Stripe SDK type docstring (node_modules/stripe/types/Invoices.d.ts:293-296), last_finalization_error is 'The error encountered during the previous attempt to finalize the invoice. This field is cleared when the invoice is successfully finalized' — i.e. invoice-finalization failures, a distinct and rare category. The actual card-decline reason (card_declined, insufficient_funds, expired_card) lives on the associated PaymentIntent's last_payment_error.code (PaymentIntents.d.ts), not on the invoice object unless expanded. So in normal card-decline cases the field is undefined and falls back to the literal 'payment_failed'. The admin billing route counts past_due users gated on failedPaymentLastReason (billing/route.ts:122-124) and would surface 'payment_failed' for all of them.
WHY:     Admin payment-failure intelligence cannot distinguish a declined card from insufficient funds, so dunning/outreach can't be targeted. Admin-only; no user-facing impact.
FIX:     In the invoice.payment_failed branch, read the decline reason from the PaymentIntent. With apiVersion 2024-06-20 the invoice still exposes a top-level payment_intent field (Invoices.d.ts:783), so either fetch the invoice with expand:['payment_intent'] or stripe.invoices.retrieve / paymentIntents.retrieve and use paymentIntent.last_payment_error?.code, falling back to last_finalization_error?.code then 'payment_failed'. This mirrors how invoice.paid already retrieves the charge for billing details (route.ts:317-323) and should be wrapped in the same best-effort try/catch so a retrieve failure never fails the past_due entitlement write.

--- L11 · low · app/app/api/book/billing/webhook/route.ts:12-21, app/app/api/book/billing/webhook/route.ts:27, app/app/api/book/billing/webhook/route.ts:56-64, app/app/api/book/billing/webhook/route.ts:147-151, app/app/api/book/billing/webhook/route.ts:252-256, app/app/api/book/billing/webhook/route.ts:349-353
PROBLEM: maybeAwardReferralProConversion was gutted to a no-op (route.ts:56-64), but its imports remain: analyticsTrackFlowPointsTransaction, analyticsTrackReferral (lines 13-14), awardFlowPoints, getUserReferralClaim, markReferralProRewarded (lines 18-20), and INSIGHT_POINTS_AMOUNTS (line 27). I grepped the file: each of these symbols appears exactly once — on its import line — and is never referenced in the body. Only analyticsTrackSubscription (line 15) from that import group is actually used (lines 138,160,241,285,340,400). tsconfig has strict:true but not noUnusedLocals, so the build passes today, but this pulls flow-points-repo + the flow-points-economy module into the webhook bundle for nothing.
WHY:     No runtime impact; pure maintainability/bundle hygiene. A future enable of noUnusedLocals or a stricter lint gate would fail the build; readers may wrongly assume referral payouts still fire in the webhook.
FIX:     Delete the unused imports: remove analyticsTrackFlowPointsTransaction + analyticsTrackReferral (keep analyticsTrackSubscription) from the analytics-repo import (lines 13-14), delete the entire flow-points-repo import (lines 17-21), and delete the INSIGHT_POINTS_AMOUNTS import (line 27). Then either fully delete maybeAwardReferralProConversion and its 3 call sites (147-151, 252-256, 349-353), or keep the documented no-op with zero imports.

--- L12 · low · app/app/api/book/billing/webhook/route.ts:380-412, app/app/api/book/billing/webhook/route.ts:508-521, app/app/api/book/_lib/trial-ending-email.ts:46-121
PROBLEM: For customer.subscription.trial_will_end the durable user-visible side effect is sendTrialEndingEmail (route.ts:409). The event is only marked processed by recordStripeWebhookEvent at the very end (route.ts:518). sendTrialEndingEmail has no per-event dedup — it only checks suppression (trial-ending-email.ts:64). If the email send succeeds but recordStripeWebhookEvent then fails (or the metrics/putOpsMetric catch path rethrows), the handler 500s, Stripe retries, hasStripeWebhookEventBeenProcessed still returns false, and the email sends again.
WHY:     A user could receive duplicate 'your trial ends soon' emails on a webhook retry. Low frequency, low harm, but it is a transactional pre-charge notice, so duplicates look unprofessional and could draw a spam complaint (which then feeds the suppression list).
FIX:     Gate the send on a ConditionExpression-protected marker write keyed by customer+trial_end (e.g. a conditional Put 'trial_ending_email_sent#<customer>#<trial_end>'); on ConditionalCheckFailed, skip the send. Cheapest acceptable alternative: document the rare duplicate as acceptable. Note the realistic re-send window here is narrow — the email is the LAST side effect before recordStripeWebhookEvent in this branch, so the only trigger is recordStripeWebhookEvent itself (or the outer catch) failing after a successful send; the finding's 'a later step in the same invocation fails' is slightly overstated for this specific branch.

--- L13 · low · app/app/api/book/billing/webhook/route.ts:439-487, app/app/api/book/billing/webhook/route.ts:295-354, app/app/api/book/_lib/repo.ts:1818-1819, app/app/api/book/_lib/repo.ts:1920-1921
PROBLEM: charge.dispute.created downgrades to FREE/canceled (route.ts:481-486) with no proSource passed → proSourceValue becomes null (repo.ts:1818-1819: plan FREE ⇒ null). invoice.paid unconditionally sets plan PRO / proStatus active / proSource stripe (route.ts:325-338). The proSource guard (repo.ts:1920-1921) allows the write when proSource is absent OR 'stripe' OR null — and after a dispute it is null — so a delayed/redelivered invoice.paid landing after the dispute downgrade re-activates the chargebacked user to Pro. Stripe does not strictly order delivery across event types, so reordering is possible (low probability).
WHY:     Edge-case revocation bypass: a user who filed a chargeback regains Pro access if a stale invoice.paid is reprocessed after the dispute. Rare, but a money/entitlement correctness gap on a security-adjacent path.
FIX:     Persist a chargeback/disputed marker on the entitlement when charge.dispute.created fires, and have invoice.paid (and customer.subscription.* PRO transitions) refuse to re-activate while an unresolved dispute marker is present (clear it on charge.dispute.closed with status='won'). Implement via a ConditionExpression on the PRO-activation write (e.g. attribute_not_exists(disputeOpen)). Alternatively, when the stored proStatus is 'canceled', gate invoice.paid re-activation on a live subscriptions.retrieve. The cleaner structural fix is to also make the dispute downgrade set a sticky marker rather than relying on proSource=null, which the guard treats as writable.

--- L14 · low · app/app/api/book/billing/webhook/route.ts:468-479, app/app/api/book/_lib/repo.ts:1693-1718, app/app/api/book/_lib/keys.ts:191-197
PROBLEM: recordBillingEvent (repo.ts:1693-1718) has no ConditionExpression — idempotency relies entirely on a stable SK = `${kind}#${createdAtIso}#${id}` (keys.ts:191-197, kind upper-cased to DISPUTE in repo.ts:1697). For disputes the createdAt is isoFromUnix(dispute.created) ?? new Date().toISOString() (route.ts:478). dispute.created is normally present, but if absent, a webhook redelivery computes a different new Date() → different SK → a duplicate dispute row (same dispute.id in two records). Refunds are safe because they key off the stable refund/charge created time (refund-events.ts:57,69).
WHY:     Potential duplicate dispute rows in the admin finance report on the rare path where dispute.created is absent and the event is redelivered, double-counting chargebacks (listRecentBillingEvents, repo.ts:1721). Admin-only data quality.
FIX:     Make the dispute SK timestamp deterministic. Simplest: drop createdAt from the idempotency portion of billingEventSk — key disputes by `${kind}#${id}` and store createdAt as a plain attribute, sorting on it separately — OR add a ConditionExpression (attribute_not_exists(SK)) to recordBillingEvent so a redelivery cannot create a second row, OR derive the fallback createdAt from the resolved charge's created (already retrieved at route.ts:462) instead of new Date(). Note the SK currently embeds createdAt to allow chronological Query ordering, so the cleanest fix is the ConditionExpression which preserves ordering while preventing duplicates.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/book/_lib/keys.ts app/app/api/book/_lib/repo.ts app/app/api/book/_lib/trial-ending-email.ts app/app/api/book/admin/metrics/billing/route.ts app/app/api/book/billing/webhook/route.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/book/_lib/keys.ts app/app/api/book/_lib/repo.ts app/app/api/book/_lib/trial-ending-email.ts app/app/api/book/admin/metrics/billing/route.ts app/app/api/book/billing/webhook/route.ts
git commit -m "fix(correctness): L10, L11, L12, L13, L14 — invoice.payment_failed records the wrong Stripe fiel"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L10: committed on fix/L10 (worktree ../cf-fix-L10). Covered: L10, L11, L12, L13, L14."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L10 && git worktree remove ../cf-fix-L10 && git branch -d fix/L10"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 72: L16 — Analytics beacon does a DynamoDB read per navigation event to re-check consent
**Lead:** `low` · **Covers:** L16 · **Edits:** `app/app/api/book/me/analytics/beacon/route.ts`, `app/book/hooks/useAnalyticsBeacon.ts`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L16 ../cf-fix-L16 audit/prod-readiness-2026-06-14
cd ../cf-fix-L16
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/book/me/analytics/beacon/route.ts, app/book/hooks/useAnalyticsBeacon.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- L16 · low · app/app/api/book/me/analytics/beacon/route.ts:33-37, app/book/hooks/useAnalyticsBeacon.ts:153-170
PROBLEM: The beacon hook fires a 'navigation' beacon on every client route change (useAnalyticsBeacon.ts:160-166) plus session_context + performance per page load. For each beacon the server handler does a getUserSettingsItem GetItem (beacon/route.ts:33) to re-verify analyticsParticipation, even though the client already gated on the localStorage consent value (hook:141,154). I confirmed the write path analyticsTrackBeacon (analytics-repo.ts:869) is a blind Put/Update that does NOT read settings, so this consent GetItem is a genuinely separate, additional read per beacon — not foldable into an existing read.
WHY:     Avoidable DynamoDB read volume + latency on a high-frequency endpoint; one extra GetItem per navigation purely to re-read a rarely-changing privacy flag. Bounded (only when opted in) so not urgent, but wasteful at scale.
FIX:     Keep the flag server-authoritative but cache the user's settings in the warm-container in-memory map (like location.ts's IP_CACHE) with a short TTL keyed by userId, ideally invalidated on settings PATCH; or accept the read and document it as intentional. Folding it into the write path is not viable since analyticsTrackBeacon does not currently read settings.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/book/me/analytics/beacon/route.ts app/book/hooks/useAnalyticsBeacon.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/book/me/analytics/beacon/route.ts app/book/hooks/useAnalyticsBeacon.ts
git commit -m "fix(performance): L16 — Analytics beacon does a DynamoDB read per navigation"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L16: committed on fix/L16 (worktree ../cf-fix-L16). Covered: L16."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L16 && git worktree remove ../cf-fix-L16 && git branch -d fix/L16"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 73: L17 — Trial-ending email interpolates Stripe customer name into HTML without escaping
**Lead:** `low` · **Covers:** L17 · **Edits:** `app/app/api/book/_lib/trial-ending-email.ts` · ⚠ shares a file with Task L10

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L17 ../cf-fix-L17 audit/prod-readiness-2026-06-14
cd ../cf-fix-L17
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/book/_lib/trial-ending-email.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `app/app/api/book/_lib/trial-ending-email.ts`, which Task L10 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- L17 · low · app/app/api/book/_lib/trial-ending-email.ts:65, app/app/api/book/_lib/trial-ending-email.ts:98
PROBLEM: sendTrialEndingEmail builds the HTML body with `<p>Hi ${name},</p>` (line 98) where name = customer.name from Stripe (line 65, `customer.name?.trim() || 'there'`), inserted raw with no HTML escaping. By contrast email-compliance-core.ts:99 has an escapeHtml helper used in the footer. The customer name originates from user checkout data, so markup in the name renders verbatim in the email HTML. Blast radius limited (the email goes only to that same user's own address and mail clients sanitize), so this is hardening not an active exploit.
WHY:     Stored content from one field (customer name) reflected unescaped into outbound HTML email to that same user; could break layout or render unintended markup in their own inbox. Not cross-user.
FIX:     Escape name before interpolation in the HTML body (line 98). IMPORTANT CORRECTION to the original fix: escapeHtml in email-compliance-core.ts is a LOCAL function and is NOT exported (verified — only signUnsubscribeToken, verifyUnsubscribeToken, emailFooter, etc. are exported). So either add `export` to escapeHtml in email-compliance-core.ts and import it, or define a tiny local escapeHtml in trial-ending-email.ts. The text body (line 86) needs no change.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/book/_lib/trial-ending-email.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/book/_lib/trial-ending-email.ts
git commit -m "fix(security): L17 — Trial-ending email interpolates Stripe customer name"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L17: committed on fix/L17 (worktree ../cf-fix-L17). Covered: L17."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L17 && git worktree remove ../cf-fix-L17 && git branch -d fix/L17"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 74: L18 — requireActiveBookUser fails open — a deleted account stays reachable during a DynamoDB outage
**Lead:** `low` · **Covers:** L18 · **Edits:** `app/app/api/book/_lib/account-guard.ts` · context: `app/app/api/book/_lib/account-guard-policy.ts`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L18 ../cf-fix-L18 audit/prod-readiness-2026-06-14
cd ../cf-fix-L18
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/book/_lib/account-guard.ts.
- Read-only context (do NOT edit, just read for understanding): app/app/api/book/_lib/account-guard-policy.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- L18 · low · app/app/api/book/_lib/account-guard.ts:53-62, app/app/api/book/_lib/account-guard-policy.ts:15-21
PROBLEM: On any error reading the account-status record, requireActiveBookUser logs and returns the user as if active (catch block lines 53-62 returns user). The block decision (line 64, decideAccountAccess → 'block' for status 'deleted') is only reached when the read succeeds, so during a DynamoDB outage a soft-DELETED account regains access to mutating routes. This is a documented, deliberate availability tradeoff mirroring requireDashboardAccess, but it means deletion enforcement is not strictly guaranteed.
WHY:     During a DynamoDB partial outage, deleted/deactivated accounts can transiently access protected routes. Low likelihood, self-limiting (resolves when the store recovers).
FIX:     Acceptable as-is for most routes given the availability rationale. If tightened: fail-CLOSED specifically for the small set of irreversible/destructive routes, or cache the last-known 'deleted' status (short-TTL in-memory map keyed by userId, or a claim) so a read failure can still honor a known-deleted state rather than defaulting to allow. Note BookApiError is re-thrown (line 54), so a real 'block' is never swallowed — only infra failures fail open.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/book/_lib/account-guard.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/book/_lib/account-guard.ts
git commit -m "fix(security): L18 — requireActiveBookUser fails open — a deleted account"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L18: committed on fix/L18 (worktree ../cf-fix-L18). Covered: L18."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L18 && git worktree remove ../cf-fix-L18 && git branch -d fix/L18"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 75: L19 — Unsubscribe and settings writes are read-modify-write with no concurrency guard
**Lead:** `low` · **Covers:** L19 · **Edits:** `app/app/api/book/_lib/repo.ts`, `app/app/api/book/email/unsubscribe/route.ts`, `app/app/api/book/me/settings/route.ts` · ⚠ shares a file with Task H26/H27

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L19 ../cf-fix-L19 audit/prod-readiness-2026-06-14
cd ../cf-fix-L19
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/book/_lib/repo.ts, app/app/api/book/email/unsubscribe/route.ts, app/app/api/book/me/settings/route.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `app/app/api/book/me/settings/route.ts`, which Task H26/H27 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- L19 · low · app/app/api/book/email/unsubscribe/route.ts:159-166, app/app/api/book/me/settings/route.ts:88-124, app/app/api/book/_lib/repo.ts:2472-2502 (putUserSettingsItem)
PROBLEM: Both the one-click unsubscribe POST (route.ts:159-166: getUserSettingsItem → applyUnsubscribe merge → putUserSettingsItem) and the settings PATCH (settings/route.ts:88-124: getUserSettingsItem → mergeSettings → putUserSettingsItem) do get→merge-in-memory→full PutItem. Confirmed putUserSettingsItem (repo.ts:2482-2495) is an unconditional PutCommand that replaces the whole settings object — no version attribute, no ConditionExpression. Two concurrent writers (a user toggling a setting in-app while a one-click unsubscribe lands from their mail client) can lose one update; last-writer-wins. The unsubscribe case is the more important: a clobber could silently re-enable an email category the user just opted out of.
WHY:     Rare lost-update on settings; worst realistic case is an unsubscribe being overwritten by a near-simultaneous settings save, re-enabling a notification the user disabled — a CASL-relevant correctness concern. Low frequency.
FIX:     Add optimistic concurrency to putUserSettingsItem (store/compare an updatedAt or version attribute via ConditionExpression and retry on mismatch), or perform the unsubscribe flag flips as a targeted DynamoDB UpdateItem on the specific notifications keys (SET notifications.<key> = false) rather than a full-object Put — an UpdateItem on the specific path won't clobber unrelated concurrently-written keys and is the smaller, more robust change for the unsubscribe path specifically.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/book/_lib/repo.ts app/app/api/book/email/unsubscribe/route.ts app/app/api/book/me/settings/route.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/book/_lib/repo.ts app/app/api/book/email/unsubscribe/route.ts app/app/api/book/me/settings/route.ts
git commit -m "fix(correctness): L19 — Unsubscribe and settings writes are read-modify-writ"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L19: committed on fix/L19 (worktree ../cf-fix-L19). Covered: L19."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L19 && git worktree remove ../cf-fix-L19 && git branch -d fix/L19"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 76: L21 — Local quiz answer key defaults to index 0 when missing, can silently mis-grade
**Lead:** `low` · **Covers:** L21 · **Edits:** `app/app/api/book/_lib/content-service.ts`, `app/app/api/book/_lib/quiz-service.ts`, `app/app/api/book/_lib/quiz-session.ts` · ⚠ shares a file with Task H3/H4

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L21 ../cf-fix-L21 audit/prod-readiness-2026-06-14
cd ../cf-fix-L21
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/book/_lib/content-service.ts, app/app/api/book/_lib/quiz-service.ts, app/app/api/book/_lib/quiz-session.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `app/app/api/book/_lib/content-service.ts`, `app/app/api/book/_lib/quiz-session.ts`, which Task H3/H4 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- L21 · low · app/app/api/book/_lib/content-service.ts:163, app/app/api/book/_lib/quiz-session.ts:150-151, app/app/api/book/_lib/quiz-service.ts:43
PROBLEM: getLocalQuizQuestions defaults correctAnswerIndex to 0 (content-service.ts:163), and the LIVE grading/build path buildQuizAttemptQuestions also falls back to 0 (quiz-session.ts:150-151) when neither correctAnswerIndex nor correctIndex is present. If a quiz question ever ships without an answer-key field, choice index 0 is silently treated as correct with no error, so users are graded against an arbitrary key. Content pipeline is out of scope, but the server shouldn't silently invent an answer.
WHY:     A single malformed quiz question would silently grade everyone against choice A, producing wrong pass/fail outcomes and corrupting scores/IP for that chapter, with no signal to operators.
FIX:     When correctAnswerIndex/correctIndex is undefined in buildQuizAttemptQuestions (quiz-session.ts:150) and getLocalQuizQuestions (content-service.ts:163), throw a BookApiError(500) or skip the question rather than defaulting to 0, so a content defect fails loudly. Add a publish-time validation that every quiz question has an in-range answer index. Note: the cited quiz-service.ts:43 location is in scoreQuizSubmission, which is DEAD (zero callers — the live submit path uses gradeQuizAttemptQuestions); fix the live paths (quiz-session.ts / content-service.ts) and consider deleting scoreQuizSubmission entirely.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/book/_lib/content-service.ts app/app/api/book/_lib/quiz-service.ts app/app/api/book/_lib/quiz-session.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/book/_lib/content-service.ts app/app/api/book/_lib/quiz-service.ts app/app/api/book/_lib/quiz-session.ts
git commit -m "fix(correctness): L21 — Local quiz answer key defaults to index 0 when missi"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L21: committed on fix/L21 (worktree ../cf-fix-L21). Covered: L21."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L21 && git worktree remove ../cf-fix-L21 && git branch -d fix/L21"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 77: L22 — Per-book metrics endpoint returns aggregate reader counts for any bookId without existence/ownership check
**Lead:** `low` · **Covers:** L22 · **Edits:** `app/app/api/book/books/[bookId]/metrics/route.ts`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L22 ../cf-fix-L22 audit/prod-readiness-2026-06-14
cd ../cf-fix-L22
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/book/books/[bookId]/metrics/route.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- L22 · low · app/app/api/book/books/[bookId]/metrics/route.ts:12-63
PROBLEM: GET /books/[bookId]/metrics calls requireActiveBookUser() (line 17) but performs NO check that bookId exists or is published, and returns readersToday/readersWeek/loopsToday/loopsWeek for any bookId string an authenticated user supplies (lines 27-62). This exposes per-title business KPIs (daily/weekly active readers and loop completions) for arbitrary books to any logged-in user. Read-only aggregate, logged-in only, so low blast radius, but it is unintended data exposure.
WHY:     Any logged-in user (e.g., a competitor with a free account) can enumerate per-title engagement/completion numbers across the whole catalog.
FIX:     Validate bookId is a published catalog book (getCatalogBook) and either restrict this endpoint to admins or only return metrics for books the user has started/owns. At minimum return 404 for unknown bookIds, and decide whether these reader counts should be exposed to non-admins at all.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/book/books/[bookId]/metrics/route.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/book/books/[bookId]/metrics/route.ts
git commit -m "fix(security): L22 — Per-book metrics endpoint returns aggregate reader c"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L22: committed on fix/L22 (worktree ../cf-fix-L22). Covered: L22."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L22 && git worktree remove ../cf-fix-L22 && git branch -d fix/L22"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 78: L25 — Reflection IP (5 IP/example) is granted on a client-supplied length, not on validated reflection content
**Lead:** `low` · **Covers:** L25 · **Edits:** `app/app/api/book/me/reflections/[bookId]/[chapterNumber]/route.ts`, `app/book/_lib/flow-points-economy.ts` · ⚠ shares a file with Task M38/L28

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L25 ../cf-fix-L25 audit/prod-readiness-2026-06-14
cd ../cf-fix-L25
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/book/me/reflections/[bookId]/[chapterNumber]/route.ts, app/book/_lib/flow-points-economy.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `app/book/_lib/flow-points-economy.ts`, which Task M38/L28 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- L25 · low · app/app/api/book/me/reflections/[bookId]/[chapterNumber]/route.ts:43-55, app/app/api/book/me/reflections/[bookId]/[chapterNumber]/route.ts:89-101, app/book/_lib/flow-points-economy.ts:189
PROBLEM: The reflection IP route validates only reflectionLength (a number from the body, >= 1) and that exampleId belongs to the chapter (lines 43-55, 85-87) — it never receives or inspects the actual reflection text. A client can POST { exampleId: <valid id>, reflectionLength: 1 } with no real text and collect the 5 IP (awardFlowPoints, idempotent per example via sourceId `${bookId}:${chapterNumberInt}:${exampleId}`). The economy copy claims 'Empty submissions don't count' (flow-points-economy.ts:189), which the server cannot enforce with no text.
WHY:     Bounded self-serve IP farming: 5 IP per valid example in every accessible chapter without writing anything, contradicting the stated rule. Blast radius is capped by the number of valid exampleIds across unlocked chapters but grows with catalog size.
FIX:     Have the client send the reflection text (it already does for the separate AI-feedback route) and validate server-side: require trimmed length >= a minimum (e.g. 20, matching the feedback route) before awardFlowPoints; reject with 400 'empty_reflection' otherwise. Do not trust reflectionLength as the gate.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/book/me/reflections/[bookId]/[chapterNumber]/route.ts app/book/_lib/flow-points-economy.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/book/me/reflections/[bookId]/[chapterNumber]/route.ts app/book/_lib/flow-points-economy.ts
git commit -m "fix(data): L25 — Reflection IP (5 IP/example) is granted on a client-"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L25: committed on fix/L25 (worktree ../cf-fix-L25). Covered: L25."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L25 && git worktree remove ../cf-fix-L25 && git branch -d fix/L25"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 79: L26 — Concurrent redemption of the same one-time reward returns a raw 500 instead of a clean 409 (double-spend is prevented)
**Lead:** `low` · **Covers:** L26 · **Edits:** `app/app/api/book/_lib/flow-points-repo.ts`, `app/app/api/book/me/flow-points/redeem/route.ts`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L26 ../cf-fix-L26 audit/prod-readiness-2026-06-14
cd ../cf-fix-L26
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/book/_lib/flow-points-repo.ts, app/app/api/book/me/flow-points/redeem/route.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- L26 · low · app/app/api/book/me/flow-points/redeem/route.ts:60-68, app/app/api/book/_lib/flow-points-repo.ts:709-723, app/app/api/book/_lib/flow-points-repo.ts:769-781
PROBLEM: The redeem route's existingClaim check (route.ts:66) is a non-atomic read. Two concurrent redemptions of the same oneTimePerUser reward can both pass it and call redeemFlowPointsReward. The reward-claim Put is TransactItem index 1 (flow-points-repo.ts:709-723) carrying attribute_not_exists, so DynamoDB cancels the losing transaction — no double spend. But the catch only special-cases isTransactionConditionFailedAt(error, 4) (the entitlement guard at index 4) and rethrows everything else, so the index-1 claim conflict surfaces as an unmapped 500 instead of 409 reward_already_claimed.
WHY:     No financial loss (the second spend is blocked atomically). The user gets an opaque server error instead of 'already claimed', and the 500 pollutes error monitoring as a phantom fault. Only triggers on a genuine concurrent race; the sequential repeat-claim is already handled cleanly by the route-level existingClaim 409.
FIX:     In redeemFlowPointsReward's catch, also detect a cancellation at the reward-claim index (1) via isTransactionConditionFailedAt(error, 1) and throw BookApiError(409, 'reward_already_claimed', ...). Keep the index-4 entitlement case as the active_subscription 409. (Indices: 0=engagement spend, 1=rewardClaim, 2=redemption, 3=ledger, 4=entitlementUpdate — all verified.)

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/book/_lib/flow-points-repo.ts app/app/api/book/me/flow-points/redeem/route.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/book/_lib/flow-points-repo.ts app/app/api/book/me/flow-points/redeem/route.ts
git commit -m "fix(correctness): L26 — Concurrent redemption of the same one-time reward re"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L26: committed on fix/L26 (worktree ../cf-fix-L26). Covered: L26."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L26 && git worktree remove ../cf-fix-L26 && git branch -d fix/L26"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 80: L27 — Badges PUT lets a client record any catalog badge with arbitrary earnedAt/tier without earning it (cosmetic only)
**Lead:** `low` · **Covers:** L27 · **Edits:** `app/app/api/book/me/badges/route.ts` · context: `app/app/api/book/_lib/keys.ts`, `app/app/api/book/_lib/repo.ts`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L27 ../cf-fix-L27 audit/prod-readiness-2026-06-14
cd ../cf-fix-L27
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/book/me/badges/route.ts.
- Read-only context (do NOT edit, just read for understanding): app/app/api/book/_lib/keys.ts, app/app/api/book/_lib/repo.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- L27 · low · app/app/api/book/me/badges/route.ts:32-80, app/app/api/book/_lib/repo.ts:2864-2895, app/app/api/book/_lib/keys.ts (badgeAwardSk)
PROBLEM: PUT /me/badges accepts any badgeId present in BADGE_DEFINITIONS (validated via getBadgeName) plus a client-supplied earnedAt and tier and calls putBadgeAward, which writes a BOOK_USER_BADGE_AWARD with no server-side check that the user met the criteria. The route comment states badges are cosmetic and grant no IP, and putBadgeAward writes zero points — so this is not an economy exploit, but a user can fabricate their own badge wall and backdate earnedAt. badgeAwardSk(badgeId) = `BADGE#${badgeId}` ignores tier, and putBadgeAward uses attribute_not_exists, so for a multi-tier badge only the first PUT persists and tier upgrades silently no-op (created:false).
WHY:     Low: only the user's own cosmetic display is affected (self-spoofing), no currency leak. The tier-collision means tiered badge upgrades may appear not to 'take'.
FIX:     Make cosmetic badge state server-derived (compute the badge wall from BOOK_USER_ACHIEVEMENT + real stats, mirroring the server-authoritative achievement-repo IP path) and remove the client-writable PUT, or validate the claimed badge against server truth before persisting. If tiered badges must coexist, include tier in badgeAwardSk (e.g. `BADGE#${badgeId}#${tier}`) so upgrades don't collide.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/book/me/badges/route.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/book/me/badges/route.ts
git commit -m "fix(security): L27 — Badges PUT lets a client record any catalog badge wi"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L27: committed on fix/L27 (worktree ../cf-fix-L27). Covered: L27."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L27 && git worktree remove ../cf-fix-L27 && git branch -d fix/L27"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 81: L28 (+2) — review_session_complete IP (10) is defined in the economy but never awarded by any endpoint
**Lead:** `low` · **Covers:** L28, L63, P4 · **Edits:** `app/app/api/book/me/onboarding/complete/route.ts`, `app/app/api/book/me/profile/route.ts`, `app/book/_lib/flow-points-economy.ts`, `app/ref/[code]/route.ts` · context: `app/app/api/book/me/reviews/[cardId]/route.ts` · ⚠ shares a file with Task M28/H26/M38/L25

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 3 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L28 ../cf-fix-L28 audit/prod-readiness-2026-06-14
cd ../cf-fix-L28
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/book/me/onboarding/complete/route.ts, app/app/api/book/me/profile/route.ts, app/book/_lib/flow-points-economy.ts, app/ref/[code]/route.ts.
- Read-only context (do NOT edit, just read for understanding): app/app/api/book/me/reviews/[cardId]/route.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `app/app/api/book/me/onboarding/complete/route.ts`, `app/app/api/book/me/profile/route.ts`, `app/book/_lib/flow-points-economy.ts`, which Task M28/H26/M38/L25 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- L28 · low · app/book/_lib/flow-points-economy.ts:33, app/book/_lib/flow-points-economy.ts:82, app/app/api/book/me/reviews/[cardId]/route.ts:19-61
PROBLEM: INSIGHT_POINTS_AMOUNTS.reviewSessionComplete = 10 (flow-points-economy.ts:82) and the 'review_session_complete' FlowPointsSourceType (line 33) are declared, implying reviewing cards earns IP, but no awardFlowPoints call anywhere uses sourceType 'review_session_complete' (grep over app/app/api/book confirms). The FSRS review submit route records the card and log but grants zero IP.
WHY:     Minor: a documented earning path doesn't exist, so spaced-repetition gives no IP incentive despite a declared constant; dead constants invite future confusion.
FIX:     Decide intent: either award 10 IP on completing a review session via awardFlowPoints with a per-day idempotent sourceId (sourceType 'review_session_complete', sourceId `${userId}:${utcDay}`) in the reviews flow, or delete reviewSessionComplete from INSIGHT_POINTS_AMOUNTS and the unused source type to keep the economy honest.

--- L63 · low · app/book/_lib/flow-points-economy.ts:7, app/ref/[code]/route.ts:3,19, app/app/api/book/me/onboarding/complete/route.ts:34,220,306, app/app/api/book/me/profile/route.ts:35,397,495
PROBLEM: INSIGHT_POINTS_COOKIE_NAME === 'cf_ref' (flow-points-economy.ts:7) and is used exclusively as the referral attribution cookie: /ref/[code]/route.ts sets it to the normalized referral code (line 19), and onboarding-complete (220 read / 306 clear) and profile (397 read / 495 clear) consume it to credit the inviter. Functionally correct and consistent, but the name reads as an insight-points cookie, which is misleading for anyone in the referral/economy code.
WHY:     Risk of a future maintainer wiring the wrong cookie or clobbering referral attribution; no user-facing breakage today.
FIX:     Rename to REFERRAL_COOKIE_NAME (keep value 'cf_ref') and update the four import sites (flow-points-economy.ts, ref/[code]/route.ts, onboarding/complete/route.ts, profile/route.ts). Pure rename.

--- P4 · polish · app/book/_lib/flow-points-economy.ts:7, app/ref/[code]/route.ts:3-19, app/app/api/book/me/profile/route.ts:397,495, app/app/api/book/me/onboarding/complete/route.ts:220,306
PROBLEM: The constant INSIGHT_POINTS_COOKIE_NAME = 'cf_ref' (flow-points-economy.ts:7) actually holds the referral attribution code: it is set by /ref/[code]/route.ts:19 and consumed/cleared at profile (route.ts:397,495) and onboarding/complete (route.ts:220,306) to create a referral claim. The name implies the Insight Points balance cookie, not referral attribution. Value and behavior are correct; only the name is misleading. ('cf_ref' is also documented in app/legal/cookies/page.tsx:98 as the referral cookie, so the value must be preserved.)
WHY:     No functional bug today; meaningful risk that a future maintainer breaks referral attribution by reasoning about the misleading name (e.g. clearing it as part of an Insight Points change).
FIX:     Rename the constant to REFERRAL_ATTRIBUTION_COOKIE_NAME (keep the 'cf_ref' value to preserve existing cookies and the legal/cookies disclosure) across flow-points-economy.ts and its four consumers (ref/[code], profile, onboarding/complete — note there are more consumers than the original finding listed).

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/book/me/onboarding/complete/route.ts app/app/api/book/me/profile/route.ts app/book/_lib/flow-points-economy.ts app/ref/[code]/route.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/book/me/onboarding/complete/route.ts app/app/api/book/me/profile/route.ts app/book/_lib/flow-points-economy.ts app/ref/[code]/route.ts
git commit -m "fix(dead-code): L28, L63, P4 — review_session_complete IP (10) is defined in the ec"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L28: committed on fix/L28 (worktree ../cf-fix-L28). Covered: L28, L63, P4."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L28 && git worktree remove ../cf-fix-L28 && git branch -d fix/L28"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 82: L29 — Journeys feature is orphaned post-merge (no reachable nav link) and dashboard no longer surfaces partner/commitment/event cards
**Lead:** `low` · **Covers:** L29 · **Edits:** `app/book/home/components/TopNav.tsx`, `components/workspace/WorkspacePage.tsx` · context: `app/book/home/components/CommitmentFollowUpCard.tsx`, `app/book/home/components/JourneyBanner.tsx` · ⚠ shares a file with Task H25/H7/L70

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L29 ../cf-fix-L29 audit/prod-readiness-2026-06-14
cd ../cf-fix-L29
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/book/home/components/TopNav.tsx, components/workspace/WorkspacePage.tsx.
- Read-only context (do NOT edit, just read for understanding): app/book/home/components/CommitmentFollowUpCard.tsx, app/book/home/components/JourneyBanner.tsx.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `app/book/home/components/TopNav.tsx`, `components/workspace/WorkspacePage.tsx`, which Task H25/H7/L70 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- L29 · low · app/book/home/components/TopNav.tsx:57-79,264,552, app/book/home/components/JourneyBanner.tsx, app/book/home/components/CommitmentFollowUpCard.tsx, components/workspace/WorkspacePage.tsx:741
PROBLEM: REFUTED for journeys/events reachability: the live dashboard (WorkspacePage) DOES render TopNav (WorkspacePage.tsx:16,741), and TopNav exposes Journeys (/book/journeys) and Events (/book/events) in the desktop nav (desktopOnlyNavItems merged at TopNav.tsx:264) and in the mobile 'More' sheet (moreNavItems at TopNav.tsx:75-79,552). So /book/journeys and /book/events ARE reachable from the live nav, contradicting the finding's core claim. CONFIRMED for the discovery-card/commitment part: the social cards JourneyBanner, EventBanner, CommitmentFollowUpCard, PartnerProgressCard live only in the dead app/book/home/components/* tree and are rendered nowhere; the dashboard surfaces none of them. There is NO standalone commitments page at all (only API routes under me/commitments), so the commitment follow-up prompt is invisible to users.
WHY:     Lower than reported: journeys/events are discoverable via nav. The real residual gap is that the proactive engagement cards (journey progress banner, commitment follow-up reminder, partner accountability) are not surfaced on the dashboard, so the gamification loop is passive rather than prompted — and commitments have no first-class page or reminder at all.
FIX:     Drop the 'no reachable nav link to journeys' claim (false). For the cards: decide per feature — port CommitmentFollowUpCard (and optionally JourneyBanner) into components/workspace/WorkspacePage to re-introduce the dashboard prompts, or delete the orphaned app/book/home/components/* files if cut. At minimum re-introduce the commitment follow-up prompt somewhere reachable since commitments have no page.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/book/home/components/TopNav.tsx components/workspace/WorkspacePage.tsx

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/book/home/components/TopNav.tsx components/workspace/WorkspacePage.tsx
git commit -m "fix(ux): L29 — Journeys feature is orphaned post-merge (no reachabl"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L29: committed on fix/L29 (worktree ../cf-fix-L29). Covered: L29."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L29 && git worktree remove ../cf-fix-L29 && git branch -d fix/L29"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 83: L30 (+1) — Pair invite accept is a TOCTOU with non-conditional writes — concurrent/duplicate accepts can clobber
**Lead:** `low` · **Covers:** L30, L36 · **Edits:** `app/app/api/book/_lib/pair-repo.ts` · ⚠ shares a file with Task H7

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 2 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L30 ../cf-fix-L30 audit/prod-readiness-2026-06-14
cd ../cf-fix-L30
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/book/_lib/pair-repo.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `app/app/api/book/_lib/pair-repo.ts`, which Task H7 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- L30 · low · app/app/api/book/_lib/pair-repo.ts:60-141
PROBLEM: acceptPairInvite (pair-repo.ts:60-141) GETs the invite, checks status==='pending' (line 75), checks neither user already has an active pair (lines 80-83), then writes both pair records and the invite-accepted record via Promise.all with NO ConditionExpression on any of the three PutCommands (lines 97-138). The invite Put (lines 126-137) unconditionally overwrites the whole item to status:'accepted'. Two concurrent accepts of the same code (or an accept racing another pairing of the inviter) can both pass the read-time checks and both write; there is no attribute_not_exists guard on the pair PUTs nor a 'still pending' condition at write time. Note createPairInvite correctly uses ConditionExpression attribute_not_exists(PK) and deletePair uses attribute_exists(PK) — accept is the unguarded outlier.
WHY:     Low likelihood (requires concurrent requests on the same low-value invite code) and no money/data loss — blast radius is an inconsistent/duplicated partner link or an invite marked accepted by the wrong party.
FIX:     Convert the three writes to a TransactWriteCommand (or add ConditionExpression: '#status = :pending' to the invite Put and attribute_not_exists(PK) AND attribute_not_exists(SK) to the pair Puts) so a losing concurrent accept fails cleanly and returns 'Invite already used' instead of clobbering.

--- L36 · low · app/app/api/book/_lib/pair-repo.ts:8-15
PROBLEM: generateInviteCode (pair-repo.ts:8-15) uses Math.floor(Math.random()*chars.length) over a 32-char alphabet for an 8-char code. Math.random is not cryptographically secure / theoretically predictable; the referral-code generator uses a CSPRNG path. 32^8 (~1.1e12) keyspace makes blind enumeration impractical, the payoff of a guessed pair invite is low (becoming a stranger's reading partner), and there is no accept rate-limit. Note the createPairInvite loop retries up to 3x on collision (attribute_not_exists(PK)), so a weak PRNG also marginally raises collision retries.
WHY:     Very low: predictable PRNG plus no accept rate-limit is a theoretical enumeration/guess vector, but the reward is negligible and the keyspace is large. Compounded by the fact (finding #1) that no user can even generate an invite today.
FIX:     Switch generateInviteCode to draw bytes from crypto (e.g. crypto.randomBytes or a crypto.randomUUID-derived alphabet mapping) like the referral generator, removing the predictable-PRNG class of issue and improving collision resistance.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/book/_lib/pair-repo.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/book/_lib/pair-repo.ts
git commit -m "fix(correctness): L30, L36 — Pair invite accept is a TOCTOU with non-conditional "

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L30: committed on fix/L30 (worktree ../cf-fix-L30). Covered: L30, L36."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L30 && git worktree remove ../cf-fix-L30 && git branch -d fix/L30"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 84: L31 — journeys/[journeyId]/start does not validate the journeyId exists in definitions
**Lead:** `low` · **Covers:** L31 · **Edits:** `app/app/api/book/me/journeys/[journeyId]/start/route.ts` · context: `app/app/api/book/me/journeys/[journeyId]/route.ts`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L31 ../cf-fix-L31 audit/prod-readiness-2026-06-14
cd ../cf-fix-L31
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/book/me/journeys/[journeyId]/start/route.ts.
- Read-only context (do NOT edit, just read for understanding): app/app/api/book/me/journeys/[journeyId]/route.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- L31 · low · app/app/api/book/me/journeys/[journeyId]/start/route.ts:12-32, app/app/api/book/me/journeys/[journeyId]/route.ts:20-25
PROBLEM: start/route.ts creates a journey record for any arbitrary journeyId (it only enforces max-3-active at lines 19-23 and not-already-started at 26-28), then calls startJourney. Unlike the GET route (route.ts:20-25) which loads journeyDefinitions and 404s on unknown ids, start never validates journeyId against the definitions. A user can POST /me/journeys/garbage/start and persist a phantom journey that occupies one of their 3 active slots and can never complete (no definition -> checkAndAdvanceJourneys skips it).
WHY:     Minor, self-inflicted: a user or buggy client can clutter their own journey list with non-existent journeys and consume active-journey slots. No cross-user impact.
FIX:     In start/route.ts, import journeyDefinitions (same source the GET route uses) and return bookErr(req, 404, 'not_found', 'Journey not found') when no def matches journeyId, before listUserJourneys/startJourney. (Definitions live under content/ which is out of audit scope, but the import already exists in the sibling GET route.)

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/book/me/journeys/[journeyId]/start/route.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/book/me/journeys/[journeyId]/start/route.ts
git commit -m "fix(correctness): L31 — journeys/[journeyId]/start does not validate the jou"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L31: committed on fix/L31 (worktree ../cf-fix-L31). Covered: L31."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L31 && git worktree remove ../cf-fix-L31 && git branch -d fix/L31"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 85: L32 — events join does not validate the event exists/is active
**Lead:** `low` · **Covers:** L32 · **Edits:** `app/app/api/book/_lib/admin-events-repo.ts`, `app/app/api/book/_lib/events-repo.ts`, `app/app/api/book/me/events/[eventId]/join/route.ts` · ⚠ shares a file with Task L33

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L32 ../cf-fix-L32 audit/prod-readiness-2026-06-14
cd ../cf-fix-L32
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/book/_lib/admin-events-repo.ts, app/app/api/book/_lib/events-repo.ts, app/app/api/book/me/events/[eventId]/join/route.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `app/app/api/book/_lib/events-repo.ts`, which Task L33 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- L32 · low · app/app/api/book/me/events/[eventId]/join/route.ts:12-26, app/app/api/book/_lib/events-repo.ts:11-45, app/app/api/book/_lib/admin-events-repo.ts:23
PROBLEM: join/route.ts checks only for an existing participation (getEventProgress at line 18) then calls joinEvent (events-repo.ts:11-45) which persists an EVENT_PARTICIPATION record for any eventId with no check against the event-definitions store or active window. A user can join a nonexistent or expired event; it just sits in their list. recordEventChapter only credits joined+active events (submit/route.ts:761-781 filters by active window), so there is no reward exploit — just junk participation rows.
WHY:     Minor self-inflicted clutter; no reward or cross-user impact.
FIX:     In join/route.ts, call getEventDefinition(tableName, eventId) (admin-events-repo.ts:23) first and return bookErr(req, 404, 'not_found', ...) if missing (optionally reject events outside their start/end window) before joinEvent.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/book/_lib/admin-events-repo.ts app/app/api/book/_lib/events-repo.ts app/app/api/book/me/events/[eventId]/join/route.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/book/_lib/admin-events-repo.ts app/app/api/book/_lib/events-repo.ts app/app/api/book/me/events/[eventId]/join/route.ts
git commit -m "fix(correctness): L32 — events join does not validate the event exists/is ac"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L32: committed on fix/L32 (worktree ../cf-fix-L32). Covered: L32."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L32 && git worktree remove ../cf-fix-L32 && git branch -d fix/L32"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 86: L33 — recordEventChapter dereferences eventDef.badge unconditionally in the completion notification
**Lead:** `low` · **Covers:** L33 · **Edits:** `app/app/api/book/_lib/events-repo.ts`, `app/app/api/book/me/quiz/[bookId]/[chapterNumber]/submit/route.ts` · ⚠ shares a file with Task L32

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L33 ../cf-fix-L33 audit/prod-readiness-2026-06-14
cd ../cf-fix-L33
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/book/_lib/events-repo.ts, app/app/api/book/me/quiz/[bookId]/[chapterNumber]/submit/route.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `app/app/api/book/_lib/events-repo.ts`, which Task L32 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- L33 · low · app/app/api/book/_lib/events-repo.ts:146-164, app/app/api/book/me/quiz/[bookId]/[chapterNumber]/submit/route.ts:758-791
PROBLEM: On event completion the badge persist is guarded by if (eventDef.badge?.badgeId) (events-repo.ts:146), correctly treating badge as possibly-absent, but the createNotification call reads eventDef.badge.badgeId without optional chaining (line 161). For a badge-less event definition, line 161 throws a synchronous TypeError while building the metadata object — before the createNotification(...).catch() promise is created, so the .catch does NOT catch it. The sole caller (submit/route.ts:758-791) wraps recordEventChapter in an event_tracking try/catch, so there is no request crash, but the completion notification is lost and event_tracking is logged as a partial failure (and IP award + badge persist, which run before line 154, do complete).
WHY:     Defensive/robustness: for a badge-less event, completers silently get no completion notification and a partial-failure error is logged. Bounded because the admin create route currently enforces badge, but the seed-from-JSON path is not validated here.
FIX:     Change line 161 to badgeId: eventDef.badge?.badgeId ?? null (match the guard already used on line 146).

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/book/_lib/events-repo.ts app/app/api/book/me/quiz/[bookId]/[chapterNumber]/submit/route.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/book/_lib/events-repo.ts app/app/api/book/me/quiz/[bookId]/[chapterNumber]/submit/route.ts
git commit -m "fix(correctness): L33 — recordEventChapter dereferences eventDef.badge uncon"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L33: committed on fix/L33 (worktree ../cf-fix-L33). Covered: L33."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L33 && git worktree remove ../cf-fix-L33 && git branch -d fix/L33"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 87: L34 (+2) — Device token SK truncates endpoint to last 32 alphanumerics — collision can drop a user's device
**Lead:** `low` · **Covers:** L34, L47, L51 · **Edits:** `app/app/api/book/_lib/keys.ts`, `app/app/api/book/me/devices/register/route.ts`, `infra/lambda/lib/email-compliance.ts`, `infra/lambda/suppression-handler.ts` · context: `infra/lambda/dist/reading-reminder-cron.js` · ⚠ shares a file with Task L10/L35/H14

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 3 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L34 ../cf-fix-L34 audit/prod-readiness-2026-06-14
cd ../cf-fix-L34
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/book/_lib/keys.ts, app/app/api/book/me/devices/register/route.ts, infra/lambda/lib/email-compliance.ts, infra/lambda/suppression-handler.ts.
- Read-only context (do NOT edit, just read for understanding): infra/lambda/dist/reading-reminder-cron.js.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `app/app/api/book/_lib/keys.ts`, `app/app/api/book/me/devices/register/route.ts`, `infra/lambda/lib/email-compliance.ts`, which Task L10/L35/H14 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- L34 · low · app/app/api/book/_lib/keys.ts:254-257, app/app/api/book/me/devices/register/route.ts:25-40
PROBLEM: deviceTokenSk(endpoint) = `DEVICE#` + endpoint.slice(-32).replace(/[^a-zA-Z0-9]/g,'') (keys.ts:254-257). Using only the last 32 alphanumeric chars of the push endpoint as the key risks two distinct endpoints colliding to the same SK. The register PutCommand (register/route.ts:25-40) has NO ConditionExpression, so a second device whose endpoint shares those trailing chars overwrites the first device's record. Register/unregister use the same hash so they stay self-consistent, but the notification fanout (begins_with DEVICE#) would then only ever see one of the colliding devices.
WHY:     Low probability (real push endpoints have high-entropy distinct tails) but on collision a user silently loses push on one device. No security impact (send is allowlist-guarded regardless).
FIX:     Key the device record on a stable hash of the FULL endpoint (e.g. createHash('sha256').update(endpoint).digest('base64url')) in deviceTokenSk, keeping register/unregister using the same function so they stay aligned.

--- L47 · low · app/app/api/book/_lib/keys.ts:254-257
PROBLEM: deviceTokenSk = 'DEVICE#' + endpoint.slice(-32).replace(/[^a-zA-Z0-9]/g,''). Used as the SK for device tokens (register/unregister routes). The code is as described, BUT the finding's collision rationale is wrong: real web-push endpoints (FCM https://fcm.googleapis.com/fcm/send/<token>, Mozilla autopush .../wpush/v2/<token>) carry their COMMON host/path at the FRONT and their UNIQUE high-entropy token at the END. slice(-32) keeps the TAIL, i.e. the distinguishing token, and drops the shared prefix — the opposite of 'endpoints share long common suffixes'. So the realistic collision probability for the major providers is very low (the trailing 32 alphanumerics sit inside the random token).
WHY:     Two of a user's device endpoints colliding (one silently overwriting the other) is possible in principle but unlikely for FCM/Mozilla because the entropy lives in the trailing 32 chars. Low blast radius today.
FIX:     Still cheap and strictly safer: SK = 'DEVICE#' + sha256(endpoint).slice(0,N) over the FULL endpoint, guaranteeing distinct endpoints map to distinct keys regardless of provider format. Trivial change.

--- L51 · low · app/app/api/book/_lib/keys.ts:471-484, infra/lambda/lib/email-compliance.ts:72, infra/lambda/suppression-handler.ts:89, infra/lambda/dist/reading-reminder-cron.js:80 (built)
PROBLEM: emailSuppressionPk = 'BOOKSUPPRESS#'+email.trim().toLowerCase(). The same literal is hand-replicated in at least FOUR places (the finding said three): email-compliance.ts (BOOKSUPPRESS#${email.trim().toLowerCase()} — matches), suppression-handler.ts (BOOKSUPPRESS#${email} but email is normalized at line 83 to entry.email.trim().toLowerCase() — currently equivalent), and the reading-reminder cron. No live divergence today; all normalize to lower+trim. The risk is purely a future edit diverging one copy.
WHY:     A future edit to any copy (e.g. dropping .trim()/.toLowerCase() or changing the prefix) would make the bounce/complaint handler write rows the send-time isEmailSuppressed check never finds → silently re-sending to bounced/complained addresses (CASL/deliverability/blocklist exposure).
FIX:     Extract the suppression-key format into one shared module imported by both the Next app and the infra Lambda builds (or codegen from one source), and add a unit test asserting all producers yield identical keys for the same input.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/book/_lib/keys.ts app/app/api/book/me/devices/register/route.ts infra/lambda/lib/email-compliance.ts infra/lambda/suppression-handler.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/book/_lib/keys.ts app/app/api/book/me/devices/register/route.ts infra/lambda/lib/email-compliance.ts infra/lambda/suppression-handler.ts
git commit -m "fix(correctness): L34, L47, L51 — Device token SK truncates endpoint to last 32 alphan"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L34: committed on fix/L34 (worktree ../cf-fix-L34). Covered: L34, L47, L51."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L34 && git worktree remove ../cf-fix-L34 && git branch -d fix/L34"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 88: L35 — Push endpoint not validated against allowlist at registration time (defense-in-depth gap)
**Lead:** `low` · **Covers:** L35 · **Edits:** `app/app/api/book/_lib/push-service.ts`, `app/app/api/book/me/devices/register/route.ts` · context: `app/app/api/book/_lib/push-endpoint-allowlist.ts` · ⚠ shares a file with Task L34

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L35 ../cf-fix-L35 audit/prod-readiness-2026-06-14
cd ../cf-fix-L35
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/book/_lib/push-service.ts, app/app/api/book/me/devices/register/route.ts.
- Read-only context (do NOT edit, just read for understanding): app/app/api/book/_lib/push-endpoint-allowlist.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `app/app/api/book/me/devices/register/route.ts`, which Task L34 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- L35 · low · app/app/api/book/me/devices/register/route.ts:16-40, app/app/api/book/_lib/push-endpoint-allowlist.ts:22-34, app/app/api/book/_lib/push-service.ts:33-36
PROBLEM: isAllowedPushEndpoint is enforced at the actual SSRF sink at send time (push-service.ts:33-36 refuses non-allowlisted endpoints), which correctly prevents SSRF. But register/route.ts:16-40 stores any client-supplied endpoint (only requireString length-bounded) without running isAllowedPushEndpoint, so the device table can be polluted with arbitrary URLs that are iterated (and rejected) on every notification fanout.
WHY:     No SSRF (send-time guard blocks it) — junk endpoints just inflate the per-notification device loop and the device table. Minor cost/abuse surface.
FIX:     Call isAllowedPushEndpoint(endpoint) in register/route.ts and reject non-allowlisted endpoints with a 400 (bookErr) before the PutCommand, so only valid push hosts are ever persisted.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/book/_lib/push-service.ts app/app/api/book/me/devices/register/route.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/book/_lib/push-service.ts app/app/api/book/me/devices/register/route.ts
git commit -m "fix(security): L35 — Push endpoint not validated against allowlist at reg"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L35: committed on fix/L35 (worktree ../cf-fix-L35). Covered: L35."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L35 && git worktree remove ../cf-fix-L35 && git branch -d fix/L35"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 89: L37 — Filtered scan with Limit returns fewer rows than expected (ingestion jobs / metrics) — silent under-counting
**Lead:** `low` · **Covers:** L37 · **Edits:** `app/app/api/book/admin/metrics/ops/route.ts`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L37 ../cf-fix-L37 audit/prod-readiness-2026-06-14
cd ../cf-fix-L37
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/book/admin/metrics/ops/route.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- L37 · low · app/app/api/book/admin/metrics/ops/route.ts:144-164 (fetchIngestionJobs)
PROBLEM: fetchIngestionJobs issues a single ScanCommand with FilterExpression entity=BOOK_INGEST_JOB and Limit:50, then sorts and slices the first 20. In DynamoDB, Limit caps items SCANNED (pre-filter), not items MATCHED, and there is no LastEvaluatedKey loop. If the table has many non-ingest-job items, the 50-item scan window can be consumed by unrelated rows and return 0-few jobs even when dozens exist. The notifications-route reference cited in the original finding is actually the acceptable, warned, capped path — the real defect is isolated to fetchIngestionJobs.
WHY:     The Ops dashboard's recent-ingestions panel can show stale or no jobs even when recent ingestions exist.
FIX:     Paginate fetchIngestionJobs until enough matching jobs are collected (bounded page count, like listRecentOpsFailures does), OR store ingestion jobs under a queryable PK (e.g. PK=BOOK_INGEST_JOBS, SK=createdAt) and Query so Limit applies to matches and ScanIndexForward gives recency for free.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/book/admin/metrics/ops/route.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/book/admin/metrics/ops/route.ts
git commit -m "fix(correctness): L37 — Filtered scan with Limit returns fewer rows than exp"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L37: committed on fix/L37 (worktree ../cf-fix-L37). Covered: L37."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L37 && git worktree remove ../cf-fix-L37 && git branch -d fix/L37"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 90: L38 — Segment filters stored without server-side validation of field/operator/value
**Lead:** `low` · **Covers:** L38 · **Edits:** `app/app/api/book/admin/segments/route.ts` · context: `app/app/api/book/_lib/segment-engine.ts`, `app/app/api/book/admin/segments/[segmentId]/route.ts`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L38 ../cf-fix-L38 audit/prod-readiness-2026-06-14
cd ../cf-fix-L38
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/book/admin/segments/route.ts.
- Read-only context (do NOT edit, just read for understanding): app/app/api/book/_lib/segment-engine.ts, app/app/api/book/admin/segments/[segmentId]/route.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- L38 · low · app/app/api/book/admin/segments/route.ts:35-50, app/app/api/book/admin/segments/[segmentId]/route.ts:43-53, app/app/api/book/_lib/segment-engine.ts:69-111
PROBLEM: POST validates only that filters is a non-empty array, then persists body.filters verbatim (typed as SegmentFilter[] with no runtime check). PATCH does even less — it spreads body.filters in if present, with no array or element validation. evaluateFilter falls through to `return false` for unknown fields, and compareString/compareNumber return false for unknown operators, so a malformed/stale filter silently matches zero users. A saved segment can quietly become empty (e.g. a renamed field), and a notify against it targets 0 users with no signal the definition is invalid.
WHY:     An admin can save a segment that silently matches nobody (typo'd field/operator, or a field renamed later), then send a campaign believing it targeted users. Admin-only, low blast radius, but causes confusing dead segments.
FIX:     Validate each filter on write in BOTH POST and PATCH against the SegmentFilterField/SegmentFilterOperator unions: reject unknown field/operator, require value where the operator needs one, coerce numeric values, bound the array length. Return a 400 naming the offending filter rather than persisting it.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/book/admin/segments/route.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/book/admin/segments/route.ts
git commit -m "fix(correctness): L38 — Segment filters stored without server-side validatio"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L38: committed on fix/L38 (worktree ../cf-fix-L38). Covered: L38."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L38 && git worktree remove ../cf-fix-L38 && git branch -d fix/L38"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 91: L39 — events POST casts body.books to string[] without per-element validation
**Lead:** `low` · **Covers:** L39 · **Edits:** `app/app/api/book/admin/events/route.ts` · context: `app/app/api/book/admin/events/[eventId]/route.ts`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L39 ../cf-fix-L39 audit/prod-readiness-2026-06-14
cd ../cf-fix-L39
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/book/admin/events/route.ts.
- Read-only context (do NOT edit, just read for understanding): app/app/api/book/admin/events/[eventId]/route.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- L39 · low · app/app/api/book/admin/events/route.ts:46-49, app/app/api/book/admin/events/[eventId]/route.ts:55
PROBLEM: Seasonal-event create validates books is a non-empty array but then `const books = body.books as string[]` with no per-element type check (route.ts:46-49). PATCH does `Array.isArray(body.books) ? (body.books as string[]) : existing.books` (eventId/route.ts:55), also unchecked. A payload like {books:[1,null,{}]} is persisted as-is, and downstream event/badge logic that joins these into book lookups mishandles non-string IDs.
WHY:     Malformed event definitions can be saved and later break the user-facing seasonal-event experience (broken book references) with no validation error at create/update time.
FIX:     Validate body.books.every(b => typeof b === 'string' && b.length > 0) (and bound the array length) before persisting in both the POST and PATCH handlers; reject with a 400 otherwise.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/book/admin/events/route.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/book/admin/events/route.ts
git commit -m "fix(correctness): L39 — events POST casts body.books to string[] without per"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L39: committed on fix/L39 (worktree ../cf-fix-L39). Covered: L39."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L39 && git worktree remove ../cf-fix-L39 && git branch -d fix/L39"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 92: L40 — concept-graph route has no route-level auth/active-account guard while paid chapter content is gated
**Lead:** `low` · **Covers:** L40 · **Edits:** `app/app/api/book/books/[bookId]/chapters/[chapterNumber]/route.ts`, `app/app/api/book/books/[bookId]/concept-graph/route.ts`, `middleware.ts`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L40 ../cf-fix-L40 audit/prod-readiness-2026-06-14
cd ../cf-fix-L40
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/book/books/[bookId]/chapters/[chapterNumber]/route.ts, app/app/api/book/books/[bookId]/concept-graph/route.ts, middleware.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- L40 · low · app/app/api/book/books/[bookId]/concept-graph/route.ts:12-44, app/app/api/book/books/[bookId]/chapters/[chapterNumber]/route.ts:22, middleware.ts:38-87
PROBLEM: GET /books/[bookId]/concept-graph resolves the published version and returns the full S3 concept-graph JSON with NO requireUser/requireActiveBookUser call, unlike the sibling chapter route which calls requireActiveBookUser (chapters/[chapterNumber]/route.ts:22). HOWEVER, the original claim that it is 'readable by any unauthenticated caller' is overstated: middleware.ts matches /app/:path* (config matcher line 93), which includes this API path (/app/api/book/...), and rejects requests lacking a present, non-expired id_token cookie (redirecting to /auth/login). So a fully logged-out caller cannot reach it. The real, narrower gap: this route skips the route-level JWT signature verification and the active-account (soft-delete) gating that requireActiveBookUser enforces everywhere else — middleware only does a lightweight cookie-presence/expiry check (line 65-66 comment says full JWT verification happens at the route level). A soft-deleted user (cookie still valid) and any path that doesn't traverse the middleware (defense-in-depth) are exposed.
WHY:     Not an open unauthenticated leak. The defect is an authz inconsistency: derived paid content (chapter concepts + relationships) served without the route-level account guard every other content route uses, so soft-deleted/inactive accounts and any non-middleware access path are not gated. Defense-in-depth gap rather than a critical hole.
FIX:     Add `await requireActiveBookUser()` at the top of the GET handler (mirroring chapters/[chapterNumber]/route.ts) so the concept graph follows the same JWT-verify + active-account model as sibling content routes. If concept graphs are intentionally public/teaser content, document that decision and confirm the JSON contains nothing premium — but the safe default is to gate it like the chapter route.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/book/books/[bookId]/chapters/[chapterNumber]/route.ts app/app/api/book/books/[bookId]/concept-graph/route.ts middleware.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/book/books/[bookId]/chapters/[chapterNumber]/route.ts app/app/api/book/books/[bookId]/concept-graph/route.ts middleware.ts
git commit -m "fix(security): L40 — concept-graph route has no route-level auth/active-a"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L40: committed on fix/L40 (worktree ../cf-fix-L40). Covered: L40."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L40 && git worktree remove ../cf-fix-L40 && git branch -d fix/L40"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 93: L41 — Scenario submissions trigger a Claude moderation call with no per-user submission rate limit
**Lead:** `low` · **Covers:** L41 · **Edits:** `app/app/api/book/me/books/[bookId]/chapters/[chapterNumber]/scenarios/route.ts`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L41 ../cf-fix-L41 audit/prod-readiness-2026-06-14
cd ../cf-fix-L41
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/book/me/books/[bookId]/chapters/[chapterNumber]/scenarios/route.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- L41 · low · app/app/api/book/me/books/[bookId]/chapters/[chapterNumber]/scenarios/route.ts:194-215
PROBLEM: POST scenarios validates input lengths well (title 6-160, scenario/whatToDo/whyItMatters 20/40-2500 via requireString) but applies no per-user/per-day submission cap. Each POST with a configured ANTHROPIC_API_KEY calls validateScenario (a Haiku moderation call, line 211-214) and, on auto_approve, awards Insight Points. A user can repeatedly submit scenarios, each incurring a Haiku cost and potentially farming approval points if the moderator can be coaxed to auto_approve. Lower severity because input is length-bounded and Haiku is cheap, but it is still an uncapped LLM call per submission.
WHY:     Moderate LLM cost-abuse vector plus a points-farming avenue. Cheaper and better-bounded than Ask/feedback, but uncapped.
FIX:     Add a per-user daily submission cap (a BOOKUSER#... SCENARIO_LIMIT#date counter) checked atomically before calling validateScenario — reuse the conditional-counter pattern from the Ask fix (ConditionExpression on count < limit) — or a short per-user cooldown. Independently, since points are awarded on auto_approve, consider rate-limiting point grants per day even when submissions are allowed.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/book/me/books/[bookId]/chapters/[chapterNumber]/scenarios/route.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/book/me/books/[bookId]/chapters/[chapterNumber]/scenarios/route.ts
git commit -m "fix(ops): L41 — Scenario submissions trigger a Claude moderation cal"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L41: committed on fix/L41 (worktree ../cf-fix-L41). Covered: L41."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L41 && git worktree remove ../cf-fix-L41 && git branch -d fix/L41"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 94: L44 — getServerEnv permanently caches missing env vars, so a transient SSM error becomes a permanent 'missing'
**Lead:** `low` · **Covers:** L44 · **Edits:** `app/app/api/_lib/server-env.ts`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L44 ../cf-fix-L44 audit/prod-readiness-2026-06-14
cd ../cf-fix-L44
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/_lib/server-env.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- L44 · low · app/app/api/_lib/server-env.ts:108-118, app/app/api/_lib/server-env.ts:120-139
PROBLEM: The code is exactly as described: when loadFromSsm returns undefined, getServerEnv adds the name to missingCache (a process-lifetime Set) and never retries. HOWEVER the transient-error-poisoning path only occurs when SSM_PREFIX is UNSET: with SSM_PREFIX set, loadFromSsm THROWS the lastError (line 112) instead of returning undefined, so getServerEnv never reaches missingCache.add — the request fails loudly and a later call retries fresh. I verified that every deployed environment SETS SSM_PARAMETER_PREFIX (infra/lib/chapterflow-frontend-stack.ts:364, chapterflow-backend-stack.ts:442, cdk.out templates show '/chapterflow/dev'; .github workflows export SSM_PREFIX). So the 'instance-sticky Stripe price/secret resolves to undefined on some instances' scenario the finding describes CANNOT happen in prod as deployed — it only happens locally / in an unconfigured env where SSM is an explicit optional fallback.
WHY:     In deployed envs (SSM_PREFIX always set): no transient poisoning — transient SSM errors throw and are retried. The only residual: genuinely-absent values are cached as missing for the process lifetime, which is intended/desirable. The poisoning risk is confined to no-prefix dev/local runs.
FIX:     Still worth a small hardening: in loadFromSsm, distinguish 'errored' from 'genuinely absent' even on the no-prefix path (return a sentinel / throw on real errors), or give missingCache a short TTL, so a no-prefix local instance isn't poisoned by a transient blip. Low priority since prod always sets the prefix.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/_lib/server-env.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/_lib/server-env.ts
git commit -m "fix(ops): L44 — getServerEnv permanently caches missing env vars, so"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L44: committed on fix/L44 (worktree ../cf-fix-L44). Covered: L44."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L44 && git worktree remove ../cf-fix-L44 && git branch -d fix/L44"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 95: L46 (+1) — getLambdaHealth reports the MEDIAN of per-bucket percentiles instead of the percentile
**Lead:** `low` · **Covers:** L46, P7 · **Edits:** `app/app/api/book/_lib/cloudwatch-metrics.ts`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 2 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L46 ../cf-fix-L46 audit/prod-readiness-2026-06-14
cd ../cf-fix-L46
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/book/_lib/cloudwatch-metrics.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- L46 · low · app/app/api/book/_lib/cloudwatch-metrics.ts:158-186, app/app/api/book/_lib/cloudwatch-metrics.ts:98-105
PROBLEM: Duration is fetched in 1h buckets (Period:3600) with ExtendedStatistics p50/p95/p99. Each bucket's p95 is collected into p95s[], sorted, then durationP95Ms = Math.round(quantile(p95s, 50)). quantile(sorted,50) returns sorted[floor(0.5*len)] — the median of the 24 hourly p95s, not the 24h p95. Same for P50 and P99 (all wrap quantile(...,50)). This systematically under-reports tail latency. coldStarts is hardcoded 0 with a 'placeholder' comment.
WHY:     Admin Lambda-health dashboard understates p95/p99, masking a tail-latency regression before launch. Admin-only, informational.
FIX:     Fetch a single 24h-period datapoint (Period:86400) with ExtendedStatistics p50/p95/p99 so CloudWatch computes the true percentile; OR at minimum use max(p95s) as a conservative bound. Remove the quantile(...,50) wrapper. Implement coldStarts (init-duration metric) or drop the field.

--- P7 · polish · app/app/api/book/_lib/cloudwatch-metrics.ts:292-334
PROBLEM: Hardcodes DynamoDB $1.25/M writes, $0.25/M reads, $0.25/GB storage; Lambda $0.20/M + $0.0000166667/GB-s; S3 ($0.023/GB further down). daysPerMonth=30. dynamoWritesLast24h/ReadsLast24h are optional and default to 0, so a caller omitting them reports DynamoDB cost as storage-only. Admin-only 'rough' estimate.
WHY:     Admin cost dashboard can be materially off (region/price drift, missing read/write inputs). Labeled rough, not used for billing.
FIX:     Move price constants into one documented config tagged with region + date-of-pricing; require the read/write inputs (or label the output 'storage-only' when absent).

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/book/_lib/cloudwatch-metrics.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/book/_lib/cloudwatch-metrics.ts
git commit -m "fix(correctness): L46, P7 — getLambdaHealth reports the MEDIAN of per-bucket per"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L46: committed on fix/L46 (worktree ../cf-fix-L46). Covered: L46, P7."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L46 && git worktree remove ../cf-fix-L46 && git branch -d fix/L46"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 96: L48 (+1) — ingestBookPackageFromS3 re-validates but stores the RAW unvalidated upload as book.json
**Lead:** `low` · **Covers:** L48, L49 · **Edits:** `app/app/api/book/_lib/ingestion.ts`, `app/app/api/book/_lib/repo.ts`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 2 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L48 ../cf-fix-L48 audit/prod-readiness-2026-06-14
cd ../cf-fix-L48
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/book/_lib/ingestion.ts, app/app/api/book/_lib/repo.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- L48 · low · app/app/api/book/_lib/ingestion.ts:35-37, app/app/api/book/_lib/ingestion.ts:85
PROBLEM: raw = readJsonFromS3(...); pkg = validateBookPackage(raw); manifest/chapters/quizzes are built from the validated/normalized pkg, but line 85 writes book.json as JSON.stringify(raw) — the pre-validation blob. For v21 uploads validateBookPackage dispatches through adaptV21ToV13(raw) (validate-book-package.ts:1222-1223), so pkg is v13-shaped while book.json stays v21-shaped — book.json diverges from every other served artifact. Even non-v21 uploads are normalized (examples re-mapped, defaults applied), so raw still diverges somewhat.
WHY:     Stored canonical book.json disagrees with the served manifest/chapters/quizzes (most starkly for v21 books); confusing for re-ingest/forensics/audits. Admin-only path.
FIX:     Write the validated/adapted pkg as book.json (JSON.stringify(pkg)), OR name the raw artifact original-upload.json and write pkg as book.json so the canonical name matches what is served.

--- L49 · low · app/app/api/book/_lib/ingestion.ts:85-122, app/app/api/book/_lib/repo.ts:344-360, app/app/api/book/_lib/repo.ts:2076 (deleteBookVersion)
PROBLEM: After createBookVersionDraft writes the DRAFT row (48-56), book.json/manifest/chapters/quizzes/concept-graph are written one-by-one in awaited loops (85-105) then meta/catalog upsert + optional publish (107-122), with no try/catch around the S3 writes. A mid-loop throw leaves the draft row + partial S3 objects. getNextVersionNumber (344) always returns latest+1 (no packageId dedup), so a retry/re-upload of the identical package allocates a NEW version, orphaning the partial prefix. deleteBookVersion exists (repo.ts:2076), so a cleanup path is available.
WHY:     Failed ingests leave orphaned partial S3 prefixes and dangling DRAFT rows for manual cleanup; re-uploads multiply versions. Ops burden, not user-facing.
FIX:     Wrap the artifact writes in try/catch; on failure best-effort delete the prefix + call deleteBookVersion(version). Add a packageId-based idempotency check (query existing versions for the same pkg.packageId and reuse) so identical re-uploads don't create new versions.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/book/_lib/ingestion.ts app/app/api/book/_lib/repo.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/book/_lib/ingestion.ts app/app/api/book/_lib/repo.ts
git commit -m "fix(data): L48, L49 — ingestBookPackageFromS3 re-validates but stores the "

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L48: committed on fix/L48 (worktree ../cf-fix-L48). Covered: L48, L49."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L48 && git worktree remove ../cf-fix-L48 && git branch -d fix/L48"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 97: L50 — Unhandled-error logger emits full stack traces to console (potential sensitive-data logging) and there is no error monitor
**Lead:** `low` · **Covers:** L50 · **Edits:** `app/app/api/book/_lib/http.ts` · ⚠ shares a file with Task M10

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L50 ../cf-fix-L50 audit/prod-readiness-2026-06-14
cd ../cf-fix-L50
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/book/_lib/http.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `app/app/api/book/_lib/http.ts`, which Task M10 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- L50 · low · app/app/api/book/_lib/http.ts:57-61
PROBLEM: withBookApiErrors logs book_api_unhandled_error with error.message + full error.stack on every unexpected error; the client envelope is correctly generic ('An unexpected server error occurred.'). Confirmed there is no Sentry/Datadog/error-monitoring sink anywhere in app/ (grep clean of error monitors). The PII-leakage angle is speculative: AWS SDK error messages/stacks generally don't embed full item payloads, and CloudWatch logs are access-controlled.
WHY:     Verbose stack logging could surface identifiers in CloudWatch (low likelihood); the more concrete gap is no real error-monitoring, so prod failures rely on raw log scraping.
FIX:     Keep the generic client response. In prod, log error.name + short message + a correlation id rather than the raw stack, and wire an actual error monitor. requestId is currently computed inside bookErr (from x-amzn-trace-id), not in the catch — compute it once in withBookApiErrors and thread it into both the log line and bookErr for correlation.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/book/_lib/http.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/book/_lib/http.ts
git commit -m "fix(security): L50 — Unhandled-error logger emits full stack traces to co"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L50: committed on fix/L50 (worktree ../cf-fix-L50). Covered: L50."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L50 && git worktree remove ../cf-fix-L50 && git branch -d fix/L50"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 98: L53 — /pricing SEO description advertises 'Challenge mode' that the pricing page never surfaces (copy drift)
**Lead:** `low` · **Covers:** L53 · **Edits:** `app/pricing/page.tsx`, `components/sections/Pricing.tsx` · ⚠ shares a file with Task M26

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L53 ../cf-fix-L53 audit/prod-readiness-2026-06-14
cd ../cf-fix-L53
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/pricing/page.tsx, components/sections/Pricing.tsx.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `components/sections/Pricing.tsx`, which Task M26 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- L53 · low · app/pricing/page.tsx:7-9, components/sections/Pricing.tsx:137-145
PROBLEM: app/pricing/page.tsx:8 metadata description claims Pro gives '...all reading depths, and Challenge mode.' Grep confirms 'Challenge mode' appears in marketing copy ONLY here — the Pricing component's proFeatures (Pricing.tsx:137-145) lists 'Deeper depth mode', 'Priority new title requests', etc. and never mentions Challenge mode, and nothing on the marketing pages explains or Pro-gates it. Challenge mode is a real in-app feature (referenced in app/book/settings, flow-points-economy.ts, ChapterReaderClient, etc.) but the SEO snippet promises a feature the visible pricing page does not corroborate.
WHY:     Mismatch between the search-result snippet and the actual pricing page content — minor trust/clarity hit and a copy-maintenance inconsistency.
FIX:     Either add 'Challenge mode' to the Pro feature list in Pricing.tsx (only if it is genuinely Pro-gated — verify against entitlements/flow-points-economy before claiming) or remove 'and Challenge mode' from the description in app/pricing/page.tsx so the snippet matches the page.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/pricing/page.tsx components/sections/Pricing.tsx

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/pricing/page.tsx components/sections/Pricing.tsx
git commit -m "fix(ux): L53 — /pricing SEO description advertises 'Challenge mode'"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L53: committed on fix/L53 (worktree ../cf-fix-L53). Covered: L53."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L53 && git worktree remove ../cf-fix-L53 && git branch -d fix/L53"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 99: L54 — Contact page sticky header uses invalid inline CSS 'var(--bg-base)/80' so its background never renders
**Lead:** `low` · **Covers:** L54 · **Edits:** `app/contact/page.tsx`, `app/legal/layout.tsx` · ⚠ shares a file with Task H19

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L54 ../cf-fix-L54 audit/prod-readiness-2026-06-14
cd ../cf-fix-L54
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/contact/page.tsx, app/legal/layout.tsx.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `app/contact/page.tsx`, which Task H19 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- L54 · low · app/contact/page.tsx:17, app/legal/layout.tsx:8
PROBLEM: Contact page sticky header (contact/page.tsx:17) sets style={{ background: 'var(--bg-base)/80' }}. The '/80' is Tailwind opacity-modifier syntax, NOT valid CSS; as an inline style the browser discards the entire background declaration. With backdrop-blur-md the header gets no opaque fill, so content scrolling under it shows through with poor contrast. The identical invalid token is also present at app/legal/layout.tsx:8 (verified by grep; technically outside this slice but the same bug on a launch page). The Navbar and BrowseLibraryPage FilterBar use the correct color-mix(in srgb, var(--bg-base) X%, transparent) pattern.
WHY:     On Contact (and legal pages) the sticky header has a transparent/illegible background while scrolling — a visible polish defect on launch pages.
FIX:     Replace with valid CSS: background: 'color-mix(in srgb, var(--bg-base) 80%, transparent)' (matching Navbar.tsx / BrowseLibraryPage FilterBar at lines 508-510). Apply the same fix to app/legal/layout.tsx:8.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/contact/page.tsx app/legal/layout.tsx

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/contact/page.tsx app/legal/layout.tsx
git commit -m "fix(ux): L54 — Contact page sticky header uses invalid inline CSS '"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L54: committed on fix/L54 (worktree ../cf-fix-L54). Covered: L54."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L54 && git worktree remove ../cf-fix-L54 && git branch -d fix/L54"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 100: L55 — Interactive demo auto-advances animated content with no reduced-motion guard or pause control
**Lead:** `low` · **Covers:** L55 · **Edits:** `components/landing/reader-demo/DesktopReaderShell.tsx`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L55 ../cf-fix-L55 audit/prod-readiness-2026-06-14
cd ../cf-fix-L55
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: components/landing/reader-demo/DesktopReaderShell.tsx.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- L55 · low · components/landing/reader-demo/DesktopReaderShell.tsx:33-38,76-86,185-191
PROBLEM: DesktopReaderShell auto-cycles summary->examples->quiz->practice on setTimeout (PHASE_DURATIONS_MS 12000-14000ms; effect at lines 76-86) until the user interacts (hasInteracted ref). Unlike sibling landing components (Problem, SocialProof, MobileStickyBar all consult useReducedMotion), this component never imports or checks useReducedMotion, and there is no explicit pause/play control — the only way to stop is to click into the content (markInteracted). Additionally the phase-transition AnimatePresence motion (lines 185-191, opacity/y on each phase change) animates unconditionally. This is auto-updating moving content >5s with no pause/stop/hide affordance (WCAG 2.2.2).
WHY:     Reduced-motion users get an auto-playing, periodically-transitioning demo; users wanting to self-pace must discover that clicking halts it. Minor accessibility/UX gap.
FIX:     In DesktopReaderShell read useReducedMotion() and skip the auto-advance setTimeout when true (render phases statically / let the user step via the PhaseStepper and ContinueButton, which already exist), and gate the AnimatePresence phase transition (initial/animate/exit at 185-191) behind the same flag. Optionally add a visible pause/play toggle for all users.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint components/landing/reader-demo/DesktopReaderShell.tsx

============ STEP 5 — COMMIT (only after checks pass) ============
git add components/landing/reader-demo/DesktopReaderShell.tsx
git commit -m "fix(accessibility): L55 — Interactive demo auto-advances animated content with"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L55: committed on fix/L55 (worktree ../cf-fix-L55). Covered: L55."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L55 && git worktree remove ../cf-fix-L55 && git branch -d fix/L55"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 101: L56 — Hero/Problem make unsourced absolute retention claims ('only proven method', 'forget the majority within weeks')
**Lead:** `low` · **Covers:** L56 · **Edits:** `components/sections/Hero.tsx`, `components/sections/Problem.tsx`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L56 ../cf-fix-L56 audit/prod-readiness-2026-06-14
cd ../cf-fix-L56
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: components/sections/Hero.tsx, components/sections/Problem.tsx.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- L56 · low · components/sections/Hero.tsx:100-103, components/sections/Problem.tsx:230-236
PROBLEM: Hero.tsx:100 states 'Most readers forget the majority of a book within weeks' as fact. Problem.tsx:234-235 attribution asserts 'Based on Ebbinghaus's Forgetting Curve — active recall is the only proven method to beat it.' 'Only proven method' is an overstatement (spaced repetition, the testing effect, elaboration, interleaving are also evidence-backed — and SocialProof itself credibly cites 'spaced repetition AND active recall'), and the forgetting-curve figure carries no citation. SocialProof.tsx:12-17 documents a deliberate truth rule (no fabricated personas), so these absolute claims are inconsistent with the site's own honesty posture.
WHY:     Pre-launch marketing-claim risk: absolute/unsourced efficacy statements are weaker to defend than the hedged copy used elsewhere.
FIX:     Soften Problem.tsx attribution to e.g. 'active recall is one of the most reliably proven ways to beat it' and either cite Ebbinghaus or frame the Hero line as 'research on the forgetting curve shows...'. Keep consistency with SocialProof's truth-rule comment and its own 'spaced repetition and active recall' phrasing.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint components/sections/Hero.tsx components/sections/Problem.tsx

============ STEP 5 — COMMIT (only after checks pass) ============
git add components/sections/Hero.tsx components/sections/Problem.tsx
git commit -m "fix(correctness): L56 — Hero/Problem make unsourced absolute retention claim"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L56: committed on fix/L56 (worktree ../cf-fix-L56). Covered: L56."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L56 && git worktree remove ../cf-fix-L56 && git branch -d fix/L56"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 102: L57 — BrowseLibraryPage default 'Most popular' sort is essentially reverse-alphabetical because only one book is flagged popular
**Lead:** `low` · **Covers:** L57 · **Edits:** `components/website/BrowseLibraryPage.tsx`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L57 ../cf-fix-L57 audit/prod-readiness-2026-06-14
cd ../cf-fix-L57
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: components/website/BrowseLibraryPage.tsx.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- L57 · low · components/website/BrowseLibraryPage.tsx:64-74, components/website/BrowseLibraryPage.tsx:128-140, components/website/BrowseLibraryPage.tsx:857-895, components/website/BrowseLibraryPage.tsx:1058
PROBLEM: POPULAR_IDS has one id ('crucial-conversations'), NEW_IDS one id, STAFF_PICK_IDS and FREE_IDS empty (lines 64-74). Default sortBy='popular' (line 1058). The 'popular' comparator (line 132) only distinguishes popular-vs-not and otherwise falls back to b.title.localeCompare(a.title) — reverse alphabetical. So the default library view is one popular book on top followed by reverse-alphabetical order, labeled 'Most popular'. The curated CategoryRows (lines 857-895) require >=MIN_CURATED_ROW(3) items: Staff Picks (popularBooks) and Recently Added (newBooks) each have 1, so both rows never render and the 'Start Here' fallback (line 893-895) always shows. The FEATURED_REASON comment already acknowledges these are hand-picked, not telemetry.
WHY:     The default view presents an arbitrary (reverse-alphabetical) order under a 'Most popular' label, and the curated discovery rows are dead in practice. No data corruption — a weaker first impression and a label that mildly overstates the curation behind the ordering.
FIX:     Either populate POPULAR_IDS/NEW_IDS/STAFF_PICK_IDS with a real curated set of >=3 each (so the rows render and the sort is meaningful), or change the default sortBy to 'alphabetical'/'newest' and rename the 'popular' SORT_OPTIONS label to 'Featured' so it matches the hand-picked-id reality already documented in FEATURED_REASON.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint components/website/BrowseLibraryPage.tsx

============ STEP 5 — COMMIT (only after checks pass) ============
git add components/website/BrowseLibraryPage.tsx
git commit -m "fix(data): L57 — BrowseLibraryPage default 'Most popular' sort is ess"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L57: committed on fix/L57 (worktree ../cf-fix-L57). Covered: L57."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L57 && git worktree remove ../cf-fix-L57 && git branch -d fix/L57"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 103: L58 (+1) — Privacy Policy effective date (April 2, 2026) predates the data practices it describes; CASL/analytics sections are newer than the stated date
**Lead:** `low` · **Covers:** L58, P9 · **Edits:** `app/globals.css`, `app/legal/privacy/page.tsx` · context: `app/legal/cookies/page.tsx`, `app/legal/copyright/page.tsx`, `app/legal/data-rights/page.tsx`, `app/legal/refund/page.tsx`, `app/legal/terms/page.tsx` · ⚠ shares a file with Task H19/M28

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 2 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L58 ../cf-fix-L58 audit/prod-readiness-2026-06-14
cd ../cf-fix-L58
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/globals.css, app/legal/privacy/page.tsx.
- Read-only context (do NOT edit, just read for understanding): app/legal/cookies/page.tsx, app/legal/copyright/page.tsx, app/legal/data-rights/page.tsx, app/legal/refund/page.tsx, app/legal/terms/page.tsx.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `app/legal/privacy/page.tsx`, which Task H19/M28 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- L58 · low · app/legal/privacy/page.tsx:18-19, app/legal/privacy/page.tsx:36-45, app/legal/privacy/page.tsx:150-171
PROBLEM: Privacy is dated 'April 2, 2026' but documents practices that match the June 2026 build: opt-in analytics with ip-api.com geolocation (privacy:36-45, 89), the Anthropic scenario-review pipeline (privacy:88), CASL email controls (privacy:150-171), and the refresh-token/auth_expires_at session model (privacy:73). The Refund/Copyright/Data-Rights pages all carry 'June 10, 2026', so the April date is a missed bump rather than an intentional older snapshot. This overlaps the version-mismatch finding (#3) but is flagged separately because it also affects users who expect the effective date to reflect when these specific analytics/location/CASL provisions took effect.
WHY:     Minor accuracy/consistency issue; an effective date earlier than the practices it documents looks careless and could be cited in a privacy complaint as evidence the policy was not kept current. Largely subsumed by finding #3's fix.
FIX:     Bump privacy/page.tsx:18 (and terms/page.tsx:18) effective dates to June 10, 2026 to align with the other three legal pages and LEGAL_TERMS_VERSION; keep them in sync going forward (ideally derive from LEGAL_TERMS_VERSION). Fixing #3 resolves this.

--- P9 · polish · app/legal/privacy/page.tsx:10, app/legal/terms/page.tsx:10, app/legal/cookies/page.tsx:10, app/legal/refund/page.tsx:12, app/legal/copyright/page.tsx:15, app/legal/data-rights/page.tsx:12, app/globals.css:3
PROBLEM: All six legal pages wrap content in <article className="prose-legal">. CORRECTION/refinement to the original: the @tailwindcss/typography plugin IS installed and loaded (globals.css:3 '@plugin "@tailwindcss/typography"'), so 'prose' variants are available — but 'prose-legal' is not one of them. The plugin ships prose, prose-{sm,lg,xl,2xl}, prose-invert, and color themes (prose-gray, prose-cyan, etc.); 'legal' is not a registered modifier and no custom variant or .prose-legal rule is defined anywhere in CSS (grep across all .css files returns no definition). So prose-legal is an unmatched/no-op class; the pages render correctly only because every element carries inline style overrides.
WHY:     No functional impact (inline styles cover rendering). Maintainability only: a future dev may assume prose-legal controls legal typography and edit it expecting an effect, or assume the typography plugin is styling these pages when it is not.
FIX:     Either register a real 'legal' prose variant / define a .prose-legal rule that centralizes legal typography (then thin out the repeated inline style props across the six pages), or remove the unused className from the six legal articles. Centralizing is the better long-term move given the heavy inline-style duplication.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/legal/privacy/page.tsx

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/globals.css app/legal/privacy/page.tsx
git commit -m "fix(correctness): L58, P9 — Privacy Policy effective date (April 2, 2026) predat"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L58: committed on fix/L58 (worktree ../cf-fix-L58). Covered: L58, P9."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L58 && git worktree remove ../cf-fix-L58 && git branch -d fix/L58"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 104: L64 (+1) — Terms/Privacy consent from signup is only persisted at onboarding completion (client-side gate otherwise)
**Lead:** `low` · **Covers:** L64, P1 · **Edits:** `app/signup/page.tsx` · context: `app/app/api/book/me/onboarding/complete/route.ts`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 2 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L64 ../cf-fix-L64 audit/prod-readiness-2026-06-14
cd ../cf-fix-L64
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/signup/page.tsx.
- Read-only context (do NOT edit, just read for understanding): app/app/api/book/me/onboarding/complete/route.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- L64 · low · app/signup/page.tsx:33,46-56,80-109, app/app/api/book/me/onboarding/complete/route.ts:283-301
PROBLEM: Signup gates startOAuth/startEmail on `consented` (page.tsx:47,52) but never records acceptance at consent time — it's a pure client-side gate. The 'Sign in' link (173) doesn't require the checkbox at all. The authoritative termsAcceptedAt/termsVersion stamp is written only in the onboarding-complete route's firstCompletion block (route.ts:283-301). A user who consents, signs up, then abandons before finishing onboarding — or who signs in via the bottom link — has no server-recorded consent despite potentially reading content.
WHY:     Compliance/audit gap: the app cannot prove a user accepted Terms/Privacy unless they completed onboarding; consent for abandoners is unrecorded.
FIX:     Record consent server-authoritatively when given — e.g. pass agreed=1 through /auth/login state and stamp termsAcceptedAt in the auth callback on first account creation, or stamp on first authenticated page load — rather than only at onboarding completion. (Cross-check with the issue-11 legal-polish initiative before implementing, since terms-acceptance stamping is owned there.)

--- P1 · polish · app/signup/page.tsx:47, app/signup/page.tsx:51, app/signup/page.tsx:155
PROBLEM: startOAuth (signup:46-49) and startEmail (signup:51-56) both early-return on !consented with no feedback. The OAuth/Continue buttons ARE disabled when !consented (signup:117,127,162 disabled={!consented}/{!emailReady}), so those paths are visually gated. BUT the email input's onKeyDown Enter handler (signup:155: `onKeyDown={(e) => e.key === 'Enter' && startEmail()}`) calls startEmail() unconditionally — so a user who types an email and presses Enter without ticking consent gets a silent no-op with zero indication why. Confirmed.
WHY:     Minor top-of-funnel confusion: pressing Enter with consent unchecked does nothing and gives no pointer to the consent checkbox — a small conversion paper-cut.
FIX:     Surface a hint when blocked by !consented: set an error state ('Please agree to the Terms to continue') or briefly highlight the consent row, instead of the silent return in startEmail/startOAuth. Or at minimum gate the Enter handler to match the button: `onKeyDown={(e) => e.key === 'Enter' && emailReady && startEmail()}` (emailReady already = consented && email non-empty, signup:58) so behavior is consistent — though that still gives no reason, so pairing with a visible hint is better.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/signup/page.tsx

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/signup/page.tsx
git commit -m "fix(data): L64, P1 — Terms/Privacy consent from signup is only persisted "

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L64: committed on fix/L64 (worktree ../cf-fix-L64). Covered: L64, P1."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L64 && git worktree remove ../cf-fix-L64 && git branch -d fix/L64"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 105: L65 — AudioPlayer resets playback speed to 1x on every (re)load while UI still shows the chosen speed
**Lead:** `low` · **Covers:** L65 · **Edits:** `app/book/library/[bookId]/chapter/[chapterId]/components/AudioPlayer.tsx`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L65 ../cf-fix-L65 audit/prod-readiness-2026-06-14
cd ../cf-fix-L65
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/book/library/[bookId]/chapter/[chapterId]/components/AudioPlayer.tsx.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- L65 · low · app/book/library/[bookId]/chapter/[chapterId]/components/AudioPlayer.tsx:217-222, app/book/library/[bookId]/chapter/[chapterId]/components/AudioPlayer.tsx:133-145, app/book/library/[bookId]/chapter/[chapterId]/components/AudioPlayer.tsx:55-124
PROBLEM: playbackRate is assigned ONLY inside cycleSpeed (line 221). When loadAudio sets a new src (first open, settings change forcing reload, or error 'try again'), the <audio> element's playbackRate reverts to the default 1x, but the speed state (and the Nx pill) is unchanged. onCanPlay (lines 133-145) sets duration and auto-plays but never reapplies playbackRate.
WHY:     A reader who set 1.5x then changes reading depth/tone (forcing an audio reload) hears 1x while the control still reads 1.5x — their preference is silently ignored.
FIX:     In onCanPlay set audio.playbackRate = speed before auto-play. Because the audio-events effect deps are [open] (line 195), read speed from a ref (a speedRef kept in sync) so the latest value is applied after each load rather than a stale closure value. Optionally also set it right after assigning src in loadAudio.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/book/library/[bookId]/chapter/[chapterId]/components/AudioPlayer.tsx

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/book/library/[bookId]/chapter/[chapterId]/components/AudioPlayer.tsx
git commit -m "fix(ux): L65 — AudioPlayer resets playback speed to 1x on every (re"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L65: committed on fix/L65 (worktree ../cf-fix-L65). Covered: L65."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L65 && git worktree remove ../cf-fix-L65 && git branch -d fix/L65"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 106: L67 — Full book detail is re-fetched server-side on every chapter navigation
**Lead:** `low` · **Covers:** L67 · **Edits:** `app/app/api/book/_lib/library-catalog.ts`, `app/book/library/[bookId]/chapter/[chapterId]/page.tsx`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L67 ../cf-fix-L67 audit/prod-readiness-2026-06-14
cd ../cf-fix-L67
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/book/_lib/library-catalog.ts, app/book/library/[bookId]/chapter/[chapterId]/page.tsx.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- L67 · low · app/book/library/[bookId]/chapter/[chapterId]/page.tsx:11-35, app/book/library/[bookId]/chapter/[chapterId]/page.tsx:45, app/app/api/book/_lib/library-catalog.ts:145-186
PROBLEM: ChapterReaderPage.loadBook calls getPublishedLibraryBookDetail on every chapter load just to resolve route chapterId → chapter and pass initialBook. getPublishedLibraryBookDetail (library-catalog.ts:150-154) does three reads in parallel each call — catalog DynamoDB get, S3 catalog-index read, and the published manifest read — with NO React cache()/unstable_cache wrapper or Next revalidate hint (confirmed: getPublishedLibraryBookDetail is a plain async function, not cache()-wrapped). Sequential chapter navigation (pass quiz → next chapter) re-loads the whole manifest each time.
WHY:     Extra latency and DynamoDB/S3 cost on the hot chapter-to-chapter path; for long books the per-navigation manifest load is wasteful since the chapter list rarely changes within a session.
FIX:     Wrap the published-manifest/detail read in React cache() (per-request dedupe) and/or an in-memory/edge cache keyed by bookId + publishedVersion (already returned at line 183) with a short revalidate, so sequential navigations reuse the manifest instead of re-querying the full detail.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/book/_lib/library-catalog.ts app/book/library/[bookId]/chapter/[chapterId]/page.tsx

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/book/_lib/library-catalog.ts app/book/library/[bookId]/chapter/[chapterId]/page.tsx
git commit -m "fix(performance): L67 — Full book detail is re-fetched server-side on every "

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L67: committed on fix/L67 (worktree ../cf-fix-L67). Covered: L67."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L67 && git worktree remove ../cf-fix-L67 && git branch -d fix/L67"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 107: L68 — Progress 'Reading Activity' empty-state CTA renders literal '→' instead of an arrow
**Lead:** `low` · **Covers:** L68 · **Edits:** `components/progress/EmptyState.tsx`, `components/progress/ReadingActivity.tsx`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L68 ../cf-fix-L68 audit/prod-readiness-2026-06-14
cd ../cf-fix-L68
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: components/progress/EmptyState.tsx, components/progress/ReadingActivity.tsx.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- L68 · low · components/progress/ReadingActivity.tsx:191, components/progress/EmptyState.tsx:63
PROBLEM: ReadingActivity.tsx:191 passes ctaLabel as a JSX attribute string literal `ctaLabel="Start Reading →"`. The actual source text is the six characters backslash-u-2-1-9-2 (NOT a literal arrow character as the original finding implied). JSX attribute string values are not processed for backslash escape sequences, so EmptyState renders the verbatim text via {ctaLabel} (EmptyState.tsx:63). Every other arrow/em-dash in these files is correctly written as a JS expression child, e.g. {"→"}; line 191 is the only attribute-literal instance.
WHY:     A first-run user with no reading data sees a broken CTA reading 'Start Reading →' on the Progress page's Reading Activity card — a visibly unpolished bug on a primary first-run surface.
FIX:     Change ReadingActivity.tsx:191 to `ctaLabel={"Start Reading →"}` (JS expression so the escape is interpreted) or use the literal arrow glyph directly: `ctaLabel="Start Reading →"`. Note the original fix text mis-stated that the current value already contains a literal arrow; it does not — it contains the raw escape sequence, which is exactly why this reproduces.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint components/progress/EmptyState.tsx components/progress/ReadingActivity.tsx

============ STEP 5 — COMMIT (only after checks pass) ============
git add components/progress/EmptyState.tsx components/progress/ReadingActivity.tsx
git commit -m "fix(ux): L68 — Progress 'Reading Activity' empty-state CTA renders "

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L68: committed on fix/L68 (worktree ../cf-fix-L68). Covered: L68."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L68 && git worktree remove ../cf-fix-L68 && git branch -d fix/L68"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 108: L70 (+1) — Two parallel CSS token systems (--cf-* vs legacy --bg-/--text-/--accent-) split across sibling surfaces
**Lead:** `low` · **Covers:** L70, L72 · **Edits:** `app/globals.css`, `components/workspace/RewardsCard.tsx`, `components/workspace/WorkspacePage.tsx` · context: `components/library/LibraryPage.tsx`, `components/progress/ProgressPage.tsx` · ⚠ shares a file with Task H7/L29

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 2 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L70 ../cf-fix-L70 audit/prod-readiness-2026-06-14
cd ../cf-fix-L70
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/globals.css, components/workspace/RewardsCard.tsx, components/workspace/WorkspacePage.tsx.
- Read-only context (do NOT edit, just read for understanding): components/library/LibraryPage.tsx, components/progress/ProgressPage.tsx.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `components/workspace/WorkspacePage.tsx`, which Task H7/L29 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- L70 · low · components/workspace/WorkspacePage.tsx, components/library/LibraryPage.tsx, components/progress/ProgressPage.tsx, app/globals.css:200, app/globals.css:317
PROBLEM: The dashboard (components/workspace/*) is themed predominantly with the newer --cf-* family (19 unique vs 7 legacy), library (components/library/*) with the older --bg-/--text-/--accent- family (19 legacy vs 5 cf), and progress mixes both (18 cf vs 14 legacy). Both families are fully defined with dark+light variants in globals.css and resolve to identical values (e.g. --cf-text-1 and --text-heading both #F7F8FA dark / #1C1917 light; --cf-accent and --accent-cyan both #22D3EE / #0E7490). No undefined var() references in scope — nothing is broken; duplicate values are maintained twice.
WHY:     Pure maintenance/drift risk: a theme tweak must be applied in two token families to stay consistent across dashboard vs library, and contributors must know which family a surface uses. No user-facing breakage.
FIX:     Pick one canonical family (the --cf-* set is the newer convention) and alias the legacy tokens to it in globals.css (e.g. --text-heading: var(--cf-text-1)), then migrate library/progress components onto canonical names over time. Cleanup, not a launch blocker.

--- L72 · low · components/workspace/WorkspacePage.tsx:332, components/workspace/RewardsCard.tsx:19
PROBLEM: WorkspacePage.tsx:333-334 hardcodes nextReward = {name: INSIGHT_POINTS_REWARDS[0].name, pointsRequired: INSIGHT_POINTS_REWARDS[0].costPoints} regardless of balance. The catalog is sorted ascending by cost (900, 2400, 6500). RewardsCard.tsx:19 renders `progress = min(insightPoints/pointsRequired*100, 100)`. A user with more than 900 IP sees a permanently 100%-full bar still labeled with the cheapest reward as 'next', never advancing to a genuinely next goal.
WHY:     The rewards progress indicator becomes meaningless for users past the first tier — caps at 100% and never advances. Cosmetic, limited to the dashboard rewards card.
FIX:     Select the first reward whose costPoints exceeds the current balance, falling back to the highest when all are affordable: `INSIGHT_POINTS_REWARDS.find(r => r.costPoints > analytics.insightPoints) ?? INSIGHT_POINTS_REWARDS.at(-1)`, and feed that into nextReward. Works because the catalog is cost-ascending. Ideally also skip already-claimed oneTimePerUser rewards, but that claim state isn't passed into this mapper (it lives in the flow-points route), so the cost-based fix is the appropriate in-slice improvement.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint components/workspace/RewardsCard.tsx components/workspace/WorkspacePage.tsx

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/globals.css components/workspace/RewardsCard.tsx components/workspace/WorkspacePage.tsx
git commit -m "fix(maintainability): L70, L72 — Two parallel CSS token systems (--cf-* vs legacy --b"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L70: committed on fix/L70 (worktree ../cf-fix-L70). Covered: L70, L72."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L70 && git worktree remove ../cf-fix-L70 && git branch -d fix/L70"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 109: L71 — Library 'Recently added' sort just reverses catalog order (no real recency signal)
**Lead:** `low` · **Covers:** L71 · **Edits:** `components/library/BrowseAll.tsx`, `components/library/libraryData.ts` · ⚠ shares a file with Task L92/P14

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L71 ../cf-fix-L71 audit/prod-readiness-2026-06-14
cd ../cf-fix-L71
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: components/library/BrowseAll.tsx, components/library/libraryData.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `components/library/libraryData.ts`, which Task L92/P14 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- L71 · low · components/library/BrowseAll.tsx:168, components/library/libraryData.ts:1311
PROBLEM: BrowseAll.tsx:168-169 implements the 'recent' sort as `case 'recent': result.reverse(); break;`, and SORT_OPTIONS labels it 'Recently added' (libraryData.ts:1311). LibraryBook has no addedAt/publishedAt/createdAt field (verified), and catalog order is not a date ordering, so reversing it does not correspond to recency — an arbitrary deterministic reorder presented as chronological. The code even comments that 'featured' keeps 'the catalog's curated order (no fabricated metric)' (BrowseAll.tsx:154), yet 'recent' reverses that same curated order.
WHY:     Mild data-honesty issue on one optional sort. Low blast radius, but it is exactly the fabricated-signal class this surface was scrubbed of (popular/completion sorts were already removed for the same reason).
FIX:     Remove the 'recent' option from SORT_OPTIONS until a real addedAt/publishedAt field exists on LibraryCatalogBook, or wire it to a genuine date field once available. If the catalog array is genuinely maintained newest-last, relabel honestly (e.g. 'Catalog order (newest last)').

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint components/library/BrowseAll.tsx components/library/libraryData.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add components/library/BrowseAll.tsx components/library/libraryData.ts
git commit -m "fix(data): L71 — Library 'Recently added' sort just reverses catalog "

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L71: committed on fix/L71 (worktree ../cf-fix-L71). Covered: L71."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L71 && git worktree remove ../cf-fix-L71 && git branch -d fix/L71"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 110: L73 — Reflection filter and "reflection" entry type never produced by the notebook API (always-empty filter)
**Lead:** `low` · **Covers:** L73 · **Edits:** `app/book/notebook/NotebookClient.tsx` · context: `app/app/api/book/me/notebook/route.ts`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L73 ../cf-fix-L73 audit/prod-readiness-2026-06-14
cd ../cf-fix-L73
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/book/notebook/NotebookClient.tsx.
- Read-only context (do NOT edit, just read for understanding): app/app/api/book/me/notebook/route.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- L73 · low · app/book/notebook/NotebookClient.tsx:157-170,24,31, app/app/api/book/me/notebook/route.ts:50-112
PROBLEM: NotebookClient renders a fixed filter set ['all','note','reflection','bookmark','commitment'] (line 157) with a 'Reflection' label (TYPE_LABELS line 31) and icon (line 24). The /me/notebook route only ever emits type 'note' (route.ts:54), 'bookmark' (line 73), and 'commitment' (line 107) — never 'reflection'. Selecting the 'Reflection' filter always yields the empty 'No entries match' state.
WHY:     A permanently-dead filter tab that always returns zero results, implying the user has no reflections.
FIX:     Cheapest: drop 'reflection' from the NotebookClient filter list (and remove its now-unused TYPE_LABELS/icon entries). Alternatively have the API classify commitment follow-through as type 'reflection' so the tab has content.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/book/notebook/NotebookClient.tsx

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/book/notebook/NotebookClient.tsx
git commit -m "fix(correctness): L73 — Reflection filter and 'reflection' entry type never "

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L73: committed on fix/L73 (worktree ../cf-fix-L73). Covered: L73."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L73 && git worktree remove ../cf-fix-L73 && git branch -d fix/L73"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 111: L75 — Division-by-zero NaN width on journey/event progress bars when a journey has 0 books
**Lead:** `low` · **Covers:** L75 · **Edits:** `app/book/journeys/JourneysClient.tsx` · context: `app/book/journeys/[journeyId]/JourneyDetailClient.tsx`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L75 ../cf-fix-L75 audit/prod-readiness-2026-06-14
cd ../cf-fix-L75
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/book/journeys/JourneysClient.tsx.
- Read-only context (do NOT edit, just read for understanding): app/book/journeys/[journeyId]/JourneyDetailClient.tsx.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- L75 · low · app/book/journeys/JourneysClient.tsx:112,154, app/book/journeys/[journeyId]/JourneyDetailClient.tsx:150-151
PROBLEM: JourneysClient sets the active-journey bar width as `${(completedCount / totalBooks) * 100}%` (line 154) with totalBooks = journey.books.length (line 112) and no zero-guard; an empty books array makes width 'NaN%' (invalid style). JourneyDetailClient already guards the same computation with `totalBooks > 0 ? ... : 0` (line 151), so the list view is inconsistent with its own detail view. Only fires on a malformed/empty journey definition; current content ships non-empty journeys.
WHY:     A malformed/empty journey definition renders a broken NaN% progress bar in the list view. Limited because current content has books.
FIX:     In JourneysClient line 154 mirror the detail view: style={{ width: totalBooks > 0 ? `${(completedCount/totalBooks)*100}%` : '0%' }}.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/book/journeys/JourneysClient.tsx

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/book/journeys/JourneysClient.tsx
git commit -m "fix(correctness): L75 — Division-by-zero NaN width on journey/event progress"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L75: committed on fix/L75 (worktree ../cf-fix-L75). Covered: L75."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L75 && git worktree remove ../cf-fix-L75 && git branch -d fix/L75"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 112: L76 — BadgeCelebration hero effect has stale-closure deps and uncleared staggered timeouts
**Lead:** `low` · **Covers:** L76 · **Edits:** `app/book/badges/components/BadgeCelebration.tsx`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L76 ../cf-fix-L76 audit/prod-readiness-2026-06-14
cd ../cf-fix-L76
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/book/badges/components/BadgeCelebration.tsx.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- L76 · low · app/book/badges/components/BadgeCelebration.tsx:64-118
PROBLEM: The hero-celebration useEffect depends only on [heroBadge, dismissed, reduced] (line 88) but reads heroLevel, sorted, onDismiss and calls handleDismissHero (which reads remainingBadges/onDismiss) — none in deps — so it captures stale values across re-renders. handleDismissHero schedules a chain of setTimeout toast pushes (lines 96-105, 108-113) that are never tracked or cleared on unmount or when newlyEarned changes mid-sequence, risking setState-after-unmount and replayed/late toasts. getCelebrationLevel maps silver/gold->modal and platinum/secret->epic (lines 31-34), and the modal/epic dismiss paths are exactly the ones that schedule the uncleared timeouts, so this is reachable on any non-bronze burst. Mostly benign on the common path because newlyEarned clears on dismiss.
WHY:     Edge-case React state-after-unmount warnings and possible duplicated/late toasts during rapid badge bursts; not a crash on the common path.
FIX:     Track the staggered timeout ids in a ref and clear them in the effect cleanup and on dismiss; wrap handleDismissHero in useCallback and add the read values (heroLevel, sorted, onDismiss) to the effect dependency array (or pass them in).

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/book/badges/components/BadgeCelebration.tsx

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/book/badges/components/BadgeCelebration.tsx
git commit -m "fix(correctness): L76 — BadgeCelebration hero effect has stale-closure deps "

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L76: committed on fix/L76 (worktree ../cf-fix-L76). Covered: L76."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L76 && git worktree remove ../cf-fix-L76 && git branch -d fix/L76"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 113: L77 — Delete/Deactivate modals close on failure, hiding the error behind a transient toast
**Lead:** `low` · **Covers:** L77 · **Edits:** `app/book/settings/components/DangerZone.tsx` · context: `app/book/settings/BookSettingsClient.tsx`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L77 ../cf-fix-L77 audit/prod-readiness-2026-06-14
cd ../cf-fix-L77
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/book/settings/components/DangerZone.tsx.
- Read-only context (do NOT edit, just read for understanding): app/book/settings/BookSettingsClient.tsx.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- L77 · low · app/book/settings/components/DangerZone.tsx:28-47, app/book/settings/BookSettingsClient.tsx:1500-1527
PROBLEM: DangerZone.handleConfirmDelete (DangerZone.tsx:28-39) and handleConfirmDeactivate (41-47) await onDelete()/onDeactivate() then unconditionally setLoading(false) and close the modal. The handlers in BookSettingsClient (1500-1527) catch fetch failures internally and only call showToast(...) — they never throw or return a failure signal — so on a failed delete/deactivate the awaited promise resolves successfully, the modal closes, and only a transient toast remains. On success window.location.href redirects to /auth/logout (so the success path is fine), but the failure path closes the destructive modal as if it worked.
WHY:     On a backend failure during account deletion/deactivation, the destructive modal closes silently with only a 2-3s toast — on the most sensitive flow, the user who just typed DELETE may believe it succeeded. Low because the endpoints exist and the happy path redirects; the gap is failure UX only.
FIX:     Have onDelete/onDeactivate signal failure: in BookSettingsClient throw on !res.ok (and in catch) instead of swallowing with showToast. In DangerZone wrap the await in try/catch — on rejection, setLoading(false) but keep the modal open and render an inline error (e.g. a state string shown above the buttons); only close/redirect on success. The Dialog already prevents close-while-loading, so this is a localized change.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/book/settings/components/DangerZone.tsx

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/book/settings/components/DangerZone.tsx
git commit -m "fix(ux): L77 — Delete/Deactivate modals close on failure, hiding th"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L77: committed on fix/L77 (worktree ../cf-fix-L77). Covered: L77."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L77 && git worktree remove ../cf-fix-L77 && git branch -d fix/L77"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 114: L78 — Settings search index omits the privacy/analytics consent toggle and welcome-back emails
**Lead:** `low` · **Covers:** L78 · **Edits:** `app/book/settings/BookSettingsClient.tsx`, `app/book/settings/constants/searchKeywords.ts` · context: `app/book/settings/hooks/useSettingsSearch.ts`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L78 ../cf-fix-L78 audit/prod-readiness-2026-06-14
cd ../cf-fix-L78
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/book/settings/BookSettingsClient.tsx, app/book/settings/constants/searchKeywords.ts.
- Read-only context (do NOT edit, just read for understanding): app/book/settings/hooks/useSettingsSearch.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- L78 · low · app/book/settings/constants/searchKeywords.ts:224-273, app/book/settings/BookSettingsClient.tsx:1355-1365, app/book/settings/BookSettingsClient.tsx:1307-1318, app/book/settings/hooks/useSettingsSearch.ts:16-34
PROBLEM: SETTINGS_SEARCH_INDEX (searchKeywords.ts) has no entry for the 'Share usage analytics' privacy toggle (rendered at BookSettingsClient.tsx:1355, id='analytics') nor for 'Welcome-back emails' (id='welcome-back', line 1307). A targeted grep confirms the words privacy/telemetry/consent/welcome/data-sharing do not appear anywhere in the index (only unrelated 'tracking' on letter-spacing and streak). useSettingsSearch matches against label+description+section+keywords and requires all query words present; the page (isSectionVisible) filters at section granularity. Result: searching 'analytics', 'privacy', 'consent', 'telemetry', or 'welcome back' returns no results and the section is hidden. Searching 'account' still works because each item carries section:'account' in its searchable string.
WHY:     Users searching for their primary privacy/consent control (analytics) or welcome-back emails get a no-results screen, making a consent control hard to find. Minor but unfortunate for a privacy control.
FIX:     Add SETTINGS_SEARCH_INDEX entries: id 'analytics' (section 'account', keywords: analytics, privacy, tracking, data, telemetry, consent, usage) and id 'welcome-back' (section 'notifications', keywords: welcome, back, return, comeback, email). Optionally, since matching is section-granular, auto-expand a matched-but-collapsed section so the matched row is visible (the page currently shows the section but does not force-expand it).

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/book/settings/BookSettingsClient.tsx app/book/settings/constants/searchKeywords.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/book/settings/BookSettingsClient.tsx app/book/settings/constants/searchKeywords.ts
git commit -m "fix(ux): L78 — Settings search index omits the privacy/analytics co"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L78: committed on fix/L78 (worktree ../cf-fix-L78). Covered: L78."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L78 && git worktree remove ../cf-fix-L78 && git branch -d fix/L78"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 115: L80 — Retention 'Reading frequency' card shows all-zeros during load instead of a skeleton
**Lead:** `low` · **Covers:** L80 · **Edits:** `app/book/admin/_clients/RetentionClient.tsx`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L80 ../cf-fix-L80 audit/prod-readiness-2026-06-14
cd ../cf-fix-L80
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/book/admin/_clients/RetentionClient.tsx.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- L80 · low · app/book/admin/_clients/RetentionClient.tsx:99-106
PROBLEM: Unlike the sibling cohort heatmap and streak-distribution cards (which both gate on `loading && !data ? <ChartSkeleton/> :`, lines 90 and 111), the 'Reading frequency' AdminCard (lines 99-106) has no loading guard. While the request is in flight it renders four FreqRow bars with `data?.frequency.* ?? 0` and `total = 0`, painting 0 / 0% / 'of 0' before snapping to real numbers — looks like real (wrong) data, not a loading state.
WHY:     Admins briefly see a fabricated-looking all-zero frequency breakdown on every page load, undermining trust in the numbers. Low severity (transient, single card).
FIX:     Wrap the FreqRow block in `loading && !data ? (<div className='space-y-2'>{Array.from({length:4}).map((_,i)=>(<div key={i} className='h-8 animate-pulse rounded bg-(--cf-surface-muted)'/>))}</div>) : (...)`, mirroring the ChartSkeleton/animate-pulse pattern of the sibling cards.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/book/admin/_clients/RetentionClient.tsx

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/book/admin/_clients/RetentionClient.tsx
git commit -m "fix(ux): L80 — Retention 'Reading frequency' card shows all-zeros d"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L80: committed on fix/L80 (worktree ../cf-fix-L80). Covered: L80."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L80 && git worktree remove ../cf-fix-L80 && git branch -d fix/L80"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 116: L81 — Currency-formatted KPIs always render a bare '$' though amounts are CAD
**Lead:** `low` · **Covers:** L81 · **Edits:** `app/book/admin/_clients/BillingClient.tsx`, `app/book/admin/_clients/RevenueClient.tsx`, `app/book/admin/_components/KPITile.tsx`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L81 ../cf-fix-L81 audit/prod-readiness-2026-06-14
cd ../cf-fix-L81
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/book/admin/_clients/BillingClient.tsx, app/book/admin/_clients/RevenueClient.tsx, app/book/admin/_components/KPITile.tsx.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- L81 · low · app/book/admin/_components/KPITile.tsx:92-98, app/book/admin/_clients/RevenueClient.tsx:104-115, app/book/admin/_clients/BillingClient.tsx:109-120
PROBLEM: KPITile.formatValue (KPITile.tsx:94) hardcodes `$${value.toLocaleString()}` for format='currency'. The revenue/billing endpoints return currency:'CAD' (RevenueClient mrr.currency / arr.currency, BillingClient data.currency), but MRR/ARR/Real-MRR tiles show e.g. '$12,345' with the currency code appearing only in the small hint text (RevenueClient.tsx:108,114; BillingClient.tsx:113,119). A bare '$' reads as USD to anyone scanning the KPIs.
WHY:     Revenue KPIs are ambiguous and can be misread as USD by anyone scanning (investors, finance), potentially overstating real money by the CAD/USD spread. Low severity since the code is present in the hint.
FIX:     Add a `currency?: string` prop to KPITile and render it in formatValue, e.g. `$${value.toLocaleString()}${currency ? ` ${currency}` : ''}` or use Intl.NumberFormat(undefined,{style:'currency',currency}). Pass data.mrr.currency/arr.currency (RevenueClient) and data.currency (BillingClient) through the prop.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/book/admin/_clients/BillingClient.tsx app/book/admin/_clients/RevenueClient.tsx app/book/admin/_components/KPITile.tsx

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/book/admin/_clients/BillingClient.tsx app/book/admin/_clients/RevenueClient.tsx app/book/admin/_components/KPITile.tsx
git commit -m "fix(correctness): L81 — Currency-formatted KPIs always render a bare '$' tho"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L81: committed on fix/L81 (worktree ../cf-fix-L81). Covered: L81."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L81 && git worktree remove ../cf-fix-L81 && git branch -d fix/L81"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 117: L82 — Ops ingestion 'view' error link is a dead element (no href/action)
**Lead:** `low` · **Covers:** L82 · **Edits:** `app/book/admin/_clients/OpsClient.tsx`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L82 ../cf-fix-L82 audit/prod-readiness-2026-06-14
cd ../cf-fix-L82
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/book/admin/_clients/OpsClient.tsx.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- L82 · low · app/book/admin/_clients/OpsClient.tsx:389-395
PROBLEM: In the Recent ingestion jobs table, when a job has an errorReportKey the cell renders `<span className='text-(--cf-danger-text)'>view</span>` (OpsClient.tsx:390-392) — styled red like an actionable link but with no onClick and no href. Clicking does nothing. The errorReportKey (the S3 key to fetch the report) is present on the row but unused.
WHY:     Admins triaging a failed book ingestion see a 'view' affordance that is a no-op, dead-ending the debugging flow. Low severity (cosmetic affordance; key is still visible to ops via other means).
FIX:     Either make it real — render a button/anchor that hits an admin presigned-URL route keyed by j.errorReportKey to fetch/download the report — or, if no viewer exists yet, replace the red 'view' span with plain non-interactive text like 'error' so it doesn't look clickable.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/book/admin/_clients/OpsClient.tsx

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/book/admin/_clients/OpsClient.tsx
git commit -m "fix(ux): L82 — Ops ingestion 'view' error link is a dead element (n"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L82: committed on fix/L82 (worktree ../cf-fix-L82). Covered: L82."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L82 && git worktree remove ../cf-fix-L82 && git branch -d fix/L82"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 118: L83 — User-detail drawer dumps raw entitlement/erase JSON, exposing internal fields and PII
**Lead:** `low` · **Covers:** L83 · **Edits:** `app/book/admin/_clients/UsersClient.tsx` · ⚠ shares a file with Task M42

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L83 ../cf-fix-L83 audit/prod-readiness-2026-06-14
cd ../cf-fix-L83
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/book/admin/_clients/UsersClient.tsx.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `app/book/admin/_clients/UsersClient.tsx`, which Task M42 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- L83 · low · app/book/admin/_clients/UsersClient.tsx:408-414, app/book/admin/_clients/UsersClient.tsx:622-626
PROBLEM: The Entitlement section (UsersClient.tsx:408-414) and the erase-result summary (622-626) render JSON.stringify(detail.entitlement / eraseSummary, null, 2) in a <pre>. This dumps raw internal fields (potentially Stripe customer/subscription IDs and internal keys) as an unformatted blob — functional but unpolished for a production admin surface, and shows sensitive identifiers verbatim.
WHY:     Sensitive billing identifiers are shown without structure or redaction; harder to read and increases incidental exposure (screenshots/shoulder-surfing). Low severity — this is an admin-only surface already behind double auth gating, so exposure is to staff, not end users.
FIX:     Render the entitlement as labeled StatBox rows (plan, proStatus, proSource, currentPeriodEnd, etc.) mirroring the Snapshot section, masking or omitting raw Stripe IDs; keep the raw JSON behind a collapsible <details>'Show raw' for debugging. Same StatBox/labeled treatment for the erase summary.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/book/admin/_clients/UsersClient.tsx

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/book/admin/_clients/UsersClient.tsx
git commit -m "fix(ux): L83 — User-detail drawer dumps raw entitlement/erase JSON,"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L83: committed on fix/L83 (worktree ../cf-fix-L83). Covered: L83."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L83 && git worktree remove ../cf-fix-L83 && git branch -d fix/L83"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 119: L86 — Dialog/Sheet has no nested-dialog stack: a second open overlay breaks Escape and the focus trap
**Lead:** `low` · **Covers:** L86 · **Edits:** `components/ui/Dialog.tsx`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L86 ../cf-fix-L86 audit/prod-readiness-2026-06-14
cd ../cf-fix-L86
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: components/ui/Dialog.tsx.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- L86 · low · components/ui/Dialog.tsx:76-139
PROBLEM: OverlayShell registers its Escape (76-86) and Tab focus-trap (92-139) handlers on `document`, one set per open instance. If two overlays are open at once: (a) Escape's e.stopPropagation() does not stop the OTHER document-level keydown listener (sibling document listeners are unaffected by stopPropagation), so one Escape closes BOTH; (b) both focus-trap handlers run and fight over which panel gets focus; (c) there is no z-index/topmost tracking (every overlay uses z-[100]). The shared primitive is used by many modals (ExportModal, DangerZone, RefreshPreferencesModal in settings; ChapterCompleteModal, SessionModeOverlay, NotesDrawer in the reader; BadgeCelebration, BadgeDetailModal in badges). No current flow demonstrably opens two simultaneously today (so it does not reproduce now), but co-located modals (e.g. a NotesDrawer Sheet open when ChapterCompleteModal fires, or a confirm inside a settings modal) make it likely the first time a nested flow ships.
WHY:     Latent: any future nested-modal flow will close both layers on Escape and have a confused focus trap -- an a11y/UX regression. Low because it does not reproduce on current routes.
FIX:     Maintain a module-level stack of open overlay ids. On open, push a unique id; on cleanup, pop. Only the topmost overlay (id === stack[stack.length-1]) handles Escape and runs the Tab focus trap; non-top overlays no-op their handlers. Optionally derive z-index from stack depth so a nested overlay renders above its parent. This makes the primitive safe for nesting without changing the public API.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint components/ui/Dialog.tsx

============ STEP 5 — COMMIT (only after checks pass) ============
git add components/ui/Dialog.tsx
git commit -m "fix(correctness): L86 — Dialog/Sheet has no nested-dialog stack: a second op"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L86: committed on fix/L86 (worktree ../cf-fix-L86). Covered: L86."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L86 && git worktree remove ../cf-fix-L86 && git branch -d fix/L86"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 120: L90 — README.md still claims the repo ships two product domains including the deleted Cloud Portfolio — plus a verified-dead SECURE_DOC_TABLE code path
**Lead:** `low` · **Covers:** L90 · **Edits:** `app/app/api/_lib/aws.ts`, `docs/ENVIRONMENT.md`, `docs/README.md` · ⚠ shares a file with Task H12

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L90 ../cf-fix-L90 audit/prod-readiness-2026-06-14
cd ../cf-fix-L90
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/app/api/_lib/aws.ts, docs/ENVIRONMENT.md, docs/README.md.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `app/app/api/_lib/aws.ts`, which Task H12 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- L90 · low · docs/README.md:3-7, docs/ENVIRONMENT.md:151, app/app/api/_lib/aws.ts:24-26
PROBLEM: Verified: docs/README.md:3-7 states 'This repository contains two application domains... Cloud Portfolio document workflows [and] ChapterFlow guided reading.' Per memory and code, the Cloud Portfolio PDF/conversion domain was removed from HEAD. ENVIRONMENT.md:151 lists SECURE_DOC_TABLE as 'Belongs to the sibling Cloud Portfolio product (app/app/api/_lib/aws.ts); not used by ChapterFlow.' STRENGTHENED: aws.ts:24-26 getTableName() returns mustServerEnv('SECURE_DOC_TABLE'), and git grep confirms NO caller of getTableName / SECURE_DOC_TABLE anywhere in app/ or lib/ — only ddbDoc/s3/REGION/sfn from aws.ts are imported. So getTableName is live dead-code residue of the deleted product, exactly matching the doc claim. The unused pdf-lib/pdfjs-dist deps (Finding 1) are the matching dependency residue.
WHY:     An operator reading the env/launch docs (the stated source of truth) is told to reason about a product that does not exist and may chase phantom config (SECURE_DOC_TABLE) or keep dead PDF deps believing they're load-bearing.
FIX:     Edit docs/README.md:3-7 to state the repo ships only ChapterFlow; drop the Cloud Portfolio bullet and the 'two application domains' framing. Remove or clearly mark-as-legacy the SECURE_DOC_TABLE row in ENVIRONMENT.md:151, and delete the dead getTableName() function from app/app/api/_lib/aws.ts (no callers) to eliminate the residue entirely.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/app/api/_lib/aws.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/app/api/_lib/aws.ts docs/ENVIRONMENT.md docs/README.md
git commit -m "fix(maintainability): L90 — README.md still claims the repo ships two product do"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L90: committed on fix/L90 (worktree ../cf-fix-L90). Covered: L90."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L90 && git worktree remove ../cf-fix-L90 && git branch -d fix/L90"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 121: L92 — Dead mock-data modules left in the live tree (progressMockData, MOCK_USER_STATS/MOCK_WEEKLY_CHALLENGE) — confusing but not rendered
**Lead:** `low` · **Covers:** L92 · **Edits:** `components/library/libraryData.ts`, `components/progress/ProgressPage.tsx`, `components/progress/progressMockData.ts` · ⚠ shares a file with Task L71/P14/H5

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L92 ../cf-fix-L92 audit/prod-readiness-2026-06-14
cd ../cf-fix-L92
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: components/library/libraryData.ts, components/progress/ProgressPage.tsx, components/progress/progressMockData.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `components/library/libraryData.ts`, `components/progress/ProgressPage.tsx`, `components/progress/progressMockData.ts`, which Task L71/P14/H5 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- L92 · low · components/progress/progressMockData.ts:3, components/library/libraryData.ts:86, components/library/libraryData.ts:101, components/progress/ProgressPage.tsx:21, components/progress/ProgressPage.tsx:188
PROBLEM: Verified by grep: MOCK_USER_STATS and MOCK_WEEKLY_CHALLENGE (libraryData.ts:86, :101) have ZERO consumers — the live LibraryPage builds stats via toUserStats/toLibraryBooks and uses the real WEEKLY_CHALLENGE const from dashboardToLibraryUi.ts. progressMockData.ts (mockProgressData: hardcoded "Will", insightPoints 150, a fake active book "So Good They Can't Ignore You" with readersCount 347, fake streak) is imported by the live ProgressPage.tsx but ONLY its `dailyQuests` array is read (line 188), and even there every value is overwritten with real analytics (lines 194-217); the id/title/icon/type structural shell is all that survives. None of the fabricated user/book/streak fields reach the screen. I specifically traced the readersCount=347 concern: it never renders — active books are rebuilt fresh with readersCount:0 (ProgressPage.tsx:97 / buildProgressData) and overlaid with a REAL /books/{id}/metrics readersToday value (line 449), and ContinueLearningCard only shows the line when readersCount>0.
WHY:     No user-facing impact today. Risk is a future regression that surfaces "Will", level 4 Pro, 347 readers, or a fake 5-day streak on a real account, plus reviewer/maintainer confusion (the codebase reads as if mock data is live).
FIX:     Delete MOCK_USER_STATS and MOCK_WEEKLY_CHALLENGE from components/library/libraryData.ts (keep the type defs, CURATED_SECTIONS, and the builder helpers). In ProgressPage.tsx replace the `mockProgressData.dailyQuests` template (line 188) with a small colocated DAILY_QUEST_TEMPLATES const, then delete components/progress/progressMockData.ts entirely. This is the original fix and it is correct.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint components/library/libraryData.ts components/progress/ProgressPage.tsx components/progress/progressMockData.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add components/library/libraryData.ts components/progress/ProgressPage.tsx components/progress/progressMockData.ts
git commit -m "fix(dead-code): L92 — Dead mock-data modules left in the live tree (progre"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L92: committed on fix/L92 (worktree ../cf-fix-L92). Covered: L92."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L92 && git worktree remove ../cf-fix-L92 && git branch -d fix/L92"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 122: L94 (+1) — Library UserStats reports currentStreak:0 and a hardcoded nextBadge regardless of real data (currently not displayed, but a latent lie)
**Lead:** `low` · **Covers:** L94, P13 · **Edits:** `components/library/LibraryPage.tsx`, `components/library/dashboardToLibraryUi.ts` · ⚠ shares a file with Task M35

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 2 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/L94 ../cf-fix-L94 audit/prod-readiness-2026-06-14
cd ../cf-fix-L94
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: components/library/LibraryPage.tsx, components/library/dashboardToLibraryUi.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `components/library/LibraryPage.tsx`, which Task M35 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- L94 · low · components/library/dashboardToLibraryUi.ts:65, components/library/dashboardToLibraryUi.ts:66, components/library/dashboardToLibraryUi.ts:67, components/library/dashboardToLibraryUi.ts:68
PROBLEM: Confirmed: toUserStats() hardcodes `currentStreak: 0`, `streakIsActiveToday: false` (with a TODO to wire /api/book/me/streak), and `nextBadge: { name: "Avid Reader", booksAway: Math.max(0, 2 - booksCompleted) }` — none reflect real streak or real next badge. I read the live consumer (LibraryPage.tsx in full): it reads userStats.firstName, isPro, freeBooksUsed, freeBooksLimit, and level, but NEVER currentStreak / streakIsActiveToday / nextBadge. So nothing wrong renders today. The risk is latent: any future library component that trusts userStats.currentStreak or userStats.nextBadge would show a fake 'streak 0' / 'Avid Reader, N to go' to every user. (Note: booksAway is at least derived from real booksCompleted, so it's less arbitrary than the streak constants.)
WHY:     No incorrect data on screen today. Latent risk that a future UI addition surfaces a fabricated streak / next-badge to all users. Also represents an honest capability gap (library can't show real streak/next-badge without changes).
FIX:     Preferred: drop currentStreak/streakIsActiveToday/nextBadge from the UserStats shape until a backend source exists, so no consumer can read a fabricated value. If they must stay, wire them: the dashboard payload already feeds useBookAnalytics (streakDays) and useBadgeSystem (nextMilestones), so pass real values through toUserStats or source them in LibraryPage from those hooks. Original fix is correct.

--- P13 · polish · components/library/dashboardToLibraryUi.ts:36, components/library/dashboardToLibraryUi.ts:65, components/library/LibraryPage.tsx:382
PROBLEM: toUserStats() in dashboardToLibraryUi.ts always returns currentStreak:0, streakIsActiveToday:false, and a booksCompleted-derived nextBadge, with TODOs noting no backend source. deriveLevel computes level = max(1, floor(IP/500)+1) (a placeholder, not a real tier system). Of the UserStats fields, the live library consumes only firstName (LibraryPage.tsx:253, 281) and level (LibraryPage.tsx:382 → CelebrationToast 'Level N'). currentStreak/streakIsActiveToday/nextBadge are NOT rendered anywhere live (the currentStreak:5 etc. grep hits are inside the dead MOCK_USER_STATS constant). Real streak data exists via useBookAnalytics (streakDays / calculateCurrentStreak).
WHY:     No user-facing wrong data today (streak/badge fields aren't displayed in the library), but the displayed 'Level N Reader' on the completion toast is an approximate IP-derived number presented as a level, and the hardcoded fields are a trap for anyone later wiring a streak/level UI off UserStats expecting real values.
FIX:     Either drop the unused currentStreak/streakIsActiveToday/nextBadge fields from the library UserStats shape, or populate them from the streak data useBookAnalytics already derives. For the displayed 'level', source it from a real tier endpoint when one exists or label it honestly. Pure cleanup.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint components/library/LibraryPage.tsx components/library/dashboardToLibraryUi.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add components/library/LibraryPage.tsx components/library/dashboardToLibraryUi.ts
git commit -m "fix(data): L94, P13 — Library UserStats reports currentStreak:0 and a hard"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE L94: committed on fix/L94 (worktree ../cf-fix-L94). Covered: L94, P13."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/L94 && git worktree remove ../cf-fix-L94 && git branch -d fix/L94"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 123: P8 — CurrentYear renders on the server, risking a stale copyright year and a year-boundary hydration mismatch
**Lead:** `polish` · **Covers:** P8 · **Edits:** `components/sections/CurrentYear.tsx`, `components/sections/Footer.tsx` · context: `app/books/page.tsx`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/P8 ../cf-fix-P8 audit/prod-readiness-2026-06-14
cd ../cf-fix-P8
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: components/sections/CurrentYear.tsx, components/sections/Footer.tsx.
- Read-only context (do NOT edit, just read for understanding): app/books/page.tsx.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- P8 · polish · components/sections/CurrentYear.tsx:1-3, components/sections/Footer.tsx:103, app/books/page.tsx:16
PROBLEM: CurrentYear.tsx is a plain (non-'use client') server component calling new Date().getFullYear(), used in the server-rendered Footer (Footer.tsx:103). For statically/ISR-rendered pages (/books has revalidate=3600; the home page is largely static) the year is captured at render/build time on the server, so it can lag the real year until the next revalidation, and a client re-render exactly at a New Year boundary could mismatch the server year (hydration warning — though layout.tsx sets suppressHydrationWarning on <html>, which would mask it for the whole tree).
WHY:     Minor: the footer could show last year's copyright for a window after Jan 1 on cached pages, plus an edge-case hydration nuance. Cosmetic/robustness only.
FIX:     Make CurrentYear a client component ('use client') and compute the year in a mount effect (render a stable placeholder during SSR), or pass a year prop from a dynamic boundary. Simplest: client-only for a copyright line. (Note: <html suppressHydrationWarning> in layout.tsx already suppresses the warning globally, so the real residual risk is the stale-year-on-cached-page, not a visible console warning.)

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint components/sections/CurrentYear.tsx components/sections/Footer.tsx

============ STEP 5 — COMMIT (only after checks pass) ============
git add components/sections/CurrentYear.tsx components/sections/Footer.tsx
git commit -m "fix(correctness): P8 — CurrentYear renders on the server, risking a stale c"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE P8: committed on fix/P8 (worktree ../cf-fix-P8). Covered: P8."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/P8 && git worktree remove ../cf-fix-P8 && git branch -d fix/P8"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 124: P10 — Onboarding swipe-deck arrow-key handler is global and unguarded (no input-focus / modifier check)
**Lead:** `polish` · **Covers:** P10 · **Edits:** `app/onboarding/components/StepStarterShelf.tsx`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/P10 ../cf-fix-P10 audit/prod-readiness-2026-06-14
cd ../cf-fix-P10
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/onboarding/components/StepStarterShelf.tsx.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- P10 · polish · app/onboarding/components/StepStarterShelf.tsx:585-598
PROBLEM: A window-level keydown listener calls e.preventDefault() and triggers a left/right card swipe on ArrowLeft/ArrowRight (lines 588-594). It does guard on isComplete/!frontBook (587) but has no check for whether focus is in a text field/contenteditable or whether a modifier key is held. There is no text input on this step today, so practical impact is low, but it's a fragile pattern that would hijack arrow keys from any future input or a screen-reader user.
WHY:     Minor today; a latent keyboard/a11y trap if any focusable text control is added to the step.
FIX:     Bail early if document.activeElement is INPUT/TEXTAREA/[contenteditable] or if e.metaKey/ctrlKey/altKey is set, before preventDefault and swiping.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/onboarding/components/StepStarterShelf.tsx

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/onboarding/components/StepStarterShelf.tsx
git commit -m "fix(accessibility): P10 — Onboarding swipe-deck arrow-key handler is global an"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE P10: committed on fix/P10 (worktree ../cf-fix-P10). Covered: P10."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/P10 && git worktree remove ../cf-fix-P10 && git branch -d fix/P10"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 125: P11 — Onboarding books.ts / recommendations.ts comments hardcode '67-book catalog' — already drifted (catalog is 68)
**Lead:** `polish` · **Covers:** P11 · **Edits:** `app/onboarding/data/books.ts`, `app/onboarding/data/recommendations.ts`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/P11 ../cf-fix-P11 audit/prod-readiness-2026-06-14
cd ../cf-fix-P11
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/onboarding/data/books.ts, app/onboarding/data/recommendations.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- P11 · polish · app/onboarding/data/books.ts:1-14, app/onboarding/data/recommendations.ts:1-7
PROBLEM: The data layer correctly derives the deck from the real catalog metadata (no fabricated counts shown to users — books.ts:12-13 even instructs counts must come from lib/catalog-stats). But the source comments assert a literal '67 books' (books.ts:4) / 'full 67-book catalog' (recommendations.ts:5). The catalog is dynamic; booksCatalog.metadata.json currently contains 68 entries, so the comment has ALREADY gone stale.
WHY:     No runtime impact; documentation drift only — and it's already wrong (67 vs actual 68).
FIX:     Replace the hardcoded '67' in both comments with a non-numeric description ('the full published catalog') or reference lib/catalog-stats (which exists) so the doc can't go stale.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/onboarding/data/books.ts app/onboarding/data/recommendations.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/onboarding/data/books.ts app/onboarding/data/recommendations.ts
git commit -m "fix(maintainability): P11 — Onboarding books.ts / recommendations.ts comments ha"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE P11: committed on fix/P11 (worktree ../cf-fix-P11). Covered: P11."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/P11 && git worktree remove ../cf-fix-P11 && git branch -d fix/P11"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 126: P12 — AskBookDrawer follow-up suggestions use a biased Math.random sort over a tiny pool
**Lead:** `polish` · **Covers:** P12 · **Edits:** `app/book/components/AskBookDrawer.tsx`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/P12 ../cf-fix-P12 audit/prod-readiness-2026-06-14
cd ../cf-fix-P12
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/book/components/AskBookDrawer.tsx.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- P12 · polish · app/book/components/AskBookDrawer.tsx:34-41, app/book/components/AskBookDrawer.tsx:255-262
PROBLEM: pickFollowUps (lines 34-41) shuffles with available.sort(() => Math.random() - 0.5) — a biased, non-uniform shuffle — over a fixed 4-item pool, filtering only against verbatim (lowercased) user-typed questions. Clicking a follow-up adds it as a user message so it's excluded next turn, but the pool exhausts quickly and the biased shuffle can resurface the same pair. The finding's claim that it re-shuffles per render is overstated: lines 257-262 already memoize the result by messages.length (followUpsRef keyed on followUpsKey), so it is stable within a turn — only the shuffle quality and small-pool exhaustion remain.
WHY:     Slightly repetitive / non-uniformly distributed follow-up suggestions; no functional break.
FIX:     Replace the sort-comparator shuffle with a proper Fisher-Yates (the exact seeded pattern already in QuizPanel.tsx:569-578). The per-turn stability the finding suggests is already achieved by the followUpsRef memoization; optionally enlarge the pool.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/book/components/AskBookDrawer.tsx

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/book/components/AskBookDrawer.tsx
git commit -m "fix(ux): P12 — AskBookDrawer follow-up suggestions use a biased Mat"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE P12: committed on fix/P12 (worktree ../cf-fix-P12). Covered: P12."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/P12 && git worktree remove ../cf-fix-P12 && git branch -d fix/P12"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 127: P14 — Dead exported mock constants and helpers in libraryData.ts (MOCK_BOOKS / MOCK_USER_STATS / MOCK_WEEKLY_CHALLENGE / getBookById etc.)
**Lead:** `polish` · **Covers:** P14 · **Edits:** `components/library/libraryData.ts` · ⚠ shares a file with Task L71/L92

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/P14 ../cf-fix-P14 audit/prod-readiness-2026-06-14
cd ../cf-fix-P14
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: components/library/libraryData.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `components/library/libraryData.ts`, which Task L71/L92 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- P14 · polish · components/library/libraryData.ts:86, components/library/libraryData.ts:101, components/library/libraryData.ts:1159, components/library/libraryData.ts:1207, components/library/libraryData.ts:1150, components/library/libraryData.ts:1155
PROBLEM: libraryData.ts exports MOCK_USER_STATS (86), MOCK_WEEKLY_CHALLENGE (101), MOCK_BOOKS (1159) and the MOCK_BOOKS-backed helpers getBookById/getBooksById/getInProgressBooks/getCompletedBooks/getNotStartedBooks (1207-1228). A precise import scan confirms NONE of these symbols are imported from libraryData anywhere in live code. IMPORTANT NUANCE the original finding got wrong: a naive grep shows 'MOCK_BOOKS' in LibraryContext/CompletedShelf/BookCard, but those are all in COMMENTS ('no static MOCK_BOOKS', 'not static MOCK_BOOKS'); and the getBookById grep hits are a DIFFERENT same-named function from app/onboarding/data/books.ts and app/book/data/booksCatalog.ts, not libraryData's. The live library builds books from the dashboard catalog via toLibraryBooks/buildLibraryBookFromCatalog. The live WeeklyChallenge component imports only the WeeklyChallenge TYPE (not MOCK_WEEKLY_CHALLENGE) and is fed real data (WEEKLY_CHALLENGE editorial nudge).
WHY:     Dead mock data lingering in a file that also holds live logic invites accidental reuse of fabricated data (the exact regression this surface was rebuilt to remove) and adds noise. No runtime effect.
FIX:     Remove MOCK_USER_STATS, MOCK_WEEKLY_CHALLENGE, MOCK_BOOKS, the helper exports (getBookById/getBooksById/getInProgressBooks/getCompletedBooks/getNotStartedBooks), and their now-orphaned supporting chain BASE_LIBRARY_BOOKS / BASE_LIBRARY_BOOK_IDS / GENERATED_LIBRARY_BOOKS (verified used only to build MOCK_BOOKS, no external importers). Keep the WeeklyChallenge TYPE, buildLibraryBookFromCatalog, formatReadingTime, getProgressColor/getProgressMicrocopy, CURATED_SECTIONS, SORT_OPTIONS and the still-used pure helpers. Confirm a typecheck/build after removal.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint components/library/libraryData.ts

============ STEP 5 — COMMIT (only after checks pass) ============
git add components/library/libraryData.ts
git commit -m "fix(dead-code): P14 — Dead exported mock constants and helpers in libraryD"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE P14: committed on fix/P14 (worktree ../cf-fix-P14). Covered: P14."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/P14 && git worktree remove ../cf-fix-P14 && git branch -d fix/P14"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 128: P15 — Rewards page TopNav highlights the wrong active tab (badges)
**Lead:** `polish` · **Covers:** P15 · **Edits:** `app/rewards/RewardsPageClient.tsx` · ⚠ shares a file with Task M39

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/P15 ../cf-fix-P15 audit/prod-readiness-2026-06-14
cd ../cf-fix-P15
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/rewards/RewardsPageClient.tsx.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
COORDINATION (shared file): you will edit `app/rewards/RewardsPageClient.tsx`, which Task M39 also edits. To avoid a merge conflict, do NOT run this task in parallel with that one — run/merge one, then the other.

============ STEP 3 — FIX THESE (in order) ============
--- P15 · polish · app/rewards/RewardsPageClient.tsx:210-219
PROBLEM: RewardsPageClient passes activeTab="badges" to TopNav (line 213). BookNavTab has no 'rewards' member (TopNav.tsx:31) and there is no rewards nav item, so this highlights the Badges tab while the user is on Rewards. activeTab is an optional prop documented to be omitted on secondary surfaces.
WHY:     Minor nav disorientation — the highlighted tab doesn't match the current page.
FIX:     Omit activeTab on /rewards so nothing is mis-highlighted (the prop is optional and TopNav's own doc-comment recommends this for nav-less surfaces), or add a real 'rewards' tab.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/rewards/RewardsPageClient.tsx

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/rewards/RewardsPageClient.tsx
git commit -m "fix(ux): P15 — Rewards page TopNav highlights the wrong active tab "

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE P15: committed on fix/P15 (worktree ../cf-fix-P15). Covered: P15."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/P15 && git worktree remove ../cf-fix-P15 && git branch -d fix/P15"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 129: P16 — Two parallel design-token systems used across this area (--cf-* vs --bg-base/--text-*/--accent-cyan)
**Lead:** `polish` · **Covers:** P16 · **Edits:** `app/book/badges/components/BadgeCard.tsx`, `app/book/badges/components/BadgeDetailModal.tsx`, `app/book/saved/SavedBooksClient.tsx`, `app/globals.css`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/P16 ../cf-fix-P16 audit/prod-readiness-2026-06-14
cd ../cf-fix-P16
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/book/badges/components/BadgeCard.tsx, app/book/badges/components/BadgeDetailModal.tsx, app/book/saved/SavedBooksClient.tsx, app/globals.css.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- P16 · polish · app/book/saved/SavedBooksClient.tsx:69-127, app/book/badges/components/BadgeCard.tsx:15-22, app/book/badges/components/BadgeDetailModal.tsx:282-289, app/globals.css:200-218,319-329
PROBLEM: The Saved page styles with raw inline var(--bg-base)/var(--text-primary)/var(--text-heading)/var(--text-secondary)/var(--accent-cyan) (SavedBooksClient.tsx:69-127), while badges/notebook/profile/rewards/events use the --cf-* namespace via Tailwind arbitrary classes. Both namespaces are fully defined in globals.css (--bg-base etc. at 200-218, --cf-* at 319+), verified, so it renders correctly today. Additionally METALLIC_GRADIENTS is byte-identically duplicated in BadgeCard.tsx (15-22) and BadgeDetailModal.tsx (282-289); TIER_BORDER_COLORS/TIER_PILL_STYLES are already correctly hoisted into badge-utils.ts and shared, so the gradient map is the remaining straggler.
WHY:     No runtime bug, but copy-paste drift and theming-inconsistency risk: a future token change to one namespace silently misses the other, and the duplicated gradient maps can diverge.
FIX:     Standardize this area on the --cf-* token set (or alias --bg-base etc. through --cf-*), and hoist the duplicated METALLIC_GRADIENTS into badge-utils.ts (next to the already-shared TIER_BORDER_COLORS/TIER_PILL_STYLES) so BadgeCard and BadgeDetailModal import one source.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/book/badges/components/BadgeCard.tsx app/book/badges/components/BadgeDetailModal.tsx app/book/saved/SavedBooksClient.tsx

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/book/badges/components/BadgeCard.tsx app/book/badges/components/BadgeDetailModal.tsx app/book/saved/SavedBooksClient.tsx app/globals.css
git commit -m "fix(maintainability): P16 — Two parallel design-token systems used across this a"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE P16: committed on fix/P16 (worktree ../cf-fix-P16). Covered: P16."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/P16 && git worktree remove ../cf-fix-P16 && git branch -d fix/P16"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 130: P18 — Content scenario chart zips submissions and approvals by array index, not by date
**Lead:** `polish` · **Covers:** P18 · **Edits:** `app/book/admin/_clients/ContentClient.tsx` · context: `app/app/api/book/_lib/admin-metrics.ts`, `app/app/api/book/admin/metrics/content/route.ts`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/P18 ../cf-fix-P18 audit/prod-readiness-2026-06-14
cd ../cf-fix-P18
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/book/admin/_clients/ContentClient.tsx.
- Read-only context (do NOT edit, just read for understanding): app/app/api/book/_lib/admin-metrics.ts, app/app/api/book/admin/metrics/content/route.ts.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- P18 · polish · app/book/admin/_clients/ContentClient.tsx:66-72, app/app/api/book/admin/metrics/content/route.ts:94-102, app/app/api/book/_lib/admin-metrics.ts:109-122
PROBLEM: scenarioCombined (ContentClient.tsx:66-72) pairs scenarioSubmissions[i] with scenarioApprovals[i]?.value, an index-based merge that assumes both series are equal-length and identically date-ordered. This is the only chart in the admin surface that doesn't merge defensively (Moderation reduces each series independently at ModerationClient.tsx:51-52; Engagement merges by date via a map at EngagementClient.tsx:67-75).
WHY:     ORIGINAL CLAIM OVERSTATED: this does NOT currently mis-align. The content route builds BOTH series from the SAME days[] array via dailySeries() (content/route.ts:94-102; dailySeries at admin-metrics.ts:109-122 maps over the identical days[] for each event type and Promise.all preserves order, never dropping days). So today the indices are guaranteed aligned and the chart is correct. It is a latent robustness/consistency nit, not a live correctness bug — downgraded from low/correctness to polish/maintainability.
FIX:     Optional hardening for resilience to any future API change: merge by date like EngagementClient.quizCombined — build a Record keyed by s.date for submissions, set `approved` from a date-keyed lookup of scenarioApprovals, then Object.values().sort by date. Low priority given the current backend contract guarantees alignment.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/book/admin/_clients/ContentClient.tsx

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/book/admin/_clients/ContentClient.tsx
git commit -m "fix(maintainability): P18 — Content scenario chart zips submissions and approval"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE P18: committed on fix/P18 (worktree ../cf-fix-P18). Covered: P18."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/P18 && git worktree remove ../cf-fix-P18 && git branch -d fix/P18"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 131: P19 — Stale 'Phase N / once live in production' copy implies tracking is not wired
**Lead:** `polish` · **Covers:** P19 · **Edits:** `app/book/admin/_clients/AcquisitionClient.tsx` · context: `app/book/admin/_clients/FunnelsClient.tsx`, `app/book/admin/_clients/NotificationsClient.tsx`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/P19 ../cf-fix-P19 audit/prod-readiness-2026-06-14
cd ../cf-fix-P19
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: app/book/admin/_clients/AcquisitionClient.tsx.
- Read-only context (do NOT edit, just read for understanding): app/book/admin/_clients/FunnelsClient.tsx, app/book/admin/_clients/NotificationsClient.tsx.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- P19 · polish · app/book/admin/_clients/AcquisitionClient.tsx:141-144, app/book/admin/_clients/FunnelsClient.tsx:91-95, app/book/admin/_clients/NotificationsClient.tsx:140-142
PROBLEM: Footnotes leak internal roadmap phases and signal incomplete instrumentation to anyone with admin access: Acquisition (141-144) says UTM/referer tagging happens 'once Phase 3 instrumentation is live in production'; Funnels (91-95) says 'First commitment' and 'First AI feedback' are estimated from a sample of the 100 most recent users and full coverage 'requires a precomputed snapshot (Phase 5+)'; Notifications (140-142) says email/push read rates 'require ... (Phase 6)'.
WHY:     Admins/stakeholders are told key acquisition and funnel metrics are sampled or not-yet-real, and the funnel's sampled steps are only labeled in a footnote (easy to misread as totals). It also leaks internal 'Phase N' references. Polish-level.
FIX:     Confirm post-merge whether UTM/referer capture is actually live; if so, drop the 'Phase 3' caveat. For Funnels, label the two sampled steps inline (e.g. a '~ sampled' badge on the row) rather than only in the footnote. Strip internal 'Phase N' numbers from all user-facing copy across these three pages.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint app/book/admin/_clients/AcquisitionClient.tsx

============ STEP 5 — COMMIT (only after checks pass) ============
git add app/book/admin/_clients/AcquisitionClient.tsx
git commit -m "fix(maintainability): P19 — Stale 'Phase N / once live in production' copy impli"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE P19: committed on fix/P19 (worktree ../cf-fix-P19). Covered: P19."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/P19 && git worktree remove ../cf-fix-P19 && git branch -d fix/P19"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

## Task 132: P21 — EmptyState CTA renders a raw <a href> (full page reload) instead of Next Link, and the branch is dead
**Lead:** `polish` · **Covers:** P21 · **Edits:** `components/ui/EmptyState.tsx`

```text
You are an autonomous fix agent for the ChapterFlow web app (Next.js 16 App Router /
React 19; DynamoDB single-table backend at app/app/api/book/_lib/repo.ts behind Cognito
auth + Stripe; API routes under app/app/api/book/**). Fix the 1 finding(s) below,
then commit on your own branch. You are isolated in your own git worktree.

============ STEP 1 — SET UP (run exactly) ============
cd /Users/radinsoltani/ChapterFlow
git worktree add -b fix/P21 ../cf-fix-P21 audit/prod-readiness-2026-06-14
cd ../cf-fix-P21
ln -s ../ChapterFlow/node_modules node_modules   # reuse deps so typecheck/test/eslint work
# Do NOT run "next build"/"next dev" in this worktree (the symlink breaks Turbopack); only typecheck/test/eslint.

============ STEP 2 — RULES ============
- Files you may EDIT: components/ui/EmptyState.tsx.
- If you discover the fix truly needs a file NOT in the EDIT list above, STOP editing it and
  flag it in your handoff report instead (it may belong to another agent's task).
- Do NOT touch scripts/, book-packages/, content/, state/, graphify-out/, docs/.
- Reuse existing helpers (requireUser/requireActiveBookUser/requireAdminUser, BookApiError +
  withBookApiErrors, repo.ts functions, keys.ts, lib/catalog-stats.ts, lib/pricing.ts). Match style.
- Never trust client input for a security / paywall / economy decision — the server is the source of truth.
- Re-read each file and confirm line numbers before editing.
============ STEP 3 — FIX THESE (in order) ============
--- P21 · polish · components/ui/EmptyState.tsx:28-53
PROBLEM: When actionHref is provided, EmptyState renders a plain <a href> (lines 29-39) with hardcoded color:'#FFFFFF' on background var(--accent-cyan). A plain anchor triggers a full document navigation (loses client state, slower) rather than SPA routing. Confirmed dead: grep for actionHref across app+components (excluding EmptyState.tsx) returns nothing -- all EmptyState usages use onCtaClick. So the anchor branch is unreachable today but is a footgun if used, and the hardcoded white bypasses tokens.
WHY:     Cosmetic/robustness: an unreachable code path that, if used, would full-reload internal links and use a non-token color.
FIX:     Either delete the actionHref prop + anchor branch (it is unused), or swap the <a> for next/link's Link to preserve SPA navigation and replace color:'#FFFFFF' with an on-accent token (e.g. --cf-accent-contrast if defined). Given zero consumers, deletion is cleanest.

============ STEP 4 — VERIFY (all must pass) ============
npm run typecheck
npm run test
npx eslint components/ui/EmptyState.tsx

============ STEP 5 — COMMIT (only after checks pass) ============
git add components/ui/EmptyState.tsx
git commit -m "fix(ux): P21 — EmptyState CTA renders a raw <a href> (full page rel"

============ STEP 6 — HAND OFF (do NOT merge; report) ============
Print:
  "DONE P21: committed on fix/P21 (worktree ../cf-fix-P21). Covered: P21."
  "Integrate: cd /Users/radinsoltani/ChapterFlow && git checkout audit/prod-readiness-2026-06-14 && git merge --no-ff fix/P21 && git worktree remove ../cf-fix-P21 && git branch -d fix/P21"
Then report the diff summary, the typecheck/test/eslint output, and anything you could NOT
complete (with why). Do NOT run the merge and do NOT push.
```

---

