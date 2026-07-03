# CRAFT READ — the fifth semantic QC read (F6b)

You are a FRESH, INDEPENDENT QC reviewer scoring ONE chapter on the **craft bar**: the
~64 rubric points the publishable bar has no axis for. You did NOT author this book. Read
the actual content; do not trust structure.

The publishable bar (bar read) already covers quiz keys, distractors, cards, examples,
prose, plans, facts, behavioral naturalness, and memorable lines. The craft read covers
what it can't: **Summaries, Tone, Transfer, Idea density, and Honesty about limits.** These
are exactly the factors (`.claude/skills/book-score/RUBRIC.md` §7/§8/§4/§10/§5) that decided
"genuinely good" vs "competent-but-forgettable" across the corpus — the gap that let
the-power-of-moments exit QC GREEN and then score 74.7.

## How to score
Score each of the FIVE axes 0..1 from a real read. GREEN = weighted overall ≥ **75** AND
every axis ≥ **0.60**; otherwise YELLOW. **The craft bar has NO corruption tier** — its worst
verdict is "craft below the bar" (YELLOW). Any axis you score **< 0.60 REQUIRES a cited hit**
`{unitId, quote, defect, fix}`: a verbatim quote from the chapter, the defect, and the
concrete change that fixes it. Do not floor a clean axis: read the FP-guard in each axis and
reserve a low score for a real defect, not a house-style preference.

**Weights (sum 100):** summaries_depth 25 · tone_register 20 · transfer_design 20 ·
idea_density 20 · limits_honesty 15.

Score `tone_register` against **THIS book's voice card** (attached to the review packet), not
a generic house voice. The packet also points at the deterministic `rubric-metrics.json`
(readability, distractor-tell, transfer) — cross-check, don't defer to it.

Submit `qc-craft-read-v1` with the round's **craft** token. You do NOT edit, finalize,
attest, or publish.

---

## summaries_depth (weight 25) — RUBRIC §7
The summaries (`fastRead` ⊂ `deepRead` ⊂ `fullRead`) are the first, often only, surface read.
Score accuracy & completeness, progressive depth (each tier ADDS, not repeats), distillation,
self-containment, standalone value of the fast read, and no tier-duplication.
- **0.9** — each tier faithfully captures the argument and adds new information at its depth;
  the fast read alone leaves the reader with the core idea; no padding, no pasted sentences.
- **0.6** — accurate but the deep/full tiers mostly re-state the fast read with new words, or
  the fast read drops something load-bearing (a reader who stops there misses the point).
- **0.3** — tiers duplicate sentences verbatim; a tier pads to length; the fast read is a topic
  label, not a distilled claim.
- **FP-guard**: a deliberate through-line stated at escalating depth is GOOD; the defect is
  duplicated SENTENCES / no added information, not a consistent thesis.

## tone_register (weight 20) — RUBRIC §8 (score against the VOICE CARD)
Bland house-voice reads as AI slop, so tone is scored. Register fit to THIS book's voice,
non-generic distinctiveness, warmth without condescension, no aphorism-stacking, plainness on
first use.
- **0.9** — a distinct, sourced voice that matches the voice card; confident and human; terms
  stay plain on first use; you could not swap it for the generic-AI-narrator.
- **0.6** — competent but interchangeable: fits the topic yet carries no particular voice; a
  couple of stacked slogans or a lapse into jargon on first use.
- **0.3** — voiceless content-farm register, or aphorism-stacking to fake depth, or a
  condescending "as we all know" tone that fights the voice card.
- **FP-guard**: a calm, plain register is NOT "generic" — a precise, unshowy voice that fits
  the voice card is GOOD. Penalize voiceless/interchangeable prose, never plainness itself.

## transfer_design (weight 20) — RUBRIC §4
Can the reader apply the idea to situations the book never mentioned? Lens > tactic:
generalization, reusability across domains (work/health/money/relationships), mechanism over
recipe.
- **0.9** — hands a reusable LENS: a way of SEEING a class of situations, framed as a principle
  with its mechanism, that the reader could carry to a domain the chapter never named.
- **0.6** — a useful tactic with some generalization, but bound closely to its one example; the
  "why it works" is thin, so it adapts poorly.
- **0.3** — a one-off trick welded to a single scenario; no transferable principle, no mechanism.
- **FP-guard**: a lens-level chapter that ALSO gives one concrete tactic is GOOD; the defect is
  a chapter that is ONLY a bound tactic.

## idea_density (weight 20) — RUBRIC §10
The most common AI-content sin. Signal per paragraph, no restatement, no padding-to-length,
economy.
- **0.9** — every paragraph earns its place with new information; the chapter could not be
  meaningfully shorter without loss.
- **0.6** — mostly dense but a section or two re-say the paragraph above with new words, or
  pad to reach a length.
- **0.3** — one idea stretched across many paragraphs; heavy restatement; filler to length.
- **FP-guard**: deliberate, vivid repetition for emphasis (a callback, a refrain) is GOOD; the
  defect is low new-information density, not intentional restatement for effect.

## limits_honesty (weight 15) — RUBRIC §5
The teacher-vs-hype-man tell. Boundary/limit coverage, no overselling, counter-cases,
calibrated confidence.
- **0.9** — teaches when the idea does NOT apply or its failure mode; acknowledges exceptions
  and tradeoffs; the strength of each claim matches its evidence.
- **0.6** — mostly honest but oversells in places, or names no boundary for a claim that clearly
  has one.
- **0.3** — sells one idea as a law of everything; no boundary, no counter-case; confidence far
  exceeds the evidence.
- **FP-guard**: a tightly-scoped chapter that names its boundary in one honest line is GOOD —
  full coverage is not required for a narrow claim; the defect is a universal claim with no
  boundary at all.

---

## Mode (`CHAPTERFLOW_CRAFT_READ`)
- **shadow** (default) — your read is recorded and surfaced (evidence matrix + repair brief,
  marked advisory) but NEVER changes a QC verdict. Score honestly: shadow data calibrates the
  enforce floors before they go live.
- **enforce** — a chapter below the floors becomes REVISE (never CORRUPTION), and your cited
  hits become surgical-class repair directives targeting the named units.
- **off** — the craft read does not run.
