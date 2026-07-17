# V25 Chapter Experiment — Pre-Registration (frozen plan §5)

**WP:** WP-E33 (evaluator/model-selection execution plan, lane L3) · **Phase:** 6
**Status:** REGISTERED — everything below is fixed BEFORE any candidate generation for this
experiment. This is a pre-registration document: nothing in this file may be edited after
Stage 0b closes without voiding comparability (§5.4).
**Machine-readable companion (budget authority only):**
[`V25_CHAPTER_EXPERIMENT_BUDGET.plan.json`](./V25_CHAPTER_EXPERIMENT_BUDGET.plan.json)
— single source of truth is `src/bakeoff/screeningPlan.ts` → `EXPERIMENT_BUDGET_PLAN`; the
companion is `experimentBudgetPlanJson()` byte-for-byte, bound by
`tests/bakeoff-screening-plan-experiment-budget.test.ts`.
**Source:** `docs/v25/V25_EVALUATOR_AND_MODEL_SELECTION_EXECUTION_PLAN.md` §5 (frozen;
supersedes the experiment design in `V25_PIPELINE_AUDIT_AND_MODEL_TEST_PLAN.md` §13–14). This
document copies that section's substance and expands every place the frozen plan says "(as
artifact)" into the concrete registered form.
**Relationship to WP-703:** this is a *different, newer* pre-registered experiment from the one
`V25_BAKEOFF_STAGE1_SCREENING.md` registers. WP-703's `SCREENING_PLAN` (4 configs × 3
compare-only chapter runs, caps 12→18/40, bar "D7 mean ≥75") is untouched and still governs its
own STOP condition — its Stage-1 result is disclosed in `CAMPAIGN_QUARANTINE.md` as
`INVALID — instrument shakedown` (an instrument bug, not a model verdict; see WP-E32). This
document is the successor pre-registration built on the corrected instrument and the no-Claude
rating policy (§1 of the execution plan).

---

## 1. Decision under test

Which of {Sol, Terra, Luna} @ xhigh earns a **separately authorized full-book pilot**.

Binding scope limits, stated here verbatim because every report must repeat them:

- Chapter samples **never certify a production default**. The production default does not
  change as a result of this experiment.
- **No whole-book generation** occurs anywhere in this protocol. Every authored unit is a single
  frozen chapter from the registered corpus (§5.4); nothing here authors, compiles, QCs, or
  publishes a book.
- The chapter-diagnostic output of this experiment is a **diagnostic**, never a book score
  (boundary owned by WP-E11/E13; `chapterdiag--` id prefix, segregated artifact root,
  `not_a_book_score: true`, no portfolio script ever runs on it).

## 2. Owner priors — OWNER-SUPPLIED_PRELIMINARY (zero evidentiary weight)

The owner's evaluator-implementation assignment cites Luna ≈87, Terra ≈84, Sol ≈79 from an
independent one-chapter Nudge comparison. Per the provenance matrix (execution plan §2,
rows PM-1/PM-2/PM-3):

| Model | Owner figure | Method | Artifact | Disposition |
|---|---|---|---|---|
| Luna | ≈87 | unknown | none | **OWNER-SUPPLIED_PRELIMINARY** |
| Terra | ≈84 | unknown | none | **OWNER-SUPPLIED_PRELIMINARY** |
| Sol | ≈79 | unknown | none | **OWNER-SUPPLIED_PRELIMINARY** |

These three numbers are a **motivating prior only** — they carry **zero evidentiary weight** in
this experiment's decision rule (§8). No sentence in any report produced by this protocol may
treat PM-1/PM-2/PM-3 as evidence, average them with an E-audit result, or use them to break a
tie. They conflict with the retained chapter-audit records (PM-4/PM-5/PM-6: Luna floor-failed at
85.3, Sol 81.4 > Terra 75.2, three different source hashes — not one comparison) — that conflict
is **unresolved by design**; only this pre-registered experiment may resolve it.

## 3. Instruments

### 3.1 E-audit (PRIMARY)

Adjudicated standalone chapter diagnostic via the evaluator adapter (`src/evaluation/`, WP-E11-14
— the Codex ChapterFlow Book Evaluator skill, unmodified, invoked through an adapter never a
reimplementation): **3 codex sessions per cell** (2 mutually-blind raters + 1 fresh adjudicator).

- **Primary metric:** the renormalized 8-domain chapter score — Σ weighted points for domains
  1–8, ÷ 0.95. Domain 9 (whole-book-only) is **unevaluable and never imputed**; the
  renormalization is order-preserving, so the equivalence band (§4) is defined on the same
  0–100 scale used everywhere else in this document.
- Uses the same `chapterflow_standalone_chapter_adjudication` 1.0.0 artifact family PM-4/5/6
  already established — no third format is minted.

### 3.2 D7-lite (SECONDARY, descriptive unless promoted)

A single-rater Sol-ultra rubric-audit session per replicate-1 cell. Signs-and-patterns only —
never the decision instrument on its own (§8 rule 7 is the only path a D7-lite reading can affect
the outcome, and only as a downgrade). Keeps its own legacy anchors and tolerance, independent of
the E-audit band:

| Legacy anchor | Value |
|---|---|
| nudge-ch03 | 70.757 |
| happiness-ch06 | 68.816 |
| made-to-stick-ch04 | 67.664 |
| Drift tolerance | ±3.0 |

D7-lite is secondary by construction because it is judged by GPT-5.6 Sol @ ultra — the same
family as one of the candidates. §6 registers the interaction-pattern checks that can demote it
further, to purely descriptive.

## 4. Anchors and the equivalence band

### 4.1 Anchor identities

Drawn from the 8 `prior`-profile close-read books in the 140-book snapshot (single-evaluator
screening scores — method-limited, disclosed; **anchor selection is the only place these scores
are used, and never enters a blind rater context**), excluding any corpus book:

| Anchor | Book | Score | Role |
|---|---|---|---|
| A_high | `difficult-conversations` | 90.1 | high-quality reference |
| A_mid | `multipliers` | 72.3 | mid-quality reference |

### 4.2 Chapter pick — deterministic ⌈n/2⌉ rule

The anchor chapter is `ceil(chapterCount / 2)` of the book's chapter inventory — a fixed rule,
never a hand-pick. For reference (not executed by this WP; the corpus/anchor authoring lane picks
the live chapter at Stage 0b):

| Book | Chapters | ⌈n/2⌉ |
|---|---|---|
| difficult-conversations | 12 | 6 |
| multipliers | 9 | 5 |

### 4.3 Test-retest and the equivalence band

Each anchor gets **2 repeat E-audits** (independent sessions, same chapter) at Stage 0b — 4
E-audits total, pooled into a test-retest standard deviation `SD_retest`.

**Equivalence band (frozen AFTER Stage 0b, from the pooled SD, never before):**

```
W = max(2 × SD_retest, 2.0)          — with a hard STOP if 2 × SD_retest > 4.0
```

- The floor (2.0) prevents an implausibly tight band from an unlucky low-variance sample.
- 4.0 is a **noise STOP**, not an upper clamp (the band is never *set to* 4.0 — the STOP fires
  first): if the raw `2 × SD_retest` exceeds 4.0, the instrument itself is too noisy to resolve
  a model comparison at this sample size — Stage 0b **HALTS** and the finding is "the instrument
  needs work," never "widen the band and continue."
- The retired ±3.0 band (WP-703's D7-only instrument) is **not carried over** — it was a property
  of the retired single-rater instrument, not a property of this experiment's dual-blind
  E-audit instrument.

### 4.4 Floors (formulas now, constants after Stage 0b)

| Floor | Formula | Purpose |
|---|---|---|
| Screening advance floor | `mean(A_high) − 8` | minimum E-audit mean to advance from Stage 1 |
| Block floor | `mean(A_high) − 18` | no single block may fall below this, regardless of the mean |
| Sanity stop | `mean(A_high) < 75` **or** `mean(A_high) > 95` | the anchor read itself is implausible — halt, don't proceed on a broken instrument |

All three become fixed numbers once Stage 0b's `mean(A_high)` is known; they are never
recalculated mid-experiment to rescue a candidate.

**Scale precision (red-team F7):** `mean(A_high)` is the pooled **chapter-diagnostic re-score**
of the A_high anchor chapter measured at Stage 0b — NEVER the book's 90.1 portfolio score. The
portfolio score only *selects* the anchor book; using it in a floor formula would compare a
full-book construct to chapter diagnostics (forbidden) and set an unclearable 82.1 floor.

### 4.5 Optional owner hand-adjudication (truth check)

If the owner hand-adjudicates the 2 anchor chapters, that becomes a **truth check**:
`|E − owner| ≤ W` for each anchor. If the owner declines, the anchors provide **location and
noise information only** — disclosed in every report as a method limitation, never silently
upgraded to a truth check.

## 5. Stages and budgets

Registered in code as `EXPERIMENT_BUDGET_PLAN` / `EXPERIMENT_STAGE_BUDGETS`
(`src/bakeoff/screeningPlan.ts`), byte-frozen in the companion `.plan.json`. All "Runs" are live
codex sessions — every one bills the codex meter and every one is ledgered (WP-503).

| Stage | Runs | Planned → cap | Go / stop |
|---|---|---|---|
| 0a model-free | chapter-diagnostic exporter + scrub + leak tokens; attempt persistence/caps; terminal selection; known-effect fixture; exact spend recount from `state/run-ledger/**`; plan JSON byte-freeze | 0 | all suites green |
| 0b calibration | 2 anchors × 2 E-audits (4 audits = 12 sessions) + D7-lite drill: 1 mid-band legacy unit + ≥1 **high-band unit from the sealed 2026-07-15 owner-adjudicated reference set (~90 band)** + 1 drift unit (3); optional degraded-fixture E-audit (3) | 15 → 24 | noise STOP (§4.3); ≥6/8 first-attempt-valid; D7-lite `\|Δ\| ≤ 3.0` at BOTH bands, else decision-rule 7's 75 gate is dropped as uncalibrated and D7 is descriptive-only (red-team F2 — the legacy mid-band anchors alone cannot validate a 75 threshold) |
| 1 screening | 3 models × 3 blocks × 2 replicates = 18 author cells (≤1 in-lane retry) + 18 E-audits (54) + D7-lite (9 cells + 3 drift = 12) | 84 → 119 | advance ≤2: no candidate-attributable gate-2/3 failure ×2 cells; mean E ≥ advance floor; no block < block floor; 0 qualify → STOP (Sol stays provisional) |
| 1b Sol@high arm | DROPPED by default (budget; owner-revivable with its own budget) | 0 | — |
| 2 confirmation | top 2 × 2 blocks (1 pre-registered holdout archetype + max-separation block) × 2 fresh replicates = 8 author + 8 E-audits (24); D7-lite conditional (10) | 32 → 46 (58 w/ D7-lite) | leader's Δ sign holds on ≥3/4 cells; holdout not inverted |
| 3 resolver | only if the pre-registered decision inputs are indeterminate (sign inconsistency across blocks, or `\|mean Δ\|` inside W); requires NEW owner authorization | 0 | pre-registered rule (§8) applies first |
| 4 full-book pilot | outside this assignment (recommendation only) | — | entry: Stage-2 clear + BEFORE-PILOT items |

### 5.1 Budget truth (owner must see, both D-3 ceiling readings)

Judges moved onto the codex meter (D7-lite is Sol-ultra via `ultraSession`, not the retired
Claude-side rubric audit), so every session bills against D-3 under BOTH readings. The honest
default-path total **includes Stage-2 D7-lite** — the normal case when D7 survives §10's
interaction analysis (red-team F3): 15 + 84 + 42 ≈ **141 sessions** (a D7-demoted path is
15 + 72 + 32 ≈ 119). All "already spent" figures are ESTIMATES until the Stage-0a exact ledger
recount replaces them:

| Reading | Ceiling | Already spent (estimate) | Remaining | Fits the default ~141-session path? |
|---|---|---|---|---|
| Codex-only (D-3 as ratified, L-37) | 150 | ~17–21 | **≈129–133** | **No** — not reliably (short by ~8–12) |
| Conservative combined (+ retired Claude-side D7 spend) | 150 | ~30–34 (17–21 codex + 13 Claude) | **≈116–120** | **No** — short by ~21–25 |

**The default path does not reliably fit under EITHER reading.** This protocol therefore stays
bound to the audit's conservative combined reading until the owner rules on D-3, and — unless
the owner grants explicit additional headroom (no figure is proposed here; D-3 says 150 and this
protocol invents no ceiling) — **the campaign starts at degradation rung R1 by default**.
`ScreeningSessionBudget` enforces whichever ceiling the owner has authorized, and the exact
recount at Stage 0a replaces both estimates before Stage 1 spends a session.

### 5.2 Handling order (registered, in this exact sequence)

1. **`ScreeningSessionBudget` remains the authoritative cumulative halt.** It reserves every
   session and throws BEFORE the offending one when a reservation would breach the ceiling —
   never a warning, never a post-hoc write-off.
2. **Stage-0a's exact ledger recount replaces the estimates in §5.1.** The two ranges above are
   planning inputs, not the enforced number — the enforced number is always the live ledger sum.
3. **The degradation ladder (frozen now, §6) is the ONLY fallback when Stage-0a's recount shows
   insufficient headroom for the default path.** It is applied in order, R1 before R2 before R3;
   no rung is skipped and no rung is applied out of order.
4. **`checkBudgetBeforeStage2()` gates entry to Stage 2** (`src/bakeoff/screeningPlan.ts`): it
   refuses if Stage 1 reached its cap without a CONFIRMED advancement decision (§7), and it
   refuses if the remaining ceiling headroom is less than Stage 2's planned spend. Both refusals
   cite the same registered rule (§7).
5. **Never run Stage 1 to cap and skip Stage 2.** A campaign that spends Stage 1's full cap and
   then cannot afford Stage 2 is not a "quiet skip to Stage 3" — it is a **STOP** requiring new
   owner authorization (Stage 3's own rule, and the ladder's R3).

Costs remain `OWNER-SUPPLIED, PRICE NOT VERIFIED` (ordinal only: Luna < Terra < Sol) until a
dated, versioned price table exists (WP-E42). Dollars are never invented anywhere in this
protocol or its reports.

## 6. Degradation ladder (frozen as DATA — never computed from the live outcome)

Registered as `DEGRADATION_LADDER` in `src/bakeoff/screeningPlan.ts`. The ladder is a fixed
fallback order decided **before** any session runs; it is never re-derived to fit however the
budget crunch actually looks, and it never uses which candidate is ahead as a selection input.

| Rung | Session delta (vs. the default ~141-session path) | Action | Selection mechanism |
|---|---|---|---|
| **R1** | −4 (red-team F8 corrected: one block's D7-lite = its 3 model cells + its 1 drift unit, 12 → 8) | Drop Stage-1 D7-lite entirely for **one block** | `selectSmallestSpreadBlock()` — the block with the smallest replicate-1 E-audit spread (an information criterion: least statistical signal lost by dropping its secondary reading) |
| **R2** | −12 | Drop replicate 2 (E-audit and any surviving D7-lite) for the **SAME block R1 selected** — never a different block, and never applied without R1 first | reuses R1's selected block |
| **R3** | 0 (halt) | Halt the campaign for **new owner re-authorization** | — |

**Block-selection determinism.** `selectSmallestSpreadBlock(spreads: {block, replicate1ESpread}[])`
takes ONLY a non-negative dispersion magnitude per block — no score, no delta-vs-Sol, no winner
field exists on the input type, so the function structurally cannot select by outcome direction.
Ties break on block id ascending (lexicographic), not on array position or any signal correlated
with which model is winning. This is proved by test (`tests/bakeoff-screening-plan-experiment-budget.test.ts`
part (c)): identical spreads with an out-of-band "which model is ahead" flag flipped between two
calls still select the same block.

## 7. Rule: "Stage 1 at cap without confirmation = STOP"

> Stage 1 at cap without confirmation = STOP. Never run Stage 1 to its registered cap and then
> enter Stage 2 on an unconfirmed outcome or without headroom for Stage 2's planned spend — halt
> and escalate for re-authorization (apply the degradation ladder first) instead.

Registered as `STAGE1_AT_CAP_WITHOUT_CONFIRMATION_RULE` and enforced mechanically by
`checkBudgetBeforeStage2()`: it refuses (a) whenever Stage 1's spend reached its cap (119) without
a `decideAdvancement()` result of `ADVANCE`, and (b) whenever the remaining ceiling headroom is
less than Stage 2's planned spend, even if Stage 1 did produce a confirmed `ADVANCE`. Refusal (a)
is checked first and is never bypassed by spare budget — confirmation is not optional just because
money is left.

## 8. Frozen controls

- **Corpus manifest frozen 2026-07-17T10:12Z** — the 3 blocks (`nudge-ch03`,
  `made-to-stick-ch04`, `happiness-ch06`) were chosen before this policy existed; the Nudge
  overlap with the owner's prior (§2) is disclosed, and the Stage-2 holdout block exists
  specifically to check for that overlap biasing the result.
- Identical briefs/packets/prompt cards per arm — no candidate gets a different prompt.
- Byte-frozen plan JSON re-registered (this document's companion + WP-703's, both bound by
  freeze tests).
- `modelPolicy` role matrix fixed across arms — no per-model routing exception.
- Hermetic envelope for every authoring/rating session.
- Slot-isolated replicates — no shared working state between replicate 1 and replicate 2 of the
  same cell.
- Hash-verified resume — a resumed session re-validates against its recorded input hash before
  continuing.
- **Readability is measure-only in this lane**: a draft always completes; readability metrics are
  recorded; ship-eligibility is evaluated separately. A floor-failed candidate can win on quality
  in this experiment but cannot be promoted to production on that basis (production readability
  gating is byte-identical and untouched — WP-E31).
- The evaluator instrument itself (rubric, prompts, schemas, validators) is hash-recorded at
  Stage 0a; **any change to it after Stage 0b closes voids comparability** for every later stage.

## 9. Blinding protocol

- Blind 1-chapter packages: `eval-packages/<blindId>.json`, where
  `blindId = cf-<runHash>-<block>-<slot>`. The slot→model map is sealed in the manifest, not in
  any reviewer-visible artifact.
- Receipts stay valid under blinding — they bind to the blind package's `book_id`/`source_hash`/
  inventory, none of which require the canonical book/model identity.
- **Model identity is the secret; book identity is not.** Reader-facing metadata is an explicit
  whitelist (title, audience, purpose — what Gate 4 of the rubric needs); everything else is
  stripped: model ids, efforts, run/slot paths, timestamps, repair history.
- **Forbidden-token leak check** (fail-closed, extends the existing leak guard) scans package
  bytes + every rater-visible artifact for: `sol`, `terra`, `luna`, `gpt-5.6`, any effort string
  (`minimal`/`low`/`medium`/`high`/`xhigh`/`ultra`), and any run/session id. A hit refuses the
  dispatch — never a warning, never a redact-and-continue.
- Anchors (§4) are packaged **identically** to candidates and **interleaved** into the same
  rating stream — a rater cannot tell an anchor package from a candidate package by its shape.
- Each rater gets **one package per fresh session identity**; the adjudicator is always a fresh
  session; the blind key is preserved until the analysis (§10) is frozen — unblinding happens
  only after the decision rule has already been applied to the blind data.
- **Accepted residual (disclosed, not fixed by this protocol):** prose fingerprints are
  unscannable — a rater could in principle infer model identity from writing style; and the
  rater family may equal a candidate family (§10 below is exactly the mitigation for that case).

## 10. Judge-interaction analysis

### 10.1 (a) D7 Sol judging Sol (measurable)

Because D7-lite runs on GPT-5.6 Sol @ ultra and Sol is itself a candidate, this pairing must be
checked for self-favoring bias. Per challenger X and block b, compare:

```
δ_E   = Δ_E   / W       (the E-audit's standardized effect)
δ_D7  = Δ_D7  / 3.0     (D7-lite's standardized effect, its own legacy tolerance)
```

**Disqualifying patterns** (any one → D7-lite demoted to purely descriptive; disclosed in every
report):

| Pattern | Definition |
|---|---|
| **P1 — sign flip** | `sign(Δ_D7) ≠ sign(Δ_E)` in ≥2/3 blocks, while `\|mean(Δ_E)\| > W` (i.e. the E-audit sees a real effect and D7-lite disagrees on direction) |
| **P2 — uniform self-inflation** | `mean(δ_E − δ_D7) > 1.0`, Sol-favoring (D7-lite systematically reads better for Sol than the blind E-audit does) |
| **P3 — calibration miss** | any drill anchor — the mid-band legacy unit OR the high-band 2026-07-15 reference unit — or any drift-check unit shows `\|Δ\| > 3.0` |

The check is **one-sided by design**: it only looks for pro-Sol D7-lite bias, because that is the
direction the cost policy most needs protected against (Sol is the expensive incumbent — a bias
that favors it is the one that would silently entrench the status quo).

### 10.2 (b) Evaluator rater — PINNED Sol-ultra, same family as candidate Sol (red-team F1)

The E-audit's rater/adjudicator sessions are **pinned to `resolveD7RaterRoute()`** (GPT-5.6 Sol @
ultra through the same envelope as D7-lite) — never an ambient codex default. The primary
instrument gets protections at least as strong as the secondary one:

- **Resolved rater model is recorded per session** (envelope manifest → receipts), and the
  **uniformity rule** holds: all Stage-1/Stage-2 E-audit sessions must resolve to the SAME rater
  model; if they don't, the experiment **stratifies by resolved model and halts for an owner
  decision** — it does not silently pool sessions rated by different models.
- Family-level bias is common-mode across the three candidates and largely differences out of
  the paired Δs. The residual is **exact-model kinship** (Sol rating Sol-authored cells), which
  no second in-house instrument can measure (D7-lite shares the same family). Pre-registered
  protections: (i) the **owner blind Stage-2 read is REQUIRED**, recorded before unblinding;
  (ii) if the owner's blind ranking of the Stage-2 cells disagrees **in sign** with the
  E-ranking on the Sol-vs-winner comparison, the verdict is **INCONCLUSIVE-pending** — the owner
  decides with the disagreement on the table; (iii) the kinship limitation is stated verbatim in
  every report.
- **Under the no-Claude-rating policy, no cross-family machine judge exists for the E-audit.**
  This is the single largest validity concession in this protocol and is stated verbatim in every
  report this protocol produces — it is never omitted, softened, or buried in a footnote.

## 11. Analysis and decision rule

**Unit of analysis:** one adjudicated E per (model, block, replicate). Blind-pair (rater 1 /
rater 2) scores are **adjudication inputs only** — they are never pooled or averaged as if they
were independent observations.

**Method:** per-block paired Δ vs. Sol → across-block mean → within-model spread → worst cell →
gate rates (hard-gate failures **stay in the denominator** — a failed cell is not dropped before
computing a rate). A clustered bootstrap (resample blocks, then replicates within block) is
reported as **indicative dispersion only** — with 3 block clusters it cannot support a stable CI
(red-team F5), so **no decision rule keys on a CI**: decisions key on sign-consistency across
blocks, the worst cell, the ±W band on the mean Δ, and Stage-2 replication. **Sensitivity check:** recompute excluding chapter-strained subcriteria (3.3, 4.1, 5.2);
the winner's sign must hold under the recompute, else the result is **INCONCLUSIVE** regardless of
what the full-criteria result said.

### 11.1 Decision rules (applied in this exact order, after Stage 2)

| # | Rule |
|---|---|
| **0** | Validity preconditions (§4.3 noise check not tripped, §10.2 uniformity rule not tripped, §7 not tripped) — any failure here is **INCONCLUSIVE** before rule 1 is even evaluated. |
| **1** | **Ineligibility**: an adjudicator-confirmed candidate-attributable gate-2/3 failure in ≥2 cells disqualifies a candidate. D7-lite ALONE never disqualifies — it can only trigger inspection (a human/adjudicator look), never a unilateral disqualification. |
| **2** | **Superiority**: > W above the runner-up, with consistent signs across blocks → the candidate becomes the **provisional default + pilot candidate**. Quality wins with or without price data. |
| **3** | **Within ±W** of the runner-up: the cheaper model wins **only with** a versioned price table (WP-E42) in hand; without one, it is a quality tie → escalate to the owner. |
| **4** | **Below −W**: cannot be price-rescued — a candidate that loses by more than the band cannot win on being cheaper. |
| **5** | **No dominance** (no candidate clears rule 2, 3, or 4 cleanly): construct the Pareto frontier (quality × price-ordinal) → escalate to the owner. |
| **6** | **Nobody clears the bar**: Sol stays the production default, the experiment **STOPS**, the bar is **not moved** to manufacture a winner. |
| **7** | **D7 safety check** (only if D7-lite survived §10.1 without demotion): if the rule-2/3 winner scores below D7-lite's own 75 floor on ≥2 blocks → **INCONCLUSIVE-pending owner blind read** (this can only downgrade a result, never upgrade one). |
| **8** | **INCONCLUSIVE is a legal terminal outcome** — not a defect in the protocol, not something to be resolved by relaxing rule 0/1/7. It is reported as-is. |
| **9** | **Owner blind preference**, recorded BEFORE unblinding, is usable only inside rules 3 and 5, and for pilot sign-off. It is never itself the deciding evidence for rule 2 or rule 6. |

**Unblinding cannot change the frozen analysis.** The decision is computed on blind data under
rules 0–9 above; unblinding happens after, for reporting and for the owner-preference input to
rules 3/5/9 only.

### 11.2 INCONCLUSIVE conditions (collected)

An outcome is INCONCLUSIVE whenever any of the following holds:

- The noise STOP tripped (§4.3: `2 × SD_retest > 4.0` at Stage 0b).
- The rater-uniformity rule tripped (§10.2) and stratification could not resolve it without
  owner input.
- Rule 0's validity preconditions fail.
- The sensitivity recompute (excluding subcriteria 3.3/4.1/5.2) flips the winner's sign from the
  full-criteria result.
- Rule 7's D7 safety check fires (INCONCLUSIVE-pending owner blind read).
- Rule 8 is reached directly (no rule 1–7 branch resolved the comparison).

None of these are failures of the experiment — each is the protocol correctly refusing to assert
more certainty than the evidence supports.

## 12. What this document does NOT do

- It does not execute any live authoring, E-audit, or D7-lite session (orchestrator-owned,
  outside this WP's BUILD scope — mirrors WP-703 §13).
- It does not change the production model default. Chapter samples never certify a production
  default (§1).
- It does not perform or authorize any whole-book generation.
- It does not lower any bar, band, or floor to manufacture a result, and it does not substitute
  a model for a dropped one.
- It does not resolve the owner's 87/84/79 prior (§2) — that prior is retained as
  OWNER-SUPPLIED_PRELIMINARY context only; this experiment, once run, is what resolves the
  Sol/Terra/Luna question.
