# Redo range — quizzes (whole) + review-card fronts

You are doing **2 specific edits in every one of the 12 chapters. Nothing else
changes.** The rest of the book (prose, examples, hooks, takeaways, card backs,
plans) is good and must be preserved **byte-for-byte**.

> ⚠️ The `range` chapters are NOT currently in `state/chapters/`. The only copy
> of the good content is the **promoted package** `book-packages/range.v21.json`
> (repo root). Step 0 below is to reconstitute the chapters from it, then fix the
> two broken fields. Do not regenerate the good fields from scratch — copy them.

## What you change
1. **The entire `quiz` for every chapter** — every question's `prompt`,
   `choices`, `correctIndex`, and `explanation`. They are currently word-salad
   (see below). Author real questions from source.
2. **Every `reviewCards[*].front`** — currently truncated mid-word and/or a
   circular restatement of the `back`. Rewrite as a genuine retrieval cue.

## What you do NOT change (copy verbatim from the package)
- `hook`, `counterintuition`, `tryThisNow`, `keyTakeaway` — all good.
- `breakdown.fastRead` / `deepRead` / `fullRead` — all good. Do not touch.
- `examples[*]` (title + scenario) — all good, coherent, source-grounded.
- `reviewCards[*].back` — good and true. Keep. (Only the **front** changes.)
- `implementationPlan`, `title`, `number`, `chapterId`, `readingTimeMinutes`.
- `quiz.passingScorePercent`.

## Why this redo exists

The shipped `range.v21.json` passed every deterministic gate and a prior QC
round — but a content read found the **entire quiz set is templated word-salad**.
Measured across the book: **108/108** questions have a choice that is a raw
mid-word source-sentence fragment, **99/108** share one identical explanation
shell, **90/108** have a stub prompt. The choices were produced by slicing
substrings out of source sentences (they literally start mid-word). The quizzes
are unusable. This is the same defect class that shipped `hooked` with wrong
keys — except here every field of every question is broken, so `correctIndex`
is meaningless.

### Verbatim broken output (do NOT reproduce this shape)

Ch01 Q1:
```
PROMPT: "...remain stable." Apply Laszlo Polgar and.
[0]* Check conditions: Laszlo Polgar and; meaningful chess patterns in place of a general photographic gift; ...
[1]  Surface copy: Laszlo Polgar and; ge that masks poorer long-term adaptation when the surrounding environment...
[2]  Work-rate myth: kind versus wicked; e memory is structured around meaningful patterns built by practice...
EXPL: Reason: Laszlo Polgar and is conditional. kind versus wicked requires fit.
```

Ch12 Q1:
```
PROMPT: "...formal objectives." Apply Oliver Smithies.
[0]  Surface copy: Oliver Smithies; verspecialized scientific training can weaken rigor...
[2]* Check conditions: Oliver Smithies; s's starch-gel electrophoresis grew from tinkering...
EXPL: Reason: Oliver Smithies is conditional. deliberate amateurism requires fit.
```

Symptoms to eliminate: prompts that end `Apply <Concept>.` or `... and.`;
choices shaped `Label: <concept-label>; <fragment starting mid-word>`; a
concept-label used as a noun/actor; every explanation being
`<Prefix>: X is conditional. Y requires fit.`

### Broken card fronts (ch01, verbatim)
```
[0] FRONT: Retrieve the condition: Laszlo Polgar's chess experiment ... remain s.
[2] FRONT: Name the misreading: The wrong takeaway is that early specialization is a fraud. ... the learning enviro.
```
Fronts are cut off mid-word (`remain s.`, `enviro.`) and just restate the back.

## Files
- Reconstitute chapters into: `state/chapters/range-ch{NN}.v21-native.chapter.json`
  (NN = 01..12). Source of good fields: `book-packages/range.v21.json` →
  `chapters[]` (match by `number`).
- Source notes per chapter (REPO ROOT, not the v21 dir):
  `.chapterflow/runs/range/20260601-083123/sidecars/source/ch{NN}.source.json`
- Book toc:
  `.chapterflow/runs/range/20260601-083123/source-freeze/toc.json`

Author the new quizzes and card fronts from the **source notes + the chapter's
own breakdown prose**, which are factual and specific. Do not re-run whatever
templating path produced the substring fragments — write the questions by hand.

## Rules

### Quiz composition rule (per question)
1. Write a `prompt` that is a complete, answerable question about a real idea,
   case, or distinction in *this* chapter (e.g. why scrambled-board recall
   collapses; what "kind vs wicked" predicts; what Smithies's Saturday play
   shows). No `Apply <label>.` stubs; no dangling `and.`.
2. Write 3 (or 4) `choices` that are each a **complete clause**, grammatical
   from the first word. Exactly one is correct; distractors are
   plausible-but-wrong (a real misreading), not fragments or nonsense.
3. Set `correctIndex` to the genuinely correct choice. **Read it back**: the
   `explanation` must justify *that* choice specifically, naming why it's right
   and ideally why a tempting distractor is wrong. No shared explanation shell.
4. Keep the book's answer-position balance roughly even, but do not template a
   position pattern — let correctness drive the index, then check the spread.
5. Ground every factual claim in the source notes; invent nothing.

### Card-front composition rule
- The `front` is a **question or retrieval cue** that the existing `back`
  answers — not a prefix glued onto a copy of the back, and never truncated.
- Must be a complete sentence ending in real punctuation (no `... s.` cutoffs).
- Leading content words of the front should NOT simply echo the back (avoid the
  `C21.circular_back` minor): ask *for* the idea, don't restate it.

## Procedure
1. Reconstitute all 12 chapter JSONs from the package, copying the good fields
   verbatim. Confirm a `diff`-style check that only quiz + card fronts differ.
2. Rewrite quizzes and card fronts per the rules above.
3. After each chapter:
   `npx tsx src/cli.ts gate-chapter state/chapters/range-ch{NN}.v21-native.chapter.json`
   — must report **0 blockers** before moving on.
4. After all 12:
   `npx tsx src/cli.ts book-gate range` — must report **0 blockers**.

## Done condition
- All 12 quizzes fully rewritten; all 48 card fronts rewritten.
- Untouched fields verified byte-identical to the package.
- Per-chapter `gate-chapter`: 0 blockers. Book gate: 0 blockers.
- **Self-check the QC can't skip:** for 3 random questions per chapter, confirm
  `correctIndex` points at the truly correct choice and the explanation defends
  it. Report that you did this.

Report back: per-chapter blocker count, book-gate blocker count, and confirmation
of the answer-key self-check.

> Note for the operator: this defect is so uniform (108/108) that it points at
> the quiz/card-front generator slicing source substrings. If a first redo still
> yields `Apply <label>.` prompts or mid-word choices, stop patching and fix the
> generator / do a full Step-2 quiz pass — don't burn redo rounds on it.
