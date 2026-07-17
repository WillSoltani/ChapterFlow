# V25 Pipeline Audit and Model-Comparison Test Plan

**Deliverable 1 of 2** (companion: [V25_PIPELINE_AUDIT_AND_MODEL_TEST_PLAN.html](V25_PIPELINE_AUDIT_AND_MODEL_TEST_PLAN.html)).
**Task**: audit-and-planning only — zero pipeline implementation, zero live model calls, zero book/chapter generation, zero git publication occurred in producing this document.

---

## 1. Executive verdict

**`NOT READY FOR MODEL TEST`** — as of `64b5d8a04`, 2026-07-17.

The pipeline itself is substantially built and largely well-engineered at the unit level (hermetic execution envelope, fail-closed gates, atomic writes, precise candidate resume, real blinding). But the model-comparison apparatus cannot yet produce a fair Sol/Terra/Luna verdict, and the one screening run that exists proves it: a Sol-calibrated readability preflight aborted Terra and Luna before either wrote a single sentence; the D7 judge's rater sessions produced validator-rejected records on ~38% of attempts (5 of 13 real sessions), burning roughly double the intended judge spend; and the run's retained `selection.json` verdict ("Sol INELIGIBLE — arithmetic mismatch") was minted mid-flight at 14:32:45Z and falsified ten minutes later when the retried calibration rating passed at 14:43:12Z. No valid cross-model quality datum exists today. Three small vertical fixes (readability measure-only in the bakeoff lane, derive-don't-reject rater arithmetic with attempt persistence and caps, selection minting only from terminal states) plus decision-band calibration anchors would make the experiment in §13 runnable and credible.

## 2. Audit basis and repository/worktree truth

| Item | Value |
|---|---|
| **Audited head** | branch `plan/v25-s-tier-implementation` @ `64b5d8a04b41b174c8cfde384730a82caeadd346` — "fix(v25): adjudicator leak check scopes to candidate-derived content" (2026-07-17 10:40:56 -0300) |
| **Audited worktree** | `/private/tmp/cf-v25-s-tier-plan` (active development worktree; another session committed to it the morning of this audit) |
| **Isolated audit worktree** | `/private/tmp/cf-v25-audit` — detached checkout of `64b5d8a04`, created for this audit; all verification commands in §17 ran here. Left in place (no-cleanup boundary). |
| **Deliverable location** | Written as new untracked files in the owner's canonical checkout `~/ChapterFlow-books` (`feat/v25-pipeline` @ `96ba28179`), which is NOT the audited code — see drift below |
| **Comparison refs** | `feat/v25-pipeline` @ `96ba28179`; local `feat/v25-pipeline-live` @ `9a9b18e14`; `origin/feat/v25-pipeline-live` = `recovery/v25-pipeline-repair` @ `3f3dd914b`; `origin/main` @ `04e0ae50b` |
| **Audit date/time** | 2026-07-17, ~12:30–14:00 -0300 |
| **Dirty state of audited worktree** | Untracked only: `.npm-ci.log`, `state/autopilot-locks/`, `state/autopilot-logs/`, fixture book dirs (`zz-*`, `zz-gold-daring-greatly`), `state/gate-attempts.json`, `state/migration-experiments/rubric-audits/`, `state/model-bakeoffs/`, `state/run-ledger/*` — the retained screening evidence analyzed in §5. Nothing modified by this audit. |

**Authority drift (verified, material):**

- `plan/v25-s-tier-implementation` is **223 commits ahead of** the visible checkout and the visible head `96ba28179` is **not an ancestor** of it — the lines genuinely diverged (~6,571 files differ). The visible checkout's "checkpoint forward-only SOL pipeline" commit is not contained in the implementation branch.
- The implementation branch has **no remote ref** — `git ls-remote origin` contains no `plan/v25-s-tier-implementation` (its v25-related heads are `feat/v25-pipeline`, `feat/v25-pipeline-live`, `evidence/v25-retained-2026-07-15`, `codex/wp-rel-01-backend`, alongside unrelated heads). 223 commits of implementation exist on one machine only.
- `origin/feat/v25-pipeline-live` (`3f3dd914b`) equals the local `recovery/v25-pipeline-repair` tip, while local `feat/v25-pipeline-live` sits at `9a9b18e14`; **neither is an ancestor of the audited head** — three-way drift among "live", "recovery", and "s-tier" lines.
- ~44 work-package worktrees exist under `/private/tmp/cf-wp-*` (wp-101…wp/801), plus recovery/validation/evidence worktrees — the 42-WP control plane is physically real.
- `64b5d8a04` and `1df10f2b8` (branch `wp/703y-rater-schema-fix`) are a same-message cherry-pair; WP branches are merged into the plan branch via per-WP worktrees.

**State uncertainty:** the screening driver ran as a background task the morning of the audit (execution-status doc names bg task `bw83do4br`); its last observable write was 14:43Z (11:43 local). Whether the process is still alive was not determinable read-only; the run tree is mid-flight (see §5). All time-sensitive claims in this document are labeled as of `64b5d8a04` / 2026-07-17.

## 3. Scope and file-coverage inventory

All paths below are relative to the pipeline package `scripts/book/prompts/chapterflow-v24-author-pipeline/` at the audited head, except rows marked `<repo>/` which are repo-root (the `docs/v25/**` status documents, `.github/workflows/**`, and the root `package.json` live at repo root, not inside the package). Measured (not estimated): **449 src `.ts` files, 188,723 LOC** (tests separate: 374 files under flat `tests/`); `src/cli.ts` alone 6,316 LOC with **123 CLI verbs**; 15 `*gate*` modules; ~22 distinct persistence stores under `state/` + `.chapterflow/`; 14 codex-exec call-surface files and 24 claude-side call-surface files.

| Group | Key files (audited) | Status |
|---|---|---|
| Operator surface | `src/cli.ts` (dispatcher :6039-6307), `src/orchestrator/generateBookCommand.ts` (700 LOC), `docs/v25/WP-601-GENERATE-BOOK-COMMAND.md` | CURRENT SHIP PATH |
| Generation | `src/orchestrator/autopilot.ts` (3,288), `authorRun.ts` (2,013), `authorReview.ts` (2,366), `authorRepair.ts` (606) | CURRENT SHIP PATH |
| Model routing | `src/orchestrator/modelPolicy.ts` (675) — author = `gpt-5.6-sol@xhigh`, `PROVISIONAL_PENDING_WP-705` (modelPolicy.ts:44-61) | CURRENT SHIP PATH |
| Execution envelope | `src/exec/executionEnvelope.ts`, `src/orchestrator/codexAgent.ts`, `src/lib/strictEnv.ts` | CURRENT SHIP PATH |
| Providers (parallel transport) | `src/providers/**` (router, anthropic-api/cli, openai-api) | LEGACY — reachable only via `generate`/`research`/`--compiler` paths |
| Validation/gates | `src/critics/deterministicFloor.ts` (244, thin wrapper), `finalGate.ts` (1,457), `sections/sectionGate.ts` (2,633), `bookGate.ts`, `critics/readingLevel.ts`, `chapterGateComposite.ts` | CURRENT SHIP PATH |
| Semantic ship gate | `src/critics/d7ShipGate.ts` (1,104, model-free receipt mint/eval) | CURRENT SHIP PATH (verb-conditional, §7 V25-AUD-09) |
| Advisory review | `src/review/advisoryReview.ts` (384) | PLANNED BUT NOT WIRED (zero importers) |
| Publication | `src/promoteBook.ts` (1,168), `src/qc/publishAfterQc.ts` (1,058), `src/verifyProductionPackage.ts`, `src/productionManifest.ts` | CURRENT SHIP PATH |
| Telemetry | `src/telemetry/runCallLedger.ts` (WP-503), `src/cost-tracker.ts` (legacy claude-side) | CURRENT SHIP PATH (coverage gaps, §7 V25-AUD-08) |
| Bakeoff | `src/bakeoff/*.ts` 16 modules (~4,600 LOC): `runBakeoff.ts` (1,030), `candidates.ts` (505), `screeningPlan.ts` (479), `d7Judge.ts` (343), `review.ts` (311), `selection.ts` (212), `corpusIntake.ts` (185), etc.; driver `scripts/screening/run-invocation.mts` | BAKEOFF ONLY |
| Migration harness | `src/bakeoff/migration/` — 50 files, **~40,643 LOC**; live D7 instrument lives inside it: `rubricAuditInstrument.ts` (1,045), `rubricAuditHarness.ts` (1,167), `rubricAuditReceipts.ts`, `rubricAuditCanonical.ts`, `corpusBuilderCore.ts` | QUARANTINED/HISTORICAL except the 5 rubricAudit\*/corpus modules which are LIVE via the D7 judge |
| Legacy compiler | `src/compiler/` (12 modules) — imported by `authorRun.ts`, `authorRepair.ts`, `sectionGate.ts`, `qc/sourceV2Gate.ts` + `compile-*` verbs | LEGACY/REGRESSION but ON the ship path |
| Tests | `tests/` — 374 files; targeted suites in §17 | see §6 |
| CI | `<repo>/.github/workflows/chapterflow-v25-pipeline.yml`, `<repo>/.github/workflows/ci.yml`, `<repo>/package.json` workspaces | BROKEN at head (§7 V25-AUD-06) |
| Documentation | `<repo>/docs/v25/implementation/` — master plan (281 KB), `V25_DECISION_LEDGER.md` (L-1…L-45), `V25_OWNER_DECISIONS.md` (D-1…D-12), `V25_EXECUTION_STATUS.md`, `V25_MODEL_BAKEOFF_PROTOCOL.md`, `V25_BAKEOFF_STAGE1_SCREENING.md` + `.plan.json`, `CAMPAIGN_QUARANTINE.md`; `docs/v25/bakeoff-corpus-v1/`, `docs/v25/rubric-audit-2026-07-15/` (sealed baselines) | Contradictions in §6/§7 V25-AUD-11 |
| Screening evidence (untracked) | `state/model-bakeoffs/nudge/**`, `state/run-ledger/{nudge,nudge-ch03,made-to-stick-ch04}/**`, `state/migration-experiments/rubric-audits/bakeoff-stage1-nudge-ch03-xhigh-trio-b/**` | Read-only analyzed, unmodified (§5) |

Read protocol: both `AGENTS.md` files were read in full (root: QC-loop rule; package: role separation). Bulk `state/**` was excluded per repository instruction except the specifically named screening-evidence files above.

## 4. The actual pipeline, in simple terms

The default ship path (verbs `generate-book`, `book-run`, `book-autopilot` — all converge on the same conductor) as of `64b5d8a04`:

| # | Stage | What it is | Kind | Model/effort | Blocks? | Caps | Truth store |
|---|---|---|---|---|---|---|---|
| 1 | Operator command | `generate-book <id>` parses flags, refuses non-wired `--model`/`--effort` (generateBookCommand.ts:470-512) | code | — | exit 2 on refusal | — | run-summary artifact |
| 2 | Preflight "doctor" | filesystem/git/config checks only — shadow state dir, untracked imports, chapter-set sanity, model supported, D7 tooling reachable. **Only `generate-book` runs it**; `book-run`/`book-autopilot` skip it | code | none (zero model/network) | fatal → exit 2 | — | report |
| 3 | Conductor | `runAutopilot` phase ladder research → write → gate → qc → ready → shipped; phase is **derived from disk artifacts**, never a stored marker (lifecycle/bookStatus.ts:134,201-208) | code | — | MAX_LOOP_ITERS 40 | lock `state/autopilot-locks/<id>.lock` (atomic wx, PID-liveness stale check) | `state/**` |
| 4 | Research + source packets | `doResearch` builds source-v2 packets/briefs via compile chain | model (codex) | per modelPolicy role matrix | gates on packet validity | 2 research / 3 repair passes, 45 min | `state/books/<id>/runs/v23-current/**` |
| 5 | Author write | `doAuthorWrite` → whole-chapter writer per chapter, parallel pool ≤6 | **model (codex `gpt-5.6-sol@xhigh`)** — hermetic envelope: allowlist env, forbidden provider keys fail-closed, subscription-auth proof, schema-hash, manifest persisted before spawn, 3 sidecars per spawn | write-gate retry 1, lead-degrade 1, 60 min timeout | atomic tmp-then-rename write (lib/atomicWrite.ts) | `state/chapters/` |
| 6 | Generation gates | `sectionGate` (incl. **readability SEC12 as BLOCKER**: FK ≤7/8.5/9.5 by tier, Flesch ease ≥70) + chapter floor (`finalGate` blockers + ENFORCED_MAJOR = {EW1.invented_witness, SEAM1.adjacent_duplicate_word, SEAM2.verbatim_repetition}) + book gate + intra-book | code | — | blockers stop the chapter | write-gate retries above | gate reports |
| 7 | Author review (QC phase) | `doAuthorReview` — 3 readers, accept floor 74 / premium 80 | model (codex `gpt-5.6-sol@high`) | advisory→repair inputs | regen cap 2/chapter, 3/book; repair rounds cap 2 | review records |
| 8 | Targeted repair | `authorRepair` field-scoped patch splice, composite floor 82 | model (codex, `author-repair` role) | bounded | 30 min/attempt, round cap 2 (owned by authorReview) | patched chapter (atomic) |
| 9 | QC attestation | out-of-band reviewer verdict made enforceable+un-stale-able; reviewer identity = role-prefix allowlist (`claude-qc`/`codex-qc`/`harness`/`human`) — honesty-based (qcAttestation.ts:255-268) | human/model out-of-band; enforcement is code | PUBLISHABLE required | — | attestation records |
| 10 | Promote | `promoteBook` 14-step deterministic gate order (promoteBook.ts:510-897): canonical set → chapter floor → intra → book gate → majors (advisory unless env) → source-v2 → source-reality → generation debt → QC attestation → key-judge → key evidence (advisory) → no-api battery → production manifest + `verifyProductionPackage` → **D7 receipt gate LAST** | code (all deterministic; D7 is receipt evaluation, zero model calls) | any blocker → quarantine, no package | D7 fail → 1 re-author round then terminal halt (D-8) | `book-packages/`, quarantine/halt records |
| 11 | D7 ship gate | receipt minted from an external blind-pair + adjudication rubric audit (Claude side); bar = per-chapter ≥80, mean ≥85, core-domain floor 3.0/4, calibration |Δ|≤3.0 (rubricAuditInstrument.ts:119-124). **Default mode advisory-skips a MISSING receipt; only `CHAPTERFLOW_REQUIRE_D7_SHIP_GATE=1` blocks on missing** — `generate-book` sets it (generateBookCommand.ts:305-308,590-596), `book-run`/`book-autopilot` do not | code (receipt eval) | verb-conditional | — | `state/books/<id>.d7-ship-gate.json` |
| 12 | Publish | `publishAfterQc` — no-api battery, untouched-tree self-test, then promote authority; **`generate-book` default `autoPublish=true` → auto commit+push on convergence** (generateBookCommand.ts:309-312) — contradicts ratified owner decision D-12(b) halt-at-ready | code + git | fail-closed | — | git + live catalog |
| 13 | Ledger | WP-503 unified per-run call ledger — call count/latency/outcome only; `cost="NOT_METERED"` constant, **zero token fields** (runCallLedger.ts:73-105) | code | — | 4,000-line/4 MB cap, oldest-first eviction | `state/run-ledger/<book>/<run>.jsonl` |

Plain-English summary for the first screen of the HTML: *a codex Sol model writes whole chapters inside a locked-down sandbox; deterministic code gates check structure, quizzes, seams and readability; Sol-family readers review and trigger bounded repairs; a separate Claude-side blind rubric audit (D7) is the only semantic ship gate; promote/publish re-checks everything deterministically. Model calls happen at write, review, repair, and in the external D7 audit — everything else is code.*

## 5. The actual bakeoff/test path, and what the first screening really did

### 5.1 Path map

`model-bakeoff` is **not** a main-switch CLI verb (`migration-bakeoff` at cli.ts:6181 is a different, historical family). The Sol/Terra/Luna screening runs via `scripts/screening/run-invocation.mts <invocationId>` → `runBakeoff()` (src/bakeoff/runBakeoff.ts:378), phase ladder `intake → research → freeze → preflight → candidates → validate → review → select → promote → qc → report`, resumable by re-entering the first incomplete phase; completed candidates are hash-verified and reused (runBakeoff.ts:627-630; candidates.ts:244-259).

- **Reuses production**: candidate generation is the production writer `authorWriteOneChapter` with the model pinned per arm (candidates.ts:328-334) — *including its generation gates*; deterministic validation reuses `runShipGate`/`runBookGate`/`checkReaderBudgets` (candidates.ts:385-459). Formal QC delegates verbatim to `book-autopilot --author`.
- **Bypasses production**: D7 judging is a parallel path — `d7Judge.ts` drives the rubric-audit harness directly and composes its own `CandidateD7JudgmentV1`; the production `d7ShipGate` receipt is never minted for bakeoff eligibility. Book gate runs weakened (`requirePlanArtifacts:false`, BP7 skipped; candidates.ts:423).
- **Blinding**: strong on model identity — random label map sealed in the manifest, revealed only in the report; forbidden-token leak check on every reviewer-visible artifact (review.ts:64-109); D7 rater tasks leak-checked pre-dispatch; adjudicator surface redacts blind-rater prose (HEAD fix `64b5d8a04`). Residual: book identity appears in session paths; the calibration unit is recognizably from a different book; prose fingerprint is inherently unscannable. Raters are Claude Opus 4.8 (`claude -p --model claude-opus-4-8`, MAX_THINKING_TOKENS=31999, isolated empty cwd, OPENAI_API_KEY stripped) — cross-family from all three codex candidates.
- **Registered plan**: `V25_BAKEOFF_STAGE1_SCREENING.md` + byte-frozen `.plan.json` (test-asserted identical to `screeningPlanJson()`): 4 configs (sol/terra/luna@xhigh + sol@high), 3 books × 1 chapter, 6 conductor invocations, caps 12/≤18/≤40 sessions, advancement bar D7 ≥75, spend ceiling per D-3 (note: D-3's ratified wording and the enforcing code disagree about whether Claude sessions count against it — see §13.2).

### 5.2 What invocation 1 of 6 actually did (evidence: untracked run tree, as of 2026-07-17 ~15:00Z)

Run `stage1-nudge-ch03-xhigh-trio` (book *nudge*, chapter 3, sol/terra/luna @ xhigh; blind map A=luna, B=sol, C=terra; advisory codex judge terra@high):

1. **Terra and Luna produced zero content.** Both were hard-blocked by the production readability preflight inside the writer: terra `ease=54.174 ✗`, luna `ease=47.719 ✗` vs floor 70 ("rubric preflight FAIL … FAIL: fleschEase", per-candidate `generation.json`), each after 1 retry. Validation: "incomplete book: missing ch 3".
2. **Sol completed** (attempt 2; ~42 min writer session) and passed the floor with one advisory length warning. Sol is the only model with content, so **no cross-model comparison exists**. The only numeric "scores" in the tree are Sol's advisory codex reads (book 76 / chapter 92.8) — explicitly excluded from selection, single-model, and produced by a same-family reviewer.
3. **The D7 judge did run for Sol (label B)** — and the retained verdict about it is wrong. Reconstructed from the dispatch ledger (`state/run-ledger/nudge/bakeoff-…-trio-b.jsonl`), the ingest ledgers (`state/run-ledger/{nudge-ch03,made-to-stick-ch04}/…`), and custody (`state/migration-experiments/rubric-audits/bakeoff-…-trio-b/`), all times UTC:
   - 13 real Claude Opus sessions were dispatched 11:27Z–14:43Z for what is nominally a 4-audit job (candidate primary/verification/adjudicator + calibration unit). **5 of 13 were validator-rejected** (`content_invalid`): candidate primary ×3, adjudicator ×1, calibration primary ×1 — a ~62% per-attempt validity rate, each failure costing a full 10–25-minute Opus session.
   - The failed attempts' replies were **destroyed** — the session runner `rmSync`s the directory on each re-dispatch (run-invocation.mts:266-268), so only the last reply per role survives; the *reasons* for 4 of the 5 rejections are unrecoverable.
   - At **14:32:45.538Z** the calibration-unit (made-to-stick-ch04) primary ingest failed fail-closed with exactly one error: `chapter_diagnostic_score arithmetic mismatch`. Six milliseconds later (14:32:45.544Z) the conductor minted `selection.json`: winner=null, Sol "INELIGIBLE … arithmetic mismatch".
   - A resume immediately re-ingested the sealed nudge-ch03 records from disk (14:33:25Z — two ledger entries 13 ms apart, physically impossible as real sessions; see V25-AUD-08) and re-dispatched only the missing calibration primary. **That attempt PASSED ingest at 14:43:12.008Z** (`content_completed`; custody record persisted; verified in this audit by hand-recomputing all 8 domains — every `weighted_points` and the diagnostic reconcile exactly from the atomic ratings).
   - The run tree therefore holds a **stale, self-contradictory verdict**: `selection.json`/`manifest.selection` say Sol was disqualified by an arithmetic error that a later retry cured; `completedPhases` stops at `validate`; no `d7.json` judgment sidecar exists; the calibration verification dir was created at 14:43Z and left empty (driver stopped or killed mid-flight).
   - Even if the audit had completed, the surviving calibration rating scores the unit **74.28 vs the owner-adjudicated expectation 67.66** — |Δ| = 6.61 > the 3.0 calibration tolerance → the audit would have been `VOID_CALIBRATION` anyway. The judge has not yet demonstrated a calibration-passing audit at head.
4. **Only 1 of the 6 registered invocations ran.** `state/model-bakeoffs/` contains only the nudge trio; the sol@high solo and the made-to-stick / happiness-hypothesis invocations never executed.

**Bottom line**: the screening produced no valid model-quality evidence, the instrument (not the models, and — contrary to the retained artifacts — not the validator's arithmetic, which this audit verified is internally consistent) is the binding constraint, and the retained artifacts misstate what happened. The owner's independent n=1 comparison remains the only cross-model signal in existence, and it is not pipeline-derived.

## 6. Intended vs implemented vs tested

| Capability | Intended (docs) | Implemented (code @ 64b5d8a04) | Tested |
|---|---|---|---|
| `generate-book` terminal command (WP-601) | Consolidated author-first verb | ✅ wired, 12-step, exit contract 0/1/2/3 | ✅ model-free suite (fake conductor — arg/exit wiring only) |
| Halt-at-ready default (owner D-12(b), ANSWERED) | `--publish` opt-in | ❌ `autoPublish=true` default; only `--no-publish` exists | ✅ tests assert the *current* (contradicting) default |
| D7 ship gate (WP-401, D-8 bar 85/80/3.0) | The semantic ship gate | ✅ receipt mint/eval built; REQUIRE set by `generate-book` only | ✅ 1,041-line suite on **canned** sealed records; live rater path never exercised by any test |
| D7 live judging | Blind pair + adjudication + hidden calibration | ✅ built (d7Judge + harness + driver); **~62% per-attempt record validity in the only live run**; calibration pass never yet demonstrated | ❌ driver `run-invocation.mts` has no test; `d7WorkerDispatch` default fail-closed unwired |
| Bakeoff Stage 1 screening (WP-703) | 4 configs / 12 runs / 6 invocations / caps / bar ≥75 | ✅ plan registered + byte-frozen; ❌ execution: 1 of 6 invocations, mid-flight, zero valid comparisons | ✅ plan/selection/caps model-free suite; ❌ execution path untested |
| Stage 2/3 confirmation & variance (WP-704), model decision (WP-705), pilot (WP-802), release gate (WP-803) | Planned | ❌ not started (Sol default remains `PROVISIONAL_PENDING_WP-705`) | ❌ |
| Advisory review lane (WP-403/404) | Advisory-only reviewer feeding bounded repair | ✅ module built, ship-blocking type-impossible | ❌ zero importers — not wired |
| Unified call ledger (WP-503) | Close the cost-accounting gap | ⚠️ call-count/latency only; `cost="NOT_METERED"`, no tokens; re-ingests indistinguishable from real sessions | ✅ ledger suite (asserts the NOT_METERED design) |
| Campaign quarantine (WP-202) | Legacy migration verbs gated behind `--campaign` | ✅ fail-closed exit 2 | ✅ suite; ❌ **v25 CI still calls 6 gated subverbs ungated → CI broken at head** |
| CI coverage | v25 workflow + root pipeline-checks cover the package | ❌ v25 CI: PR-only for this branch (push filter = `feat/v25-pipeline-live`) and broken (above). ❌ Root `pipeline:*` scripts target workspace `@chapterflow/v21-authored` — the **legacy v21 package**; the v24 package is not in the root workspace list at all | — |
| Status documentation | Accurate program state | ❌ master plan header: "AWAITING OWNER APPROVAL — no implementation has begun" vs ledger L-14 (approved) / L-37 (Phase 6 authorized) / exec-status "Phase 6 OPEN, 28/42 WPs" vs its own table (~34) vs "All 42: not started" (same file); screening doc §11 "corpus not-ready" vs `corpus-manifest.json` "ready-for-bakeoff" (frozen 10:12Z); no status doc stamps the head SHA | — |

## 7. Flaw register

All evidence paths are package-relative at `64b5d8a04` unless noted. Confidence: **Confirmed** = reproduced from cited code/artifacts in this session; **Probable** = strong evidence, one link inferred.

---

**V25-AUD-01 — Readability proxy censors candidates before semantic quality is measured**
| | |
|---|---|
| Severity / Confidence | **Critical / Confirmed** |
| Evidence | `src/sections/sectionGate.ts:2028,2038` (SEC12 readability as `blocker`); `src/critics/readingLevel.ts:49-86` (FK ≤7/8.5/9.5, ease ≥70, "P02 calibration"); `src/critics/finalGate.ts:382,961-962` (same metric = advisory `major` E1 at promote; `ENFORCED_MAJOR` = {EW1.invented_witness, SEAM1.adjacent_duplicate_word, SEAM2.verbatim_repetition} only, finalGate.ts ~625 — set contents re-verified by grep this session); screening evidence: terra `ease=54.174 FAIL`, luna `ease=47.719 FAIL` in `state/model-bakeoffs/nudge/stage1-nudge-ch03-xhigh-trio/candidates/*/generation.json`; `src/bakeoff/candidates.ts:328` (bakeoff reuses the production writer including this gate) |
| Current behavior | A mechanical Flesch/FK computation hard-blocks chapter emission at generation/section-assembly; the identical metric is advisory at promote. In the bakeoff, 2 of 3 candidate models were aborted by it before writing anything. |
| Issue | The comparison's outcome was decided by a deterministic proxy calibrated on Sol-era prose (`readingLevel.ts:6-31` cites book-score rubric targets), not by any quality judge. The pipeline's own promote stage treats the metric as advisory — the two ship stages disagree about whether readability blocks. |
| Cause | Gate severity was set per-stage without a cross-stage severity contract; the bakeoff lane inherited the generation-time severity unmodified. |
| Consequence | Zero Terra/Luna content; experiment validity destroyed; any future run repeats this; risk of concluding "Terra/Luna can't write" when the true statement is "Terra/Luna don't match Sol's Flesch profile." |
| Recommended fix | Smallest slice: a bakeoff-lane flag that demotes SEC12/readability to measure-only for candidate generation (recorded as an outcome metric per cell), leaving production severity untouched. |
| Proof | Unit test: a candidate fixture with ease < 70 completes generation under the flag and its readability metrics appear in `validation.json`; production path unchanged (existing sectionGate tests stay green). |
| Overengineering guard | Do NOT redesign the readability system or re-derive thresholds now; do not demote the gate in production; no new gate framework. |

---

**V25-AUD-02 — D7 rater instrument: ~38% of live rating sessions produce validator-rejected records; failures are unpreserved and uncapped**
| | |
|---|---|
| Severity / Confidence | **Critical / Confirmed** (rates from the only live run; mechanism from code) |
| Evidence | Ingest ledgers: `state/run-ledger/nudge-ch03/bakeoff-…-trio-b.jsonl` (primary: invalid 11:47Z, 11:57Z, 13:10Z; completed 12:22Z, 13:25Z, 13:57Z; adjudicator invalid 12:54Z, completed 14:27Z) and `state/run-ledger/made-to-stick-ch04/…` (invalid 14:32:45Z, completed 14:43:12Z) → 5 invalid / 13 real sessions. Reply destruction: `scripts/screening/run-invocation.mts:266-268` (`rmSync` per dispatch). No attempt cap: `src/bakeoff/d7Judge.ts:223-237` (only existing records skip re-dispatch). Validator rejects rather than derives: `src/bakeoff/migration/rubricAuditInstrument.ts:237-257` (recompute + `isClose` 1e-9 → error). |
| Current behavior | Each rater/adjudicator turn is a 10–25-min Claude Opus 4.8 session that must self-report `domain_score`, `weighted_points`, and `chapter_diagnostic_score` exactly consistent with its own atomic 0–4 ratings; any slip voids the record; the driver retries the unit-role, deleting the failed reply. |
| Issue | The instrument asks a model to reproduce deterministic arithmetic the validator already computes, then discards the evidence of failure. Roughly doubles judge spend; makes failures undiagnosable (4 of the 5 rejection reasons are unrecoverable); violates the experiment principle "preserve every result." Note: the validator's own arithmetic is **correct** — the surviving calibration record was hand-recomputed in this audit and reconciles exactly; failures are stochastic rater slips, not a validator bug. |
| Cause | Task/validator contract requires model-computed aggregates instead of code-derived aggregates from atomic ratings. |
| Consequence | Judge spend ≈2× observed (13 real sessions for a nominally 6-session audit — 3 candidate roles + 3 calibration roles; 8/13 attempts valid); unbounded worst case; evidence loss; a single slip on the *hidden calibration unit* can void an entire candidate audit at selection time (see V25-AUD-03). |
| Recommended fix | (a) Validator derives `domain_score`/`weighted_points`/diagnostic from the atomic ratings and accepts records whose aggregates are absent-or-mismatched, recording a `derived:true` note (reject only missing/invalid atomic ratings, evidence, or schema identity); (b) persist every attempt in attempt-numbered dirs (no `rmSync` of prior attempts); (c) per-unit-role attempt cap (e.g., 3) with terminal `INSTRUMENT_FAIL` state. |
| Proof | Unit tests: replay a record with mismatched aggregates → accepted with derived values; missing atomic rating → rejected; attempt-cap test → terminal state after N; driver test asserting attempt dirs accumulate. |
| Overengineering guard | Do not switch judge model/framework; do not loosen atomic-rating validation; do not add a general retry framework — one cap, one persistence rule. |

---

**V25-AUD-03 — Selection verdicts are minted from mid-flight state and retained as final evidence**
| | |
|---|---|
| Severity / Confidence | **High / Confirmed** |
| Evidence | `selection/selection.json` `selectedAt: 2026-07-17T14:32:45.544Z` ("Sol INELIGIBLE … arithmetic mismatch") — 6 ms after the 14:32:45.538Z failed ingest; the same unit-role **passed** ingest at 14:43:12.008Z (`state/run-ledger/made-to-stick-ch04/…`; custody `state/migration-experiments/rubric-audits/bakeoff-…-trio-b/raw/primary/made-to-stick-ch04.json` mtime 14:43Z); `manifest.completedPhases` stops at `validate` while `manifest.selection` is fully populated; no `d7.json` exists anywhere in the run tree. |
| Current behavior | A D7 judge failure immediately propagates to selection, which writes a full scoreboard/disqualification record; a later resume can cure the failure, but the selection artifact is not re-derived or marked provisional. |
| Issue | The retained "final" artifacts are false at rest: they claim Sol was disqualified by an error that a retry cured 10 minutes later. Anyone (owner, future auditor, tooling) reading the run tree gets a wrong conclusion. |
| Cause | Selection minting is not gated on all candidates reaching a *terminal* D7 state (judged / instrument-fail-capped), and selection artifacts carry no provisional/final marker. |
| Consequence | Evidence-integrity failure; the campaign's own reports (report.md frames a "Scoreboard" over all-null data) mislead; automation consuming `selection.json` would act on a stale verdict. |
| Recommended fix | Mint selection only when every candidate has a terminal D7 state; stamp `provisional: true` + the ledger high-water timestamp otherwise; re-derive on resume. Annotate the existing nudge run as `INVALID — instrument shakedown; no model conclusions` (a new marker file; do not alter existing records). |
| Proof | Conductor unit test: with one candidate non-terminal, no selection file is written (or written with `provisional:true`); resume-after-cure test re-derives selection. |
| Overengineering guard | No workflow-engine rewrite; a boolean gate + marker field only. |

---

**V25-AUD-04 — D7 judge calibration is unproven at the decision boundary (anchors 67.7–70.8 vs bar 80/85; observed |Δ| 6.61)**
| | |
|---|---|
| Severity / Confidence | **High / Confirmed** |
| Evidence | `src/bakeoff/migration/rubricAuditInstrument.ts:130-154` (three owner-adjudicated anchors: 70.7566 nudge-ch03, 68.8158 happiness-ch06, 67.6645 made-to-stick-ch04; tolerance 3.0) vs `:119-124` (`RUBRIC_AUDIT_BAR_D7`: per-chapter ≥80, mean ≥85); surviving calibration rating scores made-to-stick-ch04 at 74.276 → |Δ| = 6.61 > 3.0 → would be `VOID_CALIBRATION` (`buildRubricAuditReport`, rubricAuditInstrument.ts:930-945); screening bar for advancement is D7 ≥75 (`V25_BAKEOFF_STAGE1_SCREENING.md`). |
| Current behavior | Raters are calibration-checked only around 67–71; ship/advancement decisions are made at 75–85; the one live calibration measurement missed its anchor by 6.6 points. |
| Issue | The instrument is unvalidated exactly where Sol-vs-Terra-vs-Luna must separate; a hidden 5-point judge bias at the bar flips decisions and no anchor can detect it. Also, with the current miss rate, every audit may void on calibration even after V25-AUD-02 is fixed. |
| Cause | Calibration anchors were taken from the three owner-audited chapters that exist (all mid-band); no anchor was ever adjudicated in the 80–92 band. |
| Consequence | Decisions at the bar are extrapolations; campaign can deadlock on `VOID_CALIBRATION`; false promote/reject risk at the pass line. |
| Recommended fix | Owner adjudicates ≥2 additional anchors in the 80–92 band (candidates: the sealed `docs/v25/rubric-audit-2026-07-15` reference chapters already scored ~90/band "reference"); Stage 0 (§13) then requires a live calibration drill to hit |Δ| ≤ 3.0 at both bands before any candidate spend. |
| Proof | Stage 0 drill result: N calibration audits, all pass tolerance at low and high anchors; unit test that the anchor set spans the decision band. |
| Overengineering guard | Do not redesign the rubric or move the bar; anchors + a drill only. No new judging framework. |

---

**V25-AUD-05 — Branch/worktree authority drift: the implementation exists only on one machine, on an unpushed branch, diverged three ways**
| | |
|---|---|
| Severity / Confidence | **High / Confirmed** |
| Evidence | §2 table: 223 commits ahead, visible head not an ancestor; `git ls-remote origin` lacks `plan/v25-s-tier-implementation`; `origin/feat/v25-pipeline-live` = recovery tip `3f3dd914b` ≠ local `feat/v25-pipeline-live` `9a9b18e14`; 44 `cf-wp-*` worktrees. |
| Current behavior | All V25 implementation lives locally on `plan/v25-s-tier-implementation`; remote "live" branch actually points at the recovery line; the owner's visible checkout is a diverged third line. |
| Issue / Cause | A machine failure loses the program. Any CI, review, or second-machine work sees stale code. Cause: WP-worktree merge workflow without a push/reconcile step. |
| Consequence | Data-loss risk; CI cannot run on the real head (see V25-AUD-06); documentation-vs-code confusion (V25-AUD-10) compounds because no shared ref exists to check against. |
| Recommended fix | Owner action (not performed by this audit): push `plan/v25-s-tier-implementation`; decide the canonical integration branch and fast-forward/reconcile `feat/v25-pipeline-live` vs `recovery/…`; then prune merged WP worktrees. |
| Proof | `git ls-remote` shows the branch; `git merge-base --is-ancestor` checks pass for the chosen canonical line. |
| Overengineering guard | No history rewrite, no force-push, no branch deletion until reconciled; do not "clean up" worktrees before merge state is verified. |

---

**V25-AUD-06 — CI validates the wrong things: v25 workflow broken at head and not triggered by this branch; root CI checks the legacy v21 package**
| | |
|---|---|
| Severity / Confidence | **High / Confirmed** |
| Evidence | `.github/workflows/chapterflow-v25-pipeline.yml`: push trigger limited to `feat/v25-pipeline-live` (L10-17); PR-only otherwise; steps invoke six `migration-bakeoff` subverbs **without `--campaign`** (`forward-verify-production-instrument-seal-v2` L152, `imp24-materialize-thresholds` L158, `imp24-certify-instrument` L162, `imp24-materialize-observability-freeze` L170/173, `imp24-materialize-final-attestation` L184, `imp24d-materialize-final-attestation` L195) — all members of `CAMPAIGN_GATED_SUBVERBS` (`src/bakeoff/migration/cli.ts:385-392`), whose dispatcher refuses ungated calls with exit 2 (`cli.ts:2329-2330`, WP-202). Root: `package.json` `workspaces: ["scripts/book/prompts/chapterflow-v21-authored"]`; root `pipeline:*` scripts run `--workspace @chapterflow/v21-authored` — the **legacy v21 package**; the v24 package is not a workspace member. |
| Current behavior | A PR touching the pipeline would fail v25 CI on the quarantine refusals; a push to the implementation branch runs no v25 CI at all; root CI's "pipeline-checks" job typechecks/tests the v21 legacy package and never the audited code. |
| Issue / Cause | WP-202's quarantine landed without updating the workflow that calls the now-gated verbs; the v24 package was never added to root workspaces. Three validation surfaces validate three different identities. |
| Consequence | The audited head has effectively **zero CI coverage**; green root CI creates false confidence; the first PR will fail for reasons unrelated to its diff. |
| Recommended fix | Three-line class of change: add `--campaign` to (or remove) the six workflow steps; add a push trigger for the working branch (or open a PR early); add the v24 package to root workspaces or repoint `pipeline:*`. |
| Proof | CI run on a no-op PR passes; `npm run pipeline:typecheck` from root typechecks the v24 package. |
| Overengineering guard | Do not build a new CI matrix; do not merge the two workflows; smallest edits only. |

---

**V25-AUD-07 — First-screening artifacts present a scoreboard over zero valid comparisons**
| | |
|---|---|
| Severity / Confidence | **High / Confirmed** |
| Evidence | §5.2; `manifest.json:232-236` ("NO candidate is eligible"), `report.md:22` (scoreboard framing), advisory-only Sol numbers (book 76/chapter 92.8) in `reviews/B/review.json`. |
| Current behavior / Issue | The retained tree looks like a completed bakeoff with numbers; actually 1 of 6 invocations, no valid D7 composite, two arms empty. Anyone skimming the report can mistake advisory single-model codex reads for comparison data. |
| Cause | Report generation runs regardless of evidence sufficiency (compounded by V25-AUD-03). |
| Consequence | Decision risk: "Terra/Luna failed, Sol scored 92.8" is a plausible-but-false reading. |
| Recommended fix | Annotate the run `INVALID — instrument shakedown` (marker file; preserve all records); report generator prints "NO VALID COMPARISON" prominently when composites are null. |
| Proof | Report unit test with all-null composites asserts the banner and absence of a numeric scoreboard. |
| Overengineering guard | Do not delete or rewrite the evidence tree; annotation only. |

---

**V25-AUD-08 — Ledger economics cannot answer the owner's cost question; re-ingests are indistinguishable from real calls**
| | |
|---|---|
| Severity / Confidence | **High / Confirmed** (Medium impact today, High for the decision it must support) |
| Evidence | `src/telemetry/runCallLedger.ts:73-105` (`cost: "NOT_METERED"` constant; no token fields); `src/cost-tracker.ts:85,156-200` (tokens/USD only on the legacy claude-side route, separate store `state/metrics/` — **absent on disk**); re-ingest evidence: `state/run-ledger/nudge-ch03/…` entries at 14:33:25.630Z and 14:33:25.643Z (13 ms apart — disk re-ingests ledgered identically to real 15-min sessions; `rubricAuditHarness.ts:954-966` appends on every ingest attempt incl. resume); coverage gaps: only `autopilot.buildLedgeredDeps` ledgers codex spawns (autopilot.ts:1042-1068) — eval/forward/manual-verb spawns unledgered; latent dispatch/ingest double-entry if `d7WorkerDispatch` (currently unwired) is ever wired (same sessionId, no rollup dedup, runCallLedger.ts:242-261). |
| Current behavior | The ledger counts calls and latency; every `cost` is the string `NOT_METERED`; a resumed run inflates claude-side call counts with free re-ingests. |
| Issue | The pre-registered decision rule needs cost-per-accepted-chapter; today neither dollars, tokens, nor even a true session count is derivable. "Luna/Terra are cheaper" remains `OWNER-SUPPLIED, PRICE NOT VERIFIED` with no in-repo way to verify. |
| Cause | Subscription-billed codex route exposes no tokens (deliberate, WP-503 header); ingest-side ledgering conflates observation with spend. |
| Consequence | The experiment can rank quality but not economics; tie-break rule unusable; retry burden invisible in rollups. |
| Recommended fix | (a) Add `kind: "session" \| "reingest"` (or `modelCalls: 0/1`) to claude-side entries and an `attempt` index; (b) a versioned, owner-approved price-table JSON (per model, per call-class) with `priceVersion` stamped into rollups — dollars = calls × table, clearly labeled estimate; (c) rollup dedups by sessionId+kind. |
| Proof | Ledger unit tests: re-ingest entries excluded from session counts; rollup with price table v1 emits cost-per-accepted-chapter; absent table → `PRICE NOT VERIFIED` marker, never a number. |
| Overengineering guard | Do not build token metering for a route that structurally lacks it; no billing integration; a static table + labels. |

---

**V25-AUD-09 — The strongest gates are verb-conditional and default-off outside `generate-book`**
| | |
|---|---|
| Severity / Confidence | **Medium / Confirmed** |
| Evidence | `generateBookCommand.ts:305-308,590-596` (sets `CHAPTERFLOW_REQUIRE_D7_SHIP_GATE=1`, runs preflight); `book-run`/`book-autopilot` call `runAutopilot` raw — no doctor, no require injection (cli.ts:4273-4314; liveRun.ts:488-573); `d7ShipGate.ts:829-860` (default mode advisory-skips a MISSING receipt); `src/lib/strictEnv.ts:26-32` (force-set = only `CHAPTERFLOW_NO_API_CODEX_QC` + `CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE`; `ENFORCE_MAJORS`/`REQUIRE_KEYJUDGE`/`REQUIRE_SOURCE_VERIFY` opt-in, promoteBook.ts:646,662-664,702). |
| Current behavior | The same book shipped via `book-run` bypasses preflight and can promote with no D7 receipt at all (advisory skip); via `generate-book` it cannot. |
| Issue / Cause | Enforcement lives in one verb's wrapper instead of the conductor/promote layer; multiple ship verbs survived WP-601 consolidation. |
| Consequence | Gate strength depends on which of three equivalent-looking commands the operator types; doc/runbook drift multiplies the risk. |
| Recommended fix | Move REQUIRE-flag injection (and preflight) into `runAutopilot`/promote so every ship verb inherits it; or demote `book-run`/`book-autopilot` to development-only with a printed warning. |
| Proof | Test: promote under `book-run`-equivalent deps with missing D7 receipt blocks when the book is new/changed. |
| Overengineering guard | Do not delete the verbs mid-campaign; a shared env-injection point, not a verb rewrite. |

---

**V25-AUD-10 — `generate-book` auto-publishes on convergence, contradicting ratified owner decision D-12(b)**
| | |
|---|---|
| Severity / Confidence | **Medium / Confirmed** |
| Evidence | `V25_OWNER_DECISIONS.md#L106-111` (D-12 ANSWERED (b): halt-at-ready default, `--publish` opt-in; ledger L-37); `generateBookCommand.ts:309-312` (`pick("autoPublish", …, true)`; only `--no-publish` exists); `docs/v25/WP-601-GENERATE-BOOK-COMMAND.md#L43` (documents auto-publish). |
| Current behavior | On D7 convergence the terminal command commits and pushes to main without per-run publish authorization. |
| Issue / Cause | The flip was booked into WP-802 (not started); docs and code both still carry the pre-decision default. |
| Consequence | An operator following the ratified decision's expectation can publish a book unintentionally. Bounding mitigations recorded in D-12 itself (noted for fairness): the flip was knowingly deferred to WP-802 ("no code churn now"), the path cannot fire without an authorized live run, and the publish is git-only and D7-REQUIRE-gated — so this is an operator-surprise hazard, not an imminent one. |
| Recommended fix | Flip the default to halt-at-ready + add `--publish`; update the runbook line. (Scheduled before any full-book pilot; see §14 slice S7.) |
| Proof | Existing generate-book suite: assert default `autoPublish=false`, `--publish` opt-in path covered. |
| Overengineering guard | A default flip + one flag; no publish-pipeline redesign. |

---

**V25-AUD-11 — Status documentation contradicts the code and itself; the self-declared authoritative doc is the most stale**
| | |
|---|---|
| Severity / Confidence | **Medium / Confirmed** |
| Evidence | `V25_S_TIER_IMPLEMENTATION_MASTER_PLAN.md:3` ("AWAITING OWNER APPROVAL — no implementation has begun") vs decision ledger L-14 (approved)/L-37 (Phase 6 authorized) and `V25_EXECUTION_STATUS.md` ("PHASE 6 OPEN; Phases 1–5 COMPLETE; 28/42 WPs" at L3 vs "All 42 packages: not started" at L32 vs ~34 rows in its own table); `V25_BAKEOFF_STAGE1_SCREENING.md` §11 ("corpus not-ready… intake refuses") vs `docs/v25/bakeoff-corpus-v1/corpus-manifest.json` (`ready-for-bakeoff`, frozen 2026-07-17T10:12Z) and ledger L-44; `V25_MODEL_BAKEOFF_PROTOCOL.md:3` ("draft… binding once approved") though its preconditions are met; `contracts/requirement-traceability.json:20` ("BASELINE_MODEL=gpt-5.5") vs `modelPolicy.ts:52` (`gpt-5.6-sol`); package `README.md:255-266` documents the pre-WP-601 legacy `generate-book`. Newest doc-stamped SHA is `9c5716725`, 15 commits behind head. **The live-spend ceiling itself is doubly defined** (found in independent review, §16): D-3 as ratified = "150 *codex* sessions … plus Claude-side D7 audits (all ledgered)" (`V25_OWNER_DECISIONS.md:31`; protocol agrees) vs the screening plan + enforcing code counting **both families** against one 150 budget (`V25_BAKEOFF_STAGE1_SCREENING.md:117`, `screeningPlan.ts:245-249`). |
| Current behavior / Issue | Six load-bearing documents disagree with the code head or each other; hand-maintained counters drifted within a single file. |
| Cause | Status is hand-maintained prose with no generation or CI check. |
| Consequence | An auditor or operator trusting the "authoritative entry point" is materially misled; time is lost re-deriving truth (this audit had to). |
| Recommended fix | One generated status block (WP table + head SHA + gate results emitted by a script) injected into `V25_EXECUTION_STATUS.md`; a one-line staleness banner on the master plan pointing to it; fix the three specific stale passages cited. |
| Proof | CI step (or pre-commit) that regenerates the block and fails on drift. |
| Overengineering guard | Do not build a docs site or migrate formats; one generated block + banner. |

---

**V25-AUD-12 — Ship-path semantic independence is thinner than documented**
| | |
|---|---|
| Severity / Confidence | **Medium / Confirmed** |
| Evidence | `advisoryReview.ts:126-161,250-271` (all three advisory lanes = `gpt-5.6-sol`; same-model self-review permitted with weight 0.5; module has **zero importers** — unwired); `qcAttestation.ts:255-268` (reviewer identity = honesty-based role-prefix allowlist incl. `codex-qc`; "a single agent willing to relabel itself a reviewer can still pass it" — author's own comment); `verifyProductionPackage.ts` / `productionManifest.ts` contain **zero** D7/rubric references (grep) — the shipped package never embeds or re-validates the D7 receipt; D7 receipt/adjudication schemas absent from `contracts/contract-manifest.json` (18 contracts, none D7). |
| Current behavior | Cross-family semantic judgment exists only in the external Claude D7 audit; in-pipeline review is Sol-on-Sol; attestation identity is unverified strings; the packaged book carries no D7 binding. |
| Issue / Cause | Independence was consciously delegated to the Claude-side gate (documented), but the supporting controls (attestation identity, package binding, contract freeze) lag. |
| Consequence | If the D7 gate is skipped (V25-AUD-09) the remaining semantic controls are same-family and honor-system; a receipt could drift schema silently without contract-freeze detection. |
| Recommended fix | Before pilot: bind the D7 receipt hash into the production manifest and check it in `verifyProductionPackage`; register the receipt/adjudication schemas in the contract manifest; keep Sol advisory lanes advisory. |
| Proof | Package-verify test: tampered/absent receipt hash fails; contract-validate covers the D7 shapes. |
| Overengineering guard | No new reviewer infrastructure; no attestation cryptography — hash binding + registration only. |

---

**V25-AUD-13 — Complexity actively obstructs the mission ("simplify" produced 449 files / 188.7k LOC; live D7 instrument lives inside the quarantined migration tree)**
| | |
|---|---|
| Severity / Confidence | **Medium / Confirmed** |
| Evidence | Measured §3; `src/cli.ts` 6,316 LOC / 123 verbs; `src/bakeoff/migration/` ~40,643 LOC quarantined **except** the live `rubricAudit*`/`corpusBuilderCore` modules the D7 judge imports (`d7Judge.ts:42-56`); v23 compiler (12 modules) imported by ship-path core (`authorRun.ts`, `authorRepair.ts`, `sectionGate.ts`, `qc/sourceV2Gate.ts`); `--compiler` flag selects two different legacy implementations depending on verb (cli.ts:1079 vs autopilot.ts:1483); `model-bakeoff` CLI requires `--draft` so the corpus screening path is unreachable via any CLI verb (bakeoff/cli.ts:44-48) and exists only through the untested driver script. |
| Current behavior / Issue | The operational surface is far larger than the shipped behavior; the single most decision-critical live component (the D7 instrument) is filed under "quarantined/historical"; duplicate/overloaded entrypoints persist mid-migration. |
| Cause | Twenty-plus WPs of additive work with deletion WPs (207/804) deliberately deferred. |
| Consequence | Audits, onboarding, and safe modification are all slow; "two valid-looking patterns" (per the adopted best-practice list, §18) is an explicit defect class here. |
| Recommended fix | After the model test: move the 5 live rubricAudit\* modules out of `migration/` into `src/bakeoff/instrument/`; execute the already-planned deletion WPs; give the corpus bakeoff a real CLI verb; disambiguate `--compiler`. Nothing here blocks the experiment — sequence it later. |
| Proof | Import-graph test (extend `campaign-quarantine.test.ts`) asserting `migration/` has zero live importers after the move. |
| Overengineering guard | No big-bang restructure; move-only refactor with green tests; deletion per the existing WP list, not a new plan. |

---

**V25-AUD-14 — Generated run evidence is committed into the implementation branch with no retention rule**
| | |
|---|---|
| Severity / Confidence | **Low-Medium / Confirmed** |
| Evidence | 41 commits touch pipeline `state/`; commit `9c5716725` bulk-commits hundreds of generated files (designs, briefs, source packets/plans, `.chapterflow/runs`) under an explicit "scoped artifact-guard exemption"; `61e3855b5` "untrack test-run state droppings" evidences accidental add-all churn; no retention rule for committed `state/books` evidence (only run-ledger caps and gitignored `logs/exec`). |
| Issue / Consequence | Repo bloat compounds the existing 4,150-file state corpus problem; provenance of "evidence" vs "debris" blurs; future clones slow. |
| Recommended fix | Adopt the existing `evidence/v25-retained-*` branch pattern for run evidence; a retention note in AGENTS.md; keep the artifact-guard strict (no standing exemption). |
| Proof | CI artifact-guard step fails on new `state/**` additions outside the evidence branch. |
| Overengineering guard | Do not rewrite history or prune the tracked v21 gold corpus (protected regression fixture). |

---

**V25-AUD-15 — Minor confirmed defects (grouped)**
| ID | Severity / Confidence | Finding + evidence + smallest fix |
|---|---|---|
| 15a | Low / Confirmed | Bakeoff book gate weakened: `requirePlanArtifacts:false` skips BP7 pre-promotion (candidates.ts:423) and `qc-converge` (the compensating re-check) never runs when there is no winner. Fix: run full gate at Stage-2 confirmation; pre-register BP7 out-of-scope for Stage 1. Proof: validation test with plan artifacts required. |
| 15b | Low / Confirmed | Blinding residuals: real book ids in session paths (`state/model-bakeoffs/<bookId>/…`); calibration unit recognizably foreign; prose fingerprint unscanned (model identity itself is well-hidden; raters are cross-family). Fix: document as accepted limitations in the pre-registration; hash the path segments if ever contested. |
| 15c | Low / Confirmed | Legacy second transport: `providers/**` dispatches models directly (providers/cli.ts:96) outside the hermetic envelope, with its own `DEFAULT_MODELS` (claude-opus-4-7/gpt-4o) — reachable only via legacy verbs (`generate`, `research`, `--compiler`, agents); billed providers refused under `CHAPTERFLOW_NO_API_CODEX_QC=1`, `anthropic-cli` exempt. Fix: fold into the deletion WP; until then a startup warning on legacy verbs. |
| 15d | Low / Confirmed | Stale model-selection remnants: `cache/stageCache.ts:166` reads killed env `CHAPTERFLOW_<tier>_MODEL` (cache-key drift only); `researcher.ts:494` reads `CHAPTERFLOW_RESEARCHER_MODEL`; cannot override the author route (WP-301 removed env pins; generateBookCommand refuses non-wired models). Fix: delete with the legacy path. |
| 15e | Low / Confirmed | `generateBookCommand` returns exit 0 with `ranConductor:false` on the (production-dead) non-author delegate branch (generateBookCommand.ts:462-465) — an honesty trap if ever invoked directly. Fix: exit non-zero or throw on that branch. Proof: one unit test. |
| 15f | Low / Probable | Unit-reset retry choreography multiplies judge spend: after the adjudicator rejection at 12:54Z the *whole* nudge-ch03 pair re-ran (primary 13:10/13:25/13:57Z, verification 13:34/14:08Z) rather than only the failed role — consistent with immutable custody (`persistEvidence` refuses differing bytes, rubricAuditHarness.ts:373-380) forcing unit resets. 13 sessions for a nominally 6-session job. Fix: covered by V25-AUD-02 (attempt persistence + caps) plus role-scoped retry; verify choreography in the Stage-0 drill. |

## 8. Top blockers and the causal chain

**Blockers to a fair model test, ranked:**

1. **V25-AUD-01** — the readability preflight decides the comparison before any judge sees content (2 of 3 arms produced nothing).
2. **V25-AUD-02 + V25-AUD-04** — the D7 instrument rejects ~38% of its own rater sessions, destroys the failure evidence, and has never passed calibration at head; anchors don't reach the decision band.
3. **V25-AUD-03 + V25-AUD-08** — results integrity: verdict artifacts minted mid-flight go stale, and the ledger can neither count true sessions nor price anything, so neither quality *nor* cost conclusions can currently be trusted.

**Causal chain (root → leaf):** a 42-WP additive program under time pressure (V25-AUD-13) reused production gates in the bakeoff lane without a severity contract → Sol-calibrated readability blocker censored Terra/Luna (AUD-01) → only Sol reached the judge, whose task demands model-computed arithmetic → stochastic slips + fail-closed validator + evidence-destroying retries (AUD-02) → a calibration slip at 14:32Z voided Sol at selection time → eager selection minting retained a false verdict (AUD-03, AUD-07) → meanwhile no CI could catch any of it because the workflow is broken/mistargeted for this branch (AUD-06) and the status docs describing all of the above had already drifted (AUD-11). Every link is individually small; the compound effect is "no valid evidence and misleading artifacts."

## 9. Quality improvements (highest value ÷ risk first)

1. **Decision-band calibration anchors + Stage-0 drill** (AUD-04) — makes every subsequent D7 number meaningful at the bar. Quality effect: high; calls: ≤12 rater sessions once; maintenance: none after adoption.
2. **Derive-don't-reject rater arithmetic** (AUD-02a) — removes the dominant false-invalid class; quality effect: judge results become reproducible; calls: −~40% judge spend; slice: one validator function + tests.
3. **Measure-only readability in the bakeoff lane** (AUD-01) — turns a censoring gate into an outcome metric; also produces the first real data on whether the FK/ease thresholds are Sol-shaped (feeds a later threshold recalibration decision — explicitly out of scope now).
4. **Gate-failed drafts preserved and blindly scored** (§13 principle) — separates ship-eligibility from quality measurement; slice: bakeoff lane stores the draft + floor report regardless of gate outcome (never promotable).
5. **D7 receipt bound into the production package** (AUD-12) — closes the "receipt exists but package doesn't prove it" gap before any pilot ships.

## 10. Efficiency / cost improvements

1. **Attempt caps + persistence for D7 sessions** (AUD-02b/c): converts unbounded retry spend into a capped, diagnosable loop. Observed waste: 5 invalid sessions + a full pair re-run (~7 of 13 sessions ≈ 2.5 h of Opus time) on one candidate.
2. **Session-vs-reingest ledger distinction + price table** (AUD-08): makes cost-per-accepted-chapter computable the day the owner supplies a versioned price table; zero live-call cost.
3. **Role-scoped retry** (AUD-15f): don't re-run a sealed pair because the adjudicator slipped; expected ~2× reduction in worst-case judge spend.
4. **Calibration-unit sharing**: one calibration audit per invocation (3 candidates), not per candidate — the screening plan already assumes this; keep it pre-registered (§13 budgets assume it).
5. **Skip-list discipline**: `book-run`/`book-autopilot` bypassing preflight (AUD-09) occasionally *wastes* a full authoring run that doctor would have refused in seconds.

## 11. Reliability, resume, and observability improvements

1. **Terminal-state selection minting** (AUD-03) + provisional markers — resume becomes safe by construction; the artifact a human reads is never ahead of the evidence.
2. **Persist invalid rater attempts** (AUD-02b) — turns "why did it fail?" from unrecoverable to a file read; enables instrument-failure taxonomy (arithmetic vs schema vs refusal) that Stage 0 needs.
3. **CI restoration** (AUD-06) — the three smallest edits (§7) give the branch its first real regression net; then the existing 374-file suite (already green in §17) actually protects something.
4. **Driver liveness/handoff record**: the screening driver's PID/start/heartbeat written next to the run manifest, so "is invocation 1 still running?" is answerable without process archaeology (this audit could not determine it read-only).
5. **Status generation** (AUD-11) — one generated block; hand-maintained counters demonstrably drift within a single file.
6. Existing strengths to *not* touch (verified good): atomic chapter writes (`lib/atomicWrite.ts`), PID-liveness lock stealing with atomic rename (autopilot.ts:893-983), hash-verified candidate resume (candidates.ts:244-259), immutable custody evidence (rubricAuditHarness.ts:373-380), phase-derived-from-disk (no stale phase markers anywhere — a genuinely well-designed resume model).

## 12. Simplify / delete / defer

| Bucket | Items |
|---|---|
| **STOP NOW** (invalidates testing/publication) | Annotate the nudge run INVALID (AUD-07); stop treating `selection.json` as evidence (AUD-03); do not run invocations 2–6 until §13 Stage 0 passes; fix v25 CI's six ungated subverb calls (AUD-06); owner: push the branch (AUD-05). |
| **BEFORE NEXT MODEL SAMPLE** | Readability measure-only in bakeoff lane (AUD-01); derive-don't-reject + attempt persistence/caps (AUD-02); terminal-state selection (AUD-03); decision-band anchors + Stage-0 drill (AUD-04); ledger session/reingest + price-table hook (AUD-08); pre-register the updated screening plan (§13). |
| **BEFORE FULL-BOOK PILOT** | D-12 halt-at-ready flip (AUD-10); uniform REQUIRE-envelope across ship verbs (AUD-09); D7 receipt bound into package verification + contract registration (AUD-12); full book gate at confirmation (AUD-15a). |
| **DEFER** (valuable, not decision-blocking) | Generated status block (AUD-11); driver liveness record; root-workspace addition if CI repoint chosen instead; blinding path-hashing (15b). |
| **DELETE/QUARANTINE LATER** | Move live `rubricAudit*` out of `migration/`, then execute deletion WPs 207/804 (~35–40k LOC); legacy `providers/**` transport + `generate`/`research` verbs + stale env reads (15c/15d); `--compiler` overload disambiguation; prune merged `cf-wp-*` worktrees after reconcile. |

Every recommendation above is a vertical slice with a named proof test; none proposes a new framework, migration program, or architecture. (Deletion items deliberately sequenced *after* evidence gathering so cleanup can never be blamed for a changed result.)

## 13. The model-comparison experiment

Audit of the existing protocol first: the registered Stage-1 plan (`V25_BAKEOFF_STAGE1_SCREENING.md` + byte-frozen `.plan.json`, test-asserted) is **largely sound and is reused**: paired same-effort trio, frozen corpus, cross-book hidden calibration, caps, pre-registered advancement bar, fail-closed no-substitute rules, blinded labels, quality-first selection with cost never overriding quality. What is **not** reused: its assumption that the production readability gate may run blocking (invalidated by evidence, AUD-01); its lack of replicates (1 generation/cell cannot estimate variance); its silence on invalid-rater-attempt handling (AUD-02); its calibration anchors (mid-band only, AUD-04); and the 150-session ceiling is *retained as a hard cap* but re-budgeted below rather than rubber-stamped.

### 13.1 The eleven required answers

1. **Decision being made**: (a) permission to run a full-book pilot for at most one candidate, and (b) which of {Sol, Terra, Luna} at **xhigh** becomes the *provisional default author model for the business/behavioral-nonfiction corpus the pipeline currently ships*. Explicitly NOT decided: a global all-genre default (the corpus is 3 same-domain books; a global claim requires the Stage-2 holdout block and is labeled as such), and effort policy (separate arm, below).
2. **Smallest sample that can credibly overturn Sol**: 3 chapter blocks × 2 independent generations × 3 models (18 authored chapters), adjudicated D7 per cell. Rationale: 3 blocks is the minimum to see cross-material consistency (sign agreement across blocks is the primary robustness check); 2 replicates is the minimum to observe within-model variance at all; fewer cells cannot distinguish "Luna is better" from "Luna got a good roll."
3. **Model-family vs effort effects**: the primary comparison holds effort constant at **xhigh** for all three families. Sol@high runs as a **separate, conditional effort arm** (same blocks, same judge) answering only "does Sol at lower effort match Sol@xhigh?" — it never enters the family comparison. Reviewer/repair roles are policy-fixed identically for every arm by construction (modelPolicy role matrix), and the D7 judge is a fixed third family (Claude Opus 4.8).
4. **Identical frozen inputs**: the existing freeze mechanism (bakeoff `freeze` phase hashes shared inputs; corpus manifest frozen 2026-07-17T10:12Z) plus the registered plan's byte-identity test. Every arm receives the same briefs/source packets/prompt cards; `--models` / `--chapters` immutability under a runId is already enforced (runBakeoff.ts:450-451,587-589). Prompt/schema/tool access identical because all arms run the same `authorWriteOneChapter` with only the model id pinned.
5. **Blinding**: existing label map (sealed in manifest, revealed only in the report) + forbidden-token leak checks on every reviewer-visible artifact + redacted adjudicator surface (all verified working, §5.1). The owner sees only blind labels until the pre-registered reveal point. Accepted residuals documented (15b).
6. **Independent replicates without contamination**: each generation runs in its own slot-isolated workspace with slot-local provenance (candidates.ts:78, header); replicate 2 uses a fresh runId-scoped slot and a fresh codex session; no shared conversational state exists by construction (hermetic envelope, per-spawn isolation). D7 rater sessions are per-request empty-cwd `claude -p` processes.
7. **Semantic measurement when the deterministic floor fails**: the bakeoff lane runs readability (and any other floor check that fails) in **measure-only** mode for candidates: the draft is always completed, preserved, floor results recorded, and the chapter is blind-scored by D7 regardless. Ship-eligibility remains a separate recorded fact (a floor-failed candidate can win the *quality* comparison but cannot be promoted; if that happens the verdict is "candidate X is quality-preferred but gate-incompatible — fix or recalibrate the gate before adoption," not a silent drop).
8. **Instrument proven before candidate spend**: Stage 0 below — model-free validator/schema/resume/blinding checks (already-green tests, §17) plus a small separately-approved live calibration drill that must pass **before** any authoring call. Any invalid judge output at Stage 0 stops the campaign.
9. **Genre/domain coverage**: Stage 1's three blocks (nudge ch03, made-to-stick ch04, the-happiness-hypothesis ch06) are all behavioral/psych nonfiction — stated as a limitation on every output. Stage 2 adds ≥1 pre-registered holdout block from an underrepresented corpus archetype (selected from the 140-eval corpus *before* Stage-1 results are unblinded). If the holdout diverges, the default decision narrows to the covered domain.
10. **What is compared**: per cell — adjudicated D7 chapter composite (primary), core-domain minima, gate outcomes; deterministic-floor pass/fail + readability measurements (safety/compat); first-pass vs post-bounded-repair composites reported separately; retries, repair rounds, wall-clock latency, true session counts (post-AUD-08 fix), and cost-per-accepted-chapter *iff* a versioned owner-approved price table exists (otherwise the cost column reads `PRICE NOT VERIFIED`). Failed attempts and refusals are cells with recorded outcomes, never dropped — blocks stay balanced. |
11. **Promotion / tie / stop rules**: §13.4.

### 13.2 Staged structure, budgets, and hard caps

Session = one live model call-session. **Ceiling attribution (corrected after independent review, §16):** owner decision D-3 as ratified caps **150 codex sessions**, with Claude-side D7 audits "ledgered separately" (`V25_OWNER_DECISIONS.md:31`; the bakeoff protocol agrees) — but the registered screening plan and the enforcing code count **both families against one 150 budget** (`screeningPlan.ts:245-249`; `ScreeningSessionBudget` halts before any session that would breach it; ledger entries L-39/L-44 record ~11/150 already spent on probe + freeze). The constraint governing live spend therefore has two incompatible official definitions — filed under V25-AUD-11 and listed as an owner decision in §15. **Until the owner rules, this plan binds itself to the conservative reading: both families, one cumulative 150 budget including the ~11 sessions already spent, enforced by the existing `ScreeningSessionBudget` halt.** If the owner confirms the codex-only reading and grants a separate Claude-side cap (proposed: 160), every stage below fits with wide margin (codex worst case 55 vs 139 remaining; Claude worst case ~153 vs 160). Stage 3 always requires new authorization. Calibration audits are shared per invocation (one hidden calibration unit per 3-candidate batch). Retry multipliers assume the AUD-02 fixes; the Stage-0b drill validates the ×1.25 planning figure.

| Stage | What runs | Live sessions (planned → cap) | Go / stop |
|---|---|---|---|
| **0a. Instrument qual (model-free)** | Validator derive-don't-reject + attempt persistence + terminal-selection fixes with unit tests; replay of retained records (incl. the 14:32Z failure class); blinding/leak/resume/ledger suites; screening-plan re-registration | **0** | All suites green (already-green baseline in §17) + new-fix suites green; any red stops |
| **0b. Judge drill (separately approved live gate)** | Full 3-role calibration audits of 2 anchor units — one mid-band (~68), one decision-band (~85, from the sealed 2026-07-15 owner-adjudicated set) | 6 → **10** | ≥5/6 first-attempt-valid records; both audits calibration-pass (|Δ| ≤ 3.0); attempt cap never hit twice on one role. Fail → STOP, fix instrument, re-drill |
| **1. Paired screening** | 3 models @ xhigh × 3 blocks × 2 replicates = 18 authored chapters (codex, ≤1 in-lane retry each → ≤36 cap) + D7: 6 invocations × (3 candidates × 3 roles + 3 calibration) = 72 → ×1.25 = **90 cap** (codex + Claude tracked separately) | 18–36 codex; 72–90 Claude | Advance ≤2 candidates meeting: no unresolved safety/integrity hard failure AND mean adjudicated D7 ≥ 75 (registered screening floor) AND no block < 60. If 0 qualify → STOP (keep Sol provisional) |
| **1b. Effort arm (conditional)** | Sol@high × 3 blocks × 1 gen, only if Sol advanced or price-relevant | 3 codex + 12–15 Claude | Informs effort policy only; never enters family ranking |
| **2. Fresh confirmation** | Top 2 × 2 fresh replicates × 2 blocks (1 pre-registered holdout archetype + the max-separation Stage-1 block) = 8 chapters + D7: 2 invocations × (4×3+3) = 30 → ×1.25 = **38 cap** | 8–16 codex; 30–38 Claude | Direction confirmed if the Stage-1 leader's mean Δ keeps its sign on ≥3 of 4 confirmation cells and the holdout block does not invert |
| **3. Uncertainty resolver (conditional, NEW approval)** | Additional paired blocks only if |mean Δ| < band or CI crosses the decision boundary | Proposed, not authorized | Pre-registered before running; no automatic max-spend |
| **4. Full-book pilot (outside this task)** | One book, winning model, `generate-book` with halt-at-ready (requires AUD-10 fix) + D7 REQUIRE + full gates; owner blind spot-check | — (bounded by the pipeline's own caps: 40 conductor iterations, regen 2/chapter + 3/book, repair rounds ≤2, D-8 one-re-author-then-halt; abort basis = any cap breach or D7 FAIL → quarantine) | Entry: winner cleared Stage 2 + all BEFORE-FULL-BOOK items (§12) shipped. Acceptance: D7 book verdict PASS (85/80/3.0) first-pass-or-≤2-repairs; rollback = quarantine, default reverts to Sol provisional |

Budget feasibility under the conservative combined reading (150 − ~11 already spent = **139 remaining**): planned path = 6 (drill) + 72 + 30 judge + 26 authoring ≈ **134** — feasible only if retries stay near ×1.0 and Stage 1b is skipped. The per-stage *caps* sum to 190 (+18 with Stage 1b) and therefore **cannot all be exercised**: if Stage 1 ran to its caps, Stage 2 (needs ≥38) would be unreachable — an outcome this plan treats as a **STOP**, because a screening without its confirmation stage is not a decision basis. Pre-registered handling, in order: (a) the `ScreeningSessionBudget` cumulative halt is authoritative; (b) before starting Stage 2, if remaining budget < 38, the degradation rule fires retroactively at Stage-1 scope — drop replicate 2 of the *worst-separated* block (a cell class named in advance; never a favorable-case drop), freeing ~24 judge + ~6 authoring sessions; (c) if still short, halt for owner re-authorization. Never run Stage 1 to the cap and skip confirmation; never overrun the ceiling. Under the codex-only reading all stages fit without degradation. Wall-clock estimate: Stage 0b ~1 day; Stage 1 ~2–3 days (invocations serialized); Stage 2 ~1–2 days.

Skippable: Stage 1b (if Sol is eliminated on quality); Stage 3 (if CI clear of band); nothing else.

### 13.3 Analysis

- Atomic observation = adjudicated D7 chapter composite per (model, block, replicate). Blind-rater pair scores are inputs to adjudication, never independently pooled.
- Primary statistic: per-block paired differences vs Sol; report each block's sign and magnitude, the across-block mean Δ, and a clustered bootstrap CI (resample blocks, then replicates) — no naive pooling of correlated cells.
- **Equivalence band: ±3.0 D7 points** (pre-registered; justification: equals the instrument's own calibration tolerance — differences inside the band are indistinguishable from judge noise — and exceeds the selection tie band of 2 already coded in selection.ts:74-85).
- Secondary: within-model replicate spread (variance), floor/readability measurements, first-pass vs post-repair deltas, repair/retry counts, latency, true session counts.
- Everything is reported: refusals, invalid outputs, hard-gate failures, instrument faults (as instrument faults, not model faults — the two are distinguished by the attempt-persistence records the AUD-02 fix creates).

### 13.4 Pre-registered decision rule

Evaluated only after Stage 2, in this order:

1. Any candidate with an unresolved safety/integrity hard failure (fabrication-class gate, quiz-key corruption, D7 gate fail unrepaired within cap) is **ineligible** regardless of scores.
2. If one candidate is **outside the +3.0 band above** the runner-up on mean adjudicated D7 with consistent block signs **and** has lower expected cost-per-accepted-chapter under the versioned price table → it becomes provisional default and pilot candidate.
3. If the top candidates are **within ±3.0** of each other → the lower expected cost-per-accepted-chapter wins **only if** a versioned owner-approved price table exists; with no price table the result is declared a quality tie and the decision goes to the owner with the cost column marked `PRICE NOT VERIFIED`.
4. If the cheaper candidate is **below −3.0** vs the leader, price cannot rescue it.
5. If quality and cost trade off without dominance → present the Pareto frontier; owner decides; no post-hoc utility weights.
6. If no candidate clears rule 1 + the Stage-1 floor → Sol remains provisional default; campaign stops; the bar does not move.
7. Owner blind preference: recorded on Stage-2 chapters *before* unblinding, usable only as the pre-registered tie-break inside rule 3/5 and as pilot sign-off — never a mid-test override.

The owner's existing n=1 comparison is treated as the motivating prior only; it carries zero evidentiary weight in the rule above. Cost claims remain `OWNER-SUPPLIED, PRICE NOT VERIFIED` until a dated, versioned price table is committed and referenced by `priceVersion` in the economics rollup.

## 14. Minimal implementation sequence (for later approval — no code in this task)

Vertical slices, each independently shippable with its proof test, in order:

| # | Slice | Proof |
|---|---|---|
| S1 | Bakeoff-lane measure-only readability (AUD-01): one flag through `candidates.ts` → sectionGate severity demotion in the bakeoff path only | Fixture with ease<70 completes; readability appears in validation.json; production sectionGate tests untouched |
| S2 | Validator derive-don't-reject + attempt-numbered persistence + cap 3 + `INSTRUMENT_FAIL` terminal state (AUD-02, 15f role-scoped retry) | Replay suite incl. the 14:32Z record class; cap test; attempt-dir accumulation test |
| S3 | Terminal-state selection minting + `provisional` marker + INVALID annotation for the nudge run (AUD-03/07) | Conductor test: no final selection with non-terminal candidates; resume-after-cure re-derives |
| S4 | CI repair: `--campaign` on six workflow steps, push trigger for the working branch, root workspace/`pipeline:*` repoint (AUD-06) | Green no-op PR; root `pipeline:typecheck` compiles the v24 package |
| S5 | Decision-band calibration anchors (owner adjudication session) + Stage-0 drill runner with drill report (AUD-04) | Drill passes both bands; anchor-span unit test |
| S6 | Ledger `session/reingest` kind + attempt index + price-table hook with `priceVersion` (AUD-08) | Ledger tests: reingest excluded from session counts; no table → `PRICE NOT VERIFIED` |
| S7 | *(pre-pilot)* D-12 halt-at-ready flip + uniform REQUIRE-envelope + D7 receipt hash in production manifest (AUD-09/10/12) | generate-book default test; book-run-parity promote test; tampered-receipt package-verify test |

S1–S6 unblock the experiment; S7 unblocks the pilot. Estimated diff size: each slice < ~300 LOC + tests.

## 15. Risks, unknowns, and owner decisions still required

- **Owner decisions**: (1) approve this plan and the slice sequence; (2) supply/approve the versioned price table (else the cost half of the decision rule stays disabled); (3) adjudicate 2 decision-band calibration anchors (S5); (4) authorize Stage 0b's ≤10 live judge sessions as a separately-approved gate; (5) reconcile/push the branch (AUD-05) and choose the canonical integration line; (6) confirm Stage-2 holdout archetype choice before unblinding; (7) **resolve the D-3 ceiling interpretation** — ratified wording says 150 *codex* sessions with Claude audits ledgered separately, while the screening plan/code charge both families against one 150 budget (V25-AUD-11); until ruled, the conservative combined reading governs and constrains Stage 2 (§13.2); open decision-ledger items D-1/D-2/D-4/D-5/D-6/D-9/D-11 remain as logged.
- **Unknowns**: whether the screening driver background task is still alive (last write 14:43Z; check before any resume); the 4 unrecovered rater-rejection reasons (mitigated by S2's persistence going forward); whether Terra/Luna readability profiles would pass even a recalibrated production gate (Stage 1 measures this); root-cause of the doc-count drift in `V25_EXECUTION_STATUS.md` (cosmetic).
- **Risks**: evaluator monoculture — all semantic judging rides one Claude model family; mitigations: blind pair + adjudication + decision-band calibration + owner blind spot-check at Stage 2 (accepted residual risk, documented rather than solved with more machinery). Single-machine branch loss (AUD-05) remains the largest non-experiment risk until pushed. Prompt-card or corpus drift between stages is prevented by the existing freeze/byte-identity mechanisms — do not edit the corpus mid-campaign.

## 16. Independent review findings and dispositions

One fresh-context reviewer (staff-engineer brief; inspect/comment only, read-only tools; no edits, no live calls) challenged both artifacts against seven axes: unsupported claims, missing paths, MD↔HTML mismatches, test-plan validity, unnecessary work, missing stop rules, and n=1 overreach. Disposition of every finding:

| # | Reviewer finding | Severity | Disposition |
|---|---|---|---|
| 1 | **Ceiling misattributed**: D-3 as ratified caps 150 *codex* sessions with Claude D7 audits "ledgered separately" (`V25_OWNER_DECISIONS.md:31`; protocol agrees), while the screening plan + `screeningPlan.ts:245-249` charge both families against one 150 budget — and the audit had adopted the combined reading, attributed it to D-3, and missed the contradiction. | MAJOR | **Accepted, fixed**: §13.2 rewritten with the corrected attribution and a conservative-until-ruled binding; the contradiction added to V25-AUD-11 evidence; new owner decision (7) in §15. |
| 2 | **Budget infeasibility unexamined**: per-stage caps sum to ~190 (208 with Stage 1b) vs 150, ~11 sessions already spent (L-39/L-44), and a cap-loaded Stage 1 would strand Stage 2 (needs ≥38) — while the plan checked only the 134-session best case and ignored the existing `ScreeningSessionBudget` halt. | MAJOR | **Accepted, fixed**: §13.2 feasibility paragraph rewritten — remaining-budget arithmetic shown, `ScreeningSessionBudget` made authoritative, a pre-Stage-2 budget check with a pre-named degradation rule, and "Stage 1 at cap without confirmation" declared a STOP. |
| 3 | §3 scoped repo-root artifacts (status docs, workflows, root package.json) as package-relative paths that don't resolve. | MINOR | **Accepted, fixed**: `<repo>/` prefixes + scoping note. |
| 4 | Stage-4 pilot had no stated session bound/abort basis; degradation rule not reconciled with `ScreeningSessionBudget`. | MINOR | **Accepted, fixed**: Stage-4 row now names the pipeline caps + D-8 halt as its bound and quarantine as abort; reconciliation in §13.2. |
| NIT | AUD-10 overstated ("hard-to-reverse") vs D-12's own recorded mitigations (knowingly deferred, git-only, D7-REQUIRE-gated, no live run authorized). | NIT | **Accepted, softened**: mitigations now quoted in the Consequence cell; severity stays Medium for the operator-surprise class. |
| NIT | §2 "ls-remote shows only [4 refs]" inaccurate (remote has ~12 heads; the material claim — no `plan/v25-s-tier-implementation` ref — is correct). | NIT | **Accepted, fixed**: wording now scoped to v25-related heads. |
| NIT | Judge-spend inflation quoted as ×1.6 / "roughly double" / ×2 with shifting denominators. | NIT | **Accepted, fixed**: unified as "≈2× — 13 real sessions for a nominally 6-session audit; 8/13 attempts valid". |
| NIT | Citation line drift (`readingLevel.ts:54-67` → ~49-86; `ENFORCED_MAJOR` at ~625); §16 was an empty placeholder referenced by §18. | NIT | **Accepted, fixed** (this section is the fill). Values/sets were all confirmed correct by the reviewer's independent re-checks. |

Axes reported **clean** by the reviewer, with independent re-verification: all seven mandated evidence spot-checks reproduced exactly (the calibration record's arithmetic, the 5-of-13 count, the 14:32:45Z/14:43:12Z sequence, the six ungated CI subverbs, root workspaces = v21-only, `ENFORCED_MAJOR` contents, `autoPublish=true`); MD↔HTML finding IDs and severities match 1:1; no sentence treats the owner's n=1 as evidence; confound control in §13 judged sound ("effort held constant… fixed cross-family judge… clustered bootstrap… I could not break it"); no unnecessary-machinery findings beyond items already filed under DEFER. Reviewer's bottom line: publish after fixing findings 1–2 — both now fixed as recorded above.

## 17. Model-free verification run in this session (audit worktree `/private/tmp/cf-v25-audit`, head `64b5d8a04`)

Every command was proven model-free before running: the test runner forces `CHAPTERFLOW_NO_API_CODEX_QC=1` (package.json), all model transports are spawn-injected doubles in the targeted suites (verified by reading each suite header), and the env additionally set `CHAPTERFLOW_ALLOW_MODEL_GEN=0`, empty `OPENAI_API_KEY`/`ANTHROPIC_API_KEY`, and `CHAPTERFLOW_LEAK_GUARD=1`.

| Command | Result |
|---|---|
| `npm ci` (audit worktree pipeline package) | **exit 0** |
| `npx tsc -p . --noEmit` | **exit 0** |
| `CHAPTERFLOW_NO_API_CODEX_QC=1 CHAPTERFLOW_ALLOW_MODEL_GEN=0 CHAPTERFLOW_LEAK_GUARD=1 OPENAI_API_KEY= ANTHROPIC_API_KEY= npx tsx tests/run.ts rubric-audit-instrument rubric-audit-harness d7-ship-gate bakeoff-screening-plan campaign-quarantine migration-guards generate-book-command deterministic-floor promote-gate no-api-promote run-call-ledger session-ledger pipeline-failure-injection model-capability-probe` — exactly 14 suites matched (list verified) | **exit 0** (all pass). Leak guard reported the known F-018 legacy test-state droppings, confined to the disposable audit worktree |
| `CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx src/cli.ts contract-validate` | **exit 0** — `contract-validate: PASS` (18 contracts + worker reports + emission parity) |
| Read-only git/state forensics (worktree list, ls-remote, merge-base, log/diff/show; jq over the untracked screening ledgers/records; hand-recompute of the calibration record's 8 domains) | n/a (read-only; recompute reconciled exactly — §5.2) |

Deliberately **not** run: full `npm run test` in a live worktree (state-dropping side effects belong only in the disposable worktree; the targeted 14 answer the audit questions), any `--execute-live` verb, `migration-bakeoff` subverbs, `scripts/screening/run-invocation.mts`, and anything that could author, judge, promote, publish, or call a model. What each suite proves is mapped in §6/§7 citations.

## 18. Sources

**Repository evidence** (all at `plan/v25-s-tier-implementation` @ `64b5d8a04` unless noted): the files cited inline throughout §§2–15 — primary: `src/cli.ts`, `src/orchestrator/{generateBookCommand,autopilot,authorRun,authorReview,authorRepair,modelPolicy,codexAgent,liveRun}.ts`, `src/exec/executionEnvelope.ts`, `src/lib/{strictEnv,atomicWrite}.ts`, `src/critics/{deterministicFloor,finalGate,d7ShipGate,readingLevel,qcAttestation}.ts`, `src/sections/sectionGate.ts`, `src/review/advisoryReview.ts`, `src/promoteBook.ts`, `src/qc/publishAfterQc.ts`, `src/verifyProductionPackage.ts`, `src/productionManifest.ts`, `src/telemetry/runCallLedger.ts`, `src/cost-tracker.ts`, `src/providers/*`, `src/bakeoff/*` (16 modules), `src/bakeoff/migration/{rubricAuditInstrument,rubricAuditHarness,cli}.ts`, `scripts/screening/run-invocation.mts`, `contracts/contract-manifest.json`, `contracts/requirement-traceability.json`, `.github/workflows/{chapterflow-v25-pipeline,ci}.yml`, root + package `package.json`, both `AGENTS.md` files, `docs/v25/implementation/*` (7 status/plan docs), `docs/v25/bakeoff-corpus-v1/corpus-manifest.json`, `docs/v25/rubric-audit-2026-07-15/`; and the untracked screening evidence enumerated in §3. Full reconnaissance transcripts (5 read-only explorer agents + 1 design reviewer) persist in the session task record `w2ret380d.output`.

**Practices adopted from [shanraisshan/claude-code-best-practice](https://github.com/shanraisshan/claude-code-best-practice)** (used as inspiration, not authority; no code installed):
- *Research → Plan → Execute → Review → Ship, stopping after reviewed planning artifacts* — this task's overall shape (recon → approved plan → artifacts → independent review → stop).
- *Prove the claim works from the branch diff and exact commands* — §17's exit-code discipline and §5.2's hand-recomputation instead of trusting the retained error message (which turned out to be misleading).
- *Vertical tracer slices over horizontal abstraction waves* — §14's slice sequence; every recommendation names its proof test (drove the "smallest fix + proof" columns of §7).
- *Agentic search over stale recollection* — all state was re-derived from `rg`/`git`/file reads this session; two prior-session beliefs (the "1e-9 validator bug" and "non-converging re-dispatch") were **overturned** by this (§5.2).
- *One fresh review context as test-time compute* — §16's single reviewer (Gate F), rather than an agent swarm.
- *Keep context clean; hand conclusions plus citations to the reviewer* — checkpointed findings files; reviewer received the two artifacts + this register, not raw tool output.
- *A partially migrated system with two valid-looking patterns is an explicit defect* — elevated duplicate entrypoints/`--compiler` overload/live-code-inside-quarantine into findings AUD-09/13 rather than footnotes.
- *One worktree for isolation; keep future PRs small* — the single detached audit worktree (§2) and the <300-LOC slice contract in §14.


