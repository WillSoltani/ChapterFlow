# IMP-24B pre-verification worktree ledger

Status: `PRE_LIVE_VERIFIED`

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

## Final intended inventory

The final intended commit inventory is the sorted `filesChanged` array in `implementation-report.imp-24.json`: `109` files. It incorporates all post-capture source, contract, corpus, certification, parity, freeze, report, and regression-test additions. The deliberately excluded runtime debris remains outside that inventory. An exact set comparison initially caught one omitted tracked schema (`forward-gold-sweep.schema.json`); the generator filter and regression assertion were corrected, and the `109/109` inventories now match exactly.

## Model-free verification results

Verification completed at `2026-07-13T12:51:39Z`. No V3 live attempt or API call occurred.

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

Final model-free identities before Commit 1:

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
