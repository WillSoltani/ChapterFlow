# Scoring Protocol

Use this protocol with [rubric-v2.md](rubric-v2.md) and [book-evaluation.schema.json](book-evaluation.schema.json). The rubric is the normative source for definitions and anchors; the schema is the normative field/key contract.

## 1. Preserve isolation

- Read only the assigned package, its local metadata, applicable repository instructions, the rubric, and the schema.
- Do not browse or use outside knowledge, reviews, reputation, popularity, sales, awards, remembered source-book content, prior rankings, or historical scorecards.
- Do not inspect any other book or the counterpart rater output.
- Keep external factual verification disabled and mark `external_accuracy` as `not_assessed`.
- Assess support for retention, transfer, behavior change, completion, and satisfaction. Never claim those reader outcomes occurred unless supplied study data measures them.
- Paraphrase evidence. Do not reproduce full chapters or long passages.

## 2. Establish the evaluation construct

Before rating, record the declared or inferred audience, assumed prior knowledge, nonfiction type, purpose, intended outcomes, contexts/exclusions, and fit with the default ordinary interested non-expert reader. Mark the purpose/audience gate `conditional` when these are absent but defensibly inferable, and `unevaluable` for audience-dependent judgments when they cannot be inferred.

## 3. Inventory before judgment

Read metadata that controls audience, purpose, chapter order, or intended outcomes. Determine expected chapter count and inventory all reader-facing components, including fast/deep/full reads, examples, scenarios, quizzes, answer explanations, review cards, implementation plans, exercises, prompts, summaries, memorable lines, warnings, and safety notes.

Persist the current package SHA-256 and its exact ordered chapter inventory before judgment. Record missing, duplicate, malformed, displaced, ambiguous, unsupported, or inaccessible material as technical findings. Do not penalize filenames, internal identifiers, JSON formatting, or archive layout unless they prevent reading or create a reader-facing error. A technically valid semantic mismatch, such as an answer explanation for another question, is a reader-facing epistemic defect.

Automated analytics are diagnostics, never automatic scores. Where available, inspect chapter/component/word counts; exact and near duplicates; framework and acronym density; repeated timestamps or sensory props; question and answer-index validity; correct-answer versus distractor-length ratios; repeated distractor templates; chapter-local versus cumulative retrieval; missing explanations; implementation specificity; duplicate chapter titles; and unexplained terminology. Inspect the content before using any signal as evidence.

## 4. Complete the full-content pass

Read every source chapter and every reader-facing component in full. Build exactly one `read_status: full` evidence record for every entry in the immutable source inventory, preserving chapter id, index, title, and order. Never final-score from selected chapters. If any chapter is partial, inaccessible, missing, duplicated, or cannot be reconciled to the inventory, record the defect and stop as unevaluable rather than producing a weighted score.

For each chapter record:

- central ideas;
- contribution to the whole-book mental model;
- engagement and pacing;
- comprehension and learning support;
- retention and retrieval support;
- transfer and action support;
- trust, QA, or safety issues;
- concise paraphrases and precise package/chapter/section/item locators.

## 5. Assess gates separately

Assess `technical_completeness`, `epistemic_instructional_safety`, `ethics_reader_autonomy`, `purpose_audience_declaration`, and `external_accuracy` before interpreting the score. Use only `pass`, `conditional`, `fail`, `not_assessed`, or `unevaluable` for a gate. Apply every threshold in the rubric. Derive certification from gates, never from score. Report a reliable diagnostic score even when a safety or ethics gate fails, but do not fabricate a full score when central content is inaccessible.

## 6. Rate all 36 subcriteria

Use this exact ordered key map:

1. `epistemic_integrity` (15): `claim_support_fit`, `uncertainty_limitations`, `internal_consistency_qa`, `misuse_safeguards`.
2. `audience_fit` (12): `language_clarity`, `beginner_onboarding`, `signal_noise_framework_load`, `audience_context_accessibility`.
3. `mental_model_coherence` (15): `central_model`, `mechanism_causal_explanation`, `cross_concept_integration`, `nuance_diagnostic_power`.
4. `learning_architecture` (12): `sequencing_scaffolding`, `worked_examples_contrasts`, `active_processing`, `feedback_metacognitive_calibration`.
5. `retention_retrieval` (10): `meaningful_retrieval_cues`, `cumulative_reinforcement`, `quiz_retrieval_depth`, `interference_control_consolidation`.
6. `transfer_action_judgment` (15): `concrete_actions`, `cross_context_transfer`, `implementation_feedback_support`, `boundaries_adaptation_tradeoffs`.
7. `motivation_autonomy` (8): `personal_relevance`, `achievable_progress`, `autonomy_non_shaming_tone`, `calibrated_confidence`.
8. `engagement_momentum` (8): `curiosity_momentum`, `narrative_example_vividness`, `emotional_relevance`, `instructional_alignment`.
9. `whole_book_coherence` (5): `chapter_necessity_order`, `quality_consistency_pacing`, `redundancy_cumulative_load`, `synthesis_completion_value`.

Primary and verification ratings must be integers 0–4. Check the exact anchor, start at 2, and move only when package-wide evidence justifies it. A 4 requires exemplary nearly whole-book performance, difficult cases and boundaries, and no obvious material improvement. Do not use component quantity, aesthetic preference, or comparative rank as evidence. Explain weak ratings as carefully as strong ones.

For every domain, ensure the combined subcriterion evidence includes at least two chapter-level strengths and one chapter-level limitation, plus a whole-book pattern and anchor-linked rationale. Avoid reusing one example across domains unless the record explains its separate function.

## 7. Calculate and classify

Calculate with full precision:

```text
domain_score = sum(four ratings) / 4
weighted_points = (domain_score / 4) * domain_weight
overall_score = sum(nine weighted_points)
```

Weights must total 100. Apply the interpretation bands in the rubric. A 90–100 score becomes `Reference-standard design` only when certification is `pass` and every core domain 1–6 is at least 3.0. Otherwise use a truthful non-reference classification and record why. Do not round intermediate arithmetic.

## 8. Complete analysis and self-validation

Describe likely reader experience without claiming measured outcomes. Supply strongest and weakest qualities, an engagement curve, comprehension/retention-support analysis, practical-use/judgment analysis, best-fit and struggling readers, exactly three highest-impact improvements, and a two- or three-sentence verdict.

Before writing atomically, verify:

- the current source hash matches the immutable inspection;
- every source chapter and reader-facing component was read in full;
- expected, full-read, and evidence-record counts equal the exact source inventory length, with partial and inaccessible counts equal to zero;
- chapter evidence ids, indices, titles, and order exactly match the source inventory;
- all nine domains and all 36 subcriteria are present;
- independent ratings are integers 0–4;
- evidence minimums and locators pass;
- all five gates and certification agree;
- domain and overall arithmetic recomputes exactly;
- exactly three improvements exist;
- no outside-verification or measured-outcome claim appears;
- JSON validates against the supplied schema.

## 9. Confidence after adjudication

Confidence is separate from quality and never changes the score.

- **High:** required chapter completeness is 100%; package structure is clear; mean absolute subcriterion difference ≤ 0.35; no unresolved difference > 1; no unresolved gate conflict; evidence minimums pass.
- **Medium:** required chapter completeness is 100%; mean absolute difference ≤ 0.75; ambiguities are limited; adjudication resolves every material gate conflict; evidence is sufficient but uneven.
- **Low:** required chapter completeness is still 100%, but mean absolute difference > 0.75 or package/audience ambiguity remains material after adjudication. Inaccessible content, incomplete evidence, or failed adjudication blocks scoring instead of producing a low-confidence result.

Record the inputs and rationale rather than relying on the label alone.

## 10. Cross-book calibration

Calibrate only after every book has an individual adjudicated record. Compare anchor application and evidence, never reputation or preference. Check score inflation, unjustified clustering, and inconsistent use of 4. Reopen only a demonstrably inconsistent rating. Do not force separation or a distribution. Log each original value, final value, source evidence, and reason. Treat books within 1.0 point as effectively tied unless qualitative evidence makes a meaningful distinction.
