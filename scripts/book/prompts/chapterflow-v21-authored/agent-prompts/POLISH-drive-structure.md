# Polish drive — counterintuition variety (B11) + hook openers (B13) + readability (E1)

You are doing **three** narrow polish edits on the 11 Drive chapters.
Nothing else changes. The book already passes book-gate with 0 blockers;
this pass removes structural-templating tells and minor readability debt
so it promotes clean. Do not restructure, re-argue, or re-example anything.

## What you change

1. **`counterintuition` opener shape (B11).** 7 of 11 chapters open the
   `counterintuition` field with the same negation-correction shell —
   *"X is not Y. [correction]"*. Rewrite the **opening sentence(s)** of
   the 7 flagged chapters so the paradox is signalled with a *different*
   shape each time. Keep the same insight and content; change only how
   the contrast is framed.

2. **`hook` first word (B13).** 6 of 11 hooks open with the word "a"
   (cap is 6 — at the limit). Reword the **opening** of **at least 3** of
   the flagged hooks so they start with a different word, bringing the
   "a"-openers to ≤3. Keep each hook's meaning and the rest of its
   sentence; just recast the opening so it doesn't begin with "A ".

3. **`fastRead` long-word readability (E1).** In the flagged `fastRead`
   paragraphs, swap four-plus-syllable words for plainer equivalents so
   each flagged paragraph has **≤2** four-plus-syllable words. Ch04's
   `fastRead` is also marginally over grade (FK 9.6 vs 8.5) — shorten a
   sentence or two there. This is a word-level swap, not a rewrite.

## What you do NOT change

- The **content, claims, facts, and named cases** of any field. Same
  Pink material (Motivation 2.0/3.0, Type I/X, autonomy/mastery/purpose,
  the candle problem, Wikipedia/Encarta, etc.).
- `counterintuition` and `hook` **substance** — only the *opening
  framing* changes; the point each makes stays identical.
- The 4 `counterintuition` chapters NOT flagged for B11 (ch01, ch02,
  ch06, ch09) — leave them alone; they already vary.
- `tryThisNow`, `keyTakeaway`, `title`, `examples`, `quiz`,
  `reviewCards`, `implementationPlan`, and the `deepRead`/`fullRead`
  breakdown tiers.

## Why this polish exists

Drive cleared every gate with 0 blockers, but book-gate flagged two
cross-chapter structural tells the cleaner books didn't have, plus minor
readability debt. None block; all read as formulaic to a human.

### B11 — the 7 chapters with the negation-correction shell (verbatim)

| Ch | Current opener (rewrite the framing) |
|----|----|
| 03 | "The useful answer is **not** reward or no reward. The useful answer is…" |
| 04 | "Type I is **not** a rare personality gift. It is…" |
| 05 | "Autonomy is **not** the absence of accountability. It is…" |
| 07 | "Purpose is **not** a soft extra added after profit. It becomes…" |
| 08 | "Personal motivation is **not** only a feeling to wait for. It can be…" |
| 10 | "Intrinsic motivation is **not** a discount coupon for employers. Fair…" |
| 11 | "Helping children become self-directed **does not** mean removing expectations. It means…" |

These four are already varied — **match their range, don't copy them**:
- ch01: "A system built to buy compliance can misread work that depends on curiosity…"
- ch02: "Rewards can change the meaning of an activity before they change the output…"
- ch06: "Mastery feels rewarding partly because it is demanding…"
- ch09: "Motivation problems often look personal because the system is invisible…"

### B13 — the 6 hooks opening with "a" (reword ≥3)

ch02 "A fine can make…", ch03 "A reward can help…", ch07 "A mission that
never…", ch08 "A day can hide…", ch09 "A workplace changes…", ch11 "A
gold star can buy…". Recast at least 3 to open on a different word.

### E1 — flagged fastRead paragraphs (long-word swaps)

ch01 ¶1, ch04 (whole tier + ¶2,¶3), ch05 ¶3, ch06 ¶2, ch07 ¶3, ch08 ¶2,
ch09 ¶2+¶3, ch10 ¶2, ch11 ¶2+¶3. Get each to ≤2 four-plus-syllable words.

## Files

- Chapter JSONs to modify:
  `state/chapters/drive-ch{NN}.v21-native.chapter.json` (NN = 01–11)
- Source notes per chapter:
  `.chapterflow/runs/drive/20260601-083118/sidecars/source/ch{NN}.source.json`
- Book toc:
  `.chapterflow/runs/drive/20260601-083118/source-freeze/toc.json`

## Rules

### B11 — counterintuition variety rule

Each rewritten opener must signal the paradox with a **structurally
distinct** move. Rotate across these shapes (use a different one per
chapter; do not reuse the negation-correction "X is not Y" form):
- a surprising consequence first ("Pay people more for creative work and
  they often do less of it.")
- a concrete contrast of two scenes
- a question that overturns the obvious
- a "we assume… but" reversal stated as a single claim, not a not/then
- naming the trap directly ("The reward becomes the point, and the work
  becomes the toll.")
The test: read the 11 counterintuition openers back to back — no two
should share the same skeleton. **Do not** swap one stock shell for a
new stock shell repeated across chapters; that just moves the B11 tell.

### B13 — hook opener rule

Recast the chosen hooks to open on a noun, verb, name, or number
instead of the article "a". Don't just delete "a" and leave a fragment —
restructure the clause so it reads naturally. Keep the hook one idea
long and concrete.

### E1 — readability rule

Replace four-plus-syllable words with plain equivalents where meaning
survives (e.g. "personality" → "trait", "accountability" → "ownership",
"investigated" → "studied", "intrinsic" stays only if the chapter
genuinely teaches the term). Keep proper nouns and the few terms the
chapter is actually teaching. Don't flatten meaning to cut a syllable.

### Anti-templating guardrail

This is a variety pass — its whole purpose is to *reduce* sameness. Do
not introduce a new repeated skeleton while removing the old one. Keep
every rewrite anchored to that chapter's own argument and source case.

## Procedure

1. Work chapter by chapter, 01 → 11 (skip B11 edits on ch01/02/06/09).
2. After each edited chapter, run:
   `npx tsx src/cli.ts gate-chapter state/chapters/drive-ch{NN}.v21-native.chapter.json`
   Confirm `blockers: 0` (must stay 0) and that the chapter's E1 count
   dropped.
3. After all chapters, run:
   `npx tsx src/cli.ts book-gate drive`
   It must report **`Book gate: PASS`** with **0 blockers**, **B11 gone**
   (negation-shell share below the 50% trigger), and **B13 gone**
   ("a"-openers ≤ cap). If a blocker appears, you over-edited — revert
   that field and redo with more source-specific wording.

## Done condition

- ≤3 of 11 counterintuition openers use any single shared shape (B11 clear).
- ≤3 hooks open with "a" (B13 clear).
- Every flagged fastRead paragraph ≤2 four-plus-syllable words; ch04
  fastRead under grade ceiling (E1 clear or near-clear).
- All untouched fields verified unchanged.
- Per-chapter gate-chapter: 0 blockers. Book gate: PASS, 0 blockers.

Report back: remaining B11/B13 status from book-gate, remaining E1 count
per chapter, and the final book-gate result.
