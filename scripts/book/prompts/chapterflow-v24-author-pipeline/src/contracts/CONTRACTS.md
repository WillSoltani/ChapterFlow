# Phase-0 frozen integration contracts (GPT-5.6 SOL migration)

Frozen 2026-07-10 by IMP-00 per master plan §8.2 / §12
(`docs/v25/GPT56_SOL_MIGRATION_MASTER_PLAN_AND_PROMPT_PACK.md`). Every parallel
work package builds against THESE shapes; a package that finds a contract gap
must stop, file a versioned contract-change proposal with blast-radius analysis,
and get integration approval — silent local variants are a merge blocker.

| Contract | Version | Owner | Consumers |
|---|---|---|---|
| `execution-profile` | 1 | IMP-00 | every spawn; IMP-01 attempt binding; IMP-02 routing |
| `effective-context-manifest` | 1 | IMP-00 | IMP-10 evidence links; §15 audit; §16 bakeoff manifests |
| `candidate-transaction` | 1 | IMP-01 | IMP-07 patches; IMP-10 evidence; final gate freshness |
| `source-use-plan` | 1 | IMP-03 | IMP-04 critics; IMP-05 card; IMP-07 dependency closure; IMP-09 validators |
| `repair` | 1 | IMP-07 | IMP-08 finding normalization; IMP-05 prior-finding rendering |
| `review-output` | 1 | IMP-08 | acceptance/carry; IMP-11 judge outputs |
| `route-result` | 1 | IMP-02 | IMP-10 evidence; IMP-11 cells; IMP-13 drift triggers |
| `attempt-evidence-manifest` | 1 | IMP-10 | §15 audit; §16–§19 evidence; IMP-13 monitoring |
| `worker-implementation-report` | 1 | IMP-00 | every IMP package; §15 integration audit |
| `reader-experience-review` | 1 | IMP-20 | split-lane reader lane; aggregate-chapter-review; recovery instrument manifest |
| `source-integrity-review` | 1 | IMP-20 | split-lane source lane (only external-truth authority); aggregate-chapter-review |
| `quiz-integrity-result` | 1 | IMP-20 | split-lane quiz two-phase lane; aggregate-chapter-review |
| `aggregated-chapter-review` | 1 | IMP-20 | conductor-owned final status over the three lanes + deterministic bundle |
| `judge-capability-qualification` | 1 | IMP-20 | per-role judge registry; recovery role-set readiness; qualification freshness |

## Additive change note (IMP-20, 2026-07-12)

The five `IMP-20` rows above are ADDITIVE — the split-lane reviewer & §16
recovery contracts. Registering them regenerated the manifest to **14 contracts**;
no pre-existing descriptor was edited, so no existing `contractHash` moved (the
freeze test recomputes every hash and confirms only the five new rows). Each
descriptor exports its `V1` type, a strict unknown-key-rejecting `validateX`
validator, and the `X_CONTRACT` descriptor; they are inert until this registration
(Wave-C single owner) imports them into `ALL_CONTRACTS`.

## Change protocol

1. Bump the contract's `version` and edit its descriptor + TS types together.
2. `npx tsx src/contracts/generateManifest.ts` (regenerates `contract-manifest.json`;
   the freeze timestamp is preserved — it marks the ORIGINAL Phase-0 freeze).
3. `tests/contracts-freeze.test.ts` enforces manifest ↔ descriptor agreement; a
   hash change without a version bump fails the suite.
4. Record the change + blast radius in the owning package's implementation report.

## Related

- `requirement-traceability.json` — IMP-00 requirement → surface → test map.
- `logs/exec/` (gitignored) — per-spawn effective-context manifests, result
  sidecars, and the CLI qualification cache produced by the envelope at runtime.
