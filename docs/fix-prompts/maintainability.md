# Fix prompts — Maintainability

_20 items (3 medium, 8 low, 9 polish). ChapterFlow production-readiness remediation — branch `main` (e90937368)._

## Shared context (every prompt below assumes this)

**App:** ChapterFlow — a Next.js 16 (App Router, React 19) "book learning" web app. **These prompts target the `main` branch** (commit e90937368, the freshly-merged post-UI-overhaul-integration state). Backend = DynamoDB single-table (`app/app/api/book/_lib/repo.ts`) behind Cognito JWT auth (`requireUser`/`requireActiveBookUser`/`requireAdminUser`), Stripe billing, S3 content, CDK infra (`infra/`). API routes live under `app/app/api/book/**` (URL `/app/api/book/**`). Error envelope = `withBookApiErrors`+`BookApiError`.

**Rules for every fix agent:**
1. Work on `main`. Change ONLY the cited files + direct deps. Do NOT touch `scripts/`, `book-packages/`, `content/`, `state/`, `graphify-out/`.
2. Match surrounding code style; reuse existing helpers (auth guards, `BookApiError`, repo functions, `keys.ts`, `lib/catalog-stats.ts`, `lib/pricing.ts`).
3. Never make a security/economy/paywall decision from client-supplied data — the server is the source of truth.
4. When done: run `npm install` (if deps stale), `npm run typecheck`, `npm run test`, and `npx eslint <changed files>`; report results + a short diff summary. Add/adjust a unit test for any security/money/correctness fix.
5. Line numbers were accurate at audit time — re-read each file and confirm before editing (other agents may be editing in parallel).

---

### M29 — Terms, Privacy, and Cookies pages hardcode entity name, support email, and pricing instead of importing the single-source-of-truth modules
`severity: medium` · `effort: small` · `files: app/legal/terms/page.tsx:27, app/legal/terms/page.tsx:56-59, app/legal/terms/page.tsx:132-133, app/legal/terms/page.tsx:148-149, app/legal/privacy/page.tsx:105, app/legal/privacy/page.tsx:178, app/legal/cookies/page.tsx:158, lib/legal-entity.ts:10, lib/pricing.ts:25-40`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/legal/terms/page.tsx:27, app/legal/terms/page.tsx:56-59, app/legal/terms/page.tsx:132-133, app/legal/terms/page.tsx:148-149, app/legal/privacy/page.tsx:105, app/legal/privacy/page.tsx:178, app/legal/cookies/page.tsx:158, lib/legal-entity.ts:10, lib/pricing.ts:25-40

PROBLEM:
legal-entity.ts and pricing.ts are the documented single sources of truth, yet Terms hardcodes 'SiliconX Software Solutions' (terms/page.tsx:27, 132-133, 148-149, 161), the pricing prose '$7.99 CAD per month, $5.99 CAD/month billed annually ($71.88/year), or $59.99 CAD/year' (terms/page.tsx:56-59), and 'support@chapterflow.ca' as raw mailto strings (terms:181,213; privacy:105,124,180; cookies:158). Refund (imports PRICING), Copyright (imports LEGAL_ENTITY_NAME/LEGAL_CONTACT_EMAIL), Contact (imports SUPPORT_EMAIL/LEGAL_ENTITY_NAME/LEGAL_ENTITY_LOCATION), and Data-Rights (imports SUPPORT_EMAIL) DO use the modules, so the codebase is half-migrated. pricing.ts:8-11 even warns that a number change here must be mirrored into terms/page.tsx prose manually — a documented drift trap.

WHY IT MATTERS:
High risk of copy drift: a price change or entity rename updates pricing/refund/checkout surfaces but leaves stale, legally-binding numbers/names in the Terms, producing contradictory published prices (consumer-protection problem for a paid product) and an inconsistent entity name across legal docs.

REQUIRED FIX:
In terms/page.tsx replace 'SiliconX Software Solutions' literals with LEGAL_ENTITY_NAME and the pricing prose with interpolated values: formatAmountWithCurrency(PRICING.monthlyAmount), formatAmount(PRICING.annualMonthlyAmount), formatAmount(ANNUAL_TOTAL_AMOUNT), formatAmount(PRICING.annualUpfrontAmount), PRICING.trialDays, PRICING.freeBookLimit (as refund/page.tsx already does). Replace raw 'support@chapterflow.ca' mailto strings in terms/privacy/cookies with SUPPORT_EMAIL from legal-entity.ts. Then delete the manual-sync warning in pricing.ts:8-11.

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

### M48 — Multiple divergent copy-pasted ProgressRing implementations (more than the audit found)
`severity: medium` · `effort: small` · `files: components/ui/ProgressRing.tsx, components/library/ProgressRing.tsx, app/book/library/[bookId]/components/ProgressRing.tsx, app/book/badges/components/ProgressRing.tsx, app/book/library/[bookId]/chapter/[chapterId]/components/QuizPanel.tsx:79-120`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: components/ui/ProgressRing.tsx, components/library/ProgressRing.tsx, app/book/library/[bookId]/components/ProgressRing.tsx, app/book/badges/components/ProgressRing.tsx, app/book/library/[bookId]/chapter/[chapterId]/components/QuizPanel.tsx:79-120

PROBLEM:
Confirmed and slightly worse than reported. components/ui/ProgressRing.tsx is the well-built shared primitive (role=progressbar/ARIA, framer useReducedMotion, parameterized color/track/decorative/ariaLabel). components/library/ProgressRing.tsx correctly wraps it. But TWO live-route reimplementations exist: (1) app/book/library/[bookId]/components/ProgressRing.tsx uses prop `percent`, has role=progressbar, but hardcodes a cyan drop-shadow + delay:0.5 and a hardcoded cyan label color; (2) app/book/badges/components/ProgressRing.tsx uses a DIFFERENT prop name `progress`, is aria-hidden="true" (no progressbar semantics for SR users), hardcodes fillColor '#f59e0b' (off-token amber), and uses a CSS `transition: stroke-dashoffset 0.6s ease` with NO reduced-motion guard (so the in-app data-motion toggle does not stop it; only the OS-media reduced-motion path would, and globals.css does not target this inline style). It is rendered on a live route (BadgePageHeader.tsx:32). The audit MISSED a fifth: an inline ProgressRing in QuizPanel.tsx (79-120) using props correctAnswers/totalQuestions, --cr-success/--cr-error tokens, and again a bare CSS transition (no reduced-motion guard).

WHY IT MATTERS:
Copy-paste drift: divergent ARIA (badges ring + QuizPanel ring invisible to or unannounced for screen readers), divergent reduced-motion behavior (two rings ignore the in-app toggle), off-token amber, and 4 separate places to fix any ring bug. Inconsistent visuals across library/badges/reader.

REQUIRED FIX:
Replace app/book/library/[bookId]/components/ProgressRing.tsx and app/book/badges/components/ProgressRing.tsx with imports of components/ui/ProgressRing (it already supports size/strokeWidth/color/trackColor/decorative/ariaLabel and reduced motion). For the badges ring pass color='var(--accent-amber)' and either decorative (if truly decorative) or let it expose progressbar role with an ariaLabel. For QuizPanel's inline ring, either use the shared primitive with color={passed ? 'var(--cr-success)' : 'var(--cr-error)'} and a center children slot, or at minimum add a useReducedMotion guard. Then delete the two duplicate files. Update the badges import (BadgePageHeader) accordingly.

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

### M50 — Static JSON book-package imports against a directory with untracked files — latent CI build-break trap (does not currently reproduce)
`severity: medium` · `effort: medium` · `files: app/book/data/bookPackages.ts:1-68, book-packages/pmbok-guide.v21.json`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/book/data/bookPackages.ts:1-68, book-packages/pmbok-guide.v21.json

PROBLEM:
Verified: bookPackages.ts statically imports 68 distinct @/book-packages/*.v21.json files (tsconfig resolveJsonModule + moduleResolution bundler resolve them at build). Diffed the 68 imported names against `git ls-files book-packages/` (107 tracked): every imported file IS tracked, so CI is green today. The working tree contains an untracked stray (book-packages/pmbok-guide.v21.json, per git status). bookPackages.ts is NOT dead — it is consumed by production paths (content-service.ts, ask/quiz/audio routes, useQuizSession.ts, v21-adapter.ts, bookChapters.ts). The CI app-checks job runs typecheck + next build, so a new import of an untracked package would fail there (TS2307), but only after merge attempt and with an opaque module-not-found error.

WHY IT MATTERS:
Future CI red / blocked merges with an opaque 'Cannot find module @/book-packages/<x>.v21.json' whenever a contributor wires up a new bundled book whose JSON they forgot to `git add`. No current production break.

REQUIRED FIX:
Prefer a build-time-generated manifest: replace the 68 hand-written imports with a generated index sourced from `git ls-files book-packages/*.v21.json` so the import set can never reference an untracked file. Cheaper interim: add a CI/pre-commit check asserting every @/book-packages/* import in bookPackages.ts resolves to a git-tracked file (mirrors the existing scan-* tooling pattern). Immediately: commit or delete the stray book-packages/pmbok-guide.v21.json to shrink the untracked surface.

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

### L4 — Two parallel design-token systems split across the auth components (--cf-* vs --accent-amber/--bg-elevated/--text-*)
`severity: low` · `effort: small` · `files: components/auth/AuthErrorBanner.tsx:47, components/auth/AuthErrorBanner.tsx:54, components/auth/AuthErrorBanner.tsx:67, components/auth/TokenExpiryGuard.tsx:150, components/auth/AuthScreen.tsx:16`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: components/auth/AuthErrorBanner.tsx:47, components/auth/AuthErrorBanner.tsx:54, components/auth/AuthErrorBanner.tsx:67, components/auth/TokenExpiryGuard.tsx:150, components/auth/AuthScreen.tsx:16

PROBLEM:
Confirmed namespace drift: TokenExpiryGuard/AuthScreen/signup use --cf-* (--cf-surface, --cf-border-strong, --cf-text-1/2/3, --cf-accent, --cf-warning-text, --cf-shadow-lg — all defined in globals.css), while AuthErrorBanner uses the legacy namespace (--accent-amber, --bg-elevated, --border-subtle, --shadow-card, --text-secondary/-muted/-heading — also all defined). Nothing is broken. HOWEVER, the finding's central impact claim — that the two banners are 'co-located … rendering side-by-side surfaces' and 'won't look like siblings' — is REFUTED by render-site verification: AuthErrorBanner is mounted ONLY on the landing page (app/page.tsx:129); TokenExpiryGuard is mounted ONLY in app/book/layout.tsx:34 and app/dashboard/layout.tsx:11. They never appear on the same page, so there is no side-by-side visual mismatch.

WHY IT MATTERS:
Real but lower than stated: pure maintenance drift (a theme tweak in one namespace silently won't carry to the other). No co-located visual inconsistency exists because the two components render on disjoint surfaces.

REQUIRED FIX:
Port AuthErrorBanner.tsx to --cf-*: --bg-elevated→--cf-surface, --border-subtle→--cf-border, --shadow-card→--cf-shadow-lg, --text-secondary→--cf-text-2, --text-muted→--cf-text-3, --text-heading→--cf-text-1, --accent-amber→--cf-warning-text. All target tokens verified present in globals.css (light+dark). This is a repo-wide drift (per the UI-audit memory: 5 token systems), so treat as a small consistency pass, not a visual-bug fix.

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

### L51 — EmailSuppression key format is duplicated across multiple build roots with only a comment to keep them in sync
`severity: low` · `effort: small` · `files: app/app/api/book/_lib/keys.ts:471-484, infra/lambda/lib/email-compliance.ts:72, infra/lambda/suppression-handler.ts:89, infra/lambda/dist/reading-reminder-cron.js:80 (built)`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/book/_lib/keys.ts:471-484, infra/lambda/lib/email-compliance.ts:72, infra/lambda/suppression-handler.ts:89, infra/lambda/dist/reading-reminder-cron.js:80 (built)

PROBLEM:
emailSuppressionPk = 'BOOKSUPPRESS#'+email.trim().toLowerCase(). The same literal is hand-replicated in at least FOUR places (the finding said three): email-compliance.ts (BOOKSUPPRESS#${email.trim().toLowerCase()} — matches), suppression-handler.ts (BOOKSUPPRESS#${email} but email is normalized at line 83 to entry.email.trim().toLowerCase() — currently equivalent), and the reading-reminder cron. No live divergence today; all normalize to lower+trim. The risk is purely a future edit diverging one copy.

WHY IT MATTERS:
A future edit to any copy (e.g. dropping .trim()/.toLowerCase() or changing the prefix) would make the bounce/complaint handler write rows the send-time isEmailSuppressed check never finds → silently re-sending to bounced/complained addresses (CASL/deliverability/blocklist exposure).

REQUIRED FIX:
Extract the suppression-key format into one shared module imported by both the Next app and the infra Lambda builds (or codegen from one source), and add a unit test asserting all producers yield identical keys for the same input.

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

### L52 — Lower-severity infra items (content-bucket public, dead stream, prod CORS, hardcoded SES sender)
`severity: low` · `effort: medium` · `files: infra/lib/chapterflow-backend-stack.ts:207-235, infra/lib/chapterflow-frontend-stack.ts:725-730, infra/lib/chapterflow-backend-stack.ts:149-160, infra/lib/chapterflow-backend-stack.ts:30-62, infra/lib/chapterflow-backend-stack.ts:183-196, infra/lib/chapterflow-backend-stack.ts:412-413`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: infra/lib/chapterflow-backend-stack.ts:207-235, infra/lib/chapterflow-frontend-stack.ts:725-730, infra/lib/chapterflow-backend-stack.ts:149-160, infra/lib/chapterflow-backend-stack.ts:30-62, infra/lib/chapterflow-backend-stack.ts:183-196, infra/lib/chapterflow-backend-stack.ts:412-413

PROBLEM:
(a) ContentBucket (207-213) sets blockPublicPolicy:false + restrictPublicBuckets:false specifically to allow the PublicReadLibraryCovers resource policy (227-235) granting s3:GetObject to AnyPrincipal on book-content/library/covers/*. Covers are published to this bucket by scripts/book/publish-library-assets.ts (BOOK_CONTENT_BUCKET) and served via the public policy — the CloudFront 'book-covers/*' behavior (frontend-stack.ts:725) points at the S3 _assets origin, a different path, so library covers are NOT fronted by CloudFront/OAC. This removes the account-level public-access guardrail on a bucket that also holds paid book content. (b) AnalyticsTable declares stream: NEW_AND_OLD_IMAGES (158) but grep finds no DynamoEventSource/StartingPosition/grantStreamRead consumer anywhere in infra or app — dead stream. (c) resolveAllowedWebOrigins() (30-62) always includes http://localhost:3000, https://siliconx.ca + *.siliconx.ca, and all chapterflow domains, applied to the ingest bucket CORS (190) in EVERY env including prod (no envName parameter). (d) Reminder SES sender hardcoded to info@chapterflow.ca and the SES identity scoped to chapterflow.ca (412-413, 456) for ALL envs; dev/staging lack that verified identity so sends would fail — currently masked by the EMAIL_POSTAL_ADDRESS kill-switch (email-compliance.ts:228-237, default '' in non-prod).

WHY IT MATTERS:
(a) Reduced defense-in-depth on a content bucket holding paid material. (b) Minor wasted DynamoDB stream cost + confusion (looks like an intended consumer is missing). (c) Sloppy prod CORS surface — prod ingest accepts localhost + legacy siliconx origins. (d) dev/staging cron email sends would fail outright if the postal-address kill-switch were ever set there.

REQUIRED FIX:
(a) Serve library covers through CloudFront with OAC from the content bucket (or a dedicated public covers prefix/bucket) and restore blockPublicPolicy:true/restrictPublicBuckets:true. (b) Remove stream: NEW_AND_OLD_IMAGES from the analytics table unless a consumer is planned. (c) Make resolveAllowedWebOrigins env-aware (drop localhost + siliconx in prod, key off envName). (d) Make the SES sender email/identity env-aware (per-env verified domain) instead of hardcoding chapterflow.ca.

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

### L61 — AuthErrorBanner uses legacy design tokens while the rest of the auth UI uses --cf-*
`severity: low` · `effort: small` · `files: components/auth/AuthErrorBanner.tsx:47-91, components/auth/TokenExpiryGuard.tsx, components/auth/AuthScreen.tsx`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: components/auth/AuthErrorBanner.tsx:47-91, components/auth/TokenExpiryGuard.tsx, components/auth/AuthScreen.tsx

PROBLEM:
AuthErrorBanner styles with legacy tokens (--border-subtle, --bg-elevated, --accent-amber, --text-secondary, --text-muted, --text-heading, --shadow-card). AuthScreen uses --cf-page-bg/--cf-accent-muted; TokenExpiryGuard uses --cf-surface/--cf-border-strong/--cf-shadow-lg/--cf-warning-text/--cf-text-1/2/3/--cf-accent; signup/pair-accept use --cf-*. Both token sets exist in globals.css so it renders, but the banner can visually diverge from the sibling session banner and is copy-paste drift.

WHY IT MATTERS:
Two competing token systems on adjacent auth components risk visual inconsistency (amber accent, surface/shadow) and make theme changes error-prone.

REQUIRED FIX:
Port AuthErrorBanner to --cf-* tokens matching TokenExpiryGuard: --bg-elevated->--cf-surface, --border-subtle->--cf-border-strong (or --cf-border), --shadow-card->--cf-shadow-lg, --accent-amber->--cf-warning-text (or --cf-accent), --text-secondary/--text-muted/--text-heading->--cf-text-2/3/1.

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

### L63 — INSIGHT_POINTS_COOKIE_NAME is actually the referral cookie ('cf_ref') — misleading constant name
`severity: low` · `effort: trivial` · `files: app/book/_lib/flow-points-economy.ts:7, app/ref/[code]/route.ts:3,19, app/app/api/book/me/onboarding/complete/route.ts:34,220,306, app/app/api/book/me/profile/route.ts:35,397,495`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/book/_lib/flow-points-economy.ts:7, app/ref/[code]/route.ts:3,19, app/app/api/book/me/onboarding/complete/route.ts:34,220,306, app/app/api/book/me/profile/route.ts:35,397,495

PROBLEM:
INSIGHT_POINTS_COOKIE_NAME === 'cf_ref' (flow-points-economy.ts:7) and is used exclusively as the referral attribution cookie: /ref/[code]/route.ts sets it to the normalized referral code (line 19), and onboarding-complete (220 read / 306 clear) and profile (397 read / 495 clear) consume it to credit the inviter. Functionally correct and consistent, but the name reads as an insight-points cookie, which is misleading for anyone in the referral/economy code.

WHY IT MATTERS:
Risk of a future maintainer wiring the wrong cookie or clobbering referral attribution; no user-facing breakage today.

REQUIRED FIX:
Rename to REFERRAL_COOKIE_NAME (keep value 'cf_ref') and update the four import sites (flow-points-economy.ts, ref/[code]/route.ts, onboarding/complete/route.ts, profile/route.ts). Pure rename.

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

### L70 — Two parallel CSS token systems (--cf-* vs legacy --bg-/--text-/--accent-) split across sibling surfaces
`severity: low` · `effort: large` · `files: components/workspace/WorkspacePage.tsx, components/library/LibraryPage.tsx, components/progress/ProgressPage.tsx, app/globals.css:200, app/globals.css:317`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: components/workspace/WorkspacePage.tsx, components/library/LibraryPage.tsx, components/progress/ProgressPage.tsx, app/globals.css:200, app/globals.css:317

PROBLEM:
The dashboard (components/workspace/*) is themed predominantly with the newer --cf-* family (19 unique vs 7 legacy), library (components/library/*) with the older --bg-/--text-/--accent- family (19 legacy vs 5 cf), and progress mixes both (18 cf vs 14 legacy). Both families are fully defined with dark+light variants in globals.css and resolve to identical values (e.g. --cf-text-1 and --text-heading both #F7F8FA dark / #1C1917 light; --cf-accent and --accent-cyan both #22D3EE / #0E7490). No undefined var() references in scope — nothing is broken; duplicate values are maintained twice.

WHY IT MATTERS:
Pure maintenance/drift risk: a theme tweak must be applied in two token families to stay consistent across dashboard vs library, and contributors must know which family a surface uses. No user-facing breakage.

REQUIRED FIX:
Pick one canonical family (the --cf-* set is the newer convention) and alias the legacy tokens to it in globals.css (e.g. --text-heading: var(--cf-text-1)), then migrate library/progress components onto canonical names over time. Cleanup, not a launch blocker.

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

### L89 — Lint is advisory-only (continue-on-error) and next build does not lint — real code-quality regressions cannot block a merge
`severity: low` · `effort: medium` · `files: .github/workflows/ci.yml:97-138, eslint.config.mjs:8-14, next.config.ts`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: .github/workflows/ci.yml:97-138, eslint.config.mjs:8-14, next.config.ts

PROBLEM:
Verified: the lint job is continue-on-error: true (ci.yml:106) with an inline `exit 0` (l138) and a comment instructing it be kept OUT of required branch-protection checks (l98-101). next.config.ts has no eslint block, and Next 16 `next build` does not run ESLint by default (no `next lint` in CI; the build step is just `npm run build`). So ESLint never blocks anything. eslint.config.mjs:9-13 additionally disables react-hooks/set-state-in-effect for the whole app/book/** tree. The style-drift and secret scans ARE hard gates, but JS/TS correctness lint (exhaustive-deps, no-unused, no-floating-promises) is purely informational.

WHY IT MATTERS:
Correctness-class lint regressions (missing effect deps, floating promises, unused error handlers) ship without resistance; the lint-debt baseline can grow indefinitely since nothing enforces 'no NEW errors'.

REQUIRED FIX:
Adopt a ratcheting gate mirroring the repo's existing baseline model (scan-style-drift's allowlist): snapshot current ESLint errors into a committed baseline count and add a blocking CI step that fails only on NEW errors (eslint --max-warnings tied to the baseline, or a diff-against-baseline). This blocks new debt without forcing a big-bang cleanup.

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

### L90 — README.md still claims the repo ships two product domains including the deleted Cloud Portfolio — plus a verified-dead SECURE_DOC_TABLE code path
`severity: low` · `effort: trivial` · `files: docs/README.md:3-7, docs/ENVIRONMENT.md:151, app/app/api/_lib/aws.ts:24-26`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: docs/README.md:3-7, docs/ENVIRONMENT.md:151, app/app/api/_lib/aws.ts:24-26

PROBLEM:
Verified: docs/README.md:3-7 states 'This repository contains two application domains... Cloud Portfolio document workflows [and] ChapterFlow guided reading.' Per memory and code, the Cloud Portfolio PDF/conversion domain was removed from HEAD. ENVIRONMENT.md:151 lists SECURE_DOC_TABLE as 'Belongs to the sibling Cloud Portfolio product (app/app/api/_lib/aws.ts); not used by ChapterFlow.' STRENGTHENED: aws.ts:24-26 getTableName() returns mustServerEnv('SECURE_DOC_TABLE'), and git grep confirms NO caller of getTableName / SECURE_DOC_TABLE anywhere in app/ or lib/ — only ddbDoc/s3/REGION/sfn from aws.ts are imported. So getTableName is live dead-code residue of the deleted product, exactly matching the doc claim. The unused pdf-lib/pdfjs-dist deps (Finding 1) are the matching dependency residue.

WHY IT MATTERS:
An operator reading the env/launch docs (the stated source of truth) is told to reason about a product that does not exist and may chase phantom config (SECURE_DOC_TABLE) or keep dead PDF deps believing they're load-bearing.

REQUIRED FIX:
Edit docs/README.md:3-7 to state the repo ships only ChapterFlow; drop the Cloud Portfolio bullet and the 'two application domains' framing. Remove or clearly mark-as-legacy the SECURE_DOC_TABLE row in ENVIRONMENT.md:151, and delete the dead getTableName() function from app/app/api/_lib/aws.ts (no callers) to eliminate the residue entirely.

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

### P3 — Streak-shield purchase return value carries a misleading balance:0
`severity: polish` · `effort: trivial` · `files: app/app/api/book/_lib/streak-repo.ts:408-415, app/app/api/book/_lib/streak-repo.ts:480-496, app/app/api/book/me/streak/route.ts:76-81`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/book/_lib/streak-repo.ts:408-415, app/app/api/book/_lib/streak-repo.ts:480-496, app/app/api/book/me/streak/route.ts:76-81

PROBLEM:
purchaseStreakShield returns balance: 0 in the success branch (line 494, comment 'Caller should re-fetch if needed'), the insufficient-balance branch (486), and the shields-full branch (413). The POST route never re-fetches and does not return balance to the client (route.ts:76-81), so the post-purchase IP balance shown in the UI is stale until the next /me/flow-points refresh. The shieldsHeld count is returned correctly; only balance is the gap.

WHY IT MATTERS:
Cosmetic: after buying a shield the user's IP balance in the UI lags by one interaction until refresh. No correctness/economy impact (the TransactWrite atomically guards points >= cost).

REQUIRED FIX:
Either have purchaseStreakShield return the real post-transaction balance (a follow-up GetCommand on engagement after the TransactWrite, or compute streak.balance - cost) and surface it in the streak POST response, or have the client refresh /me/flow-points after a successful shield purchase. The route already returns shieldsHeld correctly.

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

### P4 — INSIGHT_POINTS_COOKIE_NAME ('cf_ref') is the referral-attribution cookie — misleading name invites future bugs
`severity: polish` · `effort: trivial` · `files: app/book/_lib/flow-points-economy.ts:7, app/ref/[code]/route.ts:3-19, app/app/api/book/me/profile/route.ts:397,495, app/app/api/book/me/onboarding/complete/route.ts:220,306`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/book/_lib/flow-points-economy.ts:7, app/ref/[code]/route.ts:3-19, app/app/api/book/me/profile/route.ts:397,495, app/app/api/book/me/onboarding/complete/route.ts:220,306

PROBLEM:
The constant INSIGHT_POINTS_COOKIE_NAME = 'cf_ref' (flow-points-economy.ts:7) actually holds the referral attribution code: it is set by /ref/[code]/route.ts:19 and consumed/cleared at profile (route.ts:397,495) and onboarding/complete (route.ts:220,306) to create a referral claim. The name implies the Insight Points balance cookie, not referral attribution. Value and behavior are correct; only the name is misleading. ('cf_ref' is also documented in app/legal/cookies/page.tsx:98 as the referral cookie, so the value must be preserved.)

WHY IT MATTERS:
No functional bug today; meaningful risk that a future maintainer breaks referral attribution by reasoning about the misleading name (e.g. clearing it as part of an Insight Points change).

REQUIRED FIX:
Rename the constant to REFERRAL_ATTRIBUTION_COOKIE_NAME (keep the 'cf_ref' value to preserve existing cookies and the legal/cookies disclosure) across flow-points-economy.ts and its four consumers (ref/[code], profile, onboarding/complete — note there are more consumers than the original finding listed).

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

### P5 — insight-points/adjust duplicates requireAdminUser logic instead of reusing the shared guard
`severity: polish` · `effort: trivial` · `files: app/app/api/book/admin/insight-points/adjust/route.ts:38-44, app/app/api/book/_lib/admin-auth.ts:5-15`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/book/admin/insight-points/adjust/route.ts:38-44, app/app/api/book/_lib/admin-auth.ts:5-15

PROBLEM:
Every other admin route calls the shared requireAdminUser(). insight-points/adjust inlines the equivalent: requireActiveBookUser() then a manual getBookAdminGroupName() + admin.groups?.includes(adminGroup) check (route.ts:38-44). It is currently functionally identical to admin-auth.ts:5-15, but the duplication means a future hardening change to admin-auth (MFA, a second admin group, step-up auth) would silently skip this money-adjacent endpoint.

WHY IT MATTERS:
Drift risk: an admin-auth policy change would not apply to the IP-adjustment endpoint, one of the more sensitive economy-affecting routes.

REQUIRED FIX:
Replace the inline check with `const admin = await requireAdminUser();` (which returns the same user object, preserving admin.sub/admin.email usage downstream) and drop the manual getBookAdminGroupName/includes block plus the now-unused import. Keeps all admin authz centralized.

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

### P6 — Stale-comment 'fire-and-forget' on awaited notify loop, and notifications dailyVolume hardcoded to zero
`severity: polish` · `effort: small` · `files: app/app/api/book/admin/segments/[segmentId]/notify/route.ts:59, app/app/api/book/admin/metrics/notifications/route.ts:82-88,124-133`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/book/admin/segments/[segmentId]/notify/route.ts:59, app/app/api/book/admin/metrics/notifications/route.ts:82-88,124-133

PROBLEM:
notify/route.ts:59 labels the loop '// Fire-and-forget notifications' but every createNotification at :64 is awaited — the comment hides the cost that drives the timeout finding. Separately, notifications/route.ts:82 builds dailyVolume as days.map(d => ({date:d, value:0})) and :85-88 contains a dead `if (scanned > 0) { /* comment only */ }` block, so the daily-volume chart always renders flat zero, reading as fabricated/empty data to the operator. The notification scan's ProjectionExpression already includes createdAt (route.ts:45), so a real per-day computation is feasible without new reads.

WHY IT MATTERS:
Misleading comment masks a real perf problem; the notifications dashboard shows a permanently-zero daily-volume chart that looks like a data outage or fake data.

REQUIRED FIX:
Fix the notify comment to reflect synchronous sends (or make sends actually async/batched per finding 1). For dailyVolume, bucket the already-scanned notifications by createdAt slice(0,10) into the days array (createdAt is already projected) — or remove the chart until backed by real data so it isn't mistaken for a zeroed metric. Delete the dead if-block.

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

### P11 — Onboarding books.ts / recommendations.ts comments hardcode '67-book catalog' — already drifted (catalog is 68)
`severity: polish` · `effort: trivial` · `files: app/onboarding/data/books.ts:1-14, app/onboarding/data/recommendations.ts:1-7`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/onboarding/data/books.ts:1-14, app/onboarding/data/recommendations.ts:1-7

PROBLEM:
The data layer correctly derives the deck from the real catalog metadata (no fabricated counts shown to users — books.ts:12-13 even instructs counts must come from lib/catalog-stats). But the source comments assert a literal '67 books' (books.ts:4) / 'full 67-book catalog' (recommendations.ts:5). The catalog is dynamic; booksCatalog.metadata.json currently contains 68 entries, so the comment has ALREADY gone stale.

WHY IT MATTERS:
No runtime impact; documentation drift only — and it's already wrong (67 vs actual 68).

REQUIRED FIX:
Replace the hardcoded '67' in both comments with a non-numeric description ('the full published catalog') or reference lib/catalog-stats (which exists) so the doc can't go stale.

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

### P16 — Two parallel design-token systems used across this area (--cf-* vs --bg-base/--text-*/--accent-cyan)
`severity: polish` · `effort: medium` · `files: app/book/saved/SavedBooksClient.tsx:69-127, app/book/badges/components/BadgeCard.tsx:15-22, app/book/badges/components/BadgeDetailModal.tsx:282-289, app/globals.css:200-218,319-329`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/book/saved/SavedBooksClient.tsx:69-127, app/book/badges/components/BadgeCard.tsx:15-22, app/book/badges/components/BadgeDetailModal.tsx:282-289, app/globals.css:200-218,319-329

PROBLEM:
The Saved page styles with raw inline var(--bg-base)/var(--text-primary)/var(--text-heading)/var(--text-secondary)/var(--accent-cyan) (SavedBooksClient.tsx:69-127), while badges/notebook/profile/rewards/events use the --cf-* namespace via Tailwind arbitrary classes. Both namespaces are fully defined in globals.css (--bg-base etc. at 200-218, --cf-* at 319+), verified, so it renders correctly today. Additionally METALLIC_GRADIENTS is byte-identically duplicated in BadgeCard.tsx (15-22) and BadgeDetailModal.tsx (282-289); TIER_BORDER_COLORS/TIER_PILL_STYLES are already correctly hoisted into badge-utils.ts and shared, so the gradient map is the remaining straggler.

WHY IT MATTERS:
No runtime bug, but copy-paste drift and theming-inconsistency risk: a future token change to one namespace silently misses the other, and the duplicated gradient maps can diverge.

REQUIRED FIX:
Standardize this area on the --cf-* token set (or alias --bg-base etc. through --cf-*), and hoist the duplicated METALLIC_GRADIENTS into badge-utils.ts (next to the already-shared TIER_BORDER_COLORS/TIER_PILL_STYLES) so BadgeCard and BadgeDetailModal import one source.

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

### P18 — Content scenario chart zips submissions and approvals by array index, not by date
`severity: polish` · `effort: trivial` · `files: app/book/admin/_clients/ContentClient.tsx:66-72, app/app/api/book/admin/metrics/content/route.ts:94-102, app/app/api/book/_lib/admin-metrics.ts:109-122`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/book/admin/_clients/ContentClient.tsx:66-72, app/app/api/book/admin/metrics/content/route.ts:94-102, app/app/api/book/_lib/admin-metrics.ts:109-122

PROBLEM:
scenarioCombined (ContentClient.tsx:66-72) pairs scenarioSubmissions[i] with scenarioApprovals[i]?.value, an index-based merge that assumes both series are equal-length and identically date-ordered. This is the only chart in the admin surface that doesn't merge defensively (Moderation reduces each series independently at ModerationClient.tsx:51-52; Engagement merges by date via a map at EngagementClient.tsx:67-75).

WHY IT MATTERS:
ORIGINAL CLAIM OVERSTATED: this does NOT currently mis-align. The content route builds BOTH series from the SAME days[] array via dailySeries() (content/route.ts:94-102; dailySeries at admin-metrics.ts:109-122 maps over the identical days[] for each event type and Promise.all preserves order, never dropping days). So today the indices are guaranteed aligned and the chart is correct. It is a latent robustness/consistency nit, not a live correctness bug — downgraded from low/correctness to polish/maintainability.

REQUIRED FIX:
Optional hardening for resilience to any future API change: merge by date like EngagementClient.quizCombined — build a Record keyed by s.date for submissions, set `approved` from a date-keyed lookup of scenarioApprovals, then Object.values().sort by date. Low priority given the current backend contract guarantees alignment.

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

### P19 — Stale 'Phase N / once live in production' copy implies tracking is not wired
`severity: polish` · `effort: small` · `files: app/book/admin/_clients/AcquisitionClient.tsx:141-144, app/book/admin/_clients/FunnelsClient.tsx:91-95, app/book/admin/_clients/NotificationsClient.tsx:140-142`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/book/admin/_clients/AcquisitionClient.tsx:141-144, app/book/admin/_clients/FunnelsClient.tsx:91-95, app/book/admin/_clients/NotificationsClient.tsx:140-142

PROBLEM:
Footnotes leak internal roadmap phases and signal incomplete instrumentation to anyone with admin access: Acquisition (141-144) says UTM/referer tagging happens 'once Phase 3 instrumentation is live in production'; Funnels (91-95) says 'First commitment' and 'First AI feedback' are estimated from a sample of the 100 most recent users and full coverage 'requires a precomputed snapshot (Phase 5+)'; Notifications (140-142) says email/push read rates 'require ... (Phase 6)'.

WHY IT MATTERS:
Admins/stakeholders are told key acquisition and funnel metrics are sampled or not-yet-real, and the funnel's sampled steps are only labeled in a footnote (easy to misread as totals). It also leaks internal 'Phase N' references. Polish-level.

REQUIRED FIX:
Confirm post-merge whether UTM/referer capture is actually live; if so, drop the 'Phase 3' caveat. For Funnels, label the two sampled steps inline (e.g. a '~ sampled' badge on the row) rather than only in the footnote. Strip internal 'Phase N' numbers from all user-facing copy across these three pages.

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

### P22 — Five coexisting token systems (~170+ CSS custom properties) create high theming-change risk
`severity: polish` · `effort: large` · `files: app/globals.css:82-388, app/globals.css:1543-1600`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/globals.css:82-388, app/globals.css:1543-1600

PROBLEM:
globals.css carries five overlapping token families that must be kept in sync per theme: shadcn (--card/--primary/... surfaced via `@theme inline` at 82+), semantic (--bg-*/--text-*/--border-*), unified accents (--accent-* -- 56 definitions counted), legacy CF (--cf-* -- 139 definitions counted), and reader (--cr-* -- 38 definitions counted). Many are pure aliases. The file is internally consistent and compiles (no build-breaking classes; Tailwind v4 parenthesis syntax used throughout), so this is consolidation-in-progress, not breakage. But every new color or a third theme must be defined across all relevant families or a surface silently drifts off-brand. (Note: raw def counts here are 56/139/38 for accent/cf/cr; the audit's '~178 total' is in the right ballpark.)

WHY IT MATTERS:
Slows and risks any palette change; easy to update one family and miss an alias, producing per-surface color drift. Not user-facing today.

REQUIRED FIX:
Continue the in-progress consolidation: make --accent-*/--bg-*/--text-*/--border-* canonical, redefine --cf-* and --cr-* purely as aliases of the canonical set (most already are), and add a CI guard (extend scripts/ci/scan-style-drift.mjs) that fails if a raw hex is introduced outside the canonical :root / html:not(.dark) blocks. Track the explicitly DEPRECATED aliases for removal once consumers migrate.

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
