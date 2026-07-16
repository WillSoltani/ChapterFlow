# WP-205 — Consolidated deterministic floor + critic→D7 map

**Objective.** Replace the multiple redundant deterministic gate re-runs with ONE
consolidated deterministic floor pass, and record — for every `src/critics/*`
module — which D7 rubric-v2 signal it relates to, so that critics subsumed by the
D7 close-read gate stay advisory while genuine deterministic-safety checks stay
blocking in the single floor.

Machine-readable source of truth: [`src/critics/criticD7Map.ts`](../../src/critics/criticD7Map.ts)
(asserted complete + consistent by `tests/critic-d7-map.test.ts`). The floor pass
itself: [`src/critics/deterministicFloor.ts`](../../src/critics/deterministicFloor.ts)
(`tests/deterministic-floor.test.ts`).

---

## 1. The two layers (target architecture)

```
chapter bytes
   │
   ▼
FLOOR  (deterministic, fail-closed, cheap)         ← src/critics/deterministicFloor.ts
   schema · quiz-shape · count floors · register/tells · scaffold/apparatus leak
   · anti-salting/mechanical seams · banned names · fabrication-grammar · provenance
   · intra-book similarity · book-level structural sameness · format-v25
   │  (BLOCK → repair; PASS → continue)
   ▼
D7 CLOSE-READ SHIP GATE  (graded, model judgment, expensive)   ← WP-401, src/critics/d7ShipGate.ts
   8 rubric domains (0-100 weighted) + 6 base gates + layer_independence
   │  (fail → BLOCKED_QUALITY_BAR)
   ▼
publish
```

The floor is **deterministic safety**, never a ranker and never a graded score.
D7 owns the **graded learning judgment**. The floor runs FIRST (cheap deterministic),
D7 AFTER (proven: `deterministicFloor.ts` has zero dependency on `d7ShipGate`, and the
publish preflight orders every floor check before `d7-ship-gate`).

## 2. What "consolidation" changed

`runShipGate` already composed the ~66 per-chapter leaf critics into one function;
`runBookGate` composes the book-level critics. The sprawl the audit (V25-05) named was
the **re-invocation** of those gates at every lifecycle stage, each stage re-gluing
`runShipGate` + `runBookGate` + `runIntraBookChecks` (+ identity) independently — and,
worst of all, the major-policy scan (`currentMajorFindings` → `runShipGate`/`runBookGate`)
**re-ran the very gates promote/publish had just computed on the identical in-memory bytes**.

WP-205 introduces one canonical composition point, `deterministicFloor.ts`, that:

- exposes `chapterFloorGate` / `bookFloorGate` / `chapterFloorIntra` /
  `chapterFloorIdentity` (thin delegations to the legacy gate functions) and a combined
  `runChapterFloor`;
- carries an optional content-addressed **`FloorLedger`**: a stage that threads a shared
  ledger gates each unit **at most once per book run** — a second gate of identical bytes
  is a cache hit that returns the verdict a recompute would produce. Without a ledger the
  wrappers are a transparent pass-through (byte-identical to the pre-WP-205 direct call).

Every ship-path stage now calls the floor rather than re-composing gates:

| Stage | File | Redundancy removed |
|---|---|---|
| generate-time self-gate | `generateChapter.ts` | routed through `chapterFloorGate` |
| CAS commit | `critics/chapterGateComposite.ts` | ship + intra + identity via the floor |
| QC deterministic battery | `qc/orchestrator/deterministicGate.ts` | one ledger; ship/book/intra composed once |
| QC round preflight | `qc/orchestrator/index.ts` (`createQcOrchestrationRound`) | book-gate reused by the majors scan (one ledger) |
| QC repair-validation | `qc/orchestrator/index.ts` (`verifyRepair`) | ship/intra/book composed once (one ledger) |
| QC finalize | `qc/orchestrator/finalize.ts` | one ledger shared across the majors scan + the six-check battery |
| promote | `promoteBook.ts` | **ship + book gate reused by the majors scan** (one ledger) |
| publish preflight | `qc/publishAfterQc.ts` | **ship + book gate reused by the majors scan** (one ledger) |
| majors policy | `qc/majorDisposition.ts` | accepts the shared ledger; no second gate run |
| autopilot repair-key scan | `orchestrator/autopilot.ts` | ship + book via one ledger |

Non-ship-path callers (dev/reporting/experimental — `scratch/*`, `bakeoff/*`,
`lifecycle/bookStatus.ts`, and the CLI status/reporting verbs) intentionally keep
calling `runShipGate`/`runBookGate` directly; they are not the blocking ship path and
their behaviour is unchanged.

## 3. The central finding — why no blocker was retired

- **Every BLOCKING deterministic critic** enforces a fail-closed structural/safety
  invariant (artifact well-formedness, fabrication/provenance, apparatus leakage,
  mechanical corruption, quiz-key correctness) **or** a cross-chapter/cross-book
  distinctness invariant. The D7 gate is a **single-chapter graded** judgment — it does
  not measure these deterministic invariants and structurally cannot see siblings — so
  **none** of these blockers is subsumed by a D7-owned signal. They stay in the floor.
- **Every ADVISORY critic** (minor, or shadow-major NOT in `ENFORCED_MAJOR`) is a
  deterministic proxy for a graded learning dimension D7 now owns. D7 owns the judgment;
  the critic stays advisory (non-blocking, repair-routable QC debt). It was already
  non-blocking, so "subsumed by D7" changes no pass/fail outcome.

**Retirement outcome: 0 blockers retired.** Advisory critics are kept as repair-routable
debt (not deleted) so finding OUTPUT is unperturbed; the map records each one as
`subsumed-advisory`. Deleting an advisory critic is deferred (it would perturb finding
counts and pinning tests for zero blocking benefit).

**Proof (behavior-preservation).** Over the full shipped corpus — **140 books, 1903
chapters** — the floor's blocking-finding set equals the legacy stack's for ship-gate,
intra-book, and book-gate: **0 divergences**. Plus `tests/deterministic-floor.test.ts`
asserts `chapterFloorGate`/`bookFloorGate`/`chapterFloorIntra`/`chapterFloorIdentity` are
deep-equal to the legacy critics on known-good + known-bad fixtures.

## 4. D7 signal vocabulary

**8 graded domains** (rubric v2, weighted 0-100): `epistemic_integrity`, `audience_fit`,
`mental_model_coherence`, `learning_architecture`, `retention_retrieval`,
`transfer_action_judgment`, `motivation_autonomy`, `engagement_momentum`.

**6 base gates** (pass/fail): `chapter_artifact_completeness`,
`epistemic_instructional_safety`, `ethics_reader_autonomy`,
`purpose_audience_declaration`, `external_accuracy`, `actual_book_completeness`; plus
`layer_independence` (v25).

**Floor-only sentinels** (signals no D7 dimension owns — D7 is single-chapter graded):
`cross-chapter-distinctness`, `cross-book-distinctness`, `qc-round-state`,
`source-verification-policy`, `infrastructure`.

## 5. Map summary (full detail in `criticD7Map.ts`)

### Blocking floor — retained (deterministic safety / structural / distinctness)

| Module | Representative blockers | Floors / relates to |
|---|---|---|
| `schema` | A1/A2/A3/A5, A4 | `chapter_artifact_completeness` |
| `integrity` | A12 | `chapter_artifact_completeness` |
| `register` | B1/B2/B5, B4 | `chapter_artifact_completeness`, `audience_fit` |
| `narrative` | C1/C7/C8/C9/C10/C22 | `chapter_artifact_completeness`, `mental_model_coherence`, `engagement_momentum` |
| `supportSectionAudit` | C11–C14 | `chapter_artifact_completeness` |
| `scaffoldLeak` | SL1, SL6 (+ SL2–SL5) | `chapter_artifact_completeness`, `epistemic_instructional_safety` |
| `antiSalting` | AS1–AS4, AS13 | `chapter_artifact_completeness` |
| `mechanicalSeam` | SEAM1/SEAM2 (ENFORCED_MAJOR) | `chapter_artifact_completeness` |
| `evidenceIntegrity` | EI1/EI2 | `epistemic_instructional_safety`, `external_accuracy` |
| `evidenceWitness` | EW1 (ENFORCED_MAJOR) | `epistemic_instructional_safety`, `external_accuracy` |
| `formatV25` | F25.quiz_feedback | `chapter_artifact_completeness`, `learning_architecture` |
| `experiencePlan` | EXP1/RDRP1 | `chapter_artifact_completeness`, `transfer_action_judgment` |
| `quizQuality` | BP16/BP19/BP20/BP21/BP27, schema.quiz_* | `chapter_artifact_completeness`, `retention_retrieval` |
| `intraBookFieldSimilarity` | BP24 | `chapter_artifact_completeness`, `audience_fit` |
| `sourceGrounding` | SC11.1–.6 | `epistemic_instructional_safety`, `external_accuracy` |
| `intraBook` | AS5–AS12 | **cross-chapter-distinctness** (D7-uncovered) |
| `intraBookQuizSimilarity` | AS5/AS6/AS12 | cross-chapter-distinctness |
| `quizCorrectness` | quiz-key correctness | `chapter_artifact_completeness`, `retention_retrieval` |
| `architectureMonoculture` | ARCH0 (enforce mode) | cross-chapter-distinctness |
| `structuralSamenessMode` | structural sameness | cross-chapter-distinctness |
| `sourceRealness` | WS-4 source-reality | source-verification-policy, `external_accuracy` |
| `qcAttestation` | attestation freshness | qc-round-state |

### Advisory — subsumed by a D7 graded domain (non-blocking, kept as QC debt)

`sceneConcreteness` (C26), `outcomeVariety` (C28), `exampleCraft` (C29),
`exampleRegister` (C31), `intraChapterExampleLesson` (C30), `metaCaseProtagonist` (C32),
`beatVocabularyEcho` (C33), `citationDateDoorway` (C34), `lineageKeyQuiz` (C35),
`apparatusLeakage` (C36), `groundedNumbers` (GN1), `namedEnumeration` (NE1),
`readingLevel` (E1), `plainLanguage` (E7), `prose` (B7/B8/E3/E4/E8), `pedagogy`
(D1/D2/D3/D4/D6), `bookRepetition` (BP34), `contentMachinery`, `sourceCoherence`,
`sourceRegister`, `misattribution`, `readerBudgets` — each maps to `mental_model_coherence`
/ `learning_architecture` / `retention_retrieval` / `audience_fit` / `engagement_momentum`
/ `epistemic_integrity` as documented per-entry in `criticD7Map.ts`. Also advisory-but-
retained as their own promote/publish lanes: `authoringContract`, `quizKeyGate`,
`quizKeyEvidence`.

### Cross-book (D7-uncovered) / policy / infrastructure

`catalogAudit`, `crossBookSignatureAudit`, `cloneDetection` (cross-book-distinctness,
retained as audits); `sourceVerify` (verification policy infra); composition modules
(`finalGate`, `bookGate`, `chapterGateComposite`, `deterministicFloor`, `majorPolicy`,
`runAllCritics` — the last a legacy CLI reporting orchestrator, not a ship gate); helpers
(`shared`, `textUtils`, `machineryPhrases`, `leadAliases`, `registerAdvisories`,
`structuralSamenessSnapshot`, `validatorShadow`); write-side repair
(`bookSamenessRepair`, `contentDeviceRepair`); and the D7 gate itself (`d7ShipGate`).

## 6. Out of scope (owned elsewhere)

Threshold VALUES (WP-402 — the floor consumes config as-is; tellRate already demoted);
the D7 rubric-audit ship gate (WP-401); bounded-repair regression checks (WP-404); the
legacy compiler/v22 paths (WP-207); the review lanes (WP-403). No critic's detection
logic was changed — only duplicate invocations were removed and the composition was
centralized.
