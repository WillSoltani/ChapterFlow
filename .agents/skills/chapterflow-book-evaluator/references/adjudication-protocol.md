# Evidence-Based Adjudication Protocol

Adjudicate one book only after its primary and verification results validate independently. Use the source package, both results, [rubric-v2.md](rubric-v2.md), and [adjudicated-book.schema.json](adjudicated-book.schema.json). Do not browse, use outside knowledge, inspect other books, or make distribution-driven changes.

## Inputs and preliminary checks

Verify both records refer to the same `run_id`, `book_id`, current `source_hash`, canonical package, rubric version, and immutable source inspection. Require two valid orchestrator dispatch receipts and one pair seal bound to that source inventory. The receipts must prove distinct primary/verification job, worker-task, and worker-session identities; each result must echo its own dispatch hash; the seal's exact result and stripped-judgment hashes must match; and the two stripped judgments must differ. Independently validate each record against the inspection's exact ordered chapter ids, indices, titles, and count with `--require-full-content`. Recompute both sets of domain and overall scores. Stop and return a structured defect if the receipt chain or either input is invalid, or any source chapter lacks one full-read evidence record.

Build a comparison across all 36 exact subcriterion paths and five gate paths. Compute:

- absolute difference per subcriterion;
- mean absolute difference across all 36;
- maximum difference;
- overall-score difference;
- gate conflicts;
- conflicting factual, component, or chapter-structure findings;
- missing-evidence conflicts.

## Mandatory review depth

- Give every book at least a light adjudication pass, including matching ratings and gates.
- Reconcile the package hash and complete source inventory before considering any rating. Source drift, missing/reordered evidence, or a partial/inaccessible chapter blocks adjudication.
- For a difference of **1**, inspect both rationales and evidence, then select the better-supported anchor.
- For a difference of **2 or more**, deeply reread relevant source chapters/components.
- Deeply reread for every gate disagreement, overall-score difference above 5 points, contradictory chapter counts, conflicting QA findings, or material evidence omission.
- Reinspect a source location whenever a rater's paraphrase, locator, or factual description conflicts.

## Decision rules

1. Read both complete evaluations and the current source package. Preserve one adjudicated `read_status: full` chapter record for every inventory entry in exact source order.
2. Check each decision against the exact anchor and full-book evidence, not the rater's confidence or prose fluency.
3. Never average automatically.
4. Select the better-supported integer rating when one anchor fits better.
5. Use a half-point only when adjacent anchors remain equally supported after explicit evidence review. Never use tenths.
6. Correct an error neither rater noticed when source evidence requires it.
7. Decide each gate independently from score and apply the rubric's threshold/consequence.
8. Record a rationale for every disagreement, final value that differs from either rater, corrected source finding, and gate decision.
9. Preserve primary, verification, and final values in the audit record.
10. Recalculate all domain scores, weighted points, overall score, classification, and certification deterministically from final ratings/gates.

For a matching rating, the final record may retain the shared value with a concise note that the source and anchor were checked. For any changed rating, state which evidence controlled, why the chosen anchor fits, and why the alternative does not.

## Agreement record

For every disagreement, store:

- canonical path;
- primary, verification, and final values;
- adjudication rationale;
- whether source content was rechecked;
- concise paraphrased evidence with local locators.

List gate conflicts separately. `mean_absolute_subcriterion_difference` and `maximum_subcriterion_difference` describe the two independent inputs, not the distance from the final result. `overall_score_difference` is the absolute difference between independently recalculated input scores.

## Confidence

Derive confidence separately from quality using chapter completeness, package ambiguity, agreement, unresolved maximum disagreement, gate conflicts, evidence sufficiency, and adjudication completion.

- **High:** required completeness is 1.0; package clear; mean absolute difference ≤ 0.35; no unresolved difference > 1; no unresolved gate conflict; evidence minimums pass.
- **Medium:** required completeness is 1.0; mean absolute difference ≤ 0.75; ambiguity is limited; every material gate conflict is resolved; evidence is sufficient but uneven.
- **Low:** required completeness is still 1.0, but mean difference exceeds 0.75, package/audience ambiguity is material, or adjudicated evidence is unusually uncertain. Missing or inaccessible source content is not a low-confidence score; it blocks finalization.

Record `level`, rationale, completeness ratio, ambiguity level, and every unresolved issue. Do not adjust quality ratings because confidence is high or low.

## Final validation

Before atomically writing `raw/adjudicated/<book-id>.json`:

- preserve the complete final evaluation and all 36 final ratings;
- prove the source hash still matches and bind the record to the same immutable inspection used for both raters;
- require exact ordered coverage of every source chapter, with all chapter records marked `full` and partial/inaccessible counts equal to zero;
- preserve primary and verification comparison values;
- validate every half-point is a multiple of 0.5 from 0 through 4 and has explicit rationale;
- reconcile chapter and component findings against source;
- recompute all arithmetic and certification;
- validate agreement metrics;
- include `calibration_changes` as an empty array until cross-book calibration, or preserve later logged changes;
- validate against the adjudicated schema and source inspection with `--require-full-content --adjudicated`;
- make no cross-book comparison during this per-book phase.

After every book is adjudicated, calibration may reopen a rating only when the same anchor was demonstrably applied differently across books. Append every calibration change with `path`, `original`, `final`, `reason`, and `evidence`; do not overwrite its audit trail.
