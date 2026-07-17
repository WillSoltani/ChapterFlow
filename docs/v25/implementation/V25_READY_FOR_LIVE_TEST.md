# V25 — READY_FOR_LIVE_TEST Runbook (Wave-5 Gate)

**Source of truth:** `docs/v25/V25_EVALUATOR_AND_MODEL_SELECTION_EXECUTION_PLAN.md` §5 (experiment), §7
(priorities), §11 (decisions/DoD). This doc does not restate policy it can drift from — it points at
the frozen sections and reproduces only the arithmetic an operator needs at the gate.

## 1. Terminal state

**READY_FOR_LIVE_TEST is the default and current terminal state for this session.** No live codex or
Claude calls were made to implement Waves 0–4; every test uses injected doubles/fakes. Waves 1–4
close this branch's engineering work. **Wave 5 (any live call) is NOT authorized by this session** —
it requires the owner authorizations in §2, in order, each recorded in the decision ledger before the
corresponding stage runs.

## 2. Remaining authorizations (owner-blocking, plan §11)

In the order they gate work:

1. **Stage 0b authorization — ≤24 codex sessions.** Covers 2 anchors × 2 E-audits (12) + D7-lite
   legacy-anchor drill (2) + optional degraded-fixture E-audit (3); planned 14, hard cap 24 (§5.3).
   Nothing in Stage 1+ may start before 0b's go/stop resolves (§5.3 row `0b calibration`).
2. **D-3 ceiling ruling** — confirm codex-only headroom or accept the tighter combined reading, or
   start execution pre-emptively at ladder rung R1 (§5.3; arithmetic reproduced in §3 below).
3. **Versioned price table** (V25-NEW-06 / WP-E42) — a dated `config/price-table.v1.json` with a
   stamped `priceVersion`. Absent, every cost figure stays `PRICE NOT VERIFIED` and decision rule
   §5.7(3) (cheaper-wins-within-band) cannot fire — quality-tie escalates to the owner instead.
4. **Optional anchor hand-adjudication** — owner scoring of the 2 anchor chapters used as the
   `|E − owner| ≤ W` truth check (§5.2). Declining is legal; anchors then supply location+noise only
   (disclosed in every report, never silently upgraded to "truth").
5. **Branch push/reconcile** (AUD-05) — `impl/v25-evaluator-selection` is single-machine only until
   pushed; live-test scheduling on any second machine is blocked until this is resolved.

No other item blocks Wave 5. Waves 0–4 (this branch's engineering) do not require any of the above.

## 3. D-3 ceiling arithmetic (reproduced verbatim from plan §5.3)

Judges moved onto the codex meter, so the default experimental path costs **≈130 sessions**
(0b 24 + Stage 1 119 + Stage 2 58, worst case, minus overlap already counted) against a ceiling of
150. Remaining headroom depends on how prior spend is read:

| Reading | Remaining budget | Fits the default ≈130-session path? |
|---|---|---|
| **Codex-only** (150 − ~17–21 already spent) | **≈129–133** | Yes |
| **Combined** (codex-only, further −13 Claude sessions already spent under the retired instrument) | **≈116–120** | **No** |

The combined reading does not leave room for the full default path — if the owner ratifies the
combined reading, execution starts at ladder rung **R1** (§4), not at the full plan. Stage budgets by
name (planned → cap, from §5.3): `0a` model-free 0; `0b` calibration 14→24; `1` screening 84→119;
`2` confirmation 32→46 (58 with D7-lite); `3` resolver 0 unless CI straddles the band (new
authorization required); `4` full-book pilot is outside this assignment (recommendation only).
**Never run Stage 1 to cap and skip Stage 2** — that is a STOP condition (§5.3), not a shortcut.

## 4. STOP conditions

| Condition | Trigger | Effect |
|---|---|---|
| **Noise STOP** | `2 × SD_retest > 4.0` at Stage 0b (band `W` cannot be frozen inside `[2.0, 4.0]`) | Instrument work required — never band inflation. Stage 1 does not start. |
| **Calibration fail** | D7-lite legacy-anchor drill `\|Δ\| > 3.0` at 0b, or any later drift check | D7-lite demoted to descriptive from the start of the run it fails in (§5.3, §5.6a-P3). |
| **Probe rejection** | Ultra-acceptance preflight probe (§4 of the plan) returns rejection | Campaign halts before any Sol-ultra D7 session runs — no fallback substitution. |
| **Budget halt** | `ScreeningSessionBudget` cumulative count reaches the authorized ceiling | Descend the degradation ladder (§5) or halt for re-authorization; the ledger recount at Stage 0a is authoritative over any estimate. |
| **Uniformity break** | Stage 1/2 rater sessions resolve to more than one codex default model | Stratify by resolved model + halt for owner decision (§5.6b); if the resolved default equals a candidate model, elevated-risk disclosure + owner blind Stage-2 read becomes load-bearing. |

Any STOP is a legal terminal outcome (plan §5.7 rule 8, INCONCLUSIVE) — it is never treated as a
defect requiring a workaround.

## 5. Degradation ladder (frozen now, plan §5.3)

Applies only after a **budget halt**, in order, and only ever trims — it never rescues a result toward
a particular winner (information criterion, never outcome-direction):

- **R1 (−6 sessions):** D7-lite 12 → 6; drop the block with the smallest replicate-1 E spread.
- **R2 (−12 sessions):** drop replicate 2 of that same block.
- **R3:** halt for re-authorization. No rung past R3 exists in this plan.

## 6. Operator commands (Stage 0a / 0b, when authorized)

Verb names below match the frozen plan §8 ownership table; the chapter-diagnostic verb
(`registerChapterDiagnosticCommand()`, exported from `src/evaluation/chapterDiagnosticRun.ts` per
WP-E14) and its CLI wiring are **pending CLI registration** — `src/cli.ts` / `src/bakeoff/cli.ts` are
integration-writer-only (see the frozen plan §8 merge order, last step "CLI registration, one
commit"). Do not hand-wire it into a lane worktree.

**Stage 0a (model-free — safe to run today, no owner authorization needed):**
```
cd <PKG> && npx tsc -p . --noEmit
cd <PKG> && CHAPTERFLOW_NO_API_CODEX_QC=1 CHAPTERFLOW_ALLOW_MODEL_GEN=0 CHAPTERFLOW_LEAK_GUARD=1 \
  npx tsx tests/run.ts <full suite>
cd <PKG> && npx tsx src/telemetry/runCallLedger.ts --recount state/run-ledger   # exact spend recount, WP-E41
```

**Stage 0b (calibration — requires §2.1 authorization; commands below are the intended shape, gated
on CLI registration landing):**
```
# Anchor E-audits (2 anchors x 2 repeats), pending chapter-diagnostic verb registration:
cd <PKG> && npx tsx src/cli.ts chapter-diagnostic run --anchor difficult-conversations --repeats 2
cd <PKG> && npx tsx src/cli.ts chapter-diagnostic run --anchor multipliers --repeats 2
# D7-lite legacy-anchor drill (existing model-bakeoff verb, judge model = Sol-ultra per §4):
cd <PKG> && npx tsx src/bakeoff/cli.ts model-bakeoff --status --judge-model gpt-5.6-sol --judge-effort ultra
```
Consult `docs/v25/implementation/V25_CHAPTER_EXPERIMENT_PROTOCOL.md` (WP-E33 deliverable) for the
byte-frozen plan JSON, blind-package IDs, and exact per-stage flags once it lands — this runbook does
not duplicate that content and must not go stale against it.

## 7. Explicit scope limits (unchanged by any authorization above)

- **No whole-book generation** occurs at any stage in this plan (§1, §5.3). Stage 4 (full-book pilot)
  is outside this assignment and requires its own authorization plus the BEFORE-PILOT items in plan
  §7.
- **Publish stays opt-in.** Nothing in Stages 0–3 flips a default publish flag; `runBakeoff.ts`'s
  `--publish` remains an explicit, operator-supplied flag, never implied by a passing screening or
  confirmation result.
- Chapter diagnostics are chapter-scope only and cannot certify a production default (plan §5.1);
  they carry `not_a_book_score: true` and live under
  `state/model-bakeoffs/<bookId>/chapter-diagnostics/`, never `artifacts/chapterflow-evaluation/`.

## 8. Definition of done for Wave 5 exit (unchanged from plan §11)

Wave 5 stays closed until: all lanes merged with green exact-head evidence; every high/critical WP
red-teamed with a recorded disposition; no Claude rating path reachable; diagnostics cannot
masquerade as book scores; the D7 route is provable (receipts, non-null model/effort); the experiment
is frozen; this doc and its HTML companion (if produced) agree; the implementation report contains no
unsupported claim; no whole book has been generated; nothing has been pushed.
