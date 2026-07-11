# §15 Audit Addendum — G3 Impact Determination and Fix

**Date:** 2026-07-10 · **Parent audit:** `docs/v25/reports/S15-INTEGRATION-AUDIT.md` (SHA-256 `66a3dcfd49ff8b068c38bdddf802971d7f0c3c011260d0f8da7d53b491afaacf`, preserved in commit `f14873bfa`) · **Scope:** gap G3 only. Nothing here reopens §15; the `BAKEOFF AUTHORIZED: YES` verdict stands and is strengthened by this fix.

## 1. Impact determination — does the D7 alias matcher touch §16?

Owner's seven categories, each answered from code:

| §16 surface | D7 participates? | Evidence |
|---|---|---|
| Gate | **YES** | `authorWriteContractFindings` (D7 lead-thread checks at `src/orchestrator/authorRun.ts:472-488` post-fix; pre-fix `:468-484`) is invoked in the candidate validation ladder at `authorRun.ts:1130` (initial write) and `authorRepair.ts:557` (repair closure); its complaints reject the candidate. |
| Eligibility decision | No | Book/chapter/stratum selection is spec-carried (`experimentTypes.ts` `ExperimentBookV1`); no D7 involvement. |
| Sample classification | **YES** | `sampleRunner.ts:289` sets `firstWriteDeterministicPass: result.ok`; a D7-failed candidate makes `result.ok` false and `classifyProviderOutcome` (`sampleRunner.ts:224`) classifies the clean-spawn-failed-validation sample `content_invalid`. |
| Metric | **YES** | First-write pass and acceptance rates aggregate from those fields (`metrics.ts`), and `projectedRepairPerChapter` derives from them. |
| Reviewer qualification | No | Stage Q runs `reviewOneChapter` over corpus chapters (`qualification.ts`); D7 is a writer-side contract. |
| Adjudication | No | Two-phase quiz adjudication (`quizDerivation.ts` / `readerReview.ts`) has no D7 involvement. |
| Final winner decision | **YES (transitive)** | Threshold groups T3 (non-inferiority over acceptance) and T9 (repair demand) consume acceptance/first-write-pass (`thresholds.ts` `evaluateProfile`), so decoy-inflated D7 passes could bias the qualification verdict. |

**Determination: D7 affects §16 → fix required before the bakeoff** (per owner instruction). The defect direction was a false PASS (a same-suffix decoy entity satisfying the lead contract), i.e. inflated first-write pass/acceptance; because different models may drift to decoy entities at different rates, the error was not guaranteed cell-symmetric.

## 2. The fix (commit `27aeddc16`)

- **Full commit:** `27aeddc16872320d89c261dcd5a1783e7c919a77` · **pipeline tree at commit:** `c82cc5bd49d40bc54165c78e43605562f721255e` (repo tree hash; pipeline files under `scripts/book/prompts/chapterflow-v24-author-pipeline/`).
- `src/critics/leadAliases.ts`: curated `GENERIC_ENTITY_SUFFIXES` (44 lowercase org/institution suffix words, documented, extend-only-with-fixture) + exported `suppressGenericSuffixAliases(label, aliases)`. Suffix tokens lose **standalone**-alias status only when the label carries at least one distinctive (non-suffix) name-shaped token. Multi-word aliases keep their suffix words ("Southwest Airlines" still matches as a phrase); degenerate all-suffix labels ("The University") and concept labels (no name-shaped token) are untouched, so D7 remains satisfiable. Applied at derivation (`leadAliasSet` return).
- `src/orchestrator/authorRun.ts`: the same suppression applied at **check time** on whichever alias list D7 uses — this is load-bearing because dealt briefs minted before the hardening carry raw `leadThread.aliases` arrays (frozen §16 shared inputs would otherwise bypass a derivation-only fix).
- **Not a broad stopword rule:** suffixes remain name-shaped (family-name assembly unchanged), remain inside multi-word aliases, and are suppressed conditionally; the distinctive token alone still satisfies D7 — exactly the pre-IMP-09 first-token strictness, restored on this class while keeping every IMP-09 false-negative fix (surnames, particles, diacritics, concept leads).

## 3. Regression fixtures added (`tests/lead-aliases.test.ts`)

- Same-suffix decoy: lead "Southwest Airlines", chapter about "Delta Airlines" → **both** D7 complaints fire on the dealt-alias path (raw legacy array) **and** the derived path; `legacyD7Token` pinned as "Southwest" to document the restored strictness.
- Legitimate forms: full phrase and distinctive-token-only chapters still pass (no legitimate-entity damage).
- Degenerate escape: "The University" keeps its only alias; concept labels untouched (`suppressGenericSuffixAliases` is a proven no-op on both).
- D7 shadow corpus: new `org-suffix-decoy` row — legacy and new matcher **agree: absent** (zero `old-correct-new-wrong` rows maintained).

## 4. Test evidence

- Targeted: `npx tsx tests/run.ts lead-aliases` → **16 pass / 0 fail** (13 existing + 3 new).
- Full suite on the fixed tree: `CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx tests/run.ts` → **pass 2326 · fail 0 · xfail 0 · xpass 0 · xenv 6 · skip 18** (was 2323/0; +3 = exactly the new tests; skip/xenv unchanged — nothing disabled).
- `npx tsc -p . --noEmit` → clean.

## 5. No-weakening confirmation

The change is **stricter-only on the decoy class**: no alias acceptance was widened; the suppression can only remove standalone aliases, never add matches. No gate, threshold, bar, retry cap, route, schema, or frozen contract changed (diff = `leadAliases.ts` + the D7 alias-list construction in `authorRun.ts` + tests; `git show --stat 27aeddc16` = 3 files, +103/−6). D7's severity, complaint strings, and call sites are unchanged. The §16 measurement instruments now reject the decoy channel symmetrically in every cell (both prompt stacks are checked by the CURRENT instruments).

## 6. Residual note

The one-token case-sensitivity rule and the curated suffix list remain heuristic; any future suffix addition requires a paired decoy fixture (rule documented at the set's definition). No deferral record is needed — G3 is fixed, not deferred.
