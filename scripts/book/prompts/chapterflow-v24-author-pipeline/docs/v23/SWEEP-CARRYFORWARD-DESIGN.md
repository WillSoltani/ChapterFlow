# Sweep carry-forward at the chapter grain (P09, F2)

## Problem

The book-wide sweep is the noisiest QC reviewer: a fresh whole-book read flags a
rotating subset of chapters round to round on byte-identical content. Today the
sweep's **convergence unit is the whole book**:

- `sweepTwoRoundConfirmed` (auto-publish gate) requires **≥2 independent zero-finding
  reads over the ENTIRE current book** (`sweepReadOverCurrent` demands the whole
  chapter set + every hash match).
- Any repair to any chapter changes that chapter's hash → *every* prior clear read is
  no longer "over the current bytes" → the whole book's clear-read progress is thrown
  away and both confirming reads must be re-earned from scratch.

Consequence: a single-chapter repair resets the entire book's convergence. POM's
18-round history was substantially confirmation-read churn — clean chapters being
re-cleared over and over because a sibling moved.

Templating is a **cross-chapter** property, so a read must still SEE the whole book.
What we change is only **which chapters need fresh CLEARS** after a repair.

## The per-chapter clear ledger

New materialized artifact `state/qc/<bookId>.sweep-chapter-clears.json`:

```jsonc
{
  "schemaVersion": "sweep-chapter-clears-v1",
  "bookId": "...",
  "updatedAt": "<iso>",
  "clears": [
    { "chapterNumber": 1, "chapterId": "...-ch01", "contentHash": "...",
      "roundId": "r...", "reviewerSessionId": "session-...",
      "families": ["scene_skeleton","persona_drift","repeated_unit","location_stamping"],
      "clearedAt": "<iso>" }
  ]
}
```

**Source of truth stays the immutable per-round sweep records** under
`state/qc-orchestrator/<book>/<round>/sweep-record.json`. The ledger is a rebuildable
cache derived from `loadSweepHistory` — like `<book>.sweep-history.jsonl`, it may be
deleted without losing evidence and is re-materialized on the next attestation. The
evaluation functions **derive from history**, never trusting possibly-stale ledger
bytes; the file's on-disk role is (1) the feature-enable flag (its *existence*), (2) an
auditable snapshot, (3) the per-chapter staleness input for the publish gate.

### Rules

A history record **grants clears** iff it is a genuine independent read — NOT a
carry-forward byte copy (`sweepReadIdentity` non-null / has a `reviewerSessionId`),
NOT `CORRUPTION`, and it checked **all 4 required families**. Such a read examined the
whole book; every chapter it did not gate was looked at and found clean.

- **(a)** A whole-book read with **zero** blocking findings grants a clear entry to
  **every** chapter at its current hash.
- **(b)** A read whose blocking (raw, `sweepFindingBlocks`) findings name chapters
  X,Y grants clears to **all OTHER** chapters (examined and found clean). X,Y get no
  clear from that read.
- **(c)** A chapter's clears are invalidated by a **content-hash change** (a clear is
  keyed to `contentHash`; a new hash simply has no matching entries) and by any later
  **corroborated** blocking finding naming it (see below).
- **(d) Publish condition per chapter:** ≥2 clear entries at the chapter's **CURRENT**
  hash from **DIFFERENT `reviewerSessionId`s** (two independent reads), AND no sweep
  read over the chapter's current bytes carries a **corroborated** gate naming it.
- **(e) Book publish condition:** every chapter satisfies (d). This subsumes "the most
  recent whole-book read has no corroborated blocking findings" — the latest read is
  itself one of the reads over each chapter's current bytes, so any corroborated gate it
  raises disqualifies that chapter under (d).

"Corroborated" reuses the exact cross-round mechanism the round verdict uses
(`effectiveSweepFindings` → `gateSurvivesCorroboration`): a lone uncorroborated
stochastic flip on frozen content is demoted (noise, does not disqualify); a gate two
independent reads agree on over the same bytes blocks. `CORRUPTION` is never demoted.

This **preserves the two-independent-reads guarantee per chapter** while letting
untouched chapters keep their earned clears across a sibling's repair.

## Why untouched chapters keep progress

After repairing ch3: ch1/ch2 hashes are unchanged, so the pre-repair reads that cleared
them still match at the current hash and still count. A read that gated ch7 in an
earlier round still cleared ch1..ch6,ch8.. — so clean chapters accumulate independent
clears even when *every* whole-book read flagged *something different* (the exact case
the whole-book gate could never converge, because no single read was clear everywhere).

Reads stay whole-book (sweep packs unchanged; P08 froze them). Only the accounting
changes.

## Back-compat (keyed on ledger existence)

- No ledger file (books whose sweep history predates P09) → `sweepTwoRoundConfirmed`
  and the `QC3.sweep_stale` check fall through to the **unchanged whole-book logic** —
  they evaluate exactly as today.
- The first new-style attestation (`writeSweepRecordFromSubmission` /
  `writeSweepAttestation` / `carryForwardSweep`, all via `appendSweepHistory`) writes
  the ledger; from then on the book evaluates per-chapter. The ledger is built from the
  full existing history, so the transition backfills prior real reads.
- The whole-book carry-forward fast path (`sweepCarryable` + `carryForwardSweep`) is
  untouched — identical set + all hashes still valid remains the cheap "nothing moved"
  case, orthogonal to the ledger.

## Consumers

| Call site | Uses | Change |
|---|---|---|
| `autopilot.ts:533` `defaultSweepConfirmed` | `sweepTwoRoundConfirmed` | behavior via rewrite; signature unchanged |
| `autopilot.ts` (2006/2060/2082) | `deps.sweepConfirmed` boolean | none |
| `orchestrator/index.ts:296` | `sweepCarryable` + `carryForwardSweep` | none (whole-book fast path kept) |
| `orchestrator/index.ts:505` `sweepBlocksConfirm` | `sweepChapterStatus` | none (already per-chapter) |
| `orchestrator/finalize.ts:428` | `sweepChapterStatus` | none (already per-chapter, round-scoped) |
| `publishAfterQc.ts:426`, `promoteBook.ts:596`, `cli.ts:4195` | `checkSweep` | `QC3.sweep_stale` made per-chapter (ledger-aware, fail-closed) |

**Deviation note:** `QC3.sweep_stale` lives in `checkSweep` (`src/qc/sweep.ts`), not in
`finalize.ts`. `finalize.ts`'s own per-chapter sweep status already comes from
`sweepChapterStatus` (per-chapter, scoped to the round's record), so no change is needed
there. The staleness change is applied where the check actually is.
