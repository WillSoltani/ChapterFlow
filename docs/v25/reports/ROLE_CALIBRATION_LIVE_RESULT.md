# IMP-23 role calibration live result

Status: `BLOCKED_CALIBRATION_INVALID`

The one permitted corrected calibration identity, `s16-forward-role-qualification-v2`, was executed once after dedicated V25 CI passed on commit `5642a803dec6c04c2f63e78f379edfe66fc14bd1`. The calibration failed closed. IMP-23 therefore forbids attestation, holdout, role assignment, pilot, gold, and local activation.

## Corrected v2 result

- Spec bytes SHA-256: `ebf799376a22627c5f7b1fedc5cc8b40b383e2c1353010c0ca466b30f1261106`
- Calibration SHA-256: `f52c247feaeb67864e5dbcb3e2ac396ec359b01811bc11578f55c5a84ec5b9d5`
- Frozen schedule: 24 cases
- ChatGPT-authenticated `codex exec` invocations: 25
- Completed case outputs: 24
- Infrastructure replays: 1
- Max-plan capacity events: 1
- Safeguards or refusals: 0
- Cached receipts: 0
- API calls: 0
- Route-valid attempts: 25 / 25
- Holdout started: false
- Calibration valid: false
- Role protocol valid: reader `false`, source `false`, quiz `false`

The single replay was the frozen infrastructure replay for `qual-00004-a1`, which ended with `provider_rate_or_capacity`. `qual-00004-a2` completed. There was no hidden retry or output-informed replacement.

## Retained invalidity evidence

| Role | Completed cases | Protocol-valid | Exact-evidence-valid | Observed invalidity |
| --- | ---: | ---: | ---: | --- |
| Reader | 6 | 6 | 0 | Every output returned an unassessed zero-score `BLOCK` because its staged chapter file could not be opened; the seal resolved these as `REVISE`, with no exact retained evidence spans. No clean, non-blocker, or blocker control was actually reviewed. |
| Source | 10 | 8 | 3 | Two outputs violated the source protocol and seven failed exact-evidence validation. The nominal clean generic-specificity case is internally contradictory: its plan forbids dates and historical claims while its unit contains the 2007 iPhone launch; the reviewer reasonably returned `BLOCK`. |
| Quiz | 8 | 0 | 0 | Every output violated frozen item identity and/or phase-1 indices, or omitted the required item. No quiz case produced a protocol-valid retained result. |

Representative terminal errors are preserved in `calibration-seal.json`:

- `qual-00003-a1`: returned item ID `ch02-q01` instead of the frozen committed ID and misreported the key/agreement state.
- `qual-00005-a1`: omitted required unit `unit.fact.ch01.fact.1`.
- `qual-00019-a1`: relabeled compiler-owned plan metadata for `unit.ch01.constructed-application`.
- `qual-00020-a1`: returned zero adjudicated items for one frozen question.
- `qual-00022-a1`: rewrote frozen phase-1 indices and misreported the real key.

Inspection also found a source prompt/scorer mismatch: the scorer requires verbatim contiguous evidence spans, but the source task does not tell the reviewer that requirement. The invented-detail defect case also permits two reasonable categories without a precedence rule. These findings confirm instrument invalidity; they are not grounds for revising or rerunning the already-consumed corrected identity.

These are material calibration-instrument failures, not holdout profile failures. The complete schedule, all 25 requests and receipts, all 24 completed structured outputs, route sidecars, manifests, the call ledger, candidate availability, preflight, and final calibration seal are retained under:

`state/migration-experiments/s16-forward-role-qualification-v2/live/`

No authentication database, token file, API key, or temporary Codex session directory is included in the retained evidence.

## Prior invalidated v1 run

The earlier `s16-forward-role-qualification-v1` calibration is separately preserved with SHA-256 `4cd4ad8254bf1a8cbfdcb528996554064d8058533568c9b1c69c2f08bbdfdf66`: 24 scheduled and retained attempts, 24 ChatGPT-authenticated calls, zero API calls, and no holdout. Its five verified instrument defects, instrument snapshot, attempts, routes, outputs, receipts, and invalidation record remain under its own `live/` directory.

The v2 run consumed the prompt's one permitted corrected identity. No further calibration rerun or calibration revision is authorized.

## Validation attempt history

All correction and terminal-packaging validation attempts are disclosed:

1. Full suite using the default user npm cache: `pass 2674; fail 7; xenv 10; skip 39`. All seven failures were `npm EPERM` attempts to write the sandbox-inaccessible user cache.
2. Full suite with the safe temporary cache: `pass 2681; fail 0; xenv 10; skip 39`.
3. Focused qualification, live-driver, and local-runtime regressions after explicit v2 propagation: `pass 47; fail 0`.
4. Expanded full suite after adding deterministic post-holdout and activation materializers: `pass 2690; fail 1; xenv 10; skip 39`. The failure was a real static-guard regression caused by repeating the baseline-model literal outside central policy.
5. Diagnostic repeat of the expanded suite: `pass 2690; fail 1; xenv 10; skip 39`, confirming the same baseline-model guard.
6. After using the central `BASELINE_MODEL` constant and reminting the seal: `pass 2691; fail 0; xenv 10; skip 39`.
7. Focused forward suite: `pass 135; fail 0`; materializer suite: `pass 9; fail 0`; typecheck, contract validation, secret/artifact scan, private-path scan, merge-marker scan, and diff check: PASS.
8. Dedicated GitHub V25 run `29220367933` on correction head `5642a803dec6c04c2f63e78f379edfe66fc14bd1`: PASS.
9. After live evidence packaging, typecheck, production-seal dry verification, JSON parsing, diff check, and the all-files secret/artifact guard passed. The first contract-validation attempt rejected only the new IMP-23 report's missing standard worker-report envelope; after adding the required metadata fields, contract validation passed.
