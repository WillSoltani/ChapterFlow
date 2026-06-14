# How to dispatch the fix prompts

**TL;DR — my recommendation:** run agents **in parallel, but isolated** (one git worktree per agent so they can't clobber each other), do the **launch blockers first**, and never run two agents that touch the **same file** at the same time (see Collision groups). If you don't want to manage worktrees, run them **sequentially** in this one checkout — slower but zero setup and zero collisions.

All fixes land on **`audit/prod-readiness-2026-06-14`** (the branch this repo is on now — it already holds the report + these prompts). Every prompt is self-contained and ends by committing to that branch, so the agent can't drift to the wrong one.

---

## Option A — Parallel + isolated (recommended, fastest)

Each agent gets its own git worktree on a `fix/<ID>` branch off `audit/prod-readiness-2026-06-14`, works, commits, and you merge it back. Worktrees share the same repo but have independent working directories, so parallel agents never touch each other's files.

```bash
# 1) spawn an isolated worktree for one task (run from the repo root)
./docs/fix-prompts/new-agent-worktree.sh X1      # -> creates ../cf-fix-X1 on branch fix/X1

# 2) point an agent at that directory and paste the X1 prompt
#    (e.g. open a new agent/session with cwd = ../cf-fix-X1)

# 3) when the agent has committed and you've reviewed it, fold it in:
git checkout audit/prod-readiness-2026-06-14
git merge --no-ff fix/X1
git worktree remove ../cf-fix-X1 && git branch -d fix/X1
```

Spawn as many as you want concurrently (X1, X2, C1, H1, …). Just honor the Collision groups below.

## Option B — Sequential (simplest, zero setup)

Stay in this checkout on `audit/prod-readiness-2026-06-14`. Paste **one** prompt, let the agent implement + verify + commit, **then** paste the next. Safe because only one agent edits the tree at a time. No merging needed.

> Do **not** run multiple agents in parallel in this single checkout — they will overwrite each other's edits and git index. Parallel requires Option A (separate worktrees) or separate clones.

---

## Run order

1. **Launch blockers first** (in the order in §2 of the report): `X1`, `X2`, `C1`, `H4`, `H3`, `H12`, `H15`, `H14`, `H1`, `H2`, `H19`, `H20`, `H22`, `H23`, `H26`, `H27`, `H28`.
   - `X1` and `X2` are trivial/small and high-impact — start there.
2. Then the rest of the **high** items, then **medium**, then **low/polish**.
3. After each batch, run `npm run typecheck && npm run test && npm run build` on `audit/prod-readiness-2026-06-14` before merging the next.

## Collision groups (never run these concurrently)

Each line is a file touched by more than one finding — assign all of its IDs to **one** agent (it can fix them together), or do them sequentially. Everything not listed here touches a unique file and is safe to parallelize.

- `app/app/api/book/_lib/repo.ts` → `L13`, `L14`, `H2`, `L19`, `L20`, `L27`, `M17`, `H12`, `M21`, `M22`, `L45`, `L49`
- `middleware.ts` → `X1`, `L6`, `L7`, `L40`, `M27`, `L59`, `M30`, `H25`, `H28`
- `app/app/api/book/billing/webhook/route.ts` → `X1`, `H1`, `L10`, `L11`, `L12`, `L13`, `L14`, `L15`, `H8`
- `app/globals.css` → `P9`, `L70`, `P16`, `M45`, `M46`, `M47`, `L84`, `P22`
- `app/book/settings/BookSettingsClient.tsx` → `H26`, `M40`, `M41`, `L77`, `L78`, `L79`, `P17`, `M44`
- `infra/lib/chapterflow-frontend-stack.ts` → `X2`, `H9`, `M13`, `H13`, `M23`, `M24`, `L52`
- `infra/lib/chapterflow-backend-stack.ts` → `M6`, `H14`, `H15`, `H16`, `M24`, `M25`, `L52`
- `app/book/hooks/useBookPreferences.ts` → `H21`, `H27`, `M41`, `P17`, `M44`, `L84`, `L85`
- `components/progress/ProgressPage.tsx` → `H5`, `H6`, `L69`, `M36`, `L70`, `L92`
- `app/auth/callback/route.ts` → `M1`, `L3`, `L5`, `L6`, `H20`
- `app/app/api/book/books/[bookId]/chapters/[chapterNumber]/audio/route.ts` → `M7`, `P2`, `M19`, `M20`, `L42`
- `app/app/api/book/books/[bookId]/ask/route.ts` → `L23`, `P2`, `H10`, `M19`, `L43`
- `app/book/_lib/flow-points-economy.ts` → `L25`, `L28`, `P4`, `L63`, `M38`
- `app/app/api/book/me/onboarding/complete/route.ts` → `P4`, `M28`, `H21`, `L63`, `L64`
- `app/legal/privacy/page.tsx` → `H19`, `M28`, `M29`, `L58`, `P9`
- `app/app/api/book/_lib/content-service.ts` → `X2`, `H3`, `H4`, `L21`
- `app/auth/refresh/route.ts` → `L2`, `L3`, `L5`, `H20`
- `app/app/api/book/_lib/keys.ts` → `L14`, `L34`, `L47`, `L51`
- `app/app/api/book/_lib/streak-repo.ts` → `M8`, `L24`, `P3`, `L79`
- `app/book/home/components/PartnerProgressCard.tsx` → `H7`, `M12`, `M34`, `L93`
- `components/workspace/WorkspacePage.tsx` → `H7`, `L29`, `L70`, `L72`
- `app/app/api/book/me/profile/route.ts` → `P4`, `M28`, `L63`, `H26`
- `app/book/profile/BookProfileClient.tsx` → `M37`, `L74`, `H29`, `M53`
- `app/app/api/book/_lib/http.ts` → `X2`, `M10`, `L50`
- `components/auth/AuthErrorBanner.tsx` → `L4`, `L60`, `L61`
- `components/auth/TokenExpiryGuard.tsx` → `L4`, `L6`, `L61`
- `app/app/api/book/admin/metrics/billing/route.ts` → `H1`, `L10`, `L15`
- `lib/pricing.ts` → `L15`, `M26`, `M29`
- `app/app/api/book/me/export/route.ts` → `H2`, `M3`, `H19`
- `app/app/api/book/me/settings/route.ts` → `L19`, `H26`, `H27`
- `app/book/home/components/ReviewDueWidget.tsx` → `H6`, `M34`, `L93`
- `app/book/home/page.tsx` → `H7`, `M34`, `L93`
- `app/book/home/components/JourneyBanner.tsx` → `L29`, `M34`, `L93`
- `app/book/home/components/CommitmentFollowUpCard.tsx` → `L29`, `M34`, `L93`
- `app/app/api/book/_lib/pair-repo.ts` → `M12`, `L30`, `L36`
- `app/app/api/book/admin/segments/[segmentId]/notify/route.ts` → `H9`, `M14`, `P6`
- `open-next.config.ts` → `H9`, `M13`, `M49`
- `app/app/api/book/_lib/admin-metrics.ts` → `M14`, `M15`, `P18`
- `infra/lambda/reading-reminder-cron.ts` → `H14`, `H16`, `H26`
- `app/legal/data-rights/page.tsx` → `H19`, `L59`, `P9`
- `app/legal/cookies/page.tsx` → `H20`, `M29`, `P9`
- `app/legal/terms/page.tsx` → `M28`, `M29`, `P9`
- `app/book/library/[bookId]/chapter/[chapterId]/ChapterReaderClient.tsx` → `H21`, `M32`, `L66`
- `components/library/LibraryPage.tsx` → `M35`, `L70`, `P13`
- `components/library/libraryData.ts` → `L71`, `P14`, `L92`
- `app/book/admin/_clients/SegmentBuilderClient.tsx` → `M42`, `M43`, `P20`
- `next.config.ts` → `H28`, `L88`, `L89`
- `.github/workflows/ci.yml` → `M51`, `L89`, `L91`
- `app/app/api/book/_lib/account-guard.ts` → `X2`, `L18`
- `app/auth/login/route.ts` → `M1`, `L1`
- `components/auth/AuthScreen.tsx` → `L4`, `L61`
- `app/app/api/_lib/auth.ts` → `L5`, `L8`
- `app/auth/_lib/return-to.ts` → `L7`, `M30`
- `app/signup/page.tsx` → `P1`, `L64`
- `app/book/admin/_clients/BillingClient.tsx` → `H1`, `L81`
- `app/app/api/book/_lib/economy-health.ts` → `M2`, `M14`
- `app/app/api/book/admin/reconciliation/route.ts` → `M2`, `M13`
- `app/app/api/book/_lib/trial-ending-email.ts` → `L12`, `L17`
- `app/app/api/book/_lib/quiz-session.ts` → `H3`, `L21`
- `app/book/library/[bookId]/chapter/[chapterId]/components/QuizPanel.tsx` → `H3`, `M48`
- `app/book/library/hooks/useBookProgress.ts` → `H4`, `H23`
- `app/app/api/book/_lib/depth-routing.ts` → `M6`, `M18`
- `app/app/api/book/me/books/[bookId]/depth-recommendation/route.ts` → `M6`, `M18`
- `app/app/api/book/_lib/library-catalog.ts` → `L20`, `L67`
- `components/progress/DailyQuests.tsx` → `H5`, `L69`
- `components/progress/progressMockData.ts` → `H5`, `L92`
- `app/app/api/book/me/streak/route.ts` → `L24`, `P3`
- `app/app/api/book/me/reviews/[cardId]/route.ts` → `M9`, `L28`
- `app/app/api/book/me/badges/route.ts` → `L27`, `M38`
- `app/app/api/book/_lib/ensure-book-started.ts` → `H8`, `M11`
- `app/book/home/components/TopNav.tsx` → `L29`, `H25`
- `app/app/api/book/_lib/events-repo.ts` → `L32`, `L33`
- `app/app/api/book/me/devices/register/route.ts` → `L34`, `L35`
- `app/ref/[code]/route.ts` → `P4`, `L63`
- `app/app/api/book/admin/metrics/notifications/route.ts` → `M14`, `P6`
- `app/app/api/book/admin/metrics/content/route.ts` → `M14`, `P18`
- `app/app/api/book/_lib/analytics-repo.ts` → `M15`, `M16`
- `app/app/api/book/admin/insight-points/adjust/route.ts` → `M16`, `P5`
- `app/app/api/_lib/aws.ts` → `H12`, `L90`
- `app/app/api/_lib/server-env.ts` → `L44`, `L91`
- `app/app/api/book/_lib/cloudwatch-metrics.ts` → `L46`, `P7`
- `app/app/api/book/_lib/ingestion.ts` → `L48`, `L49`
- `infra/lambda/lib/email-compliance.ts` → `L51`, `H15`
- `infra/lambda/lib/streak-at-risk.ts` → `H14`, `L79`
- `.github/workflows/_deploy-infra.yml` → `H15`, `M25`
- `app/_lib/chapterflow-brand.ts` → `C1`, `M30`
- `app/sitemap.ts` → `C1`, `M27`
- `app/robots.ts` → `C1`, `M27`
- `app/layout.tsx` → `C1`, `M47`
- `app/books/page.tsx` → `C1`, `P8`
- `components/sections/Pricing.tsx` → `M26`, `L53`
- `app/contact/page.tsx` → `L54`, `L59`
- `lib/legal-entity.ts` → `M28`, `M29`
- `app/onboarding/components/OnboardingFlow.tsx` → `H21`, `L62`
- `app/book/hooks/useOnboardingState.ts` → `H21`, `M36`
- `app/book/library/[bookId]/chapter/[chapterId]/hooks/useChapterState.ts` → `H22`, `M32`
- `app/book/library/[bookId]/BookDetailClient.tsx` → `H23`, `L95`
- `app/book/library/[bookId]/chapter/[chapterId]/components/ExamplesList.tsx` → `M33`, `L66`
- `components/ui/Dialog.tsx` → `L66`, `L86`
- `app/book/home/components/StarterRecommendationCard.tsx` → `M34`, `L93`
- `app/book/home/components/CurrentlyReadingCard.tsx` → `M34`, `L93`
- `app/book/home/components/EventBanner.tsx` → `M34`, `L93`
- `app/book/home/components/FlowPointsSection.tsx` → `M34`, `L93`
- `app/book/home/components/BookMiniCard.tsx` → `M34`, `L93`
- `app/book/home/components/TodaySessionCard.tsx` → `M34`, `L93`
- `app/book/home/components/GoalMeter.tsx` → `M34`, `L93`
- `components/library/dashboardToLibraryUi.ts` → `P13`, `L94`
- `app/book/profile/components/ProfilePrimitives.tsx` → `M37`, `H29`
- `app/rewards/RewardsPageClient.tsx` → `M39`, `P15`
- `app/book/admin/_components/csv.ts` → `M42`, `P20`
- `app/book/admin/_clients/UsersClient.tsx` → `M42`, `L83`
- `package.json` → `M49`, `L87`
- `app/book/hooks/useBookAnalytics.ts` → `M52`, `M53`

## Verifying the whole branch when you're done

```bash
git checkout audit/prod-readiness-2026-06-14
npm install            # deps moved on main since the audit
npm run typecheck && npm run test && npm run build
npx eslint app components lib middleware.ts next.config.ts
```
