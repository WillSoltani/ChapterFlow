# IMP-24C model-free verification ledger

Status: `RECOVERY_COMMIT_A_LOCALLY_READY`

Starting HEAD: `0ba1b168e350fa5d6c05480a28c7c944411f54ee`

Successor execution ID: `s16-forward-role-qualification-v3-envelope-r1`

Model calls: `0`  
API calls: `0`

Every model-free failure is retained in the companion JSON ledger. No later pass replaces or conceals an earlier failure.

## Adverse attempts retained

| Attempt | Check | Result | Classification |
| ---: | --- | --- | --- |
| 1 | Partial successor compatibility | `1 pass / 20 fail` | Partial integration regression |
| 2 | TypeScript during integration | `15 errors` | Partial integration regression |
| 3 | Early local-activation compatibility | `FAIL`, exact count not retained | Fixture integration regression |
| 4 | Successor CLI audit | `4 pass / 1 fail` | Stale closed-ID expectation |
| 6 | Role-freeze binding | `10 pass / 1 fail` | Assertion wording mismatch |
| 8 | Retained activation compatibility | `1 pass / 20 fail` | Fixtures lacked new exact gate/ledger bindings |
| 15 | Full suite in the primary development checkout | `2821 pass / 7 fail / 10 xenv / 39 skip` | Host npm-cache permission environment; all seven were publish-final fixture failures |
| 25 | Final pre-live artifact-manifest closure audit | `FAIL` | Four IMP-24C reports were listed but not yet byte-bound |
| 27 | Focused pre-live suite before deterministic rematerialization | `4 pass / 1 fail` | Expected stale successor execution-spec identity |
| 29 | Independent final-attestation cross-binding audit | `FAIL` | Same-profile self-rehashed role freeze was insufficiently bound to the terminal campaign |
| 30 | Focused post-fix suites before remint | `53 pass / 1 fail` | Expected stale production seal after sealed source changed |
| 31 | Second independent final-attestation red-team audit | `FAIL` | Internal freeze bindings and typed API-count projection were not fully validated |
| 33 | Retained qualification/activation boundary suite | `31 pass / 24 fail` | Validator incorrectly required an untagged substantive corpus hash |
| 36 | Terminal NOT_READY retained-evidence regression | `21 pass / 1 fail` | Test helper retained a stale candidate-availability self hash |
| 40 | Independent CI provenance red-team audit | `FAIL` | Repository host, retained raw provenance, exact schema/time, and retained-gate validation gaps |
| 41 | Mid-integration CI-gate/final suite | `28 pass / 29 fail` | Exact repository URL was not yet integrated into all fixtures |
| 42 | TypeScript after exact repository URL became required | `5 errors` | Five fixtures still used the old repository shape |
| 43 | Direct `tsx --test` invocation | `0 registered tests` | Wrong repository test harness; not treated as evidence |
| 44 | Correct harness before all URL fixtures were fixed | `25 pass / 35 fail` | Every failure stopped at the new exact repository shape |
| 48 | Combined retained-boundary harness before final remint | `41 pass / 25 fail` | Expected stale production-seal barrier after sealed source changed |
| 49 | Independent terminal-state and exact-C lifecycle audit | `FAIL` | Blocked stale markdown, partial NOT_READY coverage, per-attempt exactness, CI token/permissions, and live-recheck placement gaps |
| 55 | First seal-dependent focused boundary suite after remint | `90 pass / 1 fail` | Stale assertion expected the retained wrapper message instead of the stricter shared preflight rejection |

The seven full-suite failures were reproduced as `5 pass / 7 fail` in the focused publish-final file. Six failed when inherited `npx` reached the host cache at `/Users/radinsoltani/.npm/_cacache/tmp` and received `EPERM`; the seventh stopped at the same early failure before its intended sync step. With the dedicated workflow's suite-wide `npm_config_cache=/tmp/npm-cache-v25`, the same file passed `12/12`. This adverse attempt remains evidence and was not classified as a source pass.

The corrected focused reruns passed `5/5`, `11/11`, and `21/21`. Combined control-plane suites passed `44/44` and then `29/29`; pre-live read-only lifecycle tests passed `5/5`; TypeScript and all `16` registered contracts passed. An independent audit also found all frozen semantic inputs, V1/V2 evidence, completed IMP-24B commits, and retained IMP-24B lifecycle artifacts unchanged from the starting HEAD.

The decisive clean same-branch clone then passed the complete no-API suite: `2828 pass / 0 fail / 0 xfail / 0 xpass / 10 xenv / 39 skip`. The clone used the dedicated workflow's no-API/no-model environment and an isolated suite-wide npm cache. Model calls and API calls remained `0/0`.

## Current reminted identities

| Artifact | SHA-256 |
| --- | --- |
| Thresholds | `8f16369a655a8ea6bf392a5d00c875c1619e4c9c43ec605474c892f75f6450aa` |
| Production seal | `22bda57b70062160cc560adb46b9ab32b2ba316c901898727cafba10faaabab5` |
| Model-free certification | `cd3c6450337a3c29be5812c52608f9805cb50606d8de066c6ac1e8f94ca2bc4f` |
| Production/qualification parity | `7ab47df0aeea82c83c7e6c8db8c7fbeaa7e9488dc76916ea6ddace105aa508d4` |

The final hardening source was reminted model-free across the unchanged threshold identity, 456-file production seal, 116-case certification, parity proof, and 23-output preliminary freeze. Model/API calls remained `0/0`. Because the freeze byte-binds this ledger, the preliminary freeze must now be rematerialized once against these final ledger bytes before the complete verification run.

## Final manifest audit

The first final audit found that the preliminary changed-file inventory listed the control-plane correction, protocol note, and model-free ledgers, but the pre-live artifact manifest did not byte-bind them. That evidence gap is retained as attempt 25. Recovery Commit A was held, the four reports were added to the manifest, and a focused hash-binding assertion was added. This was a control-plane binding correction only; no qualification semantic input changed.

The first focused pre-live rerun then passed four lifecycle tests and failed the actual read-only workflow-command test because the retained successor execution spec still bound the pre-correction seal and certification. That fail-closed result is attempt 27. It required deterministic pre-live rematerialization, not a semantic or test weakening.

A later independent audit found that the final materializer validated the selected profile IDs and role-freeze self-hash but did not bind every exact campaign identity. Recovery Commit A was held again. The materializer now binds the freeze canonical and byte hashes, Recovery Commit A, dedicated CI gate, qualification result/freeze, call ledger canonical and byte hashes, certification, production seal, and parity. A committed self-rehashed substitute with unchanged profile IDs is now a negative regression fixture. The blocked terminal path also binds the exact dedicated CI gate outside the ready-only role path.

A second red-team pass then found that the outer role-freeze hash did not by itself validate every internal behavior-affecting identity, and that loose count fallbacks could let a top-level zero override a nonzero typed API count. The role-freeze validator now checks and cross-links judge model/effort, the deterministic quiz checker, prompt/schema bundles, ChatGPT/no-API route, exact profile bindings, review policies, panel policy, instrument manifest, and conductor config. The retained verifier also reconstructs the expected freeze from exact qualification evidence. The terminal parser now accepts only the exact campaign-report field set and exact nested call-count schema, with `apiCalls = 0` required in that typed object.

The first retained-boundary rerun after that correction exposed a representation bug in the new validator: frozen substantive corpus identities are intentionally `sha256:<digest>` tagged. That adverse `31 pass / 24 fail` run is attempt 33. After accepting only that exact tagged form, the combined qualification, live-route, retained-activation, and final-attestation boundary suite passed `55/55`, and TypeScript passed again.

The final control-plane audit then found and retained additional gaps rather than smoothing them over. The GitHub collector now binds the exact github.com repository URL, retains exact raw query preimages, rejects unknown fields and noncanonical timestamps, and rechecks the immutable Recovery-A run plus current draft PR only during retained exact-C verification. Deterministic Recovery-C materialization remains offline and therefore does not impose an unrequested Recovery-B push before C can be generated. The exact-C workflow supplies only read permissions and `GH_TOKEN` to that read-only verifier.

Terminal NOT_READY verification now recomputes both zero-call/all-unavailable and nonzero-call/partial-qualifier outcomes, forbids every JSON and Markdown role-freeze artifact, preserves partial qualified-profile evidence, and never projects partial selections as fixed roles. Per-attempt receipts, retention records, execution evidence, sidecar bindings, preflight, ledgers, and reports reject undeclared API/fallback fields even after self-rehashing. Replay order and request-after-predecessor-completion chronology are enforced model-free.

After those corrections, the gate, blocked-state, replay, workflow-shape, and final-attestation suite passed `33/33`; TypeScript passed; and an independent control-plane audit found no remaining fail-open or lifecycle blocker. A separate immutable-evidence audit again proved the complete 154-file V1 tree, 157-file V2 tree, closed zero-call V3 tree, 19-file frozen semantic set, and all 116 certification/gold records byte-identical to starting HEAD.

The first seal-dependent focused run after remint passed `90/91`. Its only failure was a stale assertion: the shared preflight validator now rejects a self-rehashed object-shaped forbidden-provider-key marker before the retained wrapper can emit its older message. The rejection remained fail-closed; only the assertion was updated, and the adverse run remains recorded as attempt 55.

The affected retained qualification and activation suite then passed `26/26` against the reminted identities, including both truthful NOT_READY terminal shapes and every newly strict API/fallback evidence rejection.

A fresh disposable clean clone then staged the exact pending Recovery Commit A tree and passed the complete no-API suite: `2846 pass / 0 fail / 0 xfail / 0 xpass / 10 xenv / 39 skip`. The clone used the dedicated workflow's no-API/no-model environment and isolated npm cache. Its verification-only commit existed only in that disposable clone and was neither created in nor pushed from the authoritative worktree. Model/API calls remained `0/0`.

## Final local disposition

Secret/artifact, active private-path, merge-marker, and binary scans passed. Thresholds reproduced, all `116` certification cases returned `CERTIFIED_MODEL_FREE`, production/qualification parity reproduced, and the `456`-file production seal verified.

This bound ledger intentionally does not embed the final pre-live freeze hash: the freeze binds this ledger's bytes, so embedding the resulting freeze identity here would create a hash cycle. The freeze JSON and read-only verifier retain that final materialization result directly.

After deterministic rematerialization, the focused lifecycle suite passed `5/5`. A fresh same-branch clone then passed the complete no-API suite on the final sealed source: `2828 pass / 0 fail / 0 xfail / 0 xpass / 10 xenv / 39 skip`. The corrected report bindings were exercised by the read-only workflow-command test. Model/API calls remained `0/0`.

Recovery Commit A is locally eligible after this ledger is bound into a byte-identical verified preliminary freeze and the exact final tree passes the same clean-clone verification. This ledger grants no live-call authorization; exact-A push, dedicated V25 CI, corrected collector acceptance, clean-checkout reproduction, clean pre-live verification, and ChatGPT/no-API preflight remain mandatory.

This ledger grants no live-call authorization.
