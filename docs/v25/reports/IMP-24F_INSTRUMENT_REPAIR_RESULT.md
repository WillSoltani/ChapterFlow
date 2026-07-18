# IMP-24F Instrument Repair Result

Final decision: `BLOCKED_NEEDS_INDEPENDENT_GOLD`.

The qualification instrument is repaired offline: production and qualification share lane-specific semantic projections, reader scoring explicitly uses 0-100, holdout admission requires 2/2 semantically correct canaries, threshold coverage is certified against the real model-free evaluator, and the retained verifier uses comparison-only canonical sets. No live phase ran because independently governed reader gold does not exist.

## Offline gates

- retainedTerminalEvidencePreserved: `PASS`
- readerProductionQualificationSemanticParity: `PASS`
- readerExplicitZeroToOneHundredScale: `PASS`
- sourceProductionQualificationSemanticParity: `PASS`
- quizProductionQualificationAudit: `MATERIAL_MISMATCH_REPAIRED_PRIOR_QUALIFICATION_STALE`
- semanticCanaryGateTwoOfTwoRequired: `PASS`
- thresholdToCorpusCoverage: `PASS`
- modelFreeCoverageCertification: `CERTIFIED_MODEL_FREE`
- verifierCanonicalSetProjection: `PASS`
- independentReaderHoldoutGold: `FAIL_MISSING`
- exactImplementationCi: `PENDING_POST_COMMIT`

## Threshold coverage

| Role | Metric | Expected | Minimum | Zero-miss | Evaluator observations | Status |
|---|---|---:|---:|---:|---:|---|
| reader | cleanControlPassRate | 10 | 10 | no | 10 | PASS |
| reader | craftCalibrationAccuracy | 10 | 10 | no | 10 | PASS |
| reader | evidenceSpanValidity | 30 | 30 | yes | 30 | PASS |
| reader | hardBlockerFalsePositiveFree | 10 | 10 | yes | 10 | PASS |
| reader | hardBlockerSensitivity | 10 | 10 | yes | 10 | PASS |
| reader | requiredCasesResolved | 30 | 30 | yes | 30 | PASS |
| reader | schemaValidity | 30 | 30 | yes | 30 | PASS |
| source | causalOverreachSensitivity | 4 | 4 | yes | 4 | PASS |
| source | cleanCasePassRate | 20 | 20 | no | 20 | PASS |
| source | evidenceSpanValidity | 40 | 40 | yes | 40 | PASS |
| source | fabricationSensitivity | 4 | 4 | yes | 4 | PASS |
| source | highSeverityFalsePositiveFree | 20 | 20 | yes | 20 | PASS |
| source | missingEvidenceInconclusive | 1 | 1 | yes | 1 | PASS |
| source | requiredCasesResolved | 40 | 40 | yes | 40 | PASS |
| source | schemaValidity | 40 | 40 | yes | 40 | PASS |
| source | sourceContradictionSensitivity | 2 | 2 | yes | 2 | PASS |
| source | supportStatusAccuracy | 40 | 40 | no | 40 | PASS |
| source | visibleRegisterAccuracy | 40 | 40 | no | 40 | PASS |
| quiz | ambiguityDetection | 10 | 10 | no | 10 | PASS |
| quiz | cleanUniquePassRate | 10 | 10 | no | 10 | PASS |
| quiz | evidenceSpanValidity | 40 | 40 | yes | 40 | PASS |
| quiz | mechanismAccuracy | 10 | 10 | no | 10 | PASS |
| quiz | requiredCasesResolved | 40 | 40 | yes | 40 | PASS |
| quiz | schemaValidity | 40 | 40 | yes | 40 | PASS |
| quiz | wrongKeyDetection | 10 | 10 | yes | 10 | PASS |

Source contradiction is exactly 2/2 for `SOURCE-V3-HOLDOUT-attribution-ch01-fact-2-defect` and `SOURCE-V3-HOLDOUT-attribution-ch01-fact-4-defect`; no contradiction observation was lost.

## Reader clean controls

Audited: 10. Eligible: 0. Independent holdout gold available: no. See `docs/v25/reports/IMP-24F_READER_GOLD_ADJUDICATION_PACKET.json` and `docs/v25/reports/IMP-24F_READER_GOLD_ADJUDICATION_PACKET.md`.

## Live activity

Model/API/holdout/pilot calls: 0/0/0/0. No corrected canary identity or canary report was created because the independent-gold prerequisite failed.

## Next authorized action

Obtain owner-approved, independently adjudicated, reader-rubric-specific unused gold; then re-run offline certification at the exact implementation commit before authorizing any fresh canary-only identity.

Result SHA-256: `2bdd26a54c9278b3ecf25466e99878cebcf7efedb9052dc272466d64b7972749`.
