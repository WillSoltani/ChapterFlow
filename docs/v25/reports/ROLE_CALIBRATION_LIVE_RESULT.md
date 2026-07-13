# IMP-23 role calibration live result

Status: `V1_INVALIDATED_INSTRUMENT; V2_CORRECTED_RERUN_PENDING_GREEN_CI`

This is the new live-result record required by IMP-23. It does not replace the earlier `NOT_RUN` report.

## Invalidated v1 run

- Experiment: `s16-forward-role-qualification-v1`
- Calibration SHA-256: `4cd4ad8254bf1a8cbfdcb528996554064d8058533568c9b1c69c2f08bbdfdf66`
- Scheduled and retained attempts: 24 / 24
- ChatGPT-authenticated `codex exec` invocations: 24
- Infrastructure replays / capacity events / safeguards or refusals: 0 / 0 / 0
- API calls: 0
- Holdout started: false
- Inspection: owner-delegated development inspection; not an independent human rating
- Decision: `INVALID_INSTRUMENT_DO_NOT_ATTEST`

The retained route was valid, but the calibration instrument was not. Inspection found five material defects:

1. The Behave chapter 2 reader clean control carried an unsafe dispatch-risk phrase while its gold label was `SHIP`.
2. Quiz phase 2 omitted the exact committed key-free chapter evidence needed to judge mechanism support.
3. Source qualification did not bind the required plan unit and the scorer could silently fall back to the first returned unit.
4. The calibration-validity predicate did not require exact evidence spans; seven retained source attempts had non-exact spans.
5. The source scorer accepted a `BLOCK` result with no blocker-severity finding in retained attempt `qual-00019-a1`.

All v1 attempts, routes, outputs, receipts, and the original instrument snapshot are preserved under:

`state/migration-experiments/s16-forward-role-qualification-v1/live/`

## One permitted offline correction

The corrected identity is `s16-forward-role-qualification-v2`. No further corrected calibration rerun is allowed.

The correction is limited to the verified calibration defects and downstream identity binding:

- one calibration-only reader text correction on the same coordinate; no holdout mutation or case replacement;
- exact key-free phase-1 chapter evidence in quiz phase 2;
- exact source target-unit binding and status/severity consistency;
- exact-evidence-span validity in the calibration gate;
- explicit v2 qualification-spec binding for pilot, gold, and local activation;
- deterministic zero-call materializers for the post-holdout freeze and live campaign artifacts.

Thresholds, candidate order, holdout cases, model order, and completed outputs were not changed or relabeled.

## Validation attempts before the corrected live rerun

1. Full suite with the default user npm cache: `pass 2674; fail 7; xenv 10; skip 39`. All seven failures came from `npm EPERM` while the sandboxed run attempted to create files under the unwritable user npm cache; this attempt is retained as a reported environmental failure, not hidden.
2. Full suite with `npm_config_cache=/private/tmp/npm-cache-v25-repair`: `pass 2681; fail 0; xenv 10; skip 39`.
3. Focused qualification, live-driver, and local-runtime regressions after explicit v2 identity propagation: `pass 47; fail 0`.
4. TypeScript typecheck, contract validation, the all-files secret/artifact scan, private-path scan, merge-marker scan, and `git diff --check`: PASS.
5. Expanded full suite after adding the post-holdout and activation materializers: `pass 2690; fail 1; xenv 10; skip 39`. The one real regression was the baseline-model static guard: the new activation materializer had repeated the baseline model literal outside the central policy.
6. After replacing that literal with the central `BASELINE_MODEL` constant and reminting the production seal: `pass 2691; fail 0; xenv 10; skip 39`.

The corrected preflight is frozen to spec bytes `ebf799376a22627c5f7b1fedc5cc8b40b383e2c1353010c0ca466b30f1261106`, 24 expected calibration calls, `maxParallel = 2`, ChatGPT authentication, no API key, no fallback, and no forbidden provider environment keys. The corrected production instrument seal is `a2c03c294583ae605e2113523b499fd44c0583baa9cfe1cf3aff0bb966f7596f` over 428 files (artifact bytes `f1a84576500f8c766eb751801b4400e6737e18187995e08d4e3e7eceb109e17e`).

The corrected v2 live result, inspection decision, and holdout authorization will be appended only after the dedicated V25 GitHub workflow passes on the correction commit.
