# IMP-20 — Split-Lane Reviewer & §16 Recovery: Implementation Report

- **Package:** IMP-20 (Split-Lane Reviewer + §16 legacy-campaign recovery)
- **Baseline:** HEAD `23c4ede4efe88722a658130ad536a2fcf34ef51d`, branch `feat/v25-pipeline`
- **Result identity:** `dc2047c11db38c57037b311ded852678bb55f8e1c181b94e3296f824f6a03ddd`
  (sha256 of a canonical `path + content-sha256` manifest over the 68 IMP-20-authored files; excludes the pre-existing preserved §16 evidence tree and the three self-referential report deliverables)
- **State:** all IMP-20 work uncommitted in the working tree.
- **Live model calls:** 0 · **API calls:** 0 · **Canonical books changed:** 0 · **Gate weakening:** none · **Production activation:** false (separate authorization required).
- Pipeline root `<P>` = `scripts/book/prompts/chapterflow-v24-author-pipeline`.

This report is the machine-checkable-prose companion to `docs/v25/reports/implementation-report.imp-20.json`. It covers all 20 IMP-20 deliverables / 23 instructions, the five new frozen contracts, the behavior that changed vs. the behavior preserved for replay, the §16 closure and freeze, the retrospective, the corpora/qualification/judge-assignment policy, the recovery experiment + pilot, the tests, the exact commands and results, the E-01..E-10 before/after evidence, the risks, and the 19-row red-team checklist.

---

## 0. Baseline confirmations

### 0.2 — E-01..E-10 confirm/correct table (instruction 3)

All ten CONFIRMED against HEAD `23c4ede4e`. The precision correction each finding carried is the design the code honors.

| E | Verdict | Precision correction the design honors | Where fixed |
|---|---|---|---|
| E-01 | CONFIRMED | `readerReview.ts:151` "judge only what is on the page" vs `:161`/`:170` fabrication+source-contradiction duties. Flagged categories are MIXED: self-/internal-contradiction (`:161` "chapter's own material contradicts" / cat 4) IS on-page decidable → stays a reader blocker; only fabrication / "source never makes" / specific-fact wrongness is impossible without source → moves to the source lane. | `readerExperienceReview.ts` keeps `internal_contradiction`+`unusable`, drops `fabricated`/`factually_wrong`/`source_contradictory`; prompt SOURCE-TRUTH AUTHORITY LIMIT block |
| E-02 | CONFIRMED | Layer-N v2 corpus has zero source-plan/packet/sidecar/anchor/ledger (file census + grep NONE); `REVIEW_CONTEXT_MATRIX.csv` records `phase1ReceivedSourcePlan/SourceEvidence/BookMetadata=N` for all 28 cases. | source lane is a separate role package fed by `sourceUsePlanPath`/`sourcePacketPath`/`sourceSidecarPathFor`; reader lane stays prose-only |
| E-03 | CONFIRMED | `≥87` is asserted only in `PROV()` strings/comments, never code-enforced; "external accuracy not assessed" lives in the remediation ledger, not the report-data JSON. | `clean-base-score-ledger.v1.json` binds each clean base to its REAL 140-eval score; external accuracy recorded honestly "Not assessed" (schema-shape test) |
| E-04 | CONFIRMED | builder injects a FULL 5-field synthetic `planSpec` (`format:"scenario"` is one of five) + `depthLevel`/`implementationPlan.title`/`memorableLines` across ALL 28 items. | `corpusBuilderCore`/`sourceCorpusBuilder` never infer source semantics; absent → `sourceSemanticsStatus:MISSING`, excluded from source-clean gold (regression 9) |
| E-05 | CONFIRMED | origin/form/claim-strength taxonomy lives in `src/contracts/sourceUsePlan.ts` (minted by `sourceUsePlanCompiler.ts`), NOT `sourceGrounding.ts` (separate SC9/SC11 axis). C37 register/overreach checks are ADVISORY-MINOR; SC9/SC11 grounding checks ARE gate-wired. | source lane imports `SourceOriginV1`/`UnitFormV1`/`ClaimStrengthV1` 1:1, runs the three deterministic critics FIRST, and never re-votes them |
| E-06 | CONFIRMED | rotation at `reviewRunner.ts:62-68` (`panel[executionOrder % panel.length]`; agreement `panel[(executionOrder+1)%panel.length]` on `sampleIndex===1`). "every panel member is a blocker" is EMERGENT; `assertJudgeQualified` is a single-boolean gate. | `assignFixedRoles` (pure fn of spec, `panel[0]` primary); `roleQualification` per-role registry + `assertRoleSetReady` |
| E-07 | CONFIRMED | 4 quiz-ambiguity + 4 craft-nonblocker; `0.85` over `den=4` forces `4/4` (`3/4=0.75` fails — gpt-5.5@xhigh NOT_QUALIFIED at exactly `0.75`); `rate()` returns 1 on `den===0`. | `MIN_SOFT_DENOMINATOR=10`; any soft threshold over `<10` is `refusedUnderpowered` (role-qualification 28/29); recovery-role thresholds pin `minimumDenominator≥10` |
| E-08 | CONFIRMED | `AUTHOR_CHAPTER_BAR=80` (`:136`); field name stays legacy `ship84`; `pass = valid && composite>=bar && ship84===true && matches===of` (`:539`). Orchestrator tiebreak already rescues a ≥bar zero-mustFix ship84:false chapter. | new reader contract uses advisory `recommendation: SHIP|REVISE|BLOCK`; ship84 absent from all 5 new contracts; legacy adapter maps ship84→recommendation and can never be fresh |
| E-09 | CONFIRMED | `BP="/Users/…/book-packages"` (`:33`); `SPEC_PATH="/private/tmp/…"` (`:158`); `existsSync?…:[]` silently drops 12 variants (28→16) while still validating; the whole `state/migration-experiments/` tree is untracked and not gitignored. | builders take typed roots (no absolute/temp paths, static grep), fail closed on a missing spec (never silent `[]`), and assert expected composition (regression + migration-guards) |
| E-10 | CONFIRMED | instrument+gold provably mutated between live runs (scorer v2.x→v2.2; craft fillers re-worded after RUN1 & RUN2; Stage-Q v1→v2→v3). `campaignTotalConsumed=711` (Stage-Q 540 + Layer-N v2 171) EXCLUDES the earlier Layer-N v1 100 → total ever = 811; `independentHumanRater:false`. | closure records BOTH 711 and 811, marks results development evidence, freezes resume, and the retrospective is diagnostic-only |

---

## 1. What changed vs. what is preserved for replay

**Changed (additive; new modules beside the old):**
- The reader lane gains a **separate** source-blind contract (`reader-experience-review-v1`) with an advisory `recommendation` in place of the model-owned `ship84` ship bit.
- Two entirely new lanes exist: **source-and-claim-integrity** (deterministic critics first, semantic verdict second) and **quiz-integrity** (two-phase blind derivation that now owns distractor validity, mechanism match, and answer-tells).
- A **deterministic conductor** (`aggregateChapterReview`) owns the final PASS/REVISE/BLOCK/INCONCLUSIVE — the model recommendation is evidence, not the gate.
- Judge assignment moves from **execution-order rotation** to **fixed roles**; qualification moves from one monolithic boolean to a **per-role registry** with a minimum-denominator power rule.
- The halted §16 campaign is **archived and mechanically frozen** so it cannot resume.

**Preserved for replay (byte-unchanged, immutable):**
- `src/review/readerReview.ts` (`ship84`, `reader-rubric-v3-phase1`) is UNCHANGED — it IS the legacy replay path. `src/review/legacyReaderReviewAdapter.ts` is the sole bridge, and an adapted legacy record can **never** satisfy the new freshness predicate.
- Everything already on disk under `state/migration-experiments/**` — every preserved run dir, seal, threshold file, and `_owner-inputs/*.mts` driver — is untouched (the closure's `preservedArtifactHashes` recompute equal on disk: test 34).
- The 9 pre-existing frozen contracts are unchanged (zero existing hashes moved).

---

## 2. Files changed

**Modified tracked files (11):**
`src/bakeoff/migration/{cli,guards,reviewRunner,runExperiment}.ts`, `src/cli.ts`, `src/contracts/{index.ts,contract-manifest.json,CONTRACTS.md}`, `tests/{contracts-freeze,migration-conductor,model-policy}.test.ts`.

**New source modules:**
- Contracts (5): `src/contracts/{readerExperienceReview,sourceIntegrityReview,quizIntegrityReview,aggregateChapterReview,judgeCapabilityQualification}.ts`.
- Review-lane runtimes (5): `src/review/{readerExperienceReview,sourceIntegrityReview,quizIntegrityReview,aggregateChapterReview,legacyReaderReviewAdapter}.ts`.
- Migration modules (new): `src/bakeoff/migration/{reviewLaneTypes,reviewerRoleAssignment,roleQualification,corpusBuilderCore,readerCorpusBuilder,sourceCorpusBuilder,quizCorpusBuilder,recoveryExperiment,layerNRetrospective}.ts`.
- Migration modules (IMP-19-origin, modified by IMP-20 for the §K freeze): `src/bakeoff/migration/{nativeReviewSeal,nativeReviewRunner,nativeReviewQualification}.ts` each gained an `assertNotClosed(...)` choke; `nativeReviewTypes.ts` is IMP-19 support carried in the uncommitted tree.

**New test files (20):** enumerated with counts in §8.

**New state artifacts (all under `<P>/state/migration-experiments/`):**
- `contracts/schemas/{reader-experience-review,source-integrity-review,quiz-integrity-adjudication}.schema.json`
- `contracts/{reader,source,quiz}-corpus-spec.json`, `contracts/clean-base-score-ledger.v1.json`, `contracts/recovery-role-thresholds.v1.json`
- `S16_LEGACY_CAMPAIGN_CLOSURE.{md,json}`
- `s16-reviewer-recovery-v1/{spec.json,seal-prep.json}`

**Docs:** `docs/v25/reports/LAYER_N_V2_SPLIT_LANE_RETROSPECTIVE.{md,json}`, this report, `docs/v25/reports/implementation-report.imp-20.json`, `docs/v25/reports/IMP-20_PRE_LIVE_AUTHORIZATION_PACKET.md`.

> Not materialized by design (R-3): `contracts/{reader,source,quiz}-corpus.v1.json` + provenance manifests — the source builder fails closed pending owner source gold.

---

## 3. Contracts added (manifest 9 → 14; zero existing hashes moved)

Registered via the 6-step mechanic (descriptor → `ALL_CONTRACTS` in `index.ts` → `generateManifest.ts` → hash = sha256 of `{name,version,fields}` only → `contract-validate` → `CONTRACTS.md`).

| Contract | schema id | version | `contractHash` |
|---|---|---|---|
| `reader-experience-review` | `reader-experience-review-v1` | 1 | `0fe113b60b7c323f993da1ba84759d3f3946749b1790df98448c31034900083b` |
| `source-integrity-review` | `source-integrity-review-v1` | 1 | `cd0f720288b732877025cb7de68bda4e1af52318c879acc3cad6304e072981cc` |
| `quiz-integrity-result` | `quiz-integrity-result-v1` | 1 | `4d904135f0a101a24380fb840eb2ae67fd0e2d0025c74b57debc50649a3b62e2` |
| `aggregated-chapter-review` | `aggregated-chapter-review-v1` | 1 | `47643cc6450888304fff0c4d4ad7110a8d2b401c8a3b0dcd190d77425f658215` |
| `judge-capability-qualification` | `judge-capability-qualification-v1` | 1 | `e05136e482673ccda68d939f1ebfa4fca0393c081c7e6c4c2be3629e18e9718b` |

`contract-freeze: PASS — the live contracts match the frozen manifest.`

---

## 4. Lane behavior (the five deliverable lanes)

### A. Reader-experience lane (deliverable 3, 7, 11)
`ReaderExperienceReviewV1` `blockingFindings.category` OMITS `fabricated`/`factually_wrong`/`source_contradictory` and KEEPS `internal_contradiction`+`unusable`; the validator hard-rejects any out-of-enum category. The prompt embeds the SOURCE-TRUTH AUTHORITY LIMIT block ("You may not determine whether an external person/organization/event/quotation/date/number/study/source claim is factually real or source-supported… emit `origin_ambiguous_to_reader`. Do not call it fabricated or source-contradictory."). `ship84` is replaced by an advisory `recommendation: SHIP|REVISE|BLOCK`. Reader `escalationSignals` (`origin_ambiguous_to_reader`/`possible_real_world_claim`/`possible_attribution_issue`) are observable-only: they are carried into `escalationReasons` and at most drive REVISE — never a source BLOCK.

### B. Source-and-claim-integrity lane (deliverable 8)
`runSourceIntegrityReview` refuses to run without `plan+packet+sidecar+schemaSha256`. The deterministic critics `checkSourceRegister` → `checkChapterProvenance` → `checkExampleSourceGrounding` + `sourceUsePlanStale` + `embeddedPlanMutationFindings` run **FIRST** and are never re-voted by the semantic reviewer. Missing evidence composes to `INCONCLUSIVE`, never PASS; any blocker-severity finding composes to `BLOCK`. Source blockers can ONLY originate from source-aware evidence (the reader lane cannot express them). The semantic verdict is injected through the same `deps.spawn` seam the repo already uses for `quiz-two-phase`/`native-review-runner` tests — zero live calls.

### C. Quiz-integrity lane (deliverable 9)
The two-phase blindness mechanism (`buildQuizDerivation → commitQuizDerivation` hash+freeze BEFORE the key → `renderQuizPhase2Doc` → adjudicate) is reused verbatim. The lane now genuinely OWNS `defensibleAlternatives` (a new model-elicited phase-2 field), `mechanismSupported` (new model-elicited), and `tellDetected` (a **deterministic** answer-tell heuristic a model cannot hide). Composition: any wrong key → `BLOCK`; any genuine ambiguity (`uniqueAnswer===false`) → `BLOCK`; any unsupported mechanism/causal key → `BLOCK`; all-clean → `PASS`; `tellDetected` is advisory (REVISE).

### D. Deterministic aggregation (deliverable 10)
`aggregateChapterReview` computes `finalStatus` with precedence **BLOCK > INCONCLUSIVE > REVISE > PASS** and never reads the model recommendation. A source unit is REQUIRED iff `origin==="source_bound" && anchorIds.length>0` (derived from the immutable plan): INCONCLUSIVE on a required unit → BLOCK; INCONCLUSIVE on constructed/generic → REVISE. Any stale bound hash → INCONCLUSIVE (never a silent pass). The aggregator never returns a passing INCONCLUSIVE.

---

## 5. §16 closure + mechanical freeze (deliverable 4)

`S16_LEGACY_CAMPAIGN_CLOSURE.{md,json}` — status **`ARCHIVED_INCONCLUSIVE_REVIEW_INSTRUMENT_MISMATCH`**, `canResume:false`, `authoringMigrationDecisionProduced:false`, `oldResultsAreDevelopmentEvidence:true`.

**Call ledger (both numbers stated, per E-10 / baseline (f)):**
`campaignTotalConsumed 711` = Stage-Q Layer-O 540 (v1 192 + v2 138 + v3 calib 18 + v3 qual 192) + Layer-N v2 171 (run1 37 + run2 38 + run3 96); `totalLiveCallsEverIncludingLayerNv1 811` (+100 Layer-N v1); `sealedHardMax 2096`; `diagnosticCalls 0`; `confirmatoryCalls 0`.

**History recorded:** Stage-Q v1/v2 = INSTRUMENT_INVALID, v3 = ALL_THREE_JUDGES_QUALIFIED (U2 open); Layer-N v1 = INSTRUMENT_INVALID; Layer-N v2 = PANEL_NOT_QUALIFIED 1/3 (gpt-5.5@high QUALIFIED; gpt-5.6-sol@high NOT at cleanPass 0.125; gpt-5.5@xhigh NOT at quizAmbiguity 0.75).

**Mechanical resume freeze** (writing a status field alone does NOT block resume — baseline (g)): `guards.ts` gained `CLOSED_EXPERIMENT_IDS` (10 ids) + `assertNotClosed()`. It is wired at the three gate-able src/ chokes:
- `runExperiment.ts` — `assertNotClosed(experimentId)` right after id resolution (the `completedPhases:['seal']` → qualify resume choke).
- `nativeReviewSeal.ts` — `assertNotClosed(args.corpus.corpusId)` (keys on corpus id; a re-seal mints a new sealId but reuses the closed corpus id).
- `nativeReviewRunner.ts` — `assertNotClosed(opts.corpus.corpusId)` at the top of `runNativeReviewQualification` (the only src/ choke on the halted campaign's live driver `live-native-review-driver.mts`, whose corpusId `s16-layer-n-native-review-v2` is closed → the 171-call resume HALTS).

`assertNotClosed("s16-reviewer-recovery-v1")` does **not** throw — the recovery id is a fresh identity, not a revived seal.

**Preserved evidence is byte-unchanged:** `preservedArtifactHashes` (28 files) recompute equal to the on-disk sha256 (legacy-campaign-closure test 34, `xenv`-guarded).

---

## 6. Static retrospective (deliverable 18)

`layerNRetrospective.ts` is pure (no model call). It iterates the 3 preserved run dirs × judges × items, loads each `evidence.json.parsedReview`, reuses the preserved `FAB_RE` regex verbatim, and emits the four separated analytical views per case×judge (reader-only signals, source-related signals flagged `ungrounded: no source evidence`, quiz-related signals, legacy `ship84` effects). It emits `LAYER_N_V2_SPLIT_LANE_RETROSPECTIVE.{md,json}` with `producesQualification:false`, `diagnosticOnly:true`. The **14 gpt-5.6-sol source-register divergence cases are marked `UNADJUDICATED (owner gate)` throughout — never labeled true/false** (regression 5; a WP-B9 test asserts the module never produces a `JudgeCapabilityQualificationV1`).

The retrospective's factual claims (call ledgers, 28 preserved hashes, 138 case-judge views, 12 source-dependent failures, 44 disputed gold markings, ship-bit artifact count 9) were independently re-derived from the preserved artifacts with zero mismatches (audit:closure-retrospective — PASS).

---

## 7. Corpora, qualification, and judge-assignment policy (deliverables 12–15)

**Hermetic corpus builders (deliverable 15 — partial by design, R-3):** `corpusBuilderCore` + `reader/source/quizCorpusBuilder` are pure functions returning `{corpus, provenanceManifest, corpusBytes}` from typed injected roots — no absolute `/Users`/`/private/tmp` paths (static grep, migration-guards), fail-closed on a missing `mutationSpecPath` (never silent `[]`), byte-reproducible (canonical JSON, no timestamps), and each clean base bound to its REAL 140-eval score via `clean-base-score-ledger.v1.json` (E-03). Source semantics are never inferred (E-04). Expected composition is asserted per role (reader 30 = 12 clean + 8 hard-blocker + 10 craft; source ~40 evidence-complete paired families; quiz 40). The `source-corpus-spec.json` pins `excludedCandidateBookIds: ["start-with-why","radical-candor"]` (the sealed diagnostic/confirmatory candidate books). **The BUILT `{reader,source,quiz}-corpus.v1.json` + provenance are intentionally not materialized** — the source builder fails closed pending owner evidence-complete source gold.

**Judge-assignment (deliverable 12):** `assignFixedRoles(spec, record)` is a pure function of `spec` — the primary for each role is the SAME across every candidate cell, independent of `record.executionOrder`/`cellId`/candidate model (regression 12 asserts the modulo rotation is gone). Backup runs ONLY on the frozen balanced audit subset / high-severity findings / required disagreement / prespecified operational failure — never chosen by the candidate's model. `reviewRunner.panelAssignment`'s `panel[executionOrder % panel.length]` is replaced by `panel[0]`; safe because every rotation-era experiment is CLOSED.

**Role qualification (deliverable 13):** `qualifyRole(role, metrics, thresholds, denominators)` is per-role. The **minimum-denominator rule (E-07 fix):** any soft threshold (non-1.0 bar) whose per-capability denominator `< MIN_SOFT_DENOMINATOR = 10` is `refusedUnderpowered` — a distinct outcome, never a silent pass (role-qualification 28/29). `securityBoundary` is INHERITED from the read-only Stage-Q Layer-O v3 result (LN-08): the 3 Layer-O panel profiles inherit `QUALIFIED`, a 4th candidate → `NOT_TESTED`. `assertRoleSetReady` fail-closes unless reader has a qualified primary+backup, source a primary+independent adjudicator (or a declared blind-human path), and quiz the deterministic checker + a qualified semantic adjudicator. A model may qualify one role and fail another (test 25); one unqualified UNUSED profile never blocks (test 26).

**Monolithic Layer-N retired as a blocking gate (deliverable 14, decision R-10):** the recovery conductor gates on the per-role `assertRoleSetReady`. The legacy `reviewOneSample` monolithic `assertJudgeQualified` is not weakened — it is superseded and made unrunnable for closed ids by the §K freeze.

---

## 8. Tests

**New IMP-20 test files (20; 195 tests):**

| File | tests | File | tests |
|---|---|---|---|
| `split-lane-red-team.test.ts` | 17 | `aggregate-chapter-review.test.ts` | 9 |
| `native-review-qualification.test.ts` | 17 | `quiz-integrity-review.test.ts` | 9 |
| `review-lane-types.test.ts` | 17 | `role-qualification.test.ts` | 8 |
| `split-lane-contract-types.test.ts` | 16 | `recovery-experiment.test.ts` | 8 |
| `split-lane-integration.test.ts` | 16 | `split-lane-corpus.test.ts` | 7 |
| `source-integrity-review.test.ts` | 15 | `reader-experience-review.test.ts` | 6 |
| `split-lane-schema-shape.test.ts` | 13 | `closed-registry-sync.test.ts` | 6 |
| `split-lane-regressions.test.ts` | 12 | `legacy-campaign-closure.test.ts` | 6 |
| `layer-n-retrospective.test.ts` | 5 | `reviewer-role-assignment.test.ts` | 5 |
| `legacy-reader-adapter.test.ts` | 2 | `native-review-runner.test.ts` | 1 |

**Modified tracked test files (3):** `contracts-freeze.test.ts` (+5 new-contract rows), `migration-conductor.test.ts` (rotation → fixed-primary expectation; the fail-closed refusal + immutability assertions preserved verbatim), `model-policy.test.ts` (+allowlist for the two files that name GPT identities as data).

**Commands + results (re-run fresh this wave under `CHAPTERFLOW_NO_API_CODEX_QC=1`):**

| Command | Result |
|---|---|
| `npx tsc -p . --noEmit` | **EXIT 0** |
| `npx tsx src/cli.ts contract-validate` | **PASS** (contract-freeze PASS; 14 landed worker reports PASS incl. `implementation-report.imp-20.json`) |
| `npx tsx tests/run.ts` (full suite) | **pass 2553 · fail 0 · xfail 0 · xpass 0 · xenv 6 · skip 18** |
| `npx tsx tests/run.ts` (IMP-20 group) | **pass 211 · fail 0** (split-lane + lane + role + closure + retrospective + native-review + migration-guards) |

Independent verification (four adversarial waves) confirmed all 20 IMP-20 verification points and the 19-row red-team, tsc EXIT 0, and contract-validate PASS.

---

## 9. Recovery experiment + pilot (deliverables 19–20)

`recoveryExperiment.ts` defines `RecoveryExperimentSpecV1` with experiment id **`s16-reviewer-recovery-v1`** (a NEW identity). `state/migration-experiments/s16-reviewer-recovery-v1/spec.json` binds: the 5 split-lane contract schema ids, reader/source/quiz corpus shas, `recovery-role-thresholds.v1.json` (NEW — never edits `native-review-thresholds.v2.json`), 4 candidate judge profiles (gpt-5.5@{high,xhigh}, gpt-5.6-sol@{high,xhigh}), the `FixedRoleAssignmentV1` policy (`recovery-fixed-role-policy-v1`), escalation rules, seeds/schedules, the no-API execution policy, `imp13Dormant:true`, `productionActivation:false`, `separateAuthorizationRequired:true`. `sealRecoveryExperiment` does NOT seal the full diagnostic until a role-qualified reviewer set exists (`assertRoleSetReady` gate) — hence `seal-prep.json`, not a seal.

`runRecoveryPilotDryRun` makes **ZERO model calls**: 4 strata × 4 authoring configs × 1 sample = 16 candidate cells (72 planned spawns), identical inputs, fixed qualified reader/source judges, fixed quiz policy, frozen audit subset, no repair during first-write, blind identities, preserved attempts. It routes through `injected_test_runner` (`authMode:'test'`) and asserts the router choke; stop conditions are encoded as preflight predicates. The pilot is NOT executed in this package. (Minor: the on-disk `pilot-dryrun/` manifest is not persisted; the dry-run tooling is exercised by tests.)

---

## 10. Proposed live calls (prepared, NOT authorized)

| Phase | Calls | Basis |
|---|---|---|
| Role qualification | **440** | `RECOVERY_PROPOSED_QUALIFICATION_CALLS` |
| Pilot | **72** | `RECOVERY_PROPOSED_PILOT_CALLS` (16 cells → 72 planned spawns) |
| **Proposed total** | **512** | 440 + 72 |
| **Hard ceiling** | **640** | `RECOVERY_PROPOSED_HARD_CEILING` (128 headroom) |

`440 + 72 = 512 ≤ 640` — verified. **No live call is made or authorized by this package.** See the pre-live authorization packet.

---

## 11. 19-row red-team checklist (every answer NO / fail-closed)

Each row was earned adversarially — a hostile input to the real function producing a throw/reject/refusal, or a static proof for the path-hermeticity/activation items (independent probe under `CHAPTERFLOW_NO_API_CODEX_QC=1`; 0 blocking findings; 200/200 pinning tests green).

| # | Attack | Answer | Guard / test |
|---|---|---|---|
| 1 | Reader-only judge calls an external event fabricated? | **NO** | validator rejects `fabricated`/`factually_wrong`/`source_contradictory`; reader-experience red-team 1 |
| 2 | Hidden metadata rescues reader-facing ambiguity? | **NO** | `origin_ambiguous_to_reader`+SHIP+source PASS → REVISE; planSpec never `scenario`; red-team 3 |
| 3 | Source claim passes with no source packet? | **NO** | `runSourceIntegrityReview` throws without packet/plan/sidecar/schema; source-integrity 4 / red-team 2 |
| 4 | Constructed example merges a real company into an invented event? | **NO** | injected blocker finding → lane BLOCK; source-integrity 9 / red-team 4 |
| 5 | Generic scenario invents a date/statistic? | **NO** | `generic_specificity_leak` blocker → BLOCK; source-integrity 11 / red-team 5 |
| 6 | Source INCONCLUSIVE becomes PASS? | **NO** | any INCONCLUSIVE unit downgrades; required INCONCLUSIVE → BLOCK; aggregate 17/18 / red-team 6 |
| 7 | Wrong quiz key passes? | **NO** | `keyCorrect:false` → BLOCK; quiz-integrity 14 |
| 8 | Two-answer quiz passes? | **NO** | `uniqueAnswer:false` → BLOCK; quiz-integrity 15 |
| 9 | Model recommendation overrides the conductor? | **NO** | aggregator never reads `recommendation`; aggregate 20 / red-team 7 |
| 10 | Legacy ship84 satisfies the new gate? | **NO** | adapter stamps `reader-rubric-v3-phase1`+`legacy-no-schema` → never fresh → INCONCLUSIVE; legacy-reader / regression 8 |
| 11 | Unqualified unused model blocks the campaign? | **NO** | one unused unqualified profile never blocks; role-qualification 26 |
| 12 | Missing required judge role passes qualification? | **NO** | `assertRoleSetReady` fail-closes on a missing primary/backup; role-qualification 27 |
| 13 | Soft metric qualifies on a tiny denominator? | **NO** | soft-threshold-over-`<10` → `refusedUnderpowered`; role-qualification 28/29 |
| 14 | Judge rotation reintroduced by execution order? | **NO** | `assignFixedRoles` invariant over `executionOrder`; regression 12 / integration 6 |
| 15 | Closed §16 experiment/corpus resumes? | **NO** | `assertNotClosed` throws at all three src/ chokes; legacy-campaign-closure / closed-registry-sync |
| 16 | Corpus builder reads an absolute/temp path or ambient env? | **NO** | static grep clean; typed roots; migration-guards |
| 17 | Any §16 resume path left un-frozen? | **NO** (scoped) | src/ chokes frozen; residual R-2b: Stage-Q raw-spawn `.mts` drivers cannot be gated (immutable evidence + owner directive; cannot resume a sealed budget) |
| 18 | Retrospective emits a qualification / labels the 14 sol cases? | **NO** | `producesQualification:false`; 14 cases UNADJUDICATED; layer-n-retrospective / regression 5 |
| 19 | Any promote/publish/deploy/activate or IMP-13 activation reachable? | **NO** | grep clean; IMP-13 dormant; `productionActivation:false`; red-team |

Two self-disclosed caveats (not defects): items 4/5 are architecture-fail-closed — the eventual live catch of fabrication/generic-date-invention depends on a **qualified semantic source judge**, which is exactly why the recovery experiment exists (no judge is qualified yet). Item 17's residual is R-2b.

---

## 12. Risks & unresolved work

- **R-2b (Stage-Q raw-spawn residual):** the closure freeze gates the three src/ chokes, but the Stage-Q Layer-O raw-spawn drivers (`_owner-inputs/*.mts`) call `spawnCodexAgent` directly with no closed-id gate. They cannot resume a §16 seal/budget (a re-run is a fresh qualification against no sealed ceiling) and require a live call (forbidden here); mitigated by driver immutability + the owner directive 2026-07-11. Forward rule: any future Stage-Q-style qualification MUST route through a gate-able src/ entry.
- **R-3 (owner source gold pending):** the source-corpus builder fails closed until the owner supplies evidence-complete held-out source units; the built corpora + provenance are therefore not materialized and the recovery diagnostic cannot be sealed.
- **R-4 (14 sol cases unadjudicated):** the 14 gpt-5.6-sol source-register divergence cases stay UNADJUDICATED; the owner must adjudicate and decide panel design before qualification.
- **R-8 (production authoring rewiring deferred):** rewiring the production reviewer onto the split-lane conductor is out of scope until a role-qualified set exists; IMP-13 activation remains dormant behind separate authorization.
- **F-018 (pre-existing baseline non-hermeticity, NOT IMP-20):** the full suite is not fully hermetic. Independent verification observed flaky failures on 2 of 3 fresh full-suite runs, all in baseline files IMP-20 never touched (production-manifest / author-provenance / gate-chapter / qc-attest filesystem races in `tests/.tmp`), every one git-clean and green in isolation. The clean `2553/0` run is reproducible but not on every attempt under full parallel load; IMP-20's own tests pass deterministically.

---

## 13. Non-goals honored

No authoring-prompt/orchestrator files changed. No Layer-N v3/v4 monolith (per-role split instead). Old gold/thresholds untouched (`native-review-thresholds.v2.json`, `layer-n-v2-qualification/`, `_owner-inputs/` all unmodified; the closure preserved-hash test passes). IMP-13 is DORMANT (`imp13Dormant:true`, `productionActivation:false`, `separateAuthorizationRequired:true`). **No Anthropic/Claude model appears anywhere in pipeline routing** — runtime judge/candidate profiles remain GPT-via-ChatGPT-codex (`gpt-5.5`/`gpt-5.6-sol`). `liveModelCallsMade:0`, `apiCallsMade:0`, `canonicalBooksChanged:0`, `gateWeakening:false`.
