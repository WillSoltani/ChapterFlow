# §16 Legacy Reviewer-Migration Campaign — CLOSURE

**Status: `ARCHIVED_INCONCLUSIVE_REVIEW_INSTRUMENT_MISMATCH`**

This document closes the §16 GPT-5.6-SOL reviewer-migration campaign. The campaign
built and ran a reviewer-qualification instrument (Stage-Q Layer-O + Layer-N) but
never produced an authoring-migration decision and never began candidate/diagnostic
book generation. It is archived because its qualification instrument and gold were
provably mutated between live runs (development evidence, not a confirmatory bake-off)
and because the Layer-N v2 panel did not qualify (1 of 3), driven by a reviewer-
instrument mismatch (source-truth blocking authority handed to a source-blind reader
lane). The successor is the split-lane reviewer + `s16-reviewer-recovery-v1` recovery
experiment (IMP-20); it is a NEW identity, not a resume of any seal below.

The machine-readable companion is `S16_LEGACY_CAMPAIGN_CLOSURE.json` (this directory).
No prior closure artifact existed; nothing is overwritten. **No pre-existing status,
seal, manifest, or result file under `state/migration-experiments/` was modified or
deleted by this closure — it is purely additive.**

---

## 1. Exact call ledger (immutable closure facts)

Authoritative source: `_owner-inputs/stage-q/LAYER_N_V2_FINAL_QUALIFICATION_RESULT.json`
(`exactCallLedger`), cross-verified against `_owner-inputs/CALL-LEDGER-RECONFIRM.2026-07-11.json`
and `EVIDENCE_STATUS_AND_APPROVALS.json`.

| Metric | Value | Note |
|---|---|---|
| `campaignTotalConsumed` | **711** | Stage-Q Layer-O 540 + Layer-N v2 171 — the recomputed-campaign figure |
| `totalLiveCallsEverIncludingLayerNv1` | **811** | 711 + the 100 earlier Layer-N **v1** INSTRUMENT_INVALID live calls |
| Stage-Q Layer-O calls | 540 | v1 192 + v2 138 + v3 calibration 18 + v3 qualification 192 |
| Layer-N v2 calls | 171 | run1 37 + run2 38 + run3 96 (run3: gpt-5.5@high 36 / gpt-5.6-sol@high 24 / gpt-5.5@xhigh 36) |
| Layer-N v1 calls | 100 | separate line item — a pre-restructure sunk cost, NOT folded into 711 |
| `sealedHardMax` | **2096** | the OLD ceiling; it is NOT reused — `s16-reviewer-recovery-v1` gets a NEW ceiling |
| `diagnosticCallsMade` | **0** | diagnostic generation never began |
| `confirmatoryCallsMade` | **0** | confirmatory generation never began |

Both totals are stated explicitly: **711 ledgered, 811 ever** (the 100 Layer-N v1 calls
are the difference). Every call in the campaign routed through
`codex_exec_chatgpt_subscription` with `CHAPTERFLOW_NO_API_CODEX_QC=1`, no forbidden
provider env, and 0 canonical-tree writes. `independentHumanRater: false` throughout —
gold was labeled by GPT-5.6 Pro under explicit product-owner delegation.

---

## 2. Stage-Q Layer-O reviewer-qualification history

- **v1 — `STAGE_Q_INSTRUMENT_INVALID`** (192 calls, 64 cases × 3 judges). Near-unanimous
  panel agreement (pairwise kappa 0.967–1.0) with two whole defect families at 0.0
  sensitivity = a task/label mismatch, NOT judge incapability. `STAGE-Q-V1-POSTMORTEM.md`.
- **v2 — `SEALED_PRE_LIVE_V2`** (`stageQv2.ts` sha `06432e9d`, commit `4a700857e`), 138
  live calls; still INSTRUMENT_INVALID (37/64 schema failures; evidenceSpans emitted as a
  string). `STAGE-Q-V2-SEAL.json`.
- **v3 — `SEALED_PRE_LIVE_V3` → `ALL_THREE_JUDGES_QUALIFIED`** (`stageQv3.ts` sha `49a65f65`,
  commit `2657cec34`). Schemas rewritten to the OpenAI strict `--output-schema` subset; 18
  calibration + 192 qualification calls; `allThresholdsMet: true`, 0 schema failures. One
  systematic-but-non-material addendum **SQV3-RF-U2** (UNSUPPORTED vs INCONCLUSIVE; 0.875
  clears the 0.85 bar) remains **open**. This is the **only PASSED gate** in the campaign and
  the bound security prerequisite for Layer-N (`layerOPrerequisite → stage-q-layer-o-v3`,
  seal file sha `ffba6d2c…`). Owner directive 2026-07-11: **no further Stage-Q authorized.**

Panel across v1/v2/v3 and Layer-N (identical): gpt-5.5@high, gpt-5.6-sol@high, gpt-5.5@xhigh.

---

## 3. Layer-N reviewer-qualification history

- **v1 — `INSTRUMENT_INVALID`** (`qualification.ts` v1 schema; 43-item corpus sha `a127d8ce`).
  100 live calls inside `diagnostic-stack-2026-07/qualification/` (gpt-5.5@high 43 +
  gpt-5.6-sol@high 43 + gpt-5.5@xhigh 14 partial). `AUTHOR_CHAPTER_BAR=80` applied to
  248–2186-byte stub fixtures → FPR 1.0 / ~0 per-class sensitivity. `LAYER-N-V1-DISPOSITION.json`.
- **v2 run1** (`layer-n-v2-qualification-RUN1-instrument-invalid`, 37 calls): a material
  hard-blocker scoring defect (`blocked = review.valid && !review.pass`) → **scorer v2.2**
  (detection = mustFix-in-target-unit + verified evidence; `ship84` dropped).
  `LAYER-N-V2-INSTRUMENT-INVALID-FINDING.json`.
- **v2 run2** (`layer-n-v2-qualification-RUN2-craft-borderline`, 38 calls): the **gold was
  changed** — after a surgical run1 re-word, all 4 craft fillers were re-worded to neutral
  platitudes, then resealed and rerun once. `LAYER-N-V2-CRAFT-TEMPLATE-ROOT-CAUSE.json`.
- **v2 run3 / final** (`layer-n-v2-qualification`, 96 calls): **`PANEL_NOT_QUALIFIED` (1/3)**.
  - gpt-5.5@high **QUALIFIED** (28/28, every capability met).
  - gpt-5.6-sol@high **NOT QUALIFIED** (20/28 processed then halted; cleanPass **0.125** — it
    systematically flagged the top-approved books' named illustrative examples as reserved
    category-7 "fabricated/misleading example" mustFixes, exactly what a source-blind reader
    prompt asks for with no source evidence to falsify them; **14-case sol-specific divergence**).
    `LAYER-N-V2-FABRICATED-EXAMPLE-FINDING.json`, `SOL_JUDGE_SOURCE_REGISTER_DIVERGENCE_PACKET.{json,md}`.
  - gpt-5.5@xhigh **NOT QUALIFIED** (28/28; `quizAmbiguityDetectionRate` **0.75 < 0.85**, missed
    one genuine two-answer ambiguity — the 0.85-over-4-cases brittleness).
  - `instrumentValidity = STRUCTURALLY_VALID_WITH_UNRESOLVED_CLEAN_CONTROL_ADJUDICATION`; scorer
    mechanics correct and thresholds never changed, but the clean-control gold carries an open
    14-case question. **Authoring-role implication NOT DETERMINED** (reviewer-role only).

---

## 4. Sealed experiments + dry runs (no live generation)

- `diagnostic-stack-2026-07` — `completedPhases:['seal']` only (seed `s16-owner-pkg-96ff9e3da9e3-diag`,
  specSha256 `5f27cc1e…`, sealed.json byte-sha `e8e5d4bb…`, book start-with-why, 6 expected cells).
- `confirmatory-sol-2026-07` — `completedPhases:['seal']` only (specSha256 `5fa7968d…`, sealed.json
  byte-sha `45cf77c1…`, books start-with-why + radical-candor, 4 expected cells). Both share
  thresholdsSha256 `6a90acea…`.
- `diagnostic-stack-dryrun-2026-07`, `confirmatory-dryrun-2026-07` — **synthetic-label dry runs**
  (driven by `*-dry-run-driver.mts` with synthetic labels; `diagnosticCallsMade: 0`). No live calls.

Neither live sealed experiment has a `records/` dir; both are frozen at seal.

---

## 5. Mechanical resume freeze (the core of this closure)

Writing a status field alone does NOT block resume — `runMigrationExperiment` resumes any
experiment whose `manifest.completedPhases=['seal']` straight into the live `qualify` phase,
`guardSeal` checks drift only, and `haltReason` is write-only. The freeze is therefore
enforced **in code**, at the gate-able `src/` chokepoints:

- **`src/bakeoff/migration/guards.ts`** — the frozen `CLOSED_EXPERIMENT_IDS` set + `assertNotClosed(id)`
  (throws `MigrationGuardError`). `guards.ts` is the one migration file exempt from the
  canonical-literal firewall grep and already owns the firewall constants, so it is the correct
  home for the registry. The Set holds BOTH experiment-id slugs AND corpus/instrument ids:
  `diagnostic-stack-2026-07`, `confirmatory-sol-2026-07`, `diagnostic-stack-dryrun-2026-07`,
  `confirmatory-dryrun-2026-07`, `layer-n-v2-qualification`, `s16-layer-n-native-review-v2`,
  `stage-q-layer-o-v1`, `stage-q-layer-o-v2`, `stage-q-layer-o-v3`, `layer-n-v1`.
- **`runMigrationExperiment(experimentId)`** — `assertNotClosed(experimentId)` fires immediately
  after the id resolves and **before** the run root resolves, so a closed experiment's dir is not
  even touched. This is the exact resume choke the evidence flagged.
- **`sealNativeReview(args.corpus.corpusId)`** — keys on the corpus id (stronger than `sealId`: a
  re-seal mints a new `sealId` but reuses the closed corpus id). Blocks re-sealing the archived
  Layer-N v2 corpus. Existing fixtures use `corpusId ∈ {c, seed-corpus-1, v1asv2}` → unaffected.
- **`runNativeReviewQualification(opts.corpus.corpusId)`** — the **Layer-N v2 LIVE entry**. The
  halted campaign's live driver `_owner-inputs/live-native-review-driver.mts` flows through
  NEITHER `runMigrationExperiment` NOR `sealNativeReview`, so this is the only `src/` choke on it.
  `corpusId === "s16-layer-n-native-review-v2"` is closed → the 171-call resume path HALTs.

The freeze is **exception-free**: there is no bypass flag. The one test that previously drove
the real runner over the closed corpus (`tests/native-review-runner.test.ts`) was updated to use a
non-closed smoke corpusId (`lnv2-runner-smoke`) rather than adding an escape hatch that a live
driver could accidentally set. `S16_LEGACY_CAMPAIGN_CLOSURE.json`'s `closedExperimentIds` mirrors
the in-code Set, and a Wave-C sync test makes editing the JSON alone unable to un-freeze anything.

The go-forward recovery id `s16-reviewer-recovery-v1` is deliberately absent from the Set, so
`assertNotClosed("s16-reviewer-recovery-v1")` does not throw.

---

## 6. R-2b — un-mechanizable residual (recorded honestly)

The claim above is scoped precisely: **the four gate-able `src/` chokes are mechanically frozen; one
resume surface is not.** The Stage-Q Layer-O live drivers
`_owner-inputs/{layer-o-qualification-runner,layer-o-v2-runner,stage-q-v3-runner}.mts` call
`spawnCodexAgent` from `src/orchestrator/codexAgent.js` **directly**, take their blind cases + gold as
freeform CLI args (no hardcoded corpus id), and are themselves immutable preserved evidence. There is
therefore **no gate-able `src/` chokepoint and no stable closed-id on that path**; gating the general
`spawnCodexAgent` primitive would break production. The `stage-q-layer-o-v1/v2/v3` entries in
`CLOSED_EXPERIMENT_IDS` are enforced at the `src/` chokes but **cannot** be enforced at these raw-spawn
drivers.

The controls that DO cover them: (i) the drivers are immutable preserved evidence; (ii) the recorded
owner directive 2026-07-11 "no further Stage-Q authorized"; (iii) a re-run cannot resume the sealed §16
diagnostic budget — it would only re-run an already-archived judge qualification, consuming calls
against no sealed ceiling. **Forward guidance: any FUTURE Stage-Q-style qualification MUST route through
a gate-able `src/` entry, never a raw-spawn `.mts`.** This is `R-2b` in `unresolvedRisks`.

---

## 7. Immutability guarantee

`preservedArtifactHashes` in the `.json` binds the raw-bytes sha256 of every anchored preserved
artifact — the two live sealed experiments (sealed/spec/manifest), the Stage-Q v2/v3 seals + gold
audits + schema manifest + v1 postmortem, the Layer-N v2 seal + instrument manifest + gold audit + the
three finding JSONs + the sol divergence packet + the final result, the Layer-N v1 disposition + its
corpus, the frozen thresholds + execution policy + call-ledger reconfirm, and the v3 qualification
result/addendum. The immutability test (`tests/legacy-campaign-closure.test.ts`, `xenv`-guarded)
recomputes each hash from disk and asserts equality. Several of these byte-hashes are self-validating
against the recorded seal metadata: e.g. `STAGE-Q-LAYER-N-V2-SEAL.json` = `3979b4bc…` matches the
recorded `sealFileSha256`; `STAGE-Q-V3-SEAL.json` = `ffba6d2c…` matches the bound Layer-O v3
prerequisite; `diagnostic`/`confirmatory` sealed.json = `e8e5d4bb…`/`45cf77c1…` match the postmortem's
referenced seal ids; `thresholds.owner-frozen.v1.json` = `6a90acea…` matches the shared thresholdsSha256.

(Scope note: the map anchors the authoritative durable artifacts — seals, ledgers, findings, sealed
experiments, corpora, instruments — not every per-item `evidence.json`/`phase*.txt` across the three
preserved run dirs. That curated anchor set is sufficient for the immutability test; the per-item
evidence remains on disk, immutable and unreferenced by any go-forward code.)

---

## 8. What was NOT produced

`authoringMigrationDecisionProduced: false`. No authoring-migration decision, no candidate/diagnostic
book generation, no confirmatory run, no production activation (IMP-13 dormant/UNAUTHORIZED). The
Layer-N v2 outcome is a reviewer-role qualification result only; **no gpt-5.6-sol authoring inference is
permitted from this campaign.** The 14 disputed sol source-register cases remain **UNADJUDICATED (owner
gate)** and are not used to seed any new gold. `canResume: false`.
