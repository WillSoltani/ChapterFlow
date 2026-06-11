# Redo drive — quiz (all fields) + reviewCard fronts + example whatToDo/scenario

`book-gate drive` → PASS, 0 blockers, 0 majors (only F4 "rather than" ×81),
positions 33/33/33, all `gate-chapter` 0 blockers. The book is still
unshippable: **all 99 quiz questions are structurally-broken Mad-Libs** and
**all 55 review-card fronts are label-only non-questions.** This is the same
AS13-evading fragment-assembly defect seen on unreasonable-hospitality and
the-5-am-club — 9 quiz skeletons rotated one-per-slot so no phrase repeats
≥8× per chapter.

**This is a TARGETED redo, not a full rewrite.** The breakdown prose, hooks,
and review-card *backs* are genuinely good and accurate to the book — preserve
them byte-for-byte. Only the assembled fields below change.

## What you change (per chapter, all 11)
1. `quiz.questions[].prompt` — write a real question.
2. `quiz.questions[].choices` — write real, plausible-but-wrong distractors.
3. `quiz.questions[].explanation` — explain why the key is right.
4. `reviewCards[].front` — turn each into an actual question.
5. `examples[].whatToDo` — write a real reader action.
6. `examples[].scenario` — remove the template opener (see rule).

## What you do NOT change
`hook`, `counterintuition`, `tryThisNow`, `keyTakeaway`, `breakdown.fastRead`,
`breakdown.deepRead`, `breakdown.fullRead`, `reviewCards[].back`,
`reviewCards[].difficulty`, `implementationPlan.*`, `memorableLines`,
`examples[].title/tags/planSpec`, all ids, `number`, `title`,
`readingTimeMinutes`. The factual content is correct — keep it.

## Why this redo exists (verbatim broken output)

**Quiz — the correct answer is identifiable by FORMAT alone.** Every question
has exactly one un-prefixed choice (the key); both distractors are the correct
sentence (or another real one) with a nonsense directive prefix. ch11 Q1:

> prompt: "Homework test: preserve the source lesson for Autonomy-supportive
> learning; choose the fit."
> [0] "Homework test: Reverse Homework should be tested for autonomy, mastery,
> and purpose rather than assigned by habit."
> [1]* "Homework should be tested for autonomy, mastery, and purpose rather
> than assigned by habit."
> [2] "Autonomy-supportive learning: Prefer supervision over Homework should be
> tested for autonomy, mastery, and purpose rather than assigned by habit."

The distractors literally embed the correct answer verbatim behind a gibberish
verb ("Reverse", "Prefer supervision over", "Flatten", "Force one tool onto",
"Exaggerate against the guardrail", "Blame the person and discard", "Status-
label reading", "Treat … as decorative", "Case retold", "Pilot before
checking", …). The prompts are 9 fixed skeletons ("preserve the source lesson
for X; choose the fit" / "plan with X in view; what follows?" / "hold the
boundary around X; which answer fits?" / "test the claim against X; what
overreaches?" / etc.). Explanations are templated or mismatched (e.g. ch01 Q2
expl: "choose the answer that keeps Wikipedia versus Microsoft Encarta intact";
ch01 Q3 expl pulls from "Ultimatum game fairness," a different concept than the
question) and frequently truncate mid-sentence.

**Review-card fronts are not questions.** All 55 fronts are a label + period:

> front: "Motivation operating systems." / "Mihaly Csikszentmihalyi and flow."
> / "Mastery as an asymptote." / "Homework test."

The backs are good; the fronts give nothing to recall against.

**examples[].whatToDo holds propositions, not actions.** ch01-ex01:

> "Nonmarket motives can coordinate huge amounts of serious work when the task
> is open, meaningful, and self-directed. Wikipedia beating Microsoft Encarta
> shows that unpaid, self-directed contributors can outperform…"

That states facts; it does not tell the reader what to do.

**examples[].scenario uses an identical template opener** across the whole book
— every scenario starts "<Name>, 8:40 a.m. at the <place>: <Concept>." (same
time in every chapter) and then states facts instead of presenting a situation.

## Composition rules
- **quiz prompt** — a concrete question a reader can answer only by understanding
  the idea (a scenario or a concept check). No fixed skeleton; vary naturally.
- **quiz choices** — three complete, parallel propositions. Distractors must be
  plausible-but-wrong (a real misconception about the idea), NOT the key with a
  prefix, and must NOT contain the key's sentence verbatim. No choice may carry
  a leading directive verb or a "<Concept>:" prefix. The key must not be
  identifiable by length or format.
- **quiz explanation** — one or two sentences saying why the key is right and why
  the distractors fail. It must match THIS question's concept. No "keeps X
  intact" template; no truncation.
- **reviewCards[].front** — a real question ending in "?" that the existing
  (unchanged) back answers.
- **examples[].whatToDo** — one plain instruction the reader can act on.
- **examples[].scenario** — a concrete moment with a real person facing a choice;
  drop the "<Name>, 8:40 a.m. at the <place>: <Concept>." template and vary the
  time/structure. A concept may be referenced, not used as a label-colon header.

## Banned substrings (anywhere in regenerated fields)
`preserve the source lesson for`, `choose the fit`, `keeps old rules intact`,
`Prefer supervision over`, `Force one tool onto`, `Exaggerate against the
guardrail`, `Blame the person and discard`, `Status-label reading`, `Case
retold`, `Reward motion while postponing`, `Remove social meaning from`,
`8:40 a.m.`, and any choice beginning "Reverse <the correct sentence>".

## Procedure
1. Per chapter: `npx tsx src/cli.ts gate-chapter state/chapters/drive-ch{NN}.v21-native.chapter.json` → 0 blockers.
2. After all 11: `npx tsx src/cli.ts book-gate drive` → 0 blockers (and watch F4:
   trim "rather than" toward budget).

## Done condition (gates are necessary but NOT sufficient)
- Per-chapter gate-chapter: 0 blockers. Book gate: 0 blockers.
- **AND** a human/QC read confirms: no quiz question is answerable by spotting
  the un-prefixed choice; no distractor embeds the key verbatim or carries a
  directive prefix; explanations match their question; every review-card front
  is a question; every whatToDo is an action; no scenario uses the "8:40 a.m."
  template.

Report back: per-chapter + book-gate blocker counts, and quote one rewritten
ch01 quiz question (prompt + 3 choices + key + explanation) and one rewritten
review-card front.

## Escalation
This fragment-assembly / AS13-evasion defect has now appeared on multiple books
(unreasonable-hospitality, the-5-am-club, range, drive). The deterministic
gates cannot catch it. If this regeneration still emits format-identifiable
quiz keys or label-only card fronts, change the writer model/approach rather
than regenerating again.
