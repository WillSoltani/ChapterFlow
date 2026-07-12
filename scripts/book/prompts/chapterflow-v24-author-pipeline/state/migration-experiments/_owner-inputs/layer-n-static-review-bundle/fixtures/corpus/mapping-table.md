# C1 Stage-Q Layer-N / Layer-O Mapping Table

Owner corpus: `s16-stage-q-owner-delegated-2026-07-11` (64 cases). Layer-N native corpus:
`s16-stage-q-layer-n-PENDING-RATIFICATION-v1`. Every Layer-N item carries
`labelProvenance: "synthetic-seed"` (owner labels not yet ratified).

Text-intrinsic subset mapped to Layer N: **40 owner cases across 5 classes**
(clean-control, sourced-fabrication, ambiguous-constructed, structural-clone, prompt-injection).
**24 owner cases are Layer-O only** (causal ×8, quiz ×8, reviewer-complaint ×8).

The native format (`validateQualCorpus`) requires all eight adversarial classes. The three
classes the owner corpus covers only via contract-/key-/review-dependent cases are filled by
the repo's own canonical synthetic seeds, as three extra `SEED-*` items (not owner cases):
`SEED-causal-overreach`, `SEED-two-valid-answer-quiz`, `SEED-unsupported-complaint-bait`.

| caseId | category | Layer-N mapped? | embedding target fields | anchor survives? | reason if Layer-O-only |
|---|---|---|---|---|---|
| SQ-001 | CLEAN_CONTROL | yes | breakdown.fullRead (CANDIDATE text) | n/a (clean control — expected:[]) |  |
| SQ-002 | CLEAN_CONTROL | yes | breakdown.fullRead (CANDIDATE text) | n/a (clean control — expected:[]) |  |
| SQ-003 | CLEAN_CONTROL | yes | breakdown.fullRead (CANDIDATE text) | n/a (clean control — expected:[]) |  |
| SQ-004 | CLEAN_CONTROL | yes | breakdown.fullRead (CANDIDATE text) | n/a (clean control — expected:[]) |  |
| SQ-005 | CLEAN_CONTROL | yes | breakdown.fullRead (CANDIDATE text) | n/a (clean control — expected:[]) |  |
| SQ-006 | CLEAN_CONTROL | yes | breakdown.fullRead (CANDIDATE text) | n/a (clean control — expected:[]) |  |
| SQ-007 | CLEAN_CONTROL | yes | breakdown.fullRead (CANDIDATE text) | n/a (clean control — expected:[]) |  |
| SQ-008 | CLEAN_CONTROL | yes | breakdown.fullRead (CANDIDATE text) | n/a (clean control — expected:[]) |  |
| SQ-009 | SOURCED_FABRICATION_OR_INVENTED_HISTORY | yes | breakdown.fullRead (CANDIDATE invented scene) | yes (gold span mat=1) |  |
| SQ-010 | SOURCED_FABRICATION_OR_INVENTED_HISTORY | yes | breakdown.fullRead (CANDIDATE invented scene) | yes (gold span mat=1) |  |
| SQ-011 | SOURCED_FABRICATION_OR_INVENTED_HISTORY | yes | breakdown.fullRead (CANDIDATE invented scene) | yes (gold span mat=1) |  |
| SQ-012 | SOURCED_FABRICATION_OR_INVENTED_HISTORY | yes | breakdown.fullRead (CANDIDATE invented scene) | yes (gold span mat=1) |  |
| SQ-013 | SOURCED_FABRICATION_OR_INVENTED_HISTORY | yes | breakdown.fullRead (CANDIDATE invented scene) | yes (gold span mat=1) |  |
| SQ-014 | SOURCED_FABRICATION_OR_INVENTED_HISTORY | yes | breakdown.fullRead (CANDIDATE invented scene) | yes (gold span mat=1) |  |
| SQ-015 | SOURCED_FABRICATION_OR_INVENTED_HISTORY | yes | breakdown.fullRead (CANDIDATE invented scene) | yes (gold span mat=1) |  |
| SQ-016 | SOURCED_FABRICATION_OR_INVENTED_HISTORY | yes | breakdown.fullRead (CANDIDATE invented scene) | yes (gold span mat=1) |  |
| SQ-017 | AMBIGUOUS_SOURCE_REGISTER | yes | examples[0].scenario (CANDIDATE) | yes (gold span mat=1) |  |
| SQ-018 | AMBIGUOUS_SOURCE_REGISTER | yes | examples[0].scenario (CANDIDATE) | yes (gold span mat=1) |  |
| SQ-019 | AMBIGUOUS_SOURCE_REGISTER | yes | examples[0].scenario (CANDIDATE) | yes (gold span mat=1) |  |
| SQ-020 | AMBIGUOUS_SOURCE_REGISTER | yes | examples[0].scenario (CANDIDATE) | yes (gold span mat=1) |  |
| SQ-021 | AMBIGUOUS_SOURCE_REGISTER | yes | examples[0].scenario (CANDIDATE) | yes (gold span mat=1) |  |
| SQ-022 | AMBIGUOUS_SOURCE_REGISTER | yes | examples[0].scenario (CANDIDATE) | yes (gold span mat=1) |  |
| SQ-023 | AMBIGUOUS_SOURCE_REGISTER | yes | examples[0].scenario (CANDIDATE) | yes (gold span mat=1) |  |
| SQ-024 | AMBIGUOUS_SOURCE_REGISTER | yes | examples[0].scenario (CANDIDATE) | yes (gold span mat=1) |  |
| SQ-025 | UNSUPPORTED_CAUSAL_MECHANISM | NO (Layer-O only) | — | — | Contract-dependent: judged against a VERIFICATION_CONTRACT / CLAIM_VERIFICATION_RECORD; gold evidence is the locator + verification record (mat=0), not chapter prose. No candidate-side chapter text to embed. |
| SQ-026 | UNSUPPORTED_CAUSAL_MECHANISM | NO (Layer-O only) | — | — | Contract-dependent: judged against a VERIFICATION_CONTRACT / CLAIM_VERIFICATION_RECORD; gold evidence is the locator + verification record (mat=0), not chapter prose. No candidate-side chapter text to embed. |
| SQ-027 | UNSUPPORTED_CAUSAL_MECHANISM | NO (Layer-O only) | — | — | Contract-dependent: judged against a VERIFICATION_CONTRACT / CLAIM_VERIFICATION_RECORD; gold evidence is the locator + verification record (mat=0), not chapter prose. No candidate-side chapter text to embed. |
| SQ-028 | UNSUPPORTED_CAUSAL_MECHANISM | NO (Layer-O only) | — | — | Contract-dependent: judged against a VERIFICATION_CONTRACT / CLAIM_VERIFICATION_RECORD; gold evidence is the locator + verification record (mat=0), not chapter prose. No candidate-side chapter text to embed. |
| SQ-029 | UNSUPPORTED_CAUSAL_MECHANISM | NO (Layer-O only) | — | — | Contract-dependent: judged against a VERIFICATION_CONTRACT / CLAIM_VERIFICATION_RECORD; gold evidence is the locator + verification record (mat=0), not chapter prose. No candidate-side chapter text to embed. |
| SQ-030 | UNSUPPORTED_CAUSAL_MECHANISM | NO (Layer-O only) | — | — | Contract-dependent: judged against a VERIFICATION_CONTRACT / CLAIM_VERIFICATION_RECORD; gold evidence is the locator + verification record (mat=0), not chapter prose. No candidate-side chapter text to embed. |
| SQ-031 | UNSUPPORTED_CAUSAL_MECHANISM | NO (Layer-O only) | — | — | Contract-dependent: judged against a VERIFICATION_CONTRACT / CLAIM_VERIFICATION_RECORD; gold evidence is the locator + verification record (mat=0), not chapter prose. No candidate-side chapter text to embed. |
| SQ-032 | UNSUPPORTED_CAUSAL_MECHANISM | NO (Layer-O only) | — | — | Contract-dependent: judged against a VERIFICATION_CONTRACT / CLAIM_VERIFICATION_RECORD; gold evidence is the locator + verification record (mat=0), not chapter prose. No candidate-side chapter text to embed. |
| SQ-033 | QUIZ_MECHANISM_OR_KEY_DEFECT | NO (Layer-O only) | — | — | Key-dependent: defect is a cross-instance relabel where prompt+choices+key are identical and only the answer-key EXPLANATION swaps a chapter label. Gold anchors are those explanations, which phase-1 never renders — defect requires the key. |
| SQ-034 | QUIZ_MECHANISM_OR_KEY_DEFECT | NO (Layer-O only) | — | — | Key-dependent: defect is a cross-instance relabel where prompt+choices+key are identical and only the answer-key EXPLANATION swaps a chapter label. Gold anchors are those explanations, which phase-1 never renders — defect requires the key. |
| SQ-035 | QUIZ_MECHANISM_OR_KEY_DEFECT | NO (Layer-O only) | — | — | Key-dependent: defect is a cross-instance relabel where prompt+choices+key are identical and only the answer-key EXPLANATION swaps a chapter label. Gold anchors are those explanations, which phase-1 never renders — defect requires the key. |
| SQ-036 | QUIZ_MECHANISM_OR_KEY_DEFECT | NO (Layer-O only) | — | — | Key-dependent: defect is a cross-instance relabel where prompt+choices+key are identical and only the answer-key EXPLANATION swaps a chapter label. Gold anchors are those explanations, which phase-1 never renders — defect requires the key. |
| SQ-037 | QUIZ_MECHANISM_OR_KEY_DEFECT | NO (Layer-O only) | — | — | Key-dependent: defect is a cross-instance relabel where prompt+choices+key are identical and only the answer-key EXPLANATION swaps a chapter label. Gold anchors are those explanations, which phase-1 never renders — defect requires the key. |
| SQ-038 | QUIZ_MECHANISM_OR_KEY_DEFECT | NO (Layer-O only) | — | — | Key-dependent: defect is a cross-instance relabel where prompt+choices+key are identical and only the answer-key EXPLANATION swaps a chapter label. Gold anchors are those explanations, which phase-1 never renders — defect requires the key. |
| SQ-039 | QUIZ_MECHANISM_OR_KEY_DEFECT | NO (Layer-O only) | — | — | Key-dependent: defect is a cross-instance relabel where prompt+choices+key are identical and only the answer-key EXPLANATION swaps a chapter label. Gold anchors are those explanations, which phase-1 never renders — defect requires the key. |
| SQ-040 | QUIZ_MECHANISM_OR_KEY_DEFECT | NO (Layer-O only) | — | — | Key-dependent: defect is a cross-instance relabel where prompt+choices+key are identical and only the answer-key EXPLANATION swaps a chapter label. Gold anchors are those explanations, which phase-1 never renders — defect requires the key. |
| SQ-041 | UNSUPPORTED_REVIEWER_COMPLAINT | NO (Layer-O only) | — | — | Judges a REVIEW_FINDING's validity (score-only, no chapter rationale), not chapter content; gold evidence quotes the review finding (mat=0). Nothing candidate-side to embed. |
| SQ-042 | UNSUPPORTED_REVIEWER_COMPLAINT | NO (Layer-O only) | — | — | Judges a REVIEW_FINDING's validity (score-only, no chapter rationale), not chapter content; gold evidence quotes the review finding (mat=0). Nothing candidate-side to embed. |
| SQ-043 | UNSUPPORTED_REVIEWER_COMPLAINT | NO (Layer-O only) | — | — | Judges a REVIEW_FINDING's validity (score-only, no chapter rationale), not chapter content; gold evidence quotes the review finding (mat=0). Nothing candidate-side to embed. |
| SQ-044 | UNSUPPORTED_REVIEWER_COMPLAINT | NO (Layer-O only) | — | — | Judges a REVIEW_FINDING's validity (score-only, no chapter rationale), not chapter content; gold evidence quotes the review finding (mat=0). Nothing candidate-side to embed. |
| SQ-045 | UNSUPPORTED_REVIEWER_COMPLAINT | NO (Layer-O only) | — | — | Judges a REVIEW_FINDING's validity (score-only, no chapter rationale), not chapter content; gold evidence quotes the review finding (mat=0). Nothing candidate-side to embed. |
| SQ-046 | UNSUPPORTED_REVIEWER_COMPLAINT | NO (Layer-O only) | — | — | Judges a REVIEW_FINDING's validity (score-only, no chapter rationale), not chapter content; gold evidence quotes the review finding (mat=0). Nothing candidate-side to embed. |
| SQ-047 | UNSUPPORTED_REVIEWER_COMPLAINT | NO (Layer-O only) | — | — | Judges a REVIEW_FINDING's validity (score-only, no chapter rationale), not chapter content; gold evidence quotes the review finding (mat=0). Nothing candidate-side to embed. |
| SQ-048 | UNSUPPORTED_REVIEWER_COMPLAINT | NO (Layer-O only) | — | — | Judges a REVIEW_FINDING's validity (score-only, no chapter rationale), not chapter content; gold evidence quotes the review finding (mat=0). Nothing candidate-side to embed. |
| SQ-049 | STRUCTURAL_CLONE | yes | examples[0].scenario + examples[1].scenario (EXAMPLE_A, EXAMPLE_B) | yes (gold span mat=0) |  |
| SQ-050 | STRUCTURAL_CLONE | yes | examples[0].scenario + examples[1].scenario (EXAMPLE_A, EXAMPLE_B) | yes (gold span mat=0) |  |
| SQ-051 | STRUCTURAL_CLONE | yes | examples[0].scenario + examples[1].scenario (EXAMPLE_A, EXAMPLE_B) | yes (gold span mat=0) |  |
| SQ-052 | STRUCTURAL_CLONE | yes | examples[0].scenario + examples[1].scenario (EXAMPLE_A, EXAMPLE_B) | yes (gold span mat=0) |  |
| SQ-053 | STRUCTURAL_CLONE | yes | examples[0].scenario + examples[1].scenario (EXAMPLE_A, EXAMPLE_B) | yes (gold span mat=0) |  |
| SQ-054 | STRUCTURAL_CLONE | yes | examples[0].scenario + examples[1].scenario (EXAMPLE_A, EXAMPLE_B) | yes (gold span mat=0) |  |
| SQ-055 | STRUCTURAL_CLONE | yes | examples[0].scenario + examples[1].scenario (EXAMPLE_A, EXAMPLE_B) | yes (gold span mat=0) |  |
| SQ-056 | STRUCTURAL_CLONE | yes | examples[0].scenario + examples[1].scenario (EXAMPLE_A, EXAMPLE_B) | yes (gold span mat=0) |  |
| SQ-057 | PROMPT_INJECTION_IN_UNTRUSTED_DATA | yes | examples[0].scenario (UNTRUSTED_ARTIFACT) + injectionMarker | yes (gold span mat=0) |  |
| SQ-058 | PROMPT_INJECTION_IN_UNTRUSTED_DATA | yes | examples[0].scenario (UNTRUSTED_ARTIFACT) + injectionMarker | yes (gold span mat=0) |  |
| SQ-059 | PROMPT_INJECTION_IN_UNTRUSTED_DATA | yes | examples[0].scenario (UNTRUSTED_ARTIFACT) + injectionMarker | yes (gold span mat=0) |  |
| SQ-060 | PROMPT_INJECTION_IN_UNTRUSTED_DATA | yes | examples[0].scenario (UNTRUSTED_ARTIFACT) + injectionMarker | yes (gold span mat=0) |  |
| SQ-061 | PROMPT_INJECTION_IN_UNTRUSTED_DATA | yes | examples[0].scenario (UNTRUSTED_ARTIFACT) + injectionMarker | yes (gold span mat=0) |  |
| SQ-062 | PROMPT_INJECTION_IN_UNTRUSTED_DATA | yes | examples[0].scenario (UNTRUSTED_ARTIFACT) + injectionMarker | yes (gold span mat=0) |  |
| SQ-063 | PROMPT_INJECTION_IN_UNTRUSTED_DATA | yes | examples[0].scenario (UNTRUSTED_ARTIFACT) + injectionMarker | yes (gold span mat=0) |  |
| SQ-064 | PROMPT_INJECTION_IN_UNTRUSTED_DATA | yes | examples[0].scenario (UNTRUSTED_ARTIFACT) + injectionMarker | yes (gold span mat=0) |  |
| SEED-causal-overreach | (repo synthetic seed) | seed-fill | chapter.hook | yes ("the memo alone caused the turnaround") | fills causal-overreach: owner causal cases are Layer-O (contract-dependent). |
| SEED-two-valid-answer-quiz | (repo synthetic seed) | seed-fill | chapter.hook | yes ("two defensible answers") | fills two-valid-answer-quiz: owner quiz cases are Layer-O (key-dependent). |
| SEED-unsupported-complaint-bait | (repo synthetic seed) | seed-fill | chapter.hook | n/a (clean bait — expected:[]) | fills unsupported-complaint-bait: owner reviewer cases are Layer-O (judge a review finding). |

## Layer-N class counts

- clean-control: 8
- sourced-fabrication: 8
- ambiguous-constructed: 8
- structural-clone: 8
- prompt-injection: 8
- causal-overreach: 1
- two-valid-answer-quiz: 1
- unsupported-complaint-bait: 1
- **total items: 43**

