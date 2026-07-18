# IMP-24B pre-verification worktree ledger

Status: `MODEL_FREE_PRE_LIVE_PASS`

Captured: `2026-07-13T09:02:40Z`

Authoritative continuation SHA-256: `5c42e1d063df42ae1a92e0c93abe9c086faeb6f270a5adbc358ff7646457b776` (verified)

## Starting identity

| Field | Value |
| --- | --- |
| Repository root | `.` (isolated `ChapterFlow-books-v25-live` checkout) |
| Branch | `feat/v25-pipeline-live` |
| Local HEAD | `19e1837e6d6d1f2ebc6997700956fc0798aa21ca` |
| Remote branch HEAD | `19e1837e6d6d1f2ebc6997700956fc0798aa21ca` |
| Draft PR #401 HEAD | `19e1837e6d6d1f2ebc6997700956fc0798aa21ca` |
| Merge base with `main` | `b8815ca028a492e09e62be57c17b29346bcce3a6` |
| Staged paths | none |
| V3 live attempts | `0` |
| API calls | `0` |

The old starting commit's dedicated V25 check was successful and root CI failed. Those results belong only to `19e1837e6d6d1f2ebc6997700956fc0798aa21ca` and authorize no V3 call.

## Failed pre-live candidate and recovery

The first normally pushed pre-live candidate, `445e09d3e9675f0c69f75a8b3601cd5ece729f40`, is retained in branch history with disposition `FAILED_PRE_LIVE_CANDIDATE_NONQUALIFYING`. It is the current local, remote, and draft-PR head, but it is not the effective implementation checkpoint.

Both exact-head dedicated V25 runs failed:

- push run `29251563638`: `FAILURE`, aggregate `2781 pass / 15 fail / 10 xenv / 39 skip`;
- pull-request run `29251566572`: `FAILURE`, the same aggregate.

Fourteen failures came from the disposable full-suite worktree being detached while the preservation guard correctly required the intended branch identity. One failure came from the shallow CI checkout omitting pinned starting commit `19e1837e6d6d1f2ebc6997700956fc0798aa21ca`. Root CI run `29251566727` also failed in `App Build + Tests / Type-check` and `E2E Smoke (prod build)`; those reproduce starting-tree failures locally, but the replacement SHA must prove that classification again.

The workflow correction fetches full history and creates the disposable suite worktree on a local `feat/v25-pipeline-live` branch. Execution-evidence hardening is being completed model-free at the same time. The next corrected normal commit becomes the effective Commit 1 only after its exact dedicated V25 CI passes. History will not be rewritten and no force-push will occur.

Live V3 model calls remain `0`; API calls remain `0`.

The correction source is now closed under focused model-free validation:

| Check | Result |
| --- | --- |
| TypeScript | `PASS` |
| Execution envelope | `18/18 PASS` |
| Forward reviewer executor | `10/10 PASS` |
| Live V3 adapter | `7/7 PASS` |
| V3 role runner and fatal latch | `11/11 PASS` |
| Retained qualification and activation boundary | `21/21 PASS` |

The recovery preserves exact process-boundary counts, every returned raw output, authoritative-output source, effective manifest and reviewer workspace, exact sidecar families, ChatGPT-only route provenance, typed no-response replay, session/auth cleanup, fatal-receipt chronology, and zero-call resume verification. The corrected identities have now been rematerialized and independently reproduced in a clean checkout. The replacement commit is ready to be created, but it becomes the effective Commit 1 only after its exact dedicated V25 CI succeeds.

## Historical evidence

The dedicated preservation tests pass `2/2`. Both evidence directories are clean in the working tree and match their frozen Git identities.

| Identity | Git tree | Required disposition |
| --- | --- | --- |
| V1 | `6e8b88c60ddf6972dc5f296926d4221c459d713f` | `INVALID_INSTRUMENT_DO_NOT_ATTEST` |
| V2 | `2522d62da3b17cc3de799c85172c5f5780df532c` | `BLOCKED_CALIBRATION_INVALID` |

## Intended IMP-24B paths

The exact tracked and new-file inventories are recorded in `IMP-24B_WORKTREE_LEDGER.json`. They cover the contract additions, shared review/envelope implementation, V3 corpus and certification, role-qualification conductor and retained-evidence verifier, CLI/workflow integration, and focused tests.

## Preserved prior IMP-24 work outside this task's execution scope

These paths are preserved and are not being executed under IMP-24B:

- `src/bakeoff/migration/imp24ActivationWorkflow.ts`
- `src/bakeoff/migration/imp24PilotGoldWorkflow.ts`
- `src/orchestrator/forwardActivationReadinessV2.ts`
- `src/orchestrator/forwardLocalActivationMaterializerV2.ts`
- `src/orchestrator/forwardRetainedCampaignEvidenceV3.ts`
- `tests/imp24-forward-local-acceptance-v2.test.ts`
- `tests/imp24-local-activation-v2.test.ts`
- `tests/imp24-pilot-gold-workflow.test.ts`

Several tracked files contain shared qualification and later-phase code. They are listed as mixed paths in the JSON ledger and must pass dependency/scope review before staging. No prior work is reset, cleaned, stashed, or discarded.

## Deliberately excluded generated debris

- `state/autopilot-logs/**`
- `state/books/**`
- `state/library-state.json.journal.jsonl`
- `state/metrics/**`
- `state/provenance/**`
- `state/qc-orchestrator/**`
- `state/qc/**`

These paths are untracked test/runtime output and must not be staged.

## Authentication boundary

No API credential, Codex temporary home, OAuth database, token file, or authentication material appears in the current intended path inventory. A dedicated secret/artifact guard will be rerun before staging and from the exact committed checkout.

## Corrected intended inventory

The generated implementation report now contains `112` sorted paths. That inventory exactly matches the complete tree diff from starting head `19e1837e6d6d1f2ebc6997700956fc0798aa21ca` after excluding only the enumerated runtime-debris globs. The active recovery delta atop failed candidate `445e09d3e9675f0c69f75a8b3601cd5ece729f40` is `30` tracked paths; `105` untracked runtime-debris files remain excluded and must not be staged.

## Current model-free pre-live verification

Verification completed at `2026-07-13T16:45:22Z`. The checkpoint is `READY_FOR_EFFECTIVE_COMMIT1`; live model calls and API calls remain `0/0`.

| Check | Result |
| --- | --- |
| TypeScript | `PASS` |
| Registered contracts | `PASS` (`16/16`) |
| Focused IMP-24 suite | `PASS` (`102/102`) |
| Static guard + certification regression | `PASS` (`13/13`) |
| Final clean named-branch full suite | `PASS` (`2808` pass, `0` fail, `10` xenv, `39` skip) |
| Workflow-equivalent post-suite sequence | `PASS` |
| Materialized artifact identities | `PASS` (`33/33` byte-stable) |
| Final repository hygiene | `PASS` (independently audited) |
| Clean checkout after certification | `PASS` |
| Canonical `state/books` files created | `0` |
| Live-route logs created | `0` |
| Model calls | `0` |
| API calls | `0` |

Current model-free identities:

- certification: `0870c20df24fbda8d5376723edc6a5c1a84a7fe8bce0e3095aa28ef46f01289e` (`CERTIFIED_MODEL_FREE`, `116` cases: reader `32`, source `42`, quiz `42`)
- production seal: `8ee638990c927fd9c6e15be8754512c0774da0065ce793851927eecde88f4187` (`455` files; artifact bytes `773d14a1027ce1e19da8a9b4d31e308a116fdaed221533a33c7efa4e42792fd1`)
- pre-live freeze: `e35f2a4fff9d4e647139ecb07a7419086f784f8b2b26e2f296c57307a354ded2`
- artifact manifest: `a183ac2fa3b7cb1ba4d620bbe5a199e555708dc2c26a5c4b0de2348f1ea5a068` (`33` entries)
- production/qualification parity: `9f1bfa674b8e69827e26e0e683f1e49ed01698ef0620ed7880c7fb7be80edd81`
- thresholds: `8f16369a655a8ea6bf392a5d00c875c1619e4c9c43ec605474c892f75f6450aa`

The final correction sequence retained every adverse attempt:

1. A clean-checkout seal mismatch exposed ignored `.DS_Store` as a real portability defect; exact generated basenames are now excluded and the focused seal suite passed `8/8`.
2. The next full suite passed `2808/0`, then the workflow clean-tree gate exposed eight certification-created book-run pointers as a real purity defect.
3. The pure certification projection passed TypeScript and `7/7` certification tests; focused IMP-24 passed `102/102`.
4. A later full suite produced `2807/1`; a fresh rerun reproduced the sole static-guard failure caused by a forbidden literal in a comment. The comment-only correction passed TypeScript and `13/13` focused tests.
5. The final artifact remint reproduced all `33` identities.
6. The first independent clean-clone dependency install hit the host npm-cache ownership error and was retried with an isolated cache.
7. One full-suite attempt exported that cache only during installation, so seven publish-final fixtures later inherited the broken host cache (`2801/7`). The exact workflow-wide cache environment corrected the reproduction, which then passed `2808/0`.
8. The final primary-checkout sequence reproduced legacy closure, seal, thresholds, all `116` certification cases, and the freeze while leaving the checkout clean with no live-route or canonical book-state files.
9. A broad V3 filename scan matched preserved, unrelated Stage-Q owner-input evidence; the successor-experiment-specific scan was empty. Final JSON, inventory, secret/artifact, private-path, merge-marker, binary, whitespace, V1/V2 preservation, and identity cross-binding checks all passed, and an independent read-only audit found no discrepancy.

## Superseded pre-candidate model-free verification results

Verification completed at `2026-07-13T12:51:39Z`. No V3 live attempt or API call occurred.

These results truthfully describe the bytes used to create failed candidate `445e09d3e9675f0c69f75a8b3601cd5ece729f40`, but they are not current authorization. The corrected source must be reminted and the entire model-free workflow rerun before a replacement effective implementation commit.

| Check | Result |
| --- | --- |
| TypeScript | `PASS` |
| Registered contract validation | `PASS` (`16/16`) |
| Focused clean-clone suites | `PASS` (`148/148`) |
| Full clean same-branch clone suite | `PASS` (`2796` pass, `0` fail, `10` xenv, `39` skip) |
| Workflow-equivalent model-free sequence | `PASS` |
| Materialized artifact identities | `PASS` (`33/33` byte-stable) |
| V1/V2 preservation | `PASS` (`2/2`) |
| Live-route logs created | `0` |
| Model calls | `0` |
| API calls | `0` |

The first disposable full-suite attempt was not hidden: it produced `2770` passes and `25` failures. Three failures exposed real IMP-24 regressions and were fixed: the safe evidence-envelope kind was absent from an artifact allowlist, two live-validation fixtures retained obsolete 64-hex content hashes, and migration source resolved `CODEX_HOME` ambiently instead of accepting the outer CLI's injected cache path. The other `22` failures were reproduced as disposable-checkout branch identity or npm-cache setup failures. Targeted regression tests passed `39/39`; same-branch activation tests passed `15/15`; isolated-cache publish-final tests passed `12/12`; then the decisive clean same-branch full suite passed with zero failures.

Two artifact-stability diagnostic commands also failed before the correct check passed: one used the wrong relative report path and one included directories in the hash glob. A temporary stale production seal was separately rejected fail-closed after a source change and then reminted. The JSON ledger retains each attempt and its classification.

The active-source private-path scan likewise had one transparent command-path error when it was first invoked from the repository root with pipeline-relative arguments. Re-running it from the pipeline root produced no matches in active source, config, or package metadata.

The final stability shell loop had one additional command error because its first form used zsh's reserved `path` parameter as a loop variable, removing command lookup. The corrected loop used a non-reserved variable; a second model-free materialization then left all `33` artifact identities byte-identical.

After the owner-authorized preliminary counters and the inventory-filter fix, the exact-source full suite again reached `2796` pass, `0` fail, `10` xenv, and `39` skip. Its result-collection wrapper then attempted to assign zsh's read-only `status` parameter after the suite had already written its terminal aggregate; that wrapper error is retained separately and does not replace the complete green test result. A final rematerialization remained byte-stable for all `33` identities.

The final combined live-route-file scan found the already ignored `logs/exec/cli-qualification.json`. Inspection classifies it as a pre-capture Codex CLI flag-capability probe (`probedAtIso: 2026-07-13T01:27:58.063Z`) with no experiment or operation identity. It is excluded from staging and is not a V3 live attempt. The active-source private-path and merge-marker portions of that scan were clean.

The first exact staging attempt was blocked before any staging because the linked-worktree Git index lives under parent-repository metadata outside the workspace write sandbox. The retry uses the same `109`-path allowlist with only the Git-index permission widened.

That permission retry reached Git, but the temporary NUL-delimited pathspec had concatenated its entries. Git rejected the impossible combined path and again staged nothing. The next retry uses Git's newline-delimited pathspec mode after machine-checking that every intended path is newline-free.

Superseded pre-candidate model-free identities:

- certification: `b1661f217f93d3ed8e79c2ebbe788ef01c927d35b4c530d6d73b68a2fb42f815`
- production seal: `9f2555252102d892f08af06270ae86c70ce90699b1068b04302b4797558d145a`
- pre-live freeze: `369b4f856fe633be554fe34ed9b5e3d02494c0437b83329f00e5df8423214c20`
- production/qualification parity: `bb0ec1cd0927d3746e3c509b84858df576f47c1e624a40317f26d6c0de517fdf`

The first cached whitespace validation found an extra blank line at EOF in two new TypeScript files. Only those blank lines were removed. Because one file is inside the sealed source inventory, the production seal, certification, and pre-live freeze were reminted before revalidation.

The complete full model-free suite was then rerun on those final sealed source bytes with the corrected result collector: `2796` pass, `0` fail, `0` xfail, `0` xpass, `10` xenv, and `39` skip; process exit `0`.

## Authorized report lifecycle

The frozen `worker-implementation-report-v1` validator accepts `promptId` values matching `IMP-NN`, while this continuation requires the literal identity `IMP-24B`. The preliminary report therefore preserves compatibility as `promptId: "IMP-24"` with `continuationPromptId: "IMP-24B"`; the frozen validator was not weakened.

The preliminary report keeps `implementationCommit` and `evidenceCommit` null because neither commit exists yet. The owner authorized the following final lifecycle without validator changes or self-reference:

1. Commit 1 retains implementation and the preliminary pre-live freeze.
2. Commit 2 retains qualification evidence and binds Commit 1.
3. Commit 3 is the final attestation and binds both earlier commit SHAs.

The authorization was received as an owner attachment with SHA-256 `ae138a2ca561f257df3da69043db3f70ec4615c807fd77600d3201fae2dec8ab`. No fourth lifecycle layer, Git note, custom tag, fabricated SHA, or mutable external identity is permitted.
