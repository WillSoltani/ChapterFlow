# Fix prompts — Production Readiness / Ops

_20 items (2 critical, 1 high, 8 medium, 8 low, 1 polish). ChapterFlow production-readiness remediation — branch `main` (e90937368)._

## Shared context (every prompt below assumes this)

**App:** ChapterFlow — a Next.js 16 (App Router, React 19) "book learning" web app. **These prompts target the `main` branch** (commit e90937368, the freshly-merged post-UI-overhaul-integration state). Backend = DynamoDB single-table (`app/app/api/book/_lib/repo.ts`) behind Cognito JWT auth (`requireUser`/`requireActiveBookUser`/`requireAdminUser`), Stripe billing, S3 content, CDK infra (`infra/`). API routes live under `app/app/api/book/**` (URL `/app/api/book/**`). Error envelope = `withBookApiErrors`+`BookApiError`.

**Rules for every fix agent:**
1. Work on `main`. Change ONLY the cited files + direct deps. Do NOT touch `scripts/`, `book-packages/`, `content/`, `state/`, `graphify-out/`.
2. Match surrounding code style; reuse existing helpers (auth guards, `BookApiError`, repo functions, `keys.ts`, `lib/catalog-stats.ts`, `lib/pricing.ts`).
3. Never make a security/economy/paywall decision from client-supplied data — the server is the source of truth.
4. When done: run `npm install` (if deps stale), `npm run typecheck`, `npm run test`, and `npx eslint <changed files>`; report results + a short diff summary. Add/adjust a unit test for any security/money/correctness fix.
5. Line numbers were accurate at audit time — re-read each file and confirm before editing (other agents may be editing in parallel).

---

### C1 — Production canonical/OG/sitemap URL silently defaults to wrong domain (https://soltani.org) with no env guard
`severity: critical` · `effort: small` · `files: app/_lib/site-url.ts:11-13, app/_lib/chapterflow-brand.ts:32-37, app/page.tsx:26-89, app/sitemap.ts:4-13, app/robots.ts:4-14, app/layout.tsx:48-71, app/books/page.tsx:19-35`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/_lib/site-url.ts:11-13, app/_lib/chapterflow-brand.ts:32-37, app/page.tsx:26-89, app/sitemap.ts:4-13, app/robots.ts:4-14, app/layout.tsx:48-71, app/books/page.tsx:19-35

PROBLEM:
getChapterFlowSiteUrl() -> siteBaseUrl() -> getSiteUrl(). getSiteUrl() returns NEXT_PUBLIC_SITE_URL || APP_BASE_URL, and when neither is set in production it returns the hardcoded literal 'https://soltani.org' (site-url.ts:11-13). Because getSiteUrl() always returns a non-empty string in production, the `|| (NODE_ENV==='production' ? DEFAULT_CHAPTERFLOW_SITE_URL ...)` fallback in chapterflow-brand.ts siteBaseUrl() (lines 33-36) — which would yield 'https://siliconx.ca' — is unreachable dead code. There is no build/runtime assertion that the env var is configured. Every SEO surface depends on getChapterFlowSiteUrl(): metadataBase + alternates.canonical + OG/Twitter url in layout.tsx and page.tsx, the Organization/WebSite/Product JSON-LD in page.tsx, the ItemList JSON-LD in books/page.tsx, every sitemap.ts entry, and the robots.ts sitemap URL. Three domains float through the tree (soltani.org hardcoded, siliconx.ca dead, chapterflow.ca as support).

WHY IT MATTERS:
On go-live, if the URL env var is not perfectly set, search engines and social cards index/scrape https://soltani.org, canonical tags point off-site, the sitemap/robots advertise the wrong host, and link previews break — a silent, hard-to-detect launch failure that poisons SEO and sharing from day one with no error surfaced. The presence of three different domain literals makes the misconfiguration easy.

REQUIRED FIX:
In app/_lib/site-url.ts, when process.env.NODE_ENV==='production' and neither NEXT_PUBLIC_SITE_URL nor APP_BASE_URL is set, throw to fail the build/boot rather than returning a hardcoded domain. Replace the soltani.org literal with the one true production domain (or require it via env). Either delete the now-dead siliconx.ca fallback in chapterflow-brand.ts siteBaseUrl() or reconcile it to the single canonical default so there is exactly one production default. Confirm the real launch domain with the owner (chapterflow.ca is the support domain; siliconx.ca is the legal entity; neither matches the soltani.org fallback).

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

### X1 — Auth middleware redirects the Stripe webhook to /auth/login, breaking webhook processing in production
`severity: critical` · `effort: trivial` · `files: middleware.ts:28-94, app/app/api/book/billing/webhook/route.ts:66-88` · `⚠ carried/re-confirmed`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

NOTE: RE-CONFIRMED BY HAND on main (middleware.ts is byte-identical to the audited branch; the webhook route still serves under /app/api/book/billing/webhook and the matcher still catches it). The automated main re-audit did NOT surface this — treat as a launch blocker.

FILES: middleware.ts:28-94, app/app/api/book/billing/webhook/route.ts:66-88

PROBLEM:
The Next.js routing root is /Users/radinsoltani/ChapterFlow/app (it contains the top-level layout.tsx + page.tsx), so the directory app/app/api/book/billing/webhook/route.ts serves at URL /app/api/book/billing/webhook. middleware.ts config.matcher is ["/app/:path*","/book/:path*","/dashboard/:path*"], so the webhook is matched. The only carve-out before the auth check is /app/api/book/email/unsubscribe (lines 34-36). In production (NODE_ENV=production so isDevAuthBypassEnabled is false and the dev Cognito-missing skip at 52-63 does not apply), the cookie-presence check at line 67 finds no id_token (Stripe sends no cookies) and the block at 72-87 issues a 302 redirect to /auth/login. Stripe treats any non-2xx (including 302) as a failed delivery, retries, then disables the endpoint.

WHY IT MATTERS:
Every Stripe webhook in production is intercepted before reaching the handler: checkout.session.completed never grants Pro (users pay, get nothing), customer.subscription.* never downgrades cancellations, charge.dispute.created never revokes access, invoice.paid/charge.refunded never persist. Money + access-control failure on the core monetization path; admin MRR/reconciliation drift permanently. The webhook's own correctness (signature, idempotency, proSource guard) is irrelevant because the request never arrives.

REQUIRED FIX:
Add a pass-through at the very top of middleware() before the protectedSurface computation, mirroring the unsubscribe carve-out: `if (pathname.startsWith("/app/api/book/billing/webhook")) return NextResponse.next();`. Stronger and recommended: stop running auth middleware on API routes entirely — every /app/api/book route already enforces requireUser/requireActiveBookUser/requireAdminUser or a signature check at the route level, so the matcher should cover only UI surfaces (/app non-api pages, /book, /dashboard) and explicitly exclude /app/api/*. Validate end-to-end with `stripe trigger checkout.session.completed` against the deployed URL and confirm a 200 (not a 302) before launch. Add a CloudWatch alarm on the existing StripeWebhookFailure metric AND on webhook 3xx/4xx responses so a regression is caught.

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

### H9 — Segment bulk-notify fans out up to 5000 sequential notification sends in one 30s request (SES + push per user) — will time out and partially send
`severity: high` · `effort: large` · `files: app/app/api/book/admin/segments/[segmentId]/notify/route.ts:59-90, app/app/api/book/_lib/notifications-repo.ts:38-147, infra/lib/chapterflow-frontend-stack.ts:391, open-next.config.ts:3-14`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/book/admin/segments/[segmentId]/notify/route.ts:59-90, app/app/api/book/_lib/notifications-repo.ts:38-147, infra/lib/chapterflow-frontend-stack.ts:391, open-next.config.ts:3-14

PROBLEM:
POST /admin/segments/[segmentId]/notify runs buildSegmentUsers (two full-table scans), then loops over matches (hard cap 5000) and AWAITs createNotification per user in a sequential for-loop. createNotification does: getUserSettingsItem read, a PutCommand for the in-app row, an optional SES sendEmail (which itself does an isEmailSuppressed read + token signing + compliance config fetch), and an optional push path that runs ANOTHER DynamoDB Query for DEVICE# tokens then sends per device. The single OpenNext default ServerFn is capped at cdk.Duration.seconds(30) (frontend-stack.ts:391; open-next.config.ts shows no per-route split). The audit entry (writeAuditEntry) runs AFTER the loop and is wrapped in .catch(()=>{}), so a Lambda hard-timeout mid-loop skips it entirely. createNotification has no idempotency key, so a retry re-sends to everyone already notified.

WHY IT MATTERS:
Segment sends beyond a few hundred users time out, deliver to a random partial subset, double-send on retry, and leave no audit record — a broken core admin capability and a CASL/compliance risk (uncontrolled partial commercial-email blasts).

REQUIRED FIX:
Enqueue the send rather than doing it inline: write a segment-send job + matched userIds to SQS/Dynamo and process in a background worker Lambda (the infra already has an SQS email path). At minimum: bound concurrency with chunked Promise.all (e.g. p-limit of ~10-20), write/checkpoint the audit entry incrementally (and BEFORE the loop, updating counts as you go), add per-(segmentId,userId,dispatchId) idempotency so retries don't re-send, and lower the synchronous cap far below what fits in 30s. The Next maxDuration export will NOT help here because OpenNext ignores it; the real fix is moving work off the request.

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

### M4 — audio-name route swallows auth/4xx into 500, is an unrate-limited paid-TTS abuse surface, and has no caller (greeting feature itself is NOT broken)
`severity: medium` · `effort: small` · `files: app/app/api/book/me/audio-name/route.ts:27-88, app/app/api/book/me/audio-name/route.ts:84-87, app/app/api/book/me/audio-name/route.ts:45-61`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/book/me/audio-name/route.ts:27-88, app/app/api/book/me/audio-name/route.ts:84-87, app/app/api/book/me/audio-name/route.ts:45-61

PROBLEM:
Two of the three sub-claims are confirmed, one is refuted. CONFIRMED (error handling): the handler uses a bare try/catch (lines 84-87) instead of withBookApiErrors, so when requireActiveBookUser() throws AuthError (unauthenticated) or BookApiError(403, account_deleted) those are converted to a generic 500 'internal_error' and console.error-logged as a server fault — I verified withBookApiErrors (http.ts:50-54) maps AuthError→401 and BookApiError→its real status, which this route bypasses. CONFIRMED (abuse): it loops over morning/afternoon/evening calling the PAID ElevenLabs TTS API three times per request (lines 45-61) with no rate limit or idempotency. CONFIRMED (no caller): grep found zero invocations of 'audio-name' in app/ or components/. REFUTED (feature broken): the greeting MP3s are NOT silently un-generated — the chapter audio route (books/[bookId]/chapters/[chapterNumber]/audio/route.ts:386-416) auto-generates all three greeting clips on-the-fly when missing using the same userGreetingS3Key/getUserGreetingScript and caches them to S3. So audio-name is a redundant/orphaned eager-generation endpoint, not the sole generator.

WHY IT MATTERS:
An unused, authenticated POST endpoint is an unnecessary cost/abuse surface (3 paid-TTS calls/request, no rate limit) and returns misleading 500s that pollute error monitoring and would confuse any future client. The greeting feature itself still works via the on-demand path in the chapter-audio route — the 'clips never generated' claim is wrong.

REQUIRED FIX:
Delete the route — it is fully redundant with the on-demand generation in the chapter-audio route, which already handles the same three clips, caching, and the missing-clip case. If instead it is kept for eager pre-warming: wrap the handler in withBookApiErrors (AuthError→401, BookApiError→correct status) and add an idempotency guard (skip regeneration if the three S3 keys already exist for the same name) plus a per-user rate limit so it cannot be spammed to burn ElevenLabs credits.

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

### M13 — Reconciliation route declares maxDuration=60 but the server Lambda timeout is 30s — long reconciliations are silently killed
`severity: medium` · `effort: medium` · `files: app/app/api/book/admin/reconciliation/route.ts:10-11, infra/lib/chapterflow-frontend-stack.ts:391, open-next.config.ts:3-14, app/app/api/book/_lib/reconciliation.ts:38-71`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/book/admin/reconciliation/route.ts:10-11, infra/lib/chapterflow-frontend-stack.ts:391, open-next.config.ts:3-14, app/app/api/book/_lib/reconciliation.ts:38-71

PROBLEM:
reconciliation/route.ts:11 sets `export const maxDuration = 60` with a comment about scanning entitlements + paginating Stripe. OpenNext bundles all routes into the single default ServerFn (open-next.config.ts has no per-route function split) whose CDK timeout is hard-set to 30s (frontend-stack.ts:391). The Next.js maxDuration export is a Vercel-platform hint that OpenNext/Lambda does not honor, so the function is forcibly terminated at 30s. reconcileStripeEntitlements does a full scanAllEntitlements (paginated full-table scan) PLUS a paginated Stripe subscriptions.list loop (100/page) — for a non-trivial subscription count plus a large entitlement table this exceeds 30s and 504s.

WHY IT MATTERS:
Billing reconciliation (the tool meant to catch missed Stripe webhooks before trusting MRR) times out for any account with more than a handful of subscriptions, giving false confidence or no result exactly when it matters.

REQUIRED FIX:
Move reconciliation off the request ServerFn into a dedicated lambda.Function with a real 60s+ timeout (invoked async by the route, results polled), OR remove the misleading maxDuration=60 and document/enforce the 30s cap (the lib already supports a maxPages truncation flag — surface 'truncated' clearly). Do not raise the shared ServerFn timeout, as that affects all routes.

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

### M24 — No Lambda log retention; CloudFront 403/404->200 soft-404s
`severity: medium` · `effort: small` · `files: infra/lib/chapterflow-frontend-stack.ts:383-486, infra/lib/chapterflow-backend-stack.ts:426-449, infra/lib/chapterflow-backend-stack.ts:529-537, infra/lib/chapterflow-frontend-stack.ts:740-753`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: infra/lib/chapterflow-frontend-stack.ts:383-486, infra/lib/chapterflow-backend-stack.ts:426-449, infra/lib/chapterflow-backend-stack.ts:529-537, infra/lib/chapterflow-frontend-stack.ts:740-753

PROBLEM:
grep confirms NO lambda.Function in either stack sets logRetention (and no RetentionDays anywhere). CDK defaults un-set logRetention to RETAIN-FOREVER (Never Expire) on the auto-created /aws/lambda log groups for all 7 functions (ServerFn, ImageFn, RevalidationFn, DynamoProviderFn, WarmerFn, ReadingReminderCron, EmailSuppressionHandler). The cron logs include truncated user IDs (reading-reminder-cron.ts:156 logs userId.slice(0,8)) and the suppression handler logs email prefixes (suppression-handler.ts). Separately the CloudFront distribution errorResponses (frontend-stack.ts:740-753) rewrite BOTH 403 and 404 to HTTP 200 serving '/' with ttl 0.

WHY IT MATTERS:
Lambda logs accumulate forever → unbounded CloudWatch Logs storage cost and indefinite retention of PII fragments (user-id prefixes, email prefixes). The 403/404→200 rewrite means genuine not-found and forbidden responses are indistinguishable from a real homepage 200: deep links to removed content silently render the homepage, breaking SEO (soft-404s, crawl/index dilution) and masking real authorization failures.

REQUIRED FIX:
Set logRetention (e.g. logs.RetentionDays.ONE_MONTH) on every lambda.Function in both stacks (or a stack-level aspect). Remove the 403/404 errorResponses entries so CloudFront passes through the origin's real status codes; if a branded edge page is wanted, scope it to 5xx only (and/or let OpenNext serve the Next.js not-found page with a real 404 status).

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

### M25 — lambda/dist no build automation; no prod-secret guard; dead App Runner role+CI perms
`severity: medium` · `effort: medium` · `files: infra/lib/chapterflow-backend-stack.ts:404-430, infra/lib/chapterflow-backend-stack.ts:525-533, infra/bin/app.ts:97-157, infra/lib/chapterflow-backend-stack.ts:237-294, infra/lib/chapterflow-backend-stack.ts:327-337, infra/lib/chapterflow-backend-stack.ts:561-563, infra/iam/github-actions-dev-policy.json:35-55, .github/workflows/_deploy-infra.yml:73-98`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: infra/lib/chapterflow-backend-stack.ts:404-430, infra/lib/chapterflow-backend-stack.ts:525-533, infra/bin/app.ts:97-157, infra/lib/chapterflow-backend-stack.ts:237-294, infra/lib/chapterflow-backend-stack.ts:327-337, infra/lib/chapterflow-backend-stack.ts:561-563, infra/iam/github-actions-dev-policy.json:35-55, .github/workflows/_deploy-infra.yml:73-98

PROBLEM:
Three sub-claims, all verified. (1) Stale-bundle risk: ReadingReminderCron and EmailSuppressionHandler deploy lambda.Code.fromAsset('../lambda/dist') (lines 430, 533); the esbuild commands are comment-only (404-408, 525-528). git ls-files confirms reading-reminder-cron.js + suppression-handler.js are COMMITTED. _deploy-infra.yml never runs esbuild. I rebuilt reading-reminder-cron.ts with the documented esbuild command and diffed against the committed bundle: identical (28791 bytes, 0 diff lines) — so bundles match source TODAY, but any future .ts edit ships stale with no error. (2) No prod-secret guard: bin/app.ts:97-157 injects every secret via conditional spreads (...(process.env.X && {X})) with no assertion that launch-critical secrets are present when env=prod. (3) Dead App Runner IAM: appRunnerRuntimeRole (237) is assumed by tasks.apprunner.amazonaws.com and grants broad DDB/S3/SSM; its ARN is a CfnOutput (561). The app deploys to OpenNext Lambda (_deploy-app.yml runs `open-next build` + cdk deploy ChapterFlowFrontend, no App Runner). The dev policy's AppRunnerDeploy (apprunner:Describe/Update/ListOperations) and PassRoleToAppRunner (iam:PassRole to ChapterFlowAppRuntimeRole) are correspondingly dead.

WHY IT MATTERS:
Stale Lambda code can ship invisibly (a future cron/handler .ts change would not reach prod). A missing launch-critical secret produces a silently degraded prod deploy instead of a hard failure. The unused App Runner role is standing broad privilege with no consumer, and the CI dev policy carries unnecessary apprunner:* + PassRole grants (excess attack surface / least-privilege drift).

REQUIRED FIX:
(1) Replace fromAsset('../lambda/dist') with CDK NodejsFunction bundling (esbuild at synth) OR add an esbuild step in _deploy-infra.yml before cdk deploy plus a CI 'rebuild and git diff --exit-code lambda/dist' drift check. (2) In bin/app.ts, when cfg.env==='prod' assert presence of the launch-critical secrets (Stripe secret/webhook, Cognito config, AUTH_STATE_SECRET, AI keys as applicable) and throw if any is missing. (3) Delete appRunnerRuntimeRole + its policies + the AppRunnerRuntimeRoleArn output, and remove the AppRunnerDeploy + PassRoleToAppRunner statements from github-actions-dev-policy.json.

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

### M27 — Sitemap and robots advertise login-gated /book/* routes as public indexable URLs
`severity: medium` · `effort: small` · `files: app/sitemap.ts:6-13, app/robots.ts:9-12, middleware.ts:38-44,93, app/chapterflow/page.tsx:4-6`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/sitemap.ts:6-13, app/robots.ts:9-12, middleware.ts:38-44,93, app/chapterflow/page.tsx:4-6

PROBLEM:
sitemap.ts lists /book, /book/library, /book/profile, /book/progress, /chapterflow; robots.ts allows ['/', '/book', '/book/library', '/chapterflow']. middleware.ts protects /app, /book, /dashboard (protectedSurface lines 38-41; matcher line 93 ['/app/:path*','/book/:path*','/dashboard/:path*']) and redirects unauthenticated visitors to login with returnTo. /chapterflow (app/chapterflow/page.tsx) redirect()s to /book — itself login-gated. The genuinely public, indexable browse surface is /books (plural), which has full metadata + ItemList JSON-LD (app/books/page.tsx) but is NOT in the sitemap. /pricing, /contact, /legal/* are also public and missing from the sitemap.

WHY IT MATTERS:
Crawlers following the sitemap/robots hit auth redirects (soft-404/redirect signals) and waste crawl budget, while the real indexable content (/books, /pricing, /contact, /legal/*) is omitted — hurting discoverability of the public surface.

REQUIRED FIX:
In sitemap.ts, replace the /book/* and /chapterflow entries with the public pages: /, /books, /pricing, /contact, and the /legal/* pages. In robots.ts, drop /book and /book/library from allow (they redirect to login) and stop allowing /chapterflow (a redirect); keep / and add nothing that 302s. Optionally add /book* to disallow to make the intent explicit.

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

### M30 — Deep-link login emits an absolute returnTo that the env-only allowlist rejects when site-URL vars don't match the serving host
`severity: medium` · `effort: trivial` · `files: middleware.ts:72-80, middleware.ts:12-26, app/auth/_lib/return-to.ts:19-48,50-76, app/_lib/chapterflow-brand.ts:43-45`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: middleware.ts:72-80, middleware.ts:12-26, app/auth/_lib/return-to.ts:19-48,50-76, app/_lib/chapterflow-brand.ts:43-45

PROBLEM:
Middleware builds returnTo as an absolute URL from the request host (currentTarget = new URL(pathname+search, resolveRequestOrigin(req)); loginUrl.searchParams.set('returnTo', currentTarget.toString()), middleware.ts:73-79). /auth/login then sanitizeReturnTo's it (login/route.ts:79). For absolute URLs sanitizeReturnTo accepts only origins in allowedOrigins() (return-to.ts:67-72), which is built SOLELY from env vars (APP_BASE_URL/NEXT_PUBLIC_SITE_URL/etc.) because usesDedicatedChapterFlowHosts() hard-returns false (chapterflow-brand.ts:43-45). If those env vars are unset or don't match the deployed/forwarded host, the absolute returnTo is rejected and falls back to '/book', dropping the original destination (e.g. /book/pair-accept?code=..., gift links routed through protected /book paths).

WHY IT MATTERS:
Growth-loop deep links can silently lose their target on login for logged-out recipients in any environment where the site-URL allowlist doesn't exactly match the serving host. This matches a known HANDOFF in the auth-wave memory ('middleware relative returnTo'). Conditional on env misconfiguration, hence medium, not high.

REQUIRED FIX:
Emit a RELATIVE returnTo from middleware: loginUrl.searchParams.set('returnTo', `${req.nextUrl.pathname}${req.nextUrl.search}`). sanitizeReturnTo's relative-path branch (return-to.ts:61-62) accepts same-origin paths via isSafeInternalPath unconditionally (return-to-core.ts:29-36), so the destination always survives without depending on the cross-origin allowlist. Keep the absolute-URL allowlist only for genuine cross-host SSO.

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

### M49 — Unused heavy dependencies shipped (aws-sdk v2, pdf-lib, pdfjs-dist) + app-unused openai — 3 of 6 moderate CVEs; bundle-bloat claim overstated
`severity: medium` · `effort: small` · `files: package.json:36, package.json:46, package.json:47, package.json:45, open-next.config.ts:1-17`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: package.json:36, package.json:46, package.json:47, package.json:45, open-next.config.ts:1-17

PROBLEM:
Verified: package.json declares aws-sdk@^2.1693.0 (l36), pdf-lib@^1.17.1 (l46), pdfjs-dist@^5.5.207 (l47), openai@^6.34.0 (l45). git grep across app/, lib/, components/, *.ts/*.tsx shows ZERO imports of aws-sdk, pdf-lib, or pdfjs-dist (only @aws-sdk/* v3 modular clients are used). openai is imported ONLY by scripts/book/.../providers/openai-api.ts (the out-of-scope content pipeline). aws-sdk 2.1693.0 and pdf-lib are confirmed installed in package-lock. `npm audit --omit=dev` returns exactly 6 moderate; aws-sdk contributes 2 of them (region-injection + its transitive uuid buffer-bounds). So the unused-dep and CVE-attribution claims are accurate.

WHY IT MATTERS:
Carrying known-vulnerable, never-imported code (aws-sdk v2 region-injection, transitive uuid bounds) in the dependency tree; persistent npm audit/Dependabot noise that can mask future real advisories; extra node_modules install/CI weight. NOT a meaningful production Lambda cold-start cost (see verifyNotes).

REQUIRED FIX:
Remove aws-sdk, pdf-lib, pdfjs-dist from package.json dependencies and run npm install; re-run `npm audit --omit=dev` to confirm 6→~4 (remaining moderate: @anthropic-ai/sdk, next→postcss, geist→next, and possibly a now-orphaned uuid if pulled elsewhere). Verify `npm run build` + `npx open-next build` still pass (they will — nothing imports these). Do NOT remove openai from THIS package.json without checking whether scripts/book (the pipeline) resolves it from this same root node_modules — it is imported by scripts/book/.../providers/openai-api.ts, so dropping it could break the (out-of-scope) pipeline; if the pipeline shares this manifest, leave openai or move it to a pipeline-local package.

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

### M51 — E2E CI gate only smoke-tests the Turbopack dev build with auth bypassed — never exercises the production artifact or real-data/error paths
`severity: medium` · `effort: medium` · `files: .github/workflows/ci.yml:59-95, playwright.config.ts:23-30, e2e/smoke.spec.ts:44-57`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: .github/workflows/ci.yml:59-95, playwright.config.ts:23-30, e2e/smoke.spec.ts:44-57

PROBLEM:
Verified: the e2e job (ci.yml:59-95) runs `npm run test:e2e`, whose playwright.config.ts webServer command is `npm run dev` (l24) — the Turbopack DEV server with DEV_AUTH_BYPASS=1 + NEXT_DIST_DIR=.next-chapterflow (from the dev script), NOT `next start` on the prod build. The job intentionally omits BOOK_TABLE_NAME/Cognito (ci.yml:64-69), so the smoke spec validates routes only in dev-bypass mode with no data plane. The spec (smoke.spec.ts) asserts public pages render and the authed shell (/dashboard, /book, /book/library, /book/progress) renders without an error overlay and is non-blank — all under auth-bypass. The prod bundle IS built by app-checks (next build + open-next build) but never browser-driven pre-deploy; real-auth bounce and DynamoDB-backed pages are never smoke-tested in CI. The deploy health gate curls /, /pricing, /api/health (HTTP status only, post-deploy).

WHY IT MATTERS:
Prod-build-only crashes, dev-vs-prod hydration mismatches, auth-required redirect loops, and data-page 500s can pass all of CI and surface only at the post-deploy health gate or to users. The smoke suite gives false confidence that the authed shell works when it's only verified with auth bypassed and no DB.

REQUIRED FIX:
Add a second Playwright project/job against the production server: `next build` (NEXT_DIST_DIR set) then `next start`, with DEV_AUTH_BYPASS unset, asserting at least the unauthenticated→/auth/login bounce explicitly (and, with a disposable test backend, a data-backed page). Keep the fast dev-bypass smoke for shell coverage. At minimum, document in ci.yml that the e2e gate is dev-mode-only so it isn't mistaken for prod-build coverage.

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

### L1 — /auth/login throws an unhandled 500 (raw Next error page) when Cognito env is missing; the friendly 500 guard below it is dead code
`severity: low` · `effort: trivial` · `files: app/auth/login/route.ts:71, app/auth/login/route.ts:72, app/auth/login/route.ts:73, app/auth/login/route.ts:75`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/auth/login/route.ts:71, app/auth/login/route.ts:72, app/auth/login/route.ts:73, app/auth/login/route.ts:75

PROBLEM:
login:71-73 call resolveCognitoDomain() and two mustServerEnv(...) with NO try/catch. mustServerEnv throws 'Missing env var: …' when COGNITO_DOMAIN/COGNITO_CLIENT_ID/COGNITO_REDIRECT_URI are unset, so a misconfigured deploy yields an unhandled exception → generic Next 500 on the primary sign-in entry point. The `if (!domain || !clientId || !redirectUri) return 500` guard at login:75-77 can never run because the throw at 71-73 happens first — confirmed dead. Contrast callback/route.ts which correctly wraps everything in try/catch and redirects to /?auth=server_error (callback:70,193-198).

WHY IT MATTERS:
If a required Cognito env var is missing/typo'd at launch, every user hitting Sign in gets an opaque 500 instead of a graceful redirect, and the unreachable guard misleads reviewers into thinking it's handled.

REQUIRED FIX:
Wrap the body of GET (after the resolvePublicOrigin call so `origin` is available) in try/catch mirroring the callback: on error console.error and `return NextResponse.redirect(new URL('/?auth=server_error', origin))`. Then delete the unreachable login:75-77 guard. Note the deleted-account early-return at login:58-69 also calls getAuthCookieBase but not Cognito env, so it stays correct inside the try.

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

### L8 — /api/auth/session and /api/me cannot distinguish 'logged out' from 'Cognito/JWKS temporarily unverifiable', so a verification outage shows users as logged out
`severity: low` · `effort: medium` · `files: app/app/api/_lib/auth.ts:72, app/app/api/_lib/auth.ts:73, app/app/api/_lib/auth.ts:75, app/app/api/auth/session/route.ts:18, app/app/api/me/route.ts:16`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/_lib/auth.ts:72, app/app/api/_lib/auth.ts:73, app/app/api/_lib/auth.ts:75, app/app/api/auth/session/route.ts:18, app/app/api/me/route.ts:16

PROBLEM:
requireUser() wraps jwtVerify in try/catch and throws AuthError('INVALID_TOKEN') for ANY failure (auth.ts:72-75), conflating 'token invalid/expired' with 'couldn't reach/parse the JWKS' (transport error on a cold/uncached kid). session/route.ts catches everything and returns {loggedIn:false} status 200 (session/route:18-19); me/route.ts returns {authenticated:false} 401 for AuthError (me/route:17-18). useAuthStatus then treats !res.ok OR loggedIn!==true as logged-out (useAuthStatus:20,25,35). So during a JWKS hiccup affecting an uncached key, a genuinely-logged-in user's Navbar/Pricing flips to logged-out. Real but bounded: jose's createRemoteJWKSet (auth.ts:32) caches keys (~10min) with a cooldown, so warm instances keep verifying even if the endpoint blips; exposure is cold starts + key-rotation windows. The getAuthConfig promise-cache nulls on failure (auth.ts:38-40) so config errors retry, but a per-verify JWKS fetch failure still surfaces as INVALID_TOKEN.

WHY IT MATTERS:
Low, mostly cold-start bounded: during a Cognito JWKS hiccup on an uncached key, logged-in users momentarily see logged-out UI / spurious 401s, possibly prompting needless re-logins.

REQUIRED FIX:
In auth.ts distinguish the failure class: jose throws JWKSNoMatchingKey / JWTExpired / JWSSignatureVerificationFailed (genuine invalid) vs fetch/transport errors when retrieving JWKS (transient). Inspect the caught error (err.code / err.name / instanceof) and throw a distinct AuthError('VERIFIER_UNAVAILABLE'); have /api/me return 503 for that case (not 401) and have useAuthStatus NOT set loggedIn=false on 5xx (retry instead). /api/auth/session could return a third state ('unknown') or simply omit the flip on 5xx. Note this widens the AuthError union (currently 'UNAUTHENTICATED'|'INVALID_TOKEN' at auth.ts:8).

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

### L41 — Scenario submissions trigger a Claude moderation call with no per-user submission rate limit
`severity: low` · `effort: small` · `files: app/app/api/book/me/books/[bookId]/chapters/[chapterNumber]/scenarios/route.ts:194-215`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/book/me/books/[bookId]/chapters/[chapterNumber]/scenarios/route.ts:194-215

PROBLEM:
POST scenarios validates input lengths well (title 6-160, scenario/whatToDo/whyItMatters 20/40-2500 via requireString) but applies no per-user/per-day submission cap. Each POST with a configured ANTHROPIC_API_KEY calls validateScenario (a Haiku moderation call, line 211-214) and, on auto_approve, awards Insight Points. A user can repeatedly submit scenarios, each incurring a Haiku cost and potentially farming approval points if the moderator can be coaxed to auto_approve. Lower severity because input is length-bounded and Haiku is cheap, but it is still an uncapped LLM call per submission.

WHY IT MATTERS:
Moderate LLM cost-abuse vector plus a points-farming avenue. Cheaper and better-bounded than Ask/feedback, but uncapped.

REQUIRED FIX:
Add a per-user daily submission cap (a BOOKUSER#... SCENARIO_LIMIT#date counter) checked atomically before calling validateScenario — reuse the conditional-counter pattern from the Ask fix (ConditionExpression on count < limit) — or a short per-user cooldown. Independently, since points are awarded on auto_approve, consider rate-limiting point grants per day even when submissions are allowed.

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

### L44 — getServerEnv permanently caches missing env vars, so a transient SSM error becomes a permanent 'missing'
`severity: low` · `effort: small` · `files: app/app/api/_lib/server-env.ts:108-118, app/app/api/_lib/server-env.ts:120-139`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/_lib/server-env.ts:108-118, app/app/api/_lib/server-env.ts:120-139

PROBLEM:
The code is exactly as described: when loadFromSsm returns undefined, getServerEnv adds the name to missingCache (a process-lifetime Set) and never retries. HOWEVER the transient-error-poisoning path only occurs when SSM_PREFIX is UNSET: with SSM_PREFIX set, loadFromSsm THROWS the lastError (line 112) instead of returning undefined, so getServerEnv never reaches missingCache.add — the request fails loudly and a later call retries fresh. I verified that every deployed environment SETS SSM_PARAMETER_PREFIX (infra/lib/chapterflow-frontend-stack.ts:364, chapterflow-backend-stack.ts:442, cdk.out templates show '/chapterflow/dev'; .github workflows export SSM_PREFIX). So the 'instance-sticky Stripe price/secret resolves to undefined on some instances' scenario the finding describes CANNOT happen in prod as deployed — it only happens locally / in an unconfigured env where SSM is an explicit optional fallback.

WHY IT MATTERS:
In deployed envs (SSM_PREFIX always set): no transient poisoning — transient SSM errors throw and are retried. The only residual: genuinely-absent values are cached as missing for the process lifetime, which is intended/desirable. The poisoning risk is confined to no-prefix dev/local runs.

REQUIRED FIX:
Still worth a small hardening: in loadFromSsm, distinguish 'errored' from 'genuinely absent' even on the no-prefix path (return a sentinel / throw on real errors), or give missingCache a short TTL, so a no-prefix local instance isn't poisoned by a transient blip. Low priority since prod always sets the prefix.

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

### L49 — Ingestion writes all S3 artifacts sequentially with no rollback on partial failure
`severity: low` · `effort: medium` · `files: app/app/api/book/_lib/ingestion.ts:85-122, app/app/api/book/_lib/repo.ts:344-360, app/app/api/book/_lib/repo.ts:2076 (deleteBookVersion)`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/book/_lib/ingestion.ts:85-122, app/app/api/book/_lib/repo.ts:344-360, app/app/api/book/_lib/repo.ts:2076 (deleteBookVersion)

PROBLEM:
After createBookVersionDraft writes the DRAFT row (48-56), book.json/manifest/chapters/quizzes/concept-graph are written one-by-one in awaited loops (85-105) then meta/catalog upsert + optional publish (107-122), with no try/catch around the S3 writes. A mid-loop throw leaves the draft row + partial S3 objects. getNextVersionNumber (344) always returns latest+1 (no packageId dedup), so a retry/re-upload of the identical package allocates a NEW version, orphaning the partial prefix. deleteBookVersion exists (repo.ts:2076), so a cleanup path is available.

WHY IT MATTERS:
Failed ingests leave orphaned partial S3 prefixes and dangling DRAFT rows for manual cleanup; re-uploads multiply versions. Ops burden, not user-facing.

REQUIRED FIX:
Wrap the artifact writes in try/catch; on failure best-effort delete the prefix + call deleteBookVersion(version). Add a packageId-based idempotency check (query existing versions for the same pkg.packageId and reuse) so identical re-uploads don't create new versions.

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

### L84 — OpenDyslexic accessibility font loads from a third-party CDN at runtime
`severity: low` · `effort: small` · `files: app/globals.css:16-29, app/book/hooks/useBookPreferences.ts:879-884`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/globals.css:16-29, app/book/hooks/useBookPreferences.ts:879-884

PROBLEM:
globals.css 16-29 declares two @font-face rules for 'OpenDyslexic' with src pointing at https://cdn.jsdelivr.net/npm/open-dyslexic@1.0.3/woff/... (Regular + Bold), unlike Satoshi (self-hosted via next/font/local) and Jakarta/JetBrains (next/font/google, self-hosted at build). useBookPreferences fontMap maps 'opendyslexic' to '"OpenDyslexic", sans-serif' (line 882). When a dyslexic user selects this font, the page fetches woff files cross-origin from jsdelivr; if jsdelivr is blocked (firewall/blockers), slow, or a future font-src 'self' CSP is added, the font silently fails to system sans-serif, and the user's IP/timing leak to a third party precisely when the a11y setting is on.

WHY IT MATTERS:
Unreliable accessibility feature on restricted networks; third-party request tied to an a11y feature; a future CSP would break it without an explicit font-src allowlist entry.

REQUIRED FIX:
Self-host OpenDyslexic: add the woff2 files under public/fonts and either declare a local @font-face with a relative src (url('/fonts/OpenDyslexic-Regular.woff2')) or load via next/font/local mirroring Satoshi. Remove the jsdelivr URLs at globals.css:16-29. Verify the woff/woff2 licensing permits redistribution (OpenDyslexic is OFL/Bitstream-Vera-derived, redistributable).

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

### L88 — next.config.ts redirects use permanent: true (308) — permanently browser-cached, hard to undo
`severity: low` · `effort: trivial` · `files: next.config.ts:55-73`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: next.config.ts:55-73

PROBLEM:
Verified: all three legacy redirects (/book/workspace, /book/workspace/:path*, /book/home → /dashboard) declare permanent: true (l60, l65, l70; grep -c 'permanent: true' = 3), emitting HTTP 308. Browsers/CloudFront cache 308 indefinitely; if any of these paths is ever repurposed or the target changes from /dashboard, returning users keep the cached redirect with no server recourse. For a route map still settling post-UI-overhaul this is a (low) risk.

WHY IT MATTERS:
If these routes are repurposed or the target changes post-launch, returning users keep getting 308-redirected to the stale destination from browser cache — effectively un-fixable per-user without a cache clear.

REQUIRED FIX:
Change permanent: true → permanent: false (307 Temporary) for the three redirects until the route map is confirmed stable post-launch; promote to 308 only once /dashboard is permanent and /book/workspace + /book/home are confirmed dead forever.

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

### L91 — CI app-checks build uses placeholder Cognito/table env that masks missing-config crashes; launch-blocking env vars fail soft, no .env.example
`severity: low` · `effort: medium` · `files: .github/workflows/ci.yml:19-25, .github/workflows/_deploy-app.yml:131-185, app/app/api/_lib/server-env.ts`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: .github/workflows/ci.yml:19-25, .github/workflows/_deploy-app.yml:131-185, app/app/api/_lib/server-env.ts

PROBLEM:
Verified: app-checks injects COGNITO_REGION/COGNITO_USER_POOL_ID/BOOK_TABLE_NAME placeholders (ci.yml:23-25) 'so server modules that read config don't throw during next build.' Reasonable for a build, but it means a NEW required var (mustServerEnv'd but not module-init-read) still builds green. There is no committed .env.example (only an untracked .env.local; git ls-files shows no tracked .env) to machine-check the contract against. The deploy health gate (_deploy-app.yml:131-163) is BLOCKING but checks only HTTP status of /, /pricing, /api/health; the deep readiness smoke (l170-185, /api/health?deep=1) is continue-on-error and the endpoint always returns 200, so a degraded auth/billing/content dependency is surfaced but never fails the deploy — including for prod. Launch-blockers like CHAPTERFLOW_APP_BASE_URL, AUTH_STATE_SECRET length, VAPID/email SSM params are not asserted by any blocking gate.

WHY IT MATTERS:
A new hard-required env var or a typo in the deploy secret list passes CI and only fails at prod deploy time; several documented launch-blockers fail soft (degraded auth/billing/content) and can reach live users without stopping the deploy.

REQUIRED FIX:
Add a committed .env.example enumerating every ENVIRONMENT.md var with required/optional markers, plus a small CI/script check that asserts the contract. Most impactful: make prod readiness fail loud — for inputs.environment=='prod', promote the deep /api/health?deep=1 readiness step (_deploy-app.yml:170-185) from continue-on-error to blocking (and/or have the deep endpoint return non-200 when a critical dependency is degraded), so a broken auth/billing/content dependency stops the prod deploy instead of merely being tabled.

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

### P2 — Console.log noise in hot audio path and stray debug logging
`severity: polish` · `effort: trivial` · `files: app/app/api/book/books/[bookId]/chapters/[chapterNumber]/audio/route.ts:145,244,347,375-383,389,412,425,439,443,454,465,480, app/app/api/book/books/[bookId]/ask/route.ts:214`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/book/books/[bookId]/chapters/[chapterNumber]/audio/route.ts:145,244,347,375-383,389,412,425,439,443,454,465,480, app/app/api/book/books/[bookId]/ask/route.ts:214

PROBLEM:
The audio route emits ~15 console.log lines per request (takeaway counts line 145, per-segment cache writes line 244, plan line 347, per-segment load/miss lines 375-383, greeting generation 389/412, body-segment generation 425/439/443, skipped segments 454, stitch summary 465, stitched-cache write 480), and the ask route warns on cache miss (line 214). These run on every Pro audio playback / question, adding log volume and latency in production with no structured-metrics value, and some include user-derived strings (e.g. line 389 logs userName).

WHY IT MATTERS:
Noisy CloudWatch logs raise cost and bury real errors; some logs include user-derived strings.

REQUIRED FIX:
Gate these behind a debug flag or downgrade to structured metric emissions (putOpsMetric) instead of console.log on the request hot path; keep only console.error for genuine failures.

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
