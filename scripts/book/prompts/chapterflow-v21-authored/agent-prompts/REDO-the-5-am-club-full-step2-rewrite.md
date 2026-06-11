# Redo the-5-am-club — FULL STEP-2 REWRITE FROM SCRATCH (not a surgical patch)

**Do not patch individual fields. Every field of every chapter is corrupted.**
Delete the current chapter JSONs and re-author all 18 chapters as real prose
grounded in the actual book. The current output is grammatical word-salad that
passed every deterministic gate GREEN — so passing the gates is NOT evidence the
rewrite worked. A human/QC must READ the new content.

## Why this redo exists

Step 2 produced output that reads as if a slot-filling script stitched real book
sentence-fragments into a fixed template, substituting the chapter's core concept
as a noun/adjective ("empires nurse", "tactics hospital ward", "years coach").
Sentences are fused with periods mid-clause; concept labels are used as actors
and objects; quiz choices are not coherent propositions. This affects **hook,
keyTakeaway, breakdown (all three tiers), examples, quiz prompts/choices/
explanations, reviewCards, implementationPlan, and memorableLines** — i.e. every
field class — across **all 18 chapters** (verified ch01, ch09, ch15, ch18; the
skeleton is identical book-wide).

Critically: `book-gate the-5-am-club` reports **PASS, 0 blockers** and every
`gate-chapter` reports **0 blockers**. The corruption is grammatical-fragment
assembly, not n-gram/verbatim repetition, so AS1–AS13 / BP family / SC9 do not
fire. **Do not use the gates to judge whether the rewrite is fixed. Read it.**

### Verbatim broken output (current, unacceptable)

keyTakeaway (ch01) — a full sentence jammed mid-template, period left mid-clause:
> "Practice crisis as threshold by treating a personal crisis can expose the
> hidden cost of a life optimized for status, speed, and control. as a design
> signal, not as background noise."

breakdown.deepRead (ch01) — fused fragments, broken grammar:
> "Crisis as threshold works through legal fight placement. ... Future Her wealth
> and status are present in the setting, but they do not help her regulate grounds
> legal fight practice."

example scenario (ch09) — concept slug used as role/adjective; Mad-Libs skeleton:
> "Gemma, a empires nurse, stands on the empires hospital ward Wednesday at 11:54
> am with a heartset shift chart marked Mindset. ... Gemma faces a choice: answer
> healthset pressure with The 4 Interior Empires, or drift with empires."

quiz (ch15, q01) — prompt + choices are concatenated fragments, not real Q&A:
> prompt: "Ursula studies Readers see that Victory Hour is a foundation, not the
> only practice required for long-term excellence beside the bubble shift chart.
> The team mentions Tight Bubble. Which choice fits lifelong genius tactics?"
> choices[2] (marked correct): "Let Ursula protect Several tactics defend
> attention, including the Tight Bubble of Total Focus, where a person before
> tactics takes the room."

reviewCard (ch18, card01) — front quotes a truncated fragment; back is formulaic:
> front: 'In "Readers are encouraged to measure the routine," what should
> five-year compounding make years notice about Stone Riley\'s?'
> back: "Readers are encouraged to measure the routine by trajectory rather than
> immediate mood or novelty. five-year compounding starts when that cost is
> treated as a signal."

The same skeletons recur with the slug/name/time swapped per chapter.

Root cause (per QC-PLAYBOOK §7): scenarios and prose are detached from real
source and assembled mechanically. The fix is to write grounded prose, not to
shuffle fields.

## Prerequisite — BEFORE you regenerate

1. **Locate the source notes.** There is no `.chapterflow/runs/the-5-am-club/`
   directory on disk — the per-chapter source sidecars are missing. The current
   chapters DO contain real 5 AM Club material (the Spellbinder, the entrepreneur
   and the artist, the four interior empires = mindset/heartset/healthset/soulset,
   90/90/1, the Tight Bubble of Total Focus, Victory Hour / 20-20-20, Stone Riley,
   five-years-later epilogue), so Step-1 research existed at generation time.
   Confirm where it is. If it cannot be found, **re-run Step 1 (research) first** —
   do not author from memory.
2. Confirm Step 1 with `npx tsx src/cli.ts check-source the-5-am-club`, then READ
   1–2 sidecars to confirm they contain real, specific named cases from the book.

## What you change

Re-author, from scratch, every field in every chapter file:
`state/chapters/the-5-am-club-ch{01..18}.v21-native.chapter.json`

Delete the current files and regenerate them with the current
`agent-prompts/STEP-2-WRITE-CHAPTERS.md` and the real Step-1 source notes.

## What you do NOT do

- Do NOT keep any sentence from the current chapters.
- Do NOT reuse the example/quiz/card skeletons above (any chapter).
- Do NOT use the book's concept as a noun/adjective ("empires nurse",
  "tactics chart", "threshold founder", "years coach", "compounding sheet").
- Do NOT fuse two sentences with a period left mid-clause.

## Composition rules (what correct output looks like)

**Prose (hook, counterintuition, keyTakeaway, breakdown tiers, memorableLines):**
Write complete, grammatical English a person could read aloud. Each breakdown
tier (fastRead/deepRead/fullRead) must teach the chapter's actual idea and be
progressive (don't open two tiers with the same sentence). The concept is a
*topic you explain*, never a token you slot into a sentence.

**Examples:** Real, specific scenarios grounded in the book's named cases and
ideas (the entrepreneur, the artist, the Spellbinder's teachings, the actual
tactics). A named protagonist faces a concrete decision with real stakes and a
clear "what to do" + "why it matters". No `[Name], a [concept] [role] stands in
the [concept] [place] [Day] at [HH:MM]` Mad-Libs. Reference proper-noun anchors
from the source (this is what SC9 wants).

**Quiz:** Each `prompt` is one coherent question. Each `choice` is a complete,
standalone proposition. `correctIndex` points at the genuinely correct choice and
the `explanation` must justify *that same* choice. Distractors are
plausible-but-wrong, not fragments. Vary `correctIndex` across the 9 questions and
across chapters (don't lock the correct answer to one structural slot).

**Review cards:** `front` is a real question; `back` is a true, complete answer
to that exact question. No quoting truncated fragments in the front.

**Implementation plan:** Real if-then plans in complete sentences.

## Procedure
1. Regenerate chapter by chapter, ch01 → ch18.
2. After each chapter: `npx tsx src/cli.ts gate-chapter state/chapters/the-5-am-club-ch{NN}.v21-native.chapter.json` → 0 blockers.
3. After all: `npx tsx src/cli.ts book-gate the-5-am-club` → 0 blockers.
4. **Then READ ch01 + one late chapter end-to-end yourself.** Confirm every field
   is coherent grammatical prose, every quiz key matches its explanation, every
   card answers its front. Gates passing is necessary but NOT sufficient.

## Done condition
- All 18 chapters re-authored as grounded prose (no fragment-assembly).
- Per-chapter `gate-chapter`: 0 blockers. Book `book-gate`: 0 blockers.
- Your own end-to-end read of ≥2 chapters confirms coherence + correct quiz keys.
- Report back: per-chapter blocker counts, book-gate blocker count, and a 2–3
  sentence summary of what you verified by reading (not just gate output).
