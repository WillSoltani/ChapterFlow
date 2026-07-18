# V25 Recovery Decision

Date: 2026-07-15
Baseline: `50b4d8b7027f7555551f26d82d868174e7087d8e` on `recovery/v25-pipeline-repair` (fresh worktree from remote `feat/v25-pipeline-live` head).
Inputs: `V25_RECOVERY_AUDIT.md` §7–§14 (proven root cause, failing-gate map, identity map).

## DECISION — Option B: versioned successor identity on the current head

Keep the IMP-24F semantic repair shipped in `50b4d8b7`, treat it as a **candidate successor instrument generation**, and separate its current-byte seal/certification from the immutable V3 historical artifacts. `09b53ef81` remains the historical green checkpoint; nothing is rolled back and no history is rewritten.

### Why B over the alternatives

- **Option A (rollback baseline + selective port)** — REJECTED as larger and not curative. The semantic repair itself is sound (package tsc green, 25/25 threshold-coverage rows PASS per IMP-24F, and the failing tests fail on *identity handling*, not on the repair's semantics). Porting it back onto `09b53ef81` would reproduce the identical byte/recipe drift the moment it lands, because the defect is the validators' comparison mode, not the commit. A would defer the structural fix, at the cost of quarantine/port churn across 13 src files.
- **Option C (in-place V3 reseal)** — REJECTED. Overwriting `contracts/imp24/forward-production-instrument-seal.json` / `instrument-certification-binding.json` in place would make the retained V3-final campaign evidence (which pins `sealSha256 ca93638d…` and `certificationSha256 ff4e1242…` in its preflight/role-freeze/ledger) point at instrument bytes that never executed a single one of the 338 retained calls. That rewrites the meaning of completed V3 evidence. No higher-authority instruction permits it.
- **Option B** matches the existing in-repo precedent for exactly this situation: `verifyImp24DR2RetainedQualificationForFinalAttestationV3` recomputes the *legacy* recipe from the *historical* commit via `git show`, and `imp24-materialize-observability-freeze --verify-historical` anchors retained bytes to git blobs at the recorded commit. The recovery generalizes that precedent instead of adding a new stack.

## Design (satisfies the seven required outcomes)

### 1. Two verification modes with explicit identity

- **Historical**: retained `contracts/imp24/*` seal + certification binding, and every closed identity (v1, v2, v3-envelope, r1, r2, final), are verified by self-hash + internal binding consistency (and, where already implemented, git-blob anchoring at the recorded commit). Historical verification NEVER rebuilds an inventory from current checkout bytes and never re-derives prompt/scorer hashes with current in-code semantics.
- **Active candidate**: a NEW candidate seal + certification, minted from post-fix current bytes at NEW paths, is the only thing compared against the current checkout, and fails closed on any drift.

### 2. Versioned, non-singleton binding (the smallest explicit manifest)

New artifacts under `state/migration-experiments/contracts/imp24f/` (retained `imp22/`, `imp24/` untouched):

- `forward-production-instrument-seal.json` — candidate seal over post-fix bytes (existing schema `forward-production-instrument-seal-v1`; versioning provided by the namespace + manifest, not by mutating the retained artifact).
- `instrument-certification-binding.json` — candidate certification produced by the existing `certifyImp24Instrument` under the new 5-field prompt-hash recipe (two independent model-free audit passes, zero model/API calls).
- `instrument-candidate-manifest.json` — NEW small manifest binding: `protocolId` (`s16-forward-role-qualification-v3-envelope`), `instrumentGeneration` (`imp24f-semantic-repair-1`), candidate `sealSha256`, `promptBundleSha256` (5-field recipe), `schemaBundleSha256`, `thresholdsSha256`, corpus bundle hashes, `predecessor` block (`{experimentId: …-final, sealSha256 ca93638d…, certificationSha256 ff4e1242…, disposition ROLE_SET_NOT_READY, mayQualifySuccessor: false}`), and the standing blocker `BLOCKED_NEEDS_INDEPENDENT_GOLD`. Content-addressed values + one explicit pointer file; no commit-hash self-reference.

### 3. No historical qualification leakage

The manifest's `predecessor.mayQualifySuccessor: false` is asserted by a focused regression test; V1/V2/V3 closures remain untouched; no retained freshness, calls, holdouts, role assignments, or dispositions are readable as candidate results. The candidate has **zero** live evidence by construction.

### 4. Root compilation boundary (Track B)

- Root `tsconfig.json`: add `scripts/book/prompts/chapterflow-v24-author-pipeline/state/**` to `exclude` (narrow: inert evidence only; pipeline `src/` and `tests/` REMAIN root-compiled so root keeps type coverage of the v24 pipeline, which is not an npm workspace).
- `src/exec/executionEnvelope.ts` + `tests/exec-envelope.test.ts` + `tests/hostile-context.test.ts`: replace `NodeJS.ProcessEnv`-typed hermetic-env literals with a local env-map type (`Record<string, string | undefined>` alias) so the code is correct under both @types/node and Next's `NODE_ENV`-required augmentation. No semantic change to the hermetic-env checks.
- `tests/forward-reviewer-executor.test.ts:442`: `/…/s` → `[\s\S]` form (ES2017-portable). Root `target` stays ES2017 (no repository-wide evidence supports raising it).
- Retained snapshots under `state/**` are never edited (registry-hashed by `closed-registry-sync.test.ts` and `nativeReviewSeal.ts`).

### 5. Workflow/CLI identity is explicit

- `forward-verify-production-instrument-seal-v2` keeps verifying the retained imp24 artifact but in **historical mode** (self-hash + expected-sha binding; no current-byte rebuild); a new explicit flag/subverb target verifies the **candidate** seal against current bytes. Command help/output states the identity verified.
- `imp24-certify-instrument` re-targets its recompute-and-compare to the **candidate** binding; the retained imp24 binding is verified historically (self-hash + pins).
- `imp24ObservabilityFreeze.ts`: split `EXPECTED_PROMPT_BUNDLE_SHA256`/`EXPECTED_SCHEMA_BUNDLE_SHA256` into historical constants (unchanged values, used only by the historical check at :732) and candidate expectations sourced from the candidate manifest (used by the current-implementation check at :393); `--verify-historical` stops calling current-byte recomputation for the historical portion.
- Transport-smoke historical input derivation (`prepareHistoricalSmokeInput` path): prompt/schema hashes come from the retained artifacts / git blobs at the recorded implementation commit (existing precedent), not from current checkout.
- Dedicated workflow steps updated only to name identities explicitly (historical vs candidate). No gate is weakened; no step is removed.

### 6. Complexity containment

Parameterize existing modules; no new orchestration/attestation/transport stack; no `V4/Final2/Recovery2` copies. Budget: ≤12 production source files, ≤1,500 net production lines (estimate: ~8 production files — root tsconfig, workflow yml, `executionEnvelope.ts`, `forwardProductionInstrumentSeal.ts`, `imp24InstrumentCertification.ts`, `imp24ObservabilityFreeze.ts`, `migration/cli.ts`, possibly `roleQualificationRunnerV3.ts` — plus tests and the three new JSON artifacts). If implementation exceeds the budget, STOP and re-present.

### 7. Evidence payload containment

No new raw model logs or attempt trees (zero calls). A hash-backed, non-destructive `V25_EVIDENCE_RETENTION_AND_PR_SPLIT_PROPOSAL.md` classifies the ~92%-of-files evidence payload and proposes a split; **nothing is moved or deleted** in this recovery (owner approval required first).

## Commit plan (Phase 4)

1. **Commit 1 — root compile/build boundary**: root tsconfig exclude; env-map type in `executionEnvelope.ts` + two test files; regex portability fix; focused boundary regression test. Invariant restored: root tsc/build and package tsc are green over identical bytes.
2. **Commit 2 — historical vs active seal/certification identity**: mode split in seal/certification/observability/CLI/workflow code + candidate-manifest contract + focused regression tests (historical mode reads no current bytes; candidate mode fails on drift; `mayQualifySuccessor:false` enforced). Invariant restored: one instrument change no longer fans into historical-verification failures.
3. **Commit 3 — mint candidate artifacts**: `contracts/imp24f/{seal,binding,manifest}.json` minted deterministically AFTER the last src byte change, then re-verified. Invariant restored: active candidate seal binds the exact current instrument.
4. **Commit 4 — truthful reports + retention proposal**: recovery reports, implementation report, retention/PR-split proposal. No code.

Rule honored: after any failed repair verification, stop and diagnose before a second loop; never rerun an unchanged command hoping for a pass.

## Constraints reaffirmed (unchanged from the prompt)

Zero model/API calls; no threshold/label/case/retry changes; retained V1/V2/V3 evidence byte-identical (hash-proved in Phase 5); no merge/publish/promote/deploy/activation; single normal fast-forward push to `feat/v25-pipeline-live` only after all local gates pass and only if the remote head still equals `50b4d8b7`; PR #401 stays draft; `BLOCKED_NEEDS_INDEPENDENT_GOLD` remains the explicit standing blocker.
