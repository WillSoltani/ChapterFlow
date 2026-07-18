# IMP-24F retained qualification forensics

This is a deterministic compact projection of the retained 338-attempt campaign. It does not copy raw tasks, model outputs, envelopes, receipts, or per-attempt evidence payloads.

Regenerate with: `cd scripts/book/prompts/chapterflow-v24-author-pipeline && npx tsx scratch/generate-imp24f-retained-forensics.ts`

## Repository preflight

- Requested branch `feat/v25-pipeline-live`; clean isolated worktree at starting HEAD `09b53ef815125a57bd5b786e9bacb372fb7256d0`: verified.
- Draft PR #401: OPEN, draft=true, head `09b53ef815125a57bd5b786e9bacb372fb7256d0`.
- Exact retained CIs: run 29351112643 at `a2cda54222c5931d0c2e90ced968194f6200988f` — SUCCESS; run 29362432844 at `09b53ef815125a57bd5b786e9bacb372fb7256d0` — SUCCESS.

## Evidence bindings

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| `scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/s16-forward-role-qualification-v3-envelope-final/live/qualification-result.json` | 50061715 | `4a6debe2adf71a5fb69d19bab09732a1820d91d83ed29cc3d3980aa55dd3515f` |
| `scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/s16-forward-role-qualification-v3-envelope-final/live/call-ledger.json` | 283583 | `9678cc29526039590629c3bedee53b63c9a6396833798dc05f66f9576b308237` |
| `scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/s16-forward-role-qualification-v3-envelope-final/live/qualification-freeze.json` | 1965 | `017f37f9b203212fc68b9429fb69bf2dd536639b657875154cd3b4903df4a568` |
| `scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/s16-forward-role-qualification-v3-envelope-final/qualification-report.json` | 2691 | `4e5cb806f717689e55b872bac289d95a9b6089da2dd9c535a5c7963eea5cf1bd` |
| `scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/contracts/imp24/role-qualification-corpus-bundle.v3-envelope.json` | 5644085 | `666b8b55e06336f254cb7a6e0c3dc140badedc32d0d0f203c3963fcbe24ff46a` |
| `scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/contracts/imp24/role-thresholds.v3-envelope.json` | 2913 | `f4d08d49eabad6cfdf04561cd38917494f07ed0974f80b59279591d32c5b36be` |

## Campaign invariants

- Result attempts: 338; ledger entries: 338; exact attempt-ID set match: true.
- Calls: 18 canary + 320 holdout = 338; replays 0; API calls 0; cached receipts 0.
- Retained substantive campaign status: **ROLE_SET_NOT_READY**.

## Profile / role outcomes

| Profile | Role | Attempts | Canary protocol | Canary semantic | Holdout calls | Runner status | Outcome | Failed thresholds | Underpowered |
|---|---|---:|---:|---:|---:|---|---|---|---|
| gpt-5.6-sol@high | reader | 32 | 2/2 | 0/2 | 30 | NOT_TESTED_UNDERPOWERED | NOT_QUALIFIED | cleanControlPassRate, evidenceSpanValidity, hardBlockerSensitivity, requiredCasesResolved, schemaValidity | craftCalibrationAccuracy |
| gpt-5.5@high | reader | 32 | 2/2 | 0/2 | 30 | NOT_QUALIFIED | NOT_QUALIFIED | cleanControlPassRate, hardBlockerSensitivity | — |
| gpt-5.6-sol@xhigh | reader | 32 | 2/2 | 0/2 | 30 | NOT_QUALIFIED | NOT_QUALIFIED | cleanControlPassRate, hardBlockerSensitivity | — |
| gpt-5.5@xhigh | reader | 32 | 2/2 | 0/2 | 30 | NOT_QUALIFIED | NOT_QUALIFIED | cleanControlPassRate | — |
| gpt-5.6-sol@xhigh | source | 42 | 2/2 | 1/2 | 40 | NOT_TESTED_UNDERPOWERED | NOT_QUALIFIED | causalOverreachSensitivity, evidenceSpanValidity, fabricationSensitivity, requiredCasesResolved, schemaValidity | supportStatusAccuracy, visibleRegisterAccuracy |
| gpt-5.5@xhigh | source | 42 | 2/2 | 1/2 | 40 | NOT_TESTED_UNDERPOWERED | NOT_QUALIFIED | evidenceSpanValidity, fabricationSensitivity, requiredCasesResolved, schemaValidity | supportStatusAccuracy, visibleRegisterAccuracy |
| gpt-5.6-sol@high | source | 42 | 2/2 | 1/2 | 40 | NOT_TESTED_UNDERPOWERED | NOT_QUALIFIED | evidenceSpanValidity, fabricationSensitivity, requiredCasesResolved, schemaValidity | supportStatusAccuracy, visibleRegisterAccuracy |
| gpt-5.5@high | source | 42 | 2/2 | 1/2 | 40 | NOT_TESTED_UNDERPOWERED | NOT_QUALIFIED | causalOverreachSensitivity, evidenceSpanValidity, fabricationSensitivity, requiredCasesResolved, schemaValidity | supportStatusAccuracy, visibleRegisterAccuracy |
| gpt-5.6-sol@xhigh | quiz | 42 | 2/2 | 1/2 | 40 | QUALIFIED | QUALIFIED | — | — |
| gpt-5.5@xhigh | quiz | 0 | 0/0 | 0/0 | 0 | NOT_TESTED_SEQUENTIAL_STOP | NOT_TESTED | — | — |
| gpt-5.6-sol@high | quiz | 0 | 0/0 | 0/0 | 0 | NOT_TESTED_SEQUENTIAL_STOP | NOT_TESTED | — | — |
| gpt-5.5@high | quiz | 0 | 0/0 | 0/0 | 0 | NOT_TESTED_SEQUENTIAL_STOP | NOT_TESTED | — | — |

Full numerators, denominators, rates, and frozen threshold bars are in the JSON report.

## Reader clean-control cross-profile matrix

All ten retained clean controls are development curator controls (`independentHumanRater=false`), not independent human gold.

| Case | gpt-5.5@high | gpt-5.5@xhigh | gpt-5.6-sol@high | gpt-5.6-sol@xhigh |
|---|---|---|---|---|
| READER-V3-HOLDOUT-clean-behave-ch01 | REVISE; sum=79.3; semantic=false | REVISE; sum=41.8; semantic=false | REVISE; sum=42.8; semantic=false | REVISE; sum=42.1; semantic=false |
| READER-V3-HOLDOUT-clean-checklist-ch01 | REVISE; sum=8.74; semantic=false | REVISE; sum=84.5; semantic=false | SHIP; sum=85.5; semantic=false | REVISE; sum=82.4; semantic=false |
| READER-V3-HOLDOUT-clean-checklist-ch02 | SHIP; sum=84.9; semantic=false | SHIP; sum=8.84; semantic=false | REVISE; sum=84.4; semantic=false | REVISE; sum=88.4; semantic=false |
| READER-V3-HOLDOUT-clean-decisive-ch02 | REVISE; sum=8.7; semantic=false | SHIP; sum=8.8; semantic=false | SHIP; sum=46.2; semantic=false | SHIP; sum=89.5; semantic=false |
| READER-V3-HOLDOUT-clean-difficult-conversations-ch02 | SHIP; sum=86.3; semantic=false | SHIP; sum=84.6; semantic=false | SHIP; sum=88.9; semantic=false | REVISE; sum=44; semantic=false |
| READER-V3-HOLDOUT-clean-make-it-stick-ch01 | REVISE; sum=44.7; semantic=false | SHIP; sum=8.95; semantic=false | REVISE; sum=85.8; semantic=false | SHIP; sum=90.2; semantic=false |
| READER-V3-HOLDOUT-clean-peak-ch02 | SHIP; sum=86.6; semantic=false | SHIP; sum=84; semantic=false | REVISE; sum=86.3; semantic=false | REVISE; sum=89.7; semantic=false |
| READER-V3-HOLDOUT-clean-power-of-moments-ch02 | SHIP; sum=84.2; semantic=false | SHIP; sum=85.6; semantic=false | REVISE; sum=83.2; semantic=false | REVISE; sum=85.4; semantic=false |
| READER-V3-HOLDOUT-clean-willpower-ch01 | SHIP; sum=86; semantic=false | SHIP; sum=8.9; semantic=false | REVISE; sum=40.8; semantic=false | REVISE; sum=42.2; semantic=false |
| READER-V3-HOLDOUT-clean-willpower-ch02 | SHIP; sum=86.9; semantic=false | SHIP; sum=8.73; semantic=false | SHIP; sum=85.6; semantic=false | SHIP; sum=87.6; semantic=false |

### Factor score ranges

| Factor | Min | Max | <=1 | >1 and <=5 | >5 |
|---|---:|---:|---:|---:|---:|
| beginner | 0.86 | 9.4 | 7 | 8 | 25 |
| density | 0.82 | 8.5 | 7 | 8 | 25 |
| insight | 0.84 | 9.2 | 7 | 8 | 25 |
| limits | 0.82 | 9.5 | 7 | 8 | 25 |
| practical | 0.9 | 9.6 | 7 | 8 | 25 |
| quizzes | 0.84 | 9.1 | 7 | 8 | 25 |
| retention | 0.88 | 9.3 | 7 | 8 | 25 |
| summaries | 0.86 | 9.2 | 7 | 8 | 25 |
| tone | 0.87 | 9.2 | 7 | 8 | 25 |
| transfer | 0.86 | 9.5 | 7 | 8 | 25 |

The same named factors contain values in 0–1-like, 1–5-like, and 1–10-like bands. This proves incompatible numeric scales in the retained reader outputs; the report preserves the raw numbers and does not normalize them.

### Reader clean-control finding categories

| Bucket/category | Count |
|---|---:|
| advisory:density | 16 |
| advisory:other_craft | 16 |
| advisory:pacing | 8 |
| advisory:quiz_cue | 33 |
| advisory:repetition | 40 |
| advisory:thin_example | 18 |
| advisory:tone | 3 |

## Source expected versus actual denominators

| Profile | Metric | Threshold min | Expected | Actual | Missing |
|---|---|---:|---:|---:|---:|
| gpt-5.6-sol@xhigh | causalOverreachSensitivity | 4 | 4 | 4 | 0 |
| gpt-5.6-sol@xhigh | cleanCasePassRate | 20 | 20 | 20 | 0 |
| gpt-5.6-sol@xhigh | evidenceSpanValidity | 40 | 40 | 40 | 0 |
| gpt-5.6-sol@xhigh | fabricationSensitivity | 4 | 4 | 4 | 0 |
| gpt-5.6-sol@xhigh | highSeverityFalsePositiveFree | 20 | 20 | 20 | 0 |
| gpt-5.6-sol@xhigh | missingEvidenceInconclusive | 1 | 1 | 1 | 0 |
| gpt-5.6-sol@xhigh | requiredCasesResolved | 40 | 40 | 40 | 0 |
| gpt-5.6-sol@xhigh | schemaValidity | 40 | 40 | 40 | 0 |
| gpt-5.6-sol@xhigh | sourceContradictionSensitivity | 2 | 2 | 2 | 0 |
| gpt-5.6-sol@xhigh | supportStatusAccuracy | 40 | 40 | 33 | 7 |
| gpt-5.6-sol@xhigh | visibleRegisterAccuracy | 40 | 40 | 33 | 7 |
| gpt-5.5@xhigh | causalOverreachSensitivity | 4 | 4 | 4 | 0 |
| gpt-5.5@xhigh | cleanCasePassRate | 20 | 20 | 20 | 0 |
| gpt-5.5@xhigh | evidenceSpanValidity | 40 | 40 | 40 | 0 |
| gpt-5.5@xhigh | fabricationSensitivity | 4 | 4 | 4 | 0 |
| gpt-5.5@xhigh | highSeverityFalsePositiveFree | 20 | 20 | 20 | 0 |
| gpt-5.5@xhigh | missingEvidenceInconclusive | 1 | 1 | 1 | 0 |
| gpt-5.5@xhigh | requiredCasesResolved | 40 | 40 | 40 | 0 |
| gpt-5.5@xhigh | schemaValidity | 40 | 40 | 40 | 0 |
| gpt-5.5@xhigh | sourceContradictionSensitivity | 2 | 2 | 2 | 0 |
| gpt-5.5@xhigh | supportStatusAccuracy | 40 | 40 | 39 | 1 |
| gpt-5.5@xhigh | visibleRegisterAccuracy | 40 | 40 | 39 | 1 |
| gpt-5.6-sol@high | causalOverreachSensitivity | 4 | 4 | 4 | 0 |
| gpt-5.6-sol@high | cleanCasePassRate | 20 | 20 | 20 | 0 |
| gpt-5.6-sol@high | evidenceSpanValidity | 40 | 40 | 40 | 0 |
| gpt-5.6-sol@high | fabricationSensitivity | 4 | 4 | 4 | 0 |
| gpt-5.6-sol@high | highSeverityFalsePositiveFree | 20 | 20 | 20 | 0 |
| gpt-5.6-sol@high | missingEvidenceInconclusive | 1 | 1 | 1 | 0 |
| gpt-5.6-sol@high | requiredCasesResolved | 40 | 40 | 40 | 0 |
| gpt-5.6-sol@high | schemaValidity | 40 | 40 | 40 | 0 |
| gpt-5.6-sol@high | sourceContradictionSensitivity | 2 | 2 | 2 | 0 |
| gpt-5.6-sol@high | supportStatusAccuracy | 40 | 40 | 35 | 5 |
| gpt-5.6-sol@high | visibleRegisterAccuracy | 40 | 40 | 35 | 5 |
| gpt-5.5@high | causalOverreachSensitivity | 4 | 4 | 4 | 0 |
| gpt-5.5@high | cleanCasePassRate | 20 | 20 | 20 | 0 |
| gpt-5.5@high | evidenceSpanValidity | 40 | 40 | 40 | 0 |
| gpt-5.5@high | fabricationSensitivity | 4 | 4 | 4 | 0 |
| gpt-5.5@high | highSeverityFalsePositiveFree | 20 | 20 | 20 | 0 |
| gpt-5.5@high | missingEvidenceInconclusive | 1 | 1 | 1 | 0 |
| gpt-5.5@high | requiredCasesResolved | 40 | 40 | 40 | 0 |
| gpt-5.5@high | schemaValidity | 40 | 40 | 40 | 0 |
| gpt-5.5@high | sourceContradictionSensitivity | 2 | 2 | 2 | 0 |
| gpt-5.5@high | supportStatusAccuracy | 40 | 40 | 39 | 1 |
| gpt-5.5@high | visibleRegisterAccuracy | 40 | 40 | 39 | 1 |

`missingEvidenceInconclusive` is the certified no-sidecar probe (one deterministic observation per tested source profile), not a live holdout case.

## Missing required evaluator observations

There are 16 holdout attempts with missing role-specific observations. Each was protocol-invalid; the exact parse or assembly failure is retained below.

| Role | Profile | Case | Missing observations | Failure |
|---|---|---|---|---|
| reader | gpt-5.6-sol@high | READER-V3-HOLDOUT-craft-nonblocker-difficult-conversations-ch02 | craftCalibrationAccuracy | parse_error: reader model output v2: reader-model-output-v2.quizDerivation.evidenceRefIds: length must equal answers length |
| reader | gpt-5.6-sol@high | READER-V3-HOLDOUT-reader-visible-hard-blocker-checklist-ch02 | hardBlockerSensitivity | parse_error: reader model output v2: reader-model-output-v2.quizDerivation.evidenceRefIds: length must equal answers length |
| source | gpt-5.5@high | SOURCE-V3-HOLDOUT-generic-operational-01-defect | supportStatusAccuracy, visibleRegisterAccuracy | assembly_error: source.U1.findings[0].chapterEvidenceRefIds: evidence reference "PLAN-U001" has kind "plan"; expected chapter |
| source | gpt-5.5@xhigh | SOURCE-V3-HOLDOUT-generic-operational-02-defect | supportStatusAccuracy, visibleRegisterAccuracy | parse_error: source model output v2: source-model-output-v2.assessments[0].findings[0]: primaryCategory violates frozen precedence; expected claim_strength_overreach |
| source | gpt-5.6-sol@high | SOURCE-V3-HOLDOUT-constructed-application-01-defect | supportStatusAccuracy, visibleRegisterAccuracy | assembly_error: source.U1.findings[0]: constructed/generic register finding requires plan evidence |
| source | gpt-5.6-sol@high | SOURCE-V3-HOLDOUT-constructed-application-03-defect | supportStatusAccuracy, visibleRegisterAccuracy | assembly_error: source.U1.findings[0]: constructed/generic register finding requires plan evidence |
| source | gpt-5.6-sol@high | SOURCE-V3-HOLDOUT-generic-operational-01-defect | supportStatusAccuracy, visibleRegisterAccuracy | assembly_error: source.U1.findings[0]: constructed/generic register finding requires plan evidence |
| source | gpt-5.6-sol@high | SOURCE-V3-HOLDOUT-generic-operational-02-defect | supportStatusAccuracy, visibleRegisterAccuracy | assembly_error: source.U1.findings[0].chapterEvidenceRefIds: evidence reference "PLAN-U001" has kind "plan"; expected chapter |
| source | gpt-5.6-sol@high | SOURCE-V3-HOLDOUT-generic-operational-03-defect | supportStatusAccuracy, visibleRegisterAccuracy | assembly_error: source.U1.findings[0]: constructed/generic register finding requires plan evidence |
| source | gpt-5.6-sol@xhigh | SOURCE-V3-HOLDOUT-constructed-application-01-defect | supportStatusAccuracy, visibleRegisterAccuracy | assembly_error: source.U1.findings[0]: constructed/generic register finding requires plan evidence |
| source | gpt-5.6-sol@xhigh | SOURCE-V3-HOLDOUT-constructed-application-02-defect | supportStatusAccuracy, visibleRegisterAccuracy | assembly_error: source.U1.findings[0]: constructed/generic register finding requires plan evidence |
| source | gpt-5.6-sol@xhigh | SOURCE-V3-HOLDOUT-constructed-application-03-defect | supportStatusAccuracy, visibleRegisterAccuracy | assembly_error: source.U1.findings[0]: constructed/generic register finding requires plan evidence |
| source | gpt-5.6-sol@xhigh | SOURCE-V3-HOLDOUT-constructed-application-04-defect | supportStatusAccuracy, visibleRegisterAccuracy | assembly_error: source.U1.findings[0]: constructed/generic register finding requires plan evidence |
| source | gpt-5.6-sol@xhigh | SOURCE-V3-HOLDOUT-generic-operational-01-defect | supportStatusAccuracy, visibleRegisterAccuracy | assembly_error: source.U1.findings[0].chapterEvidenceRefIds: evidence reference "PLAN-U001" has kind "plan"; expected chapter |
| source | gpt-5.6-sol@xhigh | SOURCE-V3-HOLDOUT-generic-operational-02-defect | supportStatusAccuracy, visibleRegisterAccuracy | assembly_error: source.U1.findings[0]: constructed/generic register finding requires plan evidence |
| source | gpt-5.6-sol@xhigh | SOURCE-V3-HOLDOUT-generic-operational-04-defect | supportStatusAccuracy, visibleRegisterAccuracy | assembly_error: source.U1.findings[0].chapterEvidenceRefIds: evidence reference "PLAN-U001" has kind "plan"; expected chapter |

## Threshold reachability

No frozen threshold metric is structurally unreachable. Observed denominator shortfalls are output parse/assembly failures, not corpus-coverage impossibility.

The expected model-free denominators are recorded by role in the JSON report. The observed source support/register shortfalls (33/40, 39/40, 35/40, 39/40) come from the protocol-invalid attempts above; source contradiction remained 2/2 for every tested profile.

## Exact verifier ordering differences

| Profile | Role | Field | Retained order | Verifier reconstruction | Same set |
|---|---|---|---|---|---|
| gpt-5.6-sol@high | reader | failedThresholds | cleanControlPassRate, evidenceSpanValidity, hardBlockerSensitivity, requiredCasesResolved, schemaValidity | schemaValidity, hardBlockerSensitivity, cleanControlPassRate, evidenceSpanValidity, requiredCasesResolved | true |
| gpt-5.5@high | reader | failedThresholds | cleanControlPassRate, hardBlockerSensitivity | hardBlockerSensitivity, cleanControlPassRate | true |
| gpt-5.6-sol@xhigh | reader | failedThresholds | cleanControlPassRate, hardBlockerSensitivity | hardBlockerSensitivity, cleanControlPassRate | true |
| gpt-5.6-sol@xhigh | source | failedThresholds | causalOverreachSensitivity, evidenceSpanValidity, fabricationSensitivity, requiredCasesResolved, schemaValidity | schemaValidity, fabricationSensitivity, causalOverreachSensitivity, evidenceSpanValidity, requiredCasesResolved | true |
| gpt-5.5@xhigh | source | failedThresholds | evidenceSpanValidity, fabricationSensitivity, requiredCasesResolved, schemaValidity | schemaValidity, fabricationSensitivity, evidenceSpanValidity, requiredCasesResolved | true |
| gpt-5.6-sol@high | source | failedThresholds | evidenceSpanValidity, fabricationSensitivity, requiredCasesResolved, schemaValidity | schemaValidity, fabricationSensitivity, evidenceSpanValidity, requiredCasesResolved | true |
| gpt-5.5@high | source | failedThresholds | causalOverreachSensitivity, evidenceSpanValidity, fabricationSensitivity, requiredCasesResolved, schemaValidity | schemaValidity, fabricationSensitivity, causalOverreachSensitivity, evidenceSpanValidity, requiredCasesResolved | true |

All 7 differences are order-only canonical-set matches. They do not change the retained substantive outcome **ROLE_SET_NOT_READY**.

## Forensic conclusion

- 19/40 retained clean-reader judgments were not SHIP, while every frozen clean case expected SHIP.
- Mixed reader score scales observed: true.
- Missing required observation attempts: 16.
- Verifier order-only differences: 7; every difference is canonical-set equal: true.
- Retained substantive campaign status remains **ROLE_SET_NOT_READY**.
