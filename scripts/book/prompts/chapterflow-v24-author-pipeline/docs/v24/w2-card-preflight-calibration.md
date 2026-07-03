# W2 card-preflight calibration (plan §WS5)

This documents the calibration of the three deterministic per-chapter card-quality
gates added in `src/metrics/cardQualityGates.ts` and wired into the author
preflight through `src/metrics/bookRubricMetrics.ts`. The pinned, reproducible
harness is `tests/card-quality-calibration.test.ts` (run:
`CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx tests/run.ts card-quality-calibration`).

Corpus:
- **Top-5 owner-scored books** (calibration "must pass"), ids + composites from
  `docs/book-score/baseline-2026-06-30.json`: atomic-habits 85.3,
  crucial-conversations 85.3, games-people-play 85.3, thinking-in-bets 85.2,
  the-happiness-hypothesis 84.9.
- **the-power-of-moments v24** (published, `book-packages/the-power-of-moments.v21.json`,
  createdAt 2026-07-03) — the regression control (composite 74.7 at publish).

The gates are shape-agnostic: the harness runs them over the SLIM package shape
(`book-packages/*.v21.json`), which is the same chapter shape the author produces
loose in `state/chapters/` at write time.

---

## (a) ECHO-TELL — shipped ADVISORY (warn), not blocking. DEVIATION.

**Rule:** flag a question when the KEY shares a ≥5-contiguous-content-token
(stopword-filtered) verbatim n-gram with the chapter prose (surface includes
`reviewCards` + `implementationPlan` + hook/counterintuition/tryThisNow/
keyTakeaway/breakdown/examples/memorableLines; quiz excluded) while ALL
distractors are <4.

**Measured (this harness):** on POM v24 the gate flags EXACTLY the 4 forensically
verified sentence lifts — ch4 q05 (n=6, review-card back), ch5 q09 (n=5,
breakdown.fullRead), ch9 q02 (n=5, example scenario), ch10 q06 (n=7, example
whatToDo). This reproduces the forensics (scratchpad/aplus/content-residuals.md).

**Why it ships advisory, not blocking (the deviation):** the forensics claim of
"near-zero FP" was measured ONLY on POM. Running the SAME ≥5/distractor-<4 rule
over the top-5 shows ≥5-token key echoes are a NORMAL feature of the highest-scored
owner books, from the SAME field types and at the SAME coverage as POM's flagged 4:

| book | composite | echo flags (key ≥5 & all distractors <4) |
|---|---|---|
| atomic-habits | 85.3 | **4** (ch2 q03 n=7 ip.plan, ch2 q05 n=5 ip.plan, ch3 q08 n=5 fullRead, ch9 q03 n=6 card) |
| games-people-play | 85.3 | **4** (incl. ch6 q06 coverage=1.00) |
| the-happiness-hypothesis | 84.9 | **5** (incl. ch2 q03 n=8 card coverage=1.00, ch6 q09 n=6 coverage=1.00, ch7 q02 n=10) |
| thinking-in-bets | 85.2 | **1** |
| crucial-conversations | 85.3 | 0 |
| **the-power-of-moments (control)** | **74.7** | **4** |

The top-5 collectively carry ~14 echo flags — the same magnitude and structure as
POM's 4. Field type (review card / breakdown / plan / example), n-gram length
(5–10), and key-coverage ratio (up to 1.00) do NOT separate the 74.7 book from the
85.3 books. There is no deterministic feature at this threshold that flags POM's
lifts without also flagging atomic-habits'.

Making echo-tell a BLOCKING per-chapter gate would therefore fail **4 of the 5**
books the calibration REQUIRES to pass — a direct contradiction with the "top-5
must pass" hard requirement, and exactly the whack-a-mole the plan warns against.
Per the spec's explicit escape hatch ("document any hit and tune before
shipping"), echo-tell ships as an **advisory (warn) signal**: it is computed,
surfaced on the rubric line, and fed to the writer as a "prefer a paraphrased key"
note (reinforcing W1 house rule 2, which asks for a paraphrased key up front), but
it does NOT drive a chapter to `fail` or force a whole-chapter rewrite. Raising it
to a hard gate needs a genuinely separating signal (e.g. an LLM judge, or a
narrower surface), which is out of scope for a deterministic write-time check.

The `echoKeyThreshold` stays 5 (the ≥4 tier additionally admits canonical-principle
keys such as "Tie the symbol to real performance" — a strictly worse FP profile).

`tests/card-quality-calibration.test.ts` PINS this reality (top-5 echo count ≥10;
atomic-habits == 4; echoTell never appears in any chapter's `failing` set) so
nobody silently re-promotes echo to a hard gate without re-deriving the calibration.

---

## (b) SYMMETRIC LENGTH-TELL — shipped BLOCKING. The active discriminator.

**Rule (per chapter, out of the chapter's questions):** the key may be the
uniquely-shortest choice (by chars) in at most `lengthTellShortestMax` questions
AND the uniquely-longest in at most `lengthTellLongestMax`.

**Calibrated caps:** `lengthTellShortestMax = 4`, `lengthTellLongestMax = 9`.

Per-chapter counts of "key is the uniquely-shortest / uniquely-longest choice"
(out of 9 questions), sorted descending:

| book | book shortest% | per-ch shortest (desc) | book longest% | per-ch longest (desc) |
|---|---|---|---|---|
| atomic-habits | 3.3 | 3,1,1,1,0… | 86.9 | 9,9,9,9,9,9,9,9,8… |
| crucial-conversations | 7.8 | 2,1,1,1,1,1,0… | 85.6 | 9,9,8,8,8,8,8,7,7,5 |
| games-people-play | 10.0 | 3,1,1,1,1,1,1,0… | 81.1 | 9,9,8,7,7,7,7,7,7,5 |
| thinking-in-bets | 12.7 | 3,3,1,1,0,0,0 | 52.4 | 7,6,5,4,4,4,3 |
| the-happiness-hypothesis | 22.2 | **4,4,4**,2,2,2,1,1,1,1,0 | 44.4 | 7,5,5,4,4,4,4,3,3,3,2 |
| **the-power-of-moments** | **50.9** | **8,8,7,7,5,5**,4,3,3,3,1,1 | 3.7 | 1,1,1,1,0… |

- **Shortest side (active):** the top-5 peak at exactly **4/9** (the-happiness-
  hypothesis has three chapters at 4). A cap of 4 passes all top-5 at the boundary
  and FAILS POM v24, whose chapters run 5–8/9 (6 chapters over the cap). This is
  the clean discriminator the whole W2 gate rests on.
- **Longest side:** the top-5 routinely hit **9/9** — the uniquely-longest key is
  the long-standing house norm in the owner's best books, NOT a defect. A tight
  longest cap would fail all of them, so `lengthTellLongestMax = 9` calibrates the
  longest side OPEN on this corpus. The gate is kept **symmetric in mechanism**
  (both sides are configurable caps, and the LONGEST-side path is unit-tested to
  trip when tightened) so that if the house norm ever shifts, the longest cap can
  tighten without new code — but on today's corpus it must not gate. This is the
  deliberate, documented resolution of the plan's "at most 4 of 9 uniquely-longest"
  wording, which is impossible to satisfy alongside "top-5 must pass": the hard
  requirement (top-5 pass) wins, and the symmetric mechanism is preserved.

POM v24's shortest-side failure is what BLOCKS it through the real
`computeBookRubricMetrics` gate (verdict `fail`, `lengthTell` in the failing set).

---

## (c) PRACTICE FLOOR — shipped BLOCKING. Near-zero FP.

**Rule (per chapter):** `tryThisNow` OR `twentyFourHourChallenge` must contain a
(digit | number word | timebox phrase) AND be imperative-led (first word — or the
word after a leading trigger clause — is a bare command verb, not a subject
pronoun / article / subordinator).

**Calibration hits (documented, near-zero):** across all 60 top-5 chapters, exactly
**2** chapters fail — `games-people-play` ch8 and `thinking-in-bets` ch6. Both carry
legitimate imperative practice ("write the strongest objection…", "write the
sentence…") that happens to name no digit/number-word/timebox in EITHER practice
item. 2/60 = 3.3%, which is "near-zero" per the spec. These are pinned as the EXACT
expected set in the harness so any regression (new FPs) fails loudly. They are not
tuned away because inventing a number-synonym (e.g. counting "next" as a number)
would weaken the concreteness the floor exists to enforce.

POM v24 passes the practice floor in all but ch2 — the floor is not POM's blocker
(the shortest length-tell is); it catches abstract drift the other gates miss.

---

## Summary of what blocks

Through the real `bookRubricMetrics` gate:

| gate | disposition | top-5 blocking fails | POM v24 |
|---|---|---|---|
| echo-tell (a) | **advisory (warn)** | 0 (never blocks) | 0 blocks (4 advisory flags) |
| length-tell (b) | **blocking** | 0 | blocks (shortest side, 51%) |
| practice-floor (c) | **blocking** | 2 (documented: games ch8, thinking ch6) | 0 |

Net blocking card-quality failures across the 60 top-5 chapters: **2** (both
documented). POM v24 is correctly BLOCKED (via the shortest length-tell). No gate
was weakened: echo ships advisory because the corpus proves it cannot separate a
74.7 book from 85.3 books deterministically — a documented calibration outcome, not
a softened threshold.
