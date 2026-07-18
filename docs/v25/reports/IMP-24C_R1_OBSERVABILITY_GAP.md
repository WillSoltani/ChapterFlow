# IMP-24C r1 observability-gap closure

Status: `BLOCKED_OBSERVABILITY_INCOMPLETE`

Execution `s16-forward-role-qualification-v3-envelope-r1` is closed with its two failed reader canaries preserved exactly. It may not resume and may not qualify profiles. The missing subprocess text is not reconstructed, inferred, or backfilled.

## Identity and CI provenance

| Field | Value |
| --- | --- |
| Branch | `feat/v25-pipeline-live` |
| Starting and exact CI head | `3b060fb0a7f6e64e04386b84ff6b5a10e42868ec` |
| Draft PR | `#401` |
| Frozen V3 protocol | `s16-forward-role-qualification-v3-envelope` |
| Closed execution | `s16-forward-role-qualification-v3-envelope-r1` |
| Disposition | `BLOCKED_OBSERVABILITY_INCOMPLETE` |
| May resume | `false` |
| May qualify profiles | `false` |

Two distinct successful exact-head CI observations are retained without conflation:

| Observation | Run | Result | Provenance |
| --- | ---: | --- | --- |
| Retained r1 implementation gate | `29311237347` | `SUCCESS` | Exact bytes in `s16-forward-role-qualification-v3-envelope-r1/implementation-ci-gate.json` |
| Independently verified owner checkpoint | `29311241491` | `SUCCESS` | IMP-24D continuation checkpoint |

The owner checkpoint does not rewrite or reinterpret the retained r1 gate artifact.

## Frozen counters

| Counter | Value |
| --- | ---: |
| Canary calls attempted | `2` |
| Holdout calls | `0` |
| Broker requests | `2` |
| Codex exec invocations | `2` |
| Cached receipts | `0` |
| Infrastructure replays | `0` |
| Max-plan events | `0` |
| API calls | `0` |
| Roles qualified | `0` |
| Successful structured responses | `0` |

## Immutable canaries

| Attempt | Case | Role and profile | Status | Request SHA-256 | Envelope SHA-256 | Receipt SHA-256 |
| --- | --- | --- | --- | --- | --- | --- |
| `v3-reader-p1-canary-c01-a1` | `READER-V3-CANARY-clean-make-it-stick-ch02` | reader, `gpt-5.6-sol@high` | `integrity_failure` | `f88add9406802f9726b05d1e155f533aa55c63804ce90830652c95282164041a` | `dc2e76b95c1249f7c2a8bb66b2bebf9d8c5e4bbd06c70b3a1c0e603403630907` | `77ba3bf0d7a43e83a997a1bbc145a898ccd64c67b545ff34b51578a0523e8f99` |
| `v3-reader-p1-canary-c02-a1` | `READER-V3-CANARY-reader-visible-hard-blocker-make-it-stick-ch02` | reader, `gpt-5.6-sol@high` | `integrity_failure` | `0ef04fd6bae27bf91ce15d091e69b809037c797f3bd873809257afc95927793c` | `24833b4620e5c4a47e5c7794f63fbd4281544c4ba8d80c39c71e2deb48104559` | `025c38c6c531e079f901c256a11bf2040684f1100486db38b8c1834f49a83a47` |

Both attempts were first attempts (`attemptNumber = 1`, `replayOfAttemptId = null`), crossed the process boundary, and returned through the runner. Both used ChatGPT-authenticated `codex exec` with no API key and no fallback.

| Attempt | Exit | Duration | Stdout | Stderr | Generic failure |
| --- | ---: | ---: | --- | --- | --- |
| `v3-reader-p1-canary-c01-a1` | `1` | `7715 ms` | `0` bytes, `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | `21735` bytes, `f59df2e81396de0cf727d4388bb847d6e26ef44b5cc508168c09d5d9edaf14ed` | `forward reviewer: codex exec failed (ok=false, exitCode=1, outcome=infrastructure_failure)` |
| `v3-reader-p1-canary-c02-a1` | `1` | `9334 ms` | `0` bytes, `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | `21823` bytes, `e8d04c64a845b66ada420c9b1b4734f8882e6a56004f8b768c43ac6a32ed008e` | `forward reviewer: codex exec failed (ok=false, exitCode=1, outcome=infrastructure_failure)` |

## Observability gap

The result sidecars retain exact stdout and stderr byte counts and full-stream hashes. The authoritative final output is empty in both attempts, and the structured-output sidecars record `Unexpected end of JSON input`.

The stderr text itself was not retained. Therefore the evidence cannot distinguish an argument, model, effort, schema, authentication, entitlement, capacity, sandbox, path, transport, or process defect. No narrower root cause is asserted.

No `process-diagnostics.json` is added to either r1 attempt. That artifact applies only to new smoke and r2 attempts after the bounded observability implementation.

## Exact retained inventory

The r1 state root contains exactly `26` files totaling `327951` bytes. One file, `execution-spec.json`, was already committed at Recovery Commit A; the failed live run added exactly `25` retained files:

- the committed execution specification plus two retained execution-root observations;
- preflight, qualification freeze, and call ledger;
- exactly six files for each of two attempt directories;
- exactly four exec sidecars for each attempt;
- no process diagnostics, holdout, replay, role registry, role freeze, or terminal qualification result.

`IMP-24C_R1_OBSERVABILITY_GAP.json` binds all `26` relative paths, including the one Recovery-A file and the `25` post-A retained files, with exact byte counts, byte SHA-256 values, semantic self-hashes, counters, and sidecar identities.

## Successor boundary

The r1 evidence is immutable and cannot be copied into a successor campaign. The diagnostic-only transport smoke root is `s16-forward-role-qualification-v3-envelope-transport-smoke`. Only after smoke PASS may the fresh unchanged qualification identity `s16-forward-role-qualification-v3-envelope-r2` begin.

Pilot, gold, local SOL activation, publication, promotion, deployment, upload, merge, and force-push remain outside this closure.
