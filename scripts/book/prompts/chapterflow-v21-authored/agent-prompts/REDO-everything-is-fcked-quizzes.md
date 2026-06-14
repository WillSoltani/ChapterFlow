# Redo everything-is-fcked — quizzes only

You are doing **one specific edit in every chapter: rewrite the quiz question
content. Nothing else changes.** The chapter prose, examples, review cards,
plans, hooks, takeaways, IDs, and source-grounded structure are coherent and
must be preserved.

## What you change

1. `quiz.questions[*].prompt`
2. `quiz.questions[*].choices`
3. `quiz.questions[*].correctIndex`
4. `quiz.questions[*].explanation`

Keep the existing number of quiz questions per chapter.

## What you do NOT change

- `chapterId`, `number`, `title`, `readingTimeMinutes`
- `hook`
- `counterintuition`
- `tryThisNow`
- `keyTakeaway`
- `breakdown.fastRead`, `breakdown.deepRead`, `breakdown.fullRead`
- `examples[*]`
- `reviewCards[*]`
- `implementationPlan`
- `memorableLines`
- `quiz.passingScorePercent`
- `quiz.questions[*].questionId`
- `quiz.questions[*].bloomsLevel`
- `quiz.questions[*].depthLevel`

## Why this redo exists

Deterministic gates passed, but semantic QC found the quiz field is corrupted.
The book-wide gate reported 0 blockers and 7 majors, including repeated quiz
prompt opener shells (`BP16`) across all 9 chapters. A raw-content read then
found a more serious defect the gates did not catch: quiz prompts, choices, and
explanations are polluted with salting fragments like `via river edge`,
`via amber frame`, `via tide grain`, and similar tokens. This makes the quizzes
unshippable even when the apparent answer key often points to the intended
choice. Measured scope: **80/81 quiz items affected** and **1,818 `via ...`
fragments** across the 9 chapter JSONs.

### Verbatim broken output (do NOT reproduce this shape)

Ch01 Q1:

```text
PROMPT: In the Warsaw, via river edge, archive room case,, via amber frame, what does Witold, via daring frame, Pilecki most need, via granite frame, the learner to, via juniper frame, notice?.
[0]* Witold Pilecki reveals, via river edge, the costly pressure, via amber frame, behind The Uncomfortable, via daring frame, Truth, so the, via granite frame, learner should keep, via juniper frame, action tied to, via marble frame, that pressure..
[1] Warsaw archive room, via ivory frame, would be misread, via lantern frame, as proof that, via opal frame, drama can replace, via river frame, judgment whenever morale, via amber grain, drops..
EXPL: Warsaw archive room, via ivory frame, keeps Witold Pilecki, via lantern frame, severe; the other, via opal frame, answers drain the, via river frame, source pressure into, via amber grain, pep talk or, via daring grain, dilution..
```

Ch05 Q3:

```text
PROMPT: A skeptic in, via harbor hinge, Cancer appointment says, via keel hinge, amor fati means, via north hinge, indulging whatever emotion, via quartz hinge, arrives. Which reply, via tide hinge, is best?.
[2]* Emotion matters because, via juniper insight, it drives behavior,, via marble insight, but amor fati, via plain insight, still asks for, via signal insight, trained meaning and, via brisk judgment, mature limits..
EXPL: Cancer appointment exposes, via signal hinge, the bad reading:, via brisk insight, amor fati trains, via ember insight, emotion through meaning, via harbor insight, without crowning impulse, via keel insight, or erasing feeling..
```

Ch09 Q5:

```text
PROMPT: Which response would, via river judgment, corrupt AI as, via amber keystone, final religion inside, via daring keystone, School essay?.
[2]* Using AI as, via tide keystone, final religion to, via clear limit, protect a favored, via flint limit, narrative from facts, via ivory limit, that would embarrass, via lantern limit, it..
EXPL: School essay would, via ivory keystone, corrupt the idea, via lantern keystone, by protecting convenience., via opal keystone, A sound use, via river keystone, lets Deep Blue, via amber limit, embarrass the preferred, via daring limit, narrative..
```

Symptoms to eliminate: every `via <word> <label>` fragment; doubled punctuation
introduced by salting; repeated prompt shells at fixed question positions;
generic "source pressure / pep talk / dilution" explanation shells; choices that
only differ by swapped names.

## Files

- Chapter JSONs to modify:
  `state/chapters/everything-is-fcked-ch{NN}.v21-native.chapter.json`
  (`NN = 01..09`)
- Source notes per chapter:
  `.chapterflow/runs/everything-is-fcked/20260601-083510/sidecars/source/ch{NN}.source.json`
- Book toc:
  `.chapterflow/runs/everything-is-fcked/20260601-083510/source-freeze/toc.json`

## Rules

### Quiz composition rule

1. Write each `prompt` as a complete, grammatical, answerable question about a
   real idea, named case, distinction, or practical implication from this
   chapter. The prompt must stand alone without source-salting fragments.
2. Write each `choices` array as complete grammatical choices. Exactly one
   choice is correct. Distractors should be plausible misreadings from the
   chapter, not nonsense, fragments, or swapped-name templates.
3. Set `correctIndex` after writing the choices, not from a fixed pattern.
   Read the selected choice back against the chapter source and explanation.
4. Write `explanation` to justify the selected answer specifically. It should
   name why the correct choice is right and, when useful, why a tempting
   distractor fails.
5. Ground factual claims in the source notes and the chapter's existing
   breakdown/examples. Do not invent new named examples.
6. Vary question shape by chapter and by position. Do not reuse the book-wide
   opener shells flagged by `BP16`: `A skeptic in`, `Which response would`,
   `A tense exchange`, `A mentor builds`, `What conclusion keeps`,
   `Someone wants a`.
7. Preserve approximate answer-position balance across the book, but do not
   force a repeating `0,1,2` pattern.

## Procedure

1. Work chapter by chapter from `ch01` through `ch09`.
2. For each chapter, rewrite only `quiz.questions[*].prompt`, `choices`,
   `correctIndex`, and `explanation`.
3. After each chapter, run:
   `npx tsx src/cli.ts gate-chapter state/chapters/everything-is-fcked-ch{NN}.v21-native.chapter.json`
   It must report 0 blockers before moving on.
4. After all chapters, run:
   `npx tsx src/cli.ts book-gate everything-is-fcked`
   It must report 0 blockers.
5. Run a literal contamination check:
   `grep -R "via .*\\(edge\\|frame\\|grain\\|hinge\\|insight\\|judgment\\|keystone\\|limit\\|measure\\|nerve\\|outline\\|pressure\\|question\\|reading\\|standard\\)" state/chapters/everything-is-fcked-ch*.v21-native.chapter.json`
   This must return no quiz-field contamination.

## Done condition

- All 81 quiz questions rewritten.
- Untouched fields verified unchanged.
- Per-chapter `gate-chapter`: 0 blockers for `ch01` through `ch09`.
- `book-gate everything-is-fcked`: 0 blockers.
- Contamination check finds no `via <word> <label>` fragments in quiz content.
- Semantic self-check: for every chapter, read at least 3 rewritten questions
  and confirm `correctIndex` points to the truly correct choice and the
  explanation defends that same choice. Report which question IDs were checked.

Report back: per-chapter blocker count, book-gate blocker count, contamination
check result, and answer-key self-check IDs.
