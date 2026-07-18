# Chapter rater record contract

Write one valid JSON object with these top-level fields:

- `schema_version`: `1.0.0`
- `artifact_type`: `chapterflow_standalone_chapter_rating`
- `run_id`, `job_id`, `rater_role`, `worker_task_id`, `worker_session_id`
- `worker_dispatch_receipt_sha256`
- `book`: object containing the audit-unit `book_id` and source-book title inferred only from the filename/content
- `source_hash`: exact assigned source SHA-256
- `chapter`: `chapter_id`, `number`, `title`, `source_path`, `heading_inventory_sha256`, `read_status: full`, plus a `section_inventory` array covering every H2/H3 reader-facing section inspected
- `scope`: object with `scope_type: standalone_chapter_audit`, `actual_book_inventory_complete: false`, `full_book_score: null`, `full_book_certification: unevaluable`, and `domain_9: unassessable`
- `evaluation_construct`: audience, prior knowledge, nonfiction type, purpose, intended outcomes, contexts/exclusions, and default-reader fit
- `gates`: chapter artifact completeness, epistemic/instructional safety, ethics/autonomy, purpose/audience declaration, external accuracy, and actual-book completeness. External accuracy is `not_assessed`; actual-book completeness is `unevaluable`.
- `domains`: exactly the eight domains and 32 subcriteria below
- `chapter_diagnostic_score`, `diagnostic_band`
- `strongest_qualities`, `weakest_qualities`, `engagement_curve`, `comprehension_retention_analysis`, `practical_use_judgment_analysis`, `best_fit_readers`, `struggling_readers`
- `improvements`: exactly three ordered objects with action, rationale, and local locators
- `verdict`: two or three sentences

Each domain record must contain its original rubric `weight`, four subcriterion records, `domain_score`, `weighted_points`, at least two distinct strengths, at least one limitation, a within-chapter pattern, anchor-linked rationale, and a scope note. Each subcriterion record contains an integer `rating` from 0 through 4, anchor-linked rationale, and one or more precise local locator/paraphrase evidence objects.

Exact domain/subcriterion map:

1. `epistemic_integrity` (15): `claim_support_fit`, `uncertainty_limitations`, `internal_consistency_qa`, `misuse_safeguards`
2. `audience_fit` (12): `language_clarity`, `beginner_onboarding`, `signal_noise_framework_load`, `audience_context_accessibility`
3. `mental_model_coherence` (15): `central_model`, `mechanism_causal_explanation`, `cross_concept_integration`, `nuance_diagnostic_power`
4. `learning_architecture` (12): `sequencing_scaffolding`, `worked_examples_contrasts`, `active_processing`, `feedback_metacognitive_calibration`
5. `retention_retrieval` (10): `meaningful_retrieval_cues`, `cumulative_reinforcement`, `quiz_retrieval_depth`, `interference_control_consolidation`
6. `transfer_action_judgment` (15): `concrete_actions`, `cross_context_transfer`, `implementation_feedback_support`, `boundaries_adaptation_tradeoffs`
7. `motivation_autonomy` (8): `personal_relevance`, `achievable_progress`, `autonomy_non_shaming_tone`, `calibrated_confidence`
8. `engagement_momentum` (8): `curiosity_momentum`, `narrative_example_vividness`, `emotional_relevance`, `instructional_alignment`

Arithmetic:

```text
domain_score = sum(four ratings) / 4
weighted_points = (domain_score / 4) * domain_weight
chapter_diagnostic_score = sum(weighted_points for Domains 1-8) / 95 * 100
```

Use full precision in JSON. The diagnostic band follows the rubric thresholds descriptively, but must be prefixed or worded as a chapter diagnostic, never as a full-book certification.
