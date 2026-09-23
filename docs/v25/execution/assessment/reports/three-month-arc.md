# three-month-arc

## keyFacts
- VERIFIED: The last pipeline-generated books to reach the app were published 2026-07-10: radical-candor (commit 44c311e0d) and the-culture-code (b8acdd6e1). book-packages/.pending-deploy.json on origin/main records lastCompletedAt 2026-07-10T22:55:00Z with the note 'high-output-management, multipliers, radical-candor, the-culture-code: upload-s3 + deploy + API registration + verify-live all complete'.
- VERIFIED: v24 author-first pipeline books in the catalog: the-power-of-moments (aec0ecd6e 07-02, whose message says 'First book through the v24 author-first pipeline'), execution (07-04), high-output-management (07-08), multipliers (07-09), the-culture-code and radical-candor (07-10). All are imported in app/book/data/bookPackages.ts and listed in lib/books-catalog.metadata.json (135 rows).
- VERIFIED: v21 pipeline books: 32 'Publish … v21 package' commits between 06-14 and 06-30. tiny-habits was reverted the same day (7066e69bf). decisive, the-now-habit, stolen-focus and the-year-of-less went in by 'v1, manual registration' (49d2010fb, d5c1fd927). the-intelligent-investor (6f930f404, 06-30) came from the v23 compiler per memory v23-compiler-pipeline-fix-campaign.
- VERIFIED: No v25 book has been published. Franklin appears 0 times in bookPackages.ts and in lib/books-catalog.metadata.json. Revision 6 (packageId the-autobiography-of-benjamin-franklin-v21-1787898655699, 2026-08-28, 4 chapters titled Part One through Part Four) was committed by #526 as 'provenance only, not for publishing'.
- VERIFIED: Phase A (docs/v25/S_TIER_PHASE_A_REPORT_2026-09-02.md §1) scored revision 6 with six fresh blind readers at composite 64.6, gate 0/6, churn HIGH. The earlier 3-reader handoff card scored the same bytes 76.4, a reader-variance gap of about 12 points.
- VERIFIED: The 2026-09-02 owner mandate (plan line 3 and memory Phase B line 13) is: identify every issue, fix the pipeline so it produces high-quality work, test ONE book, return the output. The deliverable (plan 4B/4C) is a released package plus a 6-blind-reader scorecard and plain-language evaluation. publish-final is the owner's step (handoff §1.6 and Phase B step 3).
- VERIFIED: Quality bars. Internal promotion needs a panel PASS with 0 blockers and a chapter floor of 70 (src/review/readerReview.ts:163), then fresh QC, the judges and the rubric gate at CHAPTERFLOW_RUBRIC_BAR=80 (drive-franklin-v7.sh:46). The handoff's high-quality bar (line 78) is composite ≥85, no factor below 70, Retention and Quizzes ≥80, churn not HIGH; S-tier is above 90. Phase A says only 4 of 97 catalog books reach 85 and none has scored above 90.
- VERIFIED: The 19-chapter Franklin book has never passed a reader panel. Every review file since 2026-09-06 is FAIL or ERROR. The last PASS was repair-r7-review-88b… on 2026-08-28, which was the 4-chapter book.
- VERIFIED: Blocker counts for the current run book-run-39a37d06 (reviews/*.json): 34, 27, 21, ERROR, 17, 13, 19, 1, 15, 9, 1, 1, 1, 18, 9, 10, 15, 16, then ERROR ×4 on 09-20T14:57. The ERROR blocker message is 'You've hit your weekly limit · resets Sep 22 at 7pm (America/Toronto) (api_error_status=429)'.
- VERIFIED: The run is wedged. The last event (2026-09-20T14:58:03Z) reads 'canonical review successor budget exhausted after 3 ordinals; every review-repair-21 successor carries a stored ERROR review'. The driver output ends with 'WEDGE STOP: three identical terminal lines'.
- VERIFIED: current.json for Franklin is still revision 6 from 2026-08-28T06:30:55Z. No promotion has happened since. The events log shows promotions COMPLETED only on 08-22 (bookRevision=1) and 08-28 (bookRevision=5), both with readerPackage=NOT_PRODUCED.
- VERIFIED: Phase B merged 36 PRs (#526 to #564, 09-02 to 09-08; gh pr list --state merged). 10 more fix PRs (#566 to #575) and #559 (CONFLICTING) are OPEN. origin/main is be9c44ed8 (2026-09-08).
- VERIFIED: The canonical checkout ~/ChapterFlow-books-v25-completion is detached at local-only 9f0117cb7, 10 commits ahead of origin/main. The plan, Phase A report and issue register (.md and .json) are UNTRACKED (git status '??'); only S_TIER_HANDOFF_PROMPT.md is committed.
- VERIFIED: The CI job 'v21 Pipeline Typecheck + Tests' (.github/workflows/ci.yml:158-190) runs typecheck:book, which includes scripts/book/** so the v25 source is typechecked. Its pipeline:test resolves to the @chapterflow/v21-authored workspace. The v25 suite (root script pipeline24:test) is not in CI, so green CI on v25 PRs is evidence of compilation only, not of v25 test results.
- VERIFIED: Three July v25 lines were never merged: origin/feat/v25-pipeline-live (61 commits, PR #401 still open), origin/plan/v25-s-tier-implementation (215 commits), origin/impl/v25-evaluator-selection (263 commits). None is an ancestor of origin/main. The codex V4 line (a20d1cdab) and the feat/v25-pipeline checkpoint 96ba28179 are on main.
- UNVERIFIED (memory v25-architecture-audit-2026-07-16.md only): the July GPT-5.6 SOL campaign spent about 1,494 codex calls and produced zero books and zero frozen role sets. Open PR #406 'P5 pilot-role-readiness live campaign evidence (36 calls, BLOCKED terminal)' is consistent with this.
- VERIFIED: Model policy is now Claude Sonnet 5 via claude-cli for every role (config/model-routing.json). The author role dropped from high to medium effort on 2026-09-17 (PR #568, open). Every pipeline model call therefore uses the Claude subscription weekly cap that this session also uses.
- VERIFIED: 194.6 hours of idle time (2026-09-08T18:29 to 2026-09-16T21:06) sit in the Franklin events log, attributed in the Phase B log to a Mac reboot with no auto-restart. The run has been idle again since 2026-09-20T14:58.
- VERIFIED: 11 distinct Franklin book-run ids exist since 2026-09-04 (events log), several of them fresh restarts that re-ran research and compile. The Bennett canary (how-to-live-on-24-hours-a-day) ran 8 times from 08-24 to 08-28 and was never promoted.
- VERIFIED: Resume and wedge fixes are a recurring class: 30 commits on main since 07-20 have wedge, resume, reconcile, successor, replay, ordinal or livelock in the subject, and 4 of the open PRs (#566, #572, #574, #575) are the same class.
- VERIFIED: Quota and usage-limit handling has been fixed three times: a14761cfb (07-28), 0ef576a8a/#483 (08-11), 81b4387c6/#529 (09-02). It still wedged the review lane on 09-20 (defect #20 in the Phase B log; the ERROR review JSON shows the 429).
- VERIFIED: Panel noise on identical content. The same candidate got 13 blockers (review-91f87b9c, 09-08) and then 19 (review-94d7f8eb, 09-17 successor). INFERRED from the Phase B log's 09-20 corroboration data: blockers confirmed by at least 2 seats on the same unit were 0,1,0,0,0,0 over 6 panels, so the union-of-any-seat rule sets a noise floor the repair loop cannot get under.
- VERIFIED: The launchd agent com.chapterflow.franklin-autoresume is loaded (launchctl list). Its log shows it polling every 15 minutes and staying stopped on the WEDGE STOP marker (latest entry 2026-09-23T00:23Z).
- VERIFIED: Contradiction. S_TIER_HANDOFF_PROMPT.md:43 says 'Chapter composite bar is 80', but the code has AUTHOR_CHAPTER_BAR = 70 (readerReview.ts:163; lowered from 80 by 2ec97fe55 on 07-29). The comment at authorReview.ts:1723 still says default 80.
- INFERRED (from the Phase B log and a 19-chapter latest candidate verified in candidates/review-repair-21…/content/content/chapters): scope grew from the 4-Part book (revision 6) to 19 chapters when source-text ingestion mapped the edition's headings. The log says 'decided to let it run' at about 5x cost, and I found no owner decision on it.

## openQuestions
- Does prod still serve the 37 pipeline books registered in the repo, including the 4 v24 books verified on 07-10? A read-only check with aws --profile chapterflow (S3 book-content/books/<slug>/ and the DynamoDB BOOKCATALOG rows) would settle it.
- Which bar does the owner count as 'done' for Franklin? The pipeline's internal rubric bar is 80, the handoff's high-quality bar is ≥85 with factor floors, and S-tier is above 90, which no catalog book has reached. Phase A says above 90 needs an owner decision, and I found no recorded one.
- Did the owner approve growing the test book from 4 Parts to 19 chapters? It is roughly 5x the cost per loop, and the Phase B log records it as the orchestrator's call.
- Were the July lines (feat/v25-pipeline-live with PR #401, plan/v25-s-tier-implementation, impl/v25-evaluator-selection) formally abandoned? They are unmerged, and the D2 'rename to archive/' decision was never carried out.
- The ~1,494-codex-call / zero-book figure for July comes only from a memory file. The SOL campaign evidence (PR #406 / state/run-ledger) would confirm the call count.
- Is the tiny-habits package currently in the catalog the original or the aborted regeneration? The revert commit 7066e69bf says 'restore original'; diffing book-packages/tiny-habits.v21.json against the state before dae06394a would confirm it.
- Where are the as-a-man-thinketh canary artifacts (07-22 to 07-24)? They are not under ~/cf-canary/books, and the Franklin events log only starts 2026-08-15, so earlier Franklin runs (07-28 to 08-15) are not in the current log. They are probably in another v25 root or were pruned.

## report

## Three-month arc of the book pipeline, June 2026 to 2026-09-22

### 1. Bottom line
- **The pipeline last put a book into the app on 2026-07-10.** Radical Candor and The Culture Code came out of the v24 author-first pipeline. Evidence: `git log origin/main` shows `44c311e0d` and `b8acdd6e1`, both 2026-07-10 and both titled "publish … package to live catalog". `book-packages/.pending-deploy.json` on origin/main reads `"lastCompletedAt": "2026-07-10T22:55:00Z"` with the note "high-output-management, multipliers, radical-candor, the-culture-code: upload-s3 + deploy + API registration … + verify-live all complete".
- **The v25 line has produced no published book in about 10 weeks (07-10 to 09-22).**
  - Its one released package is Franklin revision 6 (2026-08-28, 4 "Part" chapters). It is committed "for provenance only, not for publishing" (`a6921414d`, #526). A blind panel scored it 64.6 with the gate failing (`docs/v25/S_TIER_PHASE_A_REPORT_2026-09-02.md` §1).
  - Franklin is not registered in the app. `command grep -c franklin` returns 0 for both `app/book/data/bookPackages.ts` and `lib/books-catalog.metadata.json`, which has 135 rows.
- **The 19-chapter Franklin book being built under the 2026-09-02 mandate has never passed a reader panel.**
  - Every Franklin review since 2026-09-06 is FAIL or ERROR. The last PASS was `repair-r7-review-88b…` on 2026-08-28, which was the 4-chapter book.
  - In the current run (`book-run-39a37d06…`), the panel blocker counts were 34, 27, 21, 17, 13, 19, 15, 9, 18, 9, 10, 15, 16, then ERROR (from `reviews/*.json`).
  - The run has been wedged since 2026-09-20T14:58:03Z. The events log ends with "canonical review successor budget exhausted after 3 ordinals".

### 2. Campaign timeline

| Dates | Campaign / pipeline | Goal | What shipped | Books | How it ended |
|---|---|---|---|---|---|
| 06-14 to 06-27 | **v21** (`chapterflow-v21-authored`), Book Autopilot #235 (06-19), hardening PR #297 (06-25), 10/10 critic campaign (06-25/26), autopilot autonomy #372 (06-27) | Hands-off book generation with QC convergence | 303 pipeline commits in June (`arc-gitlog.txt`) | 32 "Publish … v21 package" commits, 06-14 to 06-30. Tiny Habits was reverted the same day (`7066e69bf`). 4 books went in by "v1, manual registration" (`49d2010fb`, `d5c1fd927`). | Corpus eval on 06-26: 36 of 130 books CAPPED by gate failures; distractor-tell averages 69% (memory `book-corpus-quality-eval-2026-06-26.md`). Superseded by v23. |
| 06-19 | 7A wire-in (#231) | Show 32 orphaned books that were already published to prod | Catalog-only change | Not new generations | Done |
| 06-30 to 07-02 | **v23 compiler** (`6668a78ab`, then P01–P15) | Compile-before-assemble, rubric alignment | 18 findings plus 2 follow-ups fixed (memory `v23-compiler-pipeline-fix-campaign`) | the-intelligent-investor (`6f930f404`, 06-30). Memory says it took 30 QC rounds. | QC-rubric audit on 07-01 found about 64 of 100 rubric points with no QC axis. Replaced by v24 author-first. |
| 07-02 to 07-10 | **v24 author-first** (`ff637d28d`), STIER-2, final hardening, anti-sameness, CF-A..J | Whole-chapter writers plus a reader panel | Many local commits | POM v24 (`aec0ecd6e`, "First book through the v24 author-first pipeline", acceptance 80.3), execution (07-04), HOM (07-08), multipliers (07-09, "first v24 book above premium 80"), culture-code and radical-candor (07-10) | **The last pipeline books to reach the app.** Work moved to v25. |
| 07-10 to 07-16 | **v25 GPT-5.6 SOL migration** (IMP-00..IMP-20, Stage-Q, P5 qualification). PR #401 `feat/v25-pipeline-live` is still OPEN. | Move to GPT-5.6 with qualification campaigns | Checkpoint `96ba28179` is on main; `feat/v25-pipeline-live` is 61 commits ahead and unmerged | 0 | Audit on 07-16 returned VERDICT C SIMPLIFY: "≈1,494 codex calls … → ZERO books" (memory `v25-architecture-audit-2026-07-16.md`) |
| 07-16 to 07-18 | **Fable S-tier 42-work-package plan** plus an evaluator implementation | Build the D7 ship gate and run a model bakeoff | Paused at Phase 6 with 28 of 42 packages done | 0 | Both branches were abandoned. `origin/plan/v25-s-tier-implementation` is 215 commits and `origin/impl/v25-evaluator-selection` is 263 commits ahead of main; neither is an ancestor of main. The policy went "NO GPT-5.5", then "NO Claude rating", then Sonnet 5 on 07-22. |
| 07-20 to 07-22 | **Codex V4 hexagonal re-architecture** (`codex/v25-pipeline-completion-recovered`, about 70 commits) | Run-state, resume, atomic promotion | Became the main line (`a20d1cdab` is on main) | 0 | 43-agent audit returned ADOPT-WITH-FIXES: "semantic review machinery preserved-DEAD" |
| 07-22 to 08-04 | **Live canary on Claude Sonnet 5** (as-a-man-thinketh, then Franklin) | Run every stage live | PR #450 merged 08-04: "45 canary findings fixed" | 0 | Canary report §6 says QC and promotion had never run live |
| 08-04 to 08-28 | Franklin 4-Part scar cycles 3–13+, Bennett canary | First live promotion | Promotion `bookRevision=1` on 08-22 and revision 6 released on 08-28 (events log plus `current.json` revision 6). Bennett (`how-to-live-on-24-hours-a-day`) had 8 runs and none promoted (its events log). | 0 published | Phase A (09-02) re-scored revision 6 at 64.6 FAIL and verified 8 source distortions against Gutenberg #20203 |
| 09-02 to 09-04 | **Phase B waves 0–3** (plan `S_TIER_EXECUTION_PLAN_2026-09-02.md`) | Source-text ingestion, grounding redesign, editor pass, fidelity judge, rubric gate | 22 PRs merged, #526–#546 (`gh pr list --state merged`) | — | Franklin v7 run launched 09-04 |
| 09-04 to 09-08 | Franklin v7 (19 chapters, with source text) | Run the test book | 14 more PRs merged, #547–#564; origin/main is at `be9c44ed8` (09-08) | 0 | Panels went 60, 50, 34, 29, 13 blockers. The run was then idle for 194.6 h after a Mac reboot (event gap from 09-08T18:29 to 09-16T21:06). |
| 09-16 to 09-20 | Franklin v8 fresh runs, parallel panel and compile | Get past the wedges and reach PASS | 10 PRs #566–#575, all OPEN, cherry-picked into the local-only commit `9f0117cb7` | 0 | Wedged on 09-20 because a weekly-limit 429 burned all 3 review successors (defect #20). The owner paused on 09-23 00:08Z (memory log). |

### 3. Pipeline books in the app today (repo registration verified; prod not checked)
All 37 slugs from the pipeline "Publish" commits are imported in `app/book/data/bookPackages.ts`, and each has a row in `lib/books-catalog.metadata.json` (checked slug by slug).

| Pipeline | Books (publish commit date) |
|---|---|
| v21 | gifts-of-imperfection (06-14); eat-that-frog, hyperfocus, digital-minimalism (06-17); power-of-full-engagement (06-19); factfulness, undoing-project (06-20); organized-mind, fooled-by-randomness, quiet (06-21); happiness-hypothesis, emotional-intelligence, paradox-of-choice, nudge, stumbling-on-happiness (06-22); behave (06-23); molecule-of-more, dopamine-nation (06-24); willpower (06-25); slight-edge, willpower-instinct, millionaire-next-door, compound-effect (06-26); first-90-days, effective-executive (06-27) |
| v21 packages registered by hand (older, pre-source-v2 generations per memory) | decisive, the-now-habit, stolen-focus, the-year-of-less (06-25) |
| v21 publish reverted | tiny-habits: published at `dae06394a`, reverted at `7066e69bf` ("abort regen, restore original"). The slug is still registered, presumably the original package. |
| v23 compiler | the-intelligent-investor (06-30; 07-03 re-stamp) |
| v24 author-first | the-power-of-moments (07-02), execution (07-04), high-output-management (07-08), multipliers (07-09), the-culture-code, radical-candor (07-10) |
| v25 | **none** |

Not checked: whether the live prod catalog still matches. The ledger records the 4 July books as verified live on 07-10. There was a later prod deploy, `ef6f6a7ee`, on 07-22/23 (memory index).

### 4. Owner's definition of done for the current mandate
- **The mandate.** Memory Phase B line 13 and plan line 3: "identify ALL issues, fix the pipeline so it produces high-quality work, test ONE book, return the output for evaluation." The owner described the goal as "enjoyable, easy to understand, easy to read, accurate with the source, clean."
- **The deliverable** (plan Wave 4):
  - 4B: run, promote and release the book. Publish stays the owner's step.
  - 4C: six blind readers score it (the same reader class as Phase A), the gate is adjudicated against the source text, and the owner gets the package, a scorecard and a plain-language evaluation.
- **The publish step.** Handoff §1.6: "The real `publish-final` … is classifier-gated … Surface the exact command and stop." Handoff Phase B step 3: "When a Franklin revision clears the bar, hand the owner the `publish-final` command and stop."
- **The quality bars:**
  - The pipeline's internal promotion needs a panel PASS (0 blockers and a chapter floor of 70, per `src/review/readerReview.ts:163 AUTHOR_CHAPTER_BAR = 70`), then fresh QC, the judges, and the rubric gate at `CHAPTERFLOW_RUBRIC_BAR=80` (`drive-franklin-v7.sh:46`).
  - The handoff's high-quality bar is: gate PASS, composite ≥85, no factor below 70, Retention and Quizzes ≥80, churn not HIGH. S-tier means a composite above 90.
  - Phase A says only 4 of 97 catalog books reach 85 and none has ever scored above 90, so the "above 90" target needs an owner decision.

### 5. What "finalize" concretely requires (from the evidence)
None of the following has happened yet for the 19-chapter book:
1. A panel PASS.
2. Fresh QC and the judges run live on it.
3. The rubric gate at 80.
4. Promotion and release, which would produce the package plus its production-manifest sidecar.
5. The 6-reader blind scorecard from `score-franklin-v7.js`, which exists but has never run on a v7/v8 package.

After that comes the owner's `publish-final` step.

Things that block step 1:
- **Defect #20:** a quota 429 is stored as an ERROR review and burns all 3 successors (`MAX_REVIEW_SUCCESSOR_ORDINALS=3`, which is not an operator setting). The run cannot resume without a code fix.
- **The gate-rule decision (A/B/C).** Phase B log for 09-20 05:10Z: blockers confirmed by at least 2 seats on the same unit came to 0, 1, 0, 0, 0, 0 across 6 panels, and seat-skeptic files 60–70% of all blockers.
- **The 10 open PRs** #566–#575.

### 6. Patterns that consumed time without producing a book (with evidence)
1. **Re-architecture and changes of model policy.**
   - The pipeline went v21, then v23 compiler (06-30), then v24 author-first (07-02), then v25 SOL (07-10), then the Fable 42-package plan (07-16), then the codex V4 hexagonal rewrite (07-20), then Sonnet 5 via the claude CLI (07-22).
   - Three July lines were never merged: 61, 215 and 263 commits (`git rev-list --count origin/main..<branch>`).
   - Model policy went "NO GPT-5.5; gpt-5.6 only" (07-16), then "NO Claude-family rating" (07-17), then Sonnet 5 everywhere (07-22; `config/model-routing.json`).
2. **Resume and wedge fixes.** On main since 07-20 there are 30 commits with wedge, resume, reconcile, successor, replay, ordinal or livelock in the subject (`arc-gitlog.txt`). The open PRs #566, #572, #574 and #575 are the same class. Each live fix exposed the next fail-closed check (GPT-audit memory: "each live fix exposes the next seam's fail-closed check").
3. **Usage limits, fixed four times and still recurring.**
   - Fixes: `a14761cfb` (07-28 quota fails fast), `0ef576a8a` (#483, 08-11 credentials), `81b4387c6` (#529, 09-02 quota stops the run).
   - It still recurred as defect #20: the review lane stored ERROR on 09-20. The blocker message reads "You've hit your weekly limit · resets Sep 22 at 7pm (America/Toronto) (api_error_status=429)" in `review-b1066b7e….json`.
   - Session limits also killed implementer agents on 09-02 and 09-03 (Phase B log).
4. **Gate oscillation from a noisy panel.**
   - The same candidate scored 13 blockers, then 19 on a fresh successor panel (reviews `91f87b9c` on 09-08 and `94d7f8eb` on 09-17).
   - The current run oscillates between 9 and 19 blockers after its 5th panel.
   - In August, the 4-chapter book passed only after 7 repair re-reviews (`repair-r1..r7-review-88b…`).
5. **Scar and prompt treadmill.** Since 07-20, 28 commits are Franklin, Bennett or as-a-man-thinketh scar or content commits. Phase A found the scar approach hammering tokens and even inducing a false fact (scar 24).
6. **Throughput and idle time.**
   - A sequential panel took about 6–7 h per round before #570.
   - The run sat idle for 8.1 days after a reboot with no auto-restart.
   - 11 Franklin book-run ids exist since 09-04, and fresh runs restarted research and compile several times.
   - The run has been idle again since 09-20.
7. **Verification gaps.**
   - CI job "v21 Pipeline Typecheck + Tests" (`.github/workflows/ci.yml:158-190`) runs `typecheck:book`, which covers `scripts/book/**` so the v25 source is typechecked.
   - Its `pipeline:test` targets `@chapterflow/v21-authored`, so v25 tests never run in CI. The v25 suite (`pipeline24:test`) is not in CI.
   - A green CI result on v25 PRs therefore proves only that the code compiles.

### 7. Contradictions found
- The handoff (`S_TIER_HANDOFF_PROMPT.md:43`) says "Chapter composite bar is 80". The code has `AUTHOR_CHAPTER_BAR = 70` (`readerReview.ts:163`, set by `2ec97fe55` on 07-29). `authorReview.ts:1723` still has a comment saying "default AUTHOR_CHAPTER_BAR=80".
- The handoff says revision 6 is "VERIFIED" at 76.4. Phase A found it FAIL at 64.6 on the same bytes. The difference is reader variance of about 12 points.
- The canary report's 08-22 banner says "CAMPAIGN COMPLETE. Promotion executed live". Yet the promotion events say `readerPackage=NOT_PRODUCED`, and the book was never published.
- The GPT-audit decision D2 said to rename `feat/v25-pipeline-live` to archive/. It still exists on the remote, and PR #401 is still open.

### 8. Local-only state at risk
- The canonical checkout is detached at `9f0117cb7`, 10 local commits ahead of origin/main (`git log origin/main..HEAD`).
- The plan, the Phase A report and the issue register are **untracked** (`git status`: `?? docs/v25/S_TIER_EXECUTION_PLAN_2026-09-02.md`, `…PHASE_A_REPORT…`, `…ISSUE_REGISTER….md/.json`). Only the handoff prompt is committed.
- The launchd agent `com.chapterflow.franklin-autoresume` is loaded (`launchctl list`). It polls every 15 minutes and currently does nothing because of the WEDGE STOP marker (`autoresume.log`, latest entry 2026-09-23T00:23Z).