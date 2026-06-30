# Sweep defect fingerprints — v2 (per-chapter)

Source of truth: [`src/qc/sweep.ts`](../src/qc/sweep.ts) · tests: [`tests/sweep-defect-fingerprint.test.ts`](../tests/sweep-defect-fingerprint.test.ts)

## Why this exists

The cross-chapter sweep is the noisiest, most stochastic QC reviewer: a fresh whole-book read
flags a rotating subset of chapters round to round on byte-identical content. To stop one lucky
read from demoting (or one unlucky read from inventing) a gate, a chapter that a current round
gates over **byte-frozen** content only stays gated when an **independent prior read named the same
defect** — *cross-round corroboration* (`gateSurvivesCorroboration` → `effectiveSweepFindings`).

That corroboration is only as good as the **defect identity** it compares.

### The v1 problem

`sweepDefectKey` (v1, `sweep-defect-v1:`) bound the **whole finding** into one indivisible hash:

```
bookId + family + unitId + quote + problem (free-form prose) + the ENTIRE chapter array + a
per-chapter content map over that whole array
```

This correctly stopped *unrelated* findings from corroborating, but it also stopped **two honest
reviewers from corroborating the same real defect** whenever they:

- **worded the `problem` prose differently** (it is free-form — reviewers never phrase it the same), or
- **named overlapping but not identical chapter sets** (e.g. `[1,2,3]` vs `[2,3,4]`), because the
  whole sorted array + its content map were part of the key.

When corroboration failed on a *real* defect over frozen bytes, the round verdict treated the gate
as an uncorroborated stochastic flip and **demoted it to PASS — shipping the defect.**

## The v2 design

`sweepDefectFingerprintV2` computes identity **one affected chapter at a time** and binds only what
makes two reads "the same defect on the same bytes":

| Field | Why it is in the identity |
|---|---|
| `bookId` | Scopes the fingerprint to one book — no cross-book collisions. |
| `family` | The defect **class** (`scene_skeleton` / `persona_drift` / `repeated_unit` / `location_stamping`). A different class on the same chapter is a different defect. **Safety floor:** unrelated same-chapter findings cannot merge. |
| `unitId` | The field/unit the defect lives in (e.g. `tryThisNow.timer-anchor`). Two distinct units on one chapter are two distinct defects. |
| `quote` (signature) | The distinctive grounded cite, run through `normalizeQuoteSignature`. The **same** cite matches across reads; a **materially different** cite stays distinct. |
| `chapter` | The single affected chapter — the **unit of corroboration**. We corroborate per shared chapter, not over identical full membership. |
| `contentHash` | The bytes of **that chapter as this sweep read them**. A defect on changed bytes is a fresh first-read gate (different hash → different fingerprint → a prior read over the old bytes cannot corroborate it → the gate stands on one read). |

### Excluded on purpose

- **`problem` / `expectedFix`** — free-form reviewer prose. Two reviewers describe one defect
  differently; folding the prose into identity is exactly what blocked honest corroboration.
- **The other chapters in the finding's array** — membership is per-chapter here, so chapter sets
  `[1,2,3]` and `[2,3,4]` corroborate on the chapters they **share** (2 and 3) and nowhere else.

### Quote normalization (`normalizeQuoteSignature`)

Normalizes **style, not meaning** so the same cite matches while materially different cites stay
distinct:

- Unicode form (NFKC), case (lowercase), whitespace runs (collapsed to one space).
- Curly/smart quotation marks folded to straight; Unicode dash/hyphen/minus variants folded to ASCII
  `-`; the ellipsis character folded to `...`.
- Only the punctuation that **brackets** a quote (leading/trailing quotes, sentence punctuation,
  brackets, ellipsis, dashes) is stripped — punctuation that does not change the quoted words.
- **Internal word content is preserved verbatim**, so `the corner office` and `the corner desk`
  never collapse.

Non-distinctive generic phrases (a tense auxiliary like `had already`) are filtered **before**
corroboration by `sweepFindingBlocks` / `nondistinctiveRepetitionQuote`, so they never become a
corroborating identity in the first place.

## Safety properties preserved

- **Independence is still required.** Corroboration only counts an *independent* prior read —
  distinct round id, distinct `reviewerSessionId`, neither a carry-forward copy
  (`independentSweepReads`). Two records from one session (even relabelled) cannot self-confirm.
- **CORRUPTION blocks immediately.** A CORRUPTION verdict is never demoted by corroboration.
- **Changed bytes → fresh first-read gate.** A gate over content that moved since the prior round
  stands on a single read (the `frozenSincePrior` short-circuit *and* the content-hash component of
  the fingerprint both enforce this).
- **No unrelated same-chapter merge.** `family` + `unitId` + `quote` all bind, so two different
  defects on one chapter never corroborate.

## v1 history compatibility

- **Existing v1 keys keep validating.** `sweepDefectKey` / `normalizeDefectComponent` / `hashKey`
  are frozen byte-for-byte; a stored `defectKey` on a legacy record still re-derives and validates.
- **v2 is derived when enough fields are available.** `normalizeSweepRecord` derives the per-chapter
  fingerprints from the finding's `family` / `unitId` / `quote` and the record's `contentHashes`; a
  chapter with no content hash is skipped.
- **Immutable history is never rewritten in place.** Legacy per-round `sweep-record.json` files are
  read and have v2 derived **in memory only** — the on-disk bytes are untouched. Only the
  non-authoritative, rebuildable cache (`*.sweep-history.jsonl` / latest `*.sweep.json`) carries the
  derived fields.
- **New records store the version.** `fingerprintVersion: "sweep-defect-v2"` is written on the
  record and `defectFingerprints` (per named chapter) on each finding. A stored fingerprint that
  does not match its re-derivation is rejected at read — the same tamper-evidence contract as
  `defectKey`.

## One effective evaluator

Corroboration lives in `gateSurvivesCorroboration`, called only from `effectiveSweepFindings`. Every
downstream consumer routes through it, so they cannot drift:

- **per-chapter sweep status** — `sweepChapterStatus`
- **publish preflight** — `checkSweep`
- **two-round confirmation** — `sweepTwoRoundConfirmed`
- **finalizer** — calls `sweepChapterStatus` per chapter
- **repair-ledger generation** — mirrors the gate via the shared `sweepFindingBlocks` predicate
  (non-distinctive / advisory findings are non-gating everywhere, so they are never dispatched for
  repair)
