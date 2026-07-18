# IMP-24C control-plane correction

Status: `IMPLEMENTED_PENDING_RECOVERY_COMMIT_A_AND_EXACT_CI`

Starting HEAD: `0ba1b168e350fa5d6c05480a28c7c944411f54ee`

Successor execution ID: `s16-forward-role-qualification-v3-envelope-r1`

## Scope

This correction repairs two control-plane defects without changing the Review Evidence Envelope protocol or any semantic qualification input.

1. The dedicated GitHub workflow collector now treats the workflow display name and workflow file path as separate evidence fields. It validates the exact repository, display name, workflow path, branch, head SHA, completed/success result, one required job, and draft PR #401 at the same head.
2. Pre-live materialization now owns only `implementation-report.imp-24.pre-live.json`. Its verify mode constructs expected bytes in memory and compares retained artifacts without writing to the checkout.
3. The terminal implementation report and `IMP-24C_FINAL_REPORT` are owned only by a separate deterministic final-attestation materializer. That materializer validates the Recovery Commit A and B identities and ancestry, requires its retained inputs to be byte-identical Git blobs in Recovery Commit B, and cannot modify pre-live artifacts.
4. The dedicated V25 workflow verifies the pre-live freeze and any retained final attestation read-only. It does not rematerialize either lifecycle layer in CI.
5. The closed zero-call execution `s16-forward-role-qualification-v3-envelope` remains immutable and non-resumable. Only the successor execution root may be used for the corrected qualification run.

## Frozen semantic boundary

The reader, source, and quiz canary and holdout cases; gold labels; thresholds; candidate order; prompt semantics; output-schema semantics; stopping rules; and replay policy are unchanged from `0ba1b168e350fa5d6c05480a28c7c944411f54ee`. No threshold weakening, holdout relabeling or replacement, profile reordering, output-informed resampling, unfavorable-judgment replay, or added retry is part of this correction.

## Safety boundary

- Live model calls made before Recovery Commit A exact CI: `0`.
- API calls: `0`.
- Permitted live route after exact-CI authorization: ChatGPT-authenticated `codex exec` only.
- API keys, provider fallback, direct SDK/HTTP routes, publication, promotion, deployment, upload, merge, and force-push remain prohibited.
- Pilot, gold, Content Design Score evaluation, local SOL activation, and all downstream execution are outside this task boundary.

## Lifecycle

The owner-authorized lifecycle is fixed:

1. Recovery Commit A: this control-plane implementation, tests, successor execution specification, reminted model-free artifacts, preliminary report, IMP-24B closure, and protocol note.
2. Recovery Commit B: only retained successor canary/holdout evidence and the first valid frozen 2-reader / 2-source / 1-quiz assignment, if earned.
3. Recovery Commit C: deterministic final attestation binding A and B.

No earlier IMP-24B commit is amended, rewritten, deleted, or reinterpreted.

## Current gate

The implementation is not live-call authorization. Recovery Commit A must first be created and pushed normally, the dedicated `ChapterFlow V25 Pipeline` must succeed on that exact SHA, the new seal and freeze must reproduce in a clean checkout, the corrected collector must accept the exact run, pre-live verification must leave the checkout clean, and the ChatGPT/no-API preflight must pass.
