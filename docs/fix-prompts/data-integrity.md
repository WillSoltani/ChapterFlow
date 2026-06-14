# Fix prompts — Data Integrity (real-vs-fabricated, validation, money)

_40 items (18 high, 11 medium, 10 low, 1 polish). ChapterFlow production-readiness remediation — branch `main` (e90937368)._

## Shared context (every prompt below assumes this)

**App:** ChapterFlow — a Next.js 16 (App Router, React 19) "book learning" web app. **These prompts target the `main` branch** (commit e90937368, the freshly-merged post-UI-overhaul-integration state). Backend = DynamoDB single-table (`app/app/api/book/_lib/repo.ts`) behind Cognito JWT auth (`requireUser`/`requireActiveBookUser`/`requireAdminUser`), Stripe billing, S3 content, CDK infra (`infra/`). API routes live under `app/app/api/book/**` (URL `/app/api/book/**`). Error envelope = `withBookApiErrors`+`BookApiError`.

**Rules for every fix agent:**
1. Work on `main`. Change ONLY the cited files + direct deps. Do NOT touch `scripts/`, `book-packages/`, `content/`, `state/`, `graphify-out/`.
2. Match surrounding code style; reuse existing helpers (auth guards, `BookApiError`, repo functions, `keys.ts`, `lib/catalog-stats.ts`, `lib/pricing.ts`).
3. Never make a security/economy/paywall decision from client-supplied data — the server is the source of truth.
4. When done: run `npm install` (if deps stale), `npm run typecheck`, `npm run test`, and `npx eslint <changed files>`; report results + a short diff summary. Add/adjust a unit test for any security/money/correctness fix.
5. Line numbers were accurate at audit time — re-read each file and confirm before editing (other agents may be editing in parallel).

---

### H1 — Admin "Real MRR/ARR" sums annual subscription amounts as if monthly — inflates MRR ~12x per annual subscriber
`severity: high` · `effort: small` · `files: app/app/api/book/admin/metrics/billing/route.ts:55-58, app/app/api/book/admin/metrics/billing/route.ts:168-169, app/app/api/book/admin/metrics/billing/route.ts:76-84, app/app/api/book/admin/metrics/billing/route.ts:142-155, app/app/api/book/billing/webhook/route.ts:221-238, app/book/admin/_clients/BillingClient.tsx:109-119`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/book/admin/metrics/billing/route.ts:55-58, app/app/api/book/admin/metrics/billing/route.ts:168-169, app/app/api/book/admin/metrics/billing/route.ts:76-84, app/app/api/book/admin/metrics/billing/route.ts:142-155, app/app/api/book/billing/webhook/route.ts:221-238, app/book/admin/_clients/BillingClient.tsx:109-119

PROBLEM:
realMrr = stripePro.reduce((sum,e)=>sum + (e.subscriptionAmountCents ?? 0),0) (billing/route.ts:55-58), realArr = mrrCents*12 (line 169). subscriptionAmountCents is stored straight from the subscription price's unit_amount (webhook route.ts:221 firstItem?.unit_amount, written at route.ts:236). For the monthly plan that is one month (799¢). For annual it is the FULL YEAR: lib/pricing.ts ANNUAL_TOTAL_AMOUNT=71.88 (7188¢) and annualUpfrontAmount=59.99 (5999¢). Summing those into a 'monthly' recurring figure counts each annual subscriber as ~12 months in MRR and ~144x in ARR. The normalizer already exists — subscriptionInterval is captured on the webhook (route.ts:223,238), typed on EntitlementSnapshot (admin-metrics.ts:14) and projected/mapped by scanAllEntitlements (admin-metrics.ts:387,409) — but the MRR calc never reads it. The same un-normalized total feeds revenueByCountry (route.ts:80) and topPayingUsers (route.ts:143-152).

WHY IT MATTERS:
The headline KPI tiles on the admin Billing dashboard (Real MRR, Real ARR, labeled 'actual Stripe revenue' in BillingClient.tsx:110-119) and revenue-by-country are materially wrong the moment any customer is on an annual plan — and annual/annual_upfront are offered at checkout (checkout-session/route.ts:46). Runway/pricing/country decisions made off these numbers will be based on a ~12x-overstated MRR for the annual cohort; ARR is doubly wrong.

REQUIRED FIX:
In billing/route.ts derive a per-entitlement monthly amount before summing: const monthly = e.subscriptionInterval === 'year' ? Math.round((e.subscriptionAmountCents ?? 0)/12) : (e.subscriptionAmountCents ?? 0). Sum monthly into mrrCents and use the same normalized value for byCountry (line 80) AND topPayingUsers (lines 143-152) so the 'top payers' ranking isn't dominated by annual subscribers. realArr = mrrCents*12 then holds. For legacy rows missing subscriptionInterval, fall back to treating as monthly and push a coverage warning. Note that the webhook only stores `interval` ('month'/'year'), not interval_count — if any multi-month interval_count is ever used it would need /interval_count too; capture interval_count on the webhook for robustness. Also update the BillingClient footnote (lines 283-288, which currently says 'sum of actual Stripe subscription amounts' with no normalization mention) to state amounts are interval-normalized to a monthly figure.

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

### H2 — GDPR/CCPA data export silently truncates for heavy users — unpaginated DynamoDB Queries
`severity: high` · `effort: medium` · `files: app/app/api/book/me/export/route.ts:91-109, app/app/api/book/_lib/repo.ts:2730-2761 (listUserChapterStates), app/app/api/book/_lib/repo.ts:2804-2832 (listReadingDays), app/app/api/book/_lib/repo.ts:853-867 (listAllUserProgress), app/app/api/book/_lib/repo.ts:2649-2700 (listAllUserBookStates), app/app/api/book/_lib/repo.ts:2834+ (listBadgeAwards), app/app/api/book/_lib/repo.ts:2504+ (listSavedBooks)`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/book/me/export/route.ts:91-109, app/app/api/book/_lib/repo.ts:2730-2761 (listUserChapterStates), app/app/api/book/_lib/repo.ts:2804-2832 (listReadingDays), app/app/api/book/_lib/repo.ts:853-867 (listAllUserProgress), app/app/api/book/_lib/repo.ts:2649-2700 (listAllUserBookStates), app/app/api/book/_lib/repo.ts:2834+ (listBadgeAwards), app/app/api/book/_lib/repo.ts:2504+ (listSavedBooks)

PROBLEM:
The export route fans out to listUserChapterStates, listReadingDays, listAllUserProgress, listAllUserBookStates, listSavedBooks and listBadgeAwards. I confirmed every one of these issues a single QueryCommand and returns only res.Items — none reads or loops on LastEvaluatedKey/ExclusiveStartKey. DynamoDB caps a Query at 1MB, so a heavy user (one READINGDAY# item per active day over years, or hundreds of chapter states with notes + quizAnswers + quizResult) is silently cut off at the first page with no error. This is presented to users as 'Download all your data' (app/legal/privacy/page.tsx:103) and the docstring claims 'all user data'.

WHY IT MATTERS:
Power users receive an incomplete data export with no indication anything is missing — a GDPR Art.15 / CCPA right-of-access completeness failure and a credibility/legal risk for a product that advertises full export. The contrast is sharp: account-erasure.ts DOES paginate (queryAllItems), so a user can be fully ERASED but only partially EXPORTED.

REQUIRED FIX:
Add a paginate-until-LastEvaluatedKey loop to each list* function used by the export (mirror queryAllItems in account-erasure.ts:52-71). Cleanest: refactor the six list functions to loop on ExclusiveStartKey (they are also used by other read paths that would benefit), or add export-specific paginated variants. At minimum surface a truncation flag in the payload if a page boundary is hit so the user/operator knows to request a full copy. Note: the analytics-events portion (getUserEvents, capped at 200 by design) is a deliberate cap, not this bug — leave it, but the main-table lists must be fixed.

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

### H3 — Quiz answer key (correctChoiceId/correctIndex) leaked to client on every quiz fetch
`severity: high` · `effort: medium` · `files: app/app/api/book/_lib/quiz-session.ts:414-435, app/app/api/book/books/[bookId]/chapters/[chapterNumber]/quiz/route.ts:127-145, app/app/api/book/_lib/content-service.ts:99-144, app/book/library/[bookId]/chapter/[chapterId]/components/QuizPanel.tsx:225,607, app/book/library/[bookId]/chapter/[chapterId]/hooks/useQuizSession.ts:209`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/book/_lib/quiz-session.ts:414-435, app/app/api/book/books/[bookId]/chapters/[chapterNumber]/quiz/route.ts:127-145, app/app/api/book/_lib/content-service.ts:99-144, app/book/library/[bookId]/chapter/[chapterId]/components/QuizPanel.tsx:225,607, app/book/library/[bookId]/chapter/[chapterId]/hooks/useQuizSession.ts:209

PROBLEM:
buildQuizClientSession returns correctChoiceId (line 428) and correctIndex (line 429) for every question UNCONDITIONALLY, while selectedChoiceId/isCorrect are gated on status (lines 424-433). The GET quiz route returns this verbatim. So on a fresh, unanswered quiz any authenticated user can read payload.quiz.questions[*].correctChoiceId from the network tab and answer perfectly. Server grading is authoritative (submit/route.ts:316-333 re-derives the key server-side via buildQuizAttemptQuestions and does NOT trust client correctness), so this is not a server bypass — but it lets a user always pass, claim the first-attempt and perfect-score IP bonuses (flow-points-economy.ts: firstAttempt vs retry differential + perfectBonusIP), and skip the learning loop. IP converts to Pro, so it farms the economy. sanitizeQuizForClient (content-service.ts:99-144) strips the key but is confirmed dead (zero callers anywhere).

WHY IT MATTERS:
Quiz integrity is null for any user who opens dev tools; pass-gated progression and the IP→Pro economy are trivially gamed, and quiz analytics/scores become meaningless. For a learning product this guts the core value prop and the economy's monetization safety.

REQUIRED FIX:
The author's proposed fix (gate correctChoiceId/correctIndex the same way selectedChoiceId is gated) is INCOMPLETE and would break the product: the live client (QuizPanel.handleAnswer line 607, the showAsCorrect rendering line 225, useQuizSession local fallback line 209, and buildCarryForwardAnswers in quizScoring.ts) structurally depends on having correctChoiceId client-side to show immediate per-question correct/incorrect feedback with retries BEFORE submission. Pick one of: (a) move per-answer feedback grading server-side (an answer-check round trip that returns only isCorrect, never the key) so the key never reaches the client; or (b) accept that inline feedback inherently reveals the key and instead remove the gameable economy incentive — stop awarding the first-attempt and perfectBonusIP purely on raw client-submitted score, or only award them when the chapter's reading-time / interaction signals are plausible. At minimum, decouple chapter-unlock and IP bonuses from being claimable on a single read-the-key submission. Either way, delete the dead sanitizeQuizForClient or make it the one canonical client projection.

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

### H4 — Chapter unlock gating bypassable via client-trusted state-sync PATCH
`severity: high` · `effort: medium` · `files: app/app/api/book/me/books/[bookId]/state/route.ts:154-235, app/book/library/hooks/useBookProgress.ts:240-255, app/app/api/book/_lib/content-service.ts:61,89`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/book/me/books/[bookId]/state/route.ts:154-235, app/book/library/hooks/useBookProgress.ts:240-255, app/app/api/book/_lib/content-service.ts:61,89

PROBLEM:
PATCH /me/books/[bookId]/state reads client-supplied unlockedChapterIds (line 155) and completedChapterIds (line 154), unions them with existing server state (mergedUnlocked also folds in mergedCompleted, lines 159-167), maps them through the publicly-fetchable manifest to numbers, and writes unlockedThroughChapterNumber = Math.max(...unlockedNumbers) (line 224) and completedChapters = completedNumbers (line 227) into BOOK_PROGRESS via upsertUserProgress. There is NO check that any unlock was earned by passing a quiz. The live reader persists its progress object to localStorage (useBookProgress.ts:242) and auto-PATCHes it on every change (lines 246-255), so a user who edits localStorage (or POSTs directly) with all chapterIds in unlockedChapterIds/completedChapterIds immediately unlocks and 'completes' every chapter. Content/quiz reads gate purely on progress.unlockedThroughChapterNumber (content-service.ts:61 and :89), so this fully bypasses the buildProgressAfterQuizPass gate. By contrast the legitimate unlock route (me/chapters/[bookId]/[chapterNumber]/unlock/route.ts:42-54) correctly requires quizState.passed.

WHY IT MATTERS:
The central 'pass the quiz to unlock the next chapter' mechanic can be skipped entirely by any user. Completion/score data is corrupted (completedChapters and bestScoreByChapter written without quizzes), polluting analytics, achievement eligibility, and book-completion signals.

REQUIRED FIX:
Make this PATCH read-only for gating fields: never raise unlockedThroughChapterNumber or add completedChapters from the request body — derive those exclusively from quiz-pass writes (recordQuizAttemptOutcome / buildProgressAfterQuizPass) and the quiz-gated unlock route. Allow the PATCH to update only non-gating UI fields (currentChapterId/lastReadChapterId/lastOpenedAt). If optimistic client unlock is desired, validate each claimed unlock against getUserQuizState(chapter).passed before persisting. Note the per-chapter PATCH at me/books/[bookId]/chapters/[chapterNumber]/state/route.ts is fine — it stores opaque chapter state and does not touch progress.

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

### H5 — Live progress page renders fabricated daily-quest reward ("+75 IP for all") that is never awarded server-side
`severity: high` · `effort: medium` · `files: components/progress/ProgressPage.tsx:269, components/progress/ProgressPage.tsx:586-592, components/progress/DailyQuests.tsx:80-93, components/progress/progressMockData.ts:54-83, app/book/progress/page.tsx`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: components/progress/ProgressPage.tsx:269, components/progress/ProgressPage.tsx:586-592, components/progress/DailyQuests.tsx:80-93, components/progress/progressMockData.ts:54-83, app/book/progress/page.tsx

PROBLEM:
The live /book/progress route (app/book/progress/page.tsx -> ProgressPage) builds Daily Quests from mockProgressData.dailyQuests and computes questBonusFP = wiredQuests.filter(q => !q.completed).length * 25 (ProgressPage.tsx:269). With 3 quests this is the advertised 75 (progressMockData.ts:83 questBonusFP:75). DailyQuests.tsx:80 renders '🎁 +{bonusIP} IP for all' and DailyQuests.tsx:93 renders '🎉 All quests complete! +{bonusIP} IP earned'. Completing q3 only calls setShowReviewSession(true) (ProgressPage.tsx:590) which opens the localStorage ReviewSession and awards nothing.

WHY IT MATTERS:
On a primary engagement surface users are repeatedly shown 'earned' IP that never reaches their real balance (served truthfully by /me/flow-points), a visible economy lie that erodes trust.

REQUIRED FIX:
Either (a) drop the bonusIP prop and the '+IP for all'/'+IP earned' copy from DailyQuests.tsx so quests are habit nudges with no currency promise, or (b) build a real POST /me/quests/claim that validates each quest server-side and calls awardFlowPoints with a per-day idempotent sourceId, then drive questBonusFP/completion from that response. Option (a) is the cheap honest fix.

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

### H6 — Live progress page Knowledge-Review and streak data come from localStorage, diverging from the real server FSRS/streak systems
`severity: high` · `effort: large` · `files: components/progress/ProgressPage.tsx:25-33, components/progress/ProgressPage.tsx:250-251, components/progress/ProgressPage.tsx:270-276, components/progress/ProgressPage.tsx:685-693, app/book/_lib/spaced-repetition.ts:5-7, app/book/home/components/ReviewDueWidget.tsx:6,62`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: components/progress/ProgressPage.tsx:25-33, components/progress/ProgressPage.tsx:250-251, components/progress/ProgressPage.tsx:270-276, components/progress/ProgressPage.tsx:685-693, app/book/_lib/spaced-repetition.ts:5-7, app/book/home/components/ReviewDueWidget.tsx:6,62

PROBLEM:
The progress page's reviews block (overdueCount/dueTodayCount/upcomingThisWeekCount/totalConceptsLearned/forecast, ProgressPage.tsx:270-276) is sourced from app/book/_lib/spaced-repetition.ts, a device-local localStorage SRS (STORAGE_KEY 'book-accelerator:spaced-rep:v1'), and 'Start review' / q3 open the localStorage ReviewSession (ProgressPage.tsx:685-693). The real spaced-repetition system is the server FSRS store (fsrs-repo.ts, /me/reviews, seeded in submit/route.ts:579-604 via initializeCardsForChapter) which the home page uses via ReviewSessionFSRS + /me/reviews?mode=stats (ReviewDueWidget.tsx:6,21,62). The two systems share no data. freezesEquipped/freezesAvailable are hardcoded to 0 (ProgressPage.tsx:250-251) while the server tracks streakShieldsHeld (streak-repo.ts).

WHY IT MATTERS:
Two competing, unsynchronized SRS/streak systems show contradictory numbers across two core pages: doing reviews in the home FSRS widget never changes the progress page counts (and vice versa), and progress-page SRS is per-device localStorage that vanishes on a new device/browser. Launch-visible 'better implementation is live, older client is dead/stale' divergence.

REQUIRED FIX:
Point KnowledgeReview at the server FSRS API: replace the spaced-repetition.ts count helpers with GET /app/api/book/me/reviews?mode=stats (and ?mode=all for forecast) data, swap the localStorage <ReviewSession> for <ReviewSessionFSRS> (already used by ReviewDueWidget), and wire freezesAvailable from GET /me/streak (shieldsHeld). Note: the progress page's streak counts (currentDays/bestDays/consistency) come from useBookAnalytics, not from /me/streak, so those are a separate divergence to reconcile. Then delete the now-dead spaced-repetition.ts / reading-streaks.ts / ReviewSession.tsx once no live route imports them.

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

### H8 — Referral escalation tier rewards (4,600 IP + exclusive frames/themes/badges) are never awarded — checkReferralEscalation is dead code
`severity: high` · `effort: medium` · `files: app/app/api/book/_lib/referral-escalation.ts:73, app/app/api/book/_lib/ensure-book-started.ts:291-351, app/app/api/book/billing/webhook/route.ts:52-64`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/book/_lib/referral-escalation.ts:73, app/app/api/book/_lib/ensure-book-started.ts:291-351, app/app/api/book/billing/webhook/route.ts:52-64

PROBLEM:
checkReferralEscalation (awards 3/5/10/25-activation milestones: 300/600/1200/2500 IP + mentor-frame/meridian-theme/advocate-badge) and ESCALATION_MILESTONES are exported but called from nowhere — grep across app+components returns only their own file. The referral activation path in ensure-book-started.ts:338 calls markReferralActivationRewarded (which ADDs activatedInvites at flow-points-repo.ts:827) but never invokes the escalation check. The billing webhook documents that the removed per-conversion reward was 'redistributed into escalation tier bonuses (§6.3)' and maybeAwardReferralProConversion is now an explicit no-op (webhook/route.ts:56-64) — but the escalation code meant to receive that value is unwired. Inviters who hit milestones get zero.

WHY IT MATTERS:
The headline referral incentive (and the stated replacement for the removed Pro-conversion reward) silently pays out nothing. If the program advertises these tiers it is false advertising / churn risk among top advocates; otherwise a large block of dead, misleadingly-commented code.

REQUIRED FIX:
In ensure-book-started.ts, inside the fraud.allowed branch AFTER the awaited markReferralActivationRewarded (so activatedInvites is incremented first), call checkReferralEscalation(tableName, referralClaim.inviterUserId, inviterPlan) and persist the returned exclusiveReward cosmetics where the cosmetics/inventory system lives (IP is awarded internally via awardFlowPoints). Resolve inviterPlan from the inviter's entitlement (FREE/PRO). Add a test that a 3rd activation grants the 300 IP mentor-frame milestone. Note: checkReferralEscalation reads activatedInvites from the profile, so ordering after the increment is required.

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

### H12 — DocumentClient convertEmptyValues:true rewrites empty Sets (and empty strings) to NULL, breaking entitlement set-initialization
`severity: high` · `effort: small` · `files: app/app/api/_lib/aws.ts:20-22, app/app/api/book/_lib/repo.ts:1833 (+1845 :emptySet), app/app/api/book/_lib/repo.ts:1952/1961, app/app/api/book/_lib/repo.ts:1988/1995, app/app/api/book/_lib/repo.ts:2039, app/app/api/book/_lib/repo.ts:3029/3047, app/app/api/book/_lib/repo.ts:708 (ADD unlockedBookIds :bookSet)`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/_lib/aws.ts:20-22, app/app/api/book/_lib/repo.ts:1833 (+1845 :emptySet), app/app/api/book/_lib/repo.ts:1952/1961, app/app/api/book/_lib/repo.ts:1988/1995, app/app/api/book/_lib/repo.ts:2039, app/app/api/book/_lib/repo.ts:3029/3047, app/app/api/book/_lib/repo.ts:708 (ADD unlockedBookIds :bookSet)

PROBLEM:
ddbDoc is built with marshallOptions {removeUndefinedValues:true, convertEmptyValues:true}. I empirically ran the installed @aws-sdk/util-dynamodb 3.996.2: marshall({s:'',set:new Set()},{convertEmptyValues:true}) yields {s:{NULL:true},set:{NULL:true}}. Every entitlement-creation path that runs `unlockedBookIds = if_not_exists(unlockedBookIds, :emptySet)` with `:emptySet = new Set<string>()` (updateUserEntitlementFromStripe 1833, attachStripeCustomerToEntitlement 1952, attachStripeCustomerIfAbsent 1988, adminUpdateUserEntitlement 2039, redeemLicenseKey TransactWrite 3029) therefore writes unlockedBookIds as a NULL attribute, not an empty SS. reserveBookEntitlement (line 708) then runs `ADD unlockedBookIds :bookSet`; ADD accepts only Number/Set operands, so applied to an existing NULL attribute DynamoDB throws ValidationException. redeemLicenseKey/attach* create the entitlement item with no precondition that it already exists, so a Stripe/license/admin-provisioned user who has never reserved a book gets unlockedBookIds=NULL and 500s on their first reserve (even an active-license PRO user, who is allowed to reserve, hits it). The ConditionExpression branch `attribute_not_exists(unlockedBookIds)` does NOT save it because a NULL attribute still EXISTS.

WHY IT MATTERS:
Pro/license/admin-provisioned users get a 500 (server_error) when reserving their first book. Plus broad latent drift: 83 `|| ''` read-fallbacks in repo.ts paper over '' fields that round-trip to NULL.

REQUIRED FIX:
Two changes that MUST land together (order matters): (1) remove `convertEmptyValues:true` from aws.ts marshallOptions; (2) stop writing empty sets — with the flag off, marshall(new Set()) THROWS ('Pass a non-empty set, or options.convertEmptyValues=true'), so leaving the `:emptySet = new Set()` initializers in place would break every entitlement path immediately at marshal time. Drop the `unlockedBookIds = if_not_exists(unlockedBookIds, :emptySet)` clause entirely from all 5 sites and let the first `ADD unlockedBookIds :bookSet` create the SS (parseStringArray already returns [] for a missing attribute, so reads are safe). For existing prod items already written as NULL, add a one-time backfill (REMOVE unlockedBookIds where it is NULL) or have reserve REMOVE-then-ADD. Empty strings then store natively as S:''.

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

### H14 — App table never enables TTL though cron+app write ttl
`severity: high` · `effort: trivial` · `files: infra/lib/chapterflow-backend-stack.ts:130-140, infra/lambda/lib/welcome-back-nudge.ts:60-61, infra/lambda/lib/welcome-back-nudge.ts:101, infra/lambda/lib/streak-at-risk.ts:157-162, infra/lambda/lib/weekly-digest.ts:117,152, infra/lambda/reading-reminder-cron.ts:169`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: infra/lib/chapterflow-backend-stack.ts:130-140, infra/lambda/lib/welcome-back-nudge.ts:60-61, infra/lambda/lib/welcome-back-nudge.ts:101, infra/lambda/lib/streak-at-risk.ts:157-162, infra/lambda/lib/weekly-digest.ts:117,152, infra/lambda/reading-reminder-cron.ts:169

PROBLEM:
ChapterFlowAppTable (backend-stack.ts:130-140) is defined with NO timeToLiveAttribute. grep confirms timeToLiveAttribute exists only in the frontend stack's cache table (revalidatedAt). Meanwhile every writer stamps a numeric `ttl` field: reading-reminder-cron.ts:169 (REMINDER_SENT#<date>), streak-at-risk.ts:157-162 (NUDGE_SENT#streak_at_risk#<date>), weekly-digest.ts:117/152 (NUDGE_SENT#weekly_digest#<weekKey>), welcome-back-nudge.ts:101/129 (NUDGE_SENT#welcome_back), and app/app/api/book/_lib/pair-repo.ts:23,212. Critically, welcome-back uses a NON-rotating dedup key `NUDGE_SENT#welcome_back` (line 61) that relies entirely on TTL expiry (30-day) to ever allow a re-send.

WHY IT MATTERS:
With TTL disabled, the welcome-back dedup record never expires, so the welcome-back email/nudge fires exactly ONCE per user for their entire lifetime (the 30-day re-engagement loop is dead). Date-rotating dedup markers (reminder/streak/digest) plus the NOTIF# items and pair TTL records also never get reaped → unbounded partition bloat on every active user, growing RCU/storage cost and item-collection sizes forever. IaC drift: the table behavior silently diverges from what the handlers assume.

REQUIRED FIX:
Add `timeToLiveAttribute: 'ttl'` to the ChapterFlowAppTable definition (backend-stack.ts:130). Verify no other entity stores a `ttl` attribute it does NOT want auto-deleted before enabling (a one-time scan of attribute usage). Trivial one-line CDK change; enabling TTL on an existing prod table is a non-destructive online operation.

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

### H19 — Privacy & Data-Rights pages claim analytics/location are excluded from self-serve export, but the export route returns them
`severity: high` · `effort: small` · `files: app/legal/data-rights/page.tsx:41-46, app/legal/privacy/page.tsx:103, app/app/api/book/me/export/route.ts:103-108, app/app/api/book/me/export/route.ts:130-131, app/app/api/book/me/export/route.ts:196-201, app/app/api/book/me/export/route.ts:466-478`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/legal/data-rights/page.tsx:41-46, app/legal/privacy/page.tsx:103, app/app/api/book/me/export/route.ts:103-108, app/app/api/book/me/export/route.ts:130-131, app/app/api/book/me/export/route.ts:196-201, app/app/api/book/me/export/route.ts:466-478

PROBLEM:
The Data-Rights page (data-rights/page.tsx:43-45) states usage analytics and approximate-location telemetry 'are not part of the self-serve export — to request a copy, email us', and the Privacy page Your-Controls bullet (privacy/page.tsx:103) describes the export without analytics. But export/route.ts fetches getUserSnapshot + getUserEvents(...,200) (lines 103-108) and embeds them under data.analytics in the JSON format (lines 198-201) and renders a full 'Usage Analytics' Markdown section that explicitly says 'includes approximate location and device' (lines 466-477). The route also carries a self-contradictory banner string data.analyticsAndLocation (lines 130-131) asserting the data is NOT included while the same response object includes it. CSV is the only format that omits analytics, so behavior is inconsistent across formats too.

WHY IT MATTERS:
A published privacy/data-rights representation materially understates what the self-serve export discloses: users and regulators are told the access/export right behaves one way while it behaves another. Misstates a GDPR/CCPA access-right surface, risks a misrepresentation-of-data-practices claim, and confuses UX (users email support for data they already downloaded).

REQUIRED FIX:
Pick one source of truth. Since the export already includes analytics in JSON/MD, update data-rights/page.tsx:43-45 and the privacy Data-export bullet (privacy/page.tsx:103) to state analytics + approximate-location ARE included in JSON/Markdown exports, and delete the stale banner string at export/route.ts:130-131 (and remove analyticsAndLocation from the ExportData type at line 40). For format parity, either add an analytics section to exportToCsv() or have the policy note CSV omits it. (Alternative, if exclusion is the intended product behavior: drop the analytics fetch at lines 103-108 and the JSON/MD embeds at lines 196-201 and 465-478.)

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

### H20 — Cookie Policy omits the persistent refresh_token cookie and cf_acq_* acquisition cookies; states auth_expires_at duration is 1 hour when its cookie lifetime is 30 days
`severity: high` · `effort: small` · `files: app/legal/cookies/page.tsx:48-67, app/auth/callback/route.ts:19, app/auth/callback/route.ts:146-162, app/auth/callback/route.ts:176-190, app/auth/refresh/route.ts:11, app/auth/refresh/route.ts:133-143`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/legal/cookies/page.tsx:48-67, app/auth/callback/route.ts:19, app/auth/callback/route.ts:146-162, app/auth/callback/route.ts:176-190, app/auth/refresh/route.ts:11, app/auth/refresh/route.ts:133-143

PROBLEM:
The essential-cookies table (cookies/page.tsx:48-67) lists only id_token, access_token, auth_expires_at, and cf_device. The auth callback sets a persistent httpOnly 'refresh_token' cookie with maxAge REFRESH_TOKEN_MAX_AGE = 30*24*60*60 = 30 days (callback/route.ts:19, 147-150; also re-set on rotation in refresh/route.ts:133-138) — undisclosed. auth_expires_at is listed with Duration '1 hour' (cookies:61) but its maxAge is REFRESH_TOKEN_MAX_AGE (30 days) at callback/route.ts:158-162 (the cookie VALUE is the access-token expiry, but its lifetime spans the refresh window). The callback also sets cf_acq_ref/cf_acq_us/cf_acq_um/cf_acq_uc acquisition cookies (callback/route.ts:176-190, 30-min lifetime, capturing referer + UTM source/medium/campaign) which are undisclosed and sit in tension with the policy's 'no cross-site tracking'/'no advertising' framing (they are first-party attribution cookies, but should still be listed).

WHY IT MATTERS:
A live product publishing a cookie inventory that omits a long-lived 30-day auth cookie plus attribution cookies, and misstates a cookie's lifetime by 30x, is an inaccurate cookie disclosure (ePrivacy/CASL/CCPA cookie-transparency exposure) and undercuts the 'minimal, fully-disclosed cookies' positioning.

REQUIRED FIX:
In cookies/page.tsx essential-cookies table add a 'refresh_token' row (Secure, httpOnly, Duration 30 days, purpose: silent session renewal) and correct the auth_expires_at Duration from '1 hour' to '30 days' (optionally note the stored value is the ~1h access-token expiry while the cookie persists for the refresh window). Add cf_acq_ref/us/um/uc (first-party, ~30 minutes, attributes signup source) to the functional-cookies table or the transient sign-in note. Consider sourcing the 30-day duration from REFRESH_TOKEN_MAX_AGE so it cannot drift.

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

### H21 — Onboarding tone/chapter-order choices never reach the reader (legacy localStorage key only gets setupComplete; reader seeds from different field names / settings.extended)
`severity: high` · `effort: medium` · `files: app/onboarding/components/OnboardingFlow.tsx:91-103, app/book/hooks/useBookPreferences.ts:793-819, app/book/hooks/useBookPreferences.ts:367-379, app/book/hooks/useBookPreferences.ts:825-836, app/book/hooks/useOnboardingState.ts:69,258-279, app/book/library/[bookId]/chapter/[chapterId]/ChapterReaderClient.tsx:148-164, app/app/api/book/me/onboarding/complete/route.ts:130-159`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/onboarding/components/OnboardingFlow.tsx:91-103, app/book/hooks/useBookPreferences.ts:793-819, app/book/hooks/useBookPreferences.ts:367-379, app/book/hooks/useBookPreferences.ts:825-836, app/book/hooks/useOnboardingState.ts:69,258-279, app/book/library/[bookId]/chapter/[chapterId]/ChapterReaderClient.tsx:148-164, app/app/api/book/me/onboarding/complete/route.ts:130-159

PROBLEM:
The new /onboarding flow collects tone(gentle/direct/competitive), dailyGoal, chapterOrder, interests, starterShelf. handleFinish POSTs them to /app/api/book/me/onboarding/complete which saves settings.onboarding AND hoists tone/dailyGoal/chapterOrder to top-level settings (route.ts:130-159). It also writes the legacy key book-accelerator:onboarding:v5 — but ONLY {...legacy, setupComplete, completedAt} (OnboardingFlow.tsx:95-102), never the field names the reader seeds from. The reader's tone/learning personalization comes from useBookPreferences().extended.contentTone/learningMode (ChapterReaderClient.tsx:149-150), which is seeded from the legacy key's ob.motivationStyle/ob.learningStyle/ob.quizIntensity (useBookPreferences.ts:799-809) OR from server settings.extended via parseStored (line 379 reads parsed.extended, NOT settings.onboarding.tone / hoisted settings.tone). Chapter-start order comes from useOnboardingState().chapterStartMode (ChapterReaderClient.tsx:164), which reads only the legacy key's chapterStartMode and never the server chapterOrder. So tone and chapter-start order silently fall back to defaults. IMPORTANT CORRECTION to the original finding: it overstates 'nothing in the reader path reads server settings.onboarding' — useBookAnalytics.ts:461-480 (dashboard recommendations) and useStarterPrescription.ts:44-48 DO read settings.onboarding for interests/starterShelf/motivation/dailyGoal/starterPrescription, so book recommendations DO get personalized. quizStyle isn't even consumed in ChapterReaderClient (grep returns nothing), so the quiz-intensity claim is weak. The real, confirmed loss is reader TONE and CHAPTER-START ORDER.

WHY IT MATTERS:
The onboarding promise that tone 'sets how every chapter talks to you' and that chapter order is honored is not delivered: a user who picks 'gentle' or 'competitive' and 'scenarios first' still gets the reader's default contentTone and balanced chapter-start order. Book-recommendation personalization (which books surface) does work via server settings, so the gap is narrower than 'entire onboarding discarded' but still defeats a headline claim. Also affects fresh devices since server-side tone/order are never read by the reader hooks either.

REQUIRED FIX:
Best fix: hydrate the reader from the already-persisted server settings. In useBookPreferences' /me/settings effect (lines 825-836) and/or parseStored, map settings.onboarding.tone (or hoisted settings.tone) -> extended.contentTone, settings.onboarding.dailyGoal -> dailyGoalPreset, and have useOnboardingState map settings.onboarding.chapterOrder ('scenarios_first'->'scenarios','summary_first'->'summary') -> chapterStartMode when localStorage lacks it. Cheaper stopgap: in OnboardingFlow.handleFinish, when stamping the legacy key also write motivationStyle=onboarding.tone, chapterStartMode=(onboarding.chapterOrder==='scenarios_first'?'scenarios':'summary'/'balanced'), dailyGoalMinutes=onboarding.dailyGoal, selectedCategories=onboarding.interests, selectedBookIds=normalized starterShelf — matching the field names the reader's seed code reads. Prefer the server-hydration path so it also covers fresh devices.

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

### H22 — Chapter notes (and other reader state) silently overwritten by server state on load — data loss
`severity: high` · `effort: small` · `files: app/book/library/[bookId]/chapter/[chapterId]/hooks/useChapterState.ts:265-287, app/book/library/[bookId]/chapter/[chapterId]/hooks/useChapterState.ts:276, app/book/library/[bookId]/chapter/[chapterId]/hooks/useChapterState.ts:132`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/book/library/[bookId]/chapter/[chapterId]/hooks/useChapterState.ts:265-287, app/book/library/[bookId]/chapter/[chapterId]/hooks/useChapterState.ts:276, app/book/library/[bookId]/chapter/[chapterId]/hooks/useChapterState.ts:132

PROBLEM:
On mount useChapterState hydrates from localStorage (incl. notes) then GETs the chapter state route. The server payload.state.state is run through parseStored(), which fills EVERY field with a default — notes default is the empty string (line 132) — and the result is applied as setState((prev) => ({ ...prev, ...parsed })) (line 276). Because parsed.notes is always a string (server's value OR ""), it unconditionally overwrites prev.notes. There is no per-field merge: bookmarkedTakeaways is replaced (not unioned), and notes is replaced. Contrast useBookProgress.ts:187-228, which carefully unions completedChapterIds/unlockedChapterIds and Math.max-es scores. The clobber is gated by `if (!payload.state?.state) return` (line 271), so it only fires when the server holds SOME persisted chapter-state object whose notes are empty/older — exactly the 'earlier device / debounced PATCH never landed' scenario.

WHY IT MATTERS:
Readers lose handwritten chapter notes (and bookmarked takeaways) when the local copy is newer than the server copy — a trust-destroying, irreversible loss of explicitly user-authored content on a core reader surface.

REQUIRED FIX:
In the GET-merge effect, merge per-field instead of spreading: never let an empty server notes replace a non-empty local notes (keep prev.notes when parsed.notes is empty), union bookmarkedTakeaways, and only adopt server values for fields the local copy lacks. Best: persist a notesUpdatedAt on both sides and last-write-wins on it (mirror the lastOpenedAt comparison useBookProgress already uses). At minimum guard notes.

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

### H23 — Reset progress only mutates local state and can be resurrected by the server union-merge
`severity: high` · `effort: medium` · `files: app/book/library/[bookId]/BookDetailClient.tsx:544-548, app/book/library/hooks/useBookProgress.ts:394-396, app/book/library/hooks/useBookProgress.ts:187-228, app/book/library/hooks/useBookProgress.ts:246-255`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/book/library/[bookId]/BookDetailClient.tsx:544-548, app/book/library/hooks/useBookProgress.ts:394-396, app/book/library/hooks/useBookProgress.ts:187-228, app/book/library/hooks/useBookProgress.ts:246-255

PROBLEM:
ResetProgressModal.onConfirm is synchronous: resetProgress(); setShowResetModal(false). resetProgress (useBookProgress.ts:394-396) only does setProgress(initialProgress(chapters)) — no server call. There is NO dedicated reset endpoint (confirmed: no DELETE/reset route under app/app/api/book/me/books; only saved/ and pairs/ have DELETE). The reset relies on the generic 200ms-debounced PATCH (lines 246-255). Problem (1): the effect cleanup clears the timeout (line 254), so unmount/navigation within 200ms means the empty state is never PATCHed and the server keeps old IDs. Problem (2): on the NEXT load the GET-merge unions local+server completedChapterIds/unlockedChapterIds (lines 188-196) and Math.max-es scores (lines 197-200), so any completion still present on the server (or re-pushed by a stale reader tab / another device) is merged back, undoing the reset. Note: once the empty PATCH DOES land, a single-device sequential reload won't resurrect — resurrection requires another source still carrying completion, which the finding correctly states.

WHY IT MATTERS:
'Reset progress' looks like it works (UI clears) but completed chapters/scores can silently return on reload, another tab, or another device, making the destructive action unreliable and eroding trust.

REQUIRED FIX:
Add an explicit server reset endpoint (e.g. POST /me/books/[bookId]/state/reset) that hard-overwrites server progress to initial; make onConfirm async, await it (with spinner/failure UI) before closing the modal — do not depend on the debounced merge-PATCH. Also clear the per-chapter reader state and any phase-completion localStorage keys so chapters can't re-unlock via the union merge / a stale tab.

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

### H24 — Event detail fabricates "Eligible Books" titles by title-casing the bookId slug instead of using the real catalog title
`severity: high` · `effort: trivial` · `files: app/book/events/[eventId]/EventDetailClient.tsx:264-279`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/book/events/[eventId]/EventDetailClient.tsx:264-279

PROBLEM:
The 'Eligible Books' list maps over event.books and derives the display name with bookId.split("-").map(w => w.charAt(0).toUpperCase()+w.slice(1)).join(" "). EventDefinition.books is typed string[] (types.ts:1076) — i.e. bookId slugs — so this prints title-cased slugs (e.g. 'seven-powers' -> 'Seven Powers', 'you-cant-hurt-me' -> 'You Cant Hurt Me') with dropped apostrophes, wrong numerals, and missing subtitles. getBookById is already exported from app/book/data/booksCatalog.ts and the link already targets /book/library/{bookId}, so the real title is one call away.

WHY IT MATTERS:
Every event detail page shows mis-spelled / mis-formatted book names on a primary user-facing surface — looks broken and untrustworthy on a live product.

REQUIRED FIX:
Import getBookById from @/app/book/data/booksCatalog and render {getBookById(bookId)?.title ?? bookId} (optionally the author/cover too). Remove the slug title-casing entirely. EventsClient.tsx only renders event.books.length so it is unaffected.

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

### H26 — Reminder time & timezone chosen in Settings never reach the reminder cron — all reminders fire at default 20:00 UTC
`severity: high` · `effort: small` · `files: app/book/settings/BookSettingsClient.tsx:1210-1214, app/book/settings/BookSettingsClient.tsx:222-251, infra/lambda/reading-reminder-cron.ts:82-88, app/app/api/book/me/settings/route.ts:37, app/app/api/book/me/profile/route.ts:215-218`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/book/settings/BookSettingsClient.tsx:1210-1214, app/book/settings/BookSettingsClient.tsx:222-251, infra/lambda/reading-reminder-cron.ts:82-88, app/app/api/book/me/settings/route.ts:37, app/app/api/book/me/profile/route.ts:215-218

PROBLEM:
The 'Reminder time' TimePicker onChange calls only setReminderTime(v) (onboarding state). That value is persisted to /app/api/book/me/profile as profile.reminderTime (BookSettingsClient.tsx:222-251 PATCHes /me/profile with the onboarding snapshot; profile/route.ts:215-218 stores it). It is NEVER written into settings.notifications. The reading-reminder cron Lambda reads the per-user send time exclusively from settings.notifications.reminderTimeLocal and settings.notifications.reminderTimezone (cron:82-83), falling back to '20:00' / 'UTC'. A repo-wide grep confirms reminderTimeLocal/reminderTimezone appear only in the type def (types.ts:558-559), the settings allow-list (settings/route.ts:37), and the Lambda — never written by any app route. No lambda reads profile.reminderTime either. Net: the readingReminderEnabled toggle works, but the chosen time/timezone are invisible to the cron.

WHY IT MATTERS:
Every user who changes the reminder time receives it at the wrong hour and wrong timezone — the cron's resolveHour() fires only when the local hour in 'UTC' equals 20, i.e. 20:00 UTC (1pm PDT / 4pm EDT) for everyone. A shipped, user-configurable notification feature is silently broken, undermining the habit loop and looking broken to anyone who explicitly set a time.

REQUIRED FIX:
Write the canonical fields into settings.notifications. In the TimePicker onChange at BookSettingsClient.tsx:1212, in addition to setReminderTime(v), call patchSection('notifications', { reminderTimeLocal: v, reminderTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone }) — both keys are already on the settings allow-list and in the notifications schema-validator, and v is already HH:MM which matches what the cron's resolveHour expects. Also set them once at hydration if missing so existing users get a sane timezone. (Reading from profile.reminderTime in the Lambda is an alternative, but it lacks a stored timezone, so writing both into settings.notifications is cleaner.)

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

### H27 — Cross-device settings clobber: server settings only applied when localStorage is empty; stale device silently overwrites newer settings
`severity: high` · `effort: medium` · `files: app/book/hooks/useBookPreferences.ts:825-844, app/book/hooks/useBookPreferences.ts:927-940, app/app/api/book/me/settings/route.ts:72-130`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/book/hooks/useBookPreferences.ts:825-844, app/book/hooks/useBookPreferences.ts:927-940, app/app/api/book/me/settings/route.ts:72-130

PROBLEM:
useBookPreferences fetches /me/settings on mount but applies the server copy only when localStorageHadData.current is false (hook:833) — i.e. only on a brand-new device. On any device with existing localStorage, server data is fetched and discarded. The save effect (hook:927-940) then PATCHes the FULL local state ({ settings: state }) 500ms after any change. The server's mergeSettings (settings/route.ts:55-70, deep recursive) overwrites every leaf the client sends, so a stale full snapshot clobbers newer server values for sections never touched on the stale device. The GET already returns updatedAt (settings/route.ts:80) but the client never reads it; there is no version/timestamp reconciliation.

WHY IT MATTERS:
Settings changed on Device B are silently lost the next time the user edits anything on Device A (which holds stale localStorage) — a confusing, hard-to-reproduce data-loss bug for any multi-device user (phone + laptop is common for a reading product). Preferences mysteriously revert.

REQUIRED FIX:
Reconcile on load instead of all-or-nothing. Store a local last-synced timestamp alongside STORAGE_KEY; in the GET handler compare payload.updatedAt against it and, when the server item is newer, apply it (set skipNextServerSave.current = true before setState) even if localStorage is non-empty. Better long-term: diff against the last-synced snapshot and PATCH only changed sections so untouched sections can never clobber the server. At minimum, stop unconditionally discarding server data whenever localStorage exists.

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

### H29 — Profile page hardcodes a stale, overstated catalog size ("93+ more books", "21 categories") that contradicts the live 68-book / 13-category catalog
`severity: high` · `effort: trivial` · `files: app/book/profile/BookProfileClient.tsx:718, app/book/profile/BookProfileClient.tsx:719, app/book/profile/BookProfileClient.tsx:947, app/book/profile/components/ProfilePrimitives.tsx:1450, app/book/profile/components/ProfilePrimitives.tsx:1458, lib/catalog-stats.ts:22`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/book/profile/BookProfileClient.tsx:718, app/book/profile/BookProfileClient.tsx:719, app/book/profile/BookProfileClient.tsx:947, app/book/profile/components/ProfilePrimitives.tsx:1450, app/book/profile/components/ProfilePrimitives.tsx:1458, lib/catalog-stats.ts:22

PROBLEM:
The profile page (mounted live at /book/profile via app/book/profile/page.tsx) hardcodes two catalog claims. The Pro upgrade copy fed to every free user reads "Unlock 93+ more books..." in BOTH branches of `upgradeMessage` (BookProfileClient.tsx:718 and :719). The CategoryMap is passed `totalCategories={21}` (line 947), which ProfilePrimitives.tsx renders verbatim as "{explored.length} of {totalCategories}" (lines 1450, 1458) and uses for a `remaining` count. The live catalog is 68 books and 13 distinct `category` values (I counted booksCatalog.metadata.json directly: 68 entries, 13 unique categories; BOOKS_CATALOG has no published-filter so CATALOG_BOOK_COUNT === 68). So a free user is promised ~25+ books that don't exist, and a reader who explores all 13 categories can only ever reach "13 of 21". The catalog-stats module was built specifically to retire this hardcoding (its header even calls out the old "93 more books" lie), and the landing surface (components/sections/SocialProof.tsx:8,44) already consumes it — but the profile page was never migrated.

WHY IT MATTERS:
Overstatement of inventory shown to a logged-in user (false book-count advertising), plus a permanently-incomplete progress metric ("X of 21" can never reach 21, even at 100% category exploration). The numbers silently drift further from reality as the catalog changes because they're disconnected from the derived source.

REQUIRED FIX:
In BookProfileClient.tsx import { CATALOG_BOOK_COUNT, CATALOG_CATEGORY_COUNT } from "@/lib/catalog-stats". Replace `totalCategories={21}` (line 947) with `totalCategories={CATALOG_CATEGORY_COUNT}`. For the two upgrade strings (718-719) prefer a value relative to what the user can access — e.g. `Unlock ${Math.max(0, CATALOG_BOOK_COUNT - unlockedCount)} more books...` where unlockedCount is the user's accessible-book count (the page already knows plan/entitlement) — or, if that count isn't readily available, use the conservative CATALOG_BOOK_COUNT_DISPLAY ("60+ more books"). NOTE on the original fix: the live book count is 68, not 67. Also note the catalog-stats header *mentions* a CI guard but none actually exists in the app test surface (only lib/book-covers.test.ts exists; the catalog tests live under scripts/ which is the pipeline) — so the suggested "CI assertion" must be newly written (a small test asserting no app/components file matches a hardcoded books/categories count regex), not merely referenced.

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

### M3 — Export contains analytics data but tells the user it doesn't (false disclaimer)
`severity: medium` · `effort: trivial` · `files: app/app/api/book/me/export/route.ts:130-131, app/app/api/book/me/export/route.ts:196-201, app/app/api/book/me/export/route.ts:466-478`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/book/me/export/route.ts:130-131, app/app/api/book/me/export/route.ts:196-201, app/app/api/book/me/export/route.ts:466-478

PROBLEM:
analyticsAndLocation (lines 130-131) reads 'Usage analytics and approximate-location telemetry ... are not included in this self-serve export. To request a copy, contact support@chapterflow.ca.' But the same response object unconditionally includes the analytics field populated from getUserSnapshot (approximate location/device) and the last 200 events from getUserEvents (fetched at 103-108, assembled at 196-201). The markdown formatter even renders a 'Usage Analytics' section (466-478) explicitly labeled 'includes approximate location and device'. The disclaimer is stale copy that directly contradicts the data in the file.

WHY IT MATTERS:
A privacy-conscious user reading the disclaimer would wrongly believe their analytics/location is withheld and would email support for data they already received — a misleading statement embedded in a legal-access artifact. Low data-leak risk (the data is the user's own); it is a trust/accuracy defect on a compliance surface.

REQUIRED FIX:
Replace the analyticsAndLocation string at export/route.ts:130-131 with accurate copy (e.g. 'Usage analytics and approximate-location telemetry are included below under "analytics" when you have enabled Share Usage Analytics.') or remove the field entirely now that the analytics section is genuinely included. Trivial.

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

### M12 — PartnerProgressCard shows no partner progress or name — feature delivers nothing it promises
`severity: medium` · `effort: medium` · `files: app/book/home/components/PartnerProgressCard.tsx:213-247, app/app/api/book/me/pairs/route.ts:10-18, app/app/api/book/_lib/pair-repo.ts:143-160`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/book/home/components/PartnerProgressCard.tsx:213-247, app/app/api/book/me/pairs/route.ts:10-18, app/app/api/book/_lib/pair-repo.ts:143-160

PROBLEM:
GET /me/pairs returns only { pair } — the bare BookUserPairItem (partnerId sub, status, pairedAt) from getUserActivePair (pair-repo.ts:143-160). The 'has partner' UI (PartnerProgressCard.tsx:213-247) renders only 'Reading Partner / Paired since {date}' plus a Nudge button and an end-partnership X — no partner name, streak, current book, or activity. grep for partnerProgress/partnerName/getPartner/partnerDisplayName returns nothing; no endpoint fetches a partner's profile or progress. The accountability premise (see how your partner is doing) is unfulfilled.

WHY IT MATTERS:
Even if wired into the live UI, the card is hollow: a user can nudge but never see whether the partner is active, reading, or abandoned. Defeats the stated purpose of reading partners and reads as broken/abandoned.

REQUIRED FIX:
Add a partner-summary endpoint (extend GET /me/pairs to also return the partner's displayName from their profile and a minimal progress summary — current streak, books-in-progress count, last-active recency — exposing only non-PII fields, mirroring the gift-preview displayName-only pattern). Render those in PartnerProgressCard's 'has partner' state, gated behind partner consent or limited to coarse activity signals. (Lower priority than wiring the card in at all — see finding #1.)

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

### M16 — Admin insight-point adjustment marks the target user as active (lastActiveAt = now), corrupting retention/active metrics
`severity: medium` · `effort: small` · `files: app/app/api/book/admin/insight-points/adjust/route.ts:135-148, app/app/api/book/_lib/analytics-repo.ts:790-840 (analyticsTrackFlowPointsTransaction)`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/book/admin/insight-points/adjust/route.ts:135-148, app/app/api/book/_lib/analytics-repo.ts:790-840 (analyticsTrackFlowPointsTransaction)

PROBLEM:
The manual IP adjustment fires analyticsTrackFlowPointsTransaction with sourceType 'admin_adjustment'. That function unconditionally sets '#lastActiveAt = :now' on the user's SNAPSHOT and writes a flow_points_earned/flow_points_spent EVENT under the userId. So an admin granting/deducting points to a dormant user stamps them active 'now' and emits an activity event. This pollutes DAU/active counts (activeUsersByPlan reads plan-updatedAt; overview proActive metrics), retention cohorts (buildCohortRetention reads readingDays/firstSeenAt), and any event-count-driven metric.

WHY IT MATTERS:
Engagement/retention KPIs are inflated by admin back-office actions; a comped or refunded user looks active, skewing the metrics the founder reports and decides on.

REQUIRED FIX:
For admin-originated transactions, skip the lastActiveAt SET and the activity-counting event. Add an `adminOriginated` (or sourceType-based) flag to analyticsTrackFlowPointsTransaction so 'admin_adjustment' updates the points balance/ledger only, not lastActiveAt, and routes the event to a non-engagement event type (or omits it). Verify engagement queries exclude that event type. Note: updatedAt is the plan-GSI sort key, so be careful — bumping updatedAt also affects activeUsersByPlan/listRecentUsersByPlan; ideally leave updatedAt unbumped too for admin transactions, or accept that only lastActiveAt-based metrics need fixing.

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

### M17 — Manual entitlement override (plan/proStatus/freeBookSlots) writes no audit trail
`severity: medium` · `effort: small` · `files: app/app/api/book/admin/users/[userId]/entitlements/route.ts:59-103, app/app/api/book/_lib/repo.ts:2005-2060 (adminUpdateUserEntitlement)`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/book/admin/users/[userId]/entitlements/route.ts:59-103, app/app/api/book/_lib/repo.ts:2005-2060 (adminUpdateUserEntitlement)

PROBLEM:
PATCH /admin/users/[userId]/entitlements lets an admin grant PRO, set proStatus, or set freeBookSlots (money-equivalent comps). adminUpdateUserEntitlement just UpdateItems the entitlement and returns — no ADMIN_AUDIT record, no required reason, and it never sets proSource. By contrast account-status records changedBy='admin:<sub>', insight-points/adjust writes a ledger entry with adminUserId+reason, and segment notify calls writeAuditEntry. A comp PRO grant here is invisible in the audit log AND, lacking proSource='stripe', is excluded from stripe-source MRR filters while still counting in proTotal — untraceable in both audit and revenue reconciliation.

WHY IT MATTERS:
Comped/granted entitlements are untraceable and unauditable — a problem for fraud investigation, billing reconciliation, and accountability with multiple operators or a compromised account.

REQUIRED FIX:
In the entitlements PATCH handler, require a reason string (mirror insight-points/adjust's 10-char minimum) and write an audit record (action 'entitlement_override') capturing adminUserId, target userId, before/after plan/proStatus/freeBookSlots. NOTE: the existing writeAuditEntry in admin-segments-repo.ts is segment-shaped (requires segmentId/affectedUserCount), so either generalize it or add a small writeAdminAudit(adminUserId, action, targetUserId, params) helper. Set proSource='admin' on manual PRO grants in adminUpdateUserEntitlement so revenue/reconciliation routes can distinguish comps from Stripe.

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

### M19 — Ask and Audio load book content from the in-repo package list, diverging from the S3/API-backed reader (S3-only books 404)
`severity: medium` · `effort: medium` · `files: app/app/api/book/books/[bookId]/ask/route.ts:76-79, app/app/api/book/books/[bookId]/chapters/[chapterNumber]/audio/route.ts:61, app/app/api/book/books/[bookId]/chapters/[chapterNumber]/audio/route.ts:275-276`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/book/books/[bookId]/ask/route.ts:76-79, app/app/api/book/books/[bookId]/chapters/[chapterNumber]/audio/route.ts:61, app/app/api/book/books/[bookId]/chapters/[chapterNumber]/audio/route.ts:275-276

PROBLEM:
Ask calls getBookPackageByIdForTone(bookId,'direct') (line 76) and Audio calls getBookPackageByIdForTone(bookId,tone) (lines 61, 275) — both resolve from the in-repo BOOK_PACKAGES array (bookPackages.ts:1164, plus a fixed set of auto-registered JSON imports at ~1934+). The reader's chapter route uses content-service (getUserAccessibleChapter → S3 manifest + chapter JSON) and the quiz/scenarios routes likewise use getPublishedBookManifest. For any catalog book that exists in S3/Dynamo (ingested via the pipeline) but is NOT compiled into the in-repo package set, the reader works while Ask returns 404 'Book not found' (line 77-79) and Audio returns 404 (line 276). Content can also drift between what the reader renders (S3) and what Ask answers about (in-repo snapshot).

WHY IT MATTERS:
Ask-the-Book and Audio silently break for any catalog book not also hardcoded in the repo — a confusing dead feature on those titles plus a correctness gap (Ask answers from a different source than the reader shows).

REQUIRED FIX:
Source Ask and Audio chapter content from the same content-service the reader uses (getPublishedBookManifest + S3 chapter JSON) so all book-content surfaces share one source of truth. If the in-repo packages are deliberately the only supported set, gate the catalog/reader to that same set so behavior is consistent across features (and add a test/asserting check that catalog membership == Ask/Audio support).

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

### M37 — Profile shows hardcoded "93+ books" and "X of 21 categories" that don't match the real catalog
`severity: medium` · `effort: small` · `files: app/book/profile/BookProfileClient.tsx:717-719, app/book/profile/BookProfileClient.tsx:947, app/book/profile/components/ProfilePrimitives.tsx:1450-1458,1472-1476`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/book/profile/BookProfileClient.tsx:717-719, app/book/profile/BookProfileClient.tsx:947, app/book/profile/components/ProfilePrimitives.tsx:1450-1458,1472-1476

PROBLEM:
Upgrade copy hardcodes 'Unlock 93+ more books' (lines 718-719) but booksCatalog.metadata.json has 68 books, overstating the library. CategoryMap is passed totalCategories={21} (line 947) and renders '{explored.length} of {totalCategories}'; exploredCategories (BookProfileClient.tsx:507-518) is built from distinct per-book snapshot.book.category values, and the catalog actually has 33 distinct categories — so a reader who explores >21 categories shows a self-contradicting fraction like '33 of 21'. One nuance vs the original finding: the '+{remaining} more to discover' text is guarded by `remaining > 0` (ProfilePrimitives.tsx:1472), so it will NOT render a negative number — but `remaining` is still computed against the fixed 21 (line 1450) and the 'of 21' fraction is visibly wrong.

WHY IT MATTERS:
Wrong, self-contradicting numbers on a primary surface: overstated library size in the upgrade pitch and an incorrect (and potentially-inverted) categories-explored fraction.

REQUIRED FIX:
Import BOOKS_CATALOG and derive both: use BOOKS_CATALOG.length (minus free starts) for the upgrade copy, and pass totalCategories = new Set(BOOKS_CATALOG.flatMap(b => b.categories)).size. The '+more' negative case is already guarded, but still clamp remaining to >= 0 for safety after deriving the real denominator.

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

### M38 — Badges page presents an "IP" level/currency derived from badge points the server never grants (diverges from real Insight Points)
`severity: medium` · `effort: small` · `files: app/book/badges/lib/badge-utils.ts:98-119, app/book/badges/components/BadgePageHeader.tsx:58-62, app/book/badges/components/BadgeSystemCards.tsx:109,209-210,296,393-394, app/app/api/book/me/badges/route.ts:18-21,62-64, app/book/_lib/flow-points-economy.ts:242`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/book/badges/lib/badge-utils.ts:98-119, app/book/badges/components/BadgePageHeader.tsx:58-62, app/book/badges/components/BadgeSystemCards.tsx:109,209-210,296,393-394, app/app/api/book/me/badges/route.ts:18-21,62-64, app/book/_lib/flow-points-economy.ts:242

PROBLEM:
computeProfile sums each earned badge's fpValue into totalFP and runs it through getLevel (badge-utils.ts:104-115). BadgePageHeader renders '{profile.fpToNextLevel} IP to next level' (line 60); BadgeSystemCards labels badges '{flowPoints} IP' (109, 296) and BadgeDetailPanel states '{badge.flowPoints} Insight Points on earn' (393-394); SystemCards even computes totalIP/earnedIP (209-210). But /me/badges is explicitly cosmetic-only — it never logs an IP transaction (route.ts:18-21, 62-64) and validates badgeId server-side. Real, redeemable IP comes from achievement-definitions.ts via achievement-repo.ts (checkAchievementsAfterLoopComplete, confirmed wired), a separate catalog. So the badges-page IP total/level/"on earn" promises do not match the user's real balance shown on /rewards. getAchievementIP (flow-points-economy.ts:242), which reads the UI badge flowPoints, has zero callers (dead).

WHY IT MATTERS:
Users are promised 'Insight Points' for badges and shown a badges-page IP total/level that contradicts the real, redeemable balance on /rewards — a confusing economy inconsistency and an implicit broken promise on a live product.

REQUIRED FIX:
Pick one truth. Preferred (a): relabel the badges-page currency as 'Badge Points'/'Prestige' and the detail panel as cosmetic, dropping 'IP'/'Insight Points' framing so it is clearly distinct from the redeemable economy; then delete the dead getAchievementIP. Alternative (b): actually grant the badge flowPoints as IP server-side when a badge is recorded (this would change the trust model — the route's whole point is that badges are client-recordable and therefore must NOT mint IP, so (a) is strongly recommended).

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

### M40 — Free-tier book count hardcoded to "2" instead of reading freeBookSlots from the entitlement payload
`severity: medium` · `effort: small` · `files: app/book/settings/components/SubscriptionCard.tsx:155, app/book/settings/BookSettingsClient.tsx:409, app/app/api/book/me/entitlements/route.ts:27,47-48, app/app/api/book/_lib/env.ts:22-27, app/book/hooks/useBookEntitlements.ts:21`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/book/settings/components/SubscriptionCard.tsx:155, app/book/settings/BookSettingsClient.tsx:409, app/app/api/book/me/entitlements/route.ts:27,47-48, app/app/api/book/_lib/env.ts:22-27, app/book/hooks/useBookEntitlements.ts:21

PROBLEM:
SubscriptionCard renders the literal 'You have access to 2 books.' (SubscriptionCard.tsx:155) and getAccountSummary returns 'Free plan · 2 books' (BookSettingsClient.tsx:409). The real free-slot count is server-driven: the entitlements route returns entitlement.freeBookSlots (entitlements/route.ts:27,47), defaulting to 2 via BOOK_FREE_SLOTS_DEFAULT (env.ts:22-27) but configurable globally and overridable per-user (entitlement.freeBookSlots). The value is present on billingState.payload.entitlement.freeBookSlots (typed at useBookEntitlements.ts:21) but is never passed to SubscriptionCard, so the UI shows a constant 2.

WHY IT MATTERS:
Billing/entitlement display can contradict the user's actual access — a guaranteed lie if BOOK_FREE_SLOTS_DEFAULT is ever tuned (e.g. promo to 1 or 3) or any user has a custom freeBookSlots. Trust/clarity problem on the subscription surface, though most users today see the true default of 2.

REQUIRED FIX:
Thread the value through: pass freeBookSlots={billingState.payload?.entitlement.freeBookSlots ?? 2} into <SubscriptionCard> (BookSettingsClient.tsx:1337-1347), render `You have access to {n} book{n === 1 ? '' : 's'}.` at SubscriptionCard.tsx:155, and make getAccountSummary use the same value with pluralization at line 409.

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

### M41 — "Personalized recommendations" consent toggle is a no-op — no surface honors it
`severity: medium` · `effort: medium` · `files: app/book/settings/BookSettingsClient.tsx:1369-1379, app/book/hooks/useBookPreferences.ts:133,242,730-732`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/book/settings/BookSettingsClient.tsx:1369-1379, app/book/hooks/useBookPreferences.ts:133,242,730-732

PROBLEM:
The 'Personalized recommendations' toggle (BookSettingsClient.tsx:1369-1379) persists privacy.personalizedRecommendations, described as 'Use your reading history to suggest books you'll love.' A filtered repo-wide grep (excluding .next/cdk.out/dist build artifacts) finds the field referenced ONLY in the settings UI (read+write) and the preferences hook (default true at 242, parse at 730-732). There is no consumer in any API route, library, or recommendation code path. The toggle makes a privacy promise nothing in the product keeps.

WHY IT MATTERS:
A consent control that does nothing is a privacy/compliance liability at launch (users believe disabling it stops history-based suggestions when nothing changes) and is misleading UX. Medium because it is a consent-labeled control; the false promise is the risk.

REQUIRED FIX:
Either wire the flag into wherever book suggestions are generated so disabling it actually suppresses history-driven recommendations, or — if no such engine exists yet — remove the toggle (and the description's privacy claim) until the behavior is real. Do not ship a consent toggle with no effect. Track the same way as saveQuizHistory/saveNotes (separate dead-code finding).

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

### M44 — Night-mode schedule is partially wired (a scheduler exists) but only runs on 2 pages and races applyDocumentTheme
`severity: medium` · `effort: medium` · `files: app/book/hooks/useBookPreferences.ts:903-925, app/book/hooks/useBookPreferences.ts:851-871, app/book/settings/BookSettingsClient.tsx:1040-1086, app/book/layout.tsx:26-39`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/book/hooks/useBookPreferences.ts:903-925, app/book/hooks/useBookPreferences.ts:851-871, app/book/settings/BookSettingsClient.tsx:1040-1086, app/book/layout.tsx:26-39

PROBLEM:
The audit claims NOTHING reads scheduledDarkMode/darkModeFrom/darkModeTo and the toggle is fully inert. That is FALSE: a real scheduler exists at useBookPreferences.ts:903-925 that parses From/To, correctly handles the wrap-past-midnight case (start>end), toggles document.documentElement `.dark` and colorScheme, and re-checks on a 60s interval. So the toggle is not pure dead plumbing. However there IS a genuine, different defect: (1) the scheduler lives inside useBookPreferences, which is only mounted on the Settings page (BookSettingsClient) and the Chapter Reader (ChapterReaderClient) -- app/book/layout.tsx mounts no global theme/preferences client -- so on home/library/badges/profile/saved/etc. the schedule never runs and dark mode is not applied at the scheduled time; (2) on the Settings/Reader pages where it IS mounted, the separate theme effect at lines 851-871 calls applyDocumentTheme (which sets `.dark` from appearance.theme = light) and its deps do not include the schedule keys, so the two effects fight and the scheduler's `.dark=true` can be reverted on any appearance change; (3) when the user navigates away from those two pages the interval is torn down and `.dark` is never reverted to light at the window's end. Net user-visible result is close to the audit's symptom (scheduled dark mode does not reliably switch the theme), but the root cause and fix are different from what was written.

WHY IT MATTERS:
A presented Settings control behaves inconsistently: scheduled dark mode may flip on the Settings/Reader screens but not on the rest of the app, and may flicker as effects fight. Users will perceive it as broken/flaky rather than simply absent. Trust/data-integrity on a launch surface, but less severe than a control that does literally nothing.

REQUIRED FIX:
Consolidate the schedule into the theme pipeline instead of a second classList toggle: (a) fold the schedule evaluation into resolveDocumentThemeMode/applyDocumentTheme in app/_lib/document-theme.ts so a single source decides `.dark` (passing scheduledDarkMode/from/to through DocumentThemeSettings), and (b) mount the scheduler + applyStoredDocumentTheme in a global client component rendered from app/book/layout.tsx (and ideally the root layout for parity with the bootstrap script) so it runs on every route and reverts to light at the window boundary. Re-evaluate on an interval AND on book-theme-change. Drop the standalone effect at 903-925 once the schedule is part of applyDocumentTheme so the two no longer race. If not implementing globally before launch, gate/hide the toggle. NOTE the audit's stated fix ('nothing reads the keys, add a scheduler') is partly redundant since a scheduler already exists.

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

### M53 — Profile renders a zeroed account on a dashboard API failure
`severity: medium` · `effort: small` · `files: app/book/profile/BookProfileClient.tsx:259-262, app/book/profile/BookProfileClient.tsx:446-460, app/book/profile/BookProfileClient.tsx:696-702, app/book/hooks/useBookAnalytics.ts:822-833`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/book/profile/BookProfileClient.tsx:259-262, app/book/profile/BookProfileClient.tsx:446-460, app/book/profile/BookProfileClient.tsx:696-702, app/book/hooks/useBookAnalytics.ts:822-833

PROBLEM:
BookProfileClient destructures only `{ analytics, hydrated: analyticsHydrated }` from useBookAnalytics (lines 259-262) — never error or refetch. The single blocking gate is `if (!onboardingHydrated || !analyticsHydrated || !badgeSystem.hydrated || !profileHydrated || !onboarding.setupComplete)` (line 696), which checks hydration but not whether analytics is non-null. On a failed dashboard fetch the hook sets hydrated=true with analytics=null, so the gate passes and the page renders. statsSummary then resolves every stat via `analytics?.X ?? 0` (lines 450-459: streak 0, longestStreak 0, booksCompleted 0, totalChaptersCompleted 0, avgQuizScore 0, etc.), so a user with real history sees a zeroed profile with no error/retry.

WHY IT MATTERS:
A returning user with progress sees their streak/books/chapters/quiz history apparently wiped to zero on a transient API blip — alarming and a data-integrity/trust problem, with no in-app recovery besides a manual reload.

REQUIRED FIX:
Pull `error` and `refetch` from useBookAnalytics in BookProfileClient (the hook already returns them at useBookAnalytics.ts:843-848). After the loading gate at line 696, add `if (analyticsError && !analytics) return <main className="cf-app-shell"><TopNav .../><section ...><ErrorBanner title="We couldn’t load your profile" message={analyticsError} onRetry={refetch} /></section></main>;` reusing app/book/components/ui/ErrorBanner.tsx. This matches the existing WorkspacePage pattern (error && !data -> ErrorBanner onRetry={refetch}) and is consistent with ProgressPage, which already shows an error screen (ProgressPage.tsx:502) because it gates on derived null data. Use refetch (sets error=null, bumps revision) rather than window.location.reload().

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

### L14 — Dispute billing-event record key falls back to a non-deterministic timestamp if dispute.created is ever absent
`severity: low` · `effort: small` · `files: app/app/api/book/billing/webhook/route.ts:468-479, app/app/api/book/_lib/repo.ts:1693-1718, app/app/api/book/_lib/keys.ts:191-197`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/book/billing/webhook/route.ts:468-479, app/app/api/book/_lib/repo.ts:1693-1718, app/app/api/book/_lib/keys.ts:191-197

PROBLEM:
recordBillingEvent (repo.ts:1693-1718) has no ConditionExpression — idempotency relies entirely on a stable SK = `${kind}#${createdAtIso}#${id}` (keys.ts:191-197, kind upper-cased to DISPUTE in repo.ts:1697). For disputes the createdAt is isoFromUnix(dispute.created) ?? new Date().toISOString() (route.ts:478). dispute.created is normally present, but if absent, a webhook redelivery computes a different new Date() → different SK → a duplicate dispute row (same dispute.id in two records). Refunds are safe because they key off the stable refund/charge created time (refund-events.ts:57,69).

WHY IT MATTERS:
Potential duplicate dispute rows in the admin finance report on the rare path where dispute.created is absent and the event is redelivered, double-counting chargebacks (listRecentBillingEvents, repo.ts:1721). Admin-only data quality.

REQUIRED FIX:
Make the dispute SK timestamp deterministic. Simplest: drop createdAt from the idempotency portion of billingEventSk — key disputes by `${kind}#${id}` and store createdAt as a plain attribute, sorting on it separately — OR add a ConditionExpression (attribute_not_exists(SK)) to recordBillingEvent so a redelivery cannot create a second row, OR derive the fallback createdAt from the resolved charge's created (already retrieved at route.ts:462) instead of new Date(). Note the SK currently embeds createdAt to allow chronological Query ordering, so the cleanest fix is the ConditionExpression which preserves ordering while preventing duplicates.

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

### L15 — Mixed-currency subscriptions silently corrupt MRR sum (warning is logged but the bad total is still reported)
`severity: low` · `effort: small` · `files: app/app/api/book/admin/metrics/billing/route.ts:55-74, app/app/api/book/billing/webhook/route.ts:212-220, lib/pricing.ts:61-69`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/book/admin/metrics/billing/route.ts:55-74, app/app/api/book/billing/webhook/route.ts:212-220, lib/pricing.ts:61-69

PROBLEM:
The system is single-CAD (lib/pricing.ts BILLING_CURRENCY = PRICING.currency = 'CAD'). The webhook only console.warns when a subscription's currency != BILLING_CURRENCY (route.ts:217-219) and never rejects (deliberately, to avoid desyncing the entitlement). The admin billing route pushes a warnings[] string when >1 distinct currency is seen (route.ts:68-73) but STILL computes a single realMrr by summing subscriptionAmountCents across all currencies (route.ts:55-58) and reports it as the headline KPI (route.ts:168). So a misconfigured Stripe Price or future non-CAD market makes MRR add e.g. CAD+USD cents as if identical units.

WHY IT MATTERS:
If a non-CAD subscription ever exists, reported MRR/ARR is silently nonsensical apart from a warning chip an admin may not read. Today single-currency, so impact is latent; it compounds with the annual-MRR bug above.

REQUIRED FIX:
When distinctCurrencies.length > 1, either return realMrr/realArr as null alongside the warning, or group MRR per currency in the response (and per currency in revenueByCountry/topPayingUsers) rather than summing across currencies. This pairs naturally with the interval-normalization fix for finding #1 — both should land together in the MRR computation.

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

### L25 — Reflection IP (5 IP/example) is granted on a client-supplied length, not on validated reflection content
`severity: low` · `effort: small` · `files: app/app/api/book/me/reflections/[bookId]/[chapterNumber]/route.ts:43-55, app/app/api/book/me/reflections/[bookId]/[chapterNumber]/route.ts:89-101, app/book/_lib/flow-points-economy.ts:189`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/book/me/reflections/[bookId]/[chapterNumber]/route.ts:43-55, app/app/api/book/me/reflections/[bookId]/[chapterNumber]/route.ts:89-101, app/book/_lib/flow-points-economy.ts:189

PROBLEM:
The reflection IP route validates only reflectionLength (a number from the body, >= 1) and that exampleId belongs to the chapter (lines 43-55, 85-87) — it never receives or inspects the actual reflection text. A client can POST { exampleId: <valid id>, reflectionLength: 1 } with no real text and collect the 5 IP (awardFlowPoints, idempotent per example via sourceId `${bookId}:${chapterNumberInt}:${exampleId}`). The economy copy claims 'Empty submissions don't count' (flow-points-economy.ts:189), which the server cannot enforce with no text.

WHY IT MATTERS:
Bounded self-serve IP farming: 5 IP per valid example in every accessible chapter without writing anything, contradicting the stated rule. Blast radius is capped by the number of valid exampleIds across unlocked chapters but grows with catalog size.

REQUIRED FIX:
Have the client send the reflection text (it already does for the separate AI-feedback route) and validate server-side: require trimmed length >= a minimum (e.g. 20, matching the feedback route) before awardFlowPoints; reject with 400 'empty_reflection' otherwise. Do not trust reflectionLength as the gate.

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

### L48 — ingestBookPackageFromS3 re-validates but stores the RAW unvalidated upload as book.json
`severity: low` · `effort: trivial` · `files: app/app/api/book/_lib/ingestion.ts:35-37, app/app/api/book/_lib/ingestion.ts:85`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/app/api/book/_lib/ingestion.ts:35-37, app/app/api/book/_lib/ingestion.ts:85

PROBLEM:
raw = readJsonFromS3(...); pkg = validateBookPackage(raw); manifest/chapters/quizzes are built from the validated/normalized pkg, but line 85 writes book.json as JSON.stringify(raw) — the pre-validation blob. For v21 uploads validateBookPackage dispatches through adaptV21ToV13(raw) (validate-book-package.ts:1222-1223), so pkg is v13-shaped while book.json stays v21-shaped — book.json diverges from every other served artifact. Even non-v21 uploads are normalized (examples re-mapped, defaults applied), so raw still diverges somewhat.

WHY IT MATTERS:
Stored canonical book.json disagrees with the served manifest/chapters/quizzes (most starkly for v21 books); confusing for re-ingest/forensics/audits. Admin-only path.

REQUIRED FIX:
Write the validated/adapted pkg as book.json (JSON.stringify(pkg)), OR name the raw artifact original-upload.json and write pkg as book.json so the canonical name matches what is served.

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

### L57 — BrowseLibraryPage default 'Most popular' sort is essentially reverse-alphabetical because only one book is flagged popular
`severity: low` · `effort: small` · `files: components/website/BrowseLibraryPage.tsx:64-74, components/website/BrowseLibraryPage.tsx:128-140, components/website/BrowseLibraryPage.tsx:857-895, components/website/BrowseLibraryPage.tsx:1058`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: components/website/BrowseLibraryPage.tsx:64-74, components/website/BrowseLibraryPage.tsx:128-140, components/website/BrowseLibraryPage.tsx:857-895, components/website/BrowseLibraryPage.tsx:1058

PROBLEM:
POPULAR_IDS has one id ('crucial-conversations'), NEW_IDS one id, STAFF_PICK_IDS and FREE_IDS empty (lines 64-74). Default sortBy='popular' (line 1058). The 'popular' comparator (line 132) only distinguishes popular-vs-not and otherwise falls back to b.title.localeCompare(a.title) — reverse alphabetical. So the default library view is one popular book on top followed by reverse-alphabetical order, labeled 'Most popular'. The curated CategoryRows (lines 857-895) require >=MIN_CURATED_ROW(3) items: Staff Picks (popularBooks) and Recently Added (newBooks) each have 1, so both rows never render and the 'Start Here' fallback (line 893-895) always shows. The FEATURED_REASON comment already acknowledges these are hand-picked, not telemetry.

WHY IT MATTERS:
The default view presents an arbitrary (reverse-alphabetical) order under a 'Most popular' label, and the curated discovery rows are dead in practice. No data corruption — a weaker first impression and a label that mildly overstates the curation behind the ordering.

REQUIRED FIX:
Either populate POPULAR_IDS/NEW_IDS/STAFF_PICK_IDS with a real curated set of >=3 each (so the rows render and the sort is meaningful), or change the default sortBy to 'alphabetical'/'newest' and rename the 'popular' SORT_OPTIONS label to 'Featured' so it matches the hand-picked-id reality already documented in FEATURED_REASON.

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

### L64 — Terms/Privacy consent from signup is only persisted at onboarding completion (client-side gate otherwise)
`severity: low` · `effort: medium` · `files: app/signup/page.tsx:33,46-56,80-109, app/app/api/book/me/onboarding/complete/route.ts:283-301`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/signup/page.tsx:33,46-56,80-109, app/app/api/book/me/onboarding/complete/route.ts:283-301

PROBLEM:
Signup gates startOAuth/startEmail on `consented` (page.tsx:47,52) but never records acceptance at consent time — it's a pure client-side gate. The 'Sign in' link (173) doesn't require the checkbox at all. The authoritative termsAcceptedAt/termsVersion stamp is written only in the onboarding-complete route's firstCompletion block (route.ts:283-301). A user who consents, signs up, then abandons before finishing onboarding — or who signs in via the bottom link — has no server-recorded consent despite potentially reading content.

WHY IT MATTERS:
Compliance/audit gap: the app cannot prove a user accepted Terms/Privacy unless they completed onboarding; consent for abandoners is unrecorded.

REQUIRED FIX:
Record consent server-authoritatively when given — e.g. pass agreed=1 through /auth/login state and stamp termsAcceptedAt in the auth callback on first account creation, or stamp on first authenticated page load — rather than only at onboarding completion. (Cross-check with the issue-11 legal-polish initiative before implementing, since terms-acceptance stamping is owned there.)

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

### L71 — Library 'Recently added' sort just reverses catalog order (no real recency signal)
`severity: low` · `effort: small` · `files: components/library/BrowseAll.tsx:168, components/library/libraryData.ts:1311`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: components/library/BrowseAll.tsx:168, components/library/libraryData.ts:1311

PROBLEM:
BrowseAll.tsx:168-169 implements the 'recent' sort as `case 'recent': result.reverse(); break;`, and SORT_OPTIONS labels it 'Recently added' (libraryData.ts:1311). LibraryBook has no addedAt/publishedAt/createdAt field (verified), and catalog order is not a date ordering, so reversing it does not correspond to recency — an arbitrary deterministic reorder presented as chronological. The code even comments that 'featured' keeps 'the catalog's curated order (no fabricated metric)' (BrowseAll.tsx:154), yet 'recent' reverses that same curated order.

WHY IT MATTERS:
Mild data-honesty issue on one optional sort. Low blast radius, but it is exactly the fabricated-signal class this surface was scrubbed of (popular/completion sorts were already removed for the same reason).

REQUIRED FIX:
Remove the 'recent' option from SORT_OPTIONS until a real addedAt/publishedAt field exists on LibraryCatalogBook, or wire it to a genuine date field once available. If the catalog array is genuinely maintained newest-last, relabel honestly (e.g. 'Catalog order (newest last)').

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

### L74 — Profile "Pinned takeaways" stat is a derived count, not real pin state
`severity: low` · `effort: trivial` · `files: app/book/profile/BookProfileClient.tsx:1187,1190-1196`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/book/profile/BookProfileClient.tsx:1187,1190-1196

PROBLEM:
The 'Pinned takeaways' StatCard value is Math.min(localInsights.notes.length, 3) (line 1187) and the 'Pinned ideas' list just renders the first 3 notes' first lines via PinnedTakeawayCard (1193-1195). There is no pinning mechanism — any user with >=3 notes always shows '3 pinned takeaways' and the first three notes are framed 'Pinned'. Minor nuance: the StatCard helper text already reads 'Top recent insights', so the label and helper already contradict each other (label says Pinned, helper says recent).

WHY IT MATTERS:
Mildly misleading stat/labeling implying a 'pinned' curation feature that doesn't exist. Low blast radius.

REQUIRED FIX:
Relabel the StatCard and 'Pinned ideas' heading to 'Recent takeaways'/'Top recent insights' (matching the existing helper), or implement real pinning. Drop the synthetic Math.min(...,3) count and the 'Pinned' framing.

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

### L94 — Library UserStats reports currentStreak:0 and a hardcoded nextBadge regardless of real data (currently not displayed, but a latent lie)
`severity: low` · `effort: small` · `files: components/library/dashboardToLibraryUi.ts:65, components/library/dashboardToLibraryUi.ts:66, components/library/dashboardToLibraryUi.ts:67, components/library/dashboardToLibraryUi.ts:68`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: components/library/dashboardToLibraryUi.ts:65, components/library/dashboardToLibraryUi.ts:66, components/library/dashboardToLibraryUi.ts:67, components/library/dashboardToLibraryUi.ts:68

PROBLEM:
Confirmed: toUserStats() hardcodes `currentStreak: 0`, `streakIsActiveToday: false` (with a TODO to wire /api/book/me/streak), and `nextBadge: { name: "Avid Reader", booksAway: Math.max(0, 2 - booksCompleted) }` — none reflect real streak or real next badge. I read the live consumer (LibraryPage.tsx in full): it reads userStats.firstName, isPro, freeBooksUsed, freeBooksLimit, and level, but NEVER currentStreak / streakIsActiveToday / nextBadge. So nothing wrong renders today. The risk is latent: any future library component that trusts userStats.currentStreak or userStats.nextBadge would show a fake 'streak 0' / 'Avid Reader, N to go' to every user. (Note: booksAway is at least derived from real booksCompleted, so it's less arbitrary than the streak constants.)

WHY IT MATTERS:
No incorrect data on screen today. Latent risk that a future UI addition surfaces a fabricated streak / next-badge to all users. Also represents an honest capability gap (library can't show real streak/next-badge without changes).

REQUIRED FIX:
Preferred: drop currentStreak/streakIsActiveToday/nextBadge from the UserStats shape until a backend source exists, so no consumer can read a fabricated value. If they must stay, wire them: the dashboard payload already feeds useBookAnalytics (streakDays) and useBadgeSystem (nextMilestones), so pass real values through toUserStats or source them in LibraryPage from those hooks. Original fix is correct.

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

### L95 — Book detail page presents a derived page-count estimate as a real "pages" figure
`severity: low` · `effort: trivial` · `files: app/book/library/[bookId]/BookDetailClient.tsx:109, app/book/library/[bookId]/BookDetailClient.tsx:110, app/book/library/[bookId]/BookDetailClient.tsx:287, app/book/library/[bookId]/components/BookHero.tsx:146`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: app/book/library/[bookId]/BookDetailClient.tsx:109, app/book/library/[bookId]/BookDetailClient.tsx:110, app/book/library/[bookId]/BookDetailClient.tsx:287, app/book/library/[bookId]/components/BookHero.tsx:146

PROBLEM:
Confirmed: when book.pages is absent, BookDetailClient computes `pages = book.pages ?? Math.max(120, Math.round(book.estimatedMinutes * 2.8))` (line 109-110) and passes it to BookHero (line 287), which renders it as a bare "{pages} pages" pill (BookHero.tsx:146) with no 'approx'/'~' qualifier. The fallback is real-world reachable: `pages` is an optional field (library-data.ts:24) populated only when the book package supplies extra.pages (library-catalog.ts:91-93) — and the catalog metadata JSON has 0 entries with a pages field, so absent extras means the estimate is what renders. A 200-minute book would display a fabricated-looking '560 pages' as if exact.

WHY IT MATTERS:
Minor authenticity issue: a reader may treat the page count as exact when it is invented; unusual estimatedMinutes values can produce obviously-off figures. Plausible-but-fabricated number rendered with the authority of a real attribute.

REQUIRED FIX:
Only render a page-count pill when book.pages is a real value; otherwise omit it (the header already shows real estimatedMinutes and chapter count). If a length proxy is desired when pages is missing, label it explicitly (e.g. '~X min read' or '~N pages') rather than implying a precise count. Original fix is correct.

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

### P13 — Library UserStats hardcodes currentStreak=0 / streakIsActiveToday=false / nextBadge (dead-but-misleading derived fields)
`severity: polish` · `effort: small` · `files: components/library/dashboardToLibraryUi.ts:36, components/library/dashboardToLibraryUi.ts:65, components/library/LibraryPage.tsx:382`

```text
ROLE: You are fixing ONE production-readiness issue in the ChapterFlow web app on
the main branch (Next.js 16 App Router / React 19). Backend = DynamoDB single-table
(app/app/api/book/_lib/repo.ts) behind Cognito auth + Stripe; API routes under
app/app/api/book/**. Reuse existing helpers (auth guards, BookApiError/
withBookApiErrors, repo functions, keys.ts). Change ONLY the cited files + direct
deps. Do NOT touch scripts/, book-packages/, content/.

FILES: components/library/dashboardToLibraryUi.ts:36, components/library/dashboardToLibraryUi.ts:65, components/library/LibraryPage.tsx:382

PROBLEM:
toUserStats() in dashboardToLibraryUi.ts always returns currentStreak:0, streakIsActiveToday:false, and a booksCompleted-derived nextBadge, with TODOs noting no backend source. deriveLevel computes level = max(1, floor(IP/500)+1) (a placeholder, not a real tier system). Of the UserStats fields, the live library consumes only firstName (LibraryPage.tsx:253, 281) and level (LibraryPage.tsx:382 → CelebrationToast 'Level N'). currentStreak/streakIsActiveToday/nextBadge are NOT rendered anywhere live (the currentStreak:5 etc. grep hits are inside the dead MOCK_USER_STATS constant). Real streak data exists via useBookAnalytics (streakDays / calculateCurrentStreak).

WHY IT MATTERS:
No user-facing wrong data today (streak/badge fields aren't displayed in the library), but the displayed 'Level N Reader' on the completion toast is an approximate IP-derived number presented as a level, and the hardcoded fields are a trap for anyone later wiring a streak/level UI off UserStats expecting real values.

REQUIRED FIX:
Either drop the unused currentStreak/streakIsActiveToday/nextBadge fields from the library UserStats shape, or populate them from the streak data useBookAnalytics already derives. For the displayed 'level', source it from a real tier endpoint when one exists or label it honestly. Pure cleanup.

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
