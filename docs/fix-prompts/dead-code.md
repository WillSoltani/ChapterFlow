# Fix prompts — Dead Code

_12 items (1 high, 3 medium, 5 low, 3 polish). ChapterFlow production-readiness remediation. Fixes land on branch `audit/prod-readiness-2026-06-14`. See [DISPATCH.md](DISPATCH.md)._

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

### H7 — Reading-partner (pairs) feature has no UI entry point — entirely unreachable
`severity: high` · `effort: medium` · `files: app/book/home/components/PartnerProgressCard.tsx:10, app/book/home/page.tsx:1-5, components/workspace/WorkspacePage.tsx, app/pair/[code]/route.ts`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app
(Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

BRANCH: Work on "audit/prod-readiness-2026-06-14". First run:
  git rev-parse --abbrev-ref HEAD
If it is not "audit/prod-readiness-2026-06-14" and not a "fix/H7" worktree branched off it, run:
  git checkout audit/prod-readiness-2026-06-14
Do NOT create unrelated branches and do NOT switch away mid-task.

FILES: app/book/home/components/PartnerProgressCard.tsx:10, app/book/home/page.tsx:1-5, components/workspace/WorkspacePage.tsx, app/pair/[code]/route.ts

PROBLEM:
The full pairs backend is implemented (createPairInvite/acceptPairInvite/nudge/deletePair, bidirectional records) and the ONLY component that lets a user generate a pair invite (createInvite -> POST /me/pairs/invite, PartnerProgressCard.tsx:52-71) or nudge a partner is PartnerProgressCard. grep confirms PartnerProgressCard is imported/rendered NOWHERE — it appears only at its own definition. The legacy home (app/book/home/page.tsx) redirect()s to /dashboard; /dashboard renders components/workspace/WorkspacePage which has no partner/pairs surface (HeroSessionCard's only 'partner' match is the string 'Start Your Reading Journey'). The only reachable pairs page is /book/pair-accept (via /pair/[code] redirect), but it requires an invite link no user can ever produce.

WHY IT MATTERS:
A social/accountability feature the product implies exists is completely unusable: users cannot pair, invite, or nudge anyone. Backend-complete, UI-absent dead weight (routes, DB schema, account-erasure handling all maintained for nothing).

REQUIRED FIX:
Either (a) render PartnerProgressCard in components/workspace/WorkspacePage.tsx wired to onboarding state (and add the partner-progress/name endpoint per the separate finding), or (b) if pairs is cut for launch, delete PartnerProgressCard, app/book/pair-accept/page.tsx, app/pair/[code]/route.ts, app/app/api/book/me/pairs/**, and pair-repo.ts to stop maintaining unreachable surface.

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
  git commit -m "fix(dead-code): H7 — Reading-partner (pairs) feature has no UI entry point — enti"
Then report: the diff summary + the command output. Do NOT push.
```

---

### M33 — Reflection-IP award flow in ExamplesList is fully dead (endpoint never called)
`severity: medium` · `effort: small` · `files: app/book/library/[bookId]/chapter/[chapterId]/components/ExamplesList.tsx:317-348, app/book/library/[bookId]/chapter/[chapterId]/components/ExamplesList.tsx:290-315, app/book/library/[bookId]/chapter/[chapterId]/components/ExamplesList.tsx:86-110, app/book/library/[bookId]/chapter/[chapterId]/components/ExamplesList.tsx:561, app/book/library/[bookId]/chapter/[chapterId]/components/ExamplesList.tsx:571-593`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app
(Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

BRANCH: Work on "audit/prod-readiness-2026-06-14". First run:
  git rev-parse --abbrev-ref HEAD
If it is not "audit/prod-readiness-2026-06-14" and not a "fix/M33" worktree branched off it, run:
  git checkout audit/prod-readiness-2026-06-14
Do NOT create unrelated branches and do NOT switch away mid-task.

FILES: app/book/library/[bookId]/chapter/[chapterId]/components/ExamplesList.tsx:317-348, app/book/library/[bookId]/chapter/[chapterId]/components/ExamplesList.tsx:290-315, app/book/library/[bookId]/chapter/[chapterId]/components/ExamplesList.tsx:86-110, app/book/library/[bookId]/chapter/[chapterId]/components/ExamplesList.tsx:561, app/book/library/[bookId]/chapter/[chapterId]/components/ExamplesList.tsx:571-593

PROBLEM:
ExamplesList builds a full reflection-award system: handleSubmitReflection POSTs /app/api/book/me/reflections/[bookId]/[n] (lines 317-348), manages a reflectionAwards localStorage set (290-315), and renders '+N IP for thinking deeply' toasts (571-593). It is passed to ScenarioCard as onSubmitReflection={handleSubmitReflection} (line 561). But ScenarioCard's destructured params (lines 86-96) do NOT include onSubmitReflection — the prop only appears on its type (line 107, explicitly marked 'Deprecated: textarea-based reflection was removed'). handleReveal (lines 145-151) calls only onInteraction. So handleSubmitReflection is never invoked, the toasts never appear, and /me/reflections (route confirmed to exist) is unreachable from the reader.

WHY IT MATTERS:
An economy feature (reflection IP) is silently disabled on the primary examples surface; ~60 lines of state/effects/toasts plus a live API route are dead weight and a maintenance trap.

REQUIRED FIX:
Decide intent. If revealing the analysis should reward IP, call onSubmitReflection(example.id, ...) from ScenarioCard.handleReveal (and add it to the destructured params). If not, delete handleSubmitReflection, the reflectionAwards state+effects, reflectionToasts and its render block, the deprecated onSubmitReflection prop/type, and the /me/reflections wiring.

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
  git commit -m "fix(dead-code): M33 — Reflection-IP award flow in ExamplesList is fully dead (endp"
Then report: the diff summary + the command output. Do NOT push.
```

---

### M34 — Entire app/book/home/components tree's 11 widgets are dead code (~1577 LOC)
`severity: medium` · `effort: small` · `files: app/book/home/page.tsx:1, app/book/home/components/StarterRecommendationCard.tsx, app/book/home/components/CommitmentFollowUpCard.tsx, app/book/home/components/CurrentlyReadingCard.tsx, app/book/home/components/EventBanner.tsx, app/book/home/components/FlowPointsSection.tsx, app/book/home/components/BookMiniCard.tsx, app/book/home/components/TodaySessionCard.tsx, app/book/home/components/PartnerProgressCard.tsx, app/book/home/components/GoalMeter.tsx, app/book/home/components/JourneyBanner.tsx, app/book/home/components/ReviewDueWidget.tsx`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app
(Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

BRANCH: Work on "audit/prod-readiness-2026-06-14". First run:
  git rev-parse --abbrev-ref HEAD
If it is not "audit/prod-readiness-2026-06-14" and not a "fix/M34" worktree branched off it, run:
  git checkout audit/prod-readiness-2026-06-14
Do NOT create unrelated branches and do NOT switch away mid-task.

FILES: app/book/home/page.tsx:1, app/book/home/components/StarterRecommendationCard.tsx, app/book/home/components/CommitmentFollowUpCard.tsx, app/book/home/components/CurrentlyReadingCard.tsx, app/book/home/components/EventBanner.tsx, app/book/home/components/FlowPointsSection.tsx, app/book/home/components/BookMiniCard.tsx, app/book/home/components/TodaySessionCard.tsx, app/book/home/components/PartnerProgressCard.tsx, app/book/home/components/GoalMeter.tsx, app/book/home/components/JourneyBanner.tsx, app/book/home/components/ReviewDueWidget.tsx

PROBLEM:
app/book/home/page.tsx is just `redirect('/dashboard')`. The live dashboard is components/workspace/WorkspacePage. Of the files in app/book/home/components, only TopNav (15 importers), SearchBox, GlobalSearchPanel (4 importers) and InfoModal (1 importer, the profile client) are live. The 11 listed widgets have zero external referencers and do not import each other (verified by grep across app/components/lib).

WHY IT MATTERS:
~1577 lines of unreferenced code ship and confuse maintainers — the classic 'legacy duplicate client' trap (editing StarterRecommendationCard/CommitmentFollowUpCard expecting the dashboard to change does nothing). Bloats the surface auditors must reason about.

REQUIRED FIX:
Delete the 11 orphaned files. Keep TopNav.tsx, SearchBox.tsx, GlobalSearchPanel.tsx, InfoModal.tsx (still live). Optionally move those four to a neutral location (e.g. components/nav/) so a redirect-only route folder stops implying a live 'home' surface, and retarget the admin links (app/book/admin/layout.tsx:13 redirect, AdminShell.tsx:147/229) from /book/home to /dashboard so app/book/home/page.tsx can be removed too.

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
  git commit -m "fix(dead-code): M34 — Entire app/book/home/components tree's 11 widgets are dead c"
Then report: the diff summary + the command output. Do NOT push.
```

---

### M45 — accentColor, interfaceDensity, focusRingStrength are dead theming plumbing (no CSS consumers, no Settings UI)
`severity: medium` · `effort: medium` · `files: app/_lib/document-theme.ts:149-150, app/_lib/document-theme.ts:153, app/_lib/document-theme.ts:228, app/globals.css`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app
(Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

BRANCH: Work on "audit/prod-readiness-2026-06-14". First run:
  git rev-parse --abbrev-ref HEAD
If it is not "audit/prod-readiness-2026-06-14" and not a "fix/M45" worktree branched off it, run:
  git checkout audit/prod-readiness-2026-06-14
Do NOT create unrelated branches and do NOT switch away mid-task.

FILES: app/_lib/document-theme.ts:149-150, app/_lib/document-theme.ts:153, app/_lib/document-theme.ts:228, app/globals.css

PROBLEM:
applyDocumentTheme writes root.dataset.accent / density / focusRing on every load and the inline bootstrap script (buildDocumentThemeBootstrapScript, line 228, run render-blocking in <head>) sets data-accent/data-density/data-focus-ring too; AccentColor/InterfaceDensity/FocusRingStrength are full types with pickers + persistence + merge. But grep of globals.css shows ZERO rules keyed on [data-accent], [data-density], or [data-focus-ring] -- only data-motion, data-color-blind-mode, and data-contrast are consumed. And there is NO Settings UI control that sets accentColor/interfaceDensity/focusRingStrength (the appearance section in BookSettingsClient only sets theme, scheduledDarkMode, reducedMotion; grep for accentColor/interfaceDensity/focusRingStrength setters under app/book/settings returned nothing). :focus-visible uses a fixed outline regardless of focusRingStrength.

WHY IT MATTERS:
Maintainability + bundle/perf: render-blocking bootstrap script does extra work writing three DOM attributes nothing reads, plus a latent trap that future code may assume these are wired. Not user-visible today.

REQUIRED FIX:
Pick a direction. To prune (recommended given no UI exists): remove accentColor/interfaceDensity/focusRingStrength from DocumentThemeSettings and DEFAULT_THEME_SETTINGS, drop the dataset writes at document-theme.ts:149-150,153 and the matching branches of buildDocumentThemeBootstrapScript (line 228), and remove the unused picker/persistence paths. To make them real: add [data-accent='emerald'|'amber'|'rose'|'sky']{--accent-cyan:...} overrides, a [data-density] spacing scale, a [data-focus-ring] outline-width scale on :focus-visible, AND the missing Settings controls.

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
  git commit -m "fix(dead-code): M45 — accentColor, interfaceDensity, focusRingStrength are dead th"
Then report: the diff summary + the command output. Do NOT push.
```

---

### L5 — access_token cookie is set on every auth/callback+refresh but never read by the app — unused credential surface
`severity: low` · `effort: trivial` · `files: app/auth/callback/route.ts:140, app/auth/refresh/route.ts:132, app/app/api/_lib/auth.ts:14`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app
(Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

BRANCH: Work on "audit/prod-readiness-2026-06-14". First run:
  git rev-parse --abbrev-ref HEAD
If it is not "audit/prod-readiness-2026-06-14" and not a "fix/L5" worktree branched off it, run:
  git checkout audit/prod-readiness-2026-06-14
Do NOT create unrelated branches and do NOT switch away mid-task.

FILES: app/auth/callback/route.ts:140, app/auth/refresh/route.ts:132, app/app/api/_lib/auth.ts:14

PROBLEM:
Every successful login (callback:140) and refresh (refresh:132) sets an access_token cookie; logout (logout:19,35) and refresh's deleted-account branch (refresh:115) and login's deleted branch (login:62) clear it. But identity is verified/read exclusively from id_token (auth.ts COOKIE_NAME='id_token', auth.ts:14,66). grep across app/ and components/ for access_token finds only: the set/clear sites in the four auth routes, and a documentation row in app/legal/cookies/page.tsx:54 ('API authorization token. Secure, httpOnly.'). No route, lib, or component ever READS the access_token value — confirmed dead as a credential. It would only be needed for a Cognito resource-server / API Gateway authorizer call, which this app doesn't make.

WHY IT MATTERS:
Minor: a longer-lived sensitive token persisted to the browser with no consumer slightly enlarges the credential attack surface and confuses auditors of the flow.

REQUIRED FIX:
Either stop setting access_token (callback:140, refresh:132) and drop its clears (login:62, logout:19+35, middleware:84, refresh:115) and its legal/cookies row, OR add a one-line comment at the two set sites noting it's reserved for future resource-server calls so it isn't read as dead code. Given no resource server is on the roadmap, removal is cleaner.

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
  git commit -m "fix(dead-code): L5 — access_token cookie is set on every auth/callback+refresh bu"
Then report: the diff summary + the command output. Do NOT push.
```

---

### L11 — Webhook imports a block of dead symbols left over from the removed referral-conversion payout
`severity: low` · `effort: trivial` · `files: app/app/api/book/billing/webhook/route.ts:12-21, app/app/api/book/billing/webhook/route.ts:27, app/app/api/book/billing/webhook/route.ts:56-64, app/app/api/book/billing/webhook/route.ts:147-151, app/app/api/book/billing/webhook/route.ts:252-256, app/app/api/book/billing/webhook/route.ts:349-353`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app
(Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

BRANCH: Work on "audit/prod-readiness-2026-06-14". First run:
  git rev-parse --abbrev-ref HEAD
If it is not "audit/prod-readiness-2026-06-14" and not a "fix/L11" worktree branched off it, run:
  git checkout audit/prod-readiness-2026-06-14
Do NOT create unrelated branches and do NOT switch away mid-task.

FILES: app/app/api/book/billing/webhook/route.ts:12-21, app/app/api/book/billing/webhook/route.ts:27, app/app/api/book/billing/webhook/route.ts:56-64, app/app/api/book/billing/webhook/route.ts:147-151, app/app/api/book/billing/webhook/route.ts:252-256, app/app/api/book/billing/webhook/route.ts:349-353

PROBLEM:
maybeAwardReferralProConversion was gutted to a no-op (route.ts:56-64), but its imports remain: analyticsTrackFlowPointsTransaction, analyticsTrackReferral (lines 13-14), awardFlowPoints, getUserReferralClaim, markReferralProRewarded (lines 18-20), and INSIGHT_POINTS_AMOUNTS (line 27). I grepped the file: each of these symbols appears exactly once — on its import line — and is never referenced in the body. Only analyticsTrackSubscription (line 15) from that import group is actually used (lines 138,160,241,285,340,400). tsconfig has strict:true but not noUnusedLocals, so the build passes today, but this pulls flow-points-repo + the flow-points-economy module into the webhook bundle for nothing.

WHY IT MATTERS:
No runtime impact; pure maintainability/bundle hygiene. A future enable of noUnusedLocals or a stricter lint gate would fail the build; readers may wrongly assume referral payouts still fire in the webhook.

REQUIRED FIX:
Delete the unused imports: remove analyticsTrackFlowPointsTransaction + analyticsTrackReferral (keep analyticsTrackSubscription) from the analytics-repo import (lines 13-14), delete the entire flow-points-repo import (lines 17-21), and delete the INSIGHT_POINTS_AMOUNTS import (line 27). Then either fully delete maybeAwardReferralProConversion and its 3 call sites (147-151, 252-256, 349-353), or keep the documented no-op with zero imports.

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
  git commit -m "fix(dead-code): L11 — Webhook imports a block of dead symbols left over from the r"
Then report: the diff summary + the command output. Do NOT push.
```

---

### L28 — review_session_complete IP (10) is defined in the economy but never awarded by any endpoint
`severity: low` · `effort: small` · `files: app/book/_lib/flow-points-economy.ts:33, app/book/_lib/flow-points-economy.ts:82, app/app/api/book/me/reviews/[cardId]/route.ts:19-61`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app
(Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

BRANCH: Work on "audit/prod-readiness-2026-06-14". First run:
  git rev-parse --abbrev-ref HEAD
If it is not "audit/prod-readiness-2026-06-14" and not a "fix/L28" worktree branched off it, run:
  git checkout audit/prod-readiness-2026-06-14
Do NOT create unrelated branches and do NOT switch away mid-task.

FILES: app/book/_lib/flow-points-economy.ts:33, app/book/_lib/flow-points-economy.ts:82, app/app/api/book/me/reviews/[cardId]/route.ts:19-61

PROBLEM:
INSIGHT_POINTS_AMOUNTS.reviewSessionComplete = 10 (flow-points-economy.ts:82) and the 'review_session_complete' FlowPointsSourceType (line 33) are declared, implying reviewing cards earns IP, but no awardFlowPoints call anywhere uses sourceType 'review_session_complete' (grep over app/app/api/book confirms). The FSRS review submit route records the card and log but grants zero IP.

WHY IT MATTERS:
Minor: a documented earning path doesn't exist, so spaced-repetition gives no IP incentive despite a declared constant; dead constants invite future confusion.

REQUIRED FIX:
Decide intent: either award 10 IP on completing a review session via awardFlowPoints with a per-day idempotent sourceId (sourceType 'review_session_complete', sourceId `${userId}:${utcDay}`) in the reviews flow, or delete reviewSessionComplete from INSIGHT_POINTS_AMOUNTS and the unused source type to keep the economy honest.

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
  git commit -m "fix(dead-code): L28 — review_session_complete IP (10) is defined in the economy bu"
Then report: the diff summary + the command output. Do NOT push.
```

---

### L92 — Dead mock-data modules left in the live tree (progressMockData, MOCK_USER_STATS/MOCK_WEEKLY_CHALLENGE) — confusing but not rendered
`severity: low` · `effort: small` · `files: components/progress/progressMockData.ts:3, components/library/libraryData.ts:86, components/library/libraryData.ts:101, components/progress/ProgressPage.tsx:21, components/progress/ProgressPage.tsx:188`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app
(Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

BRANCH: Work on "audit/prod-readiness-2026-06-14". First run:
  git rev-parse --abbrev-ref HEAD
If it is not "audit/prod-readiness-2026-06-14" and not a "fix/L92" worktree branched off it, run:
  git checkout audit/prod-readiness-2026-06-14
Do NOT create unrelated branches and do NOT switch away mid-task.

FILES: components/progress/progressMockData.ts:3, components/library/libraryData.ts:86, components/library/libraryData.ts:101, components/progress/ProgressPage.tsx:21, components/progress/ProgressPage.tsx:188

PROBLEM:
Verified by grep: MOCK_USER_STATS and MOCK_WEEKLY_CHALLENGE (libraryData.ts:86, :101) have ZERO consumers — the live LibraryPage builds stats via toUserStats/toLibraryBooks and uses the real WEEKLY_CHALLENGE const from dashboardToLibraryUi.ts. progressMockData.ts (mockProgressData: hardcoded "Will", insightPoints 150, a fake active book "So Good They Can't Ignore You" with readersCount 347, fake streak) is imported by the live ProgressPage.tsx but ONLY its `dailyQuests` array is read (line 188), and even there every value is overwritten with real analytics (lines 194-217); the id/title/icon/type structural shell is all that survives. None of the fabricated user/book/streak fields reach the screen. I specifically traced the readersCount=347 concern: it never renders — active books are rebuilt fresh with readersCount:0 (ProgressPage.tsx:97 / buildProgressData) and overlaid with a REAL /books/{id}/metrics readersToday value (line 449), and ContinueLearningCard only shows the line when readersCount>0.

WHY IT MATTERS:
No user-facing impact today. Risk is a future regression that surfaces "Will", level 4 Pro, 347 readers, or a fake 5-day streak on a real account, plus reviewer/maintainer confusion (the codebase reads as if mock data is live).

REQUIRED FIX:
Delete MOCK_USER_STATS and MOCK_WEEKLY_CHALLENGE from components/library/libraryData.ts (keep the type defs, CURATED_SECTIONS, and the builder helpers). In ProgressPage.tsx replace the `mockProgressData.dailyQuests` template (line 188) with a small colocated DAILY_QUEST_TEMPLATES const, then delete components/progress/progressMockData.ts entirely. This is the original fix and it is correct.

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
  git commit -m "fix(dead-code): L92 — Dead mock-data modules left in the live tree (progressMockDa"
Then report: the diff summary + the command output. Do NOT push.
```

---

### L93 — Unmounted legacy home-screen components (CurrentlyReadingCard, TodaySessionCard, FlowPointsSection, etc.) — plus 5 more dead home cards and a dead hook the finding missed
`severity: low` · `effort: small` · `files: app/book/home/page.tsx:4, app/book/home/components/CurrentlyReadingCard.tsx, app/book/home/components/TodaySessionCard.tsx, app/book/home/components/FlowPointsSection.tsx, app/book/home/components/StarterRecommendationCard.tsx, app/book/home/components/CommitmentFollowUpCard.tsx, app/book/home/components/BookMiniCard.tsx, app/book/home/components/EventBanner.tsx, app/book/home/components/GoalMeter.tsx, app/book/home/components/JourneyBanner.tsx, app/book/home/components/PartnerProgressCard.tsx, app/book/home/components/ReviewDueWidget.tsx, app/book/hooks/useBookState.ts, app/book/data/mockProgress.ts`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app
(Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

BRANCH: Work on "audit/prod-readiness-2026-06-14". First run:
  git rev-parse --abbrev-ref HEAD
If it is not "audit/prod-readiness-2026-06-14" and not a "fix/L93" worktree branched off it, run:
  git checkout audit/prod-readiness-2026-06-14
Do NOT create unrelated branches and do NOT switch away mid-task.

FILES: app/book/home/page.tsx:4, app/book/home/components/CurrentlyReadingCard.tsx, app/book/home/components/TodaySessionCard.tsx, app/book/home/components/FlowPointsSection.tsx, app/book/home/components/StarterRecommendationCard.tsx, app/book/home/components/CommitmentFollowUpCard.tsx, app/book/home/components/BookMiniCard.tsx, app/book/home/components/EventBanner.tsx, app/book/home/components/GoalMeter.tsx, app/book/home/components/JourneyBanner.tsx, app/book/home/components/PartnerProgressCard.tsx, app/book/home/components/ReviewDueWidget.tsx, app/book/hooks/useBookState.ts, app/book/data/mockProgress.ts

PROBLEM:
Confirmed: app/book/home/page.tsx is now just `redirect("/dashboard")`. The 6 named cards (CurrentlyReadingCard, TodaySessionCard, FlowPointsSection, StarterRecommendationCard, CommitmentFollowUpCard, BookMiniCard) have ZERO importers anywhere. The only files actually imported from home/components by live pages are TopNav, InfoModal, SearchBox, and GlobalSearchPanel. EXPANSION beyond the original finding: 5 MORE files in that directory are also fully unimported — EventBanner, GoalMeter, JourneyBanner, PartnerProgressCard, ReviewDueWidget (all 0 importers). Additionally app/book/hooks/useBookState.ts (0 consumers) and the misleadingly-named app/book/data/mockProgress.ts are dead-by-transitive-closure: mockProgress.ts is consumed only by the dead home cards (type imports) and by the dead useBookState.ts. mockProgress.ts itself is NOT fabricated render data — it is a set of legitimate builders (buildRecentBooks/buildTodaySessionTasks/buildBadges) derived from the real catalog — so it's a naming/dead-code issue, not a data-authenticity lie.

WHY IT MATTERS:
No runtime impact. Maintenance cost and audit confusion: a wider dead surface than the finding stated. Someone fixing a 'home screen' bug edits never-rendered files; the misleading mockProgress.ts name makes the tree read as if mock data is live.

REQUIRED FIX:
After confirming importer sets (done), delete all 11 unimported home cards: CurrentlyReadingCard, TodaySessionCard, FlowPointsSection, StarterRecommendationCard, CommitmentFollowUpCard, BookMiniCard, EventBanner, GoalMeter, JourneyBanner, PartnerProgressCard, ReviewDueWidget. Keep TopNav/InfoModal/SearchBox/GlobalSearchPanel (live pages import them). Also delete app/book/hooks/useBookState.ts (0 consumers). Then app/book/data/mockProgress.ts loses all its consumers — either delete it too, or if any of its builders are wanted later, at minimum rename it (it is not mock data) and relocate it out of the dead path. Verify a typecheck after deletion since the dead cards type-import from mockProgress.

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
  git commit -m "fix(dead-code): L93 — Unmounted legacy home-screen components (CurrentlyReadingCar"
Then report: the diff summary + the command output. Do NOT push.
```

---

### P9 — prose-legal class applied to every legal article is a no-op (not defined in CSS and not a valid typography-plugin variant)
`severity: polish` · `effort: small` · `files: app/legal/privacy/page.tsx:10, app/legal/terms/page.tsx:10, app/legal/cookies/page.tsx:10, app/legal/refund/page.tsx:12, app/legal/copyright/page.tsx:15, app/legal/data-rights/page.tsx:12, app/globals.css:3`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app
(Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

BRANCH: Work on "audit/prod-readiness-2026-06-14". First run:
  git rev-parse --abbrev-ref HEAD
If it is not "audit/prod-readiness-2026-06-14" and not a "fix/P9" worktree branched off it, run:
  git checkout audit/prod-readiness-2026-06-14
Do NOT create unrelated branches and do NOT switch away mid-task.

FILES: app/legal/privacy/page.tsx:10, app/legal/terms/page.tsx:10, app/legal/cookies/page.tsx:10, app/legal/refund/page.tsx:12, app/legal/copyright/page.tsx:15, app/legal/data-rights/page.tsx:12, app/globals.css:3

PROBLEM:
All six legal pages wrap content in <article className="prose-legal">. CORRECTION/refinement to the original: the @tailwindcss/typography plugin IS installed and loaded (globals.css:3 '@plugin "@tailwindcss/typography"'), so 'prose' variants are available — but 'prose-legal' is not one of them. The plugin ships prose, prose-{sm,lg,xl,2xl}, prose-invert, and color themes (prose-gray, prose-cyan, etc.); 'legal' is not a registered modifier and no custom variant or .prose-legal rule is defined anywhere in CSS (grep across all .css files returns no definition). So prose-legal is an unmatched/no-op class; the pages render correctly only because every element carries inline style overrides.

WHY IT MATTERS:
No functional impact (inline styles cover rendering). Maintainability only: a future dev may assume prose-legal controls legal typography and edit it expecting an effect, or assume the typography plugin is styling these pages when it is not.

REQUIRED FIX:
Either register a real 'legal' prose variant / define a .prose-legal rule that centralizes legal typography (then thin out the repeated inline style props across the six pages), or remove the unused className from the six legal articles. Centralizing is the better long-term move given the heavy inline-style duplication.

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
  git commit -m "fix(dead-code): P9 — prose-legal class applied to every legal article is a no-op "
Then report: the diff summary + the command output. Do NOT push.
```

---

### P14 — Dead exported mock constants and helpers in libraryData.ts (MOCK_BOOKS / MOCK_USER_STATS / MOCK_WEEKLY_CHALLENGE / getBookById etc.)
`severity: polish` · `effort: small` · `files: components/library/libraryData.ts:86, components/library/libraryData.ts:101, components/library/libraryData.ts:1159, components/library/libraryData.ts:1207, components/library/libraryData.ts:1150, components/library/libraryData.ts:1155`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app
(Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

BRANCH: Work on "audit/prod-readiness-2026-06-14". First run:
  git rev-parse --abbrev-ref HEAD
If it is not "audit/prod-readiness-2026-06-14" and not a "fix/P14" worktree branched off it, run:
  git checkout audit/prod-readiness-2026-06-14
Do NOT create unrelated branches and do NOT switch away mid-task.

FILES: components/library/libraryData.ts:86, components/library/libraryData.ts:101, components/library/libraryData.ts:1159, components/library/libraryData.ts:1207, components/library/libraryData.ts:1150, components/library/libraryData.ts:1155

PROBLEM:
libraryData.ts exports MOCK_USER_STATS (86), MOCK_WEEKLY_CHALLENGE (101), MOCK_BOOKS (1159) and the MOCK_BOOKS-backed helpers getBookById/getBooksById/getInProgressBooks/getCompletedBooks/getNotStartedBooks (1207-1228). A precise import scan confirms NONE of these symbols are imported from libraryData anywhere in live code. IMPORTANT NUANCE the original finding got wrong: a naive grep shows 'MOCK_BOOKS' in LibraryContext/CompletedShelf/BookCard, but those are all in COMMENTS ('no static MOCK_BOOKS', 'not static MOCK_BOOKS'); and the getBookById grep hits are a DIFFERENT same-named function from app/onboarding/data/books.ts and app/book/data/booksCatalog.ts, not libraryData's. The live library builds books from the dashboard catalog via toLibraryBooks/buildLibraryBookFromCatalog. The live WeeklyChallenge component imports only the WeeklyChallenge TYPE (not MOCK_WEEKLY_CHALLENGE) and is fed real data (WEEKLY_CHALLENGE editorial nudge).

WHY IT MATTERS:
Dead mock data lingering in a file that also holds live logic invites accidental reuse of fabricated data (the exact regression this surface was rebuilt to remove) and adds noise. No runtime effect.

REQUIRED FIX:
Remove MOCK_USER_STATS, MOCK_WEEKLY_CHALLENGE, MOCK_BOOKS, the helper exports (getBookById/getBooksById/getInProgressBooks/getCompletedBooks/getNotStartedBooks), and their now-orphaned supporting chain BASE_LIBRARY_BOOKS / BASE_LIBRARY_BOOK_IDS / GENERATED_LIBRARY_BOOKS (verified used only to build MOCK_BOOKS, no external importers). Keep the WeeklyChallenge TYPE, buildLibraryBookFromCatalog, formatReadingTime, getProgressColor/getProgressMicrocopy, CURATED_SECTIONS, SORT_OPTIONS and the still-used pure helpers. Confirm a typecheck/build after removal.

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
  git commit -m "fix(dead-code): P14 — Dead exported mock constants and helpers in libraryData.ts ("
Then report: the diff summary + the command output. Do NOT push.
```

---

### P17 — saveQuizHistory and saveNotes privacy fields exist in the schema but have no Settings UI control
`severity: polish` · `effort: small` · `files: app/book/hooks/useBookPreferences.ts:135-136,244-245,738-744, app/book/settings/BookSettingsClient.tsx:1352-1393`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app
(Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

BRANCH: Work on "audit/prod-readiness-2026-06-14". First run:
  git rev-parse --abbrev-ref HEAD
If it is not "audit/prod-readiness-2026-06-14" and not a "fix/P17" worktree branched off it, run:
  git checkout audit/prod-readiness-2026-06-14
Do NOT create unrelated branches and do NOT switch away mid-task.

FILES: app/book/hooks/useBookPreferences.ts:135-136,244-245,738-744, app/book/settings/BookSettingsClient.tsx:1352-1393

PROBLEM:
BookPreferencesState.privacy declares saveQuizHistory and saveNotes (hook:135-136) with defaults true (244-245) and they are parsed/persisted (738-744), but the Settings Privacy subsection (BookSettingsClient.tsx:1352-1393) renders toggles only for analyticsParticipation, personalizedRecommendations, and saveReadingHistory. A filtered grep (excluding build artifacts) finds saveQuizHistory/saveNotes only in the hook — no UI control and no server gating anywhere (contrast saveReadingHistory, which IS gated in dashboard/reading-sessions/export routes).

WHY IT MATTERS:
Dead schema surface that implies privacy controls which don't exist; maintainability/clarity cost and a latent compliance gap if these were meant to be user consents. Polish severity is right.

REQUIRED FIX:
Either add the corresponding toggles to the Privacy subsection AND gate the relevant storage server-side (mirror how saveReadingHistory is honored in reading-sessions/dashboard/export routes), or remove saveQuizHistory/saveNotes from BookPreferencesState, its defaults, and parseStored until the behavior is implemented. Pair this with the personalizedRecommendations no-op decision.

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
  git commit -m "fix(dead-code): P17 — saveQuizHistory and saveNotes privacy fields exist in the sc"
Then report: the diff summary + the command output. Do NOT push.
```
