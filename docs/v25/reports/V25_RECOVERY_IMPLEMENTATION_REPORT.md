# V25 Recovery Implementation Report

Date: 2026-07-15. Operator: Claude Fable 5 (ultracode recovery session). Model calls = 0. API calls = 0. Replays = 0. Live calls = 0.

## Identity

- Starting SHA (audited baseline, remote `feat/v25-pipeline-live` head): `50b4d8b7027f7555551f26d82d868174e7087d8e`
- Ending SHA: the fourth recovery commit on `recovery/v25-pipeline-repair` (this document's commit; see `git log 50b4d8b7..`)
- Authoritative worktree: `/private/tmp/ChapterFlow-books-v25-recovery` (fresh, isolated; created from the verified remote head; no dirty worktree reused)
- Branch: `recovery/v25-pipeline-repair`, fast-forward descendant of `50b4d8b7`; push target `feat/v25-pipeline-live` (draft PR #401, stays draft)

## Commits and exact files changed (17 files, +918/−70 vs baseline; 9 production files, +583/−67 production lines)

1. `33349c045` — root compile/build boundary
   - `tsconfig.json` (root): exclude `scripts/book/prompts/chapterflow-v24-author-pipeline/state/**` (inert, registry-hashed evidence; pipeline `src/`+`tests/` remain root-compiled so root keeps v24 type coverage)
   - `…/src/exec/executionEnvelope.ts`: local `HermeticEnvMap` alias replaces `NodeJS.ProcessEnv` for allowlist-built env values (hermetic semantics unchanged)
   - `…/src/orchestrator/codexAgent.ts`: `HermeticEnvMap` through `CodexRunnerArgs`; one explicit cast at the OS `spawn` boundary
   - `…/tests/hostile-context.test.ts`, `…/tests/forward-reviewer-executor.test.ts`: drop now-unneeded casts; ES2017-portable regex
   - NEW `…/tests/root-compile-boundary.test.ts` (3 tests pinning both directions of the boundary)
2. `480aaab56` — historical vs active-candidate instrument identity
   - `…/src/orchestrator/forwardProductionInstrumentSeal.ts`: `IMP24F_…_REL_PATH` + `verifyHistoricalForwardProductionInstrumentSeal` (self-hash + recorded-binding pin; never rebuilds from checkout)
   - `…/src/bakeoff/migration/imp24InstrumentCertification.ts`: `loadRetainedImp24RolePromptSourceHashes` (sidecars pinned to the retained binding aggregate) + optional `retainedPromptSourceHashes` on `prepareImp24QualificationCases` (historical replay only)
   - `…/src/bakeoff/migration/imp24ObservabilityFreeze.ts`: build/verify paths source everything from RETAINED artifacts (`loadRetainedImplementationArtifacts`); certification recompute removed from the closed lifecycle; git-blob anchoring and all byte pins unchanged
   - NEW `…/src/bakeoff/migration/imp24fCandidateInstrument.ts`: candidate generation (manifest schema/build/validate; current-bytes verify; mint)
   - `…/src/bakeoff/migration/cli.ts`: `imp24-certify-instrument` and `forward-verify-production-instrument-seal-v2` verify BOTH generations by name; `--write` mints ONLY `contracts/imp24f`; `forward-materialize-production-instrument-seal-v2` default output → imp24f
   - `.github/workflows/chapterflow-v25-pipeline.yml`: step names/comments state the identities (commands unchanged)
   - `…/tests/imp24-transport-smoke-v3.test.ts`: historical replay stamps retained hashes
   - NEW `…/tests/imp24f-candidate-instrument.test.ts` (4 tests)
3. `c308130c2` — mint imp24f candidate generation (after last instrument byte change)
   - NEW `…/state/migration-experiments/contracts/imp24f/{forward-production-instrument-seal, instrument-certification-binding, instrument-candidate-manifest}.json`
   - validator fix (corpus identity keeps its `sha256:<hex>` form) + test fixture alignment
4. (this commit) — recovery reports: `V25_RECOVERY_AUDIT.md`, `V25_RECOVERY_DECISION.md`, this report, `V25_EVIDENCE_RETENTION_AND_PR_SPLIT_PROPOSAL.md`

## Root cause for each original failure

| Failure (at `50b4d8b7`) | Root cause | Repair |
|---|---|---|
| `IMP-24C dedicated model-free CI commands preserve every checkout byte` — `imp24-certify-instrument` → `ForwardProductionInstrumentSealError` | Retained imp24 seal (completed V3-final campaign) compared against current bytes after the authorized successor changed 8 sealed files + added 5 in-scope files | Candidate imp24f seal binds current bytes; retained imp24 seal verified as history (self-hash + binding pin) |
| 3× `IMP-24D …` transport-smoke tests — `certification prompt bundle binding mismatch` | Historical R2 replay re-derived prompt hashes from current checkout under the NEW 5-field recipe; retained binding pins the OLD 3-field recipe over OLD bytes (reproduced bit-for-bit in the audit) | Historical replay stamps the RETAINED per-role hashes, fail-closed against the retained binding aggregate |
| `IMP-24D observability freeze is deterministic…` — `retained current certification differs from the model-free recomputation` | Closed-lifecycle freeze recomputed certification with CURRENT in-code semantics even over pinned-commit bytes | Freeze builds/verifies from retained artifacts only; no recompute inside a closed lifecycle |
| Root `tsc`/`build` (446 errors; `NODE_ENV` missing in `{}`) | Root program swept inert `state/**` snapshots + applied Next's `NODE_ENV`-required `ProcessEnv` and ES2017 target to pipeline-only code | Narrow root exclude; local env-map type; portable regex; boundary regression-tested |

## Historical vs active identity behavior (design outcome)

- HISTORICAL (v1, v2, v3-envelope, r1, r2, final): verified by self-hash, internal cross-pins, byte pins, and git-blob anchoring at recorded commits. Never compared to current checkout bytes. Old evidence remains closed and non-qualifying (`mayQualifySuccessor: false` is validator-enforced).
- ACTIVE CANDIDATE (`imp24f-semantic-repair-1`, manifest `1d70fe9523d4…`): seal `1c429b8c…` (471 files) and certification `01c75bb7…` (fresh identity; predecessor `ff4e1242…` untouched) recomputed from and compared against CURRENT bytes, fail-closed on drift. Shared frozen inputs (corpus `sha256:45018096…`, thresholds `8f16369a…`) are byte-identical retained artifacts, referenced not copied.
- Commands state their identity: `imp24-certify-instrument` and `forward-verify-production-instrument-seal-v2` verify both generations by name; `--write` can only mint imp24f.

## Immutable evidence proof

- `git diff --name-status 50b4d8b7..HEAD -- …/state docs/v25/reports` → ONLY 3 additions under `contracts/imp24f/` (+ the 4 new recovery reports); **0 modifications** under `state/**`.
- `git diff --quiet 50b4d8b7..HEAD -- …/contracts/imp22 …/contracts/imp24 …/s16-forward-role-qualification-v1 …/-v2 "…/s16-forward-role-qualification-v3-envelope*"` → exit 0 (byte-identical).
- No live-route logs: `logs/exec` contains 0 files. Call ledgers untouched.

## Exact local commands and unedited result summaries

| Gate | Command (recovery worktree) | Result |
|---|---|---|
| Focused repaired classes | `npx tsx tests/run.ts imp24-transport-smoke-v3 imp24-observability-freeze` / `… imp24f-candidate-instrument imp24-pre-live-freeze forward-production-instrument-seal` / `… hostile-context exec-envelope forward-reviewer-executor root-compile-boundary codex-agent` | 17/17, 17/17, 36/36 pass |
| Package typecheck | `npx tsc -p . --noEmit` | exit 0 |
| Contract validation | `node --import tsx src/cli.ts contract-validate` | `contract-validate: PASS` |
| Root typecheck | `npm run typecheck` | exit 0 (was 446 errors) |
| Root build | `npm run build` | exit 0 (was type-error abort) |
| Full no-API suite (once, CI-equivalent detached disposable worktree) | `CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx tests/run.ts` | **pass 2943 fail 0 xfail 0 xpass 0 xenv 10 skip 39**, exit 0 |
| Hygiene | `git diff --check`; staged secret/artifact + style guards per commit | clean / passed |

Note (§15 of the audit): the first two full-suite invocations ran on the named local recovery branch and failed 26 retained-evidence/activation tests on the branch-identity precondition (`feat/v25-pipeline-live` or detached required) — environmental, diagnosed, and re-run once in the identity the gate explicitly requires. No gate was edited.

## Requirements kept / repaired / deferred / rejected

Kept: evidence immutability; thresholds/labels/case sets/candidate order; the IMP-24F semantic repair itself; workflow read-only lifecycle verification; `BLOCKED_NEEDS_INDEPENDENT_GOLD`.
Repaired: seal/certification lifecycle identity; observability-freeze historical verification; historical smoke replay derivation; root compile boundary.
Deferred: IMP-14/IMP-15–17 packages (checkpoint sibling only); evidence relocation (proposal doc, owner-gated); near-clone C/D attestation stacks (duplication debt recorded, not a failing gate).
Rejected: Option A (rollback+port — larger, not curative), Option C (in-place reseal — rewrites completed V3 meaning).

## PR delta after recovery

Recovery adds 17 files / +918 −70 on top of PR #401's 6,664 files. The payload boundary is unchanged by this recovery and remains a merge blocker; see `V25_EVIDENCE_RETENTION_AND_PR_SPLIT_PROPOSAL.md`.

## CI observation

A single normal fast-forward push to `feat/v25-pipeline-live` is made only if the remote head still equals `50b4d8b7…` at push time. The triggered exact-head run IDs, URLs, and conclusions are recorded in the operator's final report to the owner (append-only observation; no rerun of a failed CI, no second push).

## Remaining blockers and next authorized action

- BLOCKER (unchanged, explicit): `BLOCKED_NEEDS_INDEPENDENT_GOLD` — owner-approved, independently adjudicated, reader-rubric-specific, previously unused gold (IMP-24F: 10 controls audited, 0 eligible). Carried in the candidate manifest.
- BLOCKER (merge): evidence/runtime retention boundary for PR #401 (~92% evidence payload) — owner decision on the split proposal.
- Next authorized action: owner sources/approves independent reader gold; then offline re-certification at the exact implementation commit per IMP-24F.

## Explicit non-actions

No merge, no force-push, no history rewrite, no deploy/publish/promote/upload, no SOL activation, no book/chapter mutation, no threshold weakening, no relabeling, no holdout/case replacement, no retry-until-pass, no live qualification, no model/API/replay calls, no edits to any retained evidence byte, no reuse of any dirty worktree, no changes to the primary checkout's untracked files.
