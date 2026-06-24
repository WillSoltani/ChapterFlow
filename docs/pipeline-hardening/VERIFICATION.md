# ChapterFlow v21 Hardening Verification

Date: 2026-06-23 America/Halifax

## Scope

- Branch: `fix/v21-pipeline-hardening-2026-06`
- Fetched remote: `origin/fix/v21-pipeline-hardening-2026-06`
- Baseline verified commit: `dd8e4370a1273e54cb3de93d36483f4ba4eb532d`
- Repository: `/Users/radinsoltani/ChapterFlow-books`
- Primary pipeline package: `scripts/book/prompts/chapterflow-v21-authored`

## Baseline Environment

- Node: `v20.20.2`
- npm: `10.8.2`
- pnpm/yarn: not installed
- OS: `Darwin WillInBC-Shell-I.local 25.5.0 Darwin Kernel Version 25.5.0: Mon Apr 27 20:38:00 PDT 2026; root:xnu-12377.121.6~2/RELEASE_ARM64_T8103 arm64`
- Initial tracked worktree: modified `src/qc/publishAfterQc.ts` and `tests/publish-after-qc-git.test.ts` already present before this verification; many untracked local production/state artifacts were present and not staged broadly.

## Clean Clone Procedure

Fresh clone path: `/private/tmp/chapterflow-v21-verify.Zkym7n/ChapterFlow`

Commands and results:

| Command | Result |
| --- | --- |
| `git fetch --all --prune` | PASS, local branch and origin both at `dd8e4370a1273e54cb3de93d36483f4ba4eb532d` |
| `git clone --no-hardlinks --branch fix/v21-pipeline-hardening-2026-06 /Users/radinsoltani/ChapterFlow-books /private/tmp/chapterflow-v21-verify.Zkym7n/ChapterFlow` | PASS |
| `npm ci` | PASS, 635 packages installed from `package-lock.json`; npm reported 5 audit findings unrelated to this verification |
| `npm run pipeline:typecheck` | PASS |
| `npm run pipeline:test` | PASS after rerun outside sandbox because `tsx` IPC pipe creation was blocked by the sandbox; result `pass 765 fail 0 xfail 0 xpass 0 skip 0` |
| `npm run pipeline:build` | PASS |
| `npm run pipeline:doctor` | PASS, `DOCTOR - 0 fatal, 0 warning(s)` |
| `npx tsx src/cli.ts migrate-state` | PASS, no shadow state to migrate in clean clone |
| `npx tsx src/cli.ts state-status` | PASS, no untracked chapters in clean clone; deterministically reported 20 `unreasonable-hospitality` chapterId/filename mismatches |
| `npx tsx src/cli.ts rebuild-library-state --dry-run --json` | EXIT 1 by design: deterministic drift report, no write; `stored logical state differs from recomputed authoritative chapter/package state` |

## Root Causes Confirmed

- `doctor --json` accepted the flag but printed human text, so machine-readable doctor could not be consumed by automation. Regression first failed with `Unexpected token 'D', "DOCTOR - 0"... is not valid JSON`.
- `publish-after-qc` detected registry files only by comparing before/after bytes for the current `register-web` invocation. A prior partial run or operator edit could leave `books.json` or registry files dirty from `HEAD` but unchanged during this invocation, so the publish plan could omit required registration files or flag a pre-staged `books.json` as outside the plan.
- The Anthropic API adapter always sent `temperature`; the hermetic fake-SDK regression showed Opus 4.7-class payloads included unsupported sampling fields. Per the operator request, no live Claude/Anthropic/Claude-CLI verification was performed.

## Fixes Applied

- Added `doctor --json` structured output with `status`, `exitCode`, summary counts, and findings while preserving existing human output and exit-code policy.
- Updated publish-after-QC registry planning to include pipeline `books.json` and to stage registry/registration files that differ from `HEAD` according to `git status --porcelain`, including modified, staged, untracked, and renamed destination paths.
- Added a provider-boundary guard that omits sampling fields for Anthropic Opus 4.7-class model names; the regression uses a fake local SDK module only.
- Updated operator README only for the new `doctor --json` automation behavior.

## Final Verification Commands

Final verification was run from `/Users/radinsoltani/ChapterFlow-books` with live model environment variables removed:

```bash
env -u ANTHROPIC_API_KEY -u OPENAI_API_KEY -u CHAPTERFLOW_PROVIDER -u CHAPTERFLOW_CLAUDE_BIN npm run pipeline:typecheck
env -u ANTHROPIC_API_KEY -u OPENAI_API_KEY -u CHAPTERFLOW_PROVIDER -u CHAPTERFLOW_CLAUDE_BIN npm run pipeline:test
env -u ANTHROPIC_API_KEY -u OPENAI_API_KEY -u CHAPTERFLOW_PROVIDER -u CHAPTERFLOW_CLAUDE_BIN npm run pipeline:build
env -u ANTHROPIC_API_KEY -u OPENAI_API_KEY -u CHAPTERFLOW_PROVIDER -u CHAPTERFLOW_CLAUDE_BIN npx tsx src/cli.ts doctor --json
env -u ANTHROPIC_API_KEY -u OPENAI_API_KEY -u CHAPTERFLOW_PROVIDER -u CHAPTERFLOW_CLAUDE_BIN npx tsx src/cli.ts migrate-state
env -u ANTHROPIC_API_KEY -u OPENAI_API_KEY -u CHAPTERFLOW_PROVIDER -u CHAPTERFLOW_CLAUDE_BIN npx tsx src/cli.ts state-status
```

Results:

- Typecheck: PASS.
- Complete no-network/no-API test suite: PASS, `pass 769 fail 0 xfail 0 xpass 0 skip 0`.
- Build: PASS.
- Doctor JSON: PASS, `status: ok`, `exitCode: 0`, `summary: fatal 0, warnings 0, ok 38, total 38`.
- Migration dry-run: PASS, shadow `/state/chapters` has no chapter files in the working tree.
- State audit in the working tree: PASS as an audit command, but reports local untracked production chapter artifacts and the known `unreasonable-hospitality` ID mismatch. These artifacts were pre-existing/unrelated and were not staged.

## Regression Matrix

| Required regression | Result | Evidence |
| --- | --- | --- |
| 1-of-N, missing, extra, duplicate, reordered promotion fail without production mutation | PASS | `tests/chapter-set.test.ts`, `tests/promote-gate.test.ts` |
| Valid full book promotes transactionally and manifest independently verifies; tampering fails | PASS | `tests/promote-gate.test.ts`, `tests/production-manifest.test.ts` |
| Cached malformed/edited/stale chapters are re-gated before ingestion | PASS | `tests/cache-validation.test.ts` |
| Interrupted research persists completed sidecars and resumes only missing calls | PASS | `tests/research-resume.test.ts` |
| Flat, sectioned, and legacy TOCs canonicalize; partial sidecars never define completeness | PASS | `tests/toc-contract.test.ts`, `tests/source-anchored-planning.test.ts` |
| Source-realness and source-integrity failures block authoring and promotion | PASS | `tests/source-integrity.test.ts`, `tests/source-verify.test.ts`, `tests/no-api-promote.test.ts` |
| Live library lock cannot be stolen and old owner cannot release successor | PASS | `tests/library-state.test.ts`, `tests/autopilot.test.ts` |
| Revising a chapter subtracts old and adds new library contributions; rebuild matches incremental state | PASS | `tests/library-state.test.ts` |
| Malformed chapter/book/config/QC JSON returns structured findings and never crashes a public gate | PASS | `tests/runtime-schema-boundary.test.ts`, `tests/qc-repair-ledger.test.ts` |
| Deterministic/no-API commands work without provider SDKs or model CLIs | PASS | `tests/provider-contract.test.ts`, `tests/package-contract.test.ts` |
| Anthropic Opus 4.7-class payload omits unsupported sampling fields | PASS | `tests/provider-contract.test.ts`; fake SDK only, no live Claude/Anthropic call |
| Generation fallback debt is persisted and unresolved serious debt blocks promotion | PASS | `tests/generation-degradation.test.ts`, `src/promoteBook.ts` |
| Raw uncorroborated sweep evidence on unchanged carried content yields effective PASS, no blocking ledger finding, and PUBLISHABLE | PASS | `tests/qc-finalize-evidence.test.ts`, `tests/sweep-chapter-status.test.ts` |
| Mixed sweep membership writes only effective failed chapters to ledger | PASS | `tests/qc-effective-ledger.test.ts`, `tests/sweep-chapter-status.test.ts` |
| Two independent same-defect sweep reads block; unrelated defects on same chapter do not corroborate | PASS | `tests/sweep-chapter-status.test.ts`, `tests/sweep-two-round-confirm.test.ts` |
| Raw primary bar major plus GREEN tiebreak aggregate leaves no blocking raw-bar ledger finding | PASS | `tests/qc-effective-ledger.test.ts`, `tests/bar-tiebreak.test.ts` |
| Malformed repair-ledger JSONL fails closed with a line number | PASS | `tests/qc-repair-ledger.test.ts` |
| QC provenance/session independence and concurrent transaction tests pass | PASS | `tests/qc-session-independence.test.ts`, `tests/qc-transaction.test.ts` |
| Publish-after-QC registry/registration dirty files are in-plan and committed atomically | PASS | `tests/publish-after-qc-git.test.ts` |
| Doctor supports machine-readable mode | PASS | `tests/generation-experience.test.ts`, `src/cli.ts doctor --json` |

## Package Manifest Verification Example

`tests/production-manifest.test.ts` builds a synthetic v21 package, runs `verifyProductionPackage`, and exercises the CLI path:

```bash
npx tsx src/cli.ts verify-production-package <synthetic-package-path> --compare-loose-state
```

The test verifies PASS on the valid package and FAIL on package content, canonical index, source/QC evidence, manifest hash, and package ordering tampering. Missing claimed source evidence fails closed and leaves package bytes unchanged.

## Proof Of No Live Model Call

- Final verification commands explicitly unset `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `CHAPTERFLOW_PROVIDER`, and `CHAPTERFLOW_CLAUDE_BIN`.
- The pipeline test script forces `CHAPTERFLOW_NO_API_CODEX_QC=1`.
- `tests/provider-contract.test.ts` installs fake local SDK modules under the provider test fixture and records payloads locally; it does not import or call real OpenAI/Anthropic services.
- No `claude`, OpenAI, Anthropic, or Claude CLI command was run during verification after the operator requested no Claude part.
- Network use was limited to the required clean-clone `npm ci` dependency install from the declared lockfile.

## State Migration And Audit Summary

- Clean clone `migrate-state`: no shadow `state/chapters` directory to migrate; canonical state used.
- Clean clone `state-status`: no untracked chapter artifacts; deterministic report of 20 `unreasonable-hospitality` `chapterId != filename` mismatches.
- Clean clone `rebuild-library-state --dry-run --json`: parsed authoritative state and reported deterministic library drift (`stored logical state differs from recomputed authoritative chapter/package state`) without writing.
- Working tree `state-status`: reports many local untracked production chapter artifacts and the same `unreasonable-hospitality` ID mismatch class. These were not staged for this verification commit.

## Remaining Accepted Risks

- The repository contains pre-existing untracked local production/state artifacts in this checkout. They are intentionally excluded from the commit and should be handled by the operator outside this hardening verification.
- `rebuild-library-state --dry-run --json` reports deterministic library-state drift. The command is fail-closed and made no writes; this verification treats it as catalog/index drift surfaced for operator remediation, not as a silent blocker bypass.
- No live provider/network model smoke test was run, per the operator instruction not to do the Claude part.

## Recommendation

Safe for unattended production promotion after this commit, subject to the existing policy that promotion must still pass `publish-after-qc`, source verification, QC provenance/session checks, production manifest verification, and the local operator's cleanup of unrelated untracked production artifacts before those artifacts are intended to ship.
