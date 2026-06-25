# ChapterFlow Pre-Launch Bug Audit + Fix Roadmap — 2026-06-24

> **READ FIRST — base branch & how to drive this.**
>
> - **Fix on `main`.** This audit ran on `audit/prod-readiness-2026-06-14`, which is **395 commits behind `main`** (the launch line). Every agent branches its worktree off **`origin/main`**, not this branch.
> - **Line numbers are approximate** (they're from the stale branch). Locate code by symbol/string, not line.
> - **Re-confirm on `main` before fixing.** Some of these 76 may already be fixed in those 395 commits. Both **CRITICALs were hand-verified still-live on `main`** (`quiz-service.ts` `total = responses.length`; the adapter `correctIndex … : 0`; `pitch-anything.v21.json` still has 18 keyless questions).
> - **One finding per agent/session.** Paste **§1 (the brief) + exactly one finding block**. The roadmap (§3) tells you what runs in parallel vs in order, and which model/depth to pick.

---

## §1 · Agent brief — PASTE THIS, then ONE finding block from below

You are fixing **one** confirmed pre-launch bug in **ChapterFlow** (Next.js 16 App Router · React 19.2 · Tailwind v4 · AWS: DynamoDB single-table, S3, Cognito, Stripe, SES). Read `CLAUDE.md` first for architecture and the invariants you must not break. Use the **model + thinking depth tagged on the finding**.

Work in this exact order:

**0 · Worktree (yours, isolated).** From the repo root:
```
git fetch origin && git worktree add ../cf-fix-<slug> -b fix/<slug> origin/main
```
Pick `<slug>` from the finding ID/title. Work ONLY in that worktree; don't touch the audit branch or other worktrees.

**1 · PLAN MODE first — do not edit yet.** Investigate: open the cited file(s) **and their call sites** (find code by symbol — the line numbers are from a stale branch and are approximate). Trace the exact failure path. **Confirm the bug still reproduces on `origin/main`**; if it's already fixed or the code moved past it, STOP and do step 6. Then design the *best* root-cause fix: minimal, consistent with existing conventions. If the change touches the v21 dual-adapter, fix **both** the server (`app/app/api/book/_lib/v21-adapter.ts`) and client (`app/book/lib/v21-adapter.ts`) copies. Never write an empty DynamoDB Set (create via `ADD`). UI changes are design-token only (no raw hex). Present the plan and wait for approval.

**2 · Execute** the approved fix.

**3 · Test.** Add/extend a regression test that **fails before, passes after**. Tests are `*.test.ts` via `npx tsx --test` (node:test runner — NOT jest/vitest). Some modules are `server-only` and throw on direct import — test the pure `*-core.ts`/helper instead.

**4 · Verify nothing breaks.** Run `npm run verify` (tsc → unit → scan:style → build) and make it pass. Confirm you didn't regress a documented-intentional design in `CLAUDE.md`.

**5 · Ship (success).** Commit (end the message with a `Co-Authored-By: Claude <noreply@anthropic.com>` trailer) and open a PR to `main`: root cause, the fix, the regression test, and any risk/blast-radius.

**6 · Note (blocked / can't fix cleanly / doesn't repro / needs a product call).** Do NOT force a fix or commit anything broken. Write `docs/fix-notes/<slug>.md` (what you found, why you stopped, your recommendation) and tell me.

**Scope discipline:** fix ONLY the assigned finding. Note any adjacent bugs in the PR description — don't expand scope.

---

## §2 · Model / thinking-depth tiers

| Tier | Model · depth | Use for |
|---|---|---|
| **T1** | **Opus 4.8 · xhigh** | Criticals + money / data-loss / security / concurrency-race highs. Deep reasoning, high blast radius. |
| **T2** | **Opus 4.8 · high** | Other highs; money/race/data-loss mediums. |
| **T3** | **Sonnet 4.6 · high** | Most mediums and non-trivial lows. |
| **T4** | **Sonnet 4.6 · medium** | Mechanical lows (req.json→400 guards, NaN guards, HTML-escape, key warnings, stray files). |

_Plan mode every time regardless of tier — the depth controls execution reasoning, not whether to plan._

---

## §3 · Execution roadmap — parallelism

**Run lanes A–H as concurrent streams.** Inside a **SEQUENTIAL** lane do items top-to-bottom, each branching off `main` after the previous merges. Inside a **PARALLEL** lane (and the H pool) run everything at once. Start **A1 + B1 immediately — they're the launch-gating criticals.**

| Lane | Theme | Mode | Items |
|---|---|---|---|
| **A** | Learning-loop integrity — quiz grading + progress writes | 🔒 SEQUENTIAL | 12 (C,H,L,M) |
| **B** | Content pipeline & ingestion (v21) | 🔒 SEQUENTIAL | 9 (C,H,L,M) |
| **C** | Money — entitlements, license, gifts, shop | 🔒 SEQUENTIAL | 9 (H,L,M) |
| **D** | Money — Stripe webhook & trial email | 🔒 SEQUENTIAL | 4 (H,M) |
| **E** | Email, notifications & suppression | 🔒 SEQUENTIAL | 5 (H,L,M) |
| **F** | Infra, edge & server-env | ∥ PARALLEL | 13 (H,L,M) |
| **G** | Frontend reader & UI | ∥ PARALLEL | 7 (H,L,M) |
| **H** | Independent pool — routes, sibling repos, misc | ∥ PARALLEL | 23 (H,L,M) |

- **Lane A — SEQUENTIAL.** Heavy collisions on repo.ts progress fns, the quiz submit route, quiz-session/quiz-service, reset & ensure-book-started. One stream, in listed order; each item branches off main AFTER the previous merges. Contains CRIT-A1.
- **Lane B — SEQUENTIAL.** Shares v21-adapter (server+client), validate-book-package, ingestion. Contains CRIT-B1. Fix the validation/answer-key items first — they make the rest fail-closed.
- **Lane C — SEQUENTIAL.** Shares repo.ts entitlement fns + flow-points-repo + gift/shop routes. Money-critical; serialise.
- **Lane D — SEQUENTIAL.** Single webhook handler + subscription-status + trial email. Serialise to keep the handler coherent.
- **Lane E — SEQUENTIAL.** Start with the consent-model DECISION (DG-email), then apply across senders + delivery + suppression.
- **Lane F — PARALLEL.** WAF / SNS / DLQ / alarms / templates / env-resolution / origin. Mostly file-disjoint — run concurrently.
- **Lane G — PARALLEL.** React hooks + components + onboarding. Distinct files — run concurrently.
- **Lane H — PARALLEL.** Standalone routes / sibling repos / utils. All file-disjoint — grab any, run as many at once as you like.

**Cross-lane file watch** (rebase the later PR if these collide): `repo.ts` is edited by A, B(ingest-job), C — different functions, usually merge clean; `quiz-session.ts` is touched by A and B's out-of-range-index item (do that one after A merges); the frontend provisional-pass (G) is logically paired with A but in a separate file (safe to parallelize).

**Duplicate/related groups — fix ONCE, don't spin two agents:** `DG-v21val` (B), `DG-giftexp` (C), `DG-email` (E), `DG-segment` (H). Items in a group are tagged below.

### Per-finding index

| ID | Sev | Tier | Title | Location |
|---|---|---|---|---|
| **A1** | crit | T1 | Legacy selectedIndex grading path lets a crafted submit pass a chapter with… | `app/app/api/book/me/quiz/[bookId]/[chapterN…` |
| **A2** | high | T2 | Book-completion check compares pinned completedChapters against the CURRENT… | `app/app/api/book/me/quiz/[bookId]/[chapterN…` |
| **A3** | high | T2 | Book-state read routes use the CURRENT published manifest instead of the us… | `app/app/api/book/me/books/[bookId]/state/ro…` |
| **A4** | high | T2 | Out-of-range authored correctIndex yields a correctChoiceId no choice can m… | `app/app/api/book/_lib/quiz-session.ts:175-180` |
| **A5** | high | T1 | Reset Progress permanently locks the reader at chapter 1 (stale passed quiz… | `app/app/api/book/me/books/[bookId]/state/re…` |
| **A6** | high | T1 | Unconditional full-object Put of BOOK_PROGRESS on quiz pass races with conc… | `app/app/api/book/_lib/repo.ts:1200-1212 (re…` |
| **A7** | high | T1 | ensureUserBookStarted does an unconditional full-item Put of progress, raci… | `app/app/api/book/_lib/ensure-book-started.t…` |
| **A8** | high | T2 | recordQuizAttemptOutcome treats every TransactionCanceledException as a per… | `app/app/api/book/_lib/repo.ts:1220-1234 (th…` |
| **A9** | medi | T3 | Quiz question count for the live catalog is driven by the client-supplied `… | `app/app/api/book/me/quiz/[bookId]/[chapterN…` |
| **A10** | medi | T3 | ensureUserBookStarted can throw 500 progress_init_failed on first book-star… | `app/app/api/book/_lib/ensure-book-started.t…` |
| **A11** | medi | T3 | summarizeProgress fallback heuristic can never report a sequentially-read b… | `app/app/api/book/_lib/repo.ts:2421-2430` |
| **A12** | low | T4 | state PATCH writes an unvalidated client-supplied lastOpenedAt into the can… | `app/app/api/book/me/books/[bookId]/state/ro…` |
| **B1** | crit | T1 | v21 adapter silently fabricates answer key (correctIndex=0) for questions m… `[DG-v21val]` | `app/app/api/book/_lib/v21-adapter.ts:100 (s…` |
| **B2** | high | T2 | Idempotent re-ingest with publishNow=true silently fails to publish a DRAFT… | `app/app/api/book/_lib/ingestion.ts:51-73 + …` |
| **B3** | high | T1 | v21 packages bypass ALL server-side semantic validation at ingestion (adapt… `[DG-v21val]` | `app/app/api/book/_lib/validate-book-package…` |
| **B4** | high | T2 | v21 packages bypass the entire v13 validator (range/uniqueness/variant-comp… `[DG-v21val]` | `app/app/api/book/_lib/validate-book-package…` |
| **B5** | medi | T2 | Ingest rollback deletes content+version draft but leaves META/CATALOG point… | `app/app/api/book/_lib/ingestion.ts:152-171 …` |
| **B6** | low | T4 | A malformed library catalog.json makes the entire library listing throw 422… | `app/app/api/book/_lib/library-catalog.ts:10…` |
| **B7** | low | T4 | Standalone publish swallows search-index errors and can publish a stale/inc… | `app/app/api/book/admin/books/[bookId]/versi…` |
| **B8** | low | T3 | updateIngestionJob unconditionally writes bookId/details/errorReportKey = n… | `app/app/api/book/_lib/repo.ts:628-639 (FAIL…` |
| **B9** | low | T4 | v21 adapter synthesizes a time-based packageId when absent, silently defeat… | `app/app/api/book/_lib/v21-adapter.ts:256` |
| **C1** | high | T1 | Gift a Friend charges Insight Points in a committed transaction, then persi… | `app/app/api/book/me/shop/route.ts:108-174 (…` |
| **C2** | high | T1 | Redeeming a 7-day gift code (or flow-points pass) overwrites and shortens a… `[DG-giftexp]` | `app/app/api/book/me/gifts/[code]/claim/rout…` |
| **C3** | high | T1 | Sticky chargeback marker (disputeOpen) blocks only Stripe re-activation; a … | `app/app/api/book/_lib/repo.ts:2078-2080 (on…` |
| **C4** | medi | T3 | FSRS post-lapse stability is not clamped to the prior stability, so pressin… | `app/app/api/book/_lib/fsrs.ts:56-63 (nextFo…` |
| **C5** | medi | T2 | Gift-code claim unconditionally overwrites currentPeriodEnd, shortening a l… `[DG-giftexp]` | `app/app/api/book/me/gifts/[code]/claim/rout…` |
| **C6** | low | T3 | Full license key string is persisted to the analytics table on every redemp… | `app/app/api/book/billing/license/route.ts:2…` |
| **C7** | low | T4 | License expiry computed with Date.setMonth(getMonth()+validMonths) overflow… | `app/app/api/book/_lib/repo.ts:3273-3277 (re…` |
| **C8** | low | T4 | Non-numeric ?limit on GET /me/reviews yields NaN and getDueCards' slice(0, … | `app/app/api/book/me/reviews/route.ts:20 and…` |
| **C9** | low | T4 | POST /me/reviews/[cardId] and POST /me/shop call req.json() without try/cat… | `app/app/api/book/me/reviews/[cardId]/route.…` |
| **D1** | high | T1 | Out-of-order invoice.paid after customer.subscription.deleted permanently r… | `app/app/api/book/billing/webhook/route.ts:2…` |
| **D2** | medi | T2 | Chargeback on a non-stripe-PRO user is silently swallowed: proSource guard … | `app/app/api/book/billing/webhook/route.ts:4…` |
| **D3** | medi | T3 | Signature-verification errors 'Timestamp outside the tolerance zone' / 'No … | `app/app/api/book/billing/webhook/route.ts:6…` |
| **D4** | medi | T2 | charge.dispute.created records the event as processed even when user can't … | `app/app/api/book/billing/webhook/route.ts:4…` |
| **E1** | high | T2 | Per-category email unsubscribe is a no-op for all createNotification emails… | `app/app/api/book/_lib/notifications-repo.ts…` |
| **E2** | high | T1 | Trial-ending email permanently lost on any transient send failure (claim re… | `app/app/api/book/_lib/trial-ending-email.ts…` |
| **E3** | medi | T3 | App-side email config silently falls back to dead legacy host while the lam… | `app/app/api/book/_lib/email-compliance.ts:29` |
| **E4** | low | T4 | No per-user device cap; createNotification push loop fans out over all regi… | `app/app/api/book/me/devices/register/route.…` |
| **E5** | low | T4 | Suppression check fails open — DynamoDB blip re-enables sends to hard-bounc… | `infra/lambda/lib/email-compliance.ts:62-80 …` |
| **F1** | high | T1 | Client-spoofable X-Forwarded-For defeats the network-velocity free-unlock f… | `app/app/api/book/_lib/abuse.ts:48-62 (readI…` |
| **F2** | high | T1 | Nudge cron sub-handlers send email on opt-OUT (channels.email !== false) wh… `[DG-email]` | `infra/lambda/lib/weekly-digest.ts:115, infr…` |
| **F3** | high | T2 | WAF AWSManagedRulesCommonRuleSet (no rule overrides) will 403 legitimate AP… | `infra/lib/chapterflow-frontend-stack.ts:690…` |
| **F4** | medi | T3 | Reading-reminder email is gated on channels.email === true but channels is … `[DG-email]` | `infra/lambda/reading-reminder-cron.ts:194` |
| **F5** | medi | T2 | Reminder/nudge cron has no error or duration alarm and no timeout headroom;… | `infra/lib/chapterflow-backend-stack.ts:412-…` |
| **F6** | medi | T2 | SES suppression handler swallows DynamoDB write failures (no re-throw, no D… | `infra/lambda/suppression-handler.ts:84-104` |
| **F7** | medi | T2 | isSkippableSsmError swallows AccessDenied on the legitimate prefixed parame… | `app/app/api/_lib/server-env.ts:47-56 (skip …` |
| **F8** | low | T3 | Email body templates interpolate user displayName into HTML without escapin… | `infra/lambda/lib/email-templates/reading-re…` |
| **F9** | low | T3 | Email-events SNS topic policy allows ses.amazonaws.com Publish with no aws:… | `infra/lib/chapterflow-backend-stack.ts:495-501` |
| **F10** | low | T4 | Page-guard auto-reactivation write failure fails open silently, leaving sta… | `app/_lib/require-dashboard-access.ts:83-98` |
| **F11** | low | T4 | Settings-page isAdmin flag is always false in prod (ADMIN_EMAILS/ADMIN_SUBS… | `app/book/settings/page.tsx:20-34` |
| **F12** | low | T3 | getAppBaseUrl returns a loopback CHAPTERFLOW_APP_BASE_URL verbatim in prod … | `app/app/api/book/_lib/env.ts:57-72 (return …` |
| **F13** | low | T3 | resolvePublicOrigin trusts attacker-controllable x-forwarded-host when no b… | `app/app/_lib/server-origin.ts:59-65` |
| **G1** | high | T2 | Any server error on quiz submit (incl. attempt_cooldown / rate-limit) is si… | `app/book/library/[bookId]/chapter/[chapterI…` |
| **G2** | medi | T3 | /onboarding crashes (error page) on any non-Auth settings-read failure whil… | `app/onboarding/page.tsx:25-31 (vs app/book/…` |
| **G3** | medi | T3 | ContinueLearningCard can build /book/library/{id}/chapter/ with an empty ch… | `components/progress/ContinueLearningCard.ts…` |
| **G4** | medi | T3 | ProgressPage reads e.plan from /me/entitlements but the route returns a nes… | `components/progress/ProgressPage.tsx:495-50…` |
| **G5** | medi | T3 | WorkspacePage BookRow renders userBooks and recommendedProBooks in one cont… | `components/workspace/BookRow.tsx:83 and :11…` |
| **G6** | medi | T3 | inferChapterNumber() parses the first digit run in the chapterId, returning… | `app/book/library/[bookId]/chapter/[chapterI…` |
| **G7** | low | T4 | Completion-route streak/points response is parsed then discarded; UnlockCel… | `app/onboarding/components/OnboardingFlow.ts…` |
| **H1** | high | T1 | Admin delete/deactivate silently skips Stripe cancellation when the entitle… | `app/app/api/book/admin/users/[userId]/accou…` |
| **H2** | high | T1 | Reflection AI-feedback rate limiter is check-then-write-after-completion, a… | `app/app/api/book/me/reflections/[bookId]/[c…` |
| **H3** | medi | T3 | 10-activation referral milestone never grants the promised 30-day Pro pass … | `app/app/api/book/_lib/referral-escalation-c…` |
| **H4** | medi | T3 | Re-rejecting a previously approved scenario does not reverse the Insight Po… | `app/app/api/book/admin/scenario-submissions…` |
| **H5** | medi | T3 | Segment filter `lastActiveWithinDays gt` matches never-active users, pollut… `[DG-segment]` | `app/app/api/book/_lib/segment-engine.ts:83` |
| **H6** | medi | T2 | acceptPairInvite TOCTOU lets a user end up with multiple active partners | `app/app/api/book/_lib/pair-repo.ts:92-145` |
| **H7** | medi | T2 | deletePair soft-deletes the pair row, permanently blocking the same two use… | `app/app/api/book/_lib/pair-repo.ts:289-316 …` |
| **H8** | medi | T3 | system-mode theme does not re-apply to the DOM when the OS color scheme cha… | `app/hooks/useThemePreference.ts:60-63 (hand…` |
| **H9** | low | T4 | BOOK_PACKAGE_PRESENTATION 'Getting-Things-Done' entry is unreachable and em… | `app/book/data/bookPackages.ts:1430-1432 (an…` |
| **H10** | low | T4 | Catalog-count drift guard (d) only scans .tsx and only matches 'books', mis… | `scripts/ci/scan-style-drift.mjs:51-54 (RE_C…` |
| **H11** | low | T4 | Depth-routing feature is inert: updateDepthModel is never called, so the re… | `app/app/api/book/_lib/depth-routing.ts:104-…` |
| **H12** | low | T4 | Event PATCH accepts a malformed/empty badge object that the POST creator re… | `app/app/api/book/admin/events/[eventId]/rou…` |
| **H13** | low | T4 | Malformed JSON body in Ask endpoint returns a 500 instead of 400 | `app/app/api/book/books/[bookId]/ask/route.t…` |
| **H14** | low | T4 | Notifications dailyVolume is computed from an arbitrary-order capped Scan, … | `app/app/api/book/admin/metrics/notification…` |
| **H15** | low | T3 | Partner nudge daily cap is check-then-write (non-atomic), allowing a duplic… | `app/app/api/book/me/pairs/[partnerId]/nudge…` |
| **H16** | low | T4 | Segment filter 'lastActiveWithinDays gt N' wrongly matches users who have n… `[DG-segment]` | `app/app/api/book/_lib/segment-engine.ts:82-88` |
| **H17** | low | T4 | Starter prescription can only ever recommend one of 3 hardcoded books, igno… | `app/app/api/book/_lib/starter-prescription.…` |
| **H18** | low | T4 | book-covers.test asserts AVIF-sibling over the working tree, so stray untra… | `lib/book-covers.test.ts:84-98` |
| **H19** | low | T4 | listBookVersions issues a single un-paginated, un-limited Query and silentl… | `app/app/api/book/_lib/repo.ts:348-379` |
| **H20** | low | T3 | markNotificationRead is an unconditional UpdateItem on a fully client-contr… | `app/app/api/book/_lib/notifications-repo.ts…` |
| **H21** | low | T4 | putEvent writes append-only analytics events with no uniqueness guard; same… | `app/app/api/book/_lib/analytics-repo.ts:54-…` |
| **H22** | low | T3 | recordEventChapter read-modify-write has no condition guard, allowing dupli… | `app/app/api/book/_lib/events-repo.ts:78-168` |
| **H23** | low | T4 | share-events returns 500 server_error instead of a typed 400 on missing/inv… | `app/app/api/book/me/share-events/route.ts:25` |

---

## Findings (grouped by lane — paste the block under §1)

## Lane A — Learning-loop integrity — quiz grading + progress writes  ·  SEQUENTIAL  ·  12 items

### A1 · Legacy selectedIndex grading path lets a crafted submit pass a chapter with a single correct answer
**A1** · **CRITICAL** · **Opus 4.8 · xhigh** (T1) · Lane A SEQUENTIAL

- **Location:** `app/app/api/book/me/quiz/[bookId]/[chapterNumber]/submit/route.ts:331-365 (scoreQuizResponsesByQuestionId at app/app/api/book/_lib/quiz-service.ts:99)`
- **What's wrong:** The submit handler chooses its grader by `const hasChoiceIds = responses.some(r => Boolean(r.selectedChoiceId))`. If the caller sends responses with ONLY `selectedIndex` (no `selectedChoiceId`), it falls through to `scoreQuizResponsesByQuestionId`, which computes `total = responses.length` (quiz-service.ts:99) with NO check that the number of responses equals the quiz's expected question count. The modern `gradeQuizAttemptQuestions` path enforces `responses.length === questions.length` (quiz-session.ts:258), but the legacy path does not. Because `isLocalV12Package` returns true for v21 books (the entire live catalog), this branch is reachable for every shipping book. Concrete exploit: an authenticated user POSTs `{ attemptNumber: <previousAttemptsCount+1>, responses: [{ questionId: "<one real question id>", selectedIndex: <correct canonical index> }] }`. The question id and its correct canonical index are both obtainable from the GET quiz session (the documented H3 `correctChoiceId` leak encodes the canonical index as `questionId::choice::<index>`). The single response grades 1/1 = 100%, `passed = scorePercent >= passingScorePercent` is true, `buildProgressAfterQuizPass` runs, the chapter is marked complete, the next chapter unlocks, and full first-attempt Insight Points are awarded.
- **Impact:** Complete quiz/completion-gate bypass for the entire live catalog. A user can unlock every chapter and harvest the full quiz-pass + perfect-score + loop IP economy by submitting a single (leaked) correct answer per chapter, defeating the sole chapter-completion gate and corrupting the IP/streak/tier/achievement economy.
- **Fix:** In the legacy branch, reject when the response count does not match the expected question count for the resolved attempt (mirror the `responses.length === questions.length` check). Better: build the canonical attempt question set (with `maxQuestions`) first and require `responses.length === attemptQuestions.length` and that every authored questionId for the attempt is present, regardless of which grader runs. Long term, retire the `selectedIndex`-only legacy path entirely since no current client emits it.

### A2 · Book-completion check compares pinned completedChapters against the CURRENT published version's chapterCount, not the pinned version
**A2** · **HIGH** · **Opus 4.8 · high** (T2) · Lane A SEQUENTIAL

- **Location:** `app/app/api/book/me/quiz/[bookId]/[chapterNumber]/submit/route.ts:471-476 (completedBookNow) using manifest from getPublishedBookManifest; manifest source app/app/api/book/_lib/content-service.ts:19-41`
- **What's wrong:** completedBookNow is computed as completedChapterCount >= manifest.chapterCount, where `manifest` comes from getPublishedBookManifest — which reads catalog.currentPublishedVersion (the LATEST published version), not the user's pinned version. The user's completedChapters come from progress (pinned via progress.contentPrefix). progress.manifestKey (the pinned manifest) is stored but never read here. Per the documented design, the catalog can advance to a new version/chapterCount while each user's pin stays frozen. If v2 ADDS chapters (5->7), a user who finishes all 5 chapters of their pinned v1 gets completedChapterCount(5) >= chapterCount(7) = false, so book_complete IP, completedBookNow, journey advancement, the book-complete achievement, and analyticsTrackBookCompleted never fire — they finished the book but are never credited. If v2 SHRINKS (5->4), a pinned-v1 user who completes chapter 4 gets 4>=4 = true and is falsely flagged complete mid-book, prematurely awarding book_complete IP and advancing journeys.
- **Impact:** Money/economy and progression correctness: missed or duplicate book-complete Insight Point awards, wrong journey/achievement advancement, and incorrect 'completed' status — triggered whenever a book is re-published with a different chapter count, which the architecture explicitly supports.
- **Fix:** Resolve chapterCount from the user's PINNED version, not the current catalog version: read the pinned manifest via progress.manifestKey (readJsonFromS3) or persist chapterCount on the progress row at start time, and use that for the completedBookNow comparison. Do not mix pinned completedChapters with the live catalog's chapterCount.

### A3 · Book-state read routes use the CURRENT published manifest instead of the user's pinned-version manifest
**A3** · **HIGH** · **Opus 4.8 · high** (T2) · Lane A SEQUENTIAL

- **Location:** `app/app/api/book/me/books/[bookId]/state/route.ts:54,61-75,118 (same pattern: state/reset/route.ts:47-51, scenarios/route.ts:255-257)`
- **What's wrong:** These routes resolve the chapter list via getPublishedBookManifest({bookId}) — which reads catalog.currentPublishedVersion — while the user's progress is version-PINNED (progress.pinnedBookVersion / progress.manifestKey / progress.contentPrefix). The version-pin design exists specifically to freeze a reader's view so a catalog advance can't diverge mid-read, yet these routes ignore progress.manifestKey and read the latest published manifest. completedChapters/unlockedThroughChapterNumber are chapter NUMBERS tracked against the pinned version, but chapterIdByNumber is built from the current version's manifest (lines 63-65).
- **Impact:** After a book is republished (e.g. user pinned v3, catalog now v4) any renumbered/removed/reordered chapter makes chapterIdByNumber.get(number) resolve to the WRONG chapterId or '' — corrupting completedChapterIds, unlockedChapterIds, currentChapterId, and chapterScores in the returned state. The user can be shown v4's chapter list while their actual readable content (getUserAccessibleChapter uses progress.contentPrefix) is v3 — a split-brain reader. Worse, if an admin un-publishes the book, getPublishedBookManifest throws 404 book_not_found and every state call breaks for users who already started it, even though their pinned content still exists in S3.
- **Fix:** Read the pinned manifest the user is actually on: readJsonFromS3(contentBucket, progress.manifestKey) (falling back to the published manifest only when no progress exists), so the chapter-number→chapterId mapping matches the version the reader's progress and content are pinned to.

### A4 · Out-of-range authored correctIndex yields a correctChoiceId no choice can match → permanently-failing question
**A4** · **HIGH** · **Opus 4.8 · high** (T2) · Lane A SEQUENTIAL  ·  _status: UNCERTAIN (verify carefully)_

- **Location:** `app/app/api/book/_lib/quiz-session.ts:175-180`
- **What's wrong:** `correctIndex = choices.findIndex(c => c.canonicalIndex === authoredCorrectIndex)` returns -1 when the authored index is out of range. `correctChoiceId` then falls back to `${question.questionId}::choice::${authoredCorrectIndex}` — a choiceId that is NOT in the emitted `choices[]` (whose canonicalIndex values are 0..n-1). Grading compares `selectedChoiceId === correctChoiceId` (line 246), so no selectable choice can ever match the correct answer: the question is always graded wrong for everyone. Combined with the v21 validator bypass (which removes the only range check at validate-book-package.ts:1029), a single out-of-range correctIndex in any v21 book makes that chapter's quiz unpassable, and since quiz pass is the sole completion gate, the book becomes a dead end past that chapter.
- **Impact:** A content defect (bad index) becomes a hard reader-progression block with no error surfaced — the quiz simply can never be passed. Current authored data is clean, but nothing prevents or detects it.
- **Fix:** When findIndex returns -1, treat it as a content error: throw the same `quiz_question_missing_answer_key`-style 500 (or a new 'quiz_answer_key_out_of_range' code) rather than fabricating an unmatchable correctChoiceId. Also restore range validation for v21 via the validator (see v21-validator-bypass).

### A5 · Reset Progress permanently locks the reader at chapter 1 (stale passed quiz state blocks re-unlock)
**A5** · **HIGH** · **Opus 4.8 · xhigh** (T1) · Lane A SEQUENTIAL

- **Location:** `app/app/api/book/me/books/[bookId]/state/reset/route.ts:74-120; interacts with app/app/api/book/me/quiz/[bookId]/[chapterNumber]/submit/route.ts:248-269`
- **What's wrong:** The reset route resets ONLY the canonical BOOK_PROGRESS item (unlockedThroughChapterNumber=1, completedChapters=[], bestScoreByChapter={}) and the BOOK_USER_BOOK_STATE projection. It does NOT delete the per-chapter BOOK_USER_QUIZ_STATE records, which still carry passed=true. The ONLY code path that raises unlockedThroughChapterNumber is buildProgressAfterQuizPass, called by the quiz-submit route — but that route short-circuits at line 248 (`if (quizState?.passed)`) and returns the cached 'passed' session WITHOUT calling buildProgressAfterQuizPass. So after a reset: progress says unlocked=1, but every chapter's quiz state still says passed=true. Re-submitting chapter 1's quiz hits the short-circuit and never re-unlocks chapter 2; getUserAccessibleQuiz/getUserAccessibleChapter for chapter 2 then 403 ('chapter_locked') forever. The reset is reachable from the UI (ResetProgressModal via useBookProgress.resetProgress).
- **Impact:** Any user who uses the 'Reset Progress' button on a book where they have passed at least one quiz becomes permanently stuck at chapter 1 with no in-product way to advance — a hard dead-end that looks like total data loss of their reading access. Support/manual DB intervention is the only recovery.
- **Fix:** In the reset route, also delete (or reset passed=false / attemptsCount=0) all BOOK_USER_QUIZ_STATE rows (and ideally BOOK_USER_LOOP rows) for the book in the same operation. Query SK begins_with the quiz-state/loop prefix for the user+book and batch-delete, or transactionally clear them alongside the progress reset. Alternatively, make the submit short-circuit fall through to re-grade when progress.unlockedThroughChapterNumber < chapterNumber+1 despite quizState.passed.

### A6 · Unconditional full-object Put of BOOK_PROGRESS on quiz pass races with concurrent progress writes and loses completed chapters / unlocks
**A6** · **HIGH** · **Opus 4.8 · xhigh** (T1) · Lane A SEQUENTIAL

- **Location:** `app/app/api/book/_lib/repo.ts:1200-1212 (recordQuizAttemptOutcome) with read at submit route line 201; collides with upsertUserProgress repo.ts:863-878`
- **What's wrong:** On a quiz pass, `recordQuizAttemptOutcome` adds an UNCONDITIONAL `Put` of the entire `nextProgress` object to the single per-book progress item (SK `PROGRESS#<bookId>`, repo.ts:1200-1211 — no ConditionExpression). `nextProgress` is derived from the `progress` snapshot read at the START of the request (submit route line 201 via getUserAccessibleQuiz). Two independent code paths also do full unconditional Puts of the same item: `upsertUserProgress` (repo.ts:863-878), called by `ensureUserBookStarted` (ensure-book-started.ts:289, a read-modify-write that carries the read-time `completedChapters`) and by `me/reading-sessions`. The quiz-state version guard (`attemptsCount = :previousAttemptsCount`) does NOT protect progress because each chapter has a distinct quiz-state SK while all chapters share ONE progress item. Scenario A: user passes chapter 3 and chapter 5 quizzes near-simultaneously from two tabs — both read `completedChapters=[1,2]`, then A writes `[1,2,3]` and B writes `[1,2,5]`; last writer wins and one chapter completion + its unlock is permanently lost. Scenario B: a quiz-pass transaction commits the completion of chapter N between a concurrent reader-open's `getUserProgress` read and its `upsertUserProgress` Put — the reader-open clobbers the just-earned completion/unlock with the stale `completedChapters`.
- **Impact:** Silent loss of a completed-chapter record and the corresponding next-chapter unlock (and bestScore) under realistic multi-tab/multi-device concurrency. The user can be locked out of a chapter they legitimately passed, and the data is unrecoverable without a manual fix.
- **Fix:** Make the progress mutation a conditional read-modify-write or use an `UpdateExpression` that mutates only the changed attributes (ADD/SET on `completedChapters` as a number set, `currentChapterNumber`/`unlockedThroughChapterNumber` via `if greater`, etc.) instead of overwriting the whole item. At minimum, add an optimistic-concurrency guard (e.g., a `progressVersion`/`updatedAt` condition) to the transaction's progress Put and to `upsertUserProgress`, retrying on conflict.

### A7 · ensureUserBookStarted does an unconditional full-item Put of progress, racing with and rolling back quiz-pass unlocks
**A7** · **HIGH** · **Opus 4.8 · xhigh** (T1) · Lane A SEQUENTIAL

- **Location:** `app/app/api/book/_lib/ensure-book-started.ts:243-289 (upsertUserProgress) and app/app/api/book/_lib/repo.ts:863-878 (upsertUserProgress is an unconditional PutCommand)`
- **What's wrong:** ensureUserBookStarted reads progress (line 243), then at line 289 writes it back via upsertUserProgress — an UNCONDITIONAL PutCommand of the full item including the gating fields unlockedThroughChapterNumber / completedChapters / bestScoreByChapter (touchProgressForInteraction spreads ...progress, so those stale values are re-Put). Every quiz submit calls ensureUserBookStarted first. With two concurrent requests (two tabs, a double-tap submit, or a retried request) request B can read progress, then request A's recordQuizAttemptOutcome transaction commits an unlock/completion, then request B's upsertUserProgress lands and overwrites the item with B's stale snapshot — silently rolling back the unlock and the completedChapters entry A just committed. The sibling state PATCH and reset routes explicitly avoid exactly this by using a conditional partial UpdateCommand and call it out in comments, but ensureUserBookStarted does a full Put.
- **Impact:** Lost update on the canonical gating item: a freshly-earned chapter unlock and 'completed' mark can vanish, re-locking a chapter the user just passed and corrupting completedChapters / bestScoreByChapter. Hard to reproduce on demand but inevitable at scale on multi-tab / double-submit usage; produces support tickets that look like 'my progress disappeared'.
- **Fix:** Replace the unconditional full Put in ensureUserBookStarted with a partial conditional UpdateCommand that SETs only the cursor/activity fields (currentChapterNumber via Math-max guard, lastOpenedAt, lastActiveAt, updatedAt) and never writes unlockedThroughChapterNumber/completedChapters/bestScoreByChapter — mirroring the partial-update pattern already used in state/route.ts and state/reset/route.ts.

### A8 · recordQuizAttemptOutcome treats every TransactionCanceledException as a permanent quiz_state_conflict, silently dropping a passed quiz on a transient throttle/conflict
**A8** · **HIGH** · **Opus 4.8 · high** (T2) · Lane A SEQUENTIAL

- **Location:** `app/app/api/book/_lib/repo.ts:1220-1234 (thrown 409 consumed by app/app/api/book/me/quiz/[bookId]/[chapterNumber]/submit/route.ts:436)`
- **What's wrong:** The catch block maps ANY TransactionCanceledException to BookApiError(409, 'quiz_state_conflict', 'Quiz state changed. Refresh and try again.'). DynamoDB cancels a TransactWrite not only on a real ConditionalCheckFailed (the attemptsCount guard at index 1) but also on transient/non-state causes — TransactionConflict (a concurrent write touching the same items), ThrottlingError, ProvisionedThroughputExceeded. Those arrive as TransactionCanceledException with CancellationReasons[i].Code set to 'TransactionConflict'/'ThrottlingError', NOT 'ConditionalCheckFailed'. The code never inspects the reason (it does not use isTransactionConditionFailedAt despite that helper existing and CLAUDE.md mandating it). Scenario: a user passes a quiz; the attempt write is throttled or conflicts with a concurrent reading-activity/loop write to the same user partition. The whole transaction is rolled back (no attempt row, no state update, no progress), the route throws 409 BEFORE awarding flow points / streak / tier / achievements (submit/route.ts:436 precedes all award logic at 443+), and the user is told their state 'changed' even though nothing changed and their answers were correct.
- **Impact:** A correctly-passed chapter quiz is lost on a transient DynamoDB blip: no completion, no unlock, no Insight Points/streak/tier/achievement award, and a misleading 'refresh and try again' message. Under load (throttling) or concurrency this is a real money/engagement-affecting data-loss path, and the 409 invites the user to re-grade which may re-enter cooldown or score differently.
- **Fix:** Distinguish causes: only throw quiz_state_conflict when isTransactionConditionFailedAt(error, 1) is true (the attemptsCount guard) or isConditionalCheckFailed(error). For any other TransactionCanceledException (TransactionConflict/ThrottlingError/etc.) rethrow as a retriable 5xx (or retry the transaction with backoff) so the pass is not silently discarded.

### A9 · Quiz question count for the live catalog is driven by the client-supplied `difficulty`, letting a user choose the smallest set
**A9** · **MEDIUM** · **Sonnet 4.6 · high** (T3) · Lane A SEQUENTIAL

- **Location:** `app/app/api/book/me/quiz/[bookId]/[chapterNumber]/submit/route.ts:185,244-246 and quiz/route.ts:67,112-114`
- **What's wrong:** For strictV12 books (true for the entire v21 catalog via isLocalV12Package), `maxQuestions = QUIZ_QUESTION_COUNTS_BY_DIFFICULTY[difficulty]` where `difficulty` is parsed from the client request body (submit) / query string (GET) — `parseDifficulty(body.difficulty)` at submit route line 185, defaulting to `standard`. Unlike `learningMode`, which is deliberately read server-side from settings to prevent gaming (submit route lines 219-225 comment), `difficulty` is fully client-controlled and never reconciled against server state. With `preserveAuthoredOrder=true`, a user can always request `difficulty:"simple"` to be served and graded on only the first 5 authored questions instead of 7 or 10, while `passingScorePercent` stays fixed. Combined with the leaked answer key (H3), fewer questions means fewer answers to know to pass.
- **Impact:** A user can self-select the easiest quiz length independent of their real learning mode, reducing the effort to clear the completion gate and inflating IP relative to the intended difficulty. Lower severity than the legacy bypass but it is a real, trivially-triggered gaming vector on the live path.
- **Fix:** Resolve the strict-reader question count from server-side state (learning mode / a per-book authored count) the same way `learningMode` is resolved, rather than from the client `difficulty` param; or pin `difficulty` to the value persisted at book-start and validate the submit against it.

### A10 · ensureUserBookStarted can throw 500 progress_init_failed on first book-start due to eventually-consistent read after create
**A10** · **MEDIUM** · **Sonnet 4.6 · high** (T3) · Lane A SEQUENTIAL

- **Location:** `app/app/api/book/_lib/ensure-book-started.ts:276-282; getUserProgress GetCommand has no ConsistentRead (app/app/api/book/_lib/repo.ts:903-918)`
- **What's wrong:** On a first book-start, createProgressIfMissing (a PutCommand) writes BOOK_PROGRESS, then line 277 immediately re-reads it with getUserProgress, which issues a GetCommand WITHOUT ConsistentRead (no ConsistentRead exists anywhere in repo.ts). DynamoDB's default eventually-consistent read can miss a just-written item, in which case progress is null at line 280 and the function throws BookApiError(500, 'progress_init_failed'). Because the quiz submit route calls ensureUserBookStarted first, a quiz submission that also triggers the very first start can intermittently 500.
- **Impact:** Intermittent 500s when a user first opens / first submits a quiz for a book, surfacing as 'Could not initialize progress' and a failed quiz submission, with no client retry guarantee. Low frequency but real and user-facing on the critical onboarding path.
- **Fix:** Reuse the item just written (return the seedProgress object directly instead of re-reading), or pass ConsistentRead:true on the post-create getUserProgress, or retry the read on a null result.

### A11 · summarizeProgress fallback heuristic can never report a sequentially-read book as completed
**A11** · **MEDIUM** · **Sonnet 4.6 · high** (T3) · Lane A SEQUENTIAL

- **Location:** `app/app/api/book/_lib/repo.ts:2421-2430; called without chapterCounts at app/app/api/book/me/progress/route.ts:23`
- **What's wrong:** When chapterCounts is not supplied (the /me/progress GET route calls summarizeProgress(progress, entitlement) with no counts), completion falls back to `completedChapters.length > 0 && currentChapterNumber <= completedChapters.length`. But buildProgressAfterQuizPass always sets currentChapterNumber = max(current, chapterNumber+1) on every pass, so after completing chapter N sequentially, currentChapterNumber = N+1 while completedChapters.length = N, making `(N+1) <= N` always false. The heuristic therefore reports booksCompleted=0 for the normal sequential-reading flow, including when the final chapter is finished (e.g. 5-chapter book: complete ch5 -> currentChapterNumber=6, length=5, 6<=5 false).
- **Impact:** The /me/progress summary always under-reports booksCompleted as 0 for normally-read books. Impact is bounded because the primary dashboard/profile paths compute completion elsewhere (this exact endpoint appears to have no client consumer), but any current/future consumer of this summary gets wrong completion counts.
- **Fix:** Either always pass real chapterCounts into summarizeProgress (derive from catalog/manifests), or change the fallback predicate so it doesn't assume currentChapterNumber stays within completedChapters.length (e.g. treat a book as complete only with a known count, or use `currentChapterNumber <= completedChapters.length + 1` is still wrong — prefer requiring counts).

### A12 · state PATCH writes an unvalidated client-supplied lastOpenedAt into the canonical BOOK_PROGRESS row
**A12** · **LOW** · **Sonnet 4.6 · medium** (T4) · Lane A SEQUENTIAL

- **Location:** `app/app/api/book/me/books/[bookId]/state/route.ts:204-205 and 235-249`
- **What's wrong:** The state PATCH accepts `lastOpenedAt` as any client string (`typeof rawState.lastOpenedAt === 'string' ? rawState.lastOpenedAt : now`) with no ISO/timestamp validation, then writes it into the canonical BOOK_PROGRESS item via the UpdateCommand (:lastOpenedAt). A client can PATCH a garbage or far-future value. lastOpenedAt feeds the 'book started' badge clause (lastOpenedAt !== epoch) and any recency sorting/last-read surfaces on the dashboard.
- **Impact:** A malformed/future lastOpenedAt corrupts last-read ordering and the started-badge signal; no crash and no gating/economy bypass (gating fields are server-derived), so impact is cosmetic/integrity-only.
- **Fix:** Validate lastOpenedAt with isValidIsoTimestamp (already present in ensure-book-started.ts) before persisting, falling back to `now` when invalid; clamp to <= now.


## Lane B — Content pipeline & ingestion (v21)  ·  SEQUENTIAL  ·  9 items

### B1 · v21 adapter silently fabricates answer key (correctIndex=0) for questions missing it, corrupting grading on 3 shipping books
**B1** · **CRITICAL** · **Opus 4.8 · xhigh** (T1) · Lane B SEQUENTIAL  ·  ⚠ group `DG-v21val` → fix together as the v21 validation/answer-key fix

- **Location:** `app/app/api/book/_lib/v21-adapter.ts:100 (server adaptQuiz); app/book/lib/v21-adapter.ts:134 (client adaptQuiz); bypass at app/app/api/book/_lib/validate-book-package.ts:1222-1224`
- **What's wrong:** 78 quiz questions across 3 curated/shipping books carry NO answer key in their raw v21 JSON (pitch-anything: 18, extreme-ownership: 15, the-laws-of-human-nature: 45 — verified by scanning book-packages/*.v21.json: questions have keys [questionId, prompt, choices, explanation] with no correctIndex/correctAnswerIndex). Both adapters coerce the missing key to index 0: server `adaptQuiz` does `correctIndex: typeof r.correctIndex === 'number' ? r.correctIndex : 0`, client does the same. Ingestion writes this fabricated key into the S3 quiz payload (ingestion.ts:248 passes chapter.quiz.questions straight through). The runtime grader (quiz-session.ts:156, content-service.ts:118) was deliberately written to THROW a 500 'quiz_question_missing_answer_key' rather than default to 0 — but the adapter pre-fills 0 BEFORE those guards run, so the guards never fire. Net effect: every reader of those chapters is graded against choice A regardless of the real answer; readers who pick the truly-correct answer are marked wrong whenever A is not the intended answer.
- **Impact:** Silent answer-key corruption on 3 published books. Since passing the quiz is the SOLE chapter-completion / next-chapter-unlock gate, readers can be permanently blocked (or pass for the wrong reasons), with no operator signal. Inflates failure streaks → 60/120/180s cooldowns and the hourly attempt cap, degrading the core reading flow. The 'fail loudly' guards intended to catch exactly this are defeated.
- **Fix:** Make the missing-key case fail at publish time, not silently default at runtime. In both adapters, do NOT default correctIndex to 0 when r.correctIndex is absent — leave it undefined so the runtime guards in quiz-session.ts/content-service.ts can throw. Better: re-run the v13 `parseQuestion`/`enforceSemanticRules` validation on the adapted output before returning from validateBookPackage (see finding v21-validator-bypass), which rejects questions with no answer key. Then fix the 3 source JSONs to add the correct correctIndex.

### B2 · Idempotent re-ingest with publishNow=true silently fails to publish a DRAFT, but reports published:true
**B2** · **HIGH** · **Opus 4.8 · high** (T2) · Lane B SEQUENTIAL

- **Location:** `app/app/api/book/_lib/ingestion.ts:51-73 + admin/ingest/run/route.ts:69-75`
- **What's wrong:** When a prior ingest created a version as DRAFT (publishNow=false) and an operator re-runs the SAME package with publishNow=true, the idempotency branch matches on packageId and returns immediately (lines 57-71) WITHOUT calling publishBookVersion — the params.publishNow flag is completely ignored on the reuse path. The only call to publishBookVersion (line 174) is on the fresh-ingest path. The route nonetheless returns published: publishNow (route line 73) and updates the job to SUCCEEDED.
- **Impact:** An operator who ingests-as-draft then re-ingests-to-publish gets a SUCCEEDED job claiming published:true, but currentPublishedVersion is never set and the book stays DRAFT — so it never appears in the library (listPublishedCatalogItems filters on PUBLISHED) and ensureUserBookStarted 404s book_not_found. The publish silently no-ops with a green status, defeating the standard draft→publish workflow.
- **Fix:** On the idempotent-reuse branch, honor params.publishNow: if the existing version is not PUBLISHED and publishNow is true, call publishBookVersion before returning.

### B3 · v21 packages bypass ALL server-side semantic validation at ingestion (adapter docstring is wrong)
**B3** · **HIGH** · **Opus 4.8 · xhigh** (T1) · Lane B SEQUENTIAL  ·  ⚠ group `DG-v21val` → fix together as the v21 validation/answer-key fix

- **Location:** `app/app/api/book/_lib/validate-book-package.ts:1222-1224 (and v21-adapter.ts:245-262)`
- **What's wrong:** validateBookPackage() returns adaptV21ToV13(raw) immediately for any v21 package and never runs enforceSemanticRules() or parseChapters() on the result. The v21 adapter's own docstring (v21-adapter.ts:247-249) explicitly claims 'the caller (validate-book-package.ts) runs the full v13 validator on the output for defense in depth' — this is FALSE. v21 is the CANONICAL authoring format (all 106 shipped books), so the last server-side defense before content hits S3/DynamoDB is effectively disabled for every real publish. The v13 path's enforceSemanticRules (lines 1143-1207) catches duplicate chapter numbers, duplicate chapterIds, missing required variants, and duplicate questionIds; parseQuestion (1029-1034) range-checks correctAnswerIndex against choices. None of these run for v21. adaptChapter coerces a chapter with a missing/non-numeric `number` to 0 (v21-adapter.ts:206) and adaptQuiz coerces a missing/non-numeric correctIndex to 0 with no range check (v21-adapter.ts:100).
- **Impact:** A v21 authoring bug that produces two chapters with the same `number` (or two missing `number` fields, both → 0) silently passes ingestion; buildChapterKey/buildQuizKey then map both to the same S3 key (e.g. chapters/0000.json) so the second chapter OVERWRITES the first — irreversible content loss with no operator signal. An out-of-range correctIndex grades all readers against a non-existent choice. The documented v13 guardrails give a false sense of safety because they never execute on production content.
- **Fix:** After dispatching through adaptV21ToV13, run the same semantic validation on the adapted package (call enforceSemanticRules and a per-question correctIndex range check), or at minimum assert unique, present, positive chapter numbers and in-range correct indices before writing S3 keys. Then correct the misleading docstring in v21-adapter.ts.

### B4 · v21 packages bypass the entire v13 validator (range/uniqueness/variant-completeness checks) — only adapter defaults guard them
**B4** · **HIGH** · **Opus 4.8 · high** (T2) · Lane B SEQUENTIAL  ·  ⚠ group `DG-v21val` → fix together as the v21 validation/answer-key fix

- **Location:** `app/app/api/book/_lib/validate-book-package.ts:1222-1224`
- **What's wrong:** validateBookPackage early-returns `adaptV21ToV13(raw)` for any v21 package, so NONE of the v13 validation runs on it: not parseQuestion's correct-index-in-range check (line 1029), not enforceSemanticRules' questionId uniqueness (line 1185), chapter-number uniqueness (line 1157), or variant-completeness check (line 1166-1180). The doc comment at line 1248-1250 of v21-adapter.ts claims 'the caller runs the full v13 validator on the output for defense in depth' — that is false; the caller returns the adapter output unvalidated. Concretely: (a) an out-of-range correctIndex (e.g. 5 on a 3-choice question) is passed through; at quiz-session.ts:175 findIndex returns -1 and correctChoiceId falls back to a non-existent `${qid}::choice::5`, making that question UNGRADEABLE (selectedChoiceId can never equal it → always wrong → chapter unpassable). (b) duplicate explicit questionIds collide in the `${questionId}::choice::${idx}` scheme and dedupeQuestionsById silently drops questions. (c) a passingScorePercent < 50 or > 100 is not range-clamped by the validator (only later by buildBundle's Math.max/min, which the server quiz payload does not apply). Current data happens to be clean on (a)/(b)/(c), but the only thing standing between bad authored content and corrupted runtime grading is the adapter's silent defaults — which mask defects rather than reject them.
- **Impact:** Any future v21 book (the entire catalog is v21) with an out-of-range answer index, duplicate questionId, missing variant tier, or bad passing score ships to prod with silently-wrong behavior and no publish-time rejection. The 'defense in depth' the comment promises does not exist.
- **Fix:** After `adaptV21ToV13(raw)`, run the adapted BookPackage back through the v13 field/semantic validation (parseChapter-equivalent re-validation + enforceSemanticRules) and throw BookApiError(422) on issues, instead of returning the adapted object unchecked. At minimum, validate quiz answer-key presence and correctIndex range, and questionId uniqueness, before persisting.

### B5 · Ingest rollback deletes content+version draft but leaves META/CATALOG pointing at the deleted version
**B5** · **MEDIUM** · **Opus 4.8 · high** (T2) · Lane B SEQUENTIAL

- **Location:** `app/app/api/book/_lib/ingestion.ts:152-171 (upsertBookMetaAndCatalog is repo.ts:442-502)`
- **What's wrong:** upsertBookMetaAndCatalog issues two independent full-overwrite PutCommands (META then CATALOG) for the new version, setting currentPublishedVersion/latestVersion to the new version. This is the last operation inside the try, but its two PUTs are not atomic and the catch-block rollback (lines 168-169) only deletes the content prefix and the VERSION row — it never restores META/CATALOG. If the META PUT succeeds and the CATALOG PUT throws (throttle/transient), or any later step in a republish path fails, rollback removes the new VERSION row while META.currentPublishedVersion/latestVersion still reference it.
- **Impact:** On a republish (book already had v3 live), a partial failure can leave BOOK_META.currentPublishedVersion=v4 (and latestVersion=v4) dangling at a version whose row and S3 content were just deleted, while the CATALOG row may still say v3 — META and CATALOG become inconsistent. getBookMeta-based admin views and any future getNextVersionNumber/publish logic keyed off latestVersion now read a phantom version, requiring manual DynamoDB repair.
- **Fix:** Move upsertBookMetaAndCatalog out of the rolled-back try, or capture the prior META/CATALOG state and restore it in the catch; ideally write META+CATALOG in a single TransactWrite so they cannot diverge, and only advance currentPublishedVersion after the version row is durably PUBLISHED.

### B6 · A malformed library catalog.json makes the entire library listing throw 422 instead of degrading
**B6** · **LOW** · **Sonnet 4.6 · medium** (T4) · Lane B SEQUENTIAL

- **Location:** `app/app/api/book/_lib/library-catalog.ts:104-124 (readJsonFromS3 throws invalid_json at storage.ts:46-50)`
- **What's wrong:** readLibraryCatalogIndex swallows only content_not_found and empty_content (lines 115-123) and rethrows everything else, including the invalid_json (422) that readJsonFromS3 raises when JSON.parse fails. catalog.json is a separately-built/promoted artifact (publish-library-assets.ts) written with no atomicity guarantee; a truncated/partial S3 upload or a malformed build yields invalid JSON.
- **Impact:** If book-content/library/catalog.json is ever malformed (partial upload, bad build), listPublishedLibraryCatalog and getPublishedLibraryBookDetail throw 422 and the ENTIRE library page fails for all users — even though the index is purely presentational enrichment (icons/synopsis/pages) and the authoritative catalog lives in DynamoDB. The page should still render from DynamoDB with default presentation.
- **Fix:** Treat invalid_json (and any read error) from the presentation index the same as content_not_found — log and return an empty Map so the library degrades to DynamoDB-only data instead of 500/422-ing.

### B7 · Standalone publish swallows search-index errors and can publish a stale/incomplete public search index
**B7** · **LOW** · **Sonnet 4.6 · medium** (T4) · Lane B SEQUENTIAL

- **Location:** `app/app/api/book/admin/books/[bookId]/versions/[version]/publish/route.ts:36-42 and search-index-builder.ts:139-155`
- **What's wrong:** After publishing, rebuildSearchIndex iterates every published book, fetching each chapter from S3, and silently `continue`s on any per-book or per-chapter read failure (search-index-builder.ts:58-60, 139-142). It then OVERWRITES book-content/library/search-index.json with CacheControl public, max-age=3600. The publish route wraps the whole rebuild in try/catch and only console.errors (route lines 40-42), so a partial rebuild still gets written as the authoritative index.
- **Impact:** A transient S3 read blip during the rebuild silently drops the affected books'/chapters' documents from the global search index, and the truncated index is published with a 1-hour public cache — search results go missing for up to an hour with no failed-publish signal. The publish itself reports success.
- **Fix:** Fail or skip the index write when the rebuild encountered read errors (track a failure count and abort the PutObject if non-zero), or write to a temp key and only swap in on a fully-successful rebuild; surface the failure in the publish response rather than only console.error.

### B8 · updateIngestionJob unconditionally writes bookId/details/errorReportKey = null, wiping a previously-set bookId on the FAILED path
**B8** · **LOW** · **Sonnet 4.6 · high** (T3) · Lane B SEQUENTIAL

- **Location:** `app/app/api/book/_lib/repo.ts:628-639 (FAILED caller app/app/api/book/admin/ingest/run/route.ts:85-89)`
- **What's wrong:** updateIngestionJob always SETs bookId = :bookId with ':bookId': params.bookId ?? null (and details ?? null, errorReportKey ?? null). The FAILED-status update in the ingest run route (route.ts:85) passes no bookId, so the job item's bookId is overwritten to NULL even when the job was created with a bookId (createOrUpdateIngestionJob accepts bookId, and the RUNNING update at route.ts:47 forwards it). The same null-clobber affects details on any caller that omits it.
- **Impact:** An ingestion job that fails loses its bookId association in DynamoDB, making the admin failure record harder to trace back to the target book. Admin-tooling only and non-customer-facing, so impact is limited, but it is a genuine unintended data overwrite.
- **Fix:** Build the UpdateExpression dynamically (only SET fields that were provided), or use if_not_exists / omit the attribute when params.bookId is undefined instead of writing null.

### B9 · v21 adapter synthesizes a time-based packageId when absent, silently defeating ingest idempotency
**B9** · **LOW** · **Sonnet 4.6 · medium** (T4) · Lane B SEQUENTIAL

- **Location:** `app/app/api/book/_lib/v21-adapter.ts:256`
- **What's wrong:** adaptV21ToV13 sets packageId = asString(r.packageId) || `pkg-${Date.now()}`. The entire ingest idempotency mechanism (ingestion.ts:51-73) keys on packageId to avoid multiplying versions and orphaning content on retries (per the comment at ingestion.ts:48-50). A v21 upload that lacks packageId therefore gets a DIFFERENT synthesized id on every ingest attempt, so the idempotency check can never match. All 106 current packages happen to carry a packageId so this is latent, but a single authoring change that drops packageId silently turns every retry into a brand-new version allocation.
- **Impact:** A transient-failure retry (or a duplicate operator click) on a packageId-less v21 file allocates a fresh version each time and orphans the previously-written content prefix, exactly the failure the idempotency design was built to prevent — but with no error surfaced.
- **Fix:** Do not synthesize a packageId for idempotency-critical input. Either require packageId for v21 (reject at validation if absent) or derive a deterministic id from stable content (e.g. a hash of bookId+chapter contentHashes) so retries of identical input collide deterministically.


## Lane C — Money — entitlements, license, gifts, shop  ·  SEQUENTIAL  ·  9 items

### C1 · Gift a Friend charges Insight Points in a committed transaction, then persists the gift code in a separate non-atomic Put — a failure on that Put loses the user's IP with no refund
**C1** · **HIGH** · **Opus 4.8 · xhigh** (T1) · Lane C SEQUENTIAL

- **Location:** `app/app/api/book/me/shop/route.ts:108-174 (deduction tx 108-148; gift-code Put 158-174)`
- **What's wrong:** The Gift a Friend purchase deducts IP and writes the spend ledger in a TransactWriteCommand (lines 108-148), which commits. Only AFTER that commit does it generate and persist the gift code in a SEPARATE PutCommand (lines 158-174) guarded by attribute_not_exists. The gift-code Put is not in the same transaction and has no compensating refund on failure. If that Put throws — a transient DynamoDB error, throttle, or the (astronomically rare but condition-enforced) UUID-prefix collision tripping the ConditionExpression — the route propagates the error and withBookApiErrors returns 500, while the 800 IP have already been irreversibly deducted. The user is charged but receives no gift code and no way to recover the points.
- **Impact:** Silent permanent loss of 800 Insight Points (real earned value, redeemable for Pro passes/book unlocks) on any transient failure of the post-deduction gift-code write. No rollback, no idempotency key to retry safely.
- **Fix:** Move the gift-code Put INTO the same TransactWriteCommand as the IP deduction and ledger write so the spend and the code are atomic. Alternatively, generate the gift code first and include its Put as a third TransactItem (it already carries attribute_not_exists), so a code-collision or any item failure cancels the whole transaction and the IP is never deducted.

### C2 · Redeeming a 7-day gift code (or flow-points pass) overwrites and shortens a longer non-Stripe PRO grant (license / longer pass) — irreversible money/data loss
**C2** · **HIGH** · **Opus 4.8 · xhigh** (T1) · Lane C SEQUENTIAL  ·  ⚠ group `DG-giftexp` → fix together as the non-Stripe expiry-guard fix

- **Location:** `app/app/api/book/me/gifts/[code]/claim/route.ts:89-106 (and parallel: app/app/api/book/_lib/repo.ts:3312-3341 redeemLicenseKey; flow-points-repo.ts:665-686)`
- **What's wrong:** All four non-Stripe PRO grant paths guard ONLY against overwriting a Stripe sub: ConditionExpression is `attribute_not_exists(proSource) OR proSource <> :stripeSource` (gift claim route.ts:96; redeemLicenseKey repo.ts:3330; flow-points repo.ts:673). They do NOT compare expiry. Concrete break: a user holds a license valid 12 months (proSource=license, licenseExpiresAt=+12mo). They then claim a gift code (GIFT_PRO_DAYS=7, _constants.ts). The gift condition passes (proSource=license <> stripe), so it SETS proSource=gift_code, currentPeriodEnd=+7d, and does NOT clear the stale licenseExpiresAt. getUserEntitlement (repo.ts:693-701) now keys expiry off currentPeriodEnd because proSource==="gift_code", so after 7 days the user is downgraded to FREE despite having ~12 months of paid license remaining. The gift code is consumed and the license is already marked redeemed, so the loss is irreversible. The same stomp applies flow_points<->gift in both directions (flow_points sets currentPeriodEnd=passExpiresAt and nulls licenseExpiresAt at repo/flow-points-repo.ts:666; a subsequent gift shortens it).
- **Impact:** A paying license/flow-points user permanently loses the remaining (longer) PRO window by claiming a short gift, with no warning and no recovery path. Direct money harm and a support/chargeback magnet.
- **Fix:** Before overwriting, compare the incoming expiry against the stored grant. Either (a) refuse/no-op the grant when the existing effective PRO window is longer (add a ConditionExpression term like `attribute_not_exists(currentPeriodEnd) OR currentPeriodEnd < :newExpires` for same-style grants and clear the orthogonal expiry field), or (b) EXTEND rather than replace (take max(existing, new) expiry, and when switching grant type clear the other expiry attribute so a stale licenseExpiresAt/currentPeriodEnd can't resurrect or shorten the window).

### C3 · Sticky chargeback marker (disputeOpen) blocks only Stripe re-activation; a charged-back user can immediately restore PRO via license, gift code, or flow-points
**C3** · **HIGH** · **Opus 4.8 · xhigh** (T1) · Lane C SEQUENTIAL

- **Location:** `app/app/api/book/_lib/repo.ts:2078-2080 (only enforcer) vs redeemLicenseKey repo.ts:3329-3330, gift claim route.ts:96, flow-points-repo.ts:672-673`
- **What's wrong:** On charge.dispute.created the webhook downgrades to FREE and sets disputeOpen=true (webhook/route.ts:478-489). The `attribute_not_exists(disputeOpen)` guard that is supposed to block re-grant exists ONLY in updateUserEntitlementFromStripe (repo.ts:2078-2080), i.e. the Stripe path. None of the other PRO-grant writes check disputeOpen: redeemLicenseKey (repo.ts:3329 condition is only the stripe-source guard), the gift claim (route.ts:96), and redeemFlowPointsReward (flow-points-repo.ts:672-673). Concrete break: a user pays via Stripe, files a chargeback (gets disputeOpen=true, plan FREE, proSource cleared). They then redeem any license key / claim a gift / spend flow points — all succeed and set plan=PRO again, because none consult disputeOpen. CLAUDE.md asserts the marker 'blocks all PRO-activation', but the code only blocks one source.
- **Impact:** A user who reversed payment regains full PRO access for free, defeating the chargeback revocation. Repeatable abuse vector and revenue leak.
- **Fix:** Add `attribute_not_exists(disputeOpen)` to the ConditionExpression of redeemLicenseKey (entitlement Update), the gift-claim entitlement Update, and redeemFlowPointsReward's PRO Update — returning a clear 'account on hold pending dispute resolution' error on the conditional failure. Alternatively, centralize all PRO-activation writes through one helper that always includes the disputeOpen guard.

### C4 · FSRS post-lapse stability is not clamped to the prior stability, so pressing 'Again' can schedule a card FURTHER out than before the failure
**C4** · **MEDIUM** · **Sonnet 4.6 · high** (T3) · Lane C SEQUENTIAL

- **Location:** `app/app/api/book/_lib/fsrs.ts:56-63 (nextForgetStability) used at fsrs.ts:147 in scheduleCard`
- **What's wrong:** nextForgetStability(d,s,r) = w[11]*d^-w[12]*((s+1)^w[13]-1)*exp((1-r)*w[14]) is used verbatim as the new stability after a lapse (rating 1), with no min(S_forget, S_prev) clamp. The canonical FSRS-5 reference clamps post-lapse stability to not exceed the pre-lapse stability (a lapse must never increase stability). Numerically verified with the default weights: for low-difficulty, low-stability cards reviewed overdue (e.g. d=1, s=0.3, r=0.1 -> S_forget=1.2 > 0.3; 103 of the sampled low-S/low-D/low-r combinations show S_forget > S_prev). Since nextInterval(S)~=S at 0.9 retention, the new due date is pushed further out than before the failure — the opposite of spaced repetition.
- **Impact:** Core review-scheduling algorithm misbehaves for early-stage cards: a wrong answer can delay (rather than shorten) the next review, degrading retention for exactly the cards the user is struggling with. This is the product's primary learning mechanism.
- **Fix:** Clamp the lapse result: newStability = Math.min(nextForgetStability(...), card.stability) in the rating===1 branch of scheduleCard (fsrs.ts:147), matching the reference FSRS-5 implementation. Optionally also floor at 0.1 for consistency with initStability.

### C5 · Gift-code claim unconditionally overwrites currentPeriodEnd, shortening a longer flow_points/gift PRO window
**C5** · **MEDIUM** · **Opus 4.8 · high** (T2) · Lane C SEQUENTIAL  ·  ⚠ group `DG-giftexp` → fix together as the non-Stripe expiry-guard fix

- **Location:** `app/app/api/book/me/gifts/[code]/claim/route.ts:89-103 (SET ... currentPeriodEnd = :expires) + 96 (condition only blocks stripe)`
- **What's wrong:** The claim transaction sets proSource='gift_code' and currentPeriodEnd = now+GIFT_PRO_DAYS unconditionally, guarded only by ConditionExpression "attribute_not_exists(proSource) OR proSource <> :stripeSource". For flow_points/gift_code PRO, getUserEntitlement (repo.ts:698-700) derives expiry from currentPeriodEnd. A user who redeemed a 30-day flow_points pro pass yesterday (proSource='flow_points', ~29 days left) and then claims a 7-day gift has currentPeriodEnd overwritten to now+7d and proSource flipped to 'gift_code' — silently losing ~22 days of paid-with-IP PRO. The flow-points redeem path guards this with a freeOnly/already-PRO check (flow-points/redeem/route.ts:70-78), but the gift claim has no already-PRO guard and no max(existing, new) on the period.
- **Impact:** A reader loses remaining PRO time they earned (Insight Points are an in-app currency) with no warning; the GET preview never surfaces that claiming will shorten an active pass.
- **Fix:** Either reject the claim when the user already has unexpired non-stripe PRO (return a typed 409 like flow-points redeem), or extend rather than overwrite: set currentPeriodEnd = max(existing currentPeriodEnd, now+GIFT_PRO_DAYS) and only flip proSource when it actually extends.

### C6 · Full license key string is persisted to the analytics table on every redemption attempt, including successful redemptions
**C6** · **LOW** · **Sonnet 4.6 · high** (T3) · Lane C SEQUENTIAL

- **Location:** `app/app/api/book/billing/license/route.ts:27-32,49,63,76,80,84,101 → analytics-repo.ts analyticsTrackLicenseAttempt (stores `code`)`
- **What's wrong:** logAttempt forwards the raw (uppercased) license code to analyticsTrackLicenseAttempt, which writes `code: args.code` into a license_redemption_attempt event for outcomes including 'success'. Valid, single-use codes are thus recorded in a separate datastore. Since codes are single-use and already redeemed on success this is low-risk, but it widens the surface where live/unused codes could appear (e.g. for invalid_format/not_found attempts the attacker-supplied string is also stored verbatim).
- **Impact:** Secret-handling hygiene: license codes (a bearer credential before redemption) land in the analytics store; broad read access there could expose codes. Low because success codes are already consumed and the keyspace is unbruteforceable.
- **Fix:** Log only a non-reversible fingerprint (e.g. last 4 chars or a hash) instead of the full code, matching standard secret-redaction practice for credential attempt logs.

### C7 · License expiry computed with Date.setMonth(getMonth()+validMonths) overflows on end-of-month dates, granting a slightly different window than intended
**C7** · **LOW** · **Sonnet 4.6 · medium** (T4) · Lane C SEQUENTIAL

- **Location:** `app/app/api/book/_lib/repo.ts:3273-3277 (redeemLicenseKey expiresAt)`
- **What's wrong:** expiresAt is `const d = new Date(); d.setMonth(d.getMonth()+validMonths)`. JS setMonth rolls over when the target month has fewer days: redeeming a 1-month key on Jan 31 yields Mar 3 (Feb has no 31st), and on May 31 yields Jul 1. The drift is days-scale and direction depends on the date, so the granted window is not exactly validMonths.
- **Impact:** Cosmetic/edge: a handful of days of over- or under-grant on month-boundary redemptions; the displayed message says 'expires in N months' while the stored date is off by a few days.
- **Fix:** Compute the expiry by clamping the day or by adding whole months safely, e.g. set the date to the 1st before adding months then clamp, or use a date library; alternatively express grants in days for deterministic windows.

### C8 · Non-numeric ?limit on GET /me/reviews yields NaN and getDueCards' slice(0, NaN) returns zero due cards
**C8** · **LOW** · **Sonnet 4.6 · medium** (T4) · Lane C SEQUENTIAL

- **Location:** `app/app/api/book/me/reviews/route.ts:20 and app/app/api/book/_lib/fsrs-repo.ts:110 (.slice(0, limit))`
- **What's wrong:** limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20', 10), 50). The `?? '20'` only handles a MISSING param; a present-but-non-numeric value (e.g. ?limit=abc, ?limit=) makes parseInt return NaN, Math.min(NaN,50)=NaN, and getDueCards receives limit=NaN. The final `.sort(...).slice(0, NaN)` returns [] (verified). The endpoint then reports cards: [], count: 0 — telling a user with due review cards that nothing is due.
- **Impact:** A malformed or empty limit query param (a stale deep link, a buggy client build, or a copy-pasted URL) silently hides all due flashcards, breaking the entire review surface with no error. Reviews are how FSRS retention is driven.
- **Fix:** Coerce defensively: const parsed = Number.parseInt(url.searchParams.get('limit') ?? '20', 10); const limit = Number.isFinite(parsed) ? Math.min(Math.max(1, parsed), 50) : 20; (also guard getDueCards by treating a non-finite limit as the default).

### C9 · POST /me/reviews/[cardId] and POST /me/shop call req.json() without try/catch, returning 500 instead of 400 on a malformed/empty body
**C9** · **LOW** · **Sonnet 4.6 · medium** (T4) · Lane C SEQUENTIAL

- **Location:** `app/app/api/book/me/reviews/[cardId]/route.ts:45 and app/app/api/book/me/shop/route.ts:94`
- **What's wrong:** Both handlers do `requireBodyObject(await req.json())` / `const bodyRaw = await req.json()` with no surrounding try/catch. If the body is empty or not valid JSON, req.json() throws a SyntaxError, which is not a BookApiError, so withBookApiErrors (http.ts:88-110) falls through to the generic 500 server_error. The sibling redeem route (flow-points/redeem/route.ts:44-49) demonstrates the correct pattern: it wraps req.json() in try/catch and falls back to {}.
- **Impact:** A malformed review-grade or shop-purchase request surfaces as a 500 (logged as an unhandled error, alarm noise) instead of a clean 400 invalid_json. Misleads clients and pollutes error monitoring.
- **Fix:** Wrap req.json() in try/catch and default to {} (then requireBodyObject throws the proper 400), mirroring redeem/route.ts.


## Lane D — Money — Stripe webhook & trial email  ·  SEQUENTIAL  ·  4 items

### D1 · Out-of-order invoice.paid after customer.subscription.deleted permanently re-grants PRO (no event-timestamp ordering guard)
**D1** · **HIGH** · **Opus 4.8 · xhigh** (T1) · Lane D SEQUENTIAL

- **Location:** `app/app/api/book/billing/webhook/route.ts:289-343 (and repo.ts:2064-2080)`
- **What's wrong:** Entitlement writes are unconditional last-writer-wins; the handler never compares Stripe event timestamps (`event.created`) against the stored state. Stripe explicitly does not guarantee event ordering and retries can reorder. Scenario: customer.subscription.deleted is processed first (writes plan=FREE, proStatus=canceled, proSource=null per repo.ts:1960-1961). Then a delayed/reordered invoice.paid for the final billing period arrives → it writes plan=PRO/active/proSource=stripe. The proSource clobber guard (repo.ts:2068-2069) permits this because stored proSource is null (`proSource = :nullSource` matches), and the disputeOpen PRO-activation block (2078-2080) doesn't apply. getUserEntitlement never expires a stripe-source grant at read (repo.ts:691), so the user stays PRO indefinitely after their subscription was canceled.
- **Impact:** A canceled user keeps unlimited PRO access (unlimited book unlocks via reserveBookEntitlement) for free, with no future event to correct it unless another subscription webhook happens to fire. Direct revenue leak.
- **Fix:** Stamp the last-applied Stripe event time on the entitlement (e.g. lastStripeEventAt) and add a ConditionExpression on PRO-activation writes that refuses to apply an event older than the stored one (`attribute_not_exists(lastStripeEventAt) OR lastStripeEventAt <= :eventCreated`), using event.created from the webhook envelope.

### D2 · Chargeback on a non-stripe-PRO user is silently swallowed: proSource guard refuses the write AND the event is marked processed, so disputeOpen is never set
**D2** · **MEDIUM** · **Opus 4.8 · high** (T2) · Lane D SEQUENTIAL

- **Location:** `app/app/api/book/billing/webhook/route.ts:478-489 and repo.ts:2068-2110`
- **What's wrong:** The dispute downgrade calls updateUserEntitlementFromStripe(plan=FREE, setDisputeOpen=true). Its ConditionExpression (repo.ts:2068-2069) only allows the write when proSource is absent / stripe / null. If the user's stored proSource is license/flow_points/gift_code (e.g. a flow_points-PRO user who, per the documented checkout gap, opened a 2nd Stripe sub and then charged it back), the condition fails, updateUserEntitlementFromStripe swallows the ConditionalCheckFailed and returns (repo.ts:2100-2108). The sticky disputeOpen marker is therefore NOT written, and the webhook still records the event processed (line 549). The handler comment (line 428-434) claims the guard merely 'protects' non-stripe users, but the real side effect is that the chargeback's sticky marker — meant to block future stale PRO re-activations — is lost entirely for that user.
- **Impact:** A chargeback that should plant a sticky disputeOpen marker leaves no trace for non-stripe-PRO accounts; a later reordered stripe activation could re-grant PRO without the dispute block ever having applied. Narrow combination but real given the documented no-already-PRO-guard checkout gap.
- **Fix:** Set disputeOpen via a path that is not gated by the proSource guard (e.g. a dedicated conditional update that only stamps disputeOpen + audit, independent of plan/proSource), so the chargeback marker is always recorded even when the entitlement downgrade itself is correctly refused.

### D3 · Signature-verification errors 'Timestamp outside the tolerance zone' / 'No webhook payload' return HTTP 500, triggering 3 days of Stripe retries + false ops alarm
**D3** · **MEDIUM** · **Sonnet 4.6 · high** (T3) · Lane D SEQUENTIAL

- **Location:** `app/app/api/book/billing/webhook/route.ts:62-69`
- **What's wrong:** constructEvent failures are mapped to 400 ONLY when `err.message.includes("signature")` (line 65), else they bubble to a 500 (line 68). Stripe SDK v20.4.1 throws StripeSignatureVerificationError with messages that do NOT contain the substring "signature": `'Timestamp outside the tolerance zone'` (node_modules/stripe/cjs/Webhooks.js:160) and `'No webhook payload was provided.'` (Webhooks.js:87). Concrete trigger: a replayed/clock-skewed delivery (or a replay-attack with a stale-but-valid signature outside the 5-min tolerance) is a legitimate signature rejection but throws 'Timestamp outside the tolerance zone' → not caught at line 65 → re-thrown at 68 → withBookApiErrors maps the BookApiError/Error to HTTP 500. The 500 makes Stripe retry the event repeatedly for up to ~3 days for an event that can never verify, and trips the StripeWebhookFailure CloudWatch alarm (line 557) on every retry.
- **Impact:** Replay/clock-skew rejections (a normal, expected category) are misclassified as server failures: wasted Stripe retries, false-positive ops paging on the StripeWebhookFailure alarm, and noise that can mask a genuine webhook outage.
- **Fix:** Detect signature failures by type, not substring: `import Stripe from 'stripe'` and check `if (err instanceof stripe.errors.StripeSignatureVerificationError) throw new BookApiError(400, 'invalid_signature', ...)`. (Stripe.errors.StripeSignatureVerificationError covers all five message variants including timestamp-tolerance and empty-payload.)

### D4 · charge.dispute.created records the event as processed even when user can't be resolved, so the chargeback never revokes access on later redelivery
**D4** · **MEDIUM** · **Opus 4.8 · high** (T2) · Lane D SEQUENTIAL  ·  _status: UNCERTAIN (verify carefully)_

- **Location:** `app/app/api/book/billing/webhook/route.ts:456-489 and 549`
- **What's wrong:** In the dispute handler, userId is resolved via getUserIdByStripeCustomer (line 456-458). If it returns null (customer→user map not present/propagated), recordBillingEvent runs with userId=null but the access-revocation `updateUserEntitlementFromStripe(...setDisputeOpen)` is skipped by the `if (userId)` guard (line 478). The handler then unconditionally records the event as processed via recordStripeWebhookEvent (line 549). On any later redelivery, hasStripeWebhookEventBeenProcessed short-circuits (line 80-82), so the downgrade is never retried — access is never revoked despite a real chargeback.
- **Impact:** If the customer→user map is missing at dispute time, the chargebacked user keeps PRO permanently. Lower likelihood (the map is written at checkout, and you can't dispute a charge you never made), but the failure is silent and irreversible without manual intervention.
- **Fix:** When a dispute resolves to no userId, throw a 500 (user_resolution_failed) like the other handlers do, so Stripe retries until the map propagates — instead of recording the event processed and silently dropping the revocation.


## Lane E — Email, notifications & suppression  ·  SEQUENTIAL  ·  5 items

### E1 · Per-category email unsubscribe is a no-op for all createNotification emails (CAN-SPAM/CASL violation)
**E1** · **HIGH** · **Opus 4.8 · high** (T2) · Lane E SEQUENTIAL

- **Location:** `app/app/api/book/_lib/notifications-repo.ts:79 (gate) + email/unsubscribe/route.ts:79-95 (applyUnsubscribe)`
- **What's wrong:** createNotification gates email sends ONLY on `notifPrefs.channels?.email === true` (line 79). It never consults the per-category flags. But the unsubscribe link embedded in those emails maps the notification type to a category via emailCategoryForNotificationType (line 88) and the unsubscribe route's applyUnsubscribe writes per-category flags: celebration→badgeCelebrationEnabled/achievementAlertsEnabled=false, streak→streakReminderEnabled=false, weekly_digest→weeklyDigestEnabled=false, welcome_back→welcomeBackEnabled=false. Concrete scenario: a user receives a `badge_earned` email (category=celebration), clicks the one-click 'Unsubscribe from achievement emails' link. The route sets badgeCelebrationEnabled=false and achievementAlertsEnabled=false, the confirmation page says 'You're unsubscribed', but createNotification ignores both flags and keeps emailing every future badge_earned/tier_up/streak_milestone/insight_spark/partner_nudge/scenario_* because channels.email is still true. Only the master 'all' unsubscribe (channels.email=false) actually stops them. The cron nudge handlers (streak-at-risk, weekly-digest, welcome-back) DO honor their flags, so this gap is specific to the in-app createNotification path.
- **Impact:** A user who unsubscribes from a specific email category via the legally-required one-click link continues receiving that category indefinitely. This is a direct CAN-SPAM §5(a)(4) / CASL §6 violation (opt-out must be honored), and it drives complaint rates up — which damages SES sender reputation and risks SES account suspension.
- **Fix:** In createNotification, before sending the email, compute the category (already done at line 88) and check the matching per-category flag in notifPrefs (e.g. category==='celebration' → require notifPrefs.badgeCelebrationEnabled!==false && notifPrefs.achievementAlertsEnabled!==false; 'streak' → streakReminderEnabled!==false; etc.) in addition to channels.email===true. Mirror the same category→flag map that applyUnsubscribe uses so unsubscribe links are honored.

### E2 · Trial-ending email permanently lost on any transient send failure (claim recorded before send, error swallowed)
**E2** · **HIGH** · **Opus 4.8 · xhigh** (T1) · Lane E SEQUENTIAL

- **Location:** `app/app/api/book/_lib/trial-ending-email.ts:122-140 + billing/webhook/route.ts:398-400`
- **What's wrong:** markTrialEndingEmailSent claims the per-(customer,trial_end) dedup marker BEFORE dispatching (line 122-127), then calls sendEmail (line 129). sendEmail swallows all SES errors and returns {sent:false} rather than throwing (email-service.ts:49-52), and the function returns {sent: result.sent} without releasing the claim. The webhook caller wraps the whole thing in `.catch()` (webhook/route.ts:398-400) and returns HTTP 200 regardless. Concrete scenario: Stripe fires customer.subscription.trial_will_end; the dedup row is written; SES throttles/transiently fails so sendEmail returns {sent:false}; the function returns and the webhook returns 200. Stripe never retries (it got a 200), and even if it did redeliver, markTrialEndingEmailSent now returns false ('already_sent') so the send is blocked forever. The user is never warned of the imminent first charge.
- **Impact:** On any transient SES failure the user is charged at trial end with no pre-charge notice — exactly the card-network-required free-trial→paid reminder the code claims to guarantee. Leads to surprise charges, disputes/chargebacks, and a CASL/card-rule gap. Unlike the documented designs, this is silent and unrecoverable.
- **Fix:** Either claim the dedup marker only AFTER sendEmail returns sent:true, or release/delete the marker when result.sent is false (as the admin-segment-notify path does on failure). Also have sendTrialEndingEmail throw or return a falsey-sent so the webhook can decide whether to surface a non-2xx for retry on transient failures.

### E3 · App-side email config silently falls back to dead legacy host while the lambda refuses to send
**E3** · **MEDIUM** · **Sonnet 4.6 · high** (T3) · Lane E SEQUENTIAL

- **Location:** `app/app/api/book/_lib/email-compliance.ts:29`
- **What's wrong:** getEmailComplianceConfig (app-side) uses appBaseUrl fallback `"https://chapterflow.siliconx.ca"` when CHAPTERFLOW_APP_BASE_URL/NEXT_PUBLIC_CHAPTERFLOW_APP_URL are unset. The infra lambda copy (infra/lambda/lib/email-compliance.ts:100-107,252-262) deliberately uses an EMPTY appBaseUrl and REFUSES to send commercial email when it's missing, with the comment 'the legacy host no longer serves the unsubscribe route'. The app-side createNotification (notifications-repo.ts) and trial-ending-email gate on senderEmail/postalAddress but NOT on appBaseUrl, so if the env is misconfigured the app would mint unsubscribe URLs, List-Unsubscribe headers, and CTA links pointing at the dead siliconx.ca host — a non-working unsubscribe link, which is itself a CASL/CAN-SPAM violation. In prod this is masked because CHAPTERFLOW_APP_BASE_URL is asserted present at synth, but the two code paths disagree on the safety contract.
- **Impact:** A misconfiguration that the lambda treats as a hard kill-switch is silently papered over on the app side by emitting a dead unsubscribe/CTA host, producing non-compliant emails with broken one-click unsubscribe instead of safely refusing to send.
- **Fix:** Remove the siliconx.ca fallback (use '' like the lambda) and have the app-side commercial senders (createNotification) refuse to send when config.appBaseUrl is empty, matching the lambda's appBaseUrl kill-switch.

### E4 · No per-user device cap; createNotification push loop fans out over all registered endpoints
**E4** · **LOW** · **Sonnet 4.6 · medium** (T4) · Lane E SEQUENTIAL

- **Location:** `app/app/api/book/me/devices/register/route.ts:33-48 + notifications-repo.ts:116-140`
- **What's wrong:** The device register route Puts one row per endpoint with no cap on how many devices a single user may register (the SK is a hash of the endpoint, so distinct endpoints accumulate). createNotification's push branch queries ALL DEVICE# rows and loops sending to each (line 130-140) with no bound. Endpoints must pass isAllowedPushEndpoint (only real push hosts over HTTPS), which limits SSRF, but a client could still register a large number of distinct allowlisted-host endpoints, inflating both the device table and the per-notification fanout.
- **Impact:** A buggy or malicious authenticated client can bloat storage and amplify per-notification work (and outbound web-push requests) unboundedly. SSRF is already mitigated by the allowlist, so impact is limited to resource/cost amplification.
- **Fix:** Cap registered devices per user (e.g. evict the oldest by lastSeenAt beyond N) at register time, and bound/limit the device query in createNotification's push fanout.

### E5 · Suppression check fails open — DynamoDB blip re-enables sends to hard-bounced/complained addresses
**E5** · **LOW** · **Sonnet 4.6 · medium** (T4) · Lane E SEQUENTIAL

- **Location:** `infra/lambda/lib/email-compliance.ts:62-80 (isEmailSuppressed catch→false); app/app/api/book/_lib/repo.ts:1730-1743 (no catch, throws)`
- **What's wrong:** The lambda isEmailSuppressed swallows any lookup error and returns false (fails open) so a transient DynamoDB issue doesn't drop all email. The trade-off: during a DynamoDB partial outage the cron will email addresses that previously hard-bounced or filed a complaint, because the suppression GetItem silently returns 'not suppressed'. Note also an asymmetry: the app-side repo isEmailSuppressed (repo.ts:1730) has NO try/catch and would THROW on a read error, while the lambda copy returns false — the two replicas have different failure semantics for the same logical check.
- **Impact:** During a DynamoDB blip the reminder cron can send to complained/bounced addresses, raising SES complaint/bounce rates and risking SES reputation throttling or account review. Low likelihood (requires a DynamoDB read failure) but high blast-radius for sender reputation.
- **Fix:** Consider failing closed (skip the individual send, not all email) on suppression-read errors for complaint-suppressed addresses, or at minimum make the two replicas' error handling consistent and emit a metric/alarm when the suppression check errors so operators see it.


## Lane F — Infra, edge & server-env  ·  PARALLEL  ·  13 items

### F1 · Client-spoofable X-Forwarded-For defeats the network-velocity free-unlock fraud guard
**F1** · **HIGH** · **Opus 4.8 · xhigh** (T1) · Lane F PARALLEL

- **Location:** `app/app/api/book/_lib/abuse.ts:48-62 (readIp), used by assertFreeUnlockAllowed at :209-285; infra confirms behavior at infra/lib/chapterflow-frontend-stack.ts:661-680`
- **What's wrong:** readIp() prefers the leftmost x-forwarded-for entry over the trusted cloudfront-viewer-address (which is only the LAST fallback). In this deployment the CloudFront origin-request policy is ALL_VIEWER_EXCEPT_HOST_HEADER, which (per the infra comment at chapterflow-frontend-stack.ts:672-678) forwards all viewer headers — including a client-supplied X-Forwarded-For — and does NOT inject the cloudfront-viewer-* geo headers. CloudFront appends the real viewer IP to any client XFF, so the Lambda receives `X-Forwarded-For: <attacker-chosen>, <realIP>` and readIp returns `<attacker-chosen>` via split(',')[0]. cloudfront-viewer-address is never present, so the trusted fallback is dead code. Concrete attack: a user farming free books sends a different forged X-Forwarded-For (and rotates/clears the cf_device cookie) on each /book free-unlock request. coarseNetworkPrefix() then derives a fresh /24 (or /64) per request, so deviceFreeUnlockUsers30d / networkUsers24h / networkUserAgentUsers24h never accumulate and assertFreeUnlockAllowed stays 'low'. All velocity guards (device_free_unlock_velocity, network_user_agent_velocity, stacked_shared_signals, network_velocity) are bypassed, allowing unlimited free-book grants from one machine. The same spoofable readIp also keys the /auth/refresh rate-limit fallback (app/auth/refresh/route.ts:26-40).
- **Impact:** Free-book entitlement farming at scale (direct revenue loss): the abuse signal meant to cap multi-account free unlocks per network/device is fully attacker-controlled. The email_verification_required (medium) and free_access_review_required (high) gates can be skipped indefinitely.
- **Fix:** Trust only CloudFront-derived client IP. Read cloudfront-viewer-address FIRST (and if the origin-request policy doesn't forward it, add a CloudFront Function / managed policy that injects it, or take the RIGHTMOST x-forwarded-for hop that CloudFront appended) and ignore the client-supplied leftmost XFF. Do not treat raw x-forwarded-for[0] as trusted. Apply the same correction to ensure-book-started.ts, auth/refresh/route.ts, and location.ts for consistency.

### F2 · Nudge cron sub-handlers send email on opt-OUT (channels.email !== false) while channels is never populated — unsolicited commercial email by default
**F2** · **HIGH** · **Opus 4.8 · xhigh** (T1) · Lane F PARALLEL  ·  ⚠ group `DG-email` → fix together as the one email-consent decision

- **Location:** `infra/lambda/lib/weekly-digest.ts:115, infra/lambda/lib/welcome-back-nudge.ts:99, infra/lambda/lib/streak-at-risk.ts:144`
- **What's wrong:** The canonical email-consent convention in the app gates commercial email on channels?.email === true (opt-IN) — see app/app/api/book/_lib/notifications-repo.ts:79 and the reminder cron itself at infra/lambda/reading-reminder-cron.ts:194. But the three nudge sub-handlers gate on notifications?.channels?.email !== false (opt-OUT). The client settings default state (app/book/hooks/useBookPreferences.ts:195-210) contains NO channels object at all, and the settings client (BookSettingsClient.tsx persistReminderSchedule / backfill) never writes settings.notifications.channels — so for essentially every real user channels is undefined. Result: undefined !== false is true, so weekly digest (default weeklyDigestEnabled:true), welcome-back (welcomeBackEnabled:true), and streak-at-risk (streakReminderEnabled:true) emails are SENT by email to users who never opted into the email channel, while the reading-reminder email (and all in-app-derived emails) are NOT.
- **Impact:** Unsolicited commercial email to users who never enabled email notifications — a CASL/CAN-SPAM exposure for a Canadian (chapterflow.ca) product — and an inconsistent product experience (reminder emails never arrive, but digest/welcome/streak do). Also inflates SES send volume / bounce-complaint risk against deliverability.
- **Fix:** Make the three nudge handlers use the same opt-IN check as notifications-repo and the reminder cron (channels?.email === true), OR explicitly seed channels.email when a user opts into email so the !== false default is meaningful. Pick ONE consent model across all four senders.

### F3 · WAF AWSManagedRulesCommonRuleSet (no rule overrides) will 403 legitimate API POSTs containing XSS-lookalike text (display names, free-text)
**F3** · **HIGH** · **Opus 4.8 · high** (T2) · Lane F PARALLEL

- **Location:** `infra/lib/chapterflow-frontend-stack.ts:690-735 (WebAcl, AWSManagedCommonRuleSet priority 1, overrideAction none, no ruleActionOverrides); applies to default behavior serverOrigin lines 737-748`
- **What's wrong:** All /app/api/* traffic is served by the CloudFront default behavior (serverOrigin) and therefore passes through the attached WAF WebACL. The AWS managed common rule set is added with overrideAction:{none:{}} and NO ruleActionOverrides, so its Block-mode sub-rules CrossSiteScripting_BODY/CrossSiteScripting_QUERYARGUMENTS and SizeRestrictions_BODY are fully active on every JSON body. CrossSiteScripting_BODY routinely false-positives on benign JSON whose values contain angle brackets / 'javascript:' / 'on...=' substrings. Concrete trigger: a user sets a display name like '<3 reading' or 'javascript fan' via EditProfileModal (POST to /app/api/book/me/profile), or asks AskBookDrawer a question containing '<script' or '<onload', or submits a book request — WAF returns 403 at the edge before the request ever reaches the Lambda, so the user sees a generic failure with no app-level error and the action silently cannot complete.
- **Impact:** Real users are intermittently blocked from saving profiles/settings, asking questions, or submitting requests based on innocuous text content, with an opaque 403 the app cannot explain or recover from. Hard to reproduce in QA, surfaces post-launch as 'random' save failures.
- **Fix:** Add ruleActionOverrides on the AWSManagedRulesCommonRuleSet to set CrossSiteScripting_BODY (and likely SizeRestrictions_BODY) to Count for the JSON-API behaviors, or scope a separate WebACL/rule that exempts /app/api/* from body-content inspection (the API already validates/escapes server-side and is not an HTML sink). At minimum run the common rule set in Count first and confirm clean before Block.

### F4 · Reading-reminder email is gated on channels.email === true but channels is never persisted, so reminder emails are never sent
**F4** · **MEDIUM** · **Sonnet 4.6 · high** (T3) · Lane F PARALLEL  ·  ⚠ group `DG-email` → fix together as the one email-consent decision

- **Location:** `infra/lambda/reading-reminder-cron.ts:194`
- **What's wrong:** processReminderUser sends the reminder email only when (notifPrefs.channels)?.email === true. As established above, settings.notifications.channels is never written by the settings UI (no channels in defaultBookPreferencesState, and BookSettingsClient only persists reminderTimeLocal/reminderTimezone + boolean toggles). A user who enables 'reading reminders' and sets a reminder time therefore receives the in-app notification but NEVER the email, because channels.email is undefined (not === true).
- **Impact:** Daily reading-reminder emails — a core retention/engagement feature — silently never send for any normal user. The in-app notification masks the failure, so it looks like it 'works'.
- **Fix:** Either default-write channels.email:true when a user enables reading reminders, or relax this specific check to !== false to match the other nudge handlers — but reconcile with the consent-model decision in the finding above so reminder and digest behave the same way.

### F5 · Reminder/nudge cron has no error or duration alarm and no timeout headroom; serial per-user sub-handlers can blow the 5-min timeout and silently drop users
**F5** · **MEDIUM** · **Opus 4.8 · high** (T2) · Lane F PARALLEL

- **Location:** `infra/lib/chapterflow-backend-stack.ts:412-477 (ReadingReminderCron, 5-min timeout, no alarm); infra/lambda/lib/weekly-digest.ts:40-159 / streak-at-risk.ts:56-182 / welcome-back-nudge.ts:31-136 (per-user serial awaits over all users)`
- **What's wrong:** The cron's own header (reading-reminder-cron.ts:21-31) flags that the three nudge sub-handlers still iterate EVERY user serially with 3-5 awaited DynamoDB round-trips each, and that a duration/timeout alarm 'lives in the backend stack' as remaining work. That backend stack creates NO alarm on reminderFn (only table-throttle + ops-failure alarms exist). On a few-thousand-user base, processWeeklyDigest (Sundays) does up to ~5 serial round-trips/user across all users and can exceed the 5-minute Lambda timeout, dropping whichever users it reaches last — with no alarm, this silent partial-failure is invisible in production.
- **Impact:** On Sundays / at scale, a subset of users silently stop receiving digests/nudges (and any in-app notification the handler would have written) with no operator signal. Identical class of silent drop the H16 work was meant to close, but only the reminder pass was fixed; the sub-handlers and the observability gap remain.
- **Fix:** Add a CloudWatch alarm on reminderFn errors + duration (approaching 300s) wired to opsAlertsTopic, and bound the sub-handlers with the same runWithConcurrency pattern already used for the reminder pass (or move them off the single 5-min cron). Even before the throughput fix, the alarm makes the silent drop visible.

### F6 · SES suppression handler swallows DynamoDB write failures (no re-throw, no DLQ, no alarm) — bounce/complaint suppressions can be permanently lost
**F6** · **MEDIUM** · **Opus 4.8 · high** (T2) · Lane F PARALLEL

- **Location:** `infra/lambda/suppression-handler.ts:84-104; infra/lib/chapterflow-backend-stack.ts:521-531 (no onFailure DLQ, no error alarm)`
- **What's wrong:** The suppression handler catches each PutCommand failure (line 102), logs, and continues without re-throwing. SNS therefore sees the invocation as successful and never retries, and there is no DLQ or error/invocation alarm on EmailSuppressionHandler in the backend stack. A transient DynamoDB write failure (throttle, blip) on a Permanent bounce or Complaint event means the BOOKSUPPRESS#<email> record is never written and the event is gone forever (SNS already delivered it). isEmailSuppressed then returns false on every subsequent send, so commercial email keeps going to an address that hard-bounced or filed a complaint.
- **Impact:** Permanent loss of a suppression record → continued sending to complainers/hard-bounces → deliverability/reputation damage and a CASL implied-opt-out violation, with zero observability (no alarm fires).
- **Fix:** Re-throw (or collect-and-throw) on write failure so SNS retries, AND attach an onFailure/DLQ (SQS) destination to the suppression Lambda subscription plus a CloudWatch error alarm wired to the ops SNS topic. SES account-level suppression mitigates some hard bounces but not complaint-driven app-layer opt-out.

### F7 · isSkippableSsmError swallows AccessDenied on the legitimate prefixed parameter, caching SSM-only config as permanently missing on an IAM misconfig
**F7** · **MEDIUM** · **Opus 4.8 · high** (T2) · Lane F PARALLEL

- **Location:** `app/app/api/_lib/server-env.ts:47-56 (skip at :115), 120-133, 156-159`
- **What's wrong:** isSkippableSsmError returns true for ANY candidate whose error name includes 'AccessDenied' (line 54), and loadFromSsm `continue`s past it without recording lastError (line 115). This is intended only for the unscoped bare-name fallbacks the IAM role legitimately can't read. But it also fires for the ENV-PREFIXED candidate `${SSM_PREFIX}/<KEY>` — the one that is supposed to be in scope. If the IAM SsmConfigAccess statement is ever mis-scoped (prefix typo, region mismatch, KMS-decrypt denial on a SecureString since WithDecryption:true is used at line 107), the real parameter returns AccessDenied, gets skipped, all bare-name candidates are also AccessDenied/skipped, loadFromSsm returns undefined with no lastError, and getServerEnv caches the name in missingCache PERMANENTLY for the process lifetime (lines 156-159) instead of failing loudly. SSM-only vars (VAPID_*, SES_SENDER_EMAIL per the documented matrix) then silently resolve to undefined.
- **Impact:** An IAM/KMS misconfiguration on SecureString config silently disables push notifications and transactional email with no error surfaced and no retry for the life of the Lambda container — a silent prod outage that the loud-fail SSM_PREFIX design was meant to prevent. KMS AccessDenied on decryption is the most likely real trigger.
- **Fix:** Only treat AccessDenied as skippable for the unscoped bare-name candidates, not for the SSM_PREFIX-scoped candidate (or, when SSM_PREFIX is set, record AccessDenied on the prefixed name as lastError so it propagates/throws rather than being cached as a miss).

### F8 · Email body templates interpolate user displayName into HTML without escaping (self-targeted HTML injection)
**F8** · **LOW** · **Sonnet 4.6 · high** (T3) · Lane F PARALLEL

- **Location:** `infra/lambda/lib/email-templates/reading-reminder.ts:8 (and welcome-back/weekly-digest/streak-at-risk templates use the same unescaped ${name})`
- **What's wrong:** readingReminderEmail and the sibling templates inject params.name directly into htmlBody (e.g. `<p>Hi ${params.name},</p>`), while email-compliance.ts has an escapeHtml helper that is applied only to the footer. A displayName containing HTML (e.g. '<img src=x onerror=...>' or just stray '<'/'>') is rendered raw in the email. Because the email is sent only to that same user's own address, the blast radius is self-targeted, but it can still break rendering and is an unnecessary injection sink.
- **Impact:** Self-only HTML injection into outbound emails; cosmetic/rendering breakage for users with markup in their name, and a latent sink if any template name source ever becomes attacker-influenced.
- **Fix:** Apply escapeHtml(name) when interpolating into htmlBody across all four templates (text body is fine), reusing the helper already present in email-compliance.ts.

### F9 · Email-events SNS topic policy allows ses.amazonaws.com Publish with no aws:SourceAccount/SourceArn condition (confused-deputy)
**F9** · **LOW** · **Sonnet 4.6 · high** (T3) · Lane F PARALLEL

- **Location:** `infra/lib/chapterflow-backend-stack.ts:495-501`
- **What's wrong:** The ChapterFlowEmailEvents topic resource policy grants sns:Publish to principal ses.amazonaws.com with no conditions. AWS's own guidance for service-principal publish grants is to constrain with aws:SourceAccount (and ideally aws:SourceArn of the configuration set / sending identity). Without it, the SES service principal from ANY AWS account could be induced to publish to this topic, injecting forged Bounce/Complaint events into the suppression handler — which would write attacker-chosen BOOKSUPPRESS#<email> records and suppress arbitrary recipients (denial of email to targeted users).
- **Impact:** A confused-deputy path to suppress (block email to) arbitrary addresses by spoofing SES bounce/complaint events from another account into the topic. Low likelihood but trivially fixed.
- **Fix:** Add conditions: { StringEquals: { 'aws:SourceAccount': cdk.Aws.ACCOUNT_ID } } (and an aws:SourceArn on the configuration-set event destination ARN if feasible) to the topic's addToResourcePolicy statement.

### F10 · Page-guard auto-reactivation write failure fails open silently, leaving status='deactivated'
**F10** · **LOW** · **Sonnet 4.6 · medium** (T4) · Lane F PARALLEL

- **Location:** `app/_lib/require-dashboard-access.ts:83-98`
- **What's wrong:** In requireDashboardAccess, a deactivated user triggers setAccountStatus(...'active'...) on page load (line 85-87) and then returns. If that DynamoDB write throws, it is caught at line 93-98 and (since it is not a redirect error) swallowed as fail-open — the function returns implicitly (undefined) and the page renders, but the account stays 'deactivated' in DynamoDB. The user now has a rendered dashboard while still deactivated; their next API call goes through requireActiveBookUser, which will again attempt reactivation (so it usually self-heals), but if the write keeps failing the account-status record and the page view are inconsistent and the 'reactivated' audit/state is never recorded. Minor because requireActiveBookUser re-attempts and deactivated is allow-with-reactivate, not block.
- **Impact:** Transient state desync between the rendered page and the persisted account status; the reactivation audit event may be missed. No access escalation (deactivated is a fail-open-allow state by design).
- **Fix:** On a reactivation write failure, log it explicitly (distinct from the read-failure path) and/or surface a soft retry; ensure the audit/event for reactivation is best-effort retried. Optionally re-check status after the failed write before rendering.

### F11 · Settings-page isAdmin flag is always false in prod (ADMIN_EMAILS/ADMIN_SUBS never reach the Lambda)
**F11** · **LOW** · **Sonnet 4.6 · medium** (T4) · Lane F PARALLEL

- **Location:** `app/book/settings/page.tsx:20-34`
- **What's wrong:** The settings page computes isAdmin from process.env.ADMIN_SUBS / process.env.ADMIN_EMAILS read via RAW process.env. Per the env model (CLAUDE.md / server-env.ts), only CDK-injected data-plane names and workflow-injected secrets reach the prod OpenNext Lambda; arbitrary vars like ADMIN_EMAILS/ADMIN_SUBS read straight from process.env are NOT injected, so they are undefined in prod. splitCsv(undefined) yields an empty set, making isAdmin always false in production. The admin entry/link gated on isAdmin in BookSettingsClient therefore never appears for real admins. (Not a security hole — actual admin API routes are correctly gated by requireAdminUser via Cognito group — but the affordance is dead.)
- **Impact:** Admins cannot reach the admin area via the settings UI in production; the gating mechanism is also inconsistent with the rest of the app (Cognito group vs. an env allowlist that doesn't exist at runtime).
- **Fix:** Derive admin status the same way the API does — check the Cognito group from requireUser().groups against getBookAdminGroupName() — instead of an un-injected process.env allowlist, or inject ADMIN_EMAILS/ADMIN_SUBS into the server Lambda via infra/bin/app.ts serverEnv.

### F12 · getAppBaseUrl returns a loopback CHAPTERFLOW_APP_BASE_URL verbatim in prod (Stripe success/return URLs point at localhost)
**F12** · **LOW** · **Sonnet 4.6 · high** (T3) · Lane F PARALLEL  ·  _status: UNCERTAIN (verify carefully)_

- **Location:** `app/app/api/book/_lib/env.ts:57-72 (return at :62); call sites app/app/api/book/billing/checkout-session/route.ts:130-131 and app/app/api/book/billing/portal-session/route.ts:53`
- **What's wrong:** getAppBaseUrl reads CHAPTERFLOW_APP_BASE_URL / NEXT_PUBLIC_CHAPTERFLOW_APP_URL via getServerEnv and returns the value with only trailing slashes stripped (line 62). It does NOT validate the host is non-loopback. resolvePublicOrigin (server-origin.ts:48-53) deliberately rejects a loopback APP_BASE_URL in prod and logs a warning, but getAppBaseUrl has no equivalent guard. The prod synth check (infra/bin/app.ts:110) only asserts CHAPTERFLOW_APP_BASE_URL is non-empty, never that it is a public https origin. If an operator (or a stale SSM param at /chapterflow/prod/CHAPTERFLOW_APP_BASE_URL, since getServerEnv falls back to SSM) yields http://localhost:3000 or an internal hostname, checkout-session/route.ts builds success_url/cancel_url and portal-session builds return_url from it. Stripe will reject the loopback URL (checkout sessions require a publicly resolvable absolute URL) or, worse, redirect a paying user to a dead localhost page after a successful charge.
- **Impact:** A misconfigured/stale base URL silently breaks the prod payment flow: checkout session creation 500s (Stripe rejects localhost success_url) or users land on an unreachable host after paying. The auth path (resolvePublicOrigin) self-heals this case but the money path does not, so the two surfaces disagree on what is a valid prod origin.
- **Fix:** Mirror resolvePublicOrigin's loopback guard in getAppBaseUrl: after resolving chapterFlowExplicit, parse it and, when NODE_ENV==='production', reject (or throw) if the hostname is loopback/internal, falling through to the existing prod throw. Optionally validate it parses as an absolute https URL.

### F13 · resolvePublicOrigin trusts attacker-controllable x-forwarded-host when no base URL is configured; getServerOrigin callers emit it into user-facing URLs
**F13** · **LOW** · **Sonnet 4.6 · high** (T3) · Lane F PARALLEL

- **Location:** `app/app/_lib/server-origin.ts:59-65; getServerOrigin :74-81; consumer app/app/api/book/me/pairs/invite/route.ts:22-26`
- **What's wrong:** When neither APP_BASE_URL nor CHAPTERFLOW_APP_BASE_URL is set, resolvePublicOrigin falls through to firstForwardedValue(x-forwarded-host) || host (lines 59-65), both of which are request-controllable on a directly reachable origin. getServerOrigin() passes NO fallbackOrigin, and me/pairs/invite/route.ts builds a user-facing inviteUrl (`${origin}/pair/${code}`) from it (line 25); /auth/login and /auth/callback also use resolvePublicOrigin's origin as the base for redirect URLs. In prod this is mitigated because CHAPTERFLOW_APP_BASE_URL is synth-required and wins, but the safety of every consumer rests entirely on that one env var being present — there is no defense-in-depth host allowlist, so any env (preview/staging/dev-deploy) that forgets it lets a forged Host header poison invite links and auth redirect origins.
- **Impact:** In any deployed environment missing the configured base URL, an attacker-supplied x-forwarded-host is reflected into shareable invite URLs and auth redirect bases (host-header injection / poisoned-link phishing). Severity is capped because prod requires the base URL, but the resolver itself provides no allowlist backstop.
- **Fix:** When deriving origin from request headers, validate the resulting host against a known-host allowlist (the configured site/app hosts + local hosts) and reject/replace with the canonical origin otherwise; or require fallbackOrigin to be a trusted value rather than defaulting to header-derived hosts.


## Lane G — Frontend reader & UI  ·  PARALLEL  ·  7 items

### G1 · Any server error on quiz submit (incl. attempt_cooldown / rate-limit) is silently converted to a local provisional grade that can show PASS and unlock the chapter
**G1** · **HIGH** · **Opus 4.8 · high** (T2) · Lane G PARALLEL

- **Location:** `app/book/library/[bookId]/chapter/[chapterId]/hooks/useQuizSession.ts:337-354 (catch block); consumed in ChapterReaderClient.tsx:728-792`
- **What's wrong:** In submit(), the catch block first calls scoreLocally(). Because session exists with questions, scoreSessionLocally() ALWAYS returns a non-null session (quizScoring.ts:68 only returns null when there are zero questions), so the function enters the provisional-scoring branch (lines 340-347), sets local.provisional=true, calls setSession(local)/syncFromSession(local), and returns {session: local}. The block at lines 348-353 that handles BookClientError code 'attempt_cooldown' by re-loading the server session is therefore DEAD CODE — it is never reached. Concrete trigger: user fails a quiz (failureStreak→1, 60s cooldown). They edit answers and retry within the cooldown. Server responds 429 attempt_cooldown. fetchBookJson throws BookClientError, but submit() returns a locally-scored provisional result instead of surfacing the cooldown. If the corrected answers now pass, scoreSessionLocally marks result.passed=true; handleSubmitQuiz (ChapterReaderClient.tsx:731) then calls phaseCompletion.markPhaseCompleted('quiz') and the ResultsScreen 'Continue' path calls markChapterComplete()+unlock, locally completing the chapter and unlocking the next one. The same swallowing happens for 429 attempt_rate_limited, version_conflict, 400 validation, or any transient 5xx.
- **Impact:** The documented anti-abuse failure cooldown / hourly rate limit is not enforced in the UI — a user can keep 'submitting' inside cooldown and obtain provisional passes. A server-rejected attempt can still flip the local UI to 'passed' and locally complete/unlock the next chapter, desyncing from server truth (server PATCH route recomputes completion so it reverts on refresh, but the user is shown a false pass and unlock). Real errors are also hidden from the user.
- **Fix:** In the catch, branch on the error BEFORE falling back to local scoring: if submitError is a BookClientError with a known server-enforcement code (attempt_cooldown, attempt_rate_limited, version_conflict, quiz_state_conflict) or any 4xx, re-load the server session and rethrow rather than producing a provisional grade. Reserve local provisional scoring for genuine network/offline failures (e.g. TypeError/'Failed to fetch' or status 0).

### G2 · /onboarding crashes (error page) on any non-Auth settings-read failure while /book degrades gracefully — divergent catch blocks
**G2** · **MEDIUM** · **Sonnet 4.6 · high** (T3) · Lane G PARALLEL

- **Location:** `app/onboarding/page.tsx:25-31 (vs app/book/page.tsx:33-35)`
- **What's wrong:** Both onboarding entry points do the same already-onboarded redirect: requireUser() -> getBookTableName() -> getUserSettingsItem() -> redirect('/dashboard') if onboardingCompleted. app/book/page.tsx swallows two failure classes (AuthError AND any error whose message includes 'BOOK_TABLE_NAME') and falls through to render OnboardingFlow. app/onboarding/page.tsx (line 31) swallows ONLY AuthError and rethrows everything else. getBookTableName() calls mustServerEnv('BOOK_TABLE_NAME') which throws `Error('Missing env var: BOOK_TABLE_NAME')` whenever the data plane is unset. Concrete trigger: in local dev (and the e2e-dev CI job) DEV_AUTH_BYPASS makes requireDashboardAccess() return early and requireUser() return a synthetic user (auth.ts:104), so execution reaches getBookTableName() which throws because BOOK_TABLE_NAME is absent locally — /book renders onboarding fine but /onboarding throws and renders app/error.tsx instead of the flow. The same divergence also bites an already-onboarded prod user who hits /onboarding directly during a transient DynamoDB read failure: /onboarding error-pages them instead of degrading.
- **Impact:** The /onboarding entry point is broken for every local/CI dev session (shows the global error page, not the flow) and error-pages real users on transient read failures, where the parallel /book route degrades cleanly. Inconsistent UX and a hard break of a documented dual-entry-point invariant.
- **Fix:** Make app/onboarding/page.tsx mirror app/book/page.tsx exactly: also swallow the local-unset-data-plane case (e.message.includes('BOOK_TABLE_NAME')) in addition to AuthError, falling through to render <OnboardingFlow/>. Better, factor the shared already-onboarded check + catch policy into one helper imported by both pages so they cannot drift again.

### G3 · ContinueLearningCard can build /book/library/{id}/chapter/ with an empty chapter segment
**G3** · **MEDIUM** · **Sonnet 4.6 · high** (T3) · Lane G PARALLEL

- **Location:** `components/progress/ContinueLearningCard.tsx:27-32 (resumeChapterId origin app/book/hooks/useBookAnalytics.ts:566-572)`
- **What's wrong:** getBookHref returns `/book/library/${id}/chapter/${encodeURIComponent(book.resumeChapterId)}` whenever `book.completedChapters > 0 || book.currentStep !== 'summary'`. `resumeChapterId` is sourced from useBookAnalytics where it falls back to `""` (empty string) when `state.currentChapterId` is falsy and the chapter list is empty (useBookAnalytics.ts:566-572). `encodeURIComponent("")` is `""`, so the CTA href becomes `/book/library/{id}/chapter/` — a malformed route with a missing chapterId segment. A reader clicking 'Continue' lands on a broken/not-found chapter route instead of resuming.
- **Impact:** Broken primary CTA on the Progress hero card for any active book whose chapter metadata failed to resolve (e.g. content/manifest fetch hiccup, or a pinned version whose chapters didn't load) while completedChapters>0 or step!=summary. Dead-ends the reader's main resume action.
- **Fix:** Guard the chapter branch on a non-empty resumeChapterId: `if (book.resumeChapterId && (book.completedChapters > 0 || book.currentStep !== 'summary')) { ...chapter URL... }` and otherwise fall through to `/book/library/${id}`. Optionally assert/skip in buildProgressData when resumeChapterId is empty.

### G4 · ProgressPage reads e.plan from /me/entitlements but the route returns a nested {entitlement:{plan}} — isPro is permanently false and Pro users are shown as Free
**G4** · **MEDIUM** · **Sonnet 4.6 · high** (T3) · Lane G PARALLEL

- **Location:** `components/progress/ProgressPage.tsx:495-500 (consumer of the entitlements endpoint used by useBookEntitlements)`
- **What's wrong:** fetchBookJson<{ plan?: string }>('/app/api/book/me/entitlements').then((e) => setIsPro(e.plan === 'PRO')). The endpoint (app/app/api/book/me/entitlements/route.ts:41-54) returns { entitlement: { plan, ... }, paywall: {...} } — confirmed by the same nested shape in useBookEntitlements' EntitlementsResponse type. e.plan is therefore always undefined, so setIsPro(false) is set for every user, including PRO subscribers. Separately, useBadgeSystem is invoked here (lines 487-490) WITHOUT a plan arg, so it defaults to 'FREE' and Premium-category badges (proActivated/proMultiTrack in deriveBadgeStats) never evaluate as earned on this page.
- **Impact:** On the progress/dashboard page, every PRO user is rendered as Free (any Pro-gated affordances/badges hidden), and Premium badges never award. Pure read shape mismatch.
- **Fix:** Read e.entitlement?.plan === 'PRO' (or type the response as EntitlementsResponse), and pass plan: isPro ? 'PRO' : 'FREE' into useBadgeSystem.

### G5 · WorkspacePage BookRow renders userBooks and recommendedProBooks in one container with colliding keys
**G5** · **MEDIUM** · **Sonnet 4.6 · high** (T3) · Lane G PARALLEL

- **Location:** `components/workspace/BookRow.tsx:83 and :112 (data from components/workspace/WorkspacePage.tsx:327 userBooks vs :294-298 recommendedProBooks)`
- **What's wrong:** BookRow places `userBooks.map(... key={book.id})` (line 83) and `recommendedProBooks.map(... key={book.id})` (line 112) inside the SAME flex container, so a book id that appears in both lists produces two siblings with the same React key. In mapAnalyticsToWorkspaceData, `userBooks` is built from `analytics.engagedBookSnapshots` (every book with ANY server state — useBookAnalytics.ts:620-633), which INCLUDES books a reader merely opened but has not progressed in (status `not_started`, statusFromCounts returns not_started when completedChapters===0). `recommendedProBooks` is built from `rankRecommendations`, which filters candidates to `status === 'not_started'` (WorkspacePage.tsx:164) over the same `bookSnapshots`. So for a FREE user (recommendedProBooks is only populated when `!analytics.isPro`, line 294) who opened a book once without completing a chapter, that exact book appears in BOTH userBooks and recommendedProBooks → duplicate `key={book.id}` among siblings. The author already dedups `discoveryBooks` against `recommendedProBookIds` (WorkspacePage.tsx:340-342), showing awareness of overlap, but did not dedup userBooks vs recommendedProBooks.
- **Impact:** React logs a duplicate-key warning and can mis-reconcile the two cards: hover/whileInView/entry animations and progress bars can attach to the wrong DOM node, and one of the two cards can be dropped or flicker on re-render. Hits the common case of a free user who tapped into a book to preview it but never finished a chapter — exactly the dashboard's primary funnel.
- **Fix:** Either (a) namespace the keys per list (`key={`user-${book.id}`}` and `key={`rec-${book.id}`}`), or (b) in mapAnalyticsToWorkspaceData filter recommendedProBooks to exclude ids already present in userBooks (build a `userBookIds` Set and `.filter(b => !userBookIds.has(b.id))`), mirroring the existing discoveryBooks dedup.

### G6 · inferChapterNumber() parses the first digit run in the chapterId, returning the wrong chapter for the 8 books whose bookId contains a number
**G6** · **MEDIUM** · **Sonnet 4.6 · high** (T3) · Lane G PARALLEL

- **Location:** `app/book/library/[bookId]/chapter/[chapterId]/hooks/useChapterState.ts:180-188, used at :308 and :376/:413`
- **What's wrong:** resolvedChapterNumber = chapterNumber ?? inferChapterNumber(chapterId). In ChapterReaderClient the chapterNumber arg is baseChapter?.order (line 249), which is undefined on first render because useChapterContent fetches the chapter asynchronously (no synchronous local resolve). So on mount inferChapterNumber(chapterId) runs. Its regex chapterId.match(/(\d+)/) grabs the FIRST digit run anywhere in the id. chapterIds are like 'the-5-am-club-ch01' → match is '5' → returns chapter 5 instead of 1. Affected books (bookId contains a digit): the-12-week-year, the-33-strategies-of-war, the-4-hour-workweek, the-48-laws-of-power, the-5-am-club, the-7-habits-of-highly-effective-people, the-first-20-hours, the-great-mental-models-vol-1/2. The server-state GET (line 376, keyed on [bookId, resolvedChapterNumber]) and the debounced save PATCH (line 413, URL chapters/${resolvedChapterNumber}/state) both run with the wrong number during the load window, fetching chapter-5 state into chapter-1's reader and writing chapter-1's local state (notes, etc.) to chapter-5's server key.
- **Impact:** For these 8 books, opening chapter 1 (and any chapter < the title number) briefly loads a different chapter's reader state and can cross-write reader state (notes/quiz progress merge) to the wrong chapter number on the server before content loads and the number self-corrects. State desync / potential notes cross-contamination.
- **Fix:** Match the chapter suffix specifically, e.g. chapterId.match(/-ch0*(\d+)$/i) (or /ch(\d+)$/i), instead of the first /(\d+)/ run; or gate the server fetch/save effects until a real chapterNumber prop is available rather than relying on the inference fallback.

### G7 · Completion-route streak/points response is parsed then discarded; UnlockCelebration never receives currentStreak, contradicting its own contract
**G7** · **LOW** · **Sonnet 4.6 · medium** (T4) · Lane G PARALLEL

- **Location:** `app/onboarding/components/OnboardingFlow.tsx:82-86 and app/onboarding/components/StepFirstLoop.tsx:223-226`
- **What's wrong:** POST /me/onboarding/complete returns {points, currentStreak} reflecting what the backend actually granted (route.ts:298-304). handleFinish calls `await resp.json()` (OnboardingFlow.tsx:83) but throws the result away — it is never assigned or propagated. The block's own comment (lines 75-86) claims the body is read 'so the real grant totals the route reports (points balance + the day streak it counted for today) are read rather than silently discarded.' It is in fact silently discarded. Separately, StepFirstLoop renders <UnlockCelebration quizScore={quizScore} onFinish={handleCelebrationFinish}/> (lines 223-226) and never passes the optional currentStreak prop, so UnlockCelebration always falls back to its hardcoded dayStreak=1 (UnlockCelebration.tsx:56-57). If the server-counted streak differs (e.g. the user already had an active day, or the streak grant returned a value !=1), the celebration shows a number that disagrees with what /dashboard then displays.
- **Impact:** The 'Day streak' figure on the unlock celebration is cosmetic/hardcoded and can contradict the persisted server state the user lands on at /dashboard. Purely a display inconsistency (no data loss), but it directly defeats the stated intent of reading the response.
- **Fix:** Capture the JSON (`const result = await resp.json().catch(()=>null)`), thread points/currentStreak up through handleFinish -> StepFirstLoop -> UnlockCelebration, and pass currentStreak (and the real points total) into the celebration so the displayed numbers match the grant. Or remove the dead `await resp.json()` and the misleading comment if the values are intentionally unused.


## Lane H — Independent pool — routes, sibling repos, misc  ·  PARALLEL  ·  23 items

### H1 · Admin delete/deactivate silently skips Stripe cancellation when the entitlement read fails — user keeps being billed with no ops-failure record
**H1** · **HIGH** · **Opus 4.8 · xhigh** (T1) · Lane H PARALLEL

- **Location:** `app/app/api/book/admin/users/[userId]/account-status/route.ts:100-122`
- **What's wrong:** On an admin 'delete'/'deactivate' transition, the route reads the entitlement with `getUserEntitlement(tableName, userId).catch(() => null)` to decide whether to cancel the Stripe subscription. `getUserEntitlement` throws (no internal catch — repo.ts:657) on any DynamoDB read failure, so a transient read error makes `entitlement` null. The `if (entitlement?.stripeSubscriptionId && ...)` block is then skipped entirely: Stripe is never told to cancel, AND no ops-failure record is captured (captureStripeCancelFailure only runs inside the Stripe try/catch, which is never entered). `setAccountStatus` already succeeded, so the admin sees a 200 success and the account shows deleted/deactivated, while the paying Stripe subscription keeps billing the user indefinitely with no trace in the ops queue.
- **Impact:** A paying user marked deleted/deactivated by an admin continues to be charged when a DynamoDB blip happens during the read. The failure is invisible: admin sees success, no ops-failure row is created for retry, and the dangling sub is only caught later by the (page-capped, manually-run) reconciliation report.
- **Fix:** Do not swallow the entitlement read error. Either let it propagate (fail the whole transition so the admin retries), or on a read failure capture an ops-failure record (kind stripe_cancel / stripe_cancel_at_period_end with the userId) so the dangling subscription is queued for retry. At minimum, distinguish 'no entitlement' (legitimately skip) from 'read failed' (must not silently skip the cancel).

### H2 · Reflection AI-feedback rate limiter is check-then-write-after-completion, allowing concurrent + retry bypass of paid Claude calls
**H2** · **HIGH** · **Opus 4.8 · xhigh** (T1) · Lane H PARALLEL

- **Location:** `app/app/api/book/me/reflections/[bookId]/[chapterNumber]/feedback/route.ts:90-97 (check) vs 177-190 (marker write)`
- **What's wrong:** The per-(day, exampleId) limit is enforced by a GetCommand read at lines 92-97 (reject if a FEEDBACK_RATE_LIMIT marker already exists), but the marker is only PutCommand-written at lines 179-190, inside the ReadableStream start() success path AFTER the entire Anthropic stream finishes. This is not atomic. Scenario A (concurrency): a user fires N parallel POSTs for the same exampleId before any stream completes; all N read no marker and all N call streamReflectionFeedback() (a real, paid client.messages.stream() call — ai-service.ts:120). Scenario B (failure retry): if the stream throws, control jumps to the catch at line 191 and the marker write at 179 never runs, so the user can retry the paid call unlimited times. Even single-threaded, the limit only takes effect after the first SUCCESSFUL completion. The sibling AI route books/[bookId]/ask/route.ts:266-285 does it correctly with an atomic conditional-increment UpdateCommand (SET #count = if_not_exists(...)+:one, ConditionExpression #count < :limit) BEFORE the model call.
- **Impact:** Unbounded paid Anthropic Sonnet calls per user via parallel requests or error-retry, defeating the intended one-feedback-per-example-per-day cap. Direct API cost / quota / abuse exposure.
- **Fix:** Reserve the slot atomically BEFORE invoking the model, mirroring ask/route.ts: do a conditional UpdateCommand on the limit key (attribute_not_exists OR within window) and 429 on ConditionalCheckFailed; only then start the stream. Optionally roll back the reservation if the model call fails immediately.

### H3 · 10-activation referral milestone never grants the promised 30-day Pro pass to free inviters
**H3** · **MEDIUM** · **Sonnet 4.6 · high** (T3) · Lane H PARALLEL

- **Location:** `app/app/api/book/_lib/referral-escalation-core.ts:36-42 and app/app/api/book/_lib/referral-escalation.ts:223-258`
- **What's wrong:** The 10-activation milestone is defined as ipBonus:1200, proInviterIPAlternative:1200, with the comment '30-Day Pro Pass for free inviter, or 1,200 IP for Pro inviter' (referral-escalation-core.ts:40). But checkReferralEscalation unconditionally awards milestone.ipBonus (1200 IP) via awardFlowPoints regardless of inviterPlan and contains no Pro-pass grant code path (grep for proPass/30-day finds nothing in this module). The proInviterIPAlternative field is never read. So a FREE inviter who hits 10 activations is promised a 30-day Pro pass but receives only 1,200 IP.
- **Impact:** Advertised referral reward (a 30-day Pro pass for free inviters at the 10-activation tier) is not delivered — a reward-delivery/trust bug. Conversely there is no differentiation between FREE and PRO inviters even though the design specifies different rewards.
- **Fix:** Branch on inviterPlan for the 10-activation tier: grant a 30-day Pro pass (the existing pro-pass grant path) for FREE inviters and award proInviterIPAlternative IP for PRO inviters; only mark the tier settled once the chosen reward is durably granted.

### H4 · Re-rejecting a previously approved scenario does not reverse the Insight Points already awarded
**H4** · **MEDIUM** · **Sonnet 4.6 · high** (T3) · Lane H PARALLEL

- **Location:** `app/app/api/book/admin/scenario-submissions/[submissionId]/route.ts:101-175`
- **What's wrong:** When an admin first approves a scenario, awardFlowPoints grants `existing.pointsAwarded` IP (idempotent on submissionId). If the admin later PATCHes the same submission to status='rejected' (e.g. it was approved in error or flagged for abuse), the route deletes the approved-scenario record and flips the lookup status, but never deducts the previously-granted points. The award path only fires on `status==='approved' && !wasApprovedAlready`; there is no symmetric clawback on approved→rejected. Because awardFlowPoints keys the grant on (sourceType, submissionId), re-approving later would also NOT re-award, so the points stay permanently even though the scenario is now rejected and removed from the approved set.
- **Impact:** A user keeps the Insight Points for a scenario an admin has explicitly un-approved/rejected. For abusive or mistakenly-approved content the moderation action is incomplete — the economy reward (which gates flow-point purchases/PRO via flow_points source) is not recovered, undermining moderation and the IP economy.
- **Fix:** On an approved→rejected transition (`wasApprovedAlready && status==='rejected'`), issue a compensating negative ledger entry / spend for `existing.pointsAwarded` (guarded so balance can't go negative or with an explicit reversal record keyed on the submissionId), mirroring the admin insight-points/adjust deduction path.

### H5 · Segment filter `lastActiveWithinDays gt` matches never-active users, polluting commercial notification fan-out targeting
**H5** · **MEDIUM** · **Sonnet 4.6 · high** (T3) · Lane H PARALLEL  ·  ⚠ group `DG-segment` → fix together as the segment never-active filter fix

- **Location:** `app/app/api/book/_lib/segment-engine.ts:83`
- **What's wrong:** evaluateFilter for `lastActiveWithinDays` returns `op === 'isEmpty' || op === 'gt'` when the user has NO lastActiveAt. The `gt` operator on this field means 'active WITHIN N days' (engine line 88: `t >= cutoff`), so it is meant to select recently-active users. Returning true for never-active users (lastActiveAt absent) is backwards: a user who has never been active is reported as 'active within N days'. The segments POST validator (admin/segments/route.ts:53) explicitly allows `lastActiveWithinDays` with `gt`, so this is a reachable, persistable filter. buildSegmentUsers also includes snapshot-only users with no entitlement, and a user can legitimately have no lastActiveAt snapshot field.
- **Impact:** An admin building a 're-engage users active in the last 30 days' segment (lastActiveWithinDays gt 30) gets never-active accounts mixed into the cohort. The /segments/[id]/notify route fans this segment out as a CASL/CAN-SPAM commercial in-app+email blast, so the wrong users receive the message; the preview/match count the admin confirms against is also inflated/incorrect.
- **Fix:** When `!user.lastActiveAt`, a `gt` (within-N-days / recently-active) filter must return false. Return true only for `isEmpty`. e.g. `if (!user.lastActiveAt) return op === 'isEmpty';`.

### H6 · acceptPairInvite TOCTOU lets a user end up with multiple active partners
**H6** · **MEDIUM** · **Opus 4.8 · high** (T2) · Lane H PARALLEL

- **Location:** `app/app/api/book/_lib/pair-repo.ts:92-145`
- **What's wrong:** acceptPairInvite checks getUserActivePair(inviter) and getUserActivePair(accepting) (lines 92-95), then commits a TransactWrite whose only guards are attribute_not_exists on the partner-SPECIFIC pair SKs PAIR#<partnerId> (lines 127,144). The existence check and the write are not atomic, and the conditions only prevent re-pairing the SAME two users — they do NOT prevent the inviter from gaining a second distinct partner. Concrete trigger: user A creates two invites; users B and C each POST /me/pairs/accept/<code> concurrently. Both getUserActivePair(A) reads see no active pair, and the two transactions write BOOKUSER#A/PAIR#B and BOOKUSER#A/PAIR#C (different SKs), so both attribute_not_exists conditions pass. A now has two 'active' pair rows; getUserActivePair returns whichever .find() hits first, the other partner sees a half-working accountability link, and a nudge/partner-summary path can read an unexpected partner.
- **Impact:** Data integrity: a user can be bound to >1 active reading partner, violating the one-partner invariant the UI assumes. Partner-summary and nudge features become non-deterministic; un-pairing one leaves a dangling active pair on the other side.
- **Fix:** Make the pair singleton enforceable at the item level: write the active pair to a single fixed SK (e.g. PAIR#ACTIVE) per user with attribute_not_exists, so a second concurrent accept's Put fails the condition and the whole transaction cancels. Alternatively add a ConditionCheck in the transaction that the user has no existing active-pair marker.

### H7 · deletePair soft-deletes the pair row, permanently blocking the same two users from re-pairing
**H7** · **MEDIUM** · **Opus 4.8 · high** (T2) · Lane H PARALLEL

- **Location:** `app/app/api/book/_lib/pair-repo.ts:289-316 (write) and 119-145 (re-accept guard)`
- **What's wrong:** deletePair does NOT delete the pair rows — it Updates them to status='ended' (lines 296-305), so the items BOOKUSER#A/PAIR#B and BOOKUSER#B/PAIR#A still exist. acceptPairInvite's pair Puts require ConditionExpression 'attribute_not_exists(PK) AND attribute_not_exists(SK)' (lines 127,144). Concrete trigger: A and B pair, then either calls deletePair to un-pair, then A invites B again (or B accepts a fresh invite from A). The Put condition fails because the ended row still exists, the TransactWrite is cancelled, and acceptPairInvite returns 'Invite already used'. getUserActivePair filters status==='active' so both users correctly appear unpaired, yet they are permanently unable to re-pair with each other.
- **Impact:** Two users who ever un-pair can never become reading partners again — a confusing, unrecoverable dead-end with a misleading 'Invite already used' message.
- **Fix:** Either hard-delete the pair rows in deletePair, or relax the re-accept condition to allow overwriting a row whose status is 'ended' (e.g. ConditionExpression 'attribute_not_exists(SK) OR #status = :ended').

### H8 · system-mode theme does not re-apply to the DOM when the OS color scheme changes live
**H8** · **MEDIUM** · **Sonnet 4.6 · high** (T3) · Lane H PARALLEL

- **Location:** `app/hooks/useThemePreference.ts:60-63 (handler) and :43-47 (syncTheme)`
- **What's wrong:** useThemePreference registers a prefers-color-scheme 'change' listener (handleMediaChange -> syncTheme). syncTheme only calls setThemePreferenceState / setResolvedTheme (React state) -- it never calls applyDocumentTheme/applyStoredDocumentTheme. So when a user whose preference is 'system' changes their OS light/dark setting while the app is open, the <html>.dark class, root.style.colorScheme, and the token set are NOT updated. The only place that re-applies the document theme on change is useBookPreferences (app/book/hooks/useBookPreferences.ts:954-997), which by its own comment is mounted ONLY on Settings + the Chapter Reader. ThemeModeToggle (components/ThemeModeToggle.tsx) is mounted on the dashboard TopNav and WorkspacePage and uses useThemePreference, so on those routes the toggle's Sun/Moon icon flips to the new mode (resolvedTheme state updated) while the actual page colors stay on the stale OS value until a reload.
- **Impact:** Visible theme desync for 'system'-preference users: page chrome shows the old theme while the toggle/aria reports the new one, until they navigate to Settings/Reader or hard-reload. Confusing and looks broken.
- **Fix:** In the media-change path, re-apply the document theme to the DOM, not just React state. e.g. have handleMediaChange call applyStoredDocumentTheme() (which resolves system->dark via matchMedia and toggles the class) before/with syncTheme, or fold a global theme client into the layout so applyDocumentTheme runs on every prefers-color-scheme change regardless of route.

### H9 · BOOK_PACKAGE_PRESENTATION 'Getting-Things-Done' entry is unreachable and embeds a 404 cover path
**H9** · **LOW** · **Sonnet 4.6 · medium** (T4) · Lane H PARALLEL

- **Location:** `app/book/data/bookPackages.ts:1430-1432 (and resolver at :1931)`
- **What's wrong:** BOOK_PACKAGE_PRESENTATION is keyed 'Getting-Things-Done' (capitalized), but the book's canonical bookId is 'getting-things-done' (book-packages/Getting-Things-Done.v21.json -> bookId: 'getting-things-done'; catalog metadata id is also lowercase). getBookPackagePresentation(bookId) does BOOK_PACKAGE_PRESENTATION[bookId] ?? inferFallbackPresentation(bookId); with bookId='getting-things-done', the capitalized key never matches, so the whole hand-authored entry (including its synopsis) is dead and the fallback path is used instead. Compounding it, the dead entry calls getBookCoverPath('Getting-Things-Done') which (map keys are lowercase) returns the literal '/book-covers/Getting-Things-Done.webp' -- only 'getting-things-done.webp' is git-tracked, so that path 404s in CI/prod. It happens to be harmless ONLY because the entry is never read.
- **Impact:** Hand-authored synopsis/icon for Getting Things Done silently never renders (the generic inferred synopsis is shown instead). If the lookup is ever case-normalized or the entry copied as a template, the embedded broken cover path surfaces a 404 cover.
- **Fix:** Rename the key to 'getting-things-done' and change the cover call to getBookCoverPath('getting-things-done'); add a unit assertion that every BOOK_PACKAGE_PRESENTATION key is a known kebab-case bookId.

### H10 · Catalog-count drift guard (d) only scans .tsx and only matches 'books', missing .ts/.md and category claims
**H10** · **LOW** · **Sonnet 4.6 · medium** (T4) · Lane H PARALLEL

- **Location:** `scripts/ci/scan-style-drift.mjs:51-54 (RE_CATALOG) and :189 (isTsx gate)`
- **What's wrong:** guardCatalogCounts only runs on files where isTsx(f) is true, and RE_CATALOG only matches '<n> more books' / '<n>+ books'. Two gaps: (1) hardcoded catalog claims in .ts/.tsx-imported constant files, .md docs, or JSON copy bypass the guard entirely because they aren't .tsx; (2) a hardcoded category claim like 'N categories' or 'N topics' is never matched, so the CATALOG_CATEGORY_COUNT side of the 'derive from data' rule is unenforced. The single-digit form ('N more books') also slips through since the 'more books' pattern requires \d{2,3}.
- **Impact:** A marketing surface can reintroduce a stale/overstated catalog claim (especially a category count) without tripping the gate the docs say enforces 'never hardcode catalog counts in copy', undermining the stated guarantee.
- **Fix:** Extend guardCatalogCounts to also scan .ts files that contain UI copy, add a category-count pattern (e.g. /\b\d{1,3}\+?\s+(categories|topics|genres)\b/i), and lower the digit floor for the 'more books' pattern; baseline any current legitimate matches.

### H11 · Depth-routing feature is inert: updateDepthModel is never called, so the recommendation always returns the cold-start fallback
**H11** · **LOW** · **Sonnet 4.6 · medium** (T4) · Lane H PARALLEL

- **Location:** `app/app/api/book/_lib/depth-routing.ts:104-176 (writer) and app/app/api/book/me/books/[bookId]/depth-recommendation/route.ts:24-51`
- **What's wrong:** updateDepthModel() — the only function that ever writes a BookUserDepthModelItem — has zero call sites in the entire app (grep across app/ outside tests/worktrees finds only its definition). No quiz-submit or chapter-completion path invokes it. Therefore getDepthModel() in the depth-recommendation route always returns null, and the route always returns the cold-start fallback computeDepthRecommendation({avgQuizScore:0,...}, 0) → { recommendedDepth:'easy', confidence:0.3, hasData:false } for every user, every book, forever. The personalized branches (medium/hard based on quiz performance) and the entire EMA feature vector are dead. The frontend hook useDepthRecommendation consumes this and will always show 'easy / not enough data'.
- **Impact:** A shipped, user-facing personalization feature does nothing — every reader is permanently recommended 'easy' regardless of how well they perform. No crash, but the feature is silently broken in production.
- **Fix:** Wire updateDepthModel() into the quiz-pass / chapter-completion path (e.g. buildProgressAfterQuizPass call site) so the per-user depth model is actually persisted, or remove the dead writer and the recommendation UI. Also note the route passes model.lastUpdatedChapter as the chaptersCompleted arg, which is a chapter number, not a completed-count — fix that semantic when wiring it.

### H12 · Event PATCH accepts a malformed/empty badge object that the POST creator rejects
**H12** · **LOW** · **Sonnet 4.6 · medium** (T4) · Lane H PARALLEL

- **Location:** `app/app/api/book/admin/events/[eventId]/route.ts:77`
- **What's wrong:** POST /admin/events validates the badge requires badgeId, name, AND icon (route.ts:58 throws invalid_badge otherwise). The PATCH handler only checks `body.badge && typeof body.badge === 'object'` before persisting it, so a PATCH with `badge: {}` (or `badge: { name: 'x' }`) passes and overwrites the event's badge with an object missing badgeId/name/icon. The L39 comment on the same handler notes the `books` field was hardened to match POST's rules, but `badge` was left with the weaker check.
- **Impact:** An admin editing an event can corrupt its badge into a shape (no badgeId/name/icon) that downstream badge-award/rendering code assumes is complete, producing a broken or unawardable event badge — the exact slip the POST validator exists to prevent.
- **Fix:** Apply the POST badge validation in PATCH: if body.badge is supplied, require badgeId, name, and icon to be non-empty strings before assigning; otherwise throw 400 invalid_badge.

### H13 · Malformed JSON body in Ask endpoint returns a 500 instead of 400
**H13** · **LOW** · **Sonnet 4.6 · medium** (T4) · Lane H PARALLEL

- **Location:** `app/app/api/book/books/[bookId]/ask/route.ts:25 (await req.json()) with outer catch at 397-400`
- **What's wrong:** body = await req.json() (line 25) is inside the outer try whose catch (line 397) logs and returns 500 internal_error. A client that POSTs a non-JSON or truncated body therefore gets a generic 500 'An unexpected error occurred' rather than a 400 invalid request. Every other validation in this route returns a proper 4xx.
- **Impact:** Wrong status code: client-side errors are reported as server errors, polluting the server-error rate (which feeds the CloudWatch 5xx alarm) and giving the client a misleading response. Low impact but trivially triggerable.
- **Fix:** Wrap req.json() in its own try/catch and return bookErr(req, 400, 'invalid_body', 'Request body must be valid JSON').

### H14 · Notifications dailyVolume is computed from an arbitrary-order capped Scan, so the chart is wrong (under/random-counted) once the table exceeds the cap
**H14** · **LOW** · **Sonnet 4.6 · medium** (T4) · Lane H PARALLEL  ·  _status: UNCERTAIN (verify carefully)_

- **Location:** `app/app/api/book/admin/metrics/notifications/route.ts:36-90`
- **What's wrong:** dailyVolume buckets notification createdAt dates from a `Scan` of entity=BOOK_USER_NOTIFICATION capped at 5000 items. DynamoDB Scan returns items in internal hash order, not by recency, so once total notifications exceed 5000 the 5000 items examined are a non-recency-correlated sample. The 'last 7 days' dailyVolume (and the per-type read-rate aggregates) are then computed from that arbitrary subset, making recent-day counts effectively random rather than merely truncated-from-the-top. The header comment acknowledges under-counting but frames it as 'recent days may be under-counted', understating that the sample is order-arbitrary.
- **Impact:** Admin notifications dashboard shows misleading daily-volume and read-rate numbers at scale — not a placeholder zero but plausible-looking wrong data, which can drive bad decisions about send cadence/channel health.
- **Fix:** Bucket dailyVolume from a date-bounded source (a createdAt GSI, or the analytics event log for the 7-day window) rather than an unordered capped table Scan; or surface a hard warning that volume figures are sampled and not recency-ordered once the cap is hit.

### H15 · Partner nudge daily cap is check-then-write (non-atomic), allowing a duplicate nudge notification
**H15** · **LOW** · **Sonnet 4.6 · high** (T3) · Lane H PARALLEL

- **Location:** `app/app/api/book/me/pairs/[partnerId]/nudge/route.ts:24-37 + pair-repo.ts:318-352`
- **What's wrong:** canSendNudge() (pair-repo.ts:318-331) does a GetCommand for the per-day NUDGE_DEDUP marker, and recordNudgeSent() (333-352) does an unconditional PutCommand on the same key with no ConditionExpression. Two concurrent POSTs to nudge the same partner both read no marker, both write it (last-write-wins, same key), and both call createNotification(userId: partnerId, ...) at lines 33-38 — so the partner receives two 'your partner nudged you' notifications despite the 'once per day' limit. Bounded to ~2 because the marker exists on the next read, but the limit is advertised as once/day.
- **Impact:** Minor notification spam to the partner; the documented one-nudge-per-day guarantee can be violated under a double-click / retry.
- **Fix:** Make recordNudgeSent conditional (PutCommand with ConditionExpression: attribute_not_exists(PK) AND attribute_not_exists(SK)) and only send the notification when the write succeeds; treat ConditionalCheckFailed as the 429 nudge_limit case.

### H16 · Segment filter 'lastActiveWithinDays gt N' wrongly matches users who have never been active
**H16** · **LOW** · **Sonnet 4.6 · medium** (T4) · Lane H PARALLEL  ·  ⚠ group `DG-segment` → fix together as the segment never-active filter fix

- **Location:** `app/app/api/book/_lib/segment-engine.ts:82-88`
- **What's wrong:** In evaluateFilter for lastActiveWithinDays, when user.lastActiveAt is null/absent the code returns `op === 'isEmpty' || op === 'gt'` (line 83). Since 'gt' is the 'active within N days' operator (line 88 maps gt → t >= cutoff = recent), returning true for a never-active user means a user with NO activity is counted as 'active within the last N days'. An admin building an 'active in last 7 days' notification segment would therefore include dormant/never-active accounts.
- **Impact:** Admin campaign targeting is incorrect: re-engagement / active-user segments are polluted with never-active users, so notifications go to the wrong audience. Admin-only, low blast radius, but a correctness defect.
- **Fix:** For lastActiveWithinDays with op === 'gt' on a null lastActiveAt, return false (a user with no activity is not active within any window). Keep returning true only for op === 'isEmpty'.

### H17 · Starter prescription can only ever recommend one of 3 hardcoded books, ignoring the user's selected shelf and the full book catalog
**H17** · **LOW** · **Sonnet 4.6 · medium** (T4) · Lane H PARALLEL

- **Location:** `app/app/api/book/_lib/starter-prescription.ts:59-75, 119-147 and app/app/api/book/me/onboarding/complete/route.ts:128`
- **What's wrong:** generateStarterPrescription only knows 3 books (BOOK_META: crucial-conversations, thinking-fast-and-slow, the-almanack-of-naval-ravikant). At onboarding the user's chosen starterShelf is filtered to books that have scoring data (candidateIds = shelf ∩ these 3); if the user picked books outside this set (e.g. ['atomic-habits','deep-work']), candidateIds is empty and it falls back to allBookIds = the same 3 books (line 126). So the persisted starterPrescription.bookId/bookTitle/bookAuthor (surfaced via useStarterPrescription as a 'Picked for you' card) points at a book the user did NOT select and may not have unlocked. bookTitle/bookAuthor are also hardcoded and will drift from the live catalog.
- **Impact:** New users are recommended (and directed toward) a book they didn't choose and haven't unlocked, sending them into the free-slot/paywall path for the wrong title; for any shelf not containing the 3 hardcoded books the recommendation is effectively random/irrelevant. Degrades the core onboarding-to-first-read funnel.
- **Fix:** Drive the prescription from the actual catalog / the user's starterShelf and per-book metadata instead of a 3-entry hardcoded map; at minimum, when none of the shelf books are scorable, recommend from the shelf (the books the user actually selected) rather than falling back to the 3 hardcoded titles.

### H18 · book-covers.test asserts AVIF-sibling over the working tree, so stray untracked covers fail local verify
**H18** · **LOW** · **Sonnet 4.6 · medium** (T4) · Lane H PARALLEL

- **Location:** `lib/book-covers.test.ts:84-98`
- **What's wrong:** The 'every committed cover WebP ... has an AVIF sibling' test does readdirSync(COVERS_DIR) and asserts an AVIF sibling for EVERY .webp present in the working tree, rather than for git-tracked files. The repo currently has untracked local artifacts (e.g. public/book-covers/behave.webp with no behave.avif, and Getting-Things-Done.webp) -- running `npx tsx --test lib/book-covers.test.ts` fails right now with 'missing AVIF sibling for behave.webp'. Because `npm run test` is part of `npm run verify`, any developer with such a stray cover gets a spurious verify failure that has nothing to do with their change. (CI is unaffected since it checks out only tracked files.)
- **Impact:** Spurious local `npm run verify`/`npm test` failures from untracked cover artifacts; the test's comment explicitly tries to exempt untracked artifacts (pmbok-guide.svg) but the readdir-based assertion reintroduces the exact problem it warns about.
- **Fix:** Iterate git-tracked covers (e.g. `git ls-files public/book-covers/*.webp`) instead of readdirSync, or skip any .webp whose path is not tracked, so untracked working-tree artifacts can't fail the suite.

### H19 · listBookVersions issues a single un-paginated, un-limited Query and silently truncates past 1MB
**H19** · **LOW** · **Sonnet 4.6 · medium** (T4) · Lane H PARALLEL  ·  _status: UNCERTAIN (verify carefully)_

- **Location:** `app/app/api/book/_lib/repo.ts:348-379`
- **What's wrong:** Unlike the other full-partition list functions in this file (which use queryAllItems to follow LastEvaluatedKey), listBookVersions calls QueryCommand once with ScanIndexForward:false and no Limit and no pagination loop. A single Query returns at most 1MB; if a book ever accumulates enough VERSION# items to exceed one page, the returned list silently drops the oldest versions. The class comment for queryAllItems (line 207-212) explicitly warns that 'any unbounded full-partition list must paginate or it silently truncates as the partition grows', and listVersions is exactly such a list.
- **Impact:** Admin version-history listing would under-report versions for a heavily re-published book. Version items are tiny so the threshold is high (thousands of versions) and this is admin-facing, hence low severity — but it violates the file's own pagination invariant and is a latent correctness gap.
- **Fix:** Route the query through queryAllItems (as listPublishedCatalogItems / listLicenseKeys do) so all pages are read.

### H20 · markNotificationRead is an unconditional UpdateItem on a fully client-controlled SK → stub-item injection
**H20** · **LOW** · **Sonnet 4.6 · high** (T3) · Lane H PARALLEL

- **Location:** `app/app/api/book/_lib/notifications-repo.ts:180-193 (call site app/app/api/book/me/notifications/route.ts:28-36)`
- **What's wrong:** The POST /me/notifications handler reads createdAt and notificationId straight from the request body (route.ts:28-29), builds notificationSk(createdAt, notificationId), and calls markNotificationRead, which issues an UpdateCommand 'SET readAt = :now' with NO ConditionExpression (notifications-repo.ts:185-192). DynamoDB UpdateItem is an upsert. Concrete trigger: an authenticated user POSTs an arbitrary createdAt/notificationId that does not correspond to any real notification; DynamoDB creates a new item PK=BOOKUSER#<self>, SK=NOTIF#<arbitrary>#<arbitrary> containing only readAt. These garbage NOTIF# rows are then returned by listNotifications (begins_with SK, 'NOTIF#') as malformed notifications (empty title/body/type) and are exported in the user's GDPR data export.
- **Impact:** A user can inject unbounded junk rows into their own partition, polluting their notification feed (blank notifications render in the UI) and the data export. Mild storage/abuse vector; no cross-user impact.
- **Fix:** Add ConditionExpression 'attribute_exists(PK) AND attribute_exists(SK)' to markNotificationRead so it no-ops (or 404s) when the notification does not exist.

### H21 · putEvent writes append-only analytics events with no uniqueness guard; same-millisecond events of one type silently overwrite
**H21** · **LOW** · **Sonnet 4.6 · medium** (T4) · Lane H PARALLEL

- **Location:** `app/app/api/book/_lib/analytics-repo.ts:54-56,61-87`
- **What's wrong:** eventSk(iso,eventType) = 'EVENT#<iso>#<eventType>' (line 54-56) and putEvent issues a plain PutCommand with no ConditionExpression (line 86). nowIso() has millisecond resolution. Concrete trigger: two beacons or two quiz-interaction events of the SAME eventType for the same user within the same millisecond (e.g. batched client beacons, or quiz_explanation_opened fired twice) produce the identical SK and the second Put silently overwrites the first. The doc comment claims the table is 'append-only'.
- **Impact:** Silent loss of individual analytics event rows under same-ms same-type bursts; the append-only invariant is violated. Analytics fidelity only; no user-facing effect.
- **Fix:** Append a random suffix (e.g. crypto.randomUUID() short id) to eventSk, or add a monotonic counter, so distinct events never collide.

### H22 · recordEventChapter read-modify-write has no condition guard, allowing duplicate completion side-effects
**H22** · **LOW** · **Sonnet 4.6 · high** (T3) · Lane H PARALLEL  ·  _status: UNCERTAIN (verify carefully)_

- **Location:** `app/app/api/book/_lib/events-repo.ts:78-168`
- **What's wrong:** recordEventChapter reads current progress via getEventProgress (line 89), dedups in-memory against dailyProgress[today] (line 95), then issues an UpdateCommand with NO ConditionExpression (lines 123-131) blind-SETting dailyProgress, totalChaptersCompleted, and the completion flags. Two concurrent quiz submits that both touch event chapters (the submit route loops over active events at route.ts:772-782) can both read the same 'current', both pass the dedup check, and both compute justCompleted, then both run the completion block (lines 134-165). awardFlowPoints (sourceId=eventId) and putBadgeAward (conditional) are idempotent, but createNotification (lines 154-164) has no idempotency guard, so the user receives duplicate 'Event Complete' notifications; the blind totalChaptersCompleted SET can also lose a concurrent increment.
- **Impact:** Duplicate event-completion notifications and possible under-count of totalChaptersCompleted under concurrent loop completion. No IP/badge double-grant (those dedup). Low likelihood (requires near-simultaneous submits).
- **Fix:** Gate the completion side-effects on a conditional transition (e.g. UpdateExpression set completed only when 'completed <> :true', ReturnValues to detect the actual transition) and only fire the IP/badge/notification block when the update itself flipped completed false→true.

### H23 · share-events returns 500 server_error instead of a typed 400 on missing/invalid JSON body
**H23** · **LOW** · **Sonnet 4.6 · medium** (T4) · Lane H PARALLEL

- **Location:** `app/app/api/book/me/share-events/route.ts:25`
- **What's wrong:** `const body = requireBodyObject(await req.json());` calls req.json() with no try/catch. On an empty or malformed body (e.g. a beacon/sendBeacon with no payload, or a content-type mismatch) req.json() throws a SyntaxError that is NOT a BookApiError/AuthError, so withBookApiErrors (http.ts:92-110) maps it to a generic 500 'server_error' and fires the OpsFailure monitoring metric. Peer routes (saved/route.ts:34-39, settings/route.ts:89-94, badges/route.ts:43-48, streak/route.ts:53-59) all wrap req.json() in try/catch and default to {} so they return a clean typed 400. This route is the one outlier.
- **Impact:** A benign malformed/empty submission produces a 500 (not the intended 400 invalid_json) and pollutes the OpsFailure alarm with non-actionable noise during launch monitoring.
- **Fix:** Wrap the parse: try { bodyRaw = await req.json(); } catch { bodyRaw = {}; } then requireBodyObject(bodyRaw) — matching the sibling routes.

