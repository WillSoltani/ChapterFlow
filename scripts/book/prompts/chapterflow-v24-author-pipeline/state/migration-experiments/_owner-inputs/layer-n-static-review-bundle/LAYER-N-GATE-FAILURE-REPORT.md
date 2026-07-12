# Layer-N Qualification — Gate-Failure Report

**Date:** 2026-07-11 · **HEAD:** `23c4ede4efe88722a658130ad536a2fcf34ef51d` · **Experiment:** `diagnostic-stack-2026-07`
**Result:** `LAYER_N_INSTRUMENT_INVALID_PENDING_STATIC_REVIEW` — **NOT a judge-capability verdict.**

> This report is read-only evidence for the owner-directed offline static review. No remedy is proposed
> here, and no further live model calls are authorized until that review resolves Layer-N's intended purpose.

## 1. What happened

The native Layer-N judge-qualification gate (`runJudgeQualification` → `scoreJudgeQualification`,
`src/bakeoff/migration/qualification.ts`) was run live via the sealed conductor (`live-conductor-driver.mts qualify`)
on the owner-approved 43-item corpus. Execution was serial, ChatGPT-subscription route only; the route invariant held
on every call (verified on-wire from per-spawn `.route.json`: `codex_exec_chatgpt_subscription` / `chatgpt` /
`apiKeyPresent:false` / `apiFallbackAllowed:false`). No API/fallback path was reachable; no capacity events; no errors.

100 of 129 reads completed before the owner directed a stop. Two judges finished; one is partial:

| judge | items read | status | qualified |
|---|---|---|---|
| gpt-5.5@high | 43/43 | complete | **NO** |
| gpt-5.6-sol@high | 43/43 | complete | **NO** |
| gpt-5.5@xhigh | 14/43 | partial (stopped) | — (same trajectory) |

Diagnostic generation was **never entered** — the gate halts before candidate work when any judge is unqualified.

## 2. Failure signature (identical across judges)

| metric | gpt-5.5@high | gpt-5.6-sol@high | threshold | verdict |
|---|---|---|---|---|
| falsePositiveRate | **1.000** | **1.000** | ≤ 0.34 | FAIL — every clean control flagged |
| perClass sensitivity | 0.000 on 6/8 | 0.000–0.625 | ≥ 0.70 | FAIL — no class meets the bar |
| evidenceQuoteValidity | 1.000 | 0.842 | ≥ 0.80 | ok |
| schemaValidity | 1.000 | 1.000 | ≥ 0.90 | ok |
| injectionResistance | 1.000 | 1.000 | ≥ 1.00 | ok |

**Flag-everything (FPR 1.0) + detect-nothing-by-anchor (sensitivity ≈ 0)** is the fingerprint of an
instrument/corpus problem, not a capability gap. A genuine capability failure looks the opposite way — low
sensitivity **with low** FPR (misses defects *and* does not over-flag). Corroboration: these same three judge
configurations **passed the harder, adversarially-audited Layer-O (Stage-Q v3)** instrument.

## 3. Root cause (mechanism, code-level)

1. The real phase-1 reader-review instrument ships a chapter only at **composite ≥ `AUTHOR_CHAPTER_BAR = 80`**
   (`src/review/readerReview.ts:136`). `review.pass` is that ship decision.
2. The 43 Layer-N fixtures render to **248–2,186 bytes (median 801)** — thin stubs, not full chapters. A real
   reader-quality review scores them **12–48/100**, all far below 80 ⇒ `review.pass = false` on **every** item
   (clean controls included; clean-control composites observed 1.5–47.9).
3. `scoreJudgeQualification` counts a clean control as a false positive when `valid && !pass`. With `pass=false`
   on all 9 clean controls ⇒ **falsePositiveRate = 9/9 = 1.000**, purely on shippable-quality grounds.
4. Defect detection requires a complaint to **anchor-match** the planted `mustQuote` quote (`anchorMatched`).
   Real complaints are about the chapter being an underdeveloped stub, not the planted defect, so `anchorMatched`
   is false ⇒ **detected ≈ 0** ⇒ sensitivity ≈ 0.
5. `validateQualCorpus` checks only **structural** properties (anchors are byte-substrings of the rendered doc,
   all 8 classes present, ≥2 clean controls). It **never verifies that clean controls actually pass** the real
   instrument — so the corpus is structurally valid but **semantically un-passable by any real judge**.

Net: as constructed, Layer-N cannot be passed by any judge that applies the real reader-quality bar, because the
corpus is sub-bar by construction and the pass-bar doubles as the flag signal.

## 4. The question the static review must answer

The failure sits exactly on an unresolved design question: **what is Layer-N intended to qualify?**

- **A — full shippable-chapter review.** Then the fixtures must be ~80+ quality chapters that *carry* planted
  defects, so a clean control genuinely passes and a defective one genuinely fails on the defect.
- **B — targeted defect detection.** Then the gate must **not** use the ship/pass bar (composite ≥ 80) as the
  flag/detection signal; detection must be scored independently of overall chapter quality.
- **C — a capability distinct from Layer-O.** Then that capability must be defined and the instrument built to it
  (Layer-O already covers structured candidate-content / review-finding / security / injection judging).

Deciding A vs B vs C determines whether the fix is the corpus, the scorer, or the gate's very purpose — which is
why no remedy is proposed here.

## 5. Preserved / not modified

**Preserved (in place):** all 100 completed/partial reads; per-spawn route sidecars + manifest/result records
under `logs/exec/` (token-free, verified); both completed `*.qualification.json` + the partial third judge's
per-item artifacts; the sealed schedule/spec/thresholds/manifest; the driver log.

**Not modified (per owner directive):** the Layer-N corpus, thresholds, scoring, anchor matching, reader-review
prompts, gate logic, experiment seals.

**Known preservation limit:** qualification reads run with `persist=false`, and `logs/exec/*.result.json` store
only *hashes* of stdout/final-message (not the raw review text). The judges' raw complaint text was therefore not
written to disk; re-deriving it would require live calls, which are **not authorized**. The aggregated scores
(`*.qualification.json`), rendered docs the judges read (`fixtures/rendered/*.phase1.txt`), and per-item
composites/verdicts (driver log) are fully preserved and are sufficient to assess the instrument statically.

## 6. Ledger

540 consumed before Layer-N + 100 Layer-N (partial) = **640 of the sealed 2,096** ceiling (a hard maximum, not a
target). No further live calls until the static review completes.
