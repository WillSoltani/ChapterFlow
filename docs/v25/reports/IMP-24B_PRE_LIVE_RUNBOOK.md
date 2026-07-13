# IMP-24B pre-live runbook

This runbook covers only the model-free freeze, exact implementation commit, dedicated V25 CI, zero-call preflight, V3 canaries, role holdouts, and role assignment freeze.

## Before the implementation commit

1. Run TypeScript, contract validation, focused IMP-24 tests, the full V25 suite, and workflow-equivalent checks in an isolated root.
2. Verify V1 and V2 evidence preservation, zero live calls, zero API calls, the secret guard, private-path scan, merge-marker scan, and tracked-binary scan.
3. Materialize thresholds, the production/qualification parity map, the production seal, model-free certification, and this pre-live freeze in the documented order.
4. Stage only intended source, tests, contracts, schemas, state artifacts, and reports. Never stage runtime debris or authentication material.
5. Commit and push normally to `feat/v25-pipeline-live`; never force-push.

## Exact-commit gate

1. Verify draft PR #401 and the remote branch both point to the exact implementation commit.
2. Require `ChapterFlow V25 Pipeline` success on that exact commit.
3. Reconcile every frozen hash from a clean checkout of that exact commit.
4. Stop before any live call if any hash differs or certification is not `CERTIFIED_MODEL_FREE`.

## Live V3 qualification

1. Run a zero-call preflight and freeze actual local candidate availability without reordering.
2. Use only ChatGPT-authenticated `codex exec`; API keys, provider fallback, SDK/HTTP routes, and direct provider calls remain prohibited.
3. Run exactly two protocol canaries per available profile/role before its holdout.
4. Run the frozen holdouts with sequential stopping at reader 2, source 2, quiz 1.
5. Permit at most one replay for a frozen typed infrastructure failure; never replay a judgment or protocol failure.
6. Retain every request, envelope, receipt, raw output, resolution, assembled review, ledger entry, metric, and role decision.

## Mandatory stop boundary

This task ends after a valid role assignment freeze or a truthful terminal role-set failure. Do not run a pilot, gold validation, local SOL activation, publication, promotion, deployment, upload, merge, or force-push.
