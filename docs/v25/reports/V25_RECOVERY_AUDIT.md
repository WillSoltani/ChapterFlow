# V25 Recovery Audit

Status: COMPLETE (baseline §1–§6; audit tables §7–§13; reproduction §14; Phase-5 diagnosis §15; outcomes in V25_RECOVERY_DECISION.md and V25_RECOVERY_IMPLEMENTATION_REPORT.md)
Date: 2026-07-15
Recovery operator: Claude Fable 5 (ultracode), model-free recovery phase — model calls = 0, API calls = 0.

## 1. Baseline

- FACT — Recovery baseline SHA: `50b4d8b7027f7555551f26d82d868174e7087d8e` (`fix(v25): repair role qualification semantics and canary gating`).
- FACT — Recovery worktree: `/private/tmp/ChapterFlow-books-v25-recovery`, fresh local branch `recovery/v25-pipeline-repair` created from the verified remote head of `feat/v25-pipeline-live`. Created 2026-07-15 from an object already present locally; no fetch required.
- FACT — Remote heads at preflight (`git ls-remote origin`):
  - `feat/v25-pipeline` = `96ba2817967885a27d4248888889e622ad81ec8d`
  - `feat/v25-pipeline-live` = `50b4d8b7027f7555551f26d82d868174e7087d8e`
  - `main` = `6a792cf2572f585e56ce5dbb181307955c1896a8`
- FACT — Draft PR #401: OPEN, draft, `feat/v25-pipeline-live -> main`, head `50b4d8b7…`, mergeable, title `feat(v25): reconcile clean live SOL pipeline`, updated 2026-07-14T21:16:50Z.

## 2. Authority inventory

| # | Source | State | Notes |
|---|---|---|---|
| 1 | Platform/system instructions + repo `AGENTS.md` files | read | Pipeline `AGENTS.md` QC-loop rule noted; book content out of scope here, lifecycle not entered. |
| 2 | Recovery prompt (`docs/v25/CLAUDE_FABLE_5_ULTRACODE_V25_PIPELINE_RECOVERY_PROMPT.md`, untracked in primary checkout) + user instruction "continue" | binding | This document. |
| 3 | `/Users/radinsoltani/Downloads/IMP-24_INLINE_EVIDENCE_ENVELOPE_AND_ROLE_QUALIFICATION_RECOVERY.md` | present, read | sha256 `4a8be77edc21414bbca6ae88a532d9acc813c226c496a31f618d4bb9e4d664c8` (41,074 bytes, dated Jul 13). Preservation / no-retry / no-fallback rules treated as binding. |
| 4 | Frozen protocol decisions + retained V1/V2/V3 evidence | immutable | Verified byte-unchanged at end of recovery (Phase 5). |
| 5 | `docs/v25/GPT56_SOL_MIGRATION_MASTER_PLAN_AND_PROMPT_PACK.md` | constraint map | Not an instruction to implement every control. |
| 6 | IMP-14…IMP-24F packages/reports | consulted | Some exist only on checkpoint sibling `96ba281…`; inspected via `git show`, never merged. |
| 7 | Implementation, tests, workflows, CI logs, git history | primary evidence | See §5. |

INFERENCE — Authority conflict check: IMP-24 §18 says "Do not fix unrelated root app failures … unless repository evidence proves this branch caused them." CI evidence (run 29368952085, job `App Build + Tests`) proves the root failures are caused by files this branch added (pipeline tests + `state/migration-experiments/_owner-inputs/*.mts` compiled by root tsc). Track B is therefore in scope under both authorities; no material conflict. No other material conflicts found between the recovery prompt and the IMP-24 continuation document.

## 3. Branch graph (verified 2026-07-15)

```
37cb0804e  (common parent; IMP-20 close)
├── 96ba28179  feat/v25-pipeline (checkpoint sibling; local primary checkout)
└── 94f0acf6c  feat(v25): reconcile clean live pipeline branch and CI
    └── …  c76fc4dd4, b1e859ef6, 5642a803d, 19e1837e6 (IMP-23 terminal stop)
        └── 445e09d3e / e9a90bc17 (freeze IMP-24 V3 instrument)
            └── 7af0f8f91, 0ba1b168e (V3 evidence + IMP-24B attestation)
                └── 3b060fb0a  fix(v25): repair qualification CI gate and attestation lifecycle
                    └── 7cdc2b421 → 649235cc1 → 092832c2c → a2cda5422
                        └── 09b53ef81  retain IMP-24E terminal evidence  ← LAST GREEN dedicated-v25 CI (run 29362432844, success)
                            └── 50b4d8b70  repair role qualification semantics + canary gating  ← CURRENT FAILING HEAD (baseline)
```

- FACT — Green checkpoint: dedicated v25 workflow run `29362432844` succeeded at `09b53ef81…` (2026-07-14T19:36Z).
- FACT — Failing head: runs `29368947193` (push) and `29368952030` (PR) failed at `50b4d8b70…` (2026-07-14T21:16Z), workflow `.github/workflows/chapterflow-v25-pipeline.yml`.

## 4. Worktree inventory (none reused for recovery except the fresh one)

| Path | Ref | State | Recovery use |
|---|---|---|---|
| `/Users/radinsoltani/ChapterFlow-books` | `feat/v25-pipeline` @ `96ba281` | untracked: recovery prompt doc, `.chapterflow/`, `state/qc-orchestrator/` | READ-ONLY. Untracked files preserved untouched. |
| `/Users/radinsoltani/ChapterFlow` | `web/native-bearer-auth` | separate legacy checkout | untouched |
| `/private/tmp/ChapterFlow-books-v25-live` | `feat/v25-pipeline-live` @ `e9a90bc` (behind 9) | dirty: untracked generated state | NOT SAFE — not used |
| `/private/tmp/ChapterFlow-books-imp24f` | detached @ `50b4d8b` | clean | read-only reference only |
| `/private/tmp/imp24b-full-suite.oxUpcT` | detached @ `19e1837` | transient suite worktree | untouched |
| `/private/tmp/ChapterFlow-books-v25-recovery` | `recovery/v25-pipeline-repair` @ `50b4d8b` | fresh, clean | RECOVERY WORKTREE |

## 5. Known failures at baseline (verified from primary CI logs)

### Track A — v25 no-API suite (dedicated workflow, runs 29368947193 / 29368952030)

- FACT — Suite result: `pass 2931  fail 5  xfail 0  xpass 0  xenv(env-absent) 10  skip 39`.
- FACT — Failure text observed in job 87207323361:
  - `ForwardProductionInstrumentSealError: production instrument bytes drifted from the retained live seal`
  - `certification prompt bundle binding mismatch` (×3 occurrences in log)
- INFERENCE — Cause: commit `50b4d8b70` changed instrument/prompt bytes after the retained V3 campaign sealed them; the retained singleton `forward-production-instrument-seal-v1` and certification bundle are compared against **current checkout bytes**, which is correct for an active candidate but structurally wrong for immutable historical verification once an authorized successor changes the instrument. Alternatives considered: (a) accidental byte churn in retained artifacts — ruled out below by hash comparison in Phase 2; (b) test fixture staleness — ruled out; the seal validator intentionally reads current bytes.

### Track B — root App Build + Tests + E2E Smoke (prod build) (run 29368952085)

- FACT — Error families from job 87207340229:
  1. `state/migration-experiments/_owner-inputs/stage-q-v3-runner.mts` (and sibling snapshot sources) compiled as **root** source → dozens of TS2349/TS2339/TS7006 errors ("never"-typed imports from broken relative paths). Root `tsconfig.json` includes `**/*.ts`/`**/*.mts`.
  2. `tests/exec-envelope.test.ts` — TS2741 `NODE_ENV` missing in object literals assigned to `NodeJS.ProcessEnv` (root project augments `ProcessEnv` to require `NODE_ENV`); pipeline source counterpart `executionEnvelope.ts:282` assigns `{}` to `NodeJS.ProcessEnv`.
  3. `tests/forward-reviewer-executor.test.ts(442,103)` — TS1501 regex flag requires ES2018+; root target is ES2017.
  4. `tests/hostile-context.test.ts` — TS2352 unsafe conversions to `ProcessEnv` (same family as 2).
- FACT — `E2E Smoke (prod build)` fails because `next build` runs the same root typecheck.
- FACT — Package-local `npx tsc -p .` and `contract-validate` passed at `50b4d8b` (dedicated workflow reached the full-suite step; only the 5 Track-A tests failed).

### Track C — PR payload / storage boundary

- FACT — PR #401 vs main: ~6,664 files changed, ~1.42M insertions (6,611 added, 53 modified). Migration state tree ≈170 MB; V3 role-qualification evidence tree ≈129 MB; commit `09b53ef` retained 3,789 files / ~214k lines of terminal evidence. (Snapshot figures; re-measured in Phase 1.)
- BLOCKER — `docs/v25/reports/IMP-24F_INSTRUMENT_REPAIR_RESULT.md` truthfully reports `BLOCKED_NEEDS_INDEPENDENT_GOLD`: ten reader clean controls audited, zero eligible independent holdout gold; zero model/API/holdout/pilot calls made. This blocker MUST remain visible; nothing in this recovery may qualify, pilot, or activate around it.

## 6. Stop-condition check (Phase 0)

- Remote head unchanged from snapshot (`50b4d8b`) — no invalidation.
- Continuation document does not materially conflict with the recovery prompt.
- Clean isolated worktree established safely.

→ Proceeding to Phase 1 evidence-led audit.

---

# Phase 1 — Evidence-led audit

Method: eight parallel read-only auditors over the recovery worktree at `50b4d8b7`, plus direct reads of the seal module, certification validator, and the five failing test bodies. Every FACT below carries a file:line or command source. Zero files were modified during the audit; zero model/API calls.

## 7. Track-A root cause — PROVEN (not inferred)

- FACT — Retained IMP-24 seal: `state/migration-experiments/contracts/imp24/forward-production-instrument-seal.json` (93,335 bytes; internal `sealSha256 ca93638d…`; binds 465 files by byte sha256; last minted at `a2cda5422`). Retained IMP-22 sibling: `contracts/imp22/…` (`a2c03c29…`, 428 files, minted `5642a803d`) — only loaded by IMP-23 pilot/gold paths; not part of the current failure.
- FACT — Seal-bound hash comparison vs current worktree: **457/465 match, 0 missing, exactly 8 mismatch**, and the mismatch set equals `bound-set ∩ git diff 09b53ef8..50b4d8b7 --name-only`: `src/bakeoff/migration/{imp24InstrumentCertification,roleQualificationRunnerV3}.ts`, `src/orchestrator/{forwardRetainedRoleQualificationEvidenceV3,forwardRoleQualificationLiveV3}.ts`, `src/review/{quizIntegrityReview,readerExperienceReview,reviewModelOutputV2,sourceIntegrityReview}.ts`.
- FACT — 5 NEW src files from `50b4d8b7` enter seal inventory scope on rebuild (465→470): `imp24ThresholdCoverage.ts`, `imp24fThresholdCoverageCertification.ts`, `src/review/{quizIntegritySemanticRules,readerExperienceSemanticRubric,sourceIntegritySemanticRules}.ts`. So reverting the 8 bytes would NOT restore the seal; inventory drift is independent.
- FACT — Certification binding `contracts/imp24/instrument-certification-binding.json` (`certificationSha256 ff4e1242…`, status CERTIFIED_MODEL_FREE, experimentId `s16-forward-role-qualification-v3-envelope`) retains `promptBundleSha256 4da98a79…`. **Reproduced bit-for-bit** as `hashCanonical({reader,source,quiz})` per-role hashes computed with the PRE-commit 3-field recipe `{moduleSha256, builder, schema}` over PRE-commit `reviewModelOutputV2.ts` bytes (`8384b88e…`). Per-role values match the retained prompt-bundle sidecars exactly.
- FACT — `50b4d8b7` changed BOTH the bytes (`reviewModelOutputV2.ts` → `0065c591…`) AND the recipe (now 5 fields incl. `semanticVersion`/`semanticSha256` from the three new semantic modules; `buildImp24RolePromptSourceHashes`, imp24InstrumentCertification.ts:426-454). The retained `promptBundleSha256` is unreproducible under the new recipe by construction. `scorerSha256` is stale for the same reason (hashes `reviewModelOutputV2.ts` + `roleQualificationRunnerV3.ts` bytes).
- FACT — `50b4d8b7` modified ZERO files under `state/**` (git diff-tree: 26 paths — 13 src, 5 tests, 6 reports, 2 scratch). No retained evidence was rewritten.
- INFERENCE — The five suite failures are one defect class: **retained singleton artifacts of the completed V3 identity are validated by recomputation from current checkout bytes and current in-code semantics.** Alternatives eliminated: evidence corruption (hashes reproduce exactly under the historical recipe), test staleness (tests correctly exercise the validators; the validators' comparison mode is the defect).

## 8. Failing-gate map

| Gate | Exact failure | First introducing commit | Root cause | Smallest valid fix | Must not change |
|---|---|---|---|---|---|
| v25 suite: `IMP-24C dedicated model-free CI commands preserve every checkout byte` (tests/imp24-pre-live-freeze.test.ts:353) | `imp24-certify-instrument --json` → `ForwardProductionInstrumentSealError: production instrument bytes drifted from the retained live seal` (thrown at forwardProductionInstrumentSeal.ts:166 via certifyImp24Instrument → verifyRetainedForwardProductionInstrumentSeal, imp24InstrumentCertification.ts:1484) | `50b4d8b7` (bytes) on validator design from IMP-22/24 | Retained imp24 seal is a singleton compared against current bytes; successor commit changed 8 bound files + added 5 in-scope files | Candidate-generation seal artifact bound to current bytes; retained imp24 seal verified as historical (self-hash + identity binding, no current-byte compare) | Retained seal bytes; thresholds; frozen corpus |
| v25 suite: 3× `IMP-24D …` tests (tests/imp24-transport-smoke-v3.test.ts:411, 601, 777) | `certification prompt bundle binding mismatch` (roleQualificationRunnerV3.ts:688) thrown inside shared helper `preparedSmokeInput()` → `prepareHistoricalSmokeInput` → `buildLegacyRoleQualificationPlanV3` before test bodies run | `50b4d8b7` (bytes + recipe) | Helper loads RETAINED binding then re-derives prompt-source hashes from CURRENT checkout (`prepareImp24QualificationCases`) | Historical smoke-input derivation pinned to the recorded implementation commit (existing git-blob precedent: imp24PilotGoldWorkflow.ts:431-450, imp24ObservabilityFreeze.ts:246) | Retained binding; retained smoke evidence; test semantics (they verify the IMP-24D lifecycle) |
| v25 suite: `IMP-24D observability freeze is deterministic…` (tests/imp24-observability-freeze.test.ts:124) | `retained current certification differs from the model-free recomputation` | `50b4d8b7` (recipe change reaches into historical recompute via compiled-in constants) | `buildImp24DObservabilityFreeze` recomputes certification with CURRENT in-code semantic constants even over pinned-commit bytes; `EXPECTED_PROMPT/SCHEMA_BUNDLE_SHA256` (imp24ObservabilityFreeze.ts:93-94) serve BOTH current (:393) and historical (:732) checks | Split historical vs current/candidate expectations; historical path derives expectations from the pinned commit, candidate path from the new candidate certification | Retained freeze artifacts; historical R1 bindings (`IMP24D_HISTORICAL_R1_BINDINGS`, `IMP24D_R1_CLOSURE_BYTES_SHA256`) |
| Root `npm run typecheck` / `App Build + Tests` | 446 errors: 439 in 21 files under `state/migration-experiments/_owner-inputs/**`; 7 real: 6× ProcessEnv (`NODE_ENV` required by `next/types/global.d.ts:20-24`) in `src/exec/executionEnvelope.ts:282` + `tests/exec-envelope.test.ts:334,342,355` + `tests/hostile-context.test.ts:43,75`; 1× TS1501 dotAll regex at `tests/forward-reviewer-executor.test.ts:442` under root ES2017 | evidence snapshots committed over IMP-19→24 waves; env typing/regex in IMP-24-era tests | Root tsconfig includes `**/*.ts`+`**/*.mts` with no `state/**` exclusion → inert evidence compiled as root source; pipeline-only code assumes @types/node-only ambient env and ES2022 | Exclude v24 pipeline `state/**` from root tsconfig; local env-map type instead of `NodeJS.ProcessEnv`; `[\s\S]` instead of `/s` flag | Retained snapshot bytes (registry-hashed by tests/closed-registry-sync.test.ts:50-58 and nativeReviewSeal.ts:87,159 — must be excluded, never edited) |
| Root `npm run build` / `E2E Smoke (prod build)` | `next build` stops at `executionEnvelope.ts:282` (`NODE_ENV missing in {}`); no `ignoreBuildErrors` in next.config.ts | same | same as above | same as above | — |

## 9. Requirement disposition

| Requirement | Source | Current implementation | Current test/evidence | Disposition | Reason |
|---|---|---|---|---|---|
| V1/V2/V3 evidence immutable, non-qualifying | IMP-24 §4/§12; recovery prompt | `legacy-v1-v2-evidence-closure.json` (PRESERVED_CLOSED_NON_RESUMABLE); V3-final retained tree 129MB; closed CLI subverbs hard-refuse | closure tests; `close-legacy-campaign` CI step | KEEP | intact; `50b4d8b7` touched zero state files |
| Production instrument seal binds exact current instrument | IMP-22; IMP-24 §13/§14 ("remint after code and contract changes") | singleton per-namespace artifact; current-byte validator | seal tests pass (temp fixtures); retained-artifact checks fail | REPAIR | valid concept; needs candidate-generation artifact + historical mode for superseded generations |
| Certification binds prompt/schema/corpus/threshold/scorer hashes | IMP-24 §11 | `instrument-certification-binding.json` singleton; validateCertification (roleQualificationRunnerV3.ts:672-698) | 3 failing transport-smoke tests | REPAIR | same split: retained binding = historical; candidate binding = current bytes, new recipe |
| Historical verification anchored to recorded commits | IMP-24D precedent | `--verify-historical` (imp24ObservabilityFreeze.ts:681-774) + legacy-recipe recompute (imp24PilotGoldWorkflow.ts:431-450) — but still calls `verifyCurrentImplementationArtifacts` at :760 | observability test failing | REPAIR | extend the existing pattern; decouple historical path from current bytes |
| Workflow identity explicit; read-only lifecycle verification in CI | 3b060fb0a; IMP-24C | workflow steps 13-17 read-only; identity gates (imp24FinalAttestation.ts:512-559) | pre-live-freeze workflow tests pass | KEEP + extend | commands must additionally state WHICH identity (historical vs candidate) they verify |
| Reader 0-100 scale, 2/2 canary, threshold coverage, canonical sets (IMP-24F semantic repair) | IMP-24F report | shipped in `50b4d8b7` (13 src files) | 25/25 coverage rows PASS per report; package tsc green | KEEP | the repair is sound; only its lifecycle identity handling is missing |
| Independent reader gold before any live phase | IMP-24F | `BLOCKED_NEEDS_INDEPENDENT_GOLD`; 10 controls audited, 0 eligible | IMP-24F_INSTRUMENT_REPAIR_RESULT (result sha256 `2bdd26a5…`) | KEEP (BLOCKER) | must remain visible; nothing here may qualify around it |
| Root and package checks green at same commit | recovery prompt success #4 | root tsc/build red (boundary defect) | reproduced §14 | REPAIR | Track B |
| IMP-14 / IMP-15–17 feature packages | checkpoint sibling `96ba281` only | not on live branch | n/a | DEFER | bounded shadow-first additions; out of recovery scope by interpretation rule |
| Evidence/runtime storage boundary | recovery prompt Track C | none (raw evidence in code PR) | §12 | DEFER to proposal doc | non-destructive retention proposal only; owner approval required for any move |

## 10. Lifecycle identity map

| Identity | Instrument bytes | Seal | Certification | Evidence tree | Disposition | May compare to current checkout? |
|---|---|---|---|---|---|---|
| `s16-forward-role-qualification-v1` | pre-IMP-22 | n/a | n/a | 1.8M | INVALID_INSTRUMENT_DO_NOT_ATTEST, closed | NO |
| `s16-forward-role-qualification-v2` | pre-IMP-22 | n/a | n/a | 736K | BLOCKED_CALIBRATION_INVALID, closed | NO |
| `…-v3-envelope` (protocol/IMP-24B) | `19e1837e`→ | — | — | 28K | BLOCKED_ZERO_CALL_CONTROL_PLANE_DEFECT, closed (pinned inline in imp24FinalAttestation.ts:448-508) | NO |
| `…-v3-envelope-r1` (IMP-24C) | `0ba1b168`→ | — | — | 376K | BLOCKED_OBSERVABILITY_INCOMPLETE, closed; bytes pinned in `IMP24D_R1_CLOSURE_BYTES_SHA256` | NO |
| `…-v3-envelope-r2` (IMP-24D) | `3b060fb0`→`649235cc` | historical via git-blob verify | legacy 3-field recipe via git show | 364K smoke | terminal, one permitted mechanical correction recorded | NO (already commit-anchored) |
| `…-v3-envelope-final` (IMP-24E) | `a2cda5422` | retained imp24 seal `ca93638d…` | retained binding `ff4e1242…` (prompt bundle `4da98a79…`, 3-field recipe) | 129M; 338 codex calls; ROLE_SET_NOT_READY | COMPLETED TERMINAL — historical | **NO — this is the defect: today's validators say YES** |
| IMP-24F semantic repair candidate (current head `50b4d8b7`) | 8 modified + 5 new src files | none minted | none minted (new 5-field recipe has no artifact) | none (zero calls) | CANDIDATE — needs fresh identity + candidate seal/certification | YES (this and only this) |

## 11. Artifact ownership (path families)

| Artifact/path family | Runtime input | Current candidate contract | Historical evidence | Generated summary | Raw evidence | Required in code PR? |
|---|---:|---:|---:|---:|---:|---:|
| pipeline `src/**`, `config/**`, `contracts/schemas/**` | ✓ | ✓ (seal scope) | — | — | — | ✓ |
| `contracts/imp24/{seal,binding,corpora,prompts,thresholds}` | loaded at runtime | frozen V3-final identity | ✓ (immutable) | — | — | ✓ (small, load-bearing) |
| `contracts/imp22/*` | IMP-23 paths only | — | ✓ | — | — | ✓ (small) |
| `state/migration-experiments/s16-…-final/**` (129MB, 3,728 files) | — | — | ✓ | — | ✓ | ✗ — retention boundary needed (proposal doc) |
| `state/migration-experiments/{v1,v2,r1,smokes,probes,pilot,gold,layer-n}/**` | — | — | ✓ | — | ✓ | ✗ — same |
| `state/migration-experiments/_owner-inputs/**` (8.3M, incl. 16 .mts + 18 .ts snapshots) | — | — | ✓ (registry-hashed) | — | ✓ | ✗ — must be excluded from root compile, never edited |
| `docs/v25/reports/**` (109 files) | — | — | ✓ | ✓ | some JSON >100KB | ✓ mostly; large JSONs flagged in proposal |
| `docs/v25/chapterflow-140-evaluation/**` (66MB; 513,596 inserted lines; one duplicated 242KB zip pair) | — | — | owner input | — | ✓ | ✗ — biggest single line-count contributor |
| `.agents/skills/**` (66 files) | gold-asset refs in seal (6 files) | ✓ (6 sealed) | — | — | — | ✓ |
| root `tsconfig.json`, workflow yml | ✓ | — | — | — | — | ✓ |

## 12. PR payload disposition (Track C)

- FACT — `git diff --shortstat b8815ca02..50b4d8b70` (merge-base with origin/main): **6,664 files, +1,422,281 / −1,450** — matches the snapshot's ~figures.
- FACT — Raw execution evidence: 5,025 files / +336,150 lines (~145MB); `s16-…-final` alone 3,728 files / 130MB, landed by `09b53ef8` (3,789 files, +214,458, 0 deletions — 57% of all changed files).
- FACT — Owner-input snapshots: `_owner-inputs` 1,082 files / 9MB; `docs/v25/chapterflow-140-evaluation` 8 text files / **513,596 lines (36% of all inserted lines)** + 3 zips, two byte-identical (sha1 `f256a254…`).
- FACT — Runtime code 171 files / +78,842; tests 133 / +43,038; reports 109 / +25,498; workflows/config 6 / 263; skills 66 / +23,659. Zero changes under `app/`, `components/`, `lib/`, `infra/`.
- INFERENCE — ~92% of changed files and ~86% of inserted lines are evidence/snapshot/corpus payload not needed at runtime. A non-destructive retention boundary (separate evidence PR / storage channel) is required before merge; **no move or deletion in this recovery** — see `V25_EVIDENCE_RETENTION_AND_PR_SPLIT_PROPOSAL.md`.

## 13. Complexity inventory (only what contributes to the failure or ambiguity)

- `imp24FinalAttestation.ts` (1,445 lines) vs `imp24DFinalAttestation.ts` (1,762) — near-clone attestation stacks with divergent anchoring (C: lifecycleBaselineCommit; D: startingHead + correction). Not repaired here (not a failing gate); recorded as duplication debt.
- Five independent current-bytes comparison layers fan one instrument change into five failures: seal validate; `certifyImp24Instrument` recompute; `validateCertification`; `loadExactTerminalQualification`; `verifyCurrentImplementationArtifacts`. The recovery gives them ONE explicit identity policy instead of adding a sixth layer.
- `EXPECTED_PROMPT_BUNDLE_SHA256`/`EXPECTED_SCHEMA_BUNDLE_SHA256` (imp24ObservabilityFreeze.ts:93-94) are single constants used for BOTH historical (:732) and current (:393) checks — the two uses must be split, not bumped.
- Two seal namespaces (imp22/imp24) with three CLI subverbs and implicit default paths — commands do not state which identity they verify (design outcome 5).
- The v24 pipeline is NOT an npm workspace; root `pipeline:*` scripts target v21 only. Excluding pipeline paths from root compile without adding a root-side hook would silently remove type coverage (risk recorded for Track B design).

---

# 14. Phase 2 — Reproduction (once, recovery worktree, zero model calls)

| Check | Command | Result |
|---|---|---|
| Focused seal/cert failures | `CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx tests/run.ts imp24-transport-smoke-v3 imp24-observability-freeze imp24-pre-live-freeze forward-production-instrument-seal` | **pass 25 / fail 5** — identical five tests, identical error strings as CI runs 29368947193/29368952030; stack: certifyImp24Instrument → verifyRetainedForwardProductionInstrumentSeal → drift |
| Root typecheck | `npm run typecheck` | FAIL — 446 errors: 439 in 21 `state/_owner-inputs` files, 7 real (6 ProcessEnv + 1 TS1501); histogram TS2307×145, TS7006×144, TS2339×89, … |
| Root build | `npm run build` | FAIL — `Type error: Property 'NODE_ENV' is missing in type '{}' but required in type 'ProcessEnv'` (executionEnvelope.ts:282; first error Next hits) |
| Package typecheck | `npx tsc -p . --noEmit` (pipeline dir) | PASS |
| Contract validation | `node --import tsx src/cli.ts contract-validate` | PASS (4 worker reports PASS) |
| Full no-API suite | — | NOT RUN yet (per required sequence; runs once in Phase 5) |

Observed failures match the audit snapshot exactly; no update to the failure model was required.

---

# 15. Phase 5 diagnosis — full-suite branch-identity condition (resolved before any further edit)

- FACT — First full-suite run at the recovery head reported `pass 2917 fail 26` (two runs, identical). All 26 failures carry ONE error: `retained implementation evidence must be verified on feat/v25-pipeline-live or an exact detached CI checkout` (thrown at forwardRetainedRoleQualificationEvidenceV3.ts:1008-1009; sibling gate forwardRoleQualificationCampaignV3.ts:763).
- FACT — The guard accepts `git branch --show-current` equal to `feat/v25-pipeline-live` OR empty (detached), and requires the retained CI-gate head (`a2cda5422…`) to be an ancestor of current HEAD.
- INFERENCE (causal) — The recovery worktree runs on local branch `recovery/v25-pipeline-repair`, so every retained-evidence/activation test fails the branch-identity precondition regardless of code content. This is the exact condition the dedicated workflow's disposable-worktree step exists for ("the live/activation boundary requires the exact authorized branch identity and the Actions checkout is detached" — chapterflow-v25-pipeline.yml step 9). The 26 failures are environmental, not a regression: none of the recovery commits touch those modules' logic, and the same 26 would fail at baseline `50b4d8b7` in any equally-named local branch.
- DECISION — Re-run the full suite once in a disposable DETACHED worktree at the recovery head (`/private/tmp/chapterflow-v25-suite-recovery`), mirroring the CI-accepted identity. No code edit; no gate weakened; the branch-identity guard itself is correct and untouched.
- Note — an earlier capture defect (piping the first run through `tail -30`) discarded per-test failure detail; the diagnostic re-run captured full output. Neither re-run sought a different outcome from an unchanged gate: run 2 captured detail, run 3 corrected the execution environment to the one the gate explicitly requires.
