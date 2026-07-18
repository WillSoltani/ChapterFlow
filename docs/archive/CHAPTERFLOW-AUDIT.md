<!-- Generated 2026-06-03 by a 10-agent audit workflow + independent spot-verification. -->

> **Verification note (Claude, independently confirmed against source):**
> - **C1 is a real, live bug.** All **25** callers of `normalizeNstdPackage` in `app/book/data/bookPackages.ts` pass **v21** packages, whose chapters carry `breakdown.{fastRead,deepRead,fullRead}` and **no** `contentVariants`. `normalizeNstdPackage` reads only `ch.contentVariants` → empty → `exactSummaryBlocks` (`app/book/data/mockChapters.ts:349-352`) yields blank Summary prose. The reader page prefers the **local** package (`chapter/[chapterId]/page.tsx:88-90`, comment: "the reader client always reads from local BOOK_PACKAGES"), so this renders for real users. 39 sibling v21 books correctly use `normalizeAnyPackage`. Affected: the-power-of-habit, thinking-fast-and-slow, the-psychology-of-money, the-laws-of-human-nature, the-black-swan, the-lean-startup, leaders-eat-last, the-checklist-manifesto, the-innovators-dilemma, ultralearning, talk-like-ted, the-charisma-myth, the-like-switch, the-prince, the-almanack-of-naval-ravikant, the-hard-thing-about-hard-things, thinking-in-bets, the-one-thing, the-33-strategies-of-war, the-great-mental-models-vol-1, the-first-20-hours, the-outsiders, the-war-of-art, what-every-body-is-saying, the-art-of-war. Fix: those 25 `normalizeNstdPackage(` → `normalizeAnyPackage(` (verify per-book the reader's Summary renders).
> - **C2 confirmed:** `checkReferralFraud` and the referral-escalation/annual-cap logic have **zero callers**.
> - **H8 confirmed:** `depth-routing.ts` uses lowercase `pk`/`sk`; the table is keyed uppercase `PK`/`SK`.
> - **H9 confirmed:** `me/share-events/route.ts:27-28` calls `requireString(body, "cardType")` — passes the whole body object as the value → 400 on every POST.
> - **`app/app` is a redirect stub, not a "Cloud Portfolio" product** in this tree (`app/app/page.tsx` = `redirect("/dashboard")`). The older memory note is stale here.

# ChapterFlow Web App — Familiarization & Audit

> Canonical orientation + audit doc for the ChapterFlow **Next.js web app** (`app/`, `infra/`). Scope is the product app, **not** the offline v21 authoring pipeline under `scripts/book/`. Synthesized from 10 subsystem audits and spot-verified against source on `main` (2026-06-03).

---

## 1. What ChapterFlow is

ChapterFlow is a consumer guided-reading / learning product: a catalog of ~70 nonfiction books rendered as a multi-phase **reader** (Summary → Examples → Quiz → Practice) with depth tiers (easy/medium/hard), per-chapter quizzes, spaced-repetition review (FSRS-5), an "Ask the Book" AI chat, audio narration, and a gamified engagement economy (**Insight Points**, streaks, tiers, achievements, referrals, gift codes, reading-partner pairing). It is a **standalone Next.js 15 / React 19 App Router** app, deployed via **OpenNext to AWS Lambda behind CloudFront**, authenticated with **AWS Cognito** (Hosted UI, OAuth2 + PKCE), persisted in a **single-table DynamoDB** store plus an analytics table, with book prose in **S3**, monetized via **Stripe** (Free vs Pro) and AI features on **Anthropic Claude** + **ElevenLabs TTS**.

---

## 2. Architecture at a glance

### Request lifecycle

```
Browser
  → CloudFront (app.chapterflow.ca / chapterflow.ca / www)
  → Lambda Function URL (RESPONSE_STREAM, auth NONE) running OpenNext server fn
  → Next.js middleware.ts  — cheap cookie presence+expiry check on id_token for /app,/book,/dashboard
                              (NO signature verify); redirects to /auth/login if missing/expired
  → Route handler (app/app/api/book/**/route.ts)
      → requireUser()  — real gate: jose jwtVerify of the Cognito ID-token JWT vs remote JWKS
      → _lib repo functions (repo.ts + ~20 sibling *-repo.ts)
          → DynamoDB (ddbDoc DocumentClient, aws.ts)  — main table + analytics table
          → S3 (book content / ingest buckets)
          → Stripe SDK / ElevenLabs fetch / Anthropic SDK
      → bookOk/bookErr JSON envelope (http.ts), wrapped by withBookApiErrors
  → Page renders (server component gates via requireDashboardAccess → requireUser, passes primitive props to *Client.tsx)
```

Secrets resolve via `getServerEnv()` (process.env first, then SSM `WithDecryption`, cached). At deploy time all secrets are injected as **plaintext Lambda env vars** from GitHub Secrets; SSM only holds non-secret table/bucket names.

### Single-table data model (main table `ChapterFlowApp`)

- **PK-prefix namespacing, zero GSIs by design.** All per-user state collocates under `PK=BOOKUSER#<userId>`, with `SK` discriminating the entity: `ENTITLEMENT`, `PROFILE`, `SETTINGS`, `ENGAGEMENT`, `PROGRESS#<bookId>`, `BOOKSTATE#`, `CHAPTERSTATE#<bookId>#<NNNN>`, `QUIZSTATE#`, `SAVED#`, `READINGDAY#`, `BADGE#`, `FSRS#CARD#`, `FLOWPOINTS#`, `POINTSGRANT#`, `NOTIF#`, `DEVICE#`, etc. One `Query` on the user PK + `begins_with(SK,prefix)` lists any sub-collection.
- **Books** live under `PK=BOOK#<bookId>` (`SK=META` or `VERSION#<padded6>`); a `PK=BOOKCATALOG` partition holds one `SK=BOOK#<bookId>` row per book for the library list (read on every library load).
- **Quiz attempts** get their own partition `PK=QUIZATTEMPT#<userId>#<bookId>#<NNNN>`, `SK=timestamp`.
- **Global singleton partitions**: `BOOKSCENARIO#PENDING` (moderation queue), `BOOKBILLING#WEBHOOK` (Stripe idempotency), `BOOKLICENSE#KEYS`, `BOOKGIFT#CODES`, `BOOKEVENT#DEFS`.
- **Reverse indexes are materialized as duplicate items, not GSIs** (scenarioLookup, stripeCustomer→user, referralCode, pairInvite, licenseKey index). Every item carries an `entity` discriminator string that full-table Scans filter on.
- **Content is in S3, not DynamoDB**: immutable versioned JSON at `book-content/books/<bookId>/v<padded6>/{manifest,book,chapters/<NNNN>,quizzes/<NNNN>,concept-graph}.json`; DynamoDB stores only `contentPrefix`/`manifestKey` pointers.
- **Analytics table `ChapterFlowInsights`** is the *only* one with GSIs (`GSI1 eventDate→eventType`, `GSI2 plan→updatedAt`); event-sourced SNAPSHOT + append-only EVENT rows, written fire-and-forget.

### The `app/book` vs `app/app/api` vs `app/app` layout (naming clarified)

- **`app/book/*` + `/dashboard`** — the user-facing reader/learning product UI (React pages: settings, profile, progress, saved, notebook, library, reader). The live product home is **`/dashboard`** (`components/workspace`); `app/book/home` redirects there.
- **`app/app/api/*`** — the JSON backend (~105 book routes) plus server helpers under `app/app/api/**/_lib`. This is where all durable state and integrations live.
- **`app/app` is NOT a separate "Cloud Portfolio" product.** `app/app/page.tsx` merely `redirect()`s to `/dashboard`; `app/app/layout.tsx` is a thin shell. The MEMORY/repo note describing `app/app` as "Cloud Portfolio" is **stale** — in this tree `app/app` is effectively *the API namespace plus a redirect stub*. (See Open Questions.)
- **`app/auth/*`** — OAuth route handlers; **app root, `/pricing`, `/signup`, `/legal`** — marketing/legal.

---

## 3. Subsystem map

1. **App shell, routing & auth** — Identity/entry layer. Two-tier auth: `middleware.ts` (cookie presence only) + `requireUser()` (full JWT verify). OAuth via Cognito Hosted UI with PKCE + AES-GCM-encrypted state. Files: `middleware.ts`, `app/app/api/_lib/auth.ts`, `app/auth/callback/route.ts`.
2. **Data model & core repo** — The persistence boundary every route crosses. Single-table key builders + a 2972-line god-repo plus ~20 sibling `*-repo.ts`. Files: `app/app/api/book/_lib/keys.ts`, `app/app/api/book/_lib/repo.ts`, `app/app/api/book/_lib/types.ts`.
3. **Book content, reader & v21 ingestion** — Turns authored v21 packages into the reader experience. Two parallel content paths (local-bundle reader vs S3/DDB ingestion) with two divergent v21 adapters. Files: `app/book/data/bookPackages.ts`, `app/book/lib/v21-adapter.ts`, `app/app/api/book/_lib/validate-book-package.ts`.
4. **Gamification economy (Insight Points)** — Server-authoritative soft currency: earn via quiz loops/streaks/referrals, spend on unlocks/Pro passes/cosmetics. Idempotency via `POINTSGRANT#` items; balance-floor via ConditionExpression. Files: `app/app/api/book/_lib/flow-points-repo.ts`, `app/book/_lib/flow-points-economy.ts`, `app/app/api/book/me/quiz/[bookId]/[chapterNumber]/submit/route.ts`.
5. **Growth & social** — Reading-partner pairing, referrals, gift codes, events/journeys, web-push, OG share cards. Files: `app/app/api/book/_lib/pair-repo.ts`, `app/app/api/book/_lib/ensure-book-started.ts` (the real referral path), `app/app/api/book/me/devices/register/route.ts`.
6. **Billing, entitlements & abuse** — Free/Pro monetization across 4 grant sources (Stripe, license keys, Flow-Points, gift codes); `reserveBookEntitlement` is the atomic paywall choke point. Files: `app/app/api/book/billing/webhook/route.ts`, `app/app/api/book/_lib/repo.ts` (`getUserEntitlement`/`reserveBookEntitlement`), `app/app/api/book/_lib/ensure-book-started.ts`.
7. **Admin dashboards & analytics** — Fire-and-forget analytics writes + ~16 on-demand admin metrics routes (DAU, MRR, retention, geo). Files: `app/app/api/book/_lib/analytics-repo.ts`, `app/app/api/book/_lib/admin-metrics.ts`, `app/book/admin/layout.tsx`.
8. **AI features** — Ask-the-Book RAG (Haiku, SSE), audio narration (ElevenLabs TTS, Pro-gated), AI scenario moderation (Haiku), reflection feedback (Sonnet). Quizzes are graded, never generated, server-side. Files: `app/app/api/book/_lib/ai-service.ts`, `app/app/api/book/books/[bookId]/ask/route.ts`, `app/app/api/book/books/[bookId]/chapters/[chapterNumber]/audio/route.ts`.
9. **Frontend UX, state & data fetching** — Bespoke `useState`/`useEffect` + `fetchBookJson` hooks with manual optimistic updates; a fully-scaffolded **but 0%-adopted** TanStack Query layer. Files: `app/book/_lib/book-api.ts`, `app/book/library/hooks/useBookProgress.ts`, `app/book/providers.tsx`.
10. **Infra, build & ops** — CDK (backend + frontend stacks) + OpenNext on AWS; secrets as plaintext Lambda env. Files: `infra/lib/chapterflow-backend-stack.ts`, `infra/lib/chapterflow-frontend-stack.ts`, `infra/bin/app.ts`.

---

## 4. Top concerns, prioritized

### CRITICAL

**C1 — 25 high-profile v21 books render with empty Summary prose (shipping content corruption).**
*Location:* `app/book/data/bookPackages.ts` (52 `normalizeNstdPackage(` calls; ~25 of them on v21 packages, e.g. lines 495–502 for the-power-of-habit, plus thinking-fast-and-slow, the-psychology-of-money, the-laws-of-human-nature, the-black-swan, the-art-of-war, the-lean-startup, ultralearning, leaders-eat-last, the-checklist-manifesto, the-innovators-dilemma, talk-like-ted, the-charisma-myth, the-like-switch, the-prince, the-almanack-of-naval-ravikant, the-hard-thing-about-hard-things, thinking-in-bets, the-one-thing, the-33-strategies-of-war, the-great-mental-models-vol-1, the-first-20-hours, the-outsiders, the-war-of-art, what-every-body-is-saying).
*What's wrong:* **Verified against source.** These books import `*.v21.json` files whose `schemaVersion` is `chapterflow-v21-authored` and whose chapter content lives in `ch.breakdown.{fastRead,deepRead,fullRead}` — they have **no** `ch.contentVariants`. But they're normalized with `normalizeNstdPackage()`, which at `bookPackages.ts:368-372` reads **only** `ch.contentVariants.{easy,medium,hard}`. Result: `contentVariants` is empty for every chapter, so the reader's Summary phase shows empty prose (and Ask-the-Book context is empty for these books, since that route reads chapter breakdown). Examples/quiz/implementationPlan survive (shared keys), so this fails *silently* — TypeScript is satisfied because the empty output still conforms to `BookPackage`. `normalizeAnyPackage` (line 357) detects v21 and routes to `normalizeV21Package`, which is the correct mapper.
*Fix:* Replace the ~25 `normalizeNstdPackage(` calls on v21 packages with `normalizeAnyPackage(`. There are **no tests** guarding non-empty `contentVariants`.
*Why it matters:* High-profile flagship titles (The Power of Habit, Thinking Fast and Slow, The Psychology of Money) ship with blank summaries — a customer-visible content incident, exactly the "QC gates miss content corruption" failure class in MEMORY. **Confirm whether these books are live in the library catalog** — if so, this is an active incident, not latent.

**C2 — Referral fraud prevention is completely unwired (IP-economy farming).**
*Location:* `app/app/api/book/_lib/referral-fraud.ts` (entire file, zero callers) + the live path `app/app/api/book/_lib/ensure-book-started.ts:281-315`. **Verified:** grep finds no callers of `checkReferralFraud` outside its own file.
*What's wrong:* `checkReferralFraud` (disposable-email, device-fingerprint match, IP match, inviter velocity, cross-referral) is fully implemented but never invoked. The live activation path awards inviter (180 IP) + invitee (80 IP) with the *only* guard being a self-referral check (`inviterUserId === invitedUserId`).
*Why it matters:* An attacker farms referral IP at scale with throwaway accounts on the same device/IP/disposable email; that IP converts (via the shop) into transferable free-Pro grants. Combined with C3, the soft-currency economy has no abuse floor.

### HIGH

**H1 — Referral escalation + annual cap are also dead code (no upper bound on referral IP).**
*Location:* `app/app/api/book/_lib/referral-escalation.ts` (zero callers). Milestone bonuses (300/600/1200/2500 IP) are never paid (product gap) **and** `REFERRAL_ANNUAL_CAP = 25` is never enforced — there is no ceiling on referral earnings anywhere. With C2, removes the last quantitative referral guardrail.

**H2 — Gift-code / Pro-pass grants clobber paying Stripe subscriptions (revenue-adjacent).**
*Location:* `app/app/api/book/me/gifts/[code]/claim/route.ts:84-95` (verified: unconditional `SET proSource = gift_code, currentPeriodEnd = :expires`) + `flow-points-repo.ts:647-670`.
*What's wrong:* The entitlement `UpdateExpression` unconditionally sets `plan=PRO, proSource=gift_code/flow_points, currentPeriodEnd=<shorter value>` with **no** `max(existing, new)` on the period end and **no** `proSource != stripe` guard. The redeem path's `freeOnly` check is a read-then-write across two calls (TOCTOU vs a concurrent webhook). A paying Stripe customer who claims a gift code or applies a Pro pass has their subscription window shortened and `proSource` flipped off `stripe`.

**H3 — Gift-code Pro never expires at the read layer (entitlement leak).**
*Location:* `repo.ts:641-660` (`getUserEntitlement`) + `types.ts:271`.
*What's wrong:* `BookUserEntitlement.proSource` is typed `'stripe'|'license'|'flow_points'` — `'gift_code'` is coerced to `undefined` on read. `grantExpired` has branches only for license and flow_points, **none for gift_code**. So a 7-day gift code yields `plan=PRO` *indefinitely*, and because the coerced `undefined` matches `reserveBookEntitlement`'s `attribute_not_exists(proSource)` PRO-bypass clause, the gift user also gets **unlimited books forever**. (Internal inconsistency: the literal `'gift_code'` *is* present at the reserve ConditionExpression, so the user is FREE for slot limits but PRO for feature flags — reconcile all four sources.) *Fix:* add `'gift_code'` to the union + a `currentPeriodEnd`-keyed `grantExpired` branch.

**H4 — Gift-a-Friend is a repeatable, permanent IP→Pro converter; charge-without-code race.**
*Location:* `app/app/api/book/me/shop/route.ts:103-199`.
*What's wrong:* 800 IP mints a transferable 7-day Pro gift code with **no expiry** on the minted code (unlike bridge passes which compute `passExpiresAt`). Worse, the 800 IP deduction transaction does **not** include the gift-code Put — the code is written in a *separate* PutCommand after the deduct (158-174), so if that write fails the user is charged with no code and no refund. Combined with unbounded referral IP (C2/H1), farmed IP converts into unlimited free Pro weeks.

**H5 — SSRF via unvalidated web-push endpoint.**
*Location:* `app/app/api/book/me/devices/register/route.ts:16-40` + `push-service.ts:24-46`.
*What's wrong:* The register route accepts an arbitrary `endpoint` URL (up to 2000 chars) with **no allowlist** of legitimate push origins (FCM/Mozilla/Apple/WNS) and no scheme/host validation; `createNotification` later issues a server-side POST to it. An authenticated attacker registers an internal/metadata host and the server makes a blind outbound request. *Fix:* allowlist known push origins, reject private/link-local hosts.

**H6 — Cost-control rate limits are non-atomic read-then-write (LLM cost blow-through).**
*Location:* `app/app/api/book/books/[bookId]/ask/route.ts:52-63, 268-285`; same pattern in reflection-feedback; scenario endpoint has **no** per-user rate limit at all.
*What's wrong:* Ask reads the daily count, compares to the cap (5 free / 20 pro), and only increments *after* the stream completes. Concurrent requests all read the same pre-increment count → fire N parallel requests past the cap. And because increment is gated on `streamSuccess`, aborted/errored generations are free and uncounted. *Fix:* atomic conditional `UpdateCommand` (ADD with a limit ConditionExpression) reserved *before* the LLM call.

**H7 — Prompt-injection can bypass scenario auto-moderation (auto-publish + IP award).**
*Location:* `app/app/api/book/books/[bookId]/ask/route.ts:235-247`; `ai-service.ts` (`validateScenario`).
*What's wrong:* User text is concatenated into prompts with no delimiting/escaping. In Ask, up to 20 attacker-controlled history turns (role+content from the request body, never verified against stored history) follow the system prompt → jailbreak the "only answer about the book" guard. In `validateScenario`, crafted submission text can instruct the model to emit `auto_approve`, auto-publishing community content and awarding IP. *Fix:* XML-delimit user content, don't trust client-supplied history, keep a deterministic spam/profanity prefilter and treat the LLM verdict as advisory.

**H8 — Depth-routing feature is dead (casing bug + no caller).**
*Location:* `app/app/api/book/_lib/depth-routing.ts:95,164-166`. **Verified:** the file uses lowercase `pk`/`sk` keys.
*What's wrong:* The book table is keyed `PK`/`SK` uppercase (`infra/lib/chapterflow-backend-stack.ts`), so the lowercase-keyed Get/Put throw `ValidationException` / never match. Compounding: `updateDepthModel` has no caller, so even fixed it's dead — `depth-recommendation` always returns the cold-start fallback. Same casing-bug class flagged in MEMORY.

**H9 — Share-event tracking endpoint is broken — all share analytics silently lost.**
*Location:* `app/app/api/book/me/share-events/route.ts:27-28`. **Verified:** `requireString(value, field, opts)` (http.ts:72) takes the value first, but the route calls `requireString(body, "cardType")` passing the whole `body` object as `value` → `typeof value !== "string"` → 400 on every POST. *Fix:* `requireString(body.cardType, "cardType")` / `requireString(body.destination, "destination")`.

**H10 — Unbounded full-table Scans on the hot main table.**
*Location:* `economy-health.ts:72`, `soft-decay.ts:95`, `admin-metrics.ts:357/433/248` (and segment/retention/funnel/geo/device admin routes).
*What's wrong:* Entity-FilterExpression Scans read the *entire* single table to find a subset; soft-decay and one economy-health scan are fully paginated (no cap). They run synchronously inside on-demand admin request handlers with no caching, scale linearly with total table size, and can throttle the table that also serves the hot read path. The code itself flags "replace with precomputed snapshots." **Determine whether these can be triggered from a live request path during peak traffic.**

**H11 — Analytics ingest endpoints have no rate limit + no TTL.**
*Location:* `app/app/api/book/me/analytics/beacon/route.ts`, `me/reading-sessions/route.ts`.
*What's wrong:* Each authenticated POST writes unbounded append-only EVENT rows with **no** rate limiting (the existing `abuse.ts` primitive used by quiz/ask/nudge is not imported here) and **no** TTL on event rows. A logged-in user can inflate DynamoDB write cost, bloat the table indefinitely, and poison every admin metric (DAU/retention/funnels trust raw event counts).

**H12 — Secrets stored as plaintext Lambda env vars; committed vim swap file.**
*Location:* `.github/workflows/deploy-app.yml:106-129`, `infra/bin/app.ts:58-115`; plus `app/app/api/_lib/.server-env.ts.swp` (16KB, git-tracked, next to the secret-resolution module).
*What's wrong:* All Stripe/Cognito/AI/auth secrets are injected as plaintext Lambda env (readable by anyone with `lambda:GetFunctionConfiguration`, not KMS-encrypted with a CMK). `server-env.ts` already supports SSM SecureString fallback but secrets never land there. The committed `.swp` is accidental cruft (no `*.swp` in `.gitignore`). The OpenNext Lambda role grants `ssm:GetParameter` on `parameter/*` (read-all if secrets migrate to SSM) — `frontend-stack.ts:240-248`. *Fix:* move secrets to SSM SecureString / Secrets Manager, scope the role to `parameter/chapterflow/*`, `git rm --cached` the swap file and gitignore `*.swp`.

**H13 — License-key codes surfaced verbatim in admin live feed.**
*Location:* `analytics-repo.ts:904` (`analyticsTrackLicenseAttempt` writes the upper-cased code as event field `code`) + `admin/events-feed/route.ts` (`stripKeys` SKIP_KEYS excludes `code`).
*What's wrong:* Valid/unredeemed license keys appear in cleartext in the live activity feed and via `getUserEvents`. Secret-bearing values should be hashed/redacted before persistence.

**H14 — The entire TanStack Query layer is dead infrastructure.**
*Location:* `app/book/providers.tsx`, `queries/*`, `QueryBoundary.tsx`, `providers/BookSessionProvider.tsx`. **Verified:** grep finds zero `useQuery`/`useMutation` across `app/book`.
*What's wrong:* `queryKeys`, `bookFetcher`, `QueryBoundary`, `BookSessionProvider` have no importers; `PersistQueryClientProvider` persists an always-empty cache on a 1s throttle; the documented cache tiers are never applied. The bundle ships `@tanstack/react-query` + persist-client for no benefit, and reviewers/MEMORY assume query-cache semantics that don't exist. This is the root cause of the per-component refetch problems below.

**H15 — Public Lambda Function URL + naive ops cost.**
*Location:* `infra/lib/chapterflow-frontend-stack.ts:316-319` (Function URL `auth NONE`, no OAC/WAF/shared-secret on the origin) — anyone who discovers the `*.lambda-url` host bypasses CloudFront caching/security headers and hits the app directly. Related: `admin/metrics/ops` fans out ~18 CloudWatch API calls per load with no caching, and the displayed cost estimate is naive (last-24h × 30, ignores GSI/scan amplification).

### MEDIUM

- **M1 — Unguarded progress read-modify-write (lost updates).** `repo.ts:1929` `updateProgressAfterQuizPass` / `:761` `upsertUserProgress` do a plain `PutCommand` replacing the whole progress item with no ConditionExpression/version. Concurrent quiz-submit, reading-session, and book-state writes for the same user can clobber `completedChapters`/`unlockedThroughChapterNumber`. Even inside the transactional quiz path, the progress Put is unconditional.
- **M2 — Tier / FSRS / pair writes are racy read-modify-writes.** `tier-repo.ts:252-358` SETs counters from a stale read (no ADD/version) → concurrent loop completions lose count and corrupt tier gating; `fsrs-repo.ts:138-196` `recordReview` is last-write-wins; `pair-repo.ts:60-141` `acceptPairInvite` does read-then-three-unconditional-Puts → duplicate active pairs. Use ADD counters / TransactWrite with conditions.
- **M3 — Single-page Queries silently truncate at 1MB.** All `list*` functions (`repo.ts` `listReadingDays`, `listUserChapterStates`, `listBadgeAwards`, `listSavedBooks`, `listBookVersions`, `listLicenseKeys`, …) return only the first page with no `LastEvaluatedKey` handling. `readingDays` grows ~1/day forever — a correctness bug (silent data loss), not just perf.
- **M4 — Non-transactional multi-item writes.** `upsertBookMetaAndCatalog` (2 Puts) and `publishBookVersion` (3 Updates) can leave catalog/meta inconsistent on partial failure; should be a single `TransactWriteCommand` (≤4 items).
- **M5 — Webhook side effects must be idempotent but aren't enforced as such.** `billing/webhook/route.ts`: `recordStripeWebhookEvent` is written last (so Stripe retries re-run the whole handler) and two concurrent deliveries both pass the early `hasStripeWebhookEventBeenProcessed` read. Harmless today (analytics double-counts only) but any future money/points side effect would double-grant. Document the invariant.
- **M6 — No CSRF token / Origin check; reliance solely on `SameSite=lax`.** No state-changing route checks Origin/Referer. `lax` blocks cross-site POST/PUT/DELETE but still sends the cookie on top-level GET navigations — any state-mutating GET would be exposed (none found today). Add an explicit Origin check or `SameSite=strict` as defense-in-depth.
- **M7 — Two divergent v21 adapters.** `app/book/lib/v21-adapter.ts` (client) vs `app/app/api/book/_lib/v21-adapter.ts` (server) disagree on quiz pass default (80 vs 70), bookId casing, tone-keyed wrapping, and dropped fields (memorableLines/keyTakeaway/conceptGraph). Same book can disagree between reader and catalog. Consolidate to one shared mapper.
- **M8 — v21 packages bypass the validator entirely.** `validate-book-package.ts:1186-1188` short-circuits every v21 package to `adaptV21ToV13` with **zero** validation (no key/uniqueness/range/quiz-correctIndex checks). The schema most likely to be corrupt (per project history) has no structural defense. The "defense in depth" comment is false.
- **M9 — `inferChapterNumber` mis-keys reader/progress state.** `useChapterState.ts:172-180` regex-extracts the first number in `chapterId`, defaulting to 1 — for v13 slug IDs this maps state/quiz/progress to the wrong chapter (often ch1) with only a `console.warn`. Plus a localStorage-vs-server-merge race.
- **M10 — Streak count is client-timezone-spoofable.** `streak-repo.ts:209-338` drives `currentStreak`/`lastActiveDate` off `userTimezone` taken raw from the request body (only non-empty validated). A client spoofs timezone across the UTC boundary to advance streaks faster (milestone IP is keyed per-N so it pays once, but streak length is gameable).
- **M11 — Geo IP enrichment leaks client IP over plaintext HTTP to a third party.** `location.ts:81` calls `ip-api.com` over `http://`, sending the end-user IP in cleartext, no DPA/consent documented. Geo is gated only by `saveReadingHistory`, not the analytics-participation flag.
- **M12 — Admin PII reads/exports are unaudited; lat/lng retained indefinitely.** `metrics/revenue`, `users/search`, `user-detail` expose bulk email/plan/geo/lat-lng client-side (CSV-downloadable) with no field minimization and no audit log (only segment bulk-notify writes an audit entry). No TTL on snapshot geo.
- **M13 — Bulk-notify is a serial 5000-item loop in one request.** `segments/[segmentId]/notify` does full dual-table scans + sequential `createNotification` per match → Lambda-timeout and partial-send risk with no resume.
- **M14 — Dev auth bypass leans on `NODE_ENV`.** `auth.ts` `isDevAuthBypassEnabled` requires `NODE_ENV!=='production' && DEV_AUTH_BYPASS===1`; `require-dashboard-access.ts:14-31` *also* bypasses whenever Cognito env vars are merely absent in non-prod. A staging/preview deploy with `NODE_ENV!=='production'` and the flag (or missing Cognito env) is silently semi-public.
- **M15 — Hot single-item partitions.** `BOOKSCENARIO#PENDING`, `BOOKCATALOG`, `BOOKLICENSE#KEYS`, `BOOKBILLING#WEBHOOK` collect all writes under one PK → per-partition throughput limits under spikes (viral scenario submissions, concurrent webhooks); the catalog partition is read on every library load.
- **M16 — No prompt caching on any Anthropic call.** `ask/route.ts` rebuilds and resends up to 30 chapters of context as the system prompt every question; `validateScenario`/`streamReflectionFeedback` have stable system prompts. Adding `cache_control: ephemeral` on the large stable block would cut input-token cost dramatically. (Claude-API best-practice miss.)
- **M17 — Dead-weight `openai` SDK in the app bundle.** `openai ^6.34.0` is a declared app dependency but imported only by the offline pipeline (`scripts/book/`); no `openai` import exists under `app/`. Move it to the pipeline package / devDependencies to cut bundle and supply-chain surface.
- **M18 — Middleware matcher includes `/app/api`.** Unauthenticated API requests get a 307 HTML redirect to `/auth/login` instead of the clean 401 JSON envelope, breaking XHR error handling. Exclude `/app/api` from the matcher.
- **M19 — Two CDK entrypoints / committed `infra/dist` drift.** `infra/bin/infra.ts` is orphaned with a different synthesizer qualifier (`willfresh1`) vs `bin/app.ts` (`hnb659fds`); `infra/dist/` is git-tracked despite the ignore rule and includes a stale `storage-stack.js` + `convert-worker` with no TS source. Delete both.
- **M20 — Domain drift.** README documents `siliconx.ca`; CDK/workflows are hardwired to `chapterflow.ca`; root `CNAME` points at `soltani.org`. Real prod surface is ambiguous (depends on the `CHAPTERFLOW_DOMAIN_NAME` secret).
- **M21 — GSIs written but never queried.** App-table `quiz-scope-createdAt-index` and analytics `contextKey-occurredAt-index` are `ProjectionType.ALL`, doubling write cost for every quiz-attempt item, with zero reads. Confirm intent or drop.
- **M22 — Hourly reminder cron full-table Scans the main table.** `infra/lambda/reading-reminder-cron.ts` scans `ChapterFlowApp` for `BOOK_USER_SETTINGS` every hour; cost scales with *all* single-table data, not user count. Lambda is hand-bundled into committed `dist/` (stale-JS drift risk).

### LOW (selected)

- **L1 — `repo.ts` is a 2972-line god-module** mixing ~12 entity domains; newer clusters were split into siblings, the originals weren't. High merge-conflict surface, duplicated get/list parse boilerplate that can drift.
- **L2 — Dual table-name resolvers.** `aws.ts:24 getTableName → SECURE_DOC_TABLE` (unused) vs `env.ts:5 getBookTableName → BOOK_TABLE_NAME` (the real one). A new function wired to the wrong helper silently targets a different/nonexistent table. Plus dead `aws-sdk` v2 + `@aws-sdk/client-sfn` deps and an unused `SFNClient` (no Step Functions exist).
- **L3 — Raw casts bypass the defensive parse layer.** `repo.ts:2887 listLicenseKeys` casts params `as never` and reads `item.code as string`; `getAccountStatus` reads `item.status as string` — both skip the `readStr`/`readNum` guards used everywhere else.
- **L4 — `getUserEntitlement` masks negative balances.** `parseFlowPointsState`/`economy-health` clamp `Math.max(0, …)` on read, hiding corruption rather than alerting (consistent with the MEMORY "QC misses corruption" note).
- **L5 — `concept-graph` route is unauthenticated** (`books/[bookId]/concept-graph/route.ts`), swallows S3 errors → `null`, no rate limit; uncached expensive S3 read = cheap cost-amplification vector. Also: v21 packages never carry a conceptGraph through the server adapter, so this feature is silently dead for all v21 books.
- **L6 — `ConfirmModal` accessibility gap** (used for destructive flows): no `role="dialog"`, `aria-modal`, Escape, or focus trap, while `EditProfileModal` does it correctly — inconsistent in the same codebase.
- **L7 — Soft-delete account keeps billing/access.** `account/delete` flips a status field + best-effort Stripe cancel in a swallowed try/catch; if cancel fails the user is "deleted" but still billed, with no retry/alert. **Confirm an upstream account-status gate rejects deleted/deactivated tokens** — the audited routes call only `requireUser`, not a status check.
- **L8 — CI gates on build + typecheck only** (no lint, no tests, despite both being defined); lint/test regressions auto-deploy to main.
- **L9 — Dead `BookHomeClient.tsx` (512 lines)** and `app/book/home` are unreachable (redirect to `/dashboard`) yet wire ~15 hooks — bundle/maintenance liability that looks live. Plus duplicated design systems (Button ×2, Card ×2, ProgressRing ×3) and a no-op `lib/analytics.ts track()` whose queue is never drained.
- **L10 — Analytics data-accuracy bugs:** events write `plan` hardcoded to `'FREE'`; `eventId` is never written (always blank in feeds); CloudWatch "P95/P99" is actually the median of hourly P95s (understates tail latency); `coldStarts` hardcoded to 0.

---

## 5. Key conventions to follow

- **Adding a DynamoDB entity:** (1) add a `pk()`/`sk()` builder in `keys.ts` using the `UPPERCASE#token` convention (`padVersion`, 4-digit `padChapterNumber`); (2) add the `Item` type in `types.ts`; (3) add typed get/put/list functions — **prefer a new sibling `*-repo.ts`** (the dominant, healthier pattern) over growing `repo.ts`. Always set the `entity` discriminator string (full-table Scans key off it). **Keys are uppercase `PK`/`SK`** — lowercase keys silently fail (see H8).
- **`tableName` is always a function parameter, never read inside repo functions.** Callers resolve via `env.ts getBookTableName()` (→ `BOOK_TABLE_NAME`). Do **not** use `aws.ts getTableName` (→ `SECURE_DOC_TABLE`, dead/wrong).
- **Never cast `res.Item` to a domain type.** Use the defensive `readNum`/`readStr`/`parseStringArray`/`parseRecord` reducers — DDB items are untrusted `Record<string,unknown>`. (L3 shows the few places that break this rule.)
- **Concurrency:** single-item writes use `ConditionExpression`; multi-item invariants use `TransactWriteCommand`; idempotency uses `attribute_not_exists(PK) AND attribute_not_exists(SK)`; counters use DDB `ADD`. The standard catch is `isConditionalCheckFailed()` / `TransactionCanceledException` re-thrown as `BookApiError` with a stable code. **Don't** introduce unguarded read-modify-write Puts (the live anti-patterns are M1/M2).
- **Currency is integer-only.** Every earn is deduped by a `POINTSGRANT#{sourceType}#{sourceId}` item in the same transaction; every spend uses `points >= :cost` ConditionExpression so a balance can't go negative. New faucets/sinks must follow both.
- **Server is the value trust boundary.** Quizzes are graded server-side; learning mode/threshold is read from stored settings, **not** the request body. Never trust client-supplied `score`, `userId`, or conversation history. Per-user data is scoped by `user.sub` from the verified JWT — never trust a client-supplied userId.
- **Auth:** middleware passage is *not* proof of a valid token. Every new route must call `requireUser()` (or `requireAdminUser()`) inside `withBookApiErrors` — authorization is **per-route, convention-enforced** (no global gate; a forgotten call is silently public). Admin = Cognito group `BOOK_ADMIN_GROUP`.
- **HTTP envelopes:** return via `bookOk`/`bookErr`, wrap handlers in `withBookApiErrors` (maps `AuthError→401`, `BookApiError→status`). Validate input with `http.ts` helpers — note `requireString(value, field)` takes the **value** first (H9 shows the trap).
- **Content serving:** any new quiz/content path must reuse `content-service.sanitizeQuizForClient` (strips `correctAnswerIndex`/explanations) before payloads leave the server, and gate chapter reads on `progress.unlockedThroughChapterNumber`.
- **Adding a book to the reader:** edit four parallel spots in `bookPackages.ts` (import line, `BOOK_PACKAGES`, tone-getter map, presentation map) and **use `normalizeAnyPackage`** (which auto-detects v21), never `normalizeNstdPackage` directly — that bypass is exactly what caused C1. A registry built by mapping over the raw JSON would kill this whole bug class.
- **Frontend fetching:** the *real* client is `fetchBookJson<T>()` (`book-api.ts`, `cache:'no-store'`, `BookClientError`); the TanStack Query layer is dead (H14) — don't assume query-cache semantics. localStorage parsing must use the versioned defensive `parseStored*` pattern in `reader-storage.ts`.
- **Don't change DocumentClient `marshallOptions`** (`removeUndefinedValues:true`, `convertEmptyValues:true`) without auditing every Put — code relies on empty-Set and dropped-undefined behavior.

---

## 6. Open questions for the user

1. **Are the 25 mis-normalized v21 books live in the production library catalog?** (C1) If yes, flagship titles ship with blank summaries — an active content incident. Confirm, then apply the `normalizeNstdPackage → normalizeAnyPackage` fix and add a test asserting non-empty `contentVariants` for v21.
2. **Is `app/app` truly just an API namespace + redirect stub, or is "Cloud Portfolio" a real product on another branch/deploy?** The MEMORY/repo note conflicts with this tree (`app/app/page.tsx` only redirects to `/dashboard`).
3. **Was decoupling `referral-fraud.ts` and `referral-escalation.ts` intentional, or a regression?** (C2/H1) They're complete, documented, zero-caller implementations; the live `ensure-book-started.ts` path was presumably meant to import them. Is there an upstream WAF/library allowlist mitigating the push-endpoint SSRF (H5)?
4. **Is Pro-grant precedence intended to never shorten a paid Stripe subscription, and should gift Pro be time-limited (7d)?** (H2/H3/H4) If yes, the missing `max(currentPeriodEnd)` merge, `proSource != stripe` guards, the `gift_code` union/`grantExpired` branch, and a gift-code expiry are functional bugs. Where are license keys and gift codes generated, and with what entropy (CSPRNG)?
5. **Is there an upstream account-status gate?** (L7) Soft-delete only flips a status field; do deleted/deactivated tokens still hit paid endpoints until Cognito expiry? Is `DEV_AUTH_BYPASS` provably unset and `NODE_ENV==='production'` in every internet-reachable deploy? (M14)
6. **Are the full-table Scan jobs (economy-health, soft-decay, admin-metrics, reminder cron) offline/scheduled, or triggerable synchronously from a live request?** (H10/M22) This sets the throttle/hot-table urgency. What is the expected user / daily-event scale (the design is explicitly "solo-founder scale")? Is there a TTL/retention policy for analytics EVENT rows and snapshot geo (lat/lng)? (H11/M12)
7. **Is the TanStack Query layer being adopted or abandoned?** (H14) If abandoned, remove `providers.tsx`/`queries/*`/`QueryBoundary`/`BookSessionProvider` + the `@tanstack` deps. Is per-component refetch (`useBookViewer` ×17 firing parallel `/me/profile`) an SSR constraint or just the never-finished migration?
8. **Secrets & infra:** Is plaintext-Lambda-env-secrets a deliberate tradeoff or should they move to SSM SecureString (which `server-env.ts` already supports, enabling a `/chapterflow/*`-scoped role)? (H12) **Which domain is actually live** — `chapterflow.ca` (CDK/workflows) or `siliconx.ca` (README)? (M20) Is App Runner fully retired (the role + IAM `PassRole`/`UpdateService` grants are dead)? Are the unused GSIs reserved for planned features or droppable? (M21) Should the `openai` dep be removed from the app package? (M17)

---

**Most urgent to act on first:** C1 (live content corruption, trivial fix), C2+H1+H4 (referral/IP-economy abuse floor), H2+H3 (paid-subscription clobbering / entitlement leak), H5 (SSRF), H6+H7 (LLM cost + moderation bypass), H9 (broken share analytics), then H8/H10/H11/H12.

Relevant files referenced (all absolute): `/Users/radinsoltani/ChapterFlow/app/book/data/bookPackages.ts`, `/Users/radinsoltani/ChapterFlow/app/book/lib/v21-adapter.ts`, `/Users/radinsoltani/ChapterFlow/app/app/api/book/_lib/{repo.ts,keys.ts,types.ts,flow-points-repo.ts,tier-repo.ts,fsrs-repo.ts,pair-repo.ts,referral-fraud.ts,referral-escalation.ts,ensure-book-started.ts,validate-book-package.ts,v21-adapter.ts,depth-routing.ts,ai-service.ts,analytics-repo.ts,admin-metrics.ts,economy-health.ts,soft-decay.ts,location.ts}`, `/Users/radinsoltani/ChapterFlow/app/app/api/book/me/{gifts/[code]/claim/route.ts,shop/route.ts,share-events/route.ts,devices/register/route.ts,analytics/beacon/route.ts}`, `/Users/radinsoltani/ChapterFlow/app/app/api/book/books/[bookId]/{ask/route.ts,concept-graph/route.ts}`, `/Users/radinsoltani/ChapterFlow/app/app/api/book/billing/webhook/route.ts`, `/Users/radinsoltani/ChapterFlow/app/app/api/_lib/{auth.ts,aws.ts,server-env.ts}`, `/Users/radinsoltani/ChapterFlow/app/book/{providers.tsx,_lib/book-api.ts,library/hooks/useBookProgress.ts}`, `/Users/radinsoltani/ChapterFlow/middleware.ts`, `/Users/radinsoltani/ChapterFlow/infra/lib/{chapterflow-backend-stack.ts,chapterflow-frontend-stack.ts}`, `/Users/radinsoltani/ChapterFlow/infra/bin/app.ts`.