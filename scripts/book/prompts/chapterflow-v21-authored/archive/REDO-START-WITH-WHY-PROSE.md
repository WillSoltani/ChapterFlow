# Redo Start With Why — breakdown + example whatToDo/whyItMatters + quiz correctIndex

You are rewriting four fields per chapter in the **Start With Why** book
package, across all 14 chapters. Everything else stays as written.

## Fields to rewrite (per chapter)

1. `breakdown.fastRead`   — full text
2. `breakdown.deepRead`   — full text
3. `breakdown.fullRead`   — full text
4. Every `examples[i].whatToDo`     — full text (6 examples × 14 chapters)
5. Every `examples[i].whyItMatters` — full text (6 examples × 14 chapters)
6. The quiz `correctIndex` of each question — pick a new slot per question (rules below)

## Fields you must NOT touch

- `hook`, `counterintuition`, `tryThisNow`, `keyTakeaway`, `chapterId`, `number`, `title`, `readingTimeMinutes`
- `examples[i].scenario`, `examples[i].title`, `examples[i].tags`, `examples[i].planSpec`, `examples[i].exampleId`
  (the scenarios were already rewritten in the prior pass and grounded in Sinek's named cases — they pass AS9)
- `quiz.questions[i].prompt`, `quiz.questions[i].choices`, `quiz.questions[i].explanation`, `quiz.questions[i].bloomsLevel`
  (only `correctIndex` changes; the prompt + choices stay)
- `reviewCards[]`, `implementationPlan`, `memorableLines`

---

## Why this redo exists

The previous Step-2 pass and the AS9 examples redo both shipped 14
chapters that passed the per-chapter ship gate but failed the book gate
with **302 blockers**. The failure pattern, in order of damage:

### 1. BP13 (288 blockers) — Stock-phrase rotation in `whatToDo` / `whyItMatters`

The writer agent used three rotating stock-phrase groups in the
`whatToDo` and `whyItMatters` fields, keyed by chapter modulo:

```
Group A (Ch 1, 4, 7, 10, 13): "practical pattern recognition, moving from"
                              "is the practical edge of"
                              "the leader works on the cause"
                              "than a phrase to admire"
                              "rather than a phrase to"

Group B (Ch 3, 6, 9, 12):     "hiring, marketing, culture, or operations"
                              "not what worked once, but"
                              "it starts with the reason"
                              "once, but what belief the"

Group C (Ch 2, 4, 6, 8, 10, 12, 14):
                              "practical pressure visible but refuses"
                              "refuses to let it define"
                              "treats the named case as"
                              "buyer will read from the"
                              "is narrower, but it keeps"
                              "what counts as a good"

Group D (Ch 1, 2, 3, 4, 5, 6):
                              "easy answer and a harder"
                              "has to choose whether to"
                              "the stronger move is to"

Group E (Ch 1, 3, 5, 7, 9, 11, 13):
                              "refuses to let a useful tactic"
                              "let a useful tactic stand in"
                              "tactic stand in for a"
                              "stand in for a reason"
                              "the group can repeat the"
```

The trick was: any two adjacent chapters share <70% word overlap, so
AS9 (multiset similarity) passed. But the same 5-token phrases recur
verbatim across 4–7 chapters, which BP13 catches at book gate.

A new chapter-time critic (`AS10`) was added to the pipeline. It fires
**BLOCKER** when any 5-token content phrase in your `whatToDo` or
`whyItMatters` appears verbatim in ≥2 prior chapters' same field.

### 2. BP10 + BP11 (5 blockers) — Templated breakdown paragraphs

A single ~280-char closing paragraph appears **verbatim in all 14**
chapters' `fullRead`:

```
"In the next meeting, ask what the current action proves. If it proves only
speed, comfort, fear, novelty, or habit, pause. If it proves the cause and
helps people act from it, continue. The work does…"
```

Four additional breakdown paragraph skeletons (263–345 chars) are
templated across all 14 chapters with tiny variable slots. A new
chapter-time critic (`AS11`) fires **BLOCKER** when any breakdown
paragraph (≥60 chars) appears verbatim in any prior chapter's
breakdown.

### 3. E2 (42 majors, now blockers) — All three tiers open with the same first sentence

In every chapter, the three breakdown tiers (`fastRead`, `deepRead`,
`fullRead`) open with the identical first sentence. Example Ch1:

```
fastRead → "A factory line can make a crooked car door look fine with a rubber mallet…"
deepRead → "A factory line can make a crooked car door look fine with a rubber mallet…"
fullRead → "A factory line can make a crooked car door look fine with a rubber mallet…"
```

The tiers must progress, not echo. `E2` was upgraded to **BLOCKER** so
chapters cannot ship with identical openers across tiers.

### 4. BP14 (1 blocker) — Identical quiz answer-position sequence

All 14 chapters share quiz `correctIndex` `[0, 1, 2, 0, 1, 2, 0, 1, 2]`.
A reader who notices the pattern can guess answers without engaging
with the questions. A new chapter-time critic (`AS12`) fires
**BLOCKER** when the current chapter's `correctIndex` sequence matches
any prior chapter's.

---

## Files

- **Chapter JSONs to modify** (EDIT):
  `scripts/book/prompts/chapterflow-v21-authored/state/chapters/start-with-why-ch{NN}.v21-native.chapter.json`
  for NN = 01..14.

- **Source notes per chapter** (READ — your raw material):
  `.chapterflow/runs/start-with-why/20260521-062153/sidecars/source/ch{NN}.source.json`
  Each sidecar has `namedExamples`, `centralConcept`, `hardEdge`,
  `keyClaims`, `paraphraseNotes`. Use these to compose chapter-specific
  prose.

- **Book toc** (READ — voice charter):
  `.chapterflow/runs/start-with-why/20260521-062153/source-freeze/toc.json`
  Use `authorVoice.signatureMoves` + `authorVoice.avoidMoves` to
  preserve Sinek's plainspoken third-person register.

---

## Rules

### Breakdown tiers (fastRead / deepRead / fullRead)

- The three tiers must each open with a **different first sentence**.
  `fastRead` opens with the chapter's anchoring scene + the rule
  derived from it. `deepRead` opens with the mechanism (why the rule
  works — what the source assumption / belief is). `fullRead` opens
  with a third angle — limits, a contrasting case, or scope-of-
  applicability ("this works when X; it does not work when Y").
- No paragraph in any tier can appear verbatim or near-verbatim in any
  other chapter's breakdown. Each paragraph must be specific to THIS
  chapter's source notes.
- The three tiers within ONE chapter must layer content: `deepRead`
  extends `fastRead` with mechanism + a second scene; `fullRead`
  extends `deepRead` with a third angle + limits. They do NOT share
  paragraphs or open with the same sentence.
- Word budgets (approximate): `fastRead` ~200 words, `deepRead` ~500
  words, `fullRead` ~900 words. Match the prior versions' lengths.

### Example whatToDo + whyItMatters

For each of the 6 examples × 14 chapters = 84 (whatToDo, whyItMatters)
pairs:

- The `whatToDo` text must reflect the move shown in THAT scenario,
  using THIS chapter's central-concept terminology. It is one or two
  sentences.
- The `whyItMatters` text must explain why this move beats the obvious
  alternative, in THIS chapter's terms. It is one or two sentences.
- **No stock phrase can be reused** across chapters. Read the Group A-E
  banned-phrase lists above; do not write any of those phrases or their
  close variants. If you find yourself writing "the practical edge of",
  "easy answer and a harder one", "treats the named case as", "refuses
  to let a useful tactic" — stop, rewrite the sentence with different
  connective language.
- A safer composition method: open each `whatToDo` with the **named
  protagonist's** action verb in present tense ("Anika tests…", "the
  plant manager refuses…", "the marketing lead splits…"). This forces
  per-chapter variation in surface words. Open each `whyItMatters`
  with the **claim** ("Belief precedes behavior. When the …", "Source
  assumptions determine which questions are legible. A team that …").
- Each chapter's `whyItMatters` block must use vocabulary from THIS
  chapter's `centralConcept.name` / `centralConcept.plainDefinition`
  and `hardEdge` (in the source sidecar). Ch1's whyItMatters talks
  about "source assumptions"; Ch3's talks about "the Golden Circle —
  WHY → HOW → WHAT"; Ch11's talks about "celery test". The terminology
  is the strongest anchor for chapter-specificity.

### Quiz correctIndex per chapter

- Each chapter has 9 quiz questions, each with 3 choices indexed 0/1/2.
- Across each chapter's 9 questions, the correctIndex distribution
  must be reasonably balanced — no more than 4 questions on any one
  index (so 3-3-3, 4-3-2, 4-2-3, 2-4-3, etc. are all acceptable; 5-2-2
  or 6-2-1 are not).
- **Each chapter's full 9-element sequence must be different from
  every other chapter's**. Do not use `[0,1,2,0,1,2,0,1,2]` or its
  rotations in more than one chapter.
- For each question, pick the index based on **which choice (0/1/2)
  is most appropriate for THIS question**. Don't follow a rotation;
  read the existing prompt + choices and decide which is the strongest
  correct answer placement. If the existing `choices` ordering puts
  the obvious-wrong answer first, the correct should be position 1 or
  2; if the choices are roughly equally plausible, any position works
  and you should vary by chapter.
- Important: do NOT reorder the `choices` array. Only change the
  `correctIndex` integer. The choices themselves stay in their current
  positions because they were the original ordering passed by the
  prior pass.

---

## Procedure

Work chapter by chapter, in order (Ch1, then Ch2, then Ch3 …). For each:

1. Read the chapter's source sidecar and the chapter JSON. Note the
   `centralConcept.name`, `hardEdge`, `namedExamples`, and the existing
   scenario, prompt, and choices.

2. Rewrite `breakdown.fastRead` first — open with the chapter's
   anchoring scene + the rule, ~200 words. Single sentence opener
   sufficient to be distinct from the other two tiers.

3. Rewrite `breakdown.deepRead` — open with the mechanism (WHY the
   rule works in this chapter's terms), then a second scene, ~500
   words. First sentence MUST differ from `fastRead`.

4. Rewrite `breakdown.fullRead` — open with a third angle (limits,
   scope, or contrasting case), then extend, ~900 words. First sentence
   MUST differ from `fastRead` AND `deepRead`. Do not paste any
   paragraph from another chapter or from `deepRead` of this chapter.

5. For each of the 6 examples in this chapter, rewrite `whatToDo` and
   `whyItMatters`. Do not touch `scenario`, `title`, `tags`, `planSpec`,
   or `exampleId`.

6. Rewrite `quiz.questions[i].correctIndex` for each of the 9 questions
   so the sequence is balanced and differs from all prior chapters'
   sequences.

7. Write the chapter JSON back. Preserve 2-space indent + trailing
   newline.

8. Run the chapter ship gate:

```bash
cd scripts/book/prompts/chapterflow-v21-authored
npx tsx src/cli.ts gate-chapter state/chapters/start-with-why-ch{NN}.v21-native.chapter.json
```

   It must report **0 blockers**. If AS10 / AS11 / AS12 / E2 fire,
   rewrite the offending field. Do not retry with surface edits — the
   gate-attempt tracker will flag stuck-blocker patterns after 3
   attempts.

9. Move to the next chapter.

After all 14 chapters pass `gate-chapter`, run the book gate:

```bash
npx tsx -e "
import { runBookGate, formatBookGateReport } from './src/critics/bookGate.js';
import { readFileSync, readdirSync } from 'node:fs';
const files = readdirSync('state/chapters').filter(f => f.startsWith('start-with-why-')).sort();
const chs = files.map(f => JSON.parse(readFileSync('state/chapters/' + f, 'utf8')));
console.log(formatBookGateReport(runBookGate('start-with-why', chs)));
"
```

It should report **0 blockers**. If BP13 / BP14 / BP10 / BP11 still
fire, the field that triggered the book-gate finding has the same
templating in the chapter you just rewrote — go back and rewrite it.

---

## Done condition

- All 14 chapter JSONs have rewritten `breakdown.fastRead`,
  `breakdown.deepRead`, `breakdown.fullRead`, all `examples[i].whatToDo`,
  all `examples[i].whyItMatters`, and updated `correctIndex` per
  question.
- `scenario`, `hook`, `quiz prompts/choices/explanations`, `reviewCards`,
  `implementationPlan`, `memorableLines`, `keyTakeaway`,
  `counterintuition`, `tryThisNow` are unchanged.
- `gate-chapter` reports 0 blockers on every chapter.
- Book gate reports 0 blockers.

Report back with: per-chapter blocker counts at the start (should all
be 0 after each chapter is rewritten), the book gate's blocker count
(should be 0), and the total word counts for the three breakdown tiers
across all 14 chapters (sanity check).

Do not run finalization or promote-book — that comes after QC.
