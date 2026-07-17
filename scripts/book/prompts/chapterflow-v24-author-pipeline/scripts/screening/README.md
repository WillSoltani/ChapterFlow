# WP-703 — Stage-1 Screening Execution Driver

`run-invocation.mts` is the orchestrator-owned EXECUTION lane for the pre-registered
V25 Stage-1 screening. The BUILD half (the plan, the model-free decision functions,
the no-draft corpus intake, and the D7 dispatch seam) lives in `src/bakeoff/`
(`screeningPlan.ts`, `corpusIntake.ts`, `d7WorkerDispatch.ts`) and is documented in
`docs/v25/implementation/V25_BAKEOFF_STAGE1_SCREENING.md`. This driver only COMPOSES
those existing modules — it adds **no product code** and edits **no product source**.

## What it runs

```
env -u OPENAI_API_KEY npx tsx scripts/screening/run-invocation.mts <invocationId>
```

`<invocationId>` is one of the **six** registered conductor `runId`s (read from
`SCREENING_PLAN` and its byte-bound companion — the driver refuses to run if the
on-disk companion has drifted from the code):

| # | Invocation id | Book / chapter | Models | Effort |
|---|---|---|---|---|
| 1 | `stage1-nudge-ch03-xhigh-trio` | nudge ch3 | gpt-5.6-sol, gpt-5.6-terra, gpt-5.6-luna | xhigh |
| 2 | `stage1-nudge-ch03-sol-high` | nudge ch3 | gpt-5.6-sol | high |
| 3 | `stage1-made-to-stick-ch04-xhigh-trio` | made-to-stick ch4 | gpt-5.6-sol, gpt-5.6-terra, gpt-5.6-luna | xhigh |
| 4 | `stage1-made-to-stick-ch04-sol-high` | made-to-stick ch4 | gpt-5.6-sol | high |
| 5 | `stage1-the-happiness-hypothesis-ch06-xhigh-trio` | the-happiness-hypothesis ch6 | gpt-5.6-sol, gpt-5.6-terra, gpt-5.6-luna | xhigh |
| 6 | `stage1-the-happiness-hypothesis-ch06-sol-high` | the-happiness-hypothesis ch6 | gpt-5.6-sol | high |

### Exact command lines (run from the pipeline dir)

```
env -u OPENAI_API_KEY npx tsx scripts/screening/run-invocation.mts stage1-nudge-ch03-xhigh-trio
env -u OPENAI_API_KEY npx tsx scripts/screening/run-invocation.mts stage1-nudge-ch03-sol-high
env -u OPENAI_API_KEY npx tsx scripts/screening/run-invocation.mts stage1-made-to-stick-ch04-xhigh-trio
env -u OPENAI_API_KEY npx tsx scripts/screening/run-invocation.mts stage1-made-to-stick-ch04-sol-high
env -u OPENAI_API_KEY npx tsx scripts/screening/run-invocation.mts stage1-the-happiness-hypothesis-ch06-xhigh-trio
env -u OPENAI_API_KEY npx tsx scripts/screening/run-invocation.mts stage1-the-happiness-hypothesis-ch06-sol-high
```

**Run order:** the two invocations of a book (`…-xhigh-trio` and `…-sol-high`) share
one `bookId`, so they contend the same autopilot book lock — run them **sequentially**
(the driver does not override the lock; a concurrent second invocation HALTs cleanly
with a "another run holds the lock" reason). Different books may run in parallel.

Everything else — book, chapter, models, effort, calibration unit, advisory judge —
is resolved from the **registered plan only**. There is **no CLI flag** for the bar,
caps, models, calibration, or judge (rt703 OBS-B: the execution lane passes registered
defaults, never a hand-tuned config).

## What the driver guarantees

1. **`env -u OPENAI_API_KEY`.** The driver refuses to start if `OPENAI_API_KEY` is set,
   so no codex-exec child can inherit it. It is also stripped from every isolated
   `claude` child env.
2. **Plan/companion agreement.** It loads `SCREENING_PLAN` and asserts the on-disk
   `V25_BAKEOFF_STAGE1_SCREENING.plan.json` is byte-identical to `screeningPlanJson()`
   — refusing on drift.
3. **Session budget, enforced BEFORE spawning** (see *Budget accounting*).
4. **PRIMARY D7 judge via isolated `claude -p`.** `deps.d7Worker =
   createD7WorkerDispatch({ sessionRunner })`, where `sessionRunner` spawns ONE
   isolated `claude -p --model claude-opus-4-8 --output-format text` per D7 rater task
   (`req.task` on stdin), cwd = a fresh empty
   `state/model-bakeoffs/<bookId>/claude-sessions/<auditId>/<unit>-<role>/` dir, a
   20-minute timeout, and a 48 MB output budget. The reply is returned with
   **transport-level trimming only** (first `{` … last `}`) — never a field edit,
   never a fabricated record. A non-zero exit, a timeout, an over-budget stream, or a
   reply with no JSON object throws, which the D7 judge treats as an INELIGIBLE
   candidate (fail-closed).
5. **Corpus-mode `runBakeoff`.** Compare-only, resume-safe (`runId` = the invocation
   id → run tree at `state/model-bakeoffs/<bookId>/<invocationId>/`), with the
   registered advisory judge `gpt-5.6-terra @ high`. A killed driver re-run continues
   idempotently from the run manifest.
6. **Final summary.** Progress lines plus a single `SCREENING_INVOCATION_SUMMARY {…}`
   JSON line: `{ invocationId, bookId, chapters, status, perCandidate: [{ model,
   effort, d7Composite, d7GatesPass, floorEligible }], ledgerCounts }`.

## Budget accounting (deliverable 2)

The running total is **read from the WP-503 ledger** (`state/run-ledger/**`) — never
hardcoded. The driver sums, across every ledger slice:

- **`codexExecSessions`** = family `codex-exec` (authoring / repair / advisory-judge spawns);
- **`d7RaterDispatches`** = family `claude-side`, stage `d7-rater-dispatch`;
- **`campaignSessions`** = `codexExecSessions + d7RaterDispatches` → the **150** ceiling.

Before starting, the driver seeds the registered `ScreeningSessionBudget` with the
screening's prior ledgered spend and reserves this invocation's authoring worst case
(`models × chapters` writer spawns). `ScreeningSessionBudget` throws BEFORE the
offending session if the **≤18 authoring** or **≤40 total** cap would break; the driver
separately halts if `campaignSessions + authoring + D7-worst-case > 150`. No cap is
ever raised or lowered to fit.

### Two GAPS found (reported, NOT patched — product code is unchanged)

- **`runBakeoff` does not self-ledger its codex authoring.** `runBakeoff`'s default
  deps (`resolveBakeoffDeps → resolveDeps → logSessionToDisk`) write only the forensic
  `state/autopilot-logs/**` sink; the WP-503 `codex-exec` ledger entry is emitted by
  `autopilot.ts`'s `buildLedgeredDeps`, which is applied inside `runAutopilot`/
  `runAutoResearch` but **not** inside `runBakeoff`'s candidate path. Without wiring,
  the ledger would under-count bakeoff authoring against the caps and the 150 ceiling.
  The driver therefore injects `deps.logSession` to mirror every codex spawn into the
  ledger (family `codex-exec`, stage `classifySessionLabel(label)`) — replicating
  `buildLedgeredDeps`' documented behavior via exported functions only. **If a future
  change routes bakeoff authoring through `runAutopilot`, drop this injection to avoid
  double-counting.** (Whether `runBakeoff` should self-ledger is an owner decision.)

- **The doc's ≤40-total wording vs. the arithmetic.** `V25_BAKEOFF_STAGE1_SCREENING.md`
  §4 describes the ≤40 total cap as "authoring + repairs + **D7 dispatches**". But the
  D7 harness dispatches one Claude session per `(unit, role)` = `(chapters + 1
  calibration) × 3 roles` per candidate = **6 dispatches/candidate**; across all 12
  planned candidates that is 72 D7 dispatches alone, which cannot fit under 40. The
  registered `ScreeningSessionBudget` code only exposes `reserveAuthoring` /
  `reserveRepair` (codex sessions) and the 150 ceiling is sized precisely to absorb
  the D7 dispatches (§7). This driver therefore treats the **≤40 cap as the codex
  session cap** (authoring + repairs; the ScreeningSessionBudget currency) and accounts
  the D7 dispatches against the **150 ceiling**. The §4 parenthetical should be
  reconciled with the code (owner clarification) — the driver does not lower the
  registered cap to resolve it.

## Typechecking

`scripts/` is outside the pipeline's `tsconfig.json` `include` (`src/**` + `tests/**`),
so the product typecheck `npx tsc -p . --noEmit` does not cover this driver (and stays
green). Typecheck the driver with its dedicated config, which inherits the pipeline's
exact `strict` / ESNext / Bundler options:

```
npx tsc -p scripts/screening/tsconfig.json --noEmit
```

## Isolation caveat

The isolated session cwd is an empty leaf dir under `state/model-bakeoffs/…` (as
specified), so no rater shares another's state and the leaf has no `CLAUDE.md` of its
own. The `claude` CLI may still discover a `CLAUDE.md` in an **ancestor** dir; if the
orchestrator needs stricter context isolation it can point the runner at an out-of-repo
scratch root — the seam is a one-line change to the `cwd` in `isolatedClaudeSessionRunner`.

## Build-only status

This driver was built and verified **model-free**: `tsc` green (product + driver),
`tests/run.ts bakeoff-screening-plan` green, and a `--help` smoke. **No live call, no
bakeoff run, and no `claude`/`codex` subprocess were executed** during the build.
