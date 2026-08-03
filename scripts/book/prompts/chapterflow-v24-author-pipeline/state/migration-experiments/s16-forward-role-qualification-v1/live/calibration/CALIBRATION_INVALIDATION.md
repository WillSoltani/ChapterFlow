# Calibration invalidation — s16-forward-role-qualification-v1

Decision: `INVALID_INSTRUMENT_DO_NOT_ATTEST`

The owner-delegated development inspection reviewed all 24 retained calibration requests, receipts, raw outputs, parsed outputs, schemas, evidence-span evaluations, and route sidecars. Holdout did not start.

The calibration route itself was valid:

- 24 scheduled attempts and 24 completed receipts;
- 24 ChatGPT-authenticated `codex exec` route sidecars;
- requested model `gpt-5.6-sol` at the frozen `high`/`xhigh` efforts;
- zero infrastructure replays;
- zero capacity events;
- zero safeguards/refusals;
- zero API calls;
- `apiKeyPresent = false` and `apiFallbackAllowed = false` on every route.

The retained seal `4cd4ad8254bf1a8cbfdcb528996554064d8058533568c9b1c69c2f08bbdfdf66` must not be attested because inspection found material calibration-instrument defects:

1. Reader clean-control gold defect: `READER-V2-CALIBRATION-clean-behave-ch02` was labeled `SHIP` but inherited “Return, touch Send, ... then choose the first sentence.” The live reader correctly identified a dispatch-risk blocker.
2. Quiz evidence omission: the phase-2 adjudication document did not carry the exact committed key-free chapter evidence. The supported mechanism case therefore asked the reviewer to judge support it could not see.
3. Source target-unit/scorer defect: qualification did not bind the controlled plan-unit id, and the evaluator silently fell back to the first returned unit when the target was absent. Several outputs therefore scored a different unit from the case under test.
4. Calibration evidence-span gate defect: seven retained source attempts had non-exact evidence spans, but the calibration seal's `valid` predicate checked schema/protocol only and did not require `evidenceSpanValid = true`.
5. Source status/severity consistency defect: retained attempt `qual-00019-a1` returned `BLOCK` with only `major` findings, and the qualification scorer accepted the internally inconsistent result instead of requiring at least one blocker-severity finding.

The original reader corpus, provenance, and spec bytes are preserved under `instrument-snapshot/`. No holdout case, threshold, candidate order, or completed output was relabeled or replaced. The one permitted offline correction is minted as `s16-forward-role-qualification-v2`; no further corrected calibration rerun is allowed.

Inspection identity: `owner-delegated-gpt56-sol-max-session`

Independent human rater: `false`
