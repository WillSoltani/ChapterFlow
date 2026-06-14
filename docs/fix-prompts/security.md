# Fix prompts — Security

_24 items (5 high, 5 medium, 14 low). ChapterFlow production-readiness remediation. Fixes land on branch `audit/prod-readiness-2026-06-14`. See [DISPATCH.md](DISPATCH.md)._

## Shared context (every prompt below assumes this)

**App:** ChapterFlow — Next.js 16 (App Router, React 19) "book learning" web app. Backend = DynamoDB single-table (`app/app/api/book/_lib/repo.ts`) behind Cognito JWT auth (`requireUser`/`requireActiveBookUser`/`requireAdminUser`), Stripe billing, S3 content, CDK infra (`infra/`). API routes live under `app/app/api/book/**` (URL `/app/api/book/**`). Error envelope = `withBookApiErrors`+`BookApiError`.

**BRANCH — read this first:** all fixes land on **`audit/prod-readiness-2026-06-14`**. Each prompt tells the agent to confirm it's on that branch (or a `fix/<ID>` worktree branched off it) before editing, and to commit its single fix when done. See [DISPATCH.md](DISPATCH.md) for how to run agents in parallel safely.

**Rules for every fix agent:**
1. Change ONLY the cited files + direct deps. Do NOT touch `scripts/`, `book-packages/`, `content/`, `state/`, `graphify-out/`.
2. Match surrounding code style; reuse existing helpers (auth guards, `BookApiError`, repo functions, `keys.ts`, `lib/catalog-stats.ts`, `lib/pricing.ts`).
3. Never make a security/economy/paywall decision from client-supplied data — the server is the source of truth.
4. Verify, then commit ONLY your changed files (never `docs/`, `scripts/`, lockfiles you didn't intend). Do not push.
5. Line numbers were accurate at audit time — re-read each file and confirm before editing.

---

### H10 — Ask-the-Book daily rate limit is bypassable via a race (parallel requests) and aborted streams consume tokens free
`severity: high` · `effort: medium` · `files: app/app/api/book/books/[bookId]/ask/route.ts:53-64, app/app/api/book/books/[bookId]/ask/route.ts:295-312`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app
(Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

BRANCH: Work on "audit/prod-readiness-2026-06-14". First run:
  git rev-parse --abbrev-ref HEAD
If it is not "audit/prod-readiness-2026-06-14" and not a "fix/H10" worktree branched off it, run:
  git checkout audit/prod-readiness-2026-06-14
Do NOT create unrelated branches and do NOT switch away mid-task.

FILES: app/app/api/book/books/[bookId]/ask/route.ts:53-64, app/app/api/book/books/[bookId]/ask/route.ts:295-312

PROBLEM:
The daily question cap is a non-atomic read-modify-write. The handler GETs the count (line 53-56), compares `currentCount >= limit` (line 62), and only increments in the stream's `finally` block AND only when `streamSuccess === true` (line 295-312). The UpdateCommand is `SET #count = if_not_exists(#count,:zero) + :one` with NO ConditionExpression (grep confirms zero ConditionExpression in this file). Two real holes: (a) N parallel POSTs all read the same currentCount before any increment lands, so all N pass the gate and all N invoke Claude — the 5/day (free) / 20/day (Pro) cap is trivially exceeded; (b) on client abort the recordAiUsage path classifies outcome as 'client_abort' (line 289) and streamSuccess stays false, so tokens were billed by Anthropic but the count is never incremented — abort-and-retry is unlimited free LLM usage.

WHY IT MATTERS:
Unbounded Claude (Haiku) spend on an authed but otherwise open endpoint. A scripted user can far exceed the intended per-day cap, turning a cost-controlled feature into an open cost vector at launch.

REQUIRED FIX:
Make the reservation atomic and decoupled from stream success. Before opening the stream, do a single conditional UpdateCommand `UpdateExpression: 'SET #count = if_not_exists(#count,:zero) + :one, ...'` with `ConditionExpression: 'attribute_not_exists(#count) OR #count < :limit'` and `:limit` set to the plan limit; on ConditionalCheckFailedException return 429. This both serializes concurrent requests (last writer increments, others fail the condition) and counts the attempt the moment Claude is invoked so aborts can't farm free tokens. Optionally compensate (decrement) only on a pre-stream failure (e.g. missing API key / book-not-found) before any tokens flow.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Add or update a unit test that fails before and passes after the fix.

VERIFY (must pass before committing):
  npm run typecheck
  npm run test
  npx eslint <each file you changed>

COMMIT (only after the checks pass):
  git add <only the files you changed>      # NOT docs/, NOT lockfiles you didn't mean to
  git commit -m "fix(security): H10 — Ask-the-Book daily rate limit is bypassable via a race (para"
Then report: the diff summary + the command output. Do NOT push.
```

---

### H11 — Reflection-feedback endpoint: client-controlled exampleId defeats the rate limit and uncapped prompt fields inflate token cost
`severity: high` · `effort: medium` · `files: app/app/api/book/me/reflections/[bookId]/[chapterNumber]/feedback/route.ts:29-53, app/app/api/book/_lib/ai-service.ts:95-118`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app
(Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

BRANCH: Work on "audit/prod-readiness-2026-06-14". First run:
  git rev-parse --abbrev-ref HEAD
If it is not "audit/prod-readiness-2026-06-14" and not a "fix/H11" worktree branched off it, run:
  git checkout audit/prod-readiness-2026-06-14
Do NOT create unrelated branches and do NOT switch away mid-task.

FILES: app/app/api/book/me/reflections/[bookId]/[chapterNumber]/feedback/route.ts:29-53, app/app/api/book/_lib/ai-service.ts:95-118

PROBLEM:
exampleId is read raw from the body (`typeof body.exampleId === 'string' ? body.exampleId : ''`, line 29) with no validation that it corresponds to a real example in the chapter, then used as both the rate-limit key `feedbackLimitSk(today, exampleId)` (line 47) and the cache key `reflectionFeedbackSk(bookId, chapter, exampleId)` (line 56). The 'already requested today' guard (line 51) is therefore per-exampleId — a caller sending a fresh random exampleId on every request never trips it and gets unlimited Sonnet streams. Separately, scenario/whatToDo/whyItMatters/chapterTitle are read from the body (lines 31-34) with NO length cap (grep confirms only reflectionText has the 20/2000 bounds at lines 36-41) and are interpolated verbatim into the Sonnet user message in streamReflectionFeedback (ai-service.ts:113-116). A caller can stuff large strings into whatToDo to drive up input-token cost per call.

WHY IT MATTERS:
Unbounded Sonnet-4-6 spend ($3/$15 per MTok — the most expensive of the three features). Cost-abuse launch blocker on a paid product, plus a mild prompt-injection surface since the fields are echoed into the prompt.

REQUIRED FIX:
Rate-limit per (user, chapter) instead of per client exampleId, OR validate exampleId against the chapter's real examples (load via content-service getPublishedBookManifest / chapter JSON and confirm the example exists) before using it as the limit/cache key. Independently, cap scenario/whatToDo/whyItMatters/chapterTitle server-side (e.g. the same maxLength ~2500 the scenarios route applies via requireString) before passing them to streamReflectionFeedback. Validating exampleId also fixes the cache key, which currently caches per arbitrary client id.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Add or update a unit test that fails before and passes after the fix.

VERIFY (must pass before committing):
  npm run typecheck
  npm run test
  npx eslint <each file you changed>

COMMIT (only after the checks pass):
  git add <only the files you changed>      # NOT docs/, NOT lockfiles you didn't mean to
  git commit -m "fix(security): H11 — Reflection-feedback endpoint: client-controlled exampleId de"
Then report: the diff summary + the command output. Do NOT push.
```

---

### H13 — Public Lambda Function URLs, no CloudFront lock, no WAF
`severity: high` · `effort: medium` · `files: infra/lib/chapterflow-frontend-stack.ts:397-400, infra/lib/chapterflow-frontend-stack.ts:424-426, infra/lib/chapterflow-frontend-stack.ts:579-590, app/app/_lib/server-origin.ts:50-56`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app
(Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

BRANCH: Work on "audit/prod-readiness-2026-06-14". First run:
  git rev-parse --abbrev-ref HEAD
If it is not "audit/prod-readiness-2026-06-14" and not a "fix/H13" worktree branched off it, run:
  git checkout audit/prod-readiness-2026-06-14
Do NOT create unrelated branches and do NOT switch away mid-task.

FILES: infra/lib/chapterflow-frontend-stack.ts:397-400, infra/lib/chapterflow-frontend-stack.ts:424-426, infra/lib/chapterflow-frontend-stack.ts:579-590, app/app/_lib/server-origin.ts:50-56

PROBLEM:
serverFnUrl (line 397) and imageFnUrl (line 424) both use authType FunctionUrlAuthType.NONE. The CloudFront origin only sets a plain x-forwarded-host custom header (line 583-585) and uses HttpOrigin — there is no FunctionUrlOrigin.withOriginAccessControl, no IAM auth, no shared secret header. Nothing prevents a direct hit to the public Function URL, which bypasses CloudFront entirely (no rate limiting/bot control) and lets the caller forge x-forwarded-host. grep confirms NO WAFv2/WebACL anywhere in infra/.

WHY IT MATTERS:
The auth/billing SSR app sits on an unauthenticated, publicly-reachable endpoint with no edge rate-limiting or WAF. Host forgery IS possible for code that reads x-forwarded-host. However the author's 'breaks OAuth/Stripe' claim is overstated: app/app/_lib/server-origin.ts (the only thing that trusts x-forwarded-host) is consumed by exactly ONE route — the pair-invite link builder (app/app/api/book/me/pairs/invite/route.ts). Stripe checkout uses getAppBaseUrl() which resolves CHAPTERFLOW_APP_BASE_URL from env/SSM and THROWS in prod if unset (book/_lib/env.ts:57-72, billing/checkout-session/route.ts:130-131), and OAuth uses a fixed COGNITO_REDIRECT_URI. So the live forgery blast radius is the pair-invite URL plus the missing rate-limiting/DDoS posture, not auth/billing redirect hijack.

REQUIRED FIX:
Lock the Function URLs to CloudFront: use origins.FunctionUrlOrigin.withOriginAccessControl(serverFnUrl/imageFnUrl) (CDK now supports OAC for Function URLs and auto-grants lambda:InvokeFunctionUrl) and set both URLs to authType AWS_IAM; OR inject a secret x-origin-verify custom header at the origin and reject mismatches in the OpenNext middleware. Attach a WAFv2 WebACL (managed common rule set + a rate-based rule) to the distribution. Separately, harden server-origin.ts to ignore x-forwarded-host unless APP_BASE_URL/CHAPTERFLOW_APP_BASE_URL is set (it already prefers APP_BASE_URL, but that env var is not injected into the server Lambda, so prod falls through to the forgeable header).

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Add or update a unit test that fails before and passes after the fix.

VERIFY (must pass before committing):
  npm run typecheck
  npm run test
  npx eslint <each file you changed>

COMMIT (only after the checks pass):
  git add <only the files you changed>      # NOT docs/, NOT lockfiles you didn't mean to
  git commit -m "fix(security): H13 — Public Lambda Function URLs, no CloudFront lock, no WAF"
Then report: the diff summary + the command output. Do NOT push.
```

---

### H18 — Public book-request endpoint has no rate limiting or abuse controls (writes DynamoDB + sends SES email per request)
`severity: high` · `effort: medium` · `files: app/api/book-requests/route.ts:57-111, app/api/book-requests/route.ts:152-237`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app
(Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

BRANCH: Work on "audit/prod-readiness-2026-06-14". First run:
  git rev-parse --abbrev-ref HEAD
If it is not "audit/prod-readiness-2026-06-14" and not a "fix/H18" worktree branched off it, run:
  git checkout audit/prod-readiness-2026-06-14
Do NOT create unrelated branches and do NOT switch away mid-task.

FILES: app/api/book-requests/route.ts:57-111, app/api/book-requests/route.ts:152-237

PROBLEM:
POST /api/book-requests is intentionally public (the header comment and middleware.ts:38-44 confirm only /app, /book, /dashboard are protected; this top-level route is reachable logged-out). Each valid submission persists an item to the operational DynamoDB table (persist(), lines 152-197) and fires a best-effort SES email to the team (notifyTeam(), lines 199-237). The only input checks are title length>=2 and an email regex (lines 72-77); cleanString caps lengths and strips CRLF (good header-injection defense), but there is no rate limit, captcha, origin/CSRF check, or per-IP throttle. Grep confirms the repo's only rate limiting lives in /app/api/book/* routes as per-user DynamoDB markers (e.g. quiz/feedback) — none of it is wired into or reusable by this public route. The handler reads x-forwarded-for only to store it, not to throttle.

WHY IT MATTERS:
Pre-launch this is an open, unauthenticated write+email amplification surface: unbounded DynamoDB writes, unbounded SES sends (cost + SES quota/reputation risk), and team-inbox flooding/spam relay via title/author/note fields. Trivially scriptable once the site is public.

REQUIRED FIX:
Add a per-IP throttle before persist() (an in-memory token bucket is weak in serverless/multi-instance; prefer a DynamoDB TTL counter keyed on the x-forwarded-for IP, e.g. a REQLIMIT# item with conditional increment, capping to a few/hour) and gate notifyTeam behind the same limit so a burst can't fan out emails. Add a honeypot field and/or Turnstile/hCaptcha token on the public form. At minimum cap SES sends per window.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Add or update a unit test that fails before and passes after the fix.

VERIFY (must pass before committing):
  npm run typecheck
  npm run test
  npx eslint <each file you changed>

COMMIT (only after the checks pass):
  git add <only the files you changed>      # NOT docs/, NOT lockfiles you didn't mean to
  git commit -m "fix(security): H18 — Public book-request endpoint has no rate limiting or abuse c"
Then report: the diff summary + the command output. Do NOT push.
```

---

### H28 — No document-level Content-Security-Policy header for an auth + payments product
`severity: high` · `effort: medium` · `files: next.config.ts:35-54, next.config.ts:33, middleware.ts`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app
(Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

BRANCH: Work on "audit/prod-readiness-2026-06-14". First run:
  git rev-parse --abbrev-ref HEAD
If it is not "audit/prod-readiness-2026-06-14" and not a "fix/H28" worktree branched off it, run:
  git checkout audit/prod-readiness-2026-06-14
Do NOT create unrelated branches and do NOT switch away mid-task.

FILES: next.config.ts:35-54, next.config.ts:33, middleware.ts

PROBLEM:
Verified: next.config.ts headers() on /(.*) (l38-51) sets X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, HSTS, and Permissions-Policy but NO Content-Security-Policy. The only CSP in the repo is the image-optimizer sandbox policy at next.config.ts:33 (`default-src 'self'; script-src 'none'; sandbox;`), which Next applies only to optimized /_next/image responses, not HTML documents. git grep for Content-Security-Policy / frame-ancestors across app/, lib/, components/, middleware.ts, next.config.ts returns nothing outside that image policy. middleware.ts sets no CSP/nonce. The app renders Stripe flows, Cognito session cookies, and AI/user-generated content (Ask-the-Book, community/reflections), so a missing CSP is a real defense-in-depth gap.

WHY IT MATTERS:
Any reflected/stored XSS (AI-rendered markdown, community scenario/reflection text, or a future 3rd-party script) executes with full origin privileges — session/Stripe-redirect abuse. X-Frame-Options DENY does cover clickjacking, but there is zero script/connect/frame source restriction for a payments+PII product.

REQUIRED FIX:
Add a Content-Security-Policy on the /(.*) headers() source. Because Next emits inline bootstrap scripts, the robust path is a per-request nonce injected via middleware.ts (strict-dynamic + 'nonce-...' for script-src) — middleware already runs on the app, so extend it to set the nonce header and the CSP. Stage as Content-Security-Policy-Report-Only first to discover required sources (Cognito Hosted UI, Stripe.js/js.stripe.com in script-src + frame-src, the S3 cover host in img-src, connect-src for the API), then promote to enforcing. At minimum add `frame-ancestors 'none'` and a baseline default-src 'self' to complement the existing headers.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Add or update a unit test that fails before and passes after the fix.

VERIFY (must pass before committing):
  npm run typecheck
  npm run test
  npx eslint <each file you changed>

COMMIT (only after the checks pass):
  git add <only the files you changed>      # NOT docs/, NOT lockfiles you didn't mean to
  git commit -m "fix(security): H28 — No document-level Content-Security-Policy header for an auth"
Then report: the diff summary + the command output. Do NOT push.
```

---

### M1 — OAuth callback never validates the state nonce — CSRF defense rests solely on encrypted-state integrity, and the cookie-fallback path has no anti-CSRF check at all
`severity: medium` · `effort: small` · `files: app/auth/callback/route.ts:54, app/auth/callback/route.ts:85, app/auth/login/route.ts:97, app/auth/login/route.ts:132, app/auth/_lib/state-crypto.ts:18`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app
(Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

BRANCH: Work on "audit/prod-readiness-2026-06-14". First run:
  git rev-parse --abbrev-ref HEAD
If it is not "audit/prod-readiness-2026-06-14" and not a "fix/M1" worktree branched off it, run:
  git checkout audit/prod-readiness-2026-06-14
Do NOT create unrelated branches and do NOT switch away mid-task.

FILES: app/auth/callback/route.ts:54, app/auth/callback/route.ts:85, app/auth/login/route.ts:97, app/auth/login/route.ts:132, app/auth/_lib/state-crypto.ts:18

PROBLEM:
Login mints nonce=crypto.randomUUID() (login:97), stores it in the encrypted state field `n` and in the oauth_state cookie (login:132). In the callback, nonce is recovered both from decrypted state (callback:41) and the oauth_state cookie fallback (callback:54), and destructured at callback:85 — but grep confirms it is NEVER compared to anything; callback:85 is its last reference. For the PRIMARY path this is fine: state is AES-256-GCM encrypted with a server secret, so an attacker can't forge a valid state carrying their own PKCE verifier, and verifier-binding gives implicit CSRF protection. The residual gap is the documented FALLBACK path (resolveAuthState callback:51-60), which reads pkce_verifier and post_auth_redirect from plain cookies with no check that the IdP-echoed state equals the oauth_state cookie. If decryptState ever returns null (AUTH_STATE_SECRET unset/rotated/short — state-crypto:32-40 throws, encryptState catches and returns null, so login falls back to `state = encrypted ?? nonce` = raw nonce at login:107), the flow degrades to a cookie-only exchange with zero state validation.

WHY IT MATTERS:
Today, low real risk because the encrypted-state path is the norm and the secret is required (>=32 chars) for encryption to succeed. But the moment the fallback path is exercised (secret unset/rotated during a rolling deploy, or an attacker who suppresses encrypted state and supplies their own code + oauth_state cookie), there is no CSRF binding between the IdP response and the user's flow-initiation — a classic login-CSRF / session-fixation surface.

REQUIRED FIX:
In resolveAuthState's fallback branch (callback:51-60), require req.cookies.get('oauth_state')?.value === stateParam (when decryption failed, the raw state param equals the nonce per login:107). On mismatch return verifier:null so the handler restarts the flow via the existing callback:90-96 redirect. Alternatively, since encrypted-state integrity already IS the CSRF control on the live path, delete the now-misleading nonce/oauth_state machinery entirely (login:97,132 + callback:41,54,85,166) and document that decision so the dead nonce doesn't imply a check that isn't there.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY (must pass before committing):
  npm run typecheck
  npm run test
  npx eslint <each file you changed>

COMMIT (only after the checks pass):
  git add <only the files you changed>      # NOT docs/, NOT lockfiles you didn't mean to
  git commit -m "fix(security): M1 — OAuth callback never validates the state nonce — CSRF defens"
Then report: the diff summary + the command output. Do NOT push.
```

---

### M5 — User IP sent to third-party geolocation provider over plaintext HTTP
`severity: medium` · `effort: small` · `files: app/app/api/book/_lib/location.ts:88-93`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app
(Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

BRANCH: Work on "audit/prod-readiness-2026-06-14". First run:
  git rev-parse --abbrev-ref HEAD
If it is not "audit/prod-readiness-2026-06-14" and not a "fix/M5" worktree branched off it, run:
  git checkout audit/prod-readiness-2026-06-14
Do NOT create unrelated branches and do NOT switch away mid-task.

FILES: app/app/api/book/_lib/location.ts:88-93

PROBLEM:
fetchLocationByIp calls `http://ip-api.com/json/<ip>?fields=...` over cleartext HTTP (line 90-91). The end user's real IP is in the URL and the resolved country/region/city/coords come back unencrypted, observable by any intermediary between the Lambda and ip-api.com. The privacy policy discloses the IP may be sent to ip-api.com (page.tsx:44,89) but the Security section (page.tsx:133) claims 'encrypted connections (HTTPS)' — the plaintext call is in tension with that. This path runs only when the user opted into analytics (verified: resolveLocation is invoked behind analyticsParticipation gates in reading-sessions:98 and profile:470), narrowing blast radius.

WHY IT MATTERS:
PII (client IP) and derived approximate location transmitted in cleartext to a third party, contrary to the HTTPS security claim. Network observers or a hostile resolver/MITM can read or tamper with the geolocation lookups.

REQUIRED FIX:
Prefer the CDN edge headers (inferLocationFromHeaders already runs first inside resolveLocation, for free over the existing TLS) and treat the ip-api fallback as best-effort. When the fallback is used, switch to ip-api.com's HTTPS pro endpoint with a key (https://pro.ip-api.com/json/...?key=...) or a provider whose free tier supports HTTPS (ipinfo.io, ipwho.is). Either way the outbound geolocation call must be HTTPS, and the privacy policy's HTTPS claim should be made literally true.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY (must pass before committing):
  npm run typecheck
  npm run test
  npx eslint <each file you changed>

COMMIT (only after the checks pass):
  git add <only the files you changed>      # NOT docs/, NOT lockfiles you didn't mean to
  git commit -m "fix(security): M5 — User IP sent to third-party geolocation provider over plaint"
Then report: the diff summary + the command output. Do NOT push.
```

---

### M11 — Referral fraud same-device / same-IP checks are dead — inviter device/IP always passed as null
`severity: medium` · `effort: medium` · `files: app/app/api/book/_lib/ensure-book-started.ts:296-311, app/app/api/book/_lib/referral-fraud.ts:54-76, app/app/api/book/_lib/referral-fraud-core.ts:54-65`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app
(Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

BRANCH: Work on "audit/prod-readiness-2026-06-14". First run:
  git rev-parse --abbrev-ref HEAD
If it is not "audit/prod-readiness-2026-06-14" and not a "fix/M11" worktree branched off it, run:
  git checkout audit/prod-readiness-2026-06-14
Do NOT create unrelated branches and do NOT switch away mid-task.

FILES: app/app/api/book/_lib/ensure-book-started.ts:296-311, app/app/api/book/_lib/referral-fraud.ts:54-76, app/app/api/book/_lib/referral-fraud-core.ts:54-65

PROBLEM:
evaluateReferralFraud's sameDevice (core:54-57) and sameIp (core:63-64) signals are computed as Boolean(invitee && inviter && equal) (referral-fraud.ts:54-56,76). The sole caller (ensure-book-started.ts:302-304) hardcodes inviterDeviceId:null, inviteeIp:null, inviterIp:null and supplies only inviteeDeviceId. So sameDevice and sameIp can NEVER be true. The inviter's device/IP ARE stored as risk events (recordRiskSignals, queryable by fingerprint) but never looked up here. The only live signals are deviceVelocityCount (>=3 distinct users on the invitee device in 30d), disposable-email, and cross-referral.

WHY IT MATTERS:
The most common referral abuse — a second account on the same device/network to self-refer — is not caught until a THIRD account appears on that device (DEVICE_VELOCITY_THRESHOLD=3). A two-account farm on one phone/IP passes screening and drains the IP economy (IP buys Pro). Fraud prevention is materially weaker than the spec/UI implies; partly mitigated by deviceVelocity but the 2nd account slips through.

REQUIRED FIX:
In ensure-book-started.ts before checkReferralFraud, look up the inviter's most recent recorded device/IP (via the risk-events store keyed by inviter userId, or persist deviceId/ipHash on the referral profile) and pass real inviterDeviceId / inviteeIp / inviterIp. Alternatively lower DEVICE_VELOCITY_THRESHOLD to 2 or add an explicit invitee-IP-equals-inviter-IP block. Add a test that a same-device second account is blocked at the 2nd activation.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY (must pass before committing):
  npm run typecheck
  npm run test
  npx eslint <each file you changed>

COMMIT (only after the checks pass):
  git add <only the files you changed>      # NOT docs/, NOT lockfiles you didn't mean to
  git commit -m "fix(security): M11 — Referral fraud same-device / same-IP checks are dead — invit"
Then report: the diff summary + the command output. Do NOT push.
```

---

### M23 — Secrets in 5 Lambdas sharing one over-broad role
`severity: medium` · `effort: medium` · `files: infra/lib/chapterflow-frontend-stack.ts:358-377, infra/lib/chapterflow-frontend-stack.ts:383-486, infra/lib/chapterflow-frontend-stack.ts:158-352`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app
(Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

BRANCH: Work on "audit/prod-readiness-2026-06-14". First run:
  git rev-parse --abbrev-ref HEAD
If it is not "audit/prod-readiness-2026-06-14" and not a "fix/M23" worktree branched off it, run:
  git checkout audit/prod-readiness-2026-06-14
Do NOT create unrelated branches and do NOT switch away mid-task.

FILES: infra/lib/chapterflow-frontend-stack.ts:358-377, infra/lib/chapterflow-frontend-stack.ts:383-486, infra/lib/chapterflow-frontend-stack.ts:158-352

PROBLEM:
commonEnv (358-377) merges props.serverEnv, which carries all secrets injected in bin/app.ts:97-157 (Stripe secret/webhook/price keys, Anthropic + ElevenLabs API keys, AUTH_STATE_SECRET, full Cognito config). This same commonEnv object is passed as the environment to ServerFn (393), ImageFn (419 via spread), RevalidationFn (442), DynamoProviderFn (464), and WarmerFn (483 via spread). All five also share the single lambdaRole (role: lambdaRole on each), which grants Cognito AdminDeleteUser+ListUsers (327-337), dynamodb:Scan on both app+analytics tables (183-200), and ses:SendEmail (314-320).

WHY IT MATTERS:
Secret blast radius is multiplied across 5 functions: a leak/compromise of any of the 4 auxiliary functions (image optimizer, revalidation, dynamo provider, warmer) exposes Stripe + AI keys + auth secrets and confers the ability to AdminDeleteUser Cognito users, Scan/mutate both tables, and send SES email — none of which those aux functions need. Least-privilege is violated for the auxiliary functions.

REQUIRED FIX:
Split env: a secrets-free baseInfraEnv (cache/queue/table-name vars only) for ImageFn/RevalidationFn/DynamoProviderFn/WarmerFn, and the secret-bearing commonEnv only for ServerFn. Give each aux function its own minimal role (Image: assets bucket only; Revalidation: cache table + queue; DynamoProvider: cache table; Warmer: lambda:InvokeFunction on ServerFn only). Keep the broad role (Scan/Cognito/SES) on ServerFn alone, ideally splitting admin Scan/Cognito-delete paths into a dedicated function later (the code comment at 168-175 already acknowledges this).

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY (must pass before committing):
  npm run typecheck
  npm run test
  npx eslint <each file you changed>

COMMIT (only after the checks pass):
  git add <only the files you changed>      # NOT docs/, NOT lockfiles you didn't mean to
  git commit -m "fix(security): M23 — Secrets in 5 Lambdas sharing one over-broad role"
Then report: the diff summary + the command output. Do NOT push.
```

---

### M42 — CSV export is vulnerable to formula (CSV) injection on user-controlled fields
`severity: medium` · `effort: trivial` · `files: app/book/admin/_components/csv.ts:27-34, app/book/admin/_clients/UsersClient.tsx:170-175, app/book/admin/_clients/GeographyClient.tsx:110-115, app/book/admin/_clients/SegmentBuilderClient.tsx:329-334`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app
(Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

BRANCH: Work on "audit/prod-readiness-2026-06-14". First run:
  git rev-parse --abbrev-ref HEAD
If it is not "audit/prod-readiness-2026-06-14" and not a "fix/M42" worktree branched off it, run:
  git checkout audit/prod-readiness-2026-06-14
Do NOT create unrelated branches and do NOT switch away mid-task.

FILES: app/book/admin/_components/csv.ts:27-34, app/book/admin/_clients/UsersClient.tsx:170-175, app/book/admin/_clients/GeographyClient.tsx:110-115, app/book/admin/_clients/SegmentBuilderClient.tsx:329-334

PROBLEM:
downloadCSV's escape() (csv.ts:27-34) only wraps a value in quotes when it contains a comma/quote/newline; it does NOT neutralize spreadsheet formula triggers (= + - @ or leading tab/CR). The exporter handles user-influenced text — most importantly the email field (Users CSV via UsersClient.tsx:170-175, Segment-preview CSV via SegmentBuilderClient.tsx:329-334) and city/country (Geography CSV). When an admin opens such a file in Excel/Sheets, a cell beginning with a formula char executes. This is a legitimate defense-in-depth gap in a shared admin exporter.

WHY IT MATTERS:
If an exported text field begins with a formula trigger, formulas/links can execute in an admin's spreadsheet app on open, risking data/credential exfiltration or local code execution against staff. Exploitability is LOWER than the original write-up implies: email is verified by the Cognito IdP (most providers reject addresses starting with = + - @), and Geography city/country are NOT free-text — country comes from CloudFront/Vercel viewer-country headers (2-letter codes) and city from a server-side geo-IP lookup (ip-api.com), so neither is a directly attacker-typed value. The realistic worst case is a crafted display/email value or a future user-controlled export column.

REQUIRED FIX:
In csv.ts escape(), after computing `str`, neutralize leading formula triggers BEFORE the comma/quote/newline quoting, for every cell (data and headers): `if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;` then apply the existing quote-escaping. This is the standard OWASP CSV-injection mitigation and is trivial and centralized.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY (must pass before committing):
  npm run typecheck
  npm run test
  npx eslint <each file you changed>

COMMIT (only after the checks pass):
  git add <only the files you changed>      # NOT docs/, NOT lockfiles you didn't mean to
  git commit -m "fix(security): M42 — CSV export is vulnerable to formula (CSV) injection on user-"
Then report: the diff summary + the command output. Do NOT push.
```

---

### L3 — /auth/refresh has no rate limiting or abuse control on a token-minting endpoint
`severity: low` · `effort: small` · `files: app/auth/refresh/route.ts:47, app/auth/callback/route.ts:107`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app
(Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

BRANCH: Work on "audit/prod-readiness-2026-06-14". First run:
  git rev-parse --abbrev-ref HEAD
If it is not "audit/prod-readiness-2026-06-14" and not a "fix/L3" worktree branched off it, run:
  git checkout audit/prod-readiness-2026-06-14
Do NOT create unrelated branches and do NOT switch away mid-task.

FILES: app/auth/refresh/route.ts:47, app/auth/callback/route.ts:107

PROBLEM:
grep -ri 'rate.?limit|throttle' across app/auth returns nothing (confirmed, exit 1). /auth/refresh POSTs the httpOnly refresh_token to Cognito's token endpoint on every call with no app-level limiter. Because the auth cookies are SameSite=lax, a cross-site fetch can't drive this, but a misbehaving/looping first-party client can hammer Cognito's token endpoint and burn quota/cost. The book API has a sophisticated abuse module (app/app/api/book/_lib/abuse.ts) but it is DynamoDB-velocity-based for free-unlock fraud, not a generic per-IP request limiter, so there is no off-the-shelf throttle to drop in here.

WHY IT MATTERS:
Low: Cognito enforces its own throttling and the refresh_token is httpOnly (no JS exfiltration). But the app exposes a cookie-only amplification path to Cognito with zero local guard.

REQUIRED FIX:
Add a lightweight per-device-id / per-IP limiter around POST /auth/refresh (a few attempts per minute → 429). getOrCreateDeviceId(req) from abuse.ts gives a stable device key; readIp logic there can be reused. Note the original fix's claim that abuse.ts is 'already imported in callback' is only half-right — callback imports getOrCreateDeviceId/applyDeviceIdCookie, not a rate limiter, and refresh imports neither; a new minimal limiter (even in-memory per-instance) is the realistic change. TokenExpiryGuard already self-throttles (RETRY_COOLDOWN 30s, TokenExpiryGuard:11), so a generous cap won't hit legit clients.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY (must pass before committing):
  npm run typecheck
  npm run test
  npx eslint <each file you changed>

COMMIT (only after the checks pass):
  git add <only the files you changed>      # NOT docs/, NOT lockfiles you didn't mean to
  git commit -m "fix(security): L3 — /auth/refresh has no rate limiting or abuse control on a tok"
Then report: the diff summary + the command output. Do NOT push.
```

---

### L9 — logout() relies on Cognito to reject an attacker-supplied returnTo; redundant cookieStore.delete() calls are no-ops for domain-scoped cookies
`severity: low` · `effort: trivial` · `files: app/auth/logout/route.ts:18, app/auth/logout/route.ts:22, app/auth/logout/route.ts:34`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app
(Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

BRANCH: Work on "audit/prod-readiness-2026-06-14". First run:
  git rev-parse --abbrev-ref HEAD
If it is not "audit/prod-readiness-2026-06-14" and not a "fix/L9" worktree branched off it, run:
  git checkout audit/prod-readiness-2026-06-14
Do NOT create unrelated branches and do NOT switch away mid-task.

FILES: app/auth/logout/route.ts:18, app/auth/logout/route.ts:22, app/auth/logout/route.ts:34

PROBLEM:
Two sub-claims. (1) Open-redirect: logout builds logout_uri = sanitizeReturnTo(returnTo, logoutRedirect) (logout:22-31). sanitizeReturnTo only allows absolute URLs whose origin is in allowedOrigins(), else falls back to logoutRedirect (an absolute external URL) — so an off-allowlist returnTo is already neutralized server-side BEFORE Cognito ever sees it. The finding's framing that protection 'relies on Cognito' is thus overstated: the app's own sanitizeReturnTo is the primary gate and Cognito's sign-out-URL allowlist is defense-in-depth. NOT exploitable today — refuting the 'relies on Cognito' premise but the residual defense-in-depth point holds. (2) Cookie deletes: cookieStore.delete() (logout:18-21) does NOT carry the cookie domain attribute. When AUTH_COOKIE_DOMAIN is configured in prod (auth-cookie.ts:17-21,25; wired conditionally in infra/bin/app.ts:127-128), the auth cookies are set with Domain=.<host>, and a browser will NOT clear a domain-scoped cookie via a Set-Cookie that omits Domain — so those delete() calls are no-ops in that config. The res.cookies.set('', maxAge:0) calls (logout:34-37) DO include the domain via getAuthCookieBase(), so they are what actually clears the cookies. Confirmed redundancy.

WHY IT MATTERS:
No exploitable open redirect (double-gated, app-side sanitize is primary). The four cookieStore.delete() calls are dead/ineffective whenever a cookie domain is configured and could mislead a reader into thinking deletion happens there.

REQUIRED FIX:
Remove the four cookieStore.delete() calls (logout:18-21); the res.cookies.set(maxAge:0) lines (logout:34-37) already clear with the correct domain. Optionally tighten logout returnTo to internal paths only (isSafeInternalPath) since legitimate post-logout targets are app pages — but note logoutRedirect itself is an absolute external URL fallback, so a pure-internal constraint would need the fallback handled separately. Keep the sanitizeReturnTo gate.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY (must pass before committing):
  npm run typecheck
  npm run test
  npx eslint <each file you changed>

COMMIT (only after the checks pass):
  git add <only the files you changed>      # NOT docs/, NOT lockfiles you didn't mean to
  git commit -m "fix(security): L9 — logout() relies on Cognito to reject an attacker-supplied re"
Then report: the diff summary + the command output. Do NOT push.
```

---

### L17 — Trial-ending email interpolates Stripe customer name into HTML without escaping
`severity: low` · `effort: trivial` · `files: app/app/api/book/_lib/trial-ending-email.ts:65, app/app/api/book/_lib/trial-ending-email.ts:98`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app
(Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

BRANCH: Work on "audit/prod-readiness-2026-06-14". First run:
  git rev-parse --abbrev-ref HEAD
If it is not "audit/prod-readiness-2026-06-14" and not a "fix/L17" worktree branched off it, run:
  git checkout audit/prod-readiness-2026-06-14
Do NOT create unrelated branches and do NOT switch away mid-task.

FILES: app/app/api/book/_lib/trial-ending-email.ts:65, app/app/api/book/_lib/trial-ending-email.ts:98

PROBLEM:
sendTrialEndingEmail builds the HTML body with `<p>Hi ${name},</p>` (line 98) where name = customer.name from Stripe (line 65, `customer.name?.trim() || 'there'`), inserted raw with no HTML escaping. By contrast email-compliance-core.ts:99 has an escapeHtml helper used in the footer. The customer name originates from user checkout data, so markup in the name renders verbatim in the email HTML. Blast radius limited (the email goes only to that same user's own address and mail clients sanitize), so this is hardening not an active exploit.

WHY IT MATTERS:
Stored content from one field (customer name) reflected unescaped into outbound HTML email to that same user; could break layout or render unintended markup in their own inbox. Not cross-user.

REQUIRED FIX:
Escape name before interpolation in the HTML body (line 98). IMPORTANT CORRECTION to the original fix: escapeHtml in email-compliance-core.ts is a LOCAL function and is NOT exported (verified — only signUnsubscribeToken, verifyUnsubscribeToken, emailFooter, etc. are exported). So either add `export` to escapeHtml in email-compliance-core.ts and import it, or define a tiny local escapeHtml in trial-ending-email.ts. The text body (line 86) needs no change.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY (must pass before committing):
  npm run typecheck
  npm run test
  npx eslint <each file you changed>

COMMIT (only after the checks pass):
  git add <only the files you changed>      # NOT docs/, NOT lockfiles you didn't mean to
  git commit -m "fix(security): L17 — Trial-ending email interpolates Stripe customer name into HT"
Then report: the diff summary + the command output. Do NOT push.
```

---

### L18 — requireActiveBookUser fails open — a deleted account stays reachable during a DynamoDB outage
`severity: low` · `effort: medium` · `files: app/app/api/book/_lib/account-guard.ts:53-62, app/app/api/book/_lib/account-guard-policy.ts:15-21`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app
(Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

BRANCH: Work on "audit/prod-readiness-2026-06-14". First run:
  git rev-parse --abbrev-ref HEAD
If it is not "audit/prod-readiness-2026-06-14" and not a "fix/L18" worktree branched off it, run:
  git checkout audit/prod-readiness-2026-06-14
Do NOT create unrelated branches and do NOT switch away mid-task.

FILES: app/app/api/book/_lib/account-guard.ts:53-62, app/app/api/book/_lib/account-guard-policy.ts:15-21

PROBLEM:
On any error reading the account-status record, requireActiveBookUser logs and returns the user as if active (catch block lines 53-62 returns user). The block decision (line 64, decideAccountAccess → 'block' for status 'deleted') is only reached when the read succeeds, so during a DynamoDB outage a soft-DELETED account regains access to mutating routes. This is a documented, deliberate availability tradeoff mirroring requireDashboardAccess, but it means deletion enforcement is not strictly guaranteed.

WHY IT MATTERS:
During a DynamoDB partial outage, deleted/deactivated accounts can transiently access protected routes. Low likelihood, self-limiting (resolves when the store recovers).

REQUIRED FIX:
Acceptable as-is for most routes given the availability rationale. If tightened: fail-CLOSED specifically for the small set of irreversible/destructive routes, or cache the last-known 'deleted' status (short-TTL in-memory map keyed by userId, or a claim) so a read failure can still honor a known-deleted state rather than defaulting to allow. Note BookApiError is re-thrown (line 54), so a real 'block' is never swallowed — only infra failures fail open.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY (must pass before committing):
  npm run typecheck
  npm run test
  npx eslint <each file you changed>

COMMIT (only after the checks pass):
  git add <only the files you changed>      # NOT docs/, NOT lockfiles you didn't mean to
  git commit -m "fix(security): L18 — requireActiveBookUser fails open — a deleted account stays r"
Then report: the diff summary + the command output. Do NOT push.
```

---

### L22 — Per-book metrics endpoint returns aggregate reader counts for any bookId without existence/ownership check
`severity: low` · `effort: small` · `files: app/app/api/book/books/[bookId]/metrics/route.ts:12-63`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app
(Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

BRANCH: Work on "audit/prod-readiness-2026-06-14". First run:
  git rev-parse --abbrev-ref HEAD
If it is not "audit/prod-readiness-2026-06-14" and not a "fix/L22" worktree branched off it, run:
  git checkout audit/prod-readiness-2026-06-14
Do NOT create unrelated branches and do NOT switch away mid-task.

FILES: app/app/api/book/books/[bookId]/metrics/route.ts:12-63

PROBLEM:
GET /books/[bookId]/metrics calls requireActiveBookUser() (line 17) but performs NO check that bookId exists or is published, and returns readersToday/readersWeek/loopsToday/loopsWeek for any bookId string an authenticated user supplies (lines 27-62). This exposes per-title business KPIs (daily/weekly active readers and loop completions) for arbitrary books to any logged-in user. Read-only aggregate, logged-in only, so low blast radius, but it is unintended data exposure.

WHY IT MATTERS:
Any logged-in user (e.g., a competitor with a free account) can enumerate per-title engagement/completion numbers across the whole catalog.

REQUIRED FIX:
Validate bookId is a published catalog book (getCatalogBook) and either restrict this endpoint to admins or only return metrics for books the user has started/owns. At minimum return 404 for unknown bookIds, and decide whether these reader counts should be exposed to non-admins at all.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY (must pass before committing):
  npm run typecheck
  npm run test
  npx eslint <each file you changed>

COMMIT (only after the checks pass):
  git add <only the files you changed>      # NOT docs/, NOT lockfiles you didn't mean to
  git commit -m "fix(security): L22 — Per-book metrics endpoint returns aggregate reader counts fo"
Then report: the diff summary + the command output. Do NOT push.
```

---

### L23 — Ask-book endpoint trusts client-supplied conversation history as assistant turns
`severity: low` · `effort: medium` · `files: app/app/api/book/books/[bookId]/ask/route.ts:31-46, app/app/api/book/books/[bookId]/ask/route.ts:235-250`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app
(Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

BRANCH: Work on "audit/prod-readiness-2026-06-14". First run:
  git rev-parse --abbrev-ref HEAD
If it is not "audit/prod-readiness-2026-06-14" and not a "fix/L23" worktree branched off it, run:
  git checkout audit/prod-readiness-2026-06-14
Do NOT create unrelated branches and do NOT switch away mid-task.

FILES: app/app/api/book/books/[bookId]/ask/route.ts:31-46, app/app/api/book/books/[bookId]/ask/route.ts:235-250

PROBLEM:
The ask route accepts a client-provided history array of {role:'user'|'assistant', content} (lines 31-46) and forwards it verbatim to Claude as prior turns: messages: [...history, {role:'user', content:question}] (line 250). A user can fabricate assistant turns to steer the model and soften the 'only answer about the book' guardrail (prompt injection). The per-day question limit is count-based, so fabricated history is free within the cap. Impact is bounded: history is capped at 20 turns / 2000 chars each, the question at 500 chars, max_tokens 400, and the server system prompt (lines 238-249) is always present and not overridable.

WHY IT MATTERS:
Users can partially bypass the topical guardrail and shape AI output by injecting fake assistant history, and run somewhat larger prompts than intended within the rate limit.

REQUIRED FIX:
Persist conversation history server-side keyed by a session id and reconstruct it from the store instead of trusting the request body; or at minimum treat client 'assistant' turns with suspicion (collapse/relabel them) and cap total history tokens. Keep the existing length caps and the server system prompt.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY (must pass before committing):
  npm run typecheck
  npm run test
  npx eslint <each file you changed>

COMMIT (only after the checks pass):
  git add <only the files you changed>      # NOT docs/, NOT lockfiles you didn't mean to
  git commit -m "fix(security): L23 — Ask-book endpoint trusts client-supplied conversation histor"
Then report: the diff summary + the command output. Do NOT push.
```

---

### L27 — Badges PUT lets a client record any catalog badge with arbitrary earnedAt/tier without earning it (cosmetic only)
`severity: low` · `effort: medium` · `files: app/app/api/book/me/badges/route.ts:32-80, app/app/api/book/_lib/repo.ts:2864-2895, app/app/api/book/_lib/keys.ts (badgeAwardSk)`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app
(Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

BRANCH: Work on "audit/prod-readiness-2026-06-14". First run:
  git rev-parse --abbrev-ref HEAD
If it is not "audit/prod-readiness-2026-06-14" and not a "fix/L27" worktree branched off it, run:
  git checkout audit/prod-readiness-2026-06-14
Do NOT create unrelated branches and do NOT switch away mid-task.

FILES: app/app/api/book/me/badges/route.ts:32-80, app/app/api/book/_lib/repo.ts:2864-2895, app/app/api/book/_lib/keys.ts (badgeAwardSk)

PROBLEM:
PUT /me/badges accepts any badgeId present in BADGE_DEFINITIONS (validated via getBadgeName) plus a client-supplied earnedAt and tier and calls putBadgeAward, which writes a BOOK_USER_BADGE_AWARD with no server-side check that the user met the criteria. The route comment states badges are cosmetic and grant no IP, and putBadgeAward writes zero points — so this is not an economy exploit, but a user can fabricate their own badge wall and backdate earnedAt. badgeAwardSk(badgeId) = `BADGE#${badgeId}` ignores tier, and putBadgeAward uses attribute_not_exists, so for a multi-tier badge only the first PUT persists and tier upgrades silently no-op (created:false).

WHY IT MATTERS:
Low: only the user's own cosmetic display is affected (self-spoofing), no currency leak. The tier-collision means tiered badge upgrades may appear not to 'take'.

REQUIRED FIX:
Make cosmetic badge state server-derived (compute the badge wall from BOOK_USER_ACHIEVEMENT + real stats, mirroring the server-authoritative achievement-repo IP path) and remove the client-writable PUT, or validate the claimed badge against server truth before persisting. If tiered badges must coexist, include tier in badgeAwardSk (e.g. `BADGE#${badgeId}#${tier}`) so upgrades don't collide.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY (must pass before committing):
  npm run typecheck
  npm run test
  npx eslint <each file you changed>

COMMIT (only after the checks pass):
  git add <only the files you changed>      # NOT docs/, NOT lockfiles you didn't mean to
  git commit -m "fix(security): L27 — Badges PUT lets a client record any catalog badge with arbit"
Then report: the diff summary + the command output. Do NOT push.
```

---

### L35 — Push endpoint not validated against allowlist at registration time (defense-in-depth gap)
`severity: low` · `effort: trivial` · `files: app/app/api/book/me/devices/register/route.ts:16-40, app/app/api/book/_lib/push-endpoint-allowlist.ts:22-34, app/app/api/book/_lib/push-service.ts:33-36`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app
(Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

BRANCH: Work on "audit/prod-readiness-2026-06-14". First run:
  git rev-parse --abbrev-ref HEAD
If it is not "audit/prod-readiness-2026-06-14" and not a "fix/L35" worktree branched off it, run:
  git checkout audit/prod-readiness-2026-06-14
Do NOT create unrelated branches and do NOT switch away mid-task.

FILES: app/app/api/book/me/devices/register/route.ts:16-40, app/app/api/book/_lib/push-endpoint-allowlist.ts:22-34, app/app/api/book/_lib/push-service.ts:33-36

PROBLEM:
isAllowedPushEndpoint is enforced at the actual SSRF sink at send time (push-service.ts:33-36 refuses non-allowlisted endpoints), which correctly prevents SSRF. But register/route.ts:16-40 stores any client-supplied endpoint (only requireString length-bounded) without running isAllowedPushEndpoint, so the device table can be polluted with arbitrary URLs that are iterated (and rejected) on every notification fanout.

WHY IT MATTERS:
No SSRF (send-time guard blocks it) — junk endpoints just inflate the per-notification device loop and the device table. Minor cost/abuse surface.

REQUIRED FIX:
Call isAllowedPushEndpoint(endpoint) in register/route.ts and reject non-allowlisted endpoints with a 400 (bookErr) before the PutCommand, so only valid push hosts are ever persisted.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY (must pass before committing):
  npm run typecheck
  npm run test
  npx eslint <each file you changed>

COMMIT (only after the checks pass):
  git add <only the files you changed>      # NOT docs/, NOT lockfiles you didn't mean to
  git commit -m "fix(security): L35 — Push endpoint not validated against allowlist at registratio"
Then report: the diff summary + the command output. Do NOT push.
```

---

### L36 — Pair invite codes use Math.random() rather than a CSPRNG
`severity: low` · `effort: trivial` · `files: app/app/api/book/_lib/pair-repo.ts:8-15`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app
(Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

BRANCH: Work on "audit/prod-readiness-2026-06-14". First run:
  git rev-parse --abbrev-ref HEAD
If it is not "audit/prod-readiness-2026-06-14" and not a "fix/L36" worktree branched off it, run:
  git checkout audit/prod-readiness-2026-06-14
Do NOT create unrelated branches and do NOT switch away mid-task.

FILES: app/app/api/book/_lib/pair-repo.ts:8-15

PROBLEM:
generateInviteCode (pair-repo.ts:8-15) uses Math.floor(Math.random()*chars.length) over a 32-char alphabet for an 8-char code. Math.random is not cryptographically secure / theoretically predictable; the referral-code generator uses a CSPRNG path. 32^8 (~1.1e12) keyspace makes blind enumeration impractical, the payoff of a guessed pair invite is low (becoming a stranger's reading partner), and there is no accept rate-limit. Note the createPairInvite loop retries up to 3x on collision (attribute_not_exists(PK)), so a weak PRNG also marginally raises collision retries.

WHY IT MATTERS:
Very low: predictable PRNG plus no accept rate-limit is a theoretical enumeration/guess vector, but the reward is negligible and the keyspace is large. Compounded by the fact (finding #1) that no user can even generate an invite today.

REQUIRED FIX:
Switch generateInviteCode to draw bytes from crypto (e.g. crypto.randomBytes or a crypto.randomUUID-derived alphabet mapping) like the referral generator, removing the predictable-PRNG class of issue and improving collision resistance.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY (must pass before committing):
  npm run typecheck
  npm run test
  npx eslint <each file you changed>

COMMIT (only after the checks pass):
  git add <only the files you changed>      # NOT docs/, NOT lockfiles you didn't mean to
  git commit -m "fix(security): L36 — Pair invite codes use Math.random() rather than a CSPRNG"
Then report: the diff summary + the command output. Do NOT push.
```

---

### L40 — concept-graph route has no route-level auth/active-account guard while paid chapter content is gated
`severity: low` · `effort: trivial` · `files: app/app/api/book/books/[bookId]/concept-graph/route.ts:12-44, app/app/api/book/books/[bookId]/chapters/[chapterNumber]/route.ts:22, middleware.ts:38-87`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app
(Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

BRANCH: Work on "audit/prod-readiness-2026-06-14". First run:
  git rev-parse --abbrev-ref HEAD
If it is not "audit/prod-readiness-2026-06-14" and not a "fix/L40" worktree branched off it, run:
  git checkout audit/prod-readiness-2026-06-14
Do NOT create unrelated branches and do NOT switch away mid-task.

FILES: app/app/api/book/books/[bookId]/concept-graph/route.ts:12-44, app/app/api/book/books/[bookId]/chapters/[chapterNumber]/route.ts:22, middleware.ts:38-87

PROBLEM:
GET /books/[bookId]/concept-graph resolves the published version and returns the full S3 concept-graph JSON with NO requireUser/requireActiveBookUser call, unlike the sibling chapter route which calls requireActiveBookUser (chapters/[chapterNumber]/route.ts:22). HOWEVER, the original claim that it is 'readable by any unauthenticated caller' is overstated: middleware.ts matches /app/:path* (config matcher line 93), which includes this API path (/app/api/book/...), and rejects requests lacking a present, non-expired id_token cookie (redirecting to /auth/login). So a fully logged-out caller cannot reach it. The real, narrower gap: this route skips the route-level JWT signature verification and the active-account (soft-delete) gating that requireActiveBookUser enforces everywhere else — middleware only does a lightweight cookie-presence/expiry check (line 65-66 comment says full JWT verification happens at the route level). A soft-deleted user (cookie still valid) and any path that doesn't traverse the middleware (defense-in-depth) are exposed.

WHY IT MATTERS:
Not an open unauthenticated leak. The defect is an authz inconsistency: derived paid content (chapter concepts + relationships) served without the route-level account guard every other content route uses, so soft-deleted/inactive accounts and any non-middleware access path are not gated. Defense-in-depth gap rather than a critical hole.

REQUIRED FIX:
Add `await requireActiveBookUser()` at the top of the GET handler (mirroring chapters/[chapterNumber]/route.ts) so the concept graph follows the same JWT-verify + active-account model as sibling content routes. If concept graphs are intentionally public/teaser content, document that decision and confirm the JSON contains nothing premium — but the safe default is to gate it like the chapter route.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY (must pass before committing):
  npm run typecheck
  npm run test
  npx eslint <each file you changed>

COMMIT (only after the checks pass):
  git add <only the files you changed>      # NOT docs/, NOT lockfiles you didn't mean to
  git commit -m "fix(security): L40 — concept-graph route has no route-level auth/active-account g"
Then report: the diff summary + the command output. Do NOT push.
```

---

### L42 — Audio route logs user display name and userId to application logs (PII) plus heavy per-request console noise
`severity: low` · `effort: small` · `files: app/app/api/book/books/[bookId]/chapters/[chapterNumber]/audio/route.ts:389, app/app/api/book/books/[bookId]/chapters/[chapterNumber]/audio/route.ts:347-383, app/app/api/book/_lib/audio-narration.ts:60-62`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app
(Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

BRANCH: Work on "audit/prod-readiness-2026-06-14". First run:
  git rev-parse --abbrev-ref HEAD
If it is not "audit/prod-readiness-2026-06-14" and not a "fix/L42" worktree branched off it, run:
  git checkout audit/prod-readiness-2026-06-14
Do NOT create unrelated branches and do NOT switch away mid-task.

FILES: app/app/api/book/books/[bookId]/chapters/[chapterNumber]/audio/route.ts:389, app/app/api/book/books/[bookId]/chapters/[chapterNumber]/audio/route.ts:347-383, app/app/api/book/_lib/audio-narration.ts:60-62

PROBLEM:
The audio handler logs the user's display name in `Generating greeting clip for "${userName}"` (line 389), and the greeting S3 keys it logs (lines 379/412) embed user.sub via userGreetingS3Key (audio-narration.ts:60-62 → `.../names/${userId}-${timeOfDay}.mp3`). It also emits ~10+ console.log lines per request (plan summary at 347-349, per-segment loaded/missing/skipped at 373-383/454, stitch stats at 465-467, takeaway count at 145). The ask route similarly console.warn/console.error with raw errors. This writes a user's name + stable Cognito subject into CloudWatch and is operational noise at scale.

WHY IT MATTERS:
User name + Cognito sub in logs is low-grade PII exposure that complicates erasure/privacy guarantees; the volume of per-request logging is operational noise and a minor cost at scale.

REQUIRED FIX:
Remove userName from log strings (log at most a truncated hash of user.sub) and gate the per-request [audio]/[ask-book] console.log lines behind a debug flag (e.g. an env-checked logger), keeping only genuine error logs. Note the stitched-cache S3 key (line 470) also embeds user.sub and is logged at 480 — same treatment.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY (must pass before committing):
  npm run typecheck
  npm run test
  npx eslint <each file you changed>

COMMIT (only after the checks pass):
  git add <only the files you changed>      # NOT docs/, NOT lockfiles you didn't mean to
  git commit -m "fix(security): L42 — Audio route logs user display name and userId to application"
Then report: the diff summary + the command output. Do NOT push.
```

---

### L43 — Ask endpoint accepts client-supplied conversation history as assistant turns (prompt-injection / jailbreak surface)
`severity: low` · `effort: medium` · `files: app/app/api/book/books/[bookId]/ask/route.ts:31-46, app/app/api/book/books/[bookId]/ask/route.ts:250`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app
(Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

BRANCH: Work on "audit/prod-readiness-2026-06-14". First run:
  git rev-parse --abbrev-ref HEAD
If it is not "audit/prod-readiness-2026-06-14" and not a "fix/L43" worktree branched off it, run:
  git checkout audit/prod-readiness-2026-06-14
Do NOT create unrelated branches and do NOT switch away mid-task.

FILES: app/app/api/book/books/[bookId]/ask/route.ts:31-46, app/app/api/book/books/[bookId]/ask/route.ts:250

PROBLEM:
body.history is accepted and passed into the Claude messages array as `messages: [...history, {role:'user', content:question}]` (line 250). The filter (31-46) only checks role ∈ {user,assistant}, slices to the last 20 turns, and truncates each to 2000 chars — it does not verify the assistant turns were actually produced by the model. A client can fabricate assistant turns (e.g. an assistant message that 'agrees' to ignore restrictions) to try to steer Raymond off-topic / past the 'only answer book questions' guard. The 20 turns x 2000 chars also bounds token cost only loosely.

WHY IT MATTERS:
Limited blast radius: the Anthropic `system` parameter (lines 238-249) is structurally privileged and always applied, the model is Haiku answering book questions, and content is server-loaded. Worst case is reputational (off-brand answers), not data loss. Token cost is loosely bounded.

REQUIRED FIX:
Treat client history as untrusted: persist real conversation turns server-side and reconstruct from storage, OR (cheaper) keep the strong system prompt (already a separate privileged param), add an explicit instruction that prior assistant turns are not authoritative and the topic restriction is absolute, and tighten the per-turn char cap + total-history token budget. Note the cache path already only caches standalone (no-history) questions, which is correct.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY (must pass before committing):
  npm run typecheck
  npm run test
  npx eslint <each file you changed>

COMMIT (only after the checks pass):
  git add <only the files you changed>      # NOT docs/, NOT lockfiles you didn't mean to
  git commit -m "fix(security): L43 — Ask endpoint accepts client-supplied conversation history as"
Then report: the diff summary + the command output. Do NOT push.
```

---

### L50 — Unhandled-error logger emits full stack traces to console (potential sensitive-data logging) and there is no error monitor
`severity: low` · `effort: small` · `files: app/app/api/book/_lib/http.ts:57-61`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app
(Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

BRANCH: Work on "audit/prod-readiness-2026-06-14". First run:
  git rev-parse --abbrev-ref HEAD
If it is not "audit/prod-readiness-2026-06-14" and not a "fix/L50" worktree branched off it, run:
  git checkout audit/prod-readiness-2026-06-14
Do NOT create unrelated branches and do NOT switch away mid-task.

FILES: app/app/api/book/_lib/http.ts:57-61

PROBLEM:
withBookApiErrors logs book_api_unhandled_error with error.message + full error.stack on every unexpected error; the client envelope is correctly generic ('An unexpected server error occurred.'). Confirmed there is no Sentry/Datadog/error-monitoring sink anywhere in app/ (grep clean of error monitors). The PII-leakage angle is speculative: AWS SDK error messages/stacks generally don't embed full item payloads, and CloudWatch logs are access-controlled.

WHY IT MATTERS:
Verbose stack logging could surface identifiers in CloudWatch (low likelihood); the more concrete gap is no real error-monitoring, so prod failures rely on raw log scraping.

REQUIRED FIX:
Keep the generic client response. In prod, log error.name + short message + a correlation id rather than the raw stack, and wire an actual error monitor. requestId is currently computed inside bookErr (from x-amzn-trace-id), not in the catch — compute it once in withBookApiErrors and thread it into both the log line and bookErr for correlation.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY (must pass before committing):
  npm run typecheck
  npm run test
  npx eslint <each file you changed>

COMMIT (only after the checks pass):
  git add <only the files you changed>      # NOT docs/, NOT lockfiles you didn't mean to
  git commit -m "fix(security): L50 — Unhandled-error logger emits full stack traces to console (p"
Then report: the diff summary + the command output. Do NOT push.
```

---

### L87 — @anthropic-ai/sdk pinned to a range that includes a moderate CVE (insecure default file permissions) — but fix is a SemVer-major bump, not 'non-breaking-ish'
`severity: low` · `effort: small` · `files: package.json:21, app/app/api/book/_lib/ai-config.ts:76-80`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app
(Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

BRANCH: Work on "audit/prod-readiness-2026-06-14". First run:
  git rev-parse --abbrev-ref HEAD
If it is not "audit/prod-readiness-2026-06-14" and not a "fix/L87" worktree branched off it, run:
  git checkout audit/prod-readiness-2026-06-14
Do NOT create unrelated branches and do NOT switch away mid-task.

FILES: package.json:21, app/app/api/book/_lib/ai-config.ts:76-80

PROBLEM:
Verified: package.json:21 pins @anthropic-ai/sdk@^0.88.0. npm audit reports it moderate (GHSA-p7fg-763f-g4gf, insecure default file permissions in the local-filesystem memory tool) with affected range 0.79.0–0.91.0 and fixAvailable 0.104.1. The SDK IS used by the app: ai-config.ts:77 lazily `await import('@anthropic-ai/sdk')` and call sites use client.messages.create (ai-service.ts:57) and client.messages.stream (ai-service.ts:108, ask/route.ts:235). The memory-tool surface is not exercised by these call sites, so direct risk is low.

WHY IT MATTERS:
Low direct exposure (memory tool unused), but keeps a flagged dep in every audit, masking future advisories. Mostly audit-cleanliness.

REQUIRED FIX:
Bump @anthropic-ai/sdk to ^0.104.1 in package.json:21, npm install, then run the unit tests + typecheck. NOTE (correction to original): npm reports fixAvailable.isSemVerMajor=true (0.88→0.104 crosses the 0.x minor-as-major boundary), so this is NOT 'non-breaking-ish' — treat it as a major bump and re-verify the messages.create/messages.stream call sites in ai-service.ts and the ask/feedback/scenario routes compile and stream correctly before merging.

ACCEPTANCE CRITERIA:
- The required fix above is implemented in the cited files (read them first;
  confirm line numbers before editing).
- No regression to adjacent behavior; no unrelated refactors.
- Existing tests still pass.

VERIFY (must pass before committing):
  npm run typecheck
  npm run test
  npx eslint <each file you changed>

COMMIT (only after the checks pass):
  git add <only the files you changed>      # NOT docs/, NOT lockfiles you didn't mean to
  git commit -m "fix(security): L87 — @anthropic-ai/sdk pinned to a range that includes a moderate"
Then report: the diff summary + the command output. Do NOT push.
```
