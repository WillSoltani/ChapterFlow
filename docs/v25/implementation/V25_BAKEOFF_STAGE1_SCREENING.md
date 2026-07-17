# V25 Bakeoff — Stage-1 Screening (pre-registered plan)

**WP:** WP-703 (BUILD half) · **Lane:** 7 · **Phase:** 6
**Status:** REGISTERED — everything below is fixed BEFORE the first live authoring call.
**Machine-readable companion:** [`V25_BAKEOFF_STAGE1_SCREENING.plan.json`](./V25_BAKEOFF_STAGE1_SCREENING.plan.json)
(the single source of truth is `src/bakeoff/screeningPlan.ts` → `SCREENING_PLAN`; the
companion is `screeningPlanJson()` byte-for-byte, bound by
`tests/bakeoff-screening-plan.test.ts` so the registered numbers cannot drift from code).

This document pre-registers the Stage-1 screening. The screening EXECUTION (the live
authoring runs and the Claude-side D7 audits) is orchestrator-owned and OUT of the
BUILD scope; this WP builds the plan, the model-free decision functions, the no-draft
corpus intake, and the D7 dispatch seam the execution needs. Binding context:
ledger L-37 (owner D-3, hard ceiling 150), L-39 (WP-502 probe — all four configs
SUPPORTED), L-41 (WP-702 — D7 instrument is the bakeoff PRIMARY judge; rt702-R1
calibration-collision guard). Corpus: WP-701/701b (`docs/v25/bakeoff-corpus-v1/`).

---

## 1. Configs (exactly 4; all probe-SUPPORTED)

The screening authors candidate chapters with these four `(model, effort)` configs.
Every one is SUPPORTED by the WP-502 live capability probe
(`docs/v25/reports/V25_CAPABILITY_PROBE_RESULTS.md`, ledger L-39: existence +
`--output-schema` strict subset + effort flag all accepted; terra/luna exist — the
acknowledgment-(i) shrinkage did not materialize).

| Config id | Family | Effort | Probe |
|---|---|---|---|
| `gpt-5.6-sol@xhigh` | gpt-5.6-sol | xhigh | SUPPORTED |
| `gpt-5.6-terra@xhigh` | gpt-5.6-terra | xhigh | SUPPORTED |
| `gpt-5.6-luna@xhigh` | gpt-5.6-luna | xhigh | SUPPORTED |
| `gpt-5.6-sol@high` | gpt-5.6-sol | high | SUPPORTED (effort-sensitivity arm) |

A config that had FAILED the probe would be **dropped and recorded, never
substituted** (`dropProbeFailedConfigs`, D-3 acknowledgment (i)). All four passed, so
the screening runs at full registered width.

## 2. Runs (3 COMPARE-ONLY chapter subsets) + conductor decomposition

Three compare-only runs, one per corpus book/chapter — `nudge --chapters 3`,
`made-to-stick --chapters 4`, `the-happiness-hypothesis --chapters 6`. Each run screens
all four configs on its single frozen chapter: **4 configs × 3 chapters × 1 sample =
12 authoring runs**.

**Conductor decomposition (why each run is two `runBakeoff` invocations).**
`runBakeoff` pins ONE effort and a UNIQUE model-id set per invocation
(`if (new Set(models).size !== models.length) throw` + a single `opts.effort`), so a
run whose four configs include the same family at two efforts (`sol@high` +
`sol@xhigh`) cannot be one invocation. Each book-run therefore decomposes into:

- an **xhigh trio** — `models = [sol, terra, luna]`, `effort = xhigh` (3 candidates), and
- a **high solo** — `models = [sol]`, `effort = high` (1 candidate).

Six conductor invocations total; each is a compare-only single-chapter subset (never
promoted/QC'd/published). Both invocations of a book share that book's disjoint
calibration unit. Run trees land under `state/model-bakeoffs/<bookId>/<runId>/`:

| Book-run | Chapter | Conductor runIds |
|---|---|---|
| `stage1-nudge-ch03` | nudge ch3 | `stage1-nudge-ch03-xhigh-trio`, `stage1-nudge-ch03-sol-high` |
| `stage1-made-to-stick-ch04` | made-to-stick ch4 | `stage1-made-to-stick-ch04-xhigh-trio`, `stage1-made-to-stick-ch04-sol-high` |
| `stage1-the-happiness-hypothesis-ch06` | the-happiness-hypothesis ch6 | `stage1-the-happiness-hypothesis-ch06-xhigh-trio`, `stage1-the-happiness-hypothesis-ch06-sol-high` |

## 3. Per-book D7 calibration assignments (rt702-R1 disjointness)

The D7 judge reads a HIDDEN calibration reference unit alongside the candidate. The
rt702-R1 guard (runBakeoff + d7Judge) fail-closes if that unit belongs to the book
under test — a collision shadows the calibration pass and disqualifies every candidate
as opaque "audit incomplete" (L-41). Each run's calibration unit is therefore drawn
from a DIFFERENT corpus book:

| Run book | Candidate unit | Calibration unit | Why |
|---|---|---|---|
| nudge | `nudge-ch03` | `made-to-stick-ch04` | disjoint book; also the `DEFAULT_D7_CALIBRATION_UNIT`, valid without override |
| made-to-stick | `made-to-stick-ch04` | `nudge-ch03` | the default IS the unit under test → collision; override to the lowest-numbered disjoint sealed unit |
| the-happiness-hypothesis | `the-happiness-hypothesis-ch06` | `made-to-stick-ch04` | disjoint book; the default is valid without override |

`calibrationCollision()` returns null for all three (proved in
`tests/bakeoff-screening-plan.test.ts`), so the R1 guard never fires for a registered run.

## 4. Caps (hard, enforced BEFORE the offending session)

| Cap | Value |
|---|---|
| Planned authoring runs | 12 (4 configs × 3 chapters × 1 sample) |
| **Hard cap — authoring runs** | **≤ 18** (planned 12 + headroom for a re-emit) |
| **Hard cap — total sessions** | **≤ 40** (authoring + repairs + D7 dispatches) |

`ScreeningSessionBudget` reserves each session and **throws before the offending
session** would breach either cap (never a warning). Repairs count against the total
cap only.

## 5. Advancement bar (VERBATIM — registered before running)

> **A config advances to Stage-2 confirmation iff it has 0 hard-gate failures
> (deterministic floor AND D7 gate) AND a D7 chapter-diagnostic mean ≥ 75 across the
> 3 chapters. At most 3 configs advance, highest D7 means first.**

`decideAdvancement()` applies this mechanically: a config advances only with
`hardGateFailures === 0` AND `d7ChapterDiagnosticMean ≥ 75`; the ≤ 3 advancers are
ordered by D7 mean descending (ties by config id, deterministic).

## 6. STOP rule

> If NO config meets the advancement bar, the screening **STOPS** and emits an
> owner-escalation note (a format/architecture question, not a model-quality retry).
> The bar is **NEVER lowered** to manufacture an advancer, and no model is ever
> substituted for a dropped one. The audit change-condition moves **C→D**.

A zero-passing `decideAdvancement()` returns `outcome: "STOP"` with the registered
`SCREENING_STOP_ESCALATION` note. This is the D-3 acknowledgment-(ii) term (L-37): the
pre-registered halt is binding; Stage-2 (WP-704) does not begin.

## 7. Ledger accounting against the 150-session ceiling

- **Ceiling:** 150 codex + Claude-side sessions for the whole Phase-6 campaign
  (owner D-3, L-37).
- **Source of truth:** the WP-503 unified ledger under `state/run-ledger/**`. The
  running total is **READ from the ledger slices — it is never hardcoded here.** The
  prior probe spend (8 calls, L-39) is already recorded there; the screening's running
  total is the ledger sum, not a number copied into this doc.
- **What counts:** every codex-exec authoring/repair session AND every Claude-side D7
  rater/adjudicator DISPATCH (family `claude-side`), summed across all run-ledger slices.
- **Enforcement:** the execution lane reserves each session through
  `ScreeningSessionBudget` and checks the cumulative ledger total against 150 BEFORE
  spawning; a would-be overshoot HALTS before the offending session.

## 8. Blinding requirements

- Candidates map to opaque labels (A/B/C…) once per run; the mapping lives only in the
  run manifest + final report, never in a reviewer-visible artifact.
- Every reviewer-visible artifact (D7 rater task, advisory review doc/task) passes the
  forbidden-token leak check (model ids, family suffixes, slugs, slots, price/tier
  words) BEFORE any dispatch — a leak is fail-closed.
- The D7 hidden calibration unit is disjoint from the book under test (§3), so the
  calibration pass can never be shadowed by a candidate chapter.

## 9. Advisory judge (non-blocking, blinded)

The PRIMARY judge is the Claude-side D7 rubric-audit instrument (WP-702). The codex
whole-book panel is a recorded, NON-BLOCKING advisory that never changes eligibility or
ranking. `runBakeoff` still requires an explicit `--judge-model`; the screening registers
a fixed advisory judge **`gpt-5.6-terra @ high`** (a supported 5.6 id — never a
legacy-baseline-family id; refused before any spawn by `assertBakeoffJudgeSupported`,
rt702-R3). All three families author in every run, so an advisory judge that never
coincides with a candidate is unavailable; blinding + the non-blocking demotion make any
residual overlap immaterial to the D7-primary selection.

## 10. Evidence / storage layout

- **Per conductor invocation:** `state/model-bakeoffs/<bookId>/<runId>/` —
  `manifest.json` (resume SoT), `shared-inputs/` freeze record (`combinedSha256`),
  `work/<slot>/` candidate chapters, `reviews/<label>/d7.json` (PRIMARY) +
  `review.json` (advisory), `selection/selection.json`, `report.json` + `report.md`.
- **Per D7 audit:** the retained rubric-audit tree under its `auditId`
  (`bakeoff-<runId>-<label>`) — batch manifest, per-(unit,role) rater/adjudication
  records, blind-pair seals.
- **Ledger:** `state/run-ledger/<bookId>/<runId>.jsonl` + `<runId>.summary.json`.
- The advancement/STOP decision record and per-config D7 means are written alongside
  this doc as the Stage-1 outcome evidence.

---

## 11. No-draft corpus intake (how the execution reads the frozen corpus)

The corpus books have no operator draft — their research/compile shared inputs are
frozen on disk (WP-701/701b). `runBakeoff` gained a no-draft **corpus run** path
(`opts.corpus = { bookId, chapters }`), implemented by `src/bakeoff/corpusIntake.ts`:

1. verifies `docs/v25/bakeoff-corpus-v1/corpus-manifest.json` is
   `bakeoffReadiness === "ready-for-bakeoff"` AND the target unit's `authoringSource`
   is a RESOLVED repo-relative pointer (the same allowlist the corpus-fixtures test
   uses) — **fails CLOSED** with a truthful message otherwise (the manifest is
   `not-ready-for-bakeoff` today, because every `authoringSource` is `UNRESOLVED`
   pending owner decision D-7);
2. verifies the shared-input files exist via the freeze machinery
   (`collectSharedInputPaths`, which the freeze then hashes);
3. skips the draft-research phases idempotently (research is frozen on disk; the
   freeze phase re-hashes the existing inputs and runs NO compile chain / source-repair);
4. preserves compare-only semantics — a corpus run is ALWAYS compare-only and never
   promotes, QCs, or publishes.

Until D-7 resolves the `authoringSource` pointers, `intakeCorpus` refuses every
corpus run against the real manifest — proved in `tests/bakeoff-screening-plan.test.ts`.

## 12. D7 worker dispatch seam + orchestrator runbook (FINDING-2 / L-41)

**Scoping (cited).** The WP-401 D7 SHIP GATE (`src/critics/d7ShipGate.ts`) is
MODEL-FREE by construction — its header states *"The rating itself stays EXTERNAL —
isolated Claude worker agents rate the app-faithful audit documents (zero codex/API);
this module never invokes a model."* It only MINTS a receipt from an already-adjudicated
audit and EVALUATES it. `generateBookCommand.ts` likewise only READS the receipt sidecar
(`requireD7ShipGate`, `d7ShipGateHaltPath`) — it never spawns a rater. The rating (the
Claude turn) is performed by EXTERNAL isolated Claude sessions the operator/orchestrator
supplies; `rubricAuditHarness.ts` renders the rater task and ingests the returned record
(the only point the session becomes visible to the codebase, where WP-503 already
ledgers it).

**Consequence.** There is NO in-repo live Claude dispatcher to "reuse" — the ship
gate's dispatch mechanism IS an operator-supplied external session. Per the WP-703 STOP
condition, this WP BUILDS the seam ADAPTER (`src/bakeoff/d7WorkerDispatch.ts`) rather
than inventing a fake live dispatcher:

- `createD7WorkerDispatch({ sessionRunner, pipelineDir })` returns the `D7WorkerDispatch`
  the bakeoff judge expects. It adapts the operator-supplied
  `IsolatedClaudeSessionRunner` (the SAME external-session mechanism the ship gate's
  raters use), measuring latency and appending ONE WP-503 ledger entry per dispatch
  (family `claude-side`, stage `d7-rater-dispatch`, `model`/`effort` null — the external
  session is unobservable to this process).
- The default runner is **fail-closed** (`unwiredIsolatedClaudeSession` throws): the
  seam never fabricates a rater record. A runner failure is ledgered and re-thrown; the
  D7 judge turns a worker throw into an INELIGIBLE candidate (never a stubbed score).

**Orchestrator runbook — supplying real Claude sessions for the screening.**

1. Wire `deps.d7Worker = createD7WorkerDispatch({ sessionRunner })`, where
   `sessionRunner(req)` runs ONE isolated Claude session over `req.task` (already
   leak-checked by the judge) and returns that session's record JSON text VERBATIM. Use
   an isolated session per `(auditId, unit, role)` — no shared context across raters,
   no model identity in the task.
2. Preserve the roles the harness expects: `primary`, `verification`, `adjudicator`
   (the judge ingests them fail-closed through the existing validators).
3. Every dispatch is ledgered under `state/run-ledger/<bookId>/<auditId>.jsonl` with
   stage `d7-rater-dispatch`. **Ceiling accounting sums the `d7-rater-dispatch`
   entries** (one per real external call; resume skips dispatch, so this count never
   over-reports) plus the codex authoring/repair sessions. The harness's own ingest
   entries (stage `d7-rubric-audit`) record the validated outcome and can re-fire on
   resume — they are the outcome record, not the call count.
4. Never substitute a codex read for a Claude session; never hand-write a rater record.
   If no `sessionRunner` is supplied, the seam refuses (the judge stays fail-closed).

---

## 13. What this WP does NOT do

- It does NOT execute any live authoring or D7 audit (orchestrator-owned).
- It does NOT promote, publish, or write canonical state (compare-only).
- It does NOT lower the bar, substitute a model, or hardcode the ledger spend.
- It does NOT decide the production model — that is WP-705, on Stage-2/3 evidence.
