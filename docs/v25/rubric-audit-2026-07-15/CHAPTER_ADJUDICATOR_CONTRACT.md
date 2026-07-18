# Chapter adjudicator record contract

The adjudicator receives exactly one source chapter, its inspection, the two independently validated rater records, their two dispatch receipts, and the sealed pair receipt. It must follow the evidence-based adjudication protocol and the standalone audit scope.

Start from the chapter-rater record contract, with these changes:

- `artifact_type`: `chapterflow_standalone_chapter_adjudication`
- `job_id`: the assigned adjudication job id
- `rater_role`: `adjudicated`
- include the assigned `worker_task_id` and `worker_session_id`
- replace `worker_dispatch_receipt_sha256` with `blind_pair_seal_sha256`
- preserve the exact source, inspection, section inventory, scope limitations, construct, gates, analysis fields, exactly three improvements, and two- or three-sentence verdict
- every final subcriterion `rating` is a multiple of 0.5 from 0 through 4
- include `rater_agreement`, `confidence`, and `calibration_changes: []`

For all 32 subcriteria, independently inspect the source and select the best-supported anchor. Never average automatically. Where the blind ratings match, still verify the source and anchor. Where they differ by 1, compare both rationales and evidence. Where they differ by 2 or more, deeply reread the implicated source components. Use a half-point only when adjacent anchors remain equally supported after source review.

`rater_agreement` must contain:

- `mean_absolute_subcriterion_difference` across the 32 blind ratings
- `maximum_subcriterion_difference`
- `chapter_diagnostic_score_difference`
- `gate_conflicts`
- `disagreements`: one record for every rating disagreement, with canonical path, primary value, verification value, final value, rationale, `source_rechecked`, and local evidence
- `input_records`: canonical SHA-256 values for primary and verification

`confidence` is confidence in this chapter-only adjudication, never in full-book quality. Record `level`, rationale, supplied-chapter completeness ratio (1.0), actual-book ambiguity (`material`), and unresolved issues. The actual book remains unscoreable regardless of agreement.

Recompute every domain score, weighted point, and normalized chapter diagnostic deterministically from the final values. Do not compare with the other two books during per-chapter adjudication.
