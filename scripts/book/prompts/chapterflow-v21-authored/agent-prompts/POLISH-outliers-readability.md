# Polish outliers — readability (E1) + quiz choice capitalization

You are doing **two** narrow polish edits across the 9 Outliers chapters.
Nothing else changes. This is a polish pass on an already-passing book
(book-gate is GREEN, 0 blockers) — do not restructure anything.

## What you change

1. **Breakdown tier readability (E1).** Lower the Flesch-Kincaid grade of
   the breakdown tiers that exceed their ceiling, by shortening sentences
   and swapping four-plus-syllable words for plainer ones. Ceilings:
   - `breakdown.fastRead` → target grade **7–8** (ceiling 8.5)
   - `breakdown.deepRead` → target grade **9–11** (ceiling 11)
   - `breakdown.fullRead` → target grade **10–12** (ceiling 12)
   `fastRead` is the primary offender — every chapter is over. deepRead /
   fullRead are only marginally over on a few chapters (see table).

2. **Quiz choice capitalization.** Capitalize the first letter of every
   quiz choice string that currently starts lowercase. The choices use a
   deliberate `scenario label: action` format (e.g.
   `"hockey cutoff: praise effort"`). Keep the format and every word —
   only uppercase the first character: `"Hockey cutoff: praise effort"`.

## What you do NOT change

- `hook`, `counterintuition`, `tryThisNow`, `keyTakeaway`, `title`
- `examples` (every field — scenario, whatToDo, whyItMatters, names)
- `quiz.questions[].prompt`, `.correctIndex`, `.explanation`,
  `.bloomsLevel`, `.depthLevel` — and the **wording/order** of choices
  (only the first-letter case of a choice may change)
- `reviewCards`, `implementationPlan`
- The **meaning, facts, named cases, and claims** of any breakdown tier.
  You are re-leveling prose, not rewriting content. Every Gladwell case
  (the 10,000-hour rule, Roseto, Bill Joy, the hockey cutoff dates, KIPP,
  rice paddies, etc.) stays exactly as cited.

## Why this polish exists

Outliers passed every gate with 0 blockers and a clean book-gate. The
only reader-facing debt is 29 `E1` readability majors (breakdown tiers
written above their grade ceiling — `fastRead` ranges FK 10.6–14.4
against an 8.5 ceiling) and 45 `schema.quiz_lowercase_choice_start`
majors (quiz choices beginning with a lowercase scenario label). Both
are visible to readers; neither blocks. Examples of the broken output:

- `fastRead` ch06: Flesch-Kincaid grade **14.4** (ceiling 8.5)
- `fastRead ¶3` ch04: **6** four-plus-syllable words (max 2 at grade 8–9)
- quiz ch01 `q02.c0`: `"hockey cutoff: praise effort..."` (lowercase)

## E1 per-chapter targets

Fix the tiers listed; leave tiers not listed alone (already in range).

| Ch | fastRead (→7–8) | deepRead (→9–11) | fullRead (→10–12) |
|----|----|----|----|
| 01 | FK 13.4 ✚ ¶3 long words | — | FK 12.4 (trim slightly) |
| 02 | FK 12.8 ✚ ¶3 long words | — | — |
| 03 | FK 10.6 ✚ ¶3 long words | FK 11.1 (trim slightly) | — |
| 04 | FK 12.7 ✚ ¶2,¶3 long words | FK 12.7 | FK 13.3 |
| 05 | FK 12.0 | — | FK 12.2 (trim slightly) |
| 06 | FK 14.4 ✚ ¶2,¶3 long words | FK 11.1 (trim slightly) | FK 12.5 |
| 07 | FK 13.3 ✚ ¶2,¶3 long words | FK 11.6 | — |
| 08 | FK 12.0 ✚ ¶3 long words | — | — |
| 09 | FK 12.2 ✚ ¶2,¶3 long words | — | — |

## Files

- Chapter JSONs to modify:
  `state/chapters/outliers-ch{NN}.v21-native.chapter.json` (NN = 01–09)
- Source notes per chapter (for plain-language paraphrase anchors):
  `.chapterflow/runs/outliers/20260601-083238/sidecars/source/ch{NN}.source.json`
- Book toc:
  `.chapterflow/runs/outliers/20260601-083238/source-freeze/toc.json`

## Rules

### Breakdown readability composition rule

Work paragraph by paragraph inside the flagged tier:
1. Split long sentences. Aim for an average sentence length around
   12–16 words in `fastRead`; one idea per sentence.
2. Replace four-plus-syllable words with plain equivalents where meaning
   survives (e.g. "demonstrates" → "shows", "consequently" → "so",
   "approximately" → "about", "opportunity" → "chance"). Keep proper
   nouns and the few technical terms the chapter genuinely teaches.
3. `fastRead ¶2` / `¶3` flagged for long words: get each flagged
   paragraph down to **≤2** four-plus-syllable words.
4. Preserve every fact, name, number, and the tier's progression
   (fastRead = gist, deepRead = mechanism, fullRead = full nuance). Do
   not flatten a deeper tier into the shallower one's wording.

### Anti-templating guardrail (important)

Do **not** simplify by collapsing tiers into the same stock phrasing
across chapters. Each chapter's tiers must stay anchored to that
chapter's own named cases from its source sidecar. Reusing a generic
simplified skeleton ("In this chapter we learn that…") across chapters
will trip the cross-chapter critics (AS10/AS11/BP10/BP13) and turn a
GREEN book RED. Simpler words, same source-grounded substance, distinct
per chapter.

### Quiz capitalization rule

For each `quiz.questions[].choices[]` string that starts with a-z:
uppercase only the first character. Do not touch the rest of the string,
the choice order, or `correctIndex`.

## Procedure

1. Work chapter by chapter, 01 → 09.
2. After each chapter, run:
   `npx tsx src/cli.ts gate-chapter state/chapters/outliers-ch{NN}.v21-native.chapter.json`
   Confirm `blockers: 0` (must stay 0) and that `E1` +
   `schema.quiz_lowercase_choice_start` majors for that chapter dropped
   to 0 (or near-0 for any tier intentionally left at the high end of its
   band).
3. After all chapters, run:
   `npx tsx src/cli.ts book-gate outliers`
   It must still report **`Book gate: PASS`** with 0 blockers. If any
   blocker appears, you over-edited and introduced templating — revert
   that chapter's tier and re-simplify with more source-specific wording.

## Done condition

- All flagged breakdown tiers at or below their grade ceiling.
- 0 lowercase quiz choices remain.
- Untouched fields (examples, cards, plans, quiz prompts/order/answers,
  hooks) verified unchanged.
- Per-chapter `gate-chapter`: still 0 blockers.
- `book-gate outliers`: still PASS, 0 blockers.

Report back: per-chapter remaining E1 count, remaining lowercase-choice
count, and the book-gate result.
