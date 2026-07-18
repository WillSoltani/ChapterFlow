# V25 Owner Rubric Reconciliation — D3 Spot-Check Outcome (2026-07-15)

## What happened

Per D3, the owner spot-checked 3 of the 10 selected reader-acceptable controls
(`made-to-stick-ch04.md`, `the-happiness-hypothesis-ch06.md`, `nudge-ch03.md`) and
returned two inputs:

1. **A direct product observation:** the three read layers (Fast/Deep/Full read) are
   written as a serial sequence — each assumes the previous — when the product intent
   is three independent renditions at increasing depth.
2. **An instrumented chapter audit** of the same 3 files under the
   *ChapterFlow Evidence, Learning, and Reader Experience Rubric v2.0*
   (two mutually blind raters + fresh adjudicator; evidence preserved at
   `docs/v25/rubric-audit-2026-07-15/`; rubric anchors at
   `.agents/skills/chapterflow-book-evaluator/references/rubric-v2.md`), scoring:

| Chapter | Internal agreed composite (A/B adjudication) | Owner rubric chapter diagnostic | Rubric band |
|---|---:|---:|---|
| made-to-stick-ch04 | 89.95 | 67.7 | Substantial redesign needed |
| the-happiness-hypothesis-ch06 | 87.10 | 68.8 | Substantial redesign needed |
| nudge-ch03 | 86.95 | 70.8 | Targeted redesign needed |

Rubric bands: 90–100 reference-standard · 80–89.9 strong · 70–79.9 targeted redesign
· 60–69.9 substantial redesign. The owner's bar for gold-corpus chapters: **a high
rating on this rubric.** All three land in the bottom two bands.

## Verdict

**D3 spot-check: REJECTED — SYSTEMIC.** The pre-agreed fallback (promote
`the-happiness-hypothesis-ch01`, re-flag, one more round) is moot: the rejection is
not chapter-idiosyncratic. Every chapter in the pool shares the same house format and
the same recurring defects. **The `reader-acceptable-controls.v1` corpus is NOT frozen
as gold.** The file remains retained evidence (immutable) and is re-designated a
candidate source of *adjudicated craft-defect ground truth*, not an acceptability
anchor at the owner bar.

## Verification performed (read-only, zero model calls)

Three independent checks against the actual artifacts:

### V-1. Read-layer serialization — CONFIRMED, systemic (5/5 docs sampled)

Sampled `nudge-ch03`, `made-to-stick-ch04`, `the-happiness-hypothesis-ch06`,
`made-to-stick-ch01`, `the-happiness-hypothesis-ch04`:

- **5/5 Deep reads open as direct continuations of the Fast read** ("Rachel's proof
  works because…", "Megan's board works…", "Addison sees the mechanism…") — none
  re-establishes its own context.
- **4/5 Full reads presume earlier layers** (definite-article back-references to the
  Fast read's scenes; "Those three patterns" enumerated only in the Deep read).
- **Second failure mode:** layer openers reference characters introduced only in the
  Examples section *below* them (Addison, Marlowe, Charlotte, Perry, Scarlett, the
  float nurse) — forward dependence in addition to backward.
- Layers are **complementary slices, not depth renditions**: Fast carries the core
  claim, Deep carries one set of studies, Full a different set. A Full-only reader
  loses whole mechanisms (e.g. Asch/pluralistic ignorance in nudge-ch03).

**Live-product exposure:** the reader UI renders exactly ONE layer at a time.
Learning Mode maps Guided→fastRead, Standard→deepRead, Challenge→fullRead
(`ChapterReaderClient.tsx:85-89`, `:340-342`); the other layers are never in the DOM;
new readers default to the fast path. So every Standard/Challenge-mode reader of a
v21 book today receives a layer with unresolved references and partial content. This
is a live content defect across the shipped v21 corpus, not an audit nit.

### V-2. Quiz feedback data — the audit's biggest deduction was partly a rendering artifact

The spot-check/audit files were the **key-stripped adjudication renderings**
(deliberately key-free for blind reader-review adjudication; header literally says
"Quiz (answer key withheld)"). The real v21 packages carry, per question:
`choices[3]`, `correctIndex`, and a ~2-sentence `explanation` (sentence 1 justifies
the correct answer; sentence 2 usually dismisses the distractors collectively —
made-to-stick does this 8/9, nudge/happiness roughly half). The live app delivers a
real feedback loop: immediate server-checked correct/incorrect, per-mode retries,
explanation on final-wrong, post-submit mistakes review revealing the correct answer,
score ring (`QuizPanel.tsx:159-592`).

What genuinely does NOT exist anywhere in package or app: **per-distractor
diagnosis keyed to each wrong choice, confidence prompts, and revisit guidance**
(quiz ↔ reviewCards ↔ breakdown are structurally disconnected; full key-scan of all
three packages found zero feedback-adjacent fields beyond `explanation`).

**Corrected-score bound:** re-crediting `feedback_metacognitive_calibration`
(1.5→~3.0), `calibrated_confidence` (2.0→~2.5) and quiz-depth key effects yields
roughly **+1.4 to +1.8 normalized points** per chapter → corrected ≈ 69.5 / 70.6 /
72.2. **The verdict is unchanged** — still the bottom two bands, nowhere near the
gold bar.

**Counter-distortion:** the audit read the markdown with all three layers stacked, so
it *praised* the serial sequencing as good scaffolding ("Hook through Deep read
prepares a novice"). In the app's one-layer-at-a-time rendering the true
onboarding/coherence experience for Standard/Challenge readers is *worse* than
audited. The two rendering distortions partially cancel; the band conclusion is
robust in both directions.

### V-3. Construct gap — the internal reader composite does not measure the owner construct

- Gap: 16–22 points on all three; internal ranking is exactly **inverted** vs the
  rubric ranking (weak evidence alone — both spreads ≈3 points — but consistent with
  construct disjointness).
- The rubric's failing dimensions (feedback/metacognitive calibration, cognitive
  economy/signal-to-noise, evidence qualification, implementation-loop closure,
  layer independence) are **dimensions the reader-review lane does not score**. Both
  adjudicator families (Claude AND gpt-5.6-sol) independently scored these chapters
  86.95–89.95 because they were scoring narrative craft + blockers — correctly, per
  their instrument. The instruments measure different things; the reader lane cannot
  be blamed for, nor trusted with, the owner-bar quality construct.

## Systemic defect inventory (converged: audit × owner × verification)

| # | Defect | Source | Status |
|---|---|---|---|
| S-1 | Read layers serial + complementary, app renders one layer only | Authoring format | **Live product defect**, highest priority |
| S-2 | No per-distractor rationale, confidence prompt, or revisit link in quiz data | Package schema + authoring | Real gap (key itself EXISTS — audit artifact) |
| S-3 | Massed repetition: same cases restaged across examples/quiz/cards/closers; fixed Scenario/What-to-do/Why-it-matters mold; decorative props | Authoring (known house-mold issue) | Real |
| S-4 | Named studies asserted without method/magnitude/limits/competing explanations | Authoring | Real |
| S-5 | Implementation plans stop at initiation — no observe→evaluate→revise/stop branch | Authoring format | Real |
| S-6 | Overlapping taxonomies never reconciled into one stable map (nudge four-part lists) | Authoring | Real |
| S-7 | Named references without local context (Marshall/Warren/Laffin) | Authoring | Real |
| S-8 | Duplicate case staging (Harlow wire/cloth twice in happiness-ch06) | Authoring QC | Real |

## Proposed amendments (PENDING OWNER RATIFICATION — not yet in force)

- **D7 — Gold bar = rubric v2.0.** A gold-corpus chapter must score **≥ 85** chapter
  diagnostic (owner may set 80/85/90) with certification `pass` and no core domain
  below 3.0, audited by the owner's instrumented protocol (blind pair + adjudicator)
  on **app-faithful renderings** (answer key + explanations included; audited
  per-layer or with the layer model declared). The audit machinery already exists
  (`.agents/skills/chapterflow-book-evaluator/` + `artifacts/chapterflow-chapter-audits/`
  runners) and is adopted as the gate instrument.
- **D8 — v25 authoring format upgrades** (requirements the SOL pilot writers must
  satisfy, each testable at review time):
  1. **Layer independence:** each of Fast/Deep/Full is fully self-contained — own
     hook/context, no cross-layer or forward anaphora, characters introduced
     in-layer, and each layer carries the complete core lesson at its depth
     (deeper = superset in insight, not a different slice).
  2. **Quiz feedback block:** per-question per-distractor rationale + revisit pointer
     (to a breakdown section or review card) + optional confidence prompt (additive
     schema fields; app can adopt progressively).
  3. **Cognitive economy:** a case may be restaged at most once; one consolidation
     map replaces repeated restatements; closing components capped.
  4. **Evidence-and-limits bridge:** every named study/claim states what was observed
     vs inferred vs recommended + one boundary condition.
  5. **Implementation loop closure:** if-then plans plus an observe→evaluate→
     revise/stop step with a concrete check.
  6. **One stable taxonomy** per chapter; no unreconciled overlapping lists.
  7. **Named references get one-line local context.**
  8. **Ambiguity quota:** ≥2 worked cases that are mixed-signal/failure/edge cases,
     not clean successes.
- **D9 — Phase-3 re-scope.** The readiness instrument proceeds as a *reviewer*
  qualification instrument (blockers + craft-detection, pipeline-internal constructs)
  but its corpus is re-labeled accordingly; "acceptable at the owner bar" anchors are
  DEFERRED until D8-format exemplars exist. The rubric-v2 audit becomes the separate
  ship gate for pilot/gold chapters (D7). The three audited chapters' adjudicated
  defect inventories become candidate craft-detection cases with real ground truth.
- **D10 (flag, separate scope) — shipped v21 corpus exposure:** Standard/Challenge
  readers receive serialized layers today across the live catalog. Owner decision
  needed on mitigation (app-side rendering change vs content regeneration vs
  accepting fast-path default exposure). Not a v25-pipeline work item.

## Immediate effects (in force now)

- Corpus freeze **WITHHELD**; ratification flags in
  `reader-acceptable-controls.v1.json` remain ungranted; file immutable as evidence.
- Phase 3 build is **PAUSED** pending D7–D9 ratification.
- No thresholds, retained evidence, or closed identities were modified.
- Zero live model calls were used for this reconciliation.
