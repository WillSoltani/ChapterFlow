# Cross-chapter anchor calibration

## Verdict

**Calibration passes.** The sole required reopening was completed for Made to Stick, Chapter 4, at `domains.learning_architecture.subcriteria.feedback_metacognitive_calibration.rating`: `1` was changed to `1.5`, the derived arithmetic was recomputed, one source-bound `calibration_changes` record was added, and the reopened adjudication was revalidated.

This calibration auditor did not edit any adjudicated JSON. No other rating change is justified by demonstrable cross-chapter inconsistency.

## Scope and method

- Compared only the three supplied standalone chapter sources and their three validated adjudicated records.
- Re-read all 32 chapter-local subcriteria in Domains 1-8 against Rubric v2.0 anchors. Domain 9 and actual-book judgments remain unassessable.
- Used no reputation, outside knowledge, prior score, or forced distribution.
- Treated every initially nonuniform rating path as potentially inconsistent. Fourteen of 32 paths were nonuniform in the first pass; the sole inconsistent path was reopened and is now uniform. The final records contain 13 nonuniform paths, each supported by qualitative evidence. The other 19 paths now use the same rating across all three records and show no anchor-application conflict.
- Applied the 1.0-point effective-tie rule to normalized chapter diagnostics. No final pair is within 1.0: Nudge 70.7565789474, The Happiness Hypothesis 68.8157894737, and Made to Stick 67.6644736842. The smallest final difference is 1.1513157895. No separation was forced.

## Records checked and hashes

All three records passed `validate_chapter_adjudication.py` against their primary and verification inputs, dispatch receipts, inspections, and pair seals. After the calibrated reopening, Made to Stick was revalidated by the root orchestrator; this closeout independently reproduced its canonical hash and recalculated every domain and the normalized diagnostic from the updated record.

| Record | Byte SHA-256 | Validator canonical SHA-256 | Bound source SHA-256 | Status |
|---|---|---|---|---|
| `/Users/radinsoltani/ChapterFlow-books/artifacts/chapterflow-chapter-audits/20260715T110908Z/raw/adjudicated/nudge-ch03.json` | `db0d0db45fbe5195e8b5f226e898aa87666fa8112af0c624ca0a753b5eaca277` | `d95a8a445db8e0d92dd418d47bc78de559070feb26f34bb2818861be84b405e6` | `5561431cdd87978ec2bd4def5cf4e2fc7ab53d8379f48e0eaaf7327a9dcaeda7` | valid |
| `/Users/radinsoltani/ChapterFlow-books/artifacts/chapterflow-chapter-audits/20260715T110908Z/raw/adjudicated/made-to-stick-ch04.json` | `66982e03651b6110c3ff767b4803f8ac83799876a2af9b638cb35467c7cf7686` | `8dd9cd81aadd1db5e64dbdebb4a3f75b429118c3e2108fa655bf6826e9e804ed` | `9a20a3afd9612faf43ea26575e0f471401c180f58fdef2bcaceedd4a54194120` | valid after calibrated reopening |
| `/Users/radinsoltani/ChapterFlow-books/artifacts/chapterflow-chapter-audits/20260715T110908Z/raw/adjudicated/the-happiness-hypothesis-ch06.json` | `3ae3ad5bb0284df53f4a3840d3a592ef7cdfc8e60783a1db6daec165288aa722` | `72e8b45c9dcc77524a426eecad4e1d022b7ddc3140b9e307af54015ce4f9dbcf` | `98fb3e50e070ca44543881613f39dbaf5c478bfff7e2aea838688f2b3d0e5dd2` | valid |

The three source hashes were independently recomputed from:

- `/Users/radinsoltani/Desktop/nudge-ch03.md`
- `/Users/radinsoltani/Desktop/made-to-stick-ch04.md`
- `/Users/radinsoltani/Desktop/the-happiness-hypothesis-ch06.md`

## Review of every nonuniform rating path

Ratings are shown as **Nudge / Made to Stick / The Happiness Hypothesis**.

| Subcriterion path under `domains.*.subcriteria.*.rating` | Ratings | Cross-chapter evidence review | Decision |
|---|---:|---|---|
| `epistemic_integrity.claim_support_fit` | 2.5 / 2.5 / 2 | Happiness makes broader physiological, developmental, and well-being claims with compressed evidential bridges (`the-happiness-hypothesis-ch06.md` lines 12, 15-21, 28-30). Nudge and Made also have empirical gaps, but more of their chapter-local teaching is framed as conditional diagnosis or claim-to-proof fit. | Difference supported; no change. |
| `epistemic_integrity.uncertainty_limitations` | 3 / 3 / 2.5 | Happiness gives timely practical exceptions (`lines 24, 34-38`) but does not integrate comparable uncertainty into the named research generalizations (`lines 15-21`). The half-step below the other two is evidence-based. | Difference supported; no change. |
| `audience_fit.beginner_onboarding` | 3 / 2.5 / 3 | Made introduces Marshall, Warren, and Laffin without the event, claim, or lived consequence needed by a novice (`made-to-stick-ch04.md` lines 21-23; Review Card 5, lines 159-161). The other two sources explain their named concepts in place. | Difference supported; no change. |
| `audience_fit.signal_noise_framework_load` | 2.5 / 2 / 2 | Made substantially restages exposition cases and adds decorative timing, room, and prop details (`lines 34-85`). Happiness duplicates the Harlow inference and carries a large component bank (`the-happiness-hypothesis-ch06.md` lines 40-149). Nudge is also repetitive (`nudge-ch03.md` lines 50-189), but has less exact duplication and less decorative load; the half-step is supportable. | Difference supported; no change. |
| `mental_model_coherence.mechanism_causal_explanation` | 3 / 3 / 2.5 | Happiness supplies a usable expected-response and return-signal mechanism but compresses the developmental bridge and does not distinguish attachment fear, regulation, incompatibility, and danger in the final action rule (`lines 15-21, 151-157`). | Difference supported; no change. |
| `mental_model_coherence.nuance_diagnostic_power` | 3 / 2 / 3 | Made distinguishes evidence routes but gives no rule for sufficiency, representativeness, conflict, corroboration, or appropriate reliance on expertise (`made-to-stick-ch04.md` lines 38-46, 163-170). Nudge supplies an information/dissent/norm-type diagnostic; Happiness separates space, abandonment, patterns, love systems, and control. | One-point difference supported; no change. |
| `learning_architecture.feedback_metacognitive_calibration` | 1.5 / 1→1.5 / 1.5 | Made and Nudge both withhold all quiz answers, but both also give six action-plus-reason worked explanations and front/back review-card self-checks. Made's original `1` credited those supports less than the same anchor pattern in Nudge. Happiness additionally includes an explicit trusted-person observation and compare/revise loop (`the-happiness-hypothesis-ch06.md` line 157). | **Resolved: Made reopened at 1.5 and logged the calibration change.** |
| `retention_retrieval.cumulative_reinforcement` | 2.5 / 2.5 / 3 | Happiness moves a coherent secure-base model through child care, contact comfort, adult patterns, conflict, retrieval, body observation, and peer-reviewed practice (`lines 11-157`). Nudge and Made vary formats but more often restage the same cases in one dense sequence. The duplicate Harlow case is a limitation, already reflected in signal/noise and vividness; it does not erase the broader task progression. | Close but qualitatively supported; no change. |
| `retention_retrieval.quiz_retrieval_depth` | 3 / 2.5 / 2 | Nudge's nine items discriminate among several mechanisms and norm types (`nudge-ch03.md` lines 92-144). Made uses new contexts but repeatedly asks for the visibly checkable option (`made-to-stick-ch04.md` lines 88-140). Happiness most often mirrors chapter language against absolute or plainly inverted distractors (`the-happiness-hypothesis-ch06.md` lines 72-124). | Graded distinction supported; no change. |
| `retention_retrieval.interference_control_consolidation` | 2.5 / 3 / 3 | Nudge shifts among overlapping lists—knowledge/fear/approval/repetition; information/approval/authority/hidden fear; and descriptive/injunctive norms—without one final mapping (`nudge-ch03.md` lines 38-48, 171-178). Made and Happiness consolidate their related concepts more explicitly. | Difference supported; no change. |
| `transfer_action_judgment.implementation_feedback_support` | 2 / 2 / 3 | Nudge and Made end mainly at diagnosis, action, or rehearsal (`nudge-ch03.md` lines 171-181; `made-to-stick-ch04.md` lines 163-173). Happiness adds barrier-specific plans, body observation, a trusted observer, comparison, and selection of a revised sentence (`the-happiness-hypothesis-ch06.md` lines 151-160). | One-point difference supported; no change. |
| `engagement_momentum.narrative_example_vividness` | 3 / 2 / 2 | Nudge's scenes are varied decisions tied to distinct mechanisms (`nudge-ch03.md` lines 51-89). Made's fixed templates add many non-diagnostic timestamps, room labels, and props (`made-to-stick-ch04.md` lines 57-85). Happiness repeats the Harlow reveal and uses similarly tidy scenario/action/lesson construction (`the-happiness-hypothesis-ch06.md` lines 41-69). | One-point difference supported; no change. |
| `engagement_momentum.emotional_relevance` | 3 / 2.5 / 3 | Made includes real safety and human stakes, but most are brief instruments for an evidence-choice exercise (`made-to-stick-ch04.md` lines 72-85, 112-134). Nudge's social cost and responsibility and Happiness's vulnerability, fear, loneliness, and repair remain more continuously integrated with their mechanisms. | Half-step difference supported; no change. |
| `engagement_momentum.instructional_alignment` | 3 / 2 / 2 | Nudge's objects and tension usually expose a mechanism or response despite repetition (`nudge-ch03.md` lines 51-89). Made includes decorative details that do not affect judgment (`made-to-stick-ch04.md` lines 57-85); Happiness duplicates a worked inference and adds substantial repeated component load (`the-happiness-hypothesis-ch06.md` lines 40-149). | One-point difference supported; no change. |

## Completed reopening

### Record

`/Users/radinsoltani/ChapterFlow-books/artifacts/chapterflow-chapter-audits/20260715T110908Z/raw/adjudicated/made-to-stick-ch04.json`

### Exact rating change

- Path: `domains.learning_architecture.subcriteria.feedback_metacognitive_calibration.rating`
- Original value: `1`
- Final calibrated value: `1.5`
- Anchor reason: anchor 1 alone is too low because the chapter supplies more than correctness labels or unsupported confidence. Six worked examples explain the intended action and causal reason, and five front/back cards permit a basic self-check. Anchor 2 alone is too high because the nine-item quiz withholds every answer and explanation and supplies no confidence check, error diagnosis, or revision guidance. The evidence therefore sits evenly between anchors 1 and 2.

### Exact source evidence

- Primary source: `/Users/radinsoltani/Desktop/made-to-stick-ch04.md`
- No-key quiz: lines 87-140.
- Six worked `What to do` / `Why it matters` explanation pairs: lines 57-85.
- Five front/back review-card self-checks: lines 142-161.
- Implementation practice without a performance-feedback loop: lines 163-173.

The decisive cross-anchor comparator is Nudge: its quiz also withholds the key (`/Users/radinsoltani/Desktop/nudge-ch03.md` lines 91-144), while six worked explanations (`lines 51-89`) and six front/back cards (`lines 146-169`) provide the same partial, indirect feedback pattern. Its adjudicated `1.5` correctly represents evidence between anchors 1 and 2. Happiness also remains correctly at `1.5`; unlike Made, it adds one explicit peer-observation and compare/revise loop (`/Users/radinsoltani/Desktop/the-happiness-hypothesis-ch06.md` line 157), but still withholds all quiz feedback.

### Verified dependent recomputation

The reopened adjudicator confirmed `1.5` and recomputed the derived values:

- `domains.learning_architecture.domain_score`: `2.5` to `2.625`
- `domains.learning_architecture.weighted_points`: `7.5` to `7.875`
- `chapter_diagnostic_score`: `67.26973684210526` to `67.66447368421052`
- `diagnostic_band`: unchanged (`Chapter diagnostic: substantial redesign needed`)
- `calibration_changes`: exactly one record, containing the path, original `1`, final `1.5`, cross-anchor reason, and evidence at Examples 1-6 lines 57-85, Quiz lines 87-140, and Review cards lines 142-161

Closeout verification reproduced byte SHA-256 `66982e03651b6110c3ff767b4803f8ac83799876a2af9b638cb35467c7cf7686` and validator-canonical SHA-256 `8dd9cd81aadd1db5e64dbdebb4a3f75b429118c3e2108fa655bf6826e9e804ed`. Independent arithmetic yielded a raw Domain 1-8 weighted total of `64.28125`, normalized to `67.66447368421052`, with no domain-score or weighted-point mismatch. The two blind records and their receipt chain remained immutable.

## Final calibration verdict

**Pass.** The three adjudications are structurally valid, source-bound, and cross-chapter calibrated. The sole demonstrable inconsistency was corrected and logged at Made to Stick's feedback/metacognitive-calibration path; the updated record's hash and arithmetic are verified. All other rating differences remain supported by qualitative chapter evidence, and no other changes are justified.
