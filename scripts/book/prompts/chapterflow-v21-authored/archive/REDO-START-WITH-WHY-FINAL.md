# Redo Start With Why — final pass: scenarios + correctIndex

You are doing TWO specific edits in every chapter of **Start With Why**.
Nothing else changes. This is the cleanup pass; after this the book
ships GREEN.

## What you change

1. **Every `examples[i].scenario`** — rewrite to remove the stock
   connective phrases listed below.
2. **Every `quiz.questions[i].correctIndex`** — set per the
   per-chapter sequence in the table below. You may also need to
   reorder the `choices[]` array within each question.

## What you do NOT change

`hook`, `counterintuition`, `tryThisNow`, `keyTakeaway`,
`examples[i].whatToDo`, `examples[i].whyItMatters`,
`examples[i].title`, `examples[i].tags`, `examples[i].planSpec`,
`examples[i].exampleId`, `breakdown.*`, `reviewCards[]`,
`implementationPlan`, `memorableLines`, `quiz.questions[i].prompt`,
`quiz.questions[i].explanation`, `quiz.questions[i].bloomsLevel`,
`chapterId`, `number`, `title`, `readingTimeMinutes`.

The breakdown / whatToDo / whyItMatters were rewritten in the
previous pass and they're good. Don't touch them.

---

## Part 1 — Scenario stock-phrase removal

### The problem

The AS9 redo regenerated all 14 chapters' `examples[*].scenario`
text, but the agent that did it leaked stock decision-scene
connectives across many scenarios. The book gate now reports 82
verbatim 5-token phrases shared across chapters — all from
`examples.scenario`. Examples of the worst offenders:

```
"the team must decide whether"     appears in Ch 1,2,3,4,5,8,9,10,11,12,13
"points toward an easy answer"      appears in Ch 1,2,3,4,5,6
"hears the same proposal twice:"    appears in Ch 2,3,4,5,6,7
"The visible gain is tempting"      appears in Ch 3,4,5,6,7
"sees why the normal answer"        appears in Ch 4,5,6,7,8
"makes the answer look simple,"     appears in Ch 5,6,7,8,9
"the better decision is whether"    appears in Ch 6,7,8,9,10
"The visible gain is attractive"    appears in Ch 7,8,9,10,11
"the group must choose between"     appears in Ch 9,10,11,12,13,14
"gives the decision a named"        appears in Ch 1,3,4,5,12,13,14
"not a generic best practice."      appears in Ch 8,9,10,11,12,13
"gives a different test because"    appears in Ch 2,3,4,5
"hears the same proposal twice:"    appears in Ch 2,3,4,5,6,7
"group must choose between a"       appears in Ch 9,10,11,12,13,14
```

These are LLM-default connective tissue for "decision scenarios"
written in bulk. They were not present in the chapter source notes
— the agent inserted them as filler.

### Banned phrases — do not write any of these in any chapter's scenario

```
must decide whether to
must decide whether the
team must decide whether
group must decide whether
must choose between a
must choose between the
must choose whether to
group must choose between
points toward an easy answer
toward an easy answer
easy answer and a harder
easy answer and a more
hears the same proposal twice
hears the same proposal again
gives a different test because
gives a different test for
the visible gain is tempting
the visible gain is attractive
visible gain is tempting
visible gain is attractive
sees why the normal answer
why the normal answer would
makes the answer look simple
makes the choice look obvious
the better decision is whether
better decision is whether to
gives the decision a named
decision a named case
not a generic best practice
not a generic best answer
group has to decide whether
group has to choose between
```

If you find yourself writing any of these phrases, stop and pick
different wording for THIS scenario. Use the named example from the
chapter's source sidecar as the spine of the scenario, not a
decision-template skeleton.

### Composition rules

For each `examples[i].scenario` (6 examples × 14 chapters = 84
scenarios):

1. **Anchor in the chapter's named example** from the source
   sidecar at
   `.chapterflow/runs/start-with-why/20260521-062153/sidecars/source/ch{NN}.source.json`.
   Read `namedExamples`, `centralConcept`, `hardEdge`, and
   `paraphraseNotes` first. Build the scenario as a concrete moment
   from or analogous to one of THIS chapter's named examples — not a
   generic "team faces a decision" set piece.

2. **Vary surface structure across chapters.** Don't open every
   scenario with "[Name] does X at Y time in Z place." Mix in:
   - past-tense recap: "The week after the launch, the founder…"
   - direct quote opener: '"We can ship Friday," the engineering
     lead tells the team. "Or…"'
   - data-first opener: "Defect rates had been climbing for three
     quarters when the plant manager…"
   - dialogue-led opener: "The CFO asks one question…"
   - place-first opener: "Inside the customer-success war room…"
   - role-action opener: "The board chair pauses the presentation…"

3. **Use the chapter's named example or its terminology in the
   scenario itself.** Ch1's scenarios should reference car-door
   assembly, pilot training, or hospital diagnosis cultures (the
   actual `namedExamples` in `ch01.source.json`). Ch3's scenarios
   should reference the Golden Circle, Apple, the Wright brothers
   (Sinek's named cases for the WHY/HOW/WHAT layer). Ch11's
   scenarios should reference the celery test. The chapter
   specificity comes from the **content** of the scenario, not from
   stock decision-scene language wrapped around an interchangeable
   protagonist.

4. **Length budget: 80–140 words per scenario.** Match the
   existing length roughly.

5. **Make sure `whatToDo` and `whyItMatters` still make sense.**
   The scenarios you rewrite need to lead naturally into the
   existing `whatToDo` (the action the protagonist takes) and the
   existing `whyItMatters` (the reason the action beats the
   alternative). Don't touch `whatToDo` / `whyItMatters` text, but
   if your new scenario makes them incoherent, you may rewrite the
   scenario to fit. The two should hang together.

---

## Part 2 — Quiz `correctIndex` per chapter

### The problem

Every chapter shipped with the same `correctIndex` sequence
`[0,1,2,0,1,2,0,1,2]`. The book gate's BP14 flags this as a
shipping blocker because a reader who notices the pattern can
guess answers without engaging with the questions. AS12 (chapter-
time) also fires.

### The assignment

For each chapter, set the 9 quiz questions' `correctIndex` to the
sequence in the table below. Each sequence is balanced (3 zeros,
3 ones, 3 twos) and all 14 are distinct from each other.

| Chapter | correctIndex sequence (Q1..Q9) |
|---|---|
| Ch1  | `[0, 1, 2, 0, 1, 2, 0, 1, 2]` |
| Ch2  | `[1, 2, 0, 1, 2, 0, 1, 2, 0]` |
| Ch3  | `[2, 0, 1, 2, 0, 1, 2, 0, 1]` |
| Ch4  | `[0, 2, 1, 0, 2, 1, 0, 2, 1]` |
| Ch5  | `[1, 0, 2, 1, 0, 2, 1, 0, 2]` |
| Ch6  | `[2, 1, 0, 2, 1, 0, 2, 1, 0]` |
| Ch7  | `[0, 0, 0, 1, 1, 1, 2, 2, 2]` |
| Ch8  | `[2, 2, 2, 1, 1, 1, 0, 0, 0]` |
| Ch9  | `[1, 1, 1, 2, 2, 2, 0, 0, 0]` |
| Ch10 | `[0, 1, 0, 2, 1, 2, 0, 1, 2]` |
| Ch11 | `[2, 0, 2, 1, 0, 1, 2, 1, 0]` |
| Ch12 | `[1, 2, 1, 0, 2, 0, 1, 2, 0]` |
| Ch13 | `[0, 2, 2, 1, 0, 1, 0, 2, 1]` |
| Ch14 | `[1, 0, 1, 2, 2, 0, 2, 1, 0]` |

### How to apply it

For each chapter:

1. The choices arrays were originally constructed so the correct
   answer sits at position `[0,1,2,0,1,2,0,1,2]`. That is, Q1's
   correct answer is currently at `choices[0]`, Q2's at
   `choices[1]`, Q3's at `choices[2]`, then it repeats.

2. For Ch1, do nothing — the assigned sequence is already in
   place.

3. For Ch2..Ch14, for each question `i`:
   - Identify the current correct answer: it's at
     `choices[currentCorrectIndex]`. Since the current sequence
     is `[0,1,2,0,1,2,0,1,2]`, the current correct position is
     `i % 3`.
   - The target position is the i-th entry in this chapter's
     target sequence (from the table above).
   - If `target == current`, do nothing for this question.
   - If `target != current`, **swap the choices** so the correct
     answer moves to the target position. Specifically: take the
     element at `currentCorrectIndex`, take the element at
     `targetIndex`, and swap them in the `choices` array. Set
     `correctIndex` to the target value.

4. Do not change the `explanation` text or the `prompt` text. Do
   not delete or add choices. Only swap positions of the existing
   three `choices` strings and update `correctIndex`.

### Why this method

The `explanation` field already references the content of the
correct answer (not its position), so swapping positions is safe
— the explanation still makes sense. The prompt is position-
agnostic. The choices themselves are content; their order in the
array is mechanical.

If, during this process, you notice that the current
`correctIndex` doesn't actually point to the correct answer (the
explanation references a different choice than the one at
`currentCorrectIndex`), surface that to the user as a separate
issue — don't fix it as part of this redo. You should expect
this to be rare.

---

## Procedure

For each chapter (Ch1 through Ch14), in order:

1. Read the chapter's source sidecar
   (`.chapterflow/runs/start-with-why/20260521-062153/sidecars/source/ch{NN}.source.json`)
   and the chapter JSON
   (`scripts/book/prompts/chapterflow-v21-authored/state/chapters/start-with-why-ch{NN}.v21-native.chapter.json`).

2. Rewrite each of the 6 `examples[i].scenario` blocks following
   the rules in Part 1. Verify none of the banned phrases appear.

3. Apply the `correctIndex` re-assignment per Part 2, including
   any `choices[]` swaps needed.

4. Write the chapter JSON back. Preserve 2-space indent + trailing
   newline.

5. Run the chapter ship gate:

   ```bash
   cd scripts/book/prompts/chapterflow-v21-authored
   npx tsx src/cli.ts gate-chapter state/chapters/start-with-why-ch{NN}.v21-native.chapter.json
   ```

   It should report `Ship gate: PASS` with **0 blockers**. If
   AS10 / AS12 fire, you reused a banned phrase or set a
   `correctIndex` that matches a prior chapter's sequence —
   re-read the rule and rewrite.

6. Move to the next chapter.

After all 14 chapters pass:

```bash
cd scripts/book/prompts/chapterflow-v21-authored
npx tsx -e "
import { runBookGate, formatBookGateReport } from './src/critics/bookGate.js';
import { readFileSync, readdirSync } from 'node:fs';
const files = readdirSync('state/chapters').filter(f => f.startsWith('start-with-why-')).sort();
const chs = files.map(f => JSON.parse(readFileSync('state/chapters/' + f, 'utf8')));
console.log(formatBookGateReport(runBookGate('start-with-why', chs)));
"
```

The book gate should report **0 blockers**.

---

## Done condition

- 84 `examples[i].scenario` blocks rewritten across the 14
  chapters. None of the banned phrases appear in any scenario.
- 14 chapters each have the assigned `correctIndex` sequence.
- `choices[]` arrays are reordered where required so the correct
  answer ends up at the target position.
- `whatToDo`, `whyItMatters`, `breakdown.*`, `reviewCards`,
  `implementationPlan`, `memorableLines`, `hook`, quiz `prompt`
  and `explanation` are unchanged.
- Per-chapter ship gate: 0 blockers on every chapter.
- Book gate: 0 blockers.

Report back: blocker count per chapter (should all be 0), book-gate
blocker count (should be 0), and a one-line sanity note ("scenarios
rewritten, correctIndex reassigned, all gates clean"). Do not run
finalization or `promote-book` — that's after QC sign-off.
