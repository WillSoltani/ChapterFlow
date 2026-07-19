# Spec: WS7-010 TypeScript Project-Boundary Migration

**Author:** Codex release orchestration
**Date:** 2026-07-19
**Status:** Ready for Owner Approval — implementation not started
**Reviewers:** ChapterFlow owner, web-app TypeScript owner, book-pipeline owner
**Independent review:** APPROVED — architecture, CI/rollout, and adversarial coverage;
zero remaining actionable findings
**Planning base:** `ff0696e08b20f462f050d1df71a71149891ecb06` (`main`, merge of PR #415)
**Related work:** WS7-010; PR #415; active v25 PRs #401 and #406; active security PR #416

## Context

PR #415 completed the five WS7 testing-quality base findings and merged normally as
`ff0696e08`. The first WS7-010 probe then showed that the repository's root
`tsconfig.json` is not an application-only project: its global `**/*.ts`/`**/*.tsx`/
`**/*.mts` includes also compile the offline book pipelines. Enabling
`noUncheckedIndexedAccess` at that root produced 3,341 diagnostics in 520 files. Of
those, 2,841 diagnostics in 405 files were under `scripts/book/**`; 500 diagnostics in
115 files were outside that tree.

The required fix is a project-boundary migration before any advanced flag is enabled.
It must separate application and book-pipeline typechecking without making either
surface disappear. The current all-files program remains the coverage oracle, and a
machine gate must prove that the union of the new programs covers it on every local and
CI run.

### 1.1 Exact clean-checkout baseline

Measured on Node `20.20.2` and TypeScript `5.9.3` from a clean worktree at
`ff0696e08`:

| Evidence | Count |
|---|---:|
| Compiler program files including TypeScript libraries and dependencies | 5,206 |
| Repository-local files in the current root program | 1,940 |
| Repository-local files outside `scripts/book/**` | 1,090 |
| Repository-local files under `scripts/book/**` | 850 |
| v21-authored files in the root program | 334 |
| v24-author-pipeline files in the root program | 499 |
| Other `scripts/book` files in the root program | 17 |
| Tracked TS/TSX/MTS/CTS files outside the current root program | 44 |

The 44 tracked TypeScript-family files outside the current program are 37 `infra/**`
files, five top-level v24 `scratch/**` files, and two files under the hidden
`app/.well-known/**` directory. They are not part of the 1,940-file preservation
contract. Existing infra build/test gates remain authoritative for `infra/**`.

The current root exclusion `scripts/book/prompts/*/scratch/**` does **not** match the
pipelines' `src/scratch/**` directories. Consequently, 54 `src/scratch` files are in
the current root program even though the v21 and v24 package-local configs exclude
them. This migration MUST preserve those 54 files. Correcting that historical glob is
a separate owner decision, not boundary work.

A feasibility simulation of the proposed selectors produced a 1,090-file app program
and a 1,062-file book program. The book program legitimately pulls 212 repository-local
non-book dependencies; their union is the exact 1,940-file current program. Thirty-one
direct imports flow from book code into app/shared code, while no current app import
pulls a `scripts/book/**` source. Overlap is therefore expected; app-to-book flow is
not.

### 1.2 Current single-flag probes

These are planning estimates from independent single-flag probes against the current
combined program, not promises about cumulative fallout:

| Flag | Total errors/files | Outside `scripts/book` | Under `scripts/book` |
|---|---:|---:|---:|
| `noUncheckedIndexedAccess` | 3,341 / 520 | 500 / 115 | 2,841 / 405 |
| `noImplicitReturns` | 9 / 9 | 9 / 9 | 0 / 0 |
| `noFallthroughCasesInSwitch` | 0 / 0 | 0 / 0 | 0 / 0 |
| `exactOptionalPropertyTypes` | 911 / 311 | 388 / 166 | 523 / 145 |

### 1.3 Known live ownership dependencies

The ownership scan immediately after PR #415 merged found shared-file work that the
implementation must compose rather than overwrite:

- open PR #401 (`feat/v25-pipeline-live`) changes root `tsconfig.json` to exclude
  `scripts/book/prompts/chapterflow-v24-author-pipeline/state/**`; that branch also
  adds 34 tracked TS-family files beneath the excluded path, so copying the broad
  exclusion would make newly landed book code invisible to the root program;
- retained remote v25 branch `origin/impl/v25-evaluator-selection` carries that same
  exclusion and adds root `pipeline24:typecheck` and `pipeline24:test` commands;
- open evidence PR #406 remains book/v25-owned even though its current diff does not
  own the root config or root package file; and
- open security PR #416 does not currently own the boundary config files, but it
  changes app/security code that can overlap the first app-flag repair set.

WP-TSB-01 MUST NOT be published until the v25 owner has resolved or explicitly
approved composition of the root config/package contracts. The `pipeline24:*`
commands must be retained if their owning line lands. The broad v24 state exclusion
MUST NOT simply be copied into the oracle or book config: the owner must either make
the 34 files part of `typecheck:book` or approve an explicit, path-level non-source
exception that the verifier reports. Before the first app-flag baseline, PR #416 must
either be merged or have an owner-declared frozen head that is merge-simulated into
the candidate base.

### 1.4 Shared book-sensitive dependency closure

The app and book programs are not behaviorally independent merely because their root
paths differ. At the planning base, the 1,062-file book program contains 212
repository-local non-book dependencies that are also in the app program. Define:

`sharedBookDependencies = repoLocal(appProgram ∩ bookProgram) - scripts/book/**`

The TS/TSX/MTS/CTS subset is `sharedSourcePaths`. Book tooling executes these real
sources at runtime, so a green `typecheck:book` proves type compatibility but not
behavioral non-impact. Single-flag probes already intersect this protected closure:

| Flag | Shared diagnostic files |
|---|---:|
| `noUncheckedIndexedAccess` | 4 |
| `noImplicitReturns` | 0 |
| `noFallthroughCasesInSwitch` | 0 |
| `exactOptionalPropertyTypes` | 25 |

The first four paths are `app/app/api/book/_lib/fsrs.ts`,
`app/book/data/bookChapters.ts`, `app/book/data/bookPackages.ts`, and
`lib/catalog-integrity.ts`. The 25-file final-flag intersection is chiefly repository,
ingestion, and catalog code under `app/app/api/book/_lib/**`, plus
`app/book/data/book-package-core.ts`, `app/book/data/bookChapters.ts`, and
`app/book/lib/v21-adapter.ts`. These are app-located but book-sensitive. A flag PR
MUST NOT repair them merely because they are outside `scripts/book/**`.

## Functional Requirements

- FR-1: **Immutable coverage oracle.** The migration MUST preserve a TypeScript
  config whose file-discovery semantics match the pre-migration root `tsconfig.json`
  at `ff0696e08`. The verifier MUST independently validate the oracle's canonical
  selector contract: absence of `files` and `references`, the exact ordered baseline
  `include`/`exclude` arrays, and the baseline options that affect source discovery
  or resolution. The contract MUST live in a review-owned manifest separate from all
  three TypeScript configs, identify its baseline SHA, and require owner approval for
  any later selector or exception change. It MUST NOT receive advanced WS7-010 flags.
- FR-2: **Shared baseline options.** Boundary-only work MUST preserve the current
  root compiler options, including `strict: true`, `skipLibCheck: true`, module mode,
  target, libraries, path alias, JSX mode, and Next plugin. It MUST NOT weaken any
  option while splitting projects.
- FR-3: **Application project.** A root `tsconfig.app.json` MUST typecheck the
  current non-book application/tooling surface and MUST exclude `scripts/book/**` as
  root files. The root `tsconfig.json` MUST extend the app config so root-invoked
  Next.js and CLI typechecking use the application project. The nested legacy
  `app/tsconfig.json` remains `strict: false`; editor selection of that nearest config
  is accepted debt pending a separate usage audit and MUST NOT be represented as
  boundary coverage.
- FR-4: **Book project.** A root `tsconfig.book.json` MUST typecheck every current
  `scripts/book/**` file discovered by the oracle, including the 17 root book
  utilities and the 54 currently included `src/scratch` files. Its includes MUST be
  version-agnostic so a future `chapterflow-v25*` or later pipeline is covered
  automatically. Independently, the verifier MUST compare the book program to every
  Git-tracked TS/TSX/MTS/CTS path under `scripts/book/**`; only the five exact
  pre-existing top-level v24 `scratch/**` paths may be outside the book program
  without a separately approved path-level exception. No exception may intersect the
  1,940-file program recorded at the planning base.
- FR-5: **Preserve package-local gates.** The existing v21 package-local
  typecheck/tests/doctor/build CI gate MUST remain unchanged and additional to the
  root book-surface gate. The v24 package-local `tsconfig.json` MUST remain unchanged,
  but v24 package tests/doctor/build are not current root-workspace CI gates and MUST
  NOT be described or introduced as such by the boundary PR; all current v24 files
  remain covered through `typecheck:book`.
- FR-6: **Union coverage proof.** A deterministic repository-local verifier MUST
  compare normalized `tsc --listFilesOnly` results for the oracle, app, and book
  projects. It MUST fail unless the required oracle set equals the union of the app
  and book sets, where `required oracle = oracle - explicit owner-approved post-base
  non-source exceptions`. It MUST fail if any exception intersects the planning-base
  program or is expressed as a directory/glob rather than an exact path.
- FR-7: **Book ownership proof.** The verifier MUST fail if any required-oracle file
  under `scripts/book/**` is absent from the book project, or if any raw-oracle book
  file is absent without an approved exact-path exception. It MUST also fail if the
  app project pulls a `scripts/book/**` source through a new import, or if a new
  tracked book TS-family path is excluded without an explicit reviewed exception.
  Directory-wide implicit exceptions are forbidden; every exception remains visible
  in the report and PR diff.
- FR-8: **Transparent overlap.** Files legitimately imported by both programs,
  including shared JSON or app modules used by tooling, MAY overlap. The verifier
  MUST report the overlap count and paths/digest; overlap MUST NOT hide a missing
  oracle file. It MUST separately report `sharedBookDependencies` and its TS-family
  `sharedSourcePaths` subset so book-sensitive app-located code cannot be mistaken for
  app-only fallout.
- FR-9: **Separate commands.** Root `package.json` MUST expose:
  - `typecheck:boundary:test` — explicit execution of verifier unit/self-tests;
  - `typecheck:boundary` — file-set equality and ownership proof;
  - `typecheck:shared-closure -- --base <sha>` — TypeScript-API shared gate that
    derives `prepare` versus `flag` mode and the candidate flag from the base/head
    diff; `--probe-only --flag <flag>` is diagnostic-only and cannot satisfy CI;
  - `typecheck:app` — full semantic typecheck of `tsconfig.app.json`;
  - `typecheck:book` — full semantic typecheck of `tsconfig.book.json`;
  - `typecheck` — fail-closed aggregate running boundary tests, boundary proof, app,
    then book.
- FR-10: **Preserve aggregate verification.** `npm run verify` MUST continue to call
  the aggregate `npm run typecheck`, followed by the existing test, style, and build
  gates.
- FR-11: **Separate CI ownership.** The existing `app-checks` job, displayed as
  `App Build + Tests`, MUST run `typecheck:boundary:test`, `typecheck:boundary`, and
  `typecheck:app`. The existing `pipeline-checks` job, displayed as
  `v21 Pipeline Typecheck + Tests`, MUST run `typecheck:book` before its
  package-specific v21 checks. Both jobs MUST remain hard gates; neither may use
  `continue-on-error`, swallowed exit status, or an advisory wrapper. Their job IDs
  and required-check display names MUST NOT change unless branch protection is
  updated and verified atomically by an authorized owner. `app-checks` MUST invoke
  `typecheck:shared-closure` on every PR before app typechecking, passing the exact PR
  base SHA. Unrelated/boundary PRs infer `none`; shared-preparation and flag PRs infer
  their stricter modes. CI mode and candidate-flag inference MUST be automatic and
  non-bypassable.
- FR-12: **Deterministic report.** The boundary verifier MUST emit a stable JSON
  report and readable summary containing config paths, counts, sorted-path digests,
  missing/unexpected paths, book-owned misses, app-to-book leaks, and overlap. It
  MUST also report selector-contract violations, tracked book-source exceptions or
  misses, `sharedBookDependencies`, `sharedSourcePaths`, and advanced-flag-policy
  violations. It MUST omit timestamps and nondeterministic absolute worktree
  prefixes.
- FR-13: **Synthetic failure tests.** Unit tests for the verifier MUST prove that a
  file omitted from both projects, a book-owned file omitted from the book project,
  a book-source leak into the app project, coordinated narrowing of oracle/app/book
  selectors, advanced-flag leakage into base/oracle/book, and an unapproved shared
  diagnostic or changed path each fail closed without creating or editing any real
  book/v25 source file. Tests MUST also reject a caller-requested mode/flag that does
  not match the inferred base/head policy, including an attempt to run a flag-bearing
  PR under preparation policy. Additional fixtures MUST prove that inferred `none`
  rejects an unledgered shared ACMR change and that two successive flags can repair
  the same shared path only through a valid append-only supersession chain.
- FR-14: **Boundary-only first PR.** The project-boundary PR MUST contain no
  advanced flag and no fixes for advanced-flag fallout. It MUST not modify
  `scripts/book/**`, `book-packages/**`, generated book state, or active v25 files.
- FR-15: **App-only advanced flags.** After the boundary PR merges green, the four
  WS7-010 flags MUST be introduced to `tsconfig.app.json` only, one cumulative PR at
  a time, in this order: `noUncheckedIndexedAccess`, `noImplicitReturns`,
  `noFallthroughCasesInSwitch`, `exactOptionalPropertyTypes`. The verifier MUST read
  effective config and fail if any of those flags becomes enabled in
  `tsconfig.base.json`, `tsconfig.surface.json`, or `tsconfig.book.json`; the root
  Next wrapper may receive them only by inheriting `tsconfig.app.json`. Before source
  edits for each flag, a deterministic diagnostic preflight MUST intersect the
  candidate flag's diagnostic paths with `sharedSourcePaths` and apply FR-20.
- FR-16: **Book gate remains mandatory.** Every app-flag PR MUST run and pass
  `typecheck:book` and the boundary verifier at the latest base. Book/v25 code MUST
  remain baseline-typechecked even though the new flag applies only to the app.
- FR-17: **Narrow fallout.** App-flag PRs MUST fix issues at their source in
  non-book, non-shared files. Their PR-relative changed paths MUST have an empty
  intersection with `sharedSourcePaths`; any shared preparation belongs in the
  separately approved FR-20 PR. Flag PRs MUST NOT use broad `any`, blanket casts,
  `@ts-ignore`, `@ts-nocheck`, widened exclusions, `skipLibCheck` changes, or edits to
  active book/v25 work.
- FR-18: **Live ownership recheck.** Before publishing the boundary PR and every
  flag PR, the implementer MUST fetch `origin`, inspect active PR and retained v25
  branch ownership, and rebase only the campaign branch. A collision with an active
  owner on an exact required file MUST stop for coordination. WP-TSB-01 MUST preserve
  any landed `pipeline24:*` commands and MUST resolve the v24 state-source ownership
  question described in section 1.3 without hiding the 34 paths behind a broad
  exclusion. The first app-flag baseline MUST merge-simulate PR #416 at its merged or
  owner-frozen exact head.
- FR-19: **No speculative cleanup.** The migration MUST NOT delete stale local
  branches/worktrees, repair the historical scratch exclusion, retire
  `app/tsconfig.json`, or refactor unrelated config unless separately authorized.
- FR-20: **Shared dependency owner gate.** A nonempty candidate-flag diagnostic
  intersection with `sharedSourcePaths` MUST stop that flag work package before
  source edits. The preflight MUST use the TypeScript API rather than parse rendered
  diagnostics, compute changed paths with diff filter `ACMR`, compare against the
  union of base/head shared sets, and fail on any shared-set drift. Every mode MUST
  validate the append-only approval chains and require each current file blob to match
  the latest non-superseded record for its path. In `none` mode, `candidateFlag` MUST
  be null, there MUST be no flag transition or ledger mutation, and all shared
  changed/drift/approval failure arrays MUST be empty; otherwise the PR must use a
  valid `prepare` flow. In `prepare` mode, no flag may transition; WS7 preparation
  requires one disabled target flag, while unrelated shared maintenance may use a
  null flag. New records MUST share one `changeId`, their exact path set MUST equal
  the shared changed-path set, and no historical record may change or disappear. A
  later repair of the same path MUST append a record whose `supersedesRecordId`
  points to that path's current leaf; the old record remains immutable. A WS7
  post-repair candidate probe MUST have zero shared diagnostics.
  In `flag` mode, exactly one allowed flag MUST transition from disabled to enabled,
  all prior cumulative flags MUST remain enabled, the approval ledger MUST be
  unchanged, and all shared diagnostic/changed/drift arrays MUST be empty. Any
  ambiguous or caller-mismatched mode/flag fails. Work may resume only after a
  separate, no-flag shared-surface PR has:
  (a) exact-path joint app/security and book/v25-owner approval with no directory/glob
  approval; (b) a per-path matrix of runtime consumers, repair class, and focused
  app/book regression gates; (c) merged or owner-frozen active app/security and
  book/v25 heads merge-simulated at exact SHAs; and (d) green boundary/app/book
  typechecks, v21 gates, relevant owner-approved hermetic v24/v25 contract or unit
  gates, full verify, and exact-head CI. Repairs
  SHOULD be behavior-preserving; a behavioral repair without a meaningful book-side
  test or explicit owner approval leaves the flag blocked. No shared-surface PR may
  edit `scripts/book/**`, execute live/QC/generation workflows, or be folded into the
  flag PR. Approval records and evidence references MUST already exist in the flag
  PR's base; the flag PR may not add or widen its own approval.

## Non-Functional Requirements

- **NFR-1 — Zero coverage loss.** On identical checkout/dependency state, missing and
  unexpected repository-local files MUST both be zero. A missing file is a release
  blocker.
- **NFR-2 — Cross-platform paths.** File comparisons MUST normalize separators,
  resolve repository-relative paths, remove `node_modules/**`, and work on macOS and
  GitHub's Ubuntu runners.
- **NFR-3 — Clean-checkout determinism.** Two consecutive boundary-verifier runs on
  the same SHA MUST produce byte-identical JSON reports.
- **NFR-4 — Runtime.** The complete boundary verifier SHOULD finish within 120
  seconds on the existing `ubuntu-latest` Node 20 runner and MUST not access the
  network.
- **NFR-5 — Diagnostic quality.** Failure output MUST print the first 50 differing
  relative paths and write the complete sorted lists to the JSON report.
- **NFR-6 — Next compatibility.** `npm run build` and `npx open-next build` MUST use
  the app project successfully and MUST NOT rewrite tracked TypeScript config files.
- **NFR-7 — Reviewability.** The boundary PR and each flag PR MUST have a clean
  PR-relative diff, `git diff --check`, exact ancestry, local gate evidence, and
  exact-head CI evidence before merge.
- **NFR-8 — Active-work isolation.** No command in this campaign may run a book
  generation, QC, repair, publication, live-sync, or v25 execution workflow.
- **NFR-9 — Book-source discoverability.** A newly tracked TS-family path under
  `scripts/book/**` MUST become book-typechecked or fail with an explicit path. It
  MUST NOT disappear through a new broad exclusion or selector change.
- **NFR-10 — Shared runtime safety.** App-located code consumed by book tooling is
  book-sensitive. Typecheck success alone MUST NOT authorize changing it; exact-path
  dual-owner review and meaningful tests for both consumer sides are mandatory.

## Acceptance Criteria

### AC-1: Current surface is preserved (FR-1, FR-6, NFR-1)

Given a clean checkout at `ff0696e08` with the locked dependencies installed
When `npm run typecheck:boundary` runs after the config split
Then the oracle reports 1,940 repository-local files for this snapshot
And the app/book union reports the same normalized set
And `missing`, `unexpected`, and `selectorContractViolations` are empty.

### AC-2: All current book files remain covered (FR-4, FR-5, FR-7, NFR-1, NFR-9)

Given the clean `ff0696e08` snapshot
When the boundary verifier classifies the oracle program
Then all 850 current `scripts/book/**` files are present in the book project
And the 17 root book utilities are present
And the 54 currently typechecked `src/scratch` files are present
And no app project root or transitive source is under `scripts/book/**`
And the only tracked book TS-family exceptions are these five baseline paths:
`scratch/calibrate-cast-containment.ts`, `scratch/calibrate-pedagogy.ts`,
`scratch/calibrate-readability.ts`, `scratch/chb-block.ts`, and
`scratch/chb7-corpus.ts`, all beneath the v24 pipeline root.

### AC-3: Future pipeline versions are not silently excluded (FR-4, FR-7, FR-13, NFR-9)

Given a synthetic verifier fixture containing
`scripts/book/prompts/chapterflow-vNEXT/src/canary.ts`
When the classifier and set-equality tests run
Then that path is classified as book-owned without adding a version-specific rule
And omitting it from the oracle, app, and book sets still makes the tracked-source
invariant fail.

### AC-4: Missing application coverage fails closed (FR-6, FR-13, NFR-5)

Given a synthetic oracle file under `app/**`
When that file is absent from both app and book fixture sets
Then the verifier exits nonzero
And the path appears in the human output and JSON `missing` array.

### AC-5: App-to-book coupling fails closed (FR-3, FR-7, FR-13)

Given a synthetic app set containing a `scripts/book/**` source
When the verifier runs
Then it exits nonzero
And reports the path in `appBookSourceLeaks`.

### AC-6: Compiler strength is unchanged by the boundary PR (FR-2, FR-14)

Given the boundary PR relative to `ff0696e08`
When normalized `tsc --showConfig` output is compared
Then the oracle, app, and book semantic compiler settings preserve the current root
settings
And no advanced flag or weaker option appears in base, oracle, or book
And the root Next wrapper's effective advanced flags match the app config.

### AC-7: Local commands are independently meaningful (FR-5, FR-9, FR-10)

Given the boundary migration branch
When `npm run typecheck:boundary:test` runs
Then all verifier unit/self-tests execute and pass independently of `npm test`
When `npm run typecheck:app` runs
Then only the app config is semantically checked and it passes
When `npm run typecheck:book` runs
Then the full book config is semantically checked and it passes
When `npm run typecheck` and `npm run verify` run
Then both projects and all existing aggregate gates pass.

### AC-8: CI owns both projects (FR-11, NFR-7)

Given the boundary PR exact head
When GitHub Actions completes
Then `app-checks` / `App Build + Tests` has run verifier tests, boundary proof, and app
typechecking
And `pipeline-checks` / `v21 Pipeline Typecheck + Tests` has run book plus existing
v21 package-specific typechecking/tests/doctor/build
And neither job ID nor required-check display name changed
And both jobs are successful hard gates.

### AC-9: Next build does not mutate config (FR-3, NFR-6)

Given a clean boundary branch
When `npm run build` and the existing OpenNext build gate run
Then both pass
And `git status --short` contains no generated TypeScript-config edit.

### AC-10: First app flag is isolated from book work (FR-15, FR-16, FR-17, FR-20, NFR-10)

Given the merged boundary head
When `typecheck:shared-closure` probes `noUncheckedIndexedAccess`
Then it reports mode `probe`, the four shared paths recorded in section 1.4, and fails
closed before source edits
When a separately approved shared-surface prerequisite has repaired and evidenced
those paths
And the `noUncheckedIndexedAccess` flag PR is prepared from that merged base
Then the only new compiler flag is in `tsconfig.app.json`
And shared-closure CI infers mode `flag` and candidate
`noUncheckedIndexedAccess` without a caller override
And no `scripts/book/**`, `book-packages/**`, generated state, or v25 file changes
And `sharedFlagDiagnostics`, `sharedChangedFiles`, `sharedSetAdded`,
`sharedSetRemoved`, and `approvalFilesChangedInCandidate` are empty
And `typecheck:boundary:test`, `typecheck:boundary`, `typecheck:app`,
`typecheck:book`, tests, verify, and CI pass.

### AC-11: Each later flag remains cumulative and independently verified (FR-15, FR-16, FR-20)

Given the preceding verified app-flag head
When the next specified flag PR is prepared
Then its cumulative diagnostic preflight has no unapproved shared intersection
Then its PR-relative config diff adds exactly that one flag
And it retains every earlier app flag
And its own full local and exact-head CI gates pass.

### AC-12: Active owners are preserved (FR-18, FR-19, NFR-8, NFR-9)

Given active v25/book PRs #401/#406 and security PR #416 or their successors
When a boundary or flag branch is prepared
Then live changed-file ownership is rechecked
And no active owner file is overwritten or silently rebased
And an exact-file collision stops for owner coordination
And any landed `pipeline24:*` commands are retained
And PR #401's 34 state TS-family paths are book-typechecked or individually classified
by the v25 owner rather than hidden by its broad directory exclusion
And the first app-flag baseline merge-simulates PR #416's merged or owner-frozen head.

### AC-13: Boundary report is deterministic and transparent (FR-8, FR-12, NFR-2, NFR-3)

Given an unchanged clean checkout and dependency tree
When `npm run typecheck:boundary` runs twice
Then both JSON reports are byte-identical
And all paths are normalized repository-relative paths
And the complete app/book overlap is reported without weakening union equality
And `sharedBookDependencies` reports 212 paths plus a stable digest at the planning
base
And `sharedSourcePaths` is separately reported with its own paths and digest.

### AC-14: Oracle and flag policy cannot narrow together (FR-1, FR-13, FR-15)

Given synthetic fixtures that narrow oracle, app, and book selectors in the same way
When verifier unit/self-tests run
Then the independent canonical selector assertion fails
Given a fixture enabling any WS7 advanced flag in base, oracle, or book
When verifier unit/self-tests run
Then the effective-option policy fails with the config path and flag name.

### AC-15: Shared source changes require a separate dual-owner gate (FR-13, FR-17, FR-20, NFR-10)

Given a synthetic flag preflight with a diagnostic or changed path in
`sharedSourcePaths`
When no exact path-level approval exists in the candidate base
Then the command exits nonzero and reports the path and TypeScript codes
And removing an import so the path leaves only the head shared set does not evade the
base/head-union comparison
And requesting `prepare` for a head that enables the flag fails as a mode downgrade
And a shared ACMR change with no flag or ledger diff infers `none` but still exits
nonzero as an unledgered shared change
Given an approved real shared-surface prerequisite PR
Then its evidence matrix covers every changed path, runtime consumers, repair class,
focused app tests, and focused hermetic book-consumer tests
And CI infers mode `prepare`, the target flag remains disabled, every shared change has
one newly added exact-path ledger entry, and every repaired blob digest matches
And active app/security and book/v25 heads are merged or owner-frozen and
merge-simulated
And the later flag PR neither changes a shared path nor adds/widens its own approval.
Given `app/book/data/bookChapters.ts` requires a later exact-optional repair
Then its new append-only record supersedes the current no-unchecked record
And the historical record remains immutable
And only the latest non-superseded blob digest must match the current file.

## Edge Cases

- EC-1: **Generated Next files differ by phase.** Compare oracle/app/book sets in the
  same invocation and environment. Do not use a pinned total as the ongoing gate.
- EC-2: **JSON imports appear in program output.** Treat every repository-local
  `--listFilesOnly` entry as a file regardless of extension; do not filter only TS.
- EC-3: **Shared dependencies overlap.** Report overlap but fail only when union
  equality, book ownership, or app-to-book isolation fails.
- EC-4: **Future v25 merges during implementation.** Rebase the campaign branch onto
  latest `main`; the version-agnostic book glob and dynamic oracle must absorb the new
  files without changing book source.
- EC-5: **Active PR changes root config/package/CI.** Stop and coordinate rather than
  resolving by dropping either contract.
- EC-6: **A new root TypeScript path is added.** The oracle sees it through the
  preserved global patterns; the union proof fails unless app or book covers it.
- EC-7: **A new hidden-directory TS file is added.** It follows the oracle's current
  discovery semantics. Broadening hidden-directory coverage is separate work.
- EC-8: **Symlink or absolute-path drift.** Resolve real paths, reject paths outside
  the repository, and serialize only normalized relative paths.
- EC-9: **TypeScript prints diagnostics during list generation.** Treat a nonzero
  compiler exit as verifier failure; do not parse a partial file set as success.
- EC-10: **Boundary report artifact is absent.** CI fails before semantic typechecks;
  `if-no-files-found: warn` is not permitted for this artifact if upload is added.
- EC-11: **Book baseline becomes red from another merge.** Do not weaken the book
  config or continue the app stack; identify the owning merge and restore a green
  baseline through that owner.
- EC-12: **Candidate removes an import to shrink overlap.** Compare changed paths to
  the union of base/head shared sets and fail on shared-set drift; head-only
  classification cannot authorize the change.
- EC-13: **Shared repair has no meaningful book-side test.** Typecheck is
  insufficient evidence. Keep the flag blocked unless the book/v25 owner authorizes
  an exact alternative gate; never add coverage by editing active book/v25 work
  without separate authority.
- EC-14: **Boundary base predates split configs.** For WP-TSB-01 only, derive the
  base app/book/shared sets from the canonical baseline selector and the same
  version-agnostic classifier used in the feasibility simulation; absence of new
  config files MUST NOT be interpreted as an empty base shared set.

## API Contracts

There is no runtime HTTP API or product data-model change. No `GET /`, `POST /`,
`PUT /`, `PATCH /`, or `DELETE /` endpoint is introduced; the contract below is a
build-tool JSON artifact only.

```ts
interface TypeScriptProjectSummary {
  config: string;          // repository-relative config path
  fileCount: number;
  sortedPathSha256: string;
}

interface TypeScriptPathSetSummary {
  fileCount: number;
  sortedPathSha256: string;
  paths: string[];
}

interface TypeScriptFlagDiagnosticPath {
  path: string;
  codes: number[];
}

type Ws7AdvancedFlag = "noUncheckedIndexedAccess" | "noImplicitReturns" |
  "noFallthroughCasesInSwitch" | "exactOptionalPropertyTypes";

interface TypeScriptSharedRepairApproval {
  recordId: string;
  changeId: string;
  purpose: "ws7-flag-preparation" | "shared-maintenance";
  flag: Ws7AdvancedFlag | null;
  path: string;
  appOwner: string;
  bookOwner: string;
  supersedesRecordId: string | null;
  repairedBlobSha256: string;
  evidenceRefs: string[];
}

interface TypeScriptBoundaryReportV1 {
  schemaVersion: 1;
  selectorContractSha256: string;
  projects: {
    oracle: TypeScriptProjectSummary;
    app: TypeScriptProjectSummary;
    book: TypeScriptProjectSummary;
  };
  missing: string[];
  unexpected: string[];
  selectorContractViolations: string[];
  bookOwnedMissing: string[];
  trackedBookSourceExceptions: string[];
  unapprovedTrackedBookSources: string[];
  appBookSourceLeaks: string[];
  advancedFlagPolicyViolations: string[];
  overlap: string[];
  sharedBookDependencies: TypeScriptPathSetSummary;
  sharedSourcePaths: TypeScriptPathSetSummary;
}

interface TypeScriptSharedClosureReportV1 {
  schemaVersion: 1;
  mode: "none" | "probe" | "prepare" | "flag";
  baseSha: string;
  headSha: string;
  candidateFlag: Ws7AdvancedFlag | null;
  baseSharedSourcePaths: TypeScriptPathSetSummary;
  headSharedSourcePaths: TypeScriptPathSetSummary;
  sharedSetAdded: string[];
  sharedSetRemoved: string[];
  diagnosticFiles: TypeScriptFlagDiagnosticPath[];
  sharedFlagDiagnostics: TypeScriptFlagDiagnosticPath[];
  changedFiles: string[];
  sharedChangedFiles: string[];
  approvedSharedChangedFiles: string[];
  unapprovedSharedChangedFiles: string[];
  approvalEntriesAdded: TypeScriptSharedRepairApproval[];
  approvalEntriesModifiedOrRemoved: string[];
  approvalChainViolations: string[];
  currentApprovalBlobMismatches: string[];
  approvalFilesChangedInCandidate: string[];
}
```

The report MUST end with one newline, sort every path array bytewise, use forward
slashes, and omit wall-clock timestamps.

## Data Models

No runtime or persisted product entity changes. The only new data model is the
ephemeral deterministic boundary report:

| Field | Type | Constraints |
|---|---|---|
| `schemaVersion` | literal `1` | Required; increment only for a breaking report change |
| `selectorContractSha256` | 64-character hex string | Digest of normalized independent selector/policy manifest |
| `projects` | object | Required summaries for oracle, app, and book configs |
| `projects.*.config` | string | Repository-relative path with forward slashes |
| `projects.*.fileCount` | non-negative integer | Count after repository/node_modules filtering |
| `projects.*.sortedPathSha256` | 64-character hex string | SHA-256 of newline-delimited sorted paths |
| `missing` | string array | Must be sorted and empty for success |
| `unexpected` | string array | Must be sorted and empty for success |
| `selectorContractViolations` | string array | Must be sorted and empty; canonical selector drift fails |
| `bookOwnedMissing` | string array | Must be sorted and empty for success |
| `trackedBookSourceExceptions` | string array | Sorted, explicit, reviewed path-level exceptions |
| `unapprovedTrackedBookSources` | string array | Must be sorted and empty for success |
| `appBookSourceLeaks` | string array | Must be sorted and empty for success |
| `advancedFlagPolicyViolations` | string array | Must be sorted and empty for success |
| `overlap` | string array | Sorted informational list; may be non-empty |
| `sharedBookDependencies` | path-set summary | All repo-local non-book app/book overlap; 212 at planning base |
| `sharedSourcePaths` | path-set summary | TS-family subset protected by FR-20 |

The shared-closure preflight report additionally records inferred mode, exact
base/head SHAs, the candidate flag, base/head shared-source path-set summaries,
added/removed shared paths, diagnostic paths with sorted TypeScript codes,
`sharedFlagDiagnostics`, ACMR changed paths, approved/unapproved shared changes, and
added/modified/removed approval entries, chain violations, and current-blob mismatches.
All arrays MUST be sorted. For a flag PR, every shared/drift/approval-change failure
array MUST be empty. For a preparation PR, only exact newly approved shared changes
are permitted. `candidateFlag` is null in `none` and may be null for non-WS7 shared
maintenance; WS7 probe/prepare/flag modes require it.

## 7. Proposed File and Command Topology

### 7.1 Boundary PR files

| Path | Purpose |
|---|---|
| `tsconfig.base.json` | Current shared semantic compiler options; no file discovery and no advanced flags |
| `tsconfig.surface.json` | Immutable discovery oracle matching pre-split root includes/excludes |
| `tsconfig.app.json` | App/non-book project; excludes `scripts/book/**` |
| `tsconfig.book.json` | Version-agnostic full `scripts/book/**` project |
| `tsconfig.json` | Thin Next-compatible extension of `tsconfig.app.json` |
| `scripts/ci/tsconfig-boundary-contract.json` | Baseline SHA, canonical selector/options, flag policy, and exact book-source exceptions |
| `scripts/ci/verify-tsconfig-boundary.mjs` | Real `tsc --listFilesOnly` set comparison and deterministic report |
| `scripts/ci/verify-tsconfig-boundary.test.mjs` | Synthetic fail-closed unit tests; no real book edits |
| `scripts/ci/verify-shared-ts-closure.mjs` | TypeScript-API flag diagnostics plus base/head shared-set and changed-path gate |
| `scripts/ci/verify-shared-ts-closure.test.mjs` | Synthetic shared diagnostic/change/drift/approval failure tests |
| `package.json` | Separate/aggregate commands; no dependency needed |
| `.github/workflows/ci.yml` | App and book hard-gate placement |

`package-lock.json` SHOULD remain unchanged because the design requires no new
dependency. If npm rewrites it without a declared dependency change, restore it by an
explicit patch and investigate before publication.

`WP-TSB-01A`, not the boundary PR, creates
`scripts/ci/ws7-shared-repair-approvals.json` with the first exact-path records. The
WP-TSB-01 verifier treats an absent ledger as empty; after creation, deletion or
history rewrite is a hard failure.

### 7.2 Canonical selector and policy contract

The independent boundary-contract manifest MUST record planning base
`ff0696e08b20f462f050d1df71a71149891ecb06`, the complete normalized baseline
compiler-option object, absence of `files` and `references`, and these ordered
selectors:

```json
{
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    "**/*.mts",
    ".next/dev/types/**/*.ts",
    ".next-chapterflow/types/**/*.ts",
    ".next-chapterflow/dev/types/**/*.ts",
    ".next-review/types/**/*.ts",
    ".next-review/dev/types/**/*.ts"
  ],
  "exclude": [
    "node_modules",
    "infra/**",
    "cdk.out/**",
    "scripts/book/prompts/*/scratch/**",
    ".next-chapterflow/**",
    ".next-cf-dev/**"
  ]
}
```

The same manifest MUST list the five exact baseline book-source exceptions from AC-2,
forbid exception globs/directories, declare all four WS7 flags disabled for
base/oracle/book, and record any later owner-approved exact-path exception as an
explicit reviewed delta. Changing this manifest is a release-contract change, not an
incidental fallout repair.

The separate shared-repair approval ledger is absent/empty in WP-TSB-01. Only a shared
preparation PR may create it with records or append records. Each record MUST name a stable `changeId`, purpose,
optional flag, one exact path, both owners, the SHA-256 of the repaired file contents,
durable evidence references, and the prior current record it supersedes, if any. Its
`recordId` is the SHA-256 of canonical record content excluding `recordId`, so neither
record nor blob identity is commit-self-referential. The verifier MUST reject cycles,
cross-path supersession, multiple current leaves, mutated/deleted history, or a current
file whose blob does not match its latest leaf. A candidate flag PR fails if it changes
that ledger or relies on a record not already present in its base.

### 7.3 Intended commands

```json
{
  "typecheck:boundary:test": "node --test scripts/ci/verify-tsconfig-boundary.test.mjs scripts/ci/verify-shared-ts-closure.test.mjs",
  "typecheck:boundary": "node scripts/ci/verify-tsconfig-boundary.mjs",
  "typecheck:shared-closure": "node scripts/ci/verify-shared-ts-closure.mjs",
  "typecheck:app": "tsc --noEmit -p tsconfig.app.json",
  "typecheck:book": "tsc --noEmit -p tsconfig.book.json",
  "typecheck": "npm run typecheck:boundary:test && npm run typecheck:boundary && npm run typecheck:app && npm run typecheck:book"
}
```

Exact quoting and report paths may be refined during approved implementation, but the
fail-closed semantics and ordering are fixed.

CI MUST invoke the shared-closure command with only the exact PR base SHA and let the
tool infer policy. A base/head effective-app-config diff with exactly one newly enabled
allowed flag and no ledger change selects `flag`. No newly enabled flag plus additions
sharing exactly one `changeId` in the approval ledger selects `prepare`; WS7 records
must share exactly one still-disabled target flag, while general shared maintenance
uses a null flag. Neither change selects `none` only when shared sources and the shared
set are also unchanged. Both, multiple flags/change IDs, ledger mutation without valid
append-only records, an unledgered shared change, or any other ambiguous combination
fails. `--probe-only --flag <flag>` is for the read-only pre-edit
diagnostic report, returns nonzero on a shared intersection, and is never accepted as
a CI gate. Explicit mode/flag arguments, if retained for tests, MUST be cross-checked
against inference and cannot downgrade policy.

## 8. Work Packages and PR Sequence

### WP-TSB-00 — Live rebase and ownership freeze

- Start from latest `origin/main`, never from the old unpushed strictness branch.
- Record SHA, Node/npm/TypeScript versions, active PRs, and exact shared-file owners.
- Re-run the clean-checkout oracle measurement.
- Resolve PR #401's broad v24 state exclusion with its owner: either its 34 TS-family
  paths enter `typecheck:book`, or the owner approves explicit path-level non-source
  exceptions in the boundary contract. Do not translate the directory glob into an
  implicit exception.
- Preserve any owner-approved `pipeline24:*` root scripts that have landed.
- Stop if active work owns a required root config, package script, verifier, or CI line
  and cannot be safely composed.

### WP-TSB-01 — Boundary and verifier

- Branch: `codex/ws7-010-ts-project-boundary`.
- Base: latest verified `main` containing `ff0696e08`.
- Implement only the file/command topology in section 7.
- Prove AC-1 through AC-9, AC-12 through AC-14, and AC-15's machine-failure clauses
  with synthetic shared-closure fixtures; do not repair real shared sources in this
  PR.
- Run focused verifier tests, separate typechecks, aggregate typecheck, full tests,
  `npm run verify`, OpenNext/CI-equivalent gates, `git diff --check`, and scope review.
- Publish one draft PR, follow exact-head CI, obtain independent architecture/testing/
  CI reviews, then merge only with explicit owner authorization.

### WP-TSB-01A — First shared-closure review and preparation

- Branch: `codex/ws7-010-shared-no-unchecked-preflight`.
- Base: merged WP-TSB-01 head after active app/security and book/v25 heads are merged
  or owner-frozen and merge-simulated.
- Record the four paths from section 1.4 and their current diagnostic codes:
  `fsrs.ts` (`TS2532`, `TS2345`, `TS18048`), `bookChapters.ts` (`TS2322`,
  `TS2345`), `bookPackages.ts` (`TS2322`), and `catalog-integrity.ts` (`TS2322`).
- Obtain exact-path app and book/v25 owner approval, build the FR-20 consumer/evidence
  matrix, and repair only approved shared paths without enabling the flag.
- Add exact ledger entries with repaired blob digests after the source edits; CI MUST
  infer `prepare` and reject any unapproved changed shared path or enabled target flag.
- Run focused tests for both app and hermetic book consumers plus every FR-20 gate.
  If any path lacks a meaningful book-side test or needs an active book/v25 source
  edit, stop; do not open WP-TSB-02.
- Merge as a separate PR. Re-run the cumulative preflight and require zero shared
  diagnostics before starting WP-TSB-02.

### WP-TSB-02 — `noUncheckedIndexedAccess`

- Branch: `codex/ws7-010-app-no-unchecked-indexed-access`.
- Base: merged WP-TSB-01A head.
- Add only `noUncheckedIndexedAccess` to `tsconfig.app.json` and repair non-book,
  non-shared fallout. Current pre-preparation estimate: 500 diagnostics in 115 files;
  remeasure after WP-TSB-01A.
- Require an empty shared diagnostic/change/drift report. This PR cannot add approval
  records or modify a shared path, and CI MUST infer `flag`.

### WP-TSB-03 — `noImplicitReturns`

- Branch: `codex/ws7-010-app-no-implicit-returns`.
- Base: verified WP-TSB-02 head.
- Add only `noImplicitReturns`. Current independent estimate: nine diagnostics in
  nine non-book files. Re-run the cumulative shared-closure preflight first; the
  current independent intersection is empty, but that observation is not a waiver.

### WP-TSB-04 — `noFallthroughCasesInSwitch`

- Branch: `codex/ws7-010-app-no-fallthrough-switch`.
- Base: verified WP-TSB-03 head.
- Add only `noFallthroughCasesInSwitch`. Current independent probe has zero fallout;
  it still requires its own PR, shared-closure preflight, and gates.

### WP-TSB-04A — Final shared-closure review and preparation

- Branch: `codex/ws7-010-shared-exact-optional-preflight`.
- Base: verified WP-TSB-04 head after the same live owner/frozen-head checks.
- Generate the exact 25-path/code/consumer matrix from the cumulative
  `exactOptionalPropertyTypes` preflight; do not rely on the planning estimate alone.
- Apply the same separate-PR, exact-path dual-owner approval, non-book-only repair,
  focused dual-consumer testing, and stop rules as WP-TSB-01A.
- If `app/book/data/bookChapters.ts` or another prior path changes again, append a new
  exact-optional record that supersedes its current leaf; never rewrite the earlier
  no-unchecked record or require its historical blob to match current content.
- CI MUST infer `prepare`; the exact-optional target remains disabled in this PR.
- Merge separately and require a zero shared intersection before WP-TSB-05.

### WP-TSB-05 — `exactOptionalPropertyTypes`

- Branch: `codex/ws7-010-app-exact-optional-properties`.
- Base: merged WP-TSB-04A head.
- Add only `exactOptionalPropertyTypes`. Current independent estimate: 388
  diagnostics in 166 non-book files before cumulative changes; remeasure after the
  cumulative stack and WP-TSB-04A. The flag PR itself must be shared-closure-clean.

Before every flag PR, rerun the cumulative shared-closure preflight. Any new nonempty
intersection inserts another small `WP-TSB-SHARED-<flag>` prerequisite with the same
FR-20 contract; zero in an old probe is not permanent authorization. Every flag PR
MUST independently prove AC-10 through AC-15. Do not open a higher PR from a red lower
head. Large app-only fallout is not itself a blocker; entering book/v25 or shared
sources, weakening a gate, or colliding with an active exact-file owner is.

## 9. Verification Matrix

| Gate | Boundary PR | Shared preparation PR | Every flag PR |
|---|---:|---:|---:|
| `npm run typecheck:boundary:test` | Required | Required | Required |
| `npm run typecheck:boundary` | Required | Required | Required |
| `npm run typecheck:shared-closure -- --base <sha>` | Required, inferred `none` + synthetic tests | Required, inferred `prepare` | Required, inferred `flag` |
| `npm run typecheck:app` | Required | Required | Required |
| `npm run typecheck:book` | Required | Required | Required |
| Existing v21 package typecheck/tests/doctor/build | Required | Required | Required |
| Focused app + hermetic book-consumer tests | N/A | Required per path | Required when applicable |
| `npm test` | Required | Required | Required |
| `npm run verify` | Required | Required | Required |
| Next + OpenNext build | Required | Required | Required |
| Infra/CI lint and existing scan gates | Required | Required | Required |
| `git diff --check` and PR-relative scope audit | Required | Required | Required |
| Independent correctness/architecture/CI review | Required | Required | Required |
| Exact-head GitHub Actions | Required | Required | Required |

## 10. Stop Conditions

Stop and request owner direction when:

- a required change would edit `scripts/book/**`, `book-packages/**`, generated book
  state/artifacts, or active v25 work;
- the app project imports a book source and removing that coupling requires a product
  or pipeline design decision;
- union equality cannot be achieved without weakening the oracle or excluding a
  currently covered path;
- an active PR owns an exact required shared file and composition is unsafe;
- PR #401's broad state exclusion would hide tracked TS-family paths without explicit
  owner classification;
- a selector/exception contract change is requested without separate owner approval;
- a candidate flag has a shared diagnostic, changed path, or base/head shared-set
  drift without a separately merged exact-path preparation PR;
- a shared preparation path lacks joint app/book-owner approval or meaningful focused
  tests for both runtime consumers;
- a flag PR introduces or widens its own shared-path approval;
- shared-closure mode or candidate-flag inference is ambiguous, caller-mismatched, or
  attempts to apply preparation policy to a flag-bearing head;
- inferred `none` contains a shared change/set drift, or an approval chain is cyclic,
  rewritten, multiply current, cross-path, or mismatched to the latest file blob;
- the existing `app-checks` / `pipeline-checks` IDs or required-check display names
  would need to change without an atomic branch-protection update;
- a package-lock change appears without an intentional dependency change;
- Next or OpenNext requires a weaker compiler config;
- the book baseline is red at the chosen implementation base;
- production, AWS, Stripe, branch-protection, force-push, or unrelated cleanup would
  be required.

## 11. Rollback

The boundary PR is configuration/tooling only. Its rollback is a normal revert of that
single merge commit, restoring the pre-split root `tsconfig.json`, package scripts, and
CI steps. No book source or generated state requires rollback. A flag PR is reverted
independently in reverse stack order; the boundary remains in place so app and book
coverage never recombine accidentally.

## Out of Scope

- OS-1: Enabling any advanced flag in the book project.
- OS-2: Editing, repairing, formatting, or regenerating v21, v24, v25, or other
  `scripts/book/**` source.
- OS-3: Changing `book-packages/**`, generated chapter state, `*.v21.json`, or book
  publication/QC artifacts.
- OS-4: Correcting the historical scratch exclusion or dropping the 54 currently
  covered `src/scratch` files.
- OS-5: Adding the 44 tracked TypeScript-family files that are outside the current
  root program; each existing owner/gate remains unchanged.
- OS-6: Changing infra TypeScript settings or `@types/node`.
- OS-7: Retiring or repairing `app/tsconfig.json` without a separate usage audit.
- OS-8: Merging or modifying active v25/book PRs #401/#406 or security PR #416.
- OS-9: Implementing any migration code before this spec is approved.
- OS-10: Claiming that TypeScript project references or declaration emit isolate the
  212 shared runtime dependencies. A third shared-package/compiler boundary requires
  a separately approved feasibility plan proving Next/OpenNext, path resolution,
  runtime-source behavior, generated-artifact hygiene, and unchanged coverage.

## 13. Approval Gate

This document is the replan. It is **not** implementation authorization. Implementation
may begin only after the owner approves this spec or provides a superseding revision.
The first implementation action is WP-TSB-00; the old local
`codex/ws7-010-no-unchecked-indexed-access` branch is diagnostic history and MUST NOT be
used as an implementation base.
