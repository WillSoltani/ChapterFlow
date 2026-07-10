# Book-acceptance gate — policy of record

**Status:** current predicate is DOCUMENTED and TESTED (F-05, 2026-07-08). The two
open questions below **await owner sign-off — neither is implemented.**

This page exists because three sessions of anti-sameness campaign work were run and
reported against a *wrong model* of this gate ("the panel keeps rejecting it as churn
HIGH"). The gate does not work that way. What follows is the verified behavior, then
the decisions that are genuinely open.

---

## The predicate (verbatim, verified)

A book is **accepted** iff **all** of these hold
(`orchestrator/authorReview.ts` `runBookAcceptance`, pinned by
`tests/author-arch.test.ts` → "F-05 predicate: …"):

```
accepted =
      quorumMet                                     // ≥ AUTHOR_BOOK_READERS (3) valid readers
  ∧   gatePooled === "PASS"                          // correctness gate, STICKY-FAIL per docSha
  ∧   pooledMedian ≥ AUTHOR_BOOK_ACCEPT_FLOOR         // floor = 74
  ∧   ( shipped === null                             // no shipped control → floor-only
        ∨ pooledMedian ≥ shipped + BEAT_SHIPPED_MARGIN ) // margin = +5, regens only
```

- **`pooledMedian`** is the TRUE median of every quorum-met same-`docSha` panel read
  (append-only; up to `PANEL_READS_PER_DOC_CAP` = 3; then the decision FREEZES).
- **Sticky gate:** a correctness-gate `FAIL` on *any* pooled read sticks for those bytes
  and is never outvoted.
- **`shipped`** is the beat-shipped control composite (the same 3-reader instrument run
  over the committed bytes of the already-published package). It exists only for
  **regens of published books**. A first-time book has `shipped === null`.

### What does NOT gate

- **Churn is telemetry.** The holistic `book3_churn` label (`LOW`/`MEDIUM`/`HIGH`) is
  **never** an accept-time veto. A book that is unanimous churn-`HIGH` on all reads is
  ACCEPTED if the four clauses above hold. Churn only selects the *repair route* **after**
  a rejection. This was a deliberate **2026-07-04 calibration**
  (`PUBLISH-CALIBRATION-PLAN-2026-07-04.md`), not an accident. Pinned by
  `tests/author-arch.test.ts` → "churn HIGH … is ACCEPTED".
- **`AUTHOR_BOOK_PREMIUM_TARGET` (80) is not a gate.** It is stamped into the acceptance
  record's `bar` field and logged as a *premium telemetry target* only. It was renamed
  from the gate-sounding `AUTHOR_BOOK_ACCEPT_BAR` on 2026-07-08 precisely because the old
  name implied it blocked. Nothing reads it to decide acceptance.

### Quorum guard on the shipped control (2026-07-08)

`composeBookVerdict` breaks a gate tie toward PASS (`npass >= nfail`). Acceptance is
shielded from this by the ≥3 valid-reader quorum. The **shipped-control** read was not:
a degraded 1–2-valid-reader panel could set the `shipped` baseline the +5 margin is
measured against. As of F-05, `resolveBeatShippedBar` requires the **same ≥3 quorum**;
a partial-panel control read (fresh or cached) degrades to **floor-only** (`shipped =
null`) with a loud log, and a total-panel failure (0 valid) still **FAILs CLOSED**
(halts the run). This *strengthens* the gate and fabricates no control where none exists.
Pinned by `tests/sweep-rejected-and-control-e5.test.ts` → "control-read (F-05): …".

---

## Open owner decisions (NOT implemented — awaiting sign-off)

### (a) Should churn ever veto acceptance?

Today: never. Proposal on the table: promote a **narrow** churn veto — e.g. reject only
on **unanimous `HIGH` across a full 3-valid-reader pool**.

| Option | Effect | Cost / risk |
| --- | --- | --- |
| **Keep (status quo)** | Churn stays telemetry + repair routing. | Numbers-clear-but-samey books can ship; exactly the failure the campaigns fought. |
| **Narrow veto** (unanimous HIGH, full pool) | A whole-book "monoculture" signal can block. | **Flap risk:** churn is a holistic, noisy label on a **4-chapter sample** (`evalBookProxy.ts:73`), salted round-to-round. Two reads on identical bytes can disagree on HIGH/MEDIUM, so a veto could flip a book accept↔reject across re-entries. Mitigation would need: unanimity **and** the sticky/frozen-pool discipline the composite already uses (never re-roll after the cap), or the veto reintroduces the ±noise casino churn was removed from in the first place. |
| **Broad veto** (any HIGH) | Strong anti-sameness pressure. | High false-reject rate on noise; not recommended without the sampling first becoming whole-book. |

**Flap-risk note.** Churn is sampled, not whole-book; a ≤3-chapter repair can flip the
sampled label without fixing the book (F-05 fact 5). Any veto must therefore be defined
on the **frozen pooled** churn (post-cap), not a single read, or it will oscillate.

**Recommendation:** if adopted, the *narrow* option, gated on the frozen pool only, with
a test mirroring the composite's sticky/freeze semantics. Do not adopt until the sampling
question is understood — a whole-book churn measure would be the cleaner foundation.

### (b) Should fresh books (no shipped control) face more than the 74 floor?

Today: a first-time book needs only `pooledMedian ≥ 74` (below the demonstrated good-book
noise floor — a 9×85–89 board read 75.0–78.7 on identical bytes,
`authorReview.ts` calibration comment). The +5 margin applies **only** to regens.

| Option | Effect | Cost / risk |
| --- | --- | --- |
| **Keep (74 floor)** | Fresh books ship at median 74. | The *next* new book can ship at 74 with unanimous churn-HIGH — under-strict relative to the quality bar the campaigns targeted. |
| **Raise to the premium target (80)** | Fresh books held to the same ~owner-84/85 bar as the telemetry target. | **More first-book rejections** and repair rounds; 80 is above every real book's measured composite on this harsh instrument (no real book has scored ≥84), so an 80 hard floor may be unreachable in one pass and burn tokens on regen churn. |
| **Intermediate floor** (e.g. 76–77) | Above the noise floor, below the aspirational target. | Needs its own calibration read to justify the exact value; picking a number without data repeats the original mistake. |

**Recommendation:** do not raise blindly. If the owner wants a higher fresh-book bar,
choose the value from a calibration read (as 74 and 80 were), not by fiat, and expect
more first-pass regens.

---

## Constants (single source of truth)

| Constant | Value | Role |
| --- | --- | --- |
| `AUTHOR_BOOK_ACCEPT_FLOOR` | 74 | Hard accept floor (all books). |
| `BEAT_SHIPPED_MARGIN` | 5 | Regen must beat its shipped control by this. |
| `AUTHOR_BOOK_READERS` | 3 | Valid-reader quorum (acceptance **and** shipped control). |
| `PANEL_READS_PER_DOC_CAP` | 3 | Max pooled reads per docSha; then FROZEN. |
| `AUTHOR_BOOK_PREMIUM_TARGET` | 80 | **Telemetry only** — NOT a gate (renamed from `…_ACCEPT_BAR`). |

None of these values were changed by F-05. Changing any threshold, or implementing either
open question, requires an owner-decision note in this file.
