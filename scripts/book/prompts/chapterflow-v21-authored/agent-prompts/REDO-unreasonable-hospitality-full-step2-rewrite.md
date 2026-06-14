# Redo unreasonable-hospitality — FULL Step-2 rewrite (not a patch)

**This is not a surgical field edit. Delete the 20 chapter JSONs and re-run
Step 2 from scratch.** Five+ classes of blocker are firing and the corruption
spans every generated field (quizzes, examples, review cards, breakdown frames).
Patching one field would just move the word-salad to another field. Per
QC-PLAYBOOK §6 ("When NOT to use this template"), this is a from-scratch redo.

## Root cause — fix this FIRST or the rewrite fails identically

`.chapterflow/runs/` **does not exist**. There are **zero source sidecars on
disk** for this book. The writer had no grounded source notes, so it template-
filled all 20 chapters by treating concept-LABELS as if they were objects/people:
e.g. the string "Eleven Madison Park ranked 50th at the 2010 World's 50 Best
Restaurants" is dropped in as the thing a protagonist "sees," "reads," and that
"proves" a point. `check-source` reports PASS only because there is nothing to
check — do not trust it here.

**Before re-running Step 2:** confirm Step 1 produced real, specific source
sidecars at `.chapterflow/runs/unreasonable-hospitality/<runId>/sidecars/source/
ch{NN}.source.json`, each containing actual named cases from Will Guidara's book
(the EMP 11 Madison Park story, the hot-dog/$2-tasting-menu gesture, Daniel
Boulud / Danny Meyer mentorship, the "Make it nice" ethos, the four-star NYT
review, etc.) — NOT concept-labels, NOT generic filler. If the sidecars are
missing or generic, redo Step 1 first. Word-salad downstream is the symptom;
fake/absent source is the disease.

## What you change
Everything generated in Step 2, for all 20 chapters: quiz (prompts, choices,
correctIndex, explanations), examples/scenarios, review cards (front/back),
and breakdown frames (counterintuition, tryThisNow, fastRead/deepRead/fullRead).

## What you do NOT change
- The book `state/indexes/unreasonable-hospitality.json` chapter order/titles
  (unless Step 1 is also being redone).
- The pipeline code / gates. This is content, not code.

## Why this redo exists — verbatim broken output

**Quiz prompts are incoherent template skeletons** (ch01 q01, identical shape in
all 20 chapters):
> "Rina, roster: \"It reframes hospitality from a soft, restaurant-only\". Which
> action carries Eleven Madison Park now?"

Every chapter's choices use the same 3-slot skeleton — correct = "should use X
on the roster", distractor A = "should protect the roster… mainly about speed",
distractor B = "should copy X as a fixed performance, even though the present cue
says otherwise". This is why BP20 fires 90×, BP16 9×, AS4 1× (q08 shares >70%
words across 7 chapters), and Q2–Q9 openers ("memo tension for", "minutes left
tovah", "spending claim luis"…) repeat in all 20 chapters.

**Examples are the canonical word-salad** the QC prompt warns about (ch01 / ch20):
> "Imani sees Eleven Madison Park ranked 50th at the 2010 World's 50 Best
> Restaurants at 7:35 morning in the hotel desk."
> "Amina sees Fourth-to-fifth slip on the World's 50 Best list (2015) at 7:35
> morning in the dining pass."

A concept-label is used as a physical object, every example uses the fixed frame
"<Name> sees <label> at 7:35 morning in the <place>".

**Review cards are template-filled** (ch01 / ch20):
> front: "What does Eleven Madison Park ranked 50th at the 2010 World's 50 Best
> Restaurants prove?" back: "…shows why design the feeling before chasing a
> better product; the remembered feeling becomes part of the actual product."

**Breakdown frames collapse across all 20 chapters** (BP3 ×19): counterintuition
shares "act must backed standards money", tryThisNow shares "calendar task owed
write feeling" verbatim in every chapter.

**Names** (F1): junk tokens are used as character names across chapters —
"Eleven", "Madison", "Park", "World", "Best".

## Gate tally to clear (current state = BLOCK)
BP20 blocker ×90 · BP3 blocker ×19 · AS4 blocker ×1 · F1 blocker ×1 · BP16
major ×9 · F4 major ×1 (`rather than` ×219, budget 15).

## Composition rules for the rewrite

### Quiz
- Each question's prompt is a real, self-contained scenario question grounded in
  that chapter's source — a person facing a concrete situation, not a label
  pasted into a frame. No shared opener across chapters; no 5+-word phrase
  repeated across chapters.
- 3 plausible choices in the chapter's own concrete language; distractors are
  wrong-but-believable, not the fixed "speed / fixed performance" skeleton.
- `correctIndex` points at the genuinely correct choice and the `explanation`
  defends THAT choice (this book did not have the hooked wrong-key defect, but
  rebuild so it stays clean). Assign correctIndex per-chapter so it isn't a fixed
  pattern.

### Examples / scenarios
- Drop the "<Name> sees <label> at 7:35 morning in the <place>" frame entirely.
- Each scenario is a specific, coherent situation drawn from the chapter's real
  material; named entities are real people/places from the book, used as
  themselves — never a concept-label standing in as an object or actor.

### Review cards
- `front` is a genuine question; `back` is a true, self-contained answer in the
  chapter's own words. No "What does <label> prove?" template.

### Breakdown frames
- counterintuition / tryThisNow / *Read prose must be chapter-specific and read
  as written by a person. No frame phrase reused verbatim across chapters.

## Banned recurring phrases (do not reuse or lightly vary)
"helps <Name> read the <roster/memo/budget note/training card/…>", "as a fixed
performance, even though the present cue says otherwise", "treating this as
mainly about speed", "sees … at 7:35 morning in the", "the remembered feeling
becomes part of the actual product", "act must backed standards money", "calendar
task owed write feeling". Keep `rather than` under 15 uses book-wide.

## Procedure
1. Confirm/redo Step 1 source sidecars are real (see Root cause).
2. Delete `state/chapters/unreasonable-hospitality-ch{01..20}.v21-native.chapter.json`.
3. Re-run the writer with the current `STEP-2-WRITE-CHAPTERS.md`.
4. After each chapter:
   `npx tsx src/cli.ts gate-chapter state/chapters/unreasonable-hospitality-ch{NN}.v21-native.chapter.json`
   → must be 0 blockers before moving on.
5. After all 20:
   `npx tsx src/cli.ts book-gate unreasonable-hospitality` → must be 0 blockers.

## Done condition
- Source sidecars exist and are real and specific (not labels/filler).
- All 20 chapters regenerated from grounded source.
- Per-chapter `gate-chapter`: 0 blockers each.
- `book-gate unreasonable-hospitality`: 0 blockers.
- A QC content read (≥ ch01 + one late chapter) confirms quiz prompts/choices,
  examples, and cards are coherent, specific, and correct — not template-filled.

Report back: per-chapter blocker counts, book-gate blocker count, and 2–3 sample
quiz questions + examples in raw text for the QC content re-read.
