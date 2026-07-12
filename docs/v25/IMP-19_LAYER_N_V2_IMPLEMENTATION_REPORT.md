# IMP-19 — Layer-N v2 (Native Production-Reviewer Qualification): Implementation Report

**Date:** 2026-07-11 · **Branch:** `feat/v25-pipeline` · **Status:** IMPLEMENTATION COMPLETE — awaiting owner approval of the corpus/thresholds/seal before any live qualification run. **No live model calls occurred; no canonical state modified; Stage-Q v3 + Layer-N v1 byte-unchanged.**

## 0. Executive summary

Layer-N v1 was `INSTRUMENT_INVALID` (a full-chapter ship bar applied to 248–2,186-byte stub fixtures → FPR 1.0 + sensitivity ~0). IMP-19 rebuilds Layer-N as the **native, end-to-end qualification of the real production chapter-review lane** (A + a precise C): complete chapters, the real phase-1 render → isolated workspace → parse → adjudicate → phase-2 quiz adjudication path, **capability-specific scoring through each output's actual channel**, full semantic sealing, durable evidence, and drift-proof enforcement. Layer-O v3 keeps the targeted-semantic/security role.

**Owner mid-course correction (applied):** the clean-control bases must come from genuinely-approved books, not the *old gold corpus, which is corrupt*. Evidence confirmed it: my initial bases included **rich-dad-poor-dad (140-eval rank 138/140)**, **the-5-am-club (137/140)**, and **outliers (below the 80 bar)** — they passed the deterministic ship gate but are content-corrupt. Corrected source = **top-approved 140-evaluation books** (`book-packages/*.v21.json`, Content Design Score ≥ 87).

## 1. Files (all NEW — purely additive; zero production-code modification)

**Source (`src/bakeoff/migration/`):**
- `nativeReviewTypes.ts` — v2 schemas/types + evidence-boundary registry (`OUT_OF_BOUNDARY_TARGETS`, `LAYER_O_ONLY_CLASSES`) + per-kind detection channels.
- `nativeReviewQualification.ts` — canonical full-semantic corpus hash, instrument-manifest hash, deterministic admission (`admitChapter`), fail-closed `validateNativeReviewCorpusV2`, per-channel scorers, `qualifyNativeReviewJudge`.
- `nativeReviewRunner.ts` — `runNativeReviewQualification`: drives the real `reviewOneChapter` via migration-isolated `io`, `persist=requiresPhase2` (phase-2 on the quiz subset), raw-message capture, durable per-item evidence.
- `nativeReviewSeal.ts` — instrument-manifest builder, `sealNativeReview`, `assertNativeReviewQualified` (enforcement), `nativeReviewThresholdsSha256`.

**Tests (`tests/`):** `native-review-qualification.test.ts` (15), `native-review-runner.test.ts` (1 integration).

**Owner-input artifacts (`state/migration-experiments/_owner-inputs/`):**
- `stage-q/LAYER-N-V1-DISPOSITION.json` — v1 preserved as `INSTRUMENT_INVALID` / `judgeCapability NOT_ASSESSED`.
- `stage-q/layer-n-v2-corpus.json` — the 28-item corpus (full-semantic sha **`7fa5bb36…`**).
- `stage-q/STAGE-Q-LAYER-N-V2-GOLD-AUDIT.json` — two-verifier audit record.
- `stage-q/STAGE-Q-LAYER-N-V2-SEAL.json` + `…-INSTRUMENT-MANIFEST.json` — the pre-live seal.
- `native-review-thresholds.v2.json` — proposed thresholds (owner approval).
- `build-layer-n-v2-corpus.mts`, `seal-layer-n-v2-driver.mts` — no-model construction/seal drivers.

## 2. v1 preservation

v1 corpus (`a127d8ce…`), v3 result (`4d8f1c0e…`), v3 seal (`ffba6d2c…`), diagnostic manifest (`['seal']`) — all **byte-verified unchanged** after v2. Code guarantee: v2 uses distinct schema `migration-native-review-qualification-v2`; `assertNativeReviewQualified` rejects a v1 (`migration-judge-qualification-v1`) record. v1 scores are never reused.

## 3. Architecture (LN-01…LN-11 fixes)

- **LN-04 (wrong channel):** clean-pass via ship decision; hard-blocker via `mustFix`-in-target-unit + verified-quote/complaint evidence intersecting the mutation; **key-mismatch via `keyCheck.disagreements` + phase-2 `keyCorrect==='wrong'`**; ambiguity via phase-2 `keyCorrect==='ambiguous'`; craft via no-false-escalation; **never a universal complaint anchor**.
- **LN-05 (phase-2 skipped):** runner runs the real phase-2 on the quiz subset via a migration-isolated `io` (never canonical `state/reviews`).
- **LN-06 (invalid injection metric):** security kept ADVISORY-only and behavioral (protocol + token-placement), independent of ship; blocking security stays in Layer-O v3 (LN-08 — `ChapterReviewV1` has no behavioral security field).
- **LN-07 (weak hash):** `nativeReviewCorpusSha256` covers every semantic field; sealed + enforced.
- **LN-08 (weak binding):** `nativeReviewInstrumentManifestSha256` binds rubric/renderer/bar/task/parser/phase-2/output-contract/workspace/profile/route/scorer/thresholds; drift stales the qualification.
- **LN-10 (single-seed):** validator enforces per-capability minimum counts; non-pooled conjunction.
- **LN-11 (evidence):** immutable per-item `evidence.json` (hashes, parsed review, phase-2, matcher decision, raw message) under the experiment root.

## 4. Corpus — 28 items, sha `7fa5bb3698e0df7b0a4edc3675eb2b372f4ed032c0a10d6adfe973d33056bd8d`

| kind | n | source / mutation |
|---|---|---|
| clean-pass | 8 | top-approved bases, normalized, ship-clean |
| reader-visible-hard-blocker | 8 | internal contradiction appended to an example (cat 4) |
| quiz-key-mismatch | 4 | `correctIndex` flip (deterministic keyCheck/phase-2) |
| quiz-ambiguity | 4 | one distractor → a second co-correct choice |
| craft-nonblocker | 4 | bland generic-phrasing append (mild, non-blocking) |

**Clean bases (6 top books, ≥87):** the-willpower-instinct (ch1,ch2), the-power-of-moments (ch1,ch2), peak (ch1), decisive (ch1), difficult-conversations (ch1), the-checklist-manifesto (ch1). All ship-clean + complete after normalization; rendered 14,371–17,264 B.

**Normalization (deterministic, reader-faithful):** the book-packages are an older schema missing non-reader-facing metadata (`examples.planSpec`, `quiz.depthLevel`, `implementationPlan.title`, `memorableLines.location/why`). The normalizer fills them; the **only reader-facing effect** is fixing `implementationPlan.title` (which otherwise renders literally "Title: undefined") with a faithful short title from the existing `coreSkill`. Proven: the rendered reader doc changes by **exactly one line**. Every variant carries a base→variant mutation manifest (base/variant content hashes, changed-path allowlist, protected-region hashes) enforced by the validator.

## 5. Gold audit (IMP-19 §4)

Two **independent** verifiers (Claude subagents, NOT the codex panel; zero live calls): Verifier A adversarial (disprove), Verifier B definitional (apply reserved categories). **Result: 20/20 both.** Four adversarial "closest calls" reconciled: `ambiguity-peak-ch1` was **tightened** (borderline metronome-vs-recording feedback → same recording feedback + a distinct valid correction) so all 4 ambiguity items are unambiguously co-correct; the other three flags were author-verified solid. Record: `STAGE-Q-LAYER-N-V2-GOLD-AUDIT.json`.

## 6. Instrument manifest + seal

`STAGE-Q-LAYER-N-V2-SEAL.json`: corpus `7fa5bb36…`, instrument-manifest `9b3c888a…`, thresholds `d9625446…`, schedule `99b367e4…`, panel = gpt-5.5@high, gpt-5.6-sol@high, gpt-5.5@xhigh. `assertNativeReviewQualified` fails closed on missing / not-qualified / dry-run(no-independent-human) / v1-record / corpus-drift / instrument-drift / threshold-drift / profile-mismatch.

## 7. Proposed thresholds (owner approval required)

`native-review-thresholds.v2.json`: protocol 1.0, hard-blocker sensitivity 1.0, key-mismatch 1.0, quote-evidence ≥0.95, clean-pass ≥0.75, observable-defect ≥0.85, ambiguity ≥0.85, non-blocker-calibration ≥0.85, unresolved-required 0, injection-takeovers 0 (advisory). Development qualification gates, not population psychometrics. Not weakened.

## 8. Schedule + call envelope

Serial; each of 3 judges over 28 items in item order (`schedule` sha `99b367e4…`). **Expected 108 live reads** (84 phase-1 + 24 phase-2 on the 8 quiz items × 3) / **sealed max 216** (≤2 attempts). Campaign ledger reference: 640 already consumed (Stage-Q). **No Layer-N v2 live call is authorized in this package.**

## 9. Diagnostic/confirmatory RESEAL PLAN (prepared, NOT executed)

The existing diagnostic (`diagnostic-stack-2026-07`) + confirmatory seals do **not** bind a Layer-N qualification. After owner approval of the v2 corpus + thresholds + seal:
1. Retain the current diagnostic/confirmatory seals as **superseded evidence** (do not edit in place).
2. Add the Layer-N v2 seal hash (corpus+instrument+thresholds) as a bound field to freshly-resealed diagnostic/confirmatory manifests (new seal, superseding the old).
3. Candidate review calls `assertNativeReviewQualified(seal, …)` before any generation — a missing/stale/drifted v2 qualification fails closed.
4. Recompute the call ceiling to include Layer-N v2 (≤216) alongside the 640 consumed; the live sequence stays: native Layer-N v2 qualify → diagnostic generate/review/analyze → C3 pause.
This reseal is deferred to a separate, owner-authorized step (no seal is minted or consumed here).

## 10. Tests + verification

- **Layer-N v2 suite: 16/16 pass** (`tsx tests/run.ts native-review`). Covers: full-semantic hash sensitivity; corpus admission incl. the **v1 stub-corpus regression** (rejected pre-spawn) + wrong-schema + undeclared-path + min-count; per-channel scoring (clean/hard-blocker w/ top-level-quote evidence + unrelated-complaint-negative/key-mismatch/ambiguity/craft); non-pooled conjunction; **enforcement fail-closed on every drift/v1-record/profile**; seal determinism; and the **integration test** — the real `reviewOneChapter` path via a fake **spawn** (canned model output, not a fake reviewFn), scored through the real instrument, evidence written only under the experiment root.
- **typecheck: clean (exit 0).** **Full repo suite: see §11.**
- **No live model call:** every Layer-N v2 exercise used a fake spawn or pure functions; no `codex exec`; runners refuse forbidden provider env; the live runner was never invoked.
- **No canonical write:** all runner/io writes route through `rootedWrite`/`rootedPath` (refuse outside the experiment root and inside any canonical tree); the integration test asserts evidence lands under the experiment root and the reviewer cwd is non-canonical.
- **Stage-Q v3 + v1 byte-unchanged** (hashes in §2).

## 11. Full-suite result

**Full repo suite: 2372 pass / 0 fail** (xenv 6 env-absent, skip 18); typecheck clean. One failure surfaced and was fixed during verification: a **doc-comment** in `nativeReviewRunner.ts` literally contained `state/chapters`, which the migration static-guard test (`migration-guards.test.ts` — greps every migration source for canonical-tree path literals) flags. Rephrasing the comment (no code/behavior change) cleared it; targeted `migration-guards` + `native-review` re-run = 22/0. Command: `npx tsx tests/run.ts`.

## 12. Risks, limitations, and OPEN OWNER DECISIONS

1. **Security → Layer-O (composition change):** `ChapterReviewV1` has no behavioral security field, so v2 omits blocking security cases and keeps injection ADVISORY (LN-08). Composition is 28 (8/8/4/4/4), not the 32 with 4 security variants. **Decision:** accept security-in-Layer-O, or ask for a behavioral-security derivation + raw-message capture to promote it.
2. **Ambiguity/craft are inherently soft** (0.85 thresholds); the one borderline ambiguity item was tightened, but these capabilities carry more judgment than hard-blocker/key-mismatch (1.0).
3. **Normalization** modifies the approved book-packages' schema metadata (reader-faithful, 1-line title fix). **Decision:** confirm normalization is acceptable vs. sourcing a current-schema version of these books. *(Owner already approved "Normalize metadata".)*
4. **`independentHumanRater: false`** — the corpus is owner-approved development fixtures, adversarially gold-audited by two Claude verifiers, not independently human-labeled. A publication-grade claim would require independent human rating; enforcement flags this via `dryRunOnly`.
5. **Detection is not live-verified** — gold is "what a correct reviewer should produce," audited definitionally; the live qualification run validates it.

## 13. The gate

**No live Layer-N v2 qualification call is authorized on implementation authority.** This package delivers the instrument, corpus, thresholds, seal, and tests for owner review. On approval: run the sealed v2 qualification (≤216 live reads, ChatGPT-subscription route only), then the reseal + the frozen diagnostic sequence.
