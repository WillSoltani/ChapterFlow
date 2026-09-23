# DRAFT — v25 campaign status assessment and remaining steps (2026-09-23)

## Headline claims
H1. No book has come out of the v25 campaign. Since 2026-09-02 no Franklin run has passed the reader panel; fresh-qc, judges, rubric, promotion, release and scoring have never run on post-09-02 code. Last pipeline books reached the app 2026-07-10 (v24).
H2. The pipeline code is in good test health: full v25 suite on origin/main be9c44ed8 = 3284 pass / 0 fail; on the combined run checkout 9f0117cb7 (main + #566..#575) = 3291 / 0; typecheck clean on both (run 2026-09-23 00:14-00:44Z). But CI never runs the v25 suite (root pipeline:test targets @chapterflow/v21-authored); CI only typechecks v25 source via typecheck:book.
H3. 20 live defects found on Franklin since 09-04; #1-#19 fixed and each fix held on the next run (live evidence per PR); #20 unfixed. 36 PRs merged (#525-#564); 10 fix PRs (#566-#575) open and only on a local detached commit; #559 parked and conflicting.
H4. The run is wedged by defect #20 (weekly-limit 429 stored as ERROR reviews, all 3 successor ordinals burned; MAX_REVIEW_SUCCESSOR_ORDINALS=3 is a constant). The quota reset (09-22 23:00Z) does not clear it.
H5. Even with #20 fixed, the current gate stack cannot produce a promoted book:
  a. Reader panel: union-of-any-seat rule. 0 of 14 panels passed; blockers 34..9..16 not converging (stationary ~14); identical chapter bytes draw a blocker on 41% of re-reads; 83% of blockers single-seat, skeptic seat 62%. Modeled P(all 19 chapters clean) ~1e-5 or less.
  b. Fresh QC (after a panel PASS): deterministic replay of the QC gate stack on the latest candidate = FAIL 33 blockers (19 BP15, ...); one (F4 "rather than" 24x, book-level, no location) is refused by the QC-repair preflight (REPAIR_FINDING_UNSCOPED) -> deterministic wedge. QC-repair ordinals also need a full panel PASS on first verdict.
  c. Rubric gate: composite >=80 and every factor median >=70. Panel's own numbers give ~76 with limits/density ~69; fresh-reader instruments score ~12 points lower (Phase A 64.6 vs 76.4 on same bytes). A rubric FAIL is final for a candidate (no repair lane).
H6. Content quality of the latest candidate (review-repair-21): better than rev-6 (all Phase A distortions fixed, titles/mapping correct, less token hammering) but not high quality:
  - Accuracy audit of ch01/07/13/19: 182 claims, 120 correct (66%), 36 contradicted (19 major), 24 unsupported; 3/36 quiz keys contradict the source; 8/28 cards wrong. The review loop cannot see this (panel has no source lane; source-fidelity judge only runs after panel PASS).
  - Independent reading score ~61-68 per chapter vs panel 74-78.
  - 8 of 19 full reads and 11 of 19 deep reads are single unbroken paragraphs (up to 774 words); ~90k words (> the 66k-word source); templated examples (35% of words); memorable lines are lifted plot sentences (one broken by a "Mr." splitter bug).
  - Franklin scar fact-pins (#538) are keyed to the old 4-part structure; in the 19-chapter map ch01-ch04 get wrong pins and ch05-ch19 get none.
H7. Time: 452 h wall since 09-04; model calls in flight 153 h (34%); 191 h lost to an unattended hang + reboot; 56 h weekly limit; 45 h waiting for fixes. 77% of busy hours went to runs later abandoned.
H8. Quota: one review-repair round ~ $32 API-eq; the exhausted week was ~$1,600 with the pipeline 52% and orchestration (me + subagents) 48%. ~22-25 rounds/week at last week's orchestration load.

## Steps left (draft)
Owner decisions first:
D1 Definition of done for the test book: (a) a package that passes every gate at bar 80, or (b) the best candidate plus an honest scorecard now, then iterate.
D2 Reader-panel rule: keep union (cannot pass) / strict 2-of-3 corroboration (would have passed 4 of 14 panels, first at P8 09-19 21:24; downgrades real single-seat defects to WARN) / adjudicate each single-seat blocker with one verifier call (precedent: quiz-key majority rule).
D3 Whether the "each summary tier must stand alone" rule stays a BLOCKER category (28.5% of all blockers).
D4 Rubric bar 80 + factor floor 70 as the promotion bar, or a different bar for this test.
D5 Book shape: 19 source-heading chapters (~90k words) vs fewer chapters.
D6 Merge method for #566-#575: fast-forward main to 9f0117cb7 (exact, tested 3291/0) vs per-PR with 3 manual re-resolutions.

Engineering (minimal, each removes a blocker to the exit):
E1 Land #566-#575 on main (owner merge); park/close #559.
E2 Add pipeline24:typecheck + pipeline24:test to CI.
E3 Defect #20: provider-blocked stored ERROR successors are skipped without counting (bounded); journal the provider message so the driver's PROVIDER BLOCK stop fires; forward REVIEW_REPAIR_ORDINALS / QC_JUDGE_RUNS / RUBRIC_RUNS in autoresume and fix AUTORESUME.env.
E4 Implement D2/D3.
E5 Fresh-QC reachability: scope F4 to chapters (must land before the run commits its QC round); run the deterministic QC gate stack before the review and feed its chapter blockers into review-repair.
E6 Accuracy: run the source-fidelity judge before/with the review loop and route its findings into repair.
E7 Content: re-key scar pins to the 19-chapter map; require paragraph breaks in deep/full reads; fix the memorable-line "Mr." splitter. (Prompt/gate changes -> cache invalidation -> fresh compile.)
E8 Small: score-franklin-v7.js indices; stale cli.ts:564 text.
Run and deliver:
R1 Fresh run (if E7) or resume 39a37d06 with ordinals 40 (if not).
R2 panel -> fresh QC (3-7 h, 190 calls) -> QC repair -> rubric -> promotion.
R3 Owner runs the release command -> package -> 6-reader scorecard -> deliver; owner publish-final.
Zero-cost immediate option: hand the owner the rendered latest candidate (19 chapters) plus the accuracy findings now for evaluation.
