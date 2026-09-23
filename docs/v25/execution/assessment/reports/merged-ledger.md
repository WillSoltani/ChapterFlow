# merged-ledger

## keyFacts
- VERIFIED: 36 PRs merged from #525 to #564 (gh pr list): #525-#556, #558, #560, #562-#564. #557 does not exist; #559 is OPEN; #561/#565 are closed Dependabot PRs; #566-#575 are OPEN and exist only as cherry-picks on local 9f0117cb7 (origin/main = be9c44ed8).
- VERIFIED: CI runs no v24/v25 pipeline tests. package.json:32-33 points pipeline:typecheck/pipeline:test at --workspace @chapterflow/v21-authored; the only workspace (package.json:9-10) is v21; ci.yml:176-183. typecheck:book (tsconfig.book.json includes scripts/book/**) does type-check v24 source, which is how the BigInt break fixed in #546 was caught.
- VERIFIED: 'v21 Pipeline Typecheck + Tests' was FAILURE at merge for #526-#533 and #542-#545; 'E2E Smoke (dev build)' was FAILURE on all 36 merged PRs (gh pr view statusCheckRollup).
- VERIFIED: no merged PR has any GitHub review or comment (checked 11 PRs, all '0 comments, 0 reviews'). All adversarial-review evidence is in the workflow journals (~/.claude/projects/-Users-radinsoltani-ChapterFlow/*/subagents/workflows/wf_*/journal.jsonl, 1,353 result records).
- VERIFIED: every merged PR except #525/#526 has a journal APPROVE/PASS before merge. Multi-round examples: #538 R,R,R,A (+ merge audit A); #544 A(2 majors),R,A,A; #547 R,R,R,A; #560 3 rounds; #535 and #540 each had a round flagged gateWeakened=true before approval.
- VERIFIED: 2A source-fidelity judge (#544) never ran live. It is hosted in fresh-qc (bookRunApplicationService.ts:936-946); the last fresh-qc COMPLETED event in the Franklin events log is 2026-08-28T05:39:34Z, before the campaign; 0 fidelity lines in fv7*/fv8* logs.
- VERIFIED: 2C rubric gate (#542/#545) never ran live. The 'rubric' phase exists (bookRunApplicationService.ts:74) but no event with phase=rubric appears anywhere in the 4,410-line events file; 0 catalog-rubric lines in logs.
- VERIFIED: no review has COMPLETED (passed) during the campaign. The last review COMPLETED event is 2026-08-28T05:39Z; the last promotion event is 2026-08-28T06:30Z. Every stage after review (fresh-qc, rubric, promotion, release from #533) has never run on v25 code.
- VERIFIED: 2B editor pass (#543) runs live: 69 'action=CHAPTER_EDITED' lines (fv7e 16, fv7g 18, fv8b 16, fv8d 19); first at fv7e-r9.log:86. Its R-166 advisory sub-pass never ran (69x advisory=NOT_RUN; it needs a PASS review).
- VERIFIED: source ingestion (#540) runs live: fv8c-r1.log 'Source text: …377692 bytes, sha256 8d71d7dc6784…' and 'chapter map: 19 span(s) covering 100.0%'; the research manifest has sourceProvenance=source-text.
- VERIFIED: the Franklin scar file (#538) has 42 rules: 8 book-wide and 34 scoped to ch01(6)/ch02(8)/ch03(14)/ch04(6) of the old 4-part rev-6 structure. Scoping is by chapter number (src/lib/bookScars.ts:68,88-117).
- VERIFIED: a live writer prompt for chapterTitle 'Arrival in Philadelphia' (ch03 in the 19-chapter map; CLI session …att-compiler-operator-retry-1/13af0591…, 2026-09-17) contains 'FACT PIN (ch03): Bond's subscription drive came FIRST', a pin meant for the old civic-projects part.
- INFERRED (from bookScars.ts scoping plus the scar file): chapters 5-19 of the live run receive no chapter-scoped fact pins, and ch03/ch04 receive pins for episodes they do not cover. The pins meant to stop the 8 Phase-A source distortions are therefore mostly not reaching the right chapters, and 2A, which would catch those distortions, has never run.
- VERIFIED: #529 quota classification did not stop the 09-20 weekly-limit 429 in the reader lane. review-35abdd05….json contains 'weekly limit … (api_error_status=429)' with outcome ERROR; the driver out ends 'canonical review successor budget exhausted after 3 ordinals' then WEDGE STOP at 2026-09-20T14:58:03Z; 'PROVIDER BLOCK' count in franklin-v7b-driver.out is 0.
- VERIFIED: autoresume is idle. autoresume.log repeats 'stop-and-stay-stopped state ("WEDGE STOP…") — doing nothing' through 2026-09-23T00:23Z.
- VERIFIED: recent verdicts for run 39a37d06 (review JSON files): review-1ca523b6 FAIL 10 blockers/562 warnings; review-052e2b67 FAIL 15/541; review-ba9e7444 FAIL 16/571; review-35abdd05 ERROR 7/439.
- VERIFIED (log): suite progression 2880 (baseline) -> 2890 (#527) -> 2934 (#532) -> 2965 (#537) -> 2980 (wave 0) -> 3152 (wave 1) -> 3157 (waves 2+3; v25 66 files/645) -> 3158 (#546) -> 3202 (#547) -> 3237 (#550) -> 3278 (#554) -> 3283 (#555/#556/#558) -> 3284 (#560-#564). Journal suite fields agree where present (e.g. #544 3157/0, #547 3202/0, #554 3278/0).
- VERIFIED (log line 59): the combined local checkout 9f0117cb7 was checked only by typecheck plus targeted files (resilience 29/29, repair-lane 26/26). No full-suite run on the combined checkout is recorded.
- VERIFIED: live markers for resume/robustness fixes: #549 fv7-r2.log:4 'continuing this run's OWN research run'; #556 fv7e-r2.log:86-87 EVICT 'Chase' / 'rather than'; #558 29 CARRY_OVER_REJECTED_DRAFT (first fv8b-r10.log:69); #563 fv7l-r1.log:16 RECONCILED_UNSETTLED_ON_RESUME on review-repair-5; #564 fv7l-r1.log:2 REOPENED_UNDER_DIFFERENT_SOURCE_SHA; #537 review-successor at fv7e-r9.log:105 and BOOK_RUN_COMPILER_RETRY_EXHAUSTED in fv7d-r3..r5.
- VERIFIED: #532 routing provenance is live: 'routing=c755f5259a7a' x10 in runs/review-repair-21-run-…/attempts.jsonl. #553 is live: 65 'rejected' dirs under run-state runs.
- UNVERIFIED (log-only claims): #560 fixed refusals and decoration (74 seat reads, 0 failures vs 9/69; log line 159); #562 fixed the ch10 retitle (log line 182); #548 removed hardEdge template rejections (log line 258).
- VERIFIED: plan WP status. Wave 0 (0A-0H plus 0I) merged. Wave 1 (1A, 1A2 inside #540, 1B, 1C) merged. 2A/2C merged but never live. 2B merged and live. 3A merged but misaligned to the 19-chapter map. 4A driver exists (caffeinate, --source-text, provider scan, wedge stop). 4B NOT DONE (0 promotions). 4C NOT DONE (score-franklin-v7.js from 09-05 has no package to score).
- VERIFIED: rev-6 was recorded by #526 (a6921414d: book-packages/…franklin.v21.json 856 lines changed plus production-manifest plus report). It is the Phase A baseline and the only released Franklin package; no v25 package exists.

## openQuestions
- Will 2A (source-fidelity judge) and 2C (rubric gate) work, and at what cost, on the real 19-chapter candidate? Neither has ever run live. Settling it needs an offline or dry invocation of fresh-qc and rubric against the latest candidate (review-repair-21-candidate-06d7596a…), or a run that gets past review. Both call models, so both compete for the shared weekly cap.
- Does the scar misalignment hurt quality? The ch03/ch04 pins land in unrelated chapters and chapters 5-19 get none. Settling it: diff the rendered writer and editor prompts per chapter for the current run, and decide whether the 34 chapter-scoped rules need re-keying to the 19-chapter map (a content-only edit to config/book-scars, but it changes scarsDigest and invalidates cached packs).
- Why did #529's isUnretryableProviderMessage (which is present in src/app/semanticPanelReviewEvaluator.ts) not turn the reader-seat 429 into a provider stop? Settling it: read the reader-lane error path that stores outcome=ERROR for review-35abdd05. This is defect #20, which another investigator likely covers.
- Does the full test suite pass on the combined local checkout 9f0117cb7 (main plus #566-#575 with two hand-resolved hunks)? Only targeted files were recorded. Settling it: the suite run currently in progress in ~/cf-wt/assess-main and ~/cf-wt/replay-cp-dry.
- Were R-081, R-082, R-084, R-085 and R-086 (the scars register ids) closed? The #538 body names only R-083/R-274/R-275 plus a 37-row disposition ledger. Settling it: compare the ledger rows to the register text for each id.
- Did #527's voice card actually render in live writer prompts? Not checked. Settling it: grep a 09-19 compiler CLI session for the voice-card block.
- Log-only claims for #560, #562 and #548 were not re-derived from raw attempts. Settling them: count seat attempt outcomes in the reader-lane run-state for the 09-06/09-07 panels, and check the ch10 repair in review-repair-2 of run 4dc2a413.

## report

## Ledger of merged v25 campaign PRs #525 to #564, and plan work-package status

Scope: every merged PR from #525 to #564, mapped to the plan's work packages (`docs/v25/S_TIER_EXECUTION_PLAN_2026-09-02.md`) with test and live evidence. The investigation was read-only. Scratch files are in `.../scratchpad/assess/ledger/`: `results.jsonl` holds all 1,353 journal result records, and `verdicts.txt` and `wf-summary.txt` hold the per-PR and per-workflow extracts.

### 0. The four points that matter most

1. **The two new quality stages (2A source-fidelity judge and 2C rubric gate) have never run on Franklin.** The events log `~/cf-canary/book-run-events/the-autobiography-of-benjamin-franklin.jsonl` has 4,410 lines:
   - The last `fresh-qc` COMPLETED event is 2026-08-28T05:39:34Z, before the campaign. 2A lives inside fresh-qc (`src/app/bookRunApplicationService.ts:936-946`).
   - No `rubric` phase event has ever been emitted, even though `rubric` is in `BOOK_RUN_PHASES` at `bookRunApplicationService.ts:74`.
   - The last `promotion` event is 2026-08-28T06:30Z.
   - The last `review` COMPLETED event is 2026-08-28T05:39Z. No review has passed during the campaign, so every stage after review has never run on v25 code.
2. **CI is not evidence for the v25 pipeline.** `package.json:32-33` points `pipeline:typecheck` and `pipeline:test` at `--workspace @chapterflow/v21-authored`, and the only workspace listed (`package.json:9-10`) is v21. `ci.yml:176-183` runs `typecheck:book`, `pipeline:typecheck` and `pipeline:test`. `typecheck:book` (`tsconfig.book.json` includes `scripts/book/**`) does type-check v24 source, which is how the BigInt break was caught and fixed in #546. No v24/v25 test file runs in CI; the only v25 test evidence is local runs recorded in journals and the log.
3. **New finding: the Franklin scar file from 3A (#538) is scoped to the old 4-part structure, but the live runs use a 19-chapter map.**
   - The scar file (`config/book-scars/the-autobiography-of-benjamin-franklin.json`) has 42 rules: 8 book-wide, and 34 scoped to ch01 (6), ch02 (8), ch03 (14) and ch04 (6).
   - Scoping is by chapter number (`src/lib/bookScars.ts:68,88-117`).
   - Verified in a live prompt: CLI session `-Users-radinsoltani-cf-canary-att-compiler-operator-retry-1/13af0591-….jsonl` (2026-09-17) is the writer prompt for `chapterTitle: Arrival in Philadelphia` (ch03 in the 19-chapter map). It contains `FACT PIN (ch03): Bond's subscription drive came FIRST…`, a pin about hospital fundraising decades later.
   - It follows from the scoping rule that chapters 5–19 receive no chapter-scoped fact pins, and ch03/ch04 receive pins for episodes they do not cover. Neither the running log nor any review mentions this.
4. **The run is wedged.** `franklin-v7b-driver.out` ends with `BOOK_RUN_REVIEW_FAILED:canonical review successor budget exhausted after 3 ordinals…`, then `WEDGE STOP`, then `=== END 2026-09-20T14:58:03Z`. `autoresume.log` repeats "stop-and-stay-stopped … doing nothing" through 2026-09-23T00:23Z.

### 1. Per-PR ledger

Squash commit = the `origin/main` commit. Review rounds come from workflow journals: R = REJECT/FAIL, A = APPROVE/PASS, in order. No PR has any GitHub review or comment (checked 11 PRs, all "0 comments, 0 reviews"). All review evidence is in the journals.

| PR (squash) | Merged | What it changed | Register ids (PR body) | Tests added (A) / modified (M) | Review rounds (journal wf) | Local suite recorded | Live evidence after merge |
|---|---|---|---|---|---|---|---|
| #525 (7e01a45c7) | 09-02 | Docs: handoff prompt | – | – | none | – | n/a |
| #526 (a6921414d) | 09-02 | Records the rev-6 release artifacts (package, manifest, report) | R-045 | none | No review; implementer DONE (wf_312a0dfe); log says the orchestrator checked it by shasum | 2880/0 (baseline) | n/a (content record) |
| #527 (fc35364e2) | 09-03 | Voice card, honest prompt-length pins, register templates | R-002..007, R-032 | M contract-refactor, voice-card, voice-moves-sanitizer, v4-research-candidate-intake | R, A (wf_fd96f711) | 2890/0 | Implicit: every compile renders writer cards. No specific marker checked |
| #528 (ea982cf57) | 09-03 | Small section-gate fixes (SEC120/53/114/12/91) | R-010, 016, 020, 040-044 | M check-registry, compiler-pipeline, v4-assembly-eviction-avoid | R, A (wf_fd96f711) | 2894/0 | Gates run in every compile; SEC12/SEC116 blocks appear in fv7/fv8 logs |
| #529 (81b4387c6) | 09-03 | A provider quota or credential block stops the run instead of burning it | R-001, 201, 224 | M model-gateway, v4-claude-route, v4-compiler-application-port, 3 more | A (wf_fd96f711) | 2880/0 | **It failed live for the reader lane.** On 09-20 the 429 hit reader seats: `review-35abdd05….json` contains "weekly limit … (api_error_status=429)", was stored as outcome ERROR, and burned 3 successors (defect #20). `PROVIDER BLOCK` count in the driver out is 0 |
| #530 (61c309798) | 09-03 | Repair writer gets the section-writer contract | R-036..039 | A v4-repair-writing-contract; M port test, rig | A | 2880/0 | Exercised: 645 repair COMPLETED events |
| #531 (6e73bae3c) | 09-03 | Research-stage guards made reachable, low-confidence recorded | R-022..025, 027, 028, 030, 034, 035 | A research-run-bounds, researcher-chapter-guards, source-coherence-guards, source-packet-gate-reachability | R, A | 2910/0 (reviewer) | Research ran (13 COMPLETED events, last 09-18). Log: R-030 reverted by the implementer |
| #532 (57f4be8b4) | 09-03 | Per-role routes and effort, unknown tier fails closed, provenance | R-021, 204-207, 218, 223, 227 | A v4-role-routing-provenance; M routing tests | A (wf_bedcc9cf) | 2894/0; log: main 2934/0 | Exercised: `routing=c755f5259a7a` ×10 in review-repair-21 attempts.jsonl |
| #533 (7cf24e92e) | 09-03 | Release hardening: gate-blocker refusal, cleanup, publish outcomes | R-088, 228, 230, 231, 233, 234, 239-241, 247, 252, 255 | A candidate-release-gate, publish-final-outcomes, release-category-policy, release-cleanup-safety | A | 2905/0 | **Never exercised** (no promotion or release since 08-28) |
| #534 (2ed7b9642) | 09-03 | v21 package-contract test re-pinned to the lockfile SDK | – | M package-contract | A (wf_0676104a) | 2934/0; v21 1041/0 | CI only. Made the v21 CI job green |
| #535 (185876578) | 09-03 | Writer contract tells the truth: notes header, tier roles, banned list, title | R-002, 005, 008, 009, 011-015, 017-019, 274, 286 | M 5 tests | R (gateWeakened=true), A | 2949/0; log: wave 0 2980/0 | Exercised: live ch03 prompt contains "WRITING CONTRACT: instruction" |
| #536 (4465a3f87) | 09-03 | Review/QC signal: per-chapter aggregation, severities preserved | R-133, 137, 138, 152-154, 162, 163, 215 | A review-qc-noise; M 13 tests | A | 2940/0 | Review side exercised. QC side never ran |
| #537 (8cdb91ce2) | 09-03 | Service un-wedging, spend bounds, prompt digest in cache key, ERROR successors | R-164..188 (subset), 203, 215 | A v4-book-run-service-resilience; M 8 | A (then an Opus conflict merge with #536) | 2959/0; log 2965/0 | Exercised: `review-successor` fv7e-r9.log:105; `BOOK_RUN_COMPILER_RETRY_EXHAUSTED` fv7d-r3..r5 |
| #538 (f763541d1) | 09-03 | Franklin scars rewritten: 42 source-quoted rules, disposition ledger | R-002, 083, 274, 275 (R-081/082/084-086 not named) | A franklin-scars-structure | R, R, R, A + merge audit A (wf_7f503e14, 29876935, 3f77e501, f0f24a31, ea7c7ec2) | 3157/0, pins 32/0 | **Rendered live into the wrong chapters** (section 0, point 3) |
| #539 (9df63c5c5) | 09-03 | Dealing redesign: fact-aware cues, BPV11/12 before drafting | R-055, 062, 064, 065, 101-128 subset | A dealing-redesign; M 6 | R, R, A + merge audit A | 3152/0 (wave 1 complete) | Exercised: 497 BPV11/12 lines (fv7-r10.log:2) |
| #540 (d6bf5933d) | 09-03 | Source-text ingestion: frozen text, chapter map, sourceQuote, memoir guard (1A and 1A2) | R-023, 046-058, 277, 282 | A chapter-map, research-rules, source-ingestion-integration, source-quote-grounding, source-text-ingestion, writer-card-source-context | R, R (gateWeakened=true), A (wf_bb3a49e6, 29876935, f424c503) | 3114/0 | Exercised: fv8c-r1.log "Source text: … 377692 bytes, sha256 8d71d7dc6784…", "chapter map: 19 span(s) covering 100.0%"; manifest `sourceProvenance=source-text` |
| #541 (3b82e31c3) | 09-03 | Grounding: per-chapter presence plus derivability replaces per-unit quotas | R-059..076 subset, 281, 283 | A grounding-redesign, memorable-line-redesign, quiz-pedagogy-redesign, tier-restatement | A (wf_29876935) | 3025/0 | Implicit: compile gates |
| #542 (73876ddf8) | 09-03 | 2C catalog-rubric promotion gate | R-080, 144, 147, 229, 254 | A v4-catalog-rubric, v4-catalog-rubric-stage, v4-candidate-release-verdict, fixtures | R, A (wf_7e86d16a) | 3152/0 | **Never exercised** (no `rubric` event ever) |
| #543 (d69f3f686) | 09-04 | 2B whole-chapter editor pass with preservation guard | R-079, 157, 166 (+R-001, 080, 164 mentioned) | A v4-chapter-edit-guard, v4-chapter-editor-pass, v4-review-advisory-recorder | A (with MAJOR), A, merge audit A | 3157/0 | **Exercised:** 69 `CHAPTER_EDITED` (fv7e 16, fv7g 18, fv8b 16, fv8d 19). First at fv7e-r9.log:86. One REVERTED, two EDIT_ERROR (pre-#560). The R-166 advisory sub-pass never ran (69× `advisory=NOT_RUN`; it needs a PASS review) |
| #544 (374189ede) | 09-04 | 2A source-fidelity judge per chapter against the frozen text | R-077, 078, 131, 134-136, 148, 150, 151 | A v4-source-fidelity-judge, v4-source-fidelity-qc-wiring, slice fixture | A (2 MAJORs), R, A (minor hole), A (wf_7e86d16a, 91783f28, 90101ab6, ae0d7ab1) | 3157/0; v25 66 files/645 | **Never exercised** (fresh-qc last ran 08-28) |
| #545 (252af42de) | 09-04 | 2C follow-ups: recorded bar, 10-factor validation, repair note consumed | – | M 3 tests | A (wf_38a49cc5) | 3157/0 | Never exercised |
| #546 (9a46c8edf) | 09-04 | CI: BigInt literal fix plus static guard | – | A no-bigint-literal-guard | R, A | 3158/0 | CI job green again |
| #547 (3f6757927) | 09-04 | Research: world facts, located meta-refs, bounded repair, rejected drafts persisted | – | A research-meta-repair, research-rejected-drafts, fixture | R, R, R, A (wf_bcdb0208, ed9a5659, b4493fb4, 94dc7f86) | 3202/0 | Exercised: `rejected/` dirs in research runs 09-04..09-18; fv8c-r1.log "rejected/ch02.attempt1.json … draft persisted" |
| #548 (ec15720c6) | 09-04 | Research prompt stops prescribing rejected templates | R-054, 284 | A research-prompt-templates | A | 3206/0 | Research ran. Log line: hardEdge template rejections gone (log only) |
| #549 (dcba8423a) | 09-04 | A resumed run continues its own research run | – | A research-owned-run-unreadable; M 4 | R, R, A | 3212/0 | Exercised: fv7-r2.log:4 "continuing this run's OWN research run" |
| #550 (16daae36f) | 09-04 | Learning card lists which specifics the prose supports (SEC120) | – | M compiler-pipeline, contract-refactor | R, R, A | 3237/0 | Implicit: compile |
| #551 (8f177faf4) | 09-04 | Summary teaches dealt cases (MUST TEACH + SEC136), bounded breaker | – | A dealt-case-teaching | R, A | 3227/0 | Implicit: compile |
| #552 (022ed19b4) | 09-04 | Gutenberg italics folded; "the author" carve-out | R-023, 024, 286 | A meta-world-author-noun, source-gutenberg-italics | R, A | 3261/0 | Inferred: frozen text sha 8d71d7dc…/377,692 B differs from origin 7863cf09…/~385 KB, which is consistent with the fold |
| #553 (ab10deffb) | 09-04 | Persist rejected section-pack drafts | R-284 | M v4-compiler-application-port | A | 3237/0 | Exercised: 65 `rejected` dirs under run-state runs |
| #554 (4b9d7ccc1) | 09-04 | Number-word specifics count as taught; one predicate | – | A number-word-specific-deliverability, short-figure-card-gate-alignment | R, R, A (wf_68d6c8c7, dcad417d, 3be33409) | 3278/0 | Implicit: compile |
| #555 (e2e15b113) | 09-05 | SEC35 ignores sentence-initial words | – | M compiler-pipeline | R, A | 3283/0 | Implicit: compile |
| #556 (34a9ec420) | 09-06 | Eviction path for SEC119 and SEC90 | – | A v4-assembly-eviction-sec119-sec90 | A, A (2 reviewers, 1 round) | 3283/0 (log) | Exercised: fv7e-r2.log:86 `EVICT … ch16 action-pack "Chase"`, :87 `"rather than"` |
| #558 (7010179c5) | 09-06 | Carry the last rejected draft into the next round | R-164, 285 | M 2 | R, A, A, A, then a refinement round A, A (wf_596502e6, 717590b7) | 3283/0 (log) | Exercised: 29 `CARRY_OVER_REJECTED_DRAFT`, first fv8b-r10.log:69 |
| #560 (1de1dcc1c) | 09-06 | Trusted instructions block plus `--restricted` claude CLI | R-223 | A trusted-instruction-prompt; M 7 | A, R, R, R, A, A (3 rounds, wf_d2bd52b4) | 3284/0 (log) | Log only: panel 74 reads with 0 failures, previously 9/69 (log line 159); editor 18/0 errors |
| #562 (de8d66fb7) | 09-07 | Repair card states chapter identity | – | M v4-repair-writing-contract | A (1 reviewer, wf_7c90cba8) | 3284/0 (log) | Log: repair round 2 completed including ch10 (log line 182) |
| #563 (1d6d3eea8) | 09-08 | Repair lanes reconcile a stale attempt under --reconcile-unsettled | – | M 2 | A, A | 3284/0 (log) | Exercised: fv7l-r1.log:16 `review-repair-5 … RECONCILED_UNSETTLED_ON_RESUME` |
| #564 (be9c44ed8) | 09-08 | Run identity excludes sourceGitSha | – | M run-store, stage-resume, intake | R, A, A, A (2 rounds, wf_801014bf) | 3284/0 (log) | Exercised: fv7l-r1.log:2 `REOPENED_UNDER_DIFFERENT_SOURCE_SHA` (449 lines) |

**Not merged in this range:** #557 does not exist. #559 (draft-time-avoid-phrase) is OPEN. #561 and #565 are closed Dependabot PRs. #566 to #575 are all OPEN and exist only as cherry-picks on the local checkout 9f0117cb7; origin/main is be9c44ed8.

**CI state at merge:**
- "v21 Pipeline Typecheck + Tests" was FAILURE for #526–#533 (the pre-existing lockfile break, fixed by #534) and for #542–#545 (the BigInt break, fixed by #546). It was SUCCESS for the rest.
- "E2E Smoke (dev build)" was FAILURE on all 36 PRs (app-side).
- The log states merges were gated on the local suite and a reviewer, not on CI.

**Review contract:** the plan allows "at most one fix round per package". It was exceeded on #538 (4 rounds), #544 (4), #547 (4), #539/#540/#549/#550/#554 (3), and #560 (3).

### 2. Local test-suite progression

All counts are local runs recorded in journals or the log. None come from CI.

- Plan baseline: 2880/0 at 7e01a45c7 (plan line 3).
- Wave 0: batch 1 complete 2890/0 (#527) → 2934/0 (#532) → 2965/0 (#537) → wave 0 complete 2980/0 (#535, 58 v25 files).
- Wave 1: 3025/0 (#541 PR head) → 3114/0 (#540) → wave 1 complete 3152/0 (#539).
- Waves 2 and 3: 3157/0 (#538, #543, #544; v25 66 files/645 cases) → 3158/0 (#546).
- Live-defect fixes: 3202 (#547) → 3206 (#548) → 3212 (#549) → 3227 (#551) → 3237 (#550, #553) → 3261 (#552) → 3278 (#554) → 3283 (#555, #556, #558) → 3284 (#560, #562, #563, #564).
- Open PRs #566–#575 each report about 3284–3287 on their own base (journal suite fields).
- The combined local checkout 9f0117cb7 is recorded only with typecheck plus targeted files: "resilience 29/29; repair-lane 26/26" (log line 59). **No full-suite run on the combined checkout is recorded.**

### 3. Plan work packages

| WP | PR | Status | Evidence |
|---|---|---|---|
| 0A quota-classification | #529 | DONE in code; **fails live for the reader lane** | The reader-seat 429 was stored as an ERROR review and exhausted 3 successors (driver out, final lines) |
| 0B effort-tiers | #532 | DONE, live | `routing=` provenance in attempts |
| 0C1 voice-and-pins | #527 | DONE (live use implicit) | merged fc35364e2 |
| 0C2 contract-truth | #535 | DONE, live | Contract text in the live prompt |
| 0D research-small | #531 | DONE (R-030 reverted per log) | merged 6e73bae3c |
| 0E gate-small | #528 | DONE, live | Gates in logs |
| 0F repair-lane | #530 | DONE, live | 645 repair COMPLETED |
| 0G record-rev6 | #526 | DONE | a6921414d |
| 0H service-small | #537 | DONE, live | Successor and retry-exhausted lines |
| (0I release-hardening) | #533 | DONE in code, **never exercised** | No promotion since 08-28 |
| 1A source-ingestion | #540 | DONE, live | fv8c-r1.log source line and chapter map |
| 1A2 research-rules | folded into #540 (R-050..058) | DONE in code | PR body ids |
| 1B grounding | #541 | DONE | 3b82e31c3 |
| 1C dealing | #539 | DONE, live | BPV12 advisories |
| **2A source-fidelity judge** | #544 | **Code DONE; NEVER executed live** | No fresh-qc event after 2026-08-28; 0 `fidelity`/`SF[1-4]` lines in fv7/fv8 logs |
| **2B editor pass** | #543 | **DONE and executed live** (advisory sub-pass never) | 69 CHAPTER_EDITED; fv8d edited all 19 |
| **2C rubric gate** | #542 + #545 | **Code DONE; NEVER executed live** | No `rubric` phase event in the whole events file; 0 `catalog-rubric` log lines |
| 3A scars | #538 | Merged, but **misaligned**: scoped to the 4-part rev-6 structure, not the live 19-chapter map | Live ch03 prompt carries the ch03 civic-project pin |
| 4A driver | tools in `~/cf-wt/franklin-v7-tools` | DONE (plus autoresume) | `drive-franklin-v7.sh` has caffeinate, `--source-text`, a provider scan of `runs/*/attempts.jsonl`, and a wedge stop. It deliberately does not evict the cache (header item 5). Its provider scan did not catch the reader-lane 429 |
| 4B run/promote/release | – | **NOT DONE** | Run 39a37d06 is wedged at review; zero promotions in the campaign |
| 4C score | `score-franklin-v7.js` (09-05) | **NOT DONE** | No v7/v8 package exists to score |

### 4. Live runs that exercised the merged code

- **fv7 series (09-04 → 09-08):** runs d51c92fc, 1775fb28, fd722827 and 4dc2a413.
- **fv8 series (09-17 → 09-20):** runs 755fb671 and 39a37d06.
- Every run stopped at review or review-repair. Live defects #3 to #20 were found and fixed along the way.
- Recent panels for run 39a37d06:

| Review | Outcome | Blockers | Warnings |
|---|---|---|---|
| review-1ca523b6 | FAIL | 10 | 562 |
| review-052e2b67 | FAIL | 15 | 541 |
| review-ba9e7444 | FAIL | 16 | 571 |
| review-35abdd05 | ERROR | 7 | 439 |

These counts come from the review JSON files.