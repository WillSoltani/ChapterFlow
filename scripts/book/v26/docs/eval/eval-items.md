# W1c lesson-first eval — items

Every item is yes/no. **Type:** `det` = deterministic (0 calls), `judge` = blind Opus 5.5 judge (`judge.md`), `solver` = model solver, `owner` = only the owner can decide.
Judges see only the chapter's reader-visible fields with field ids (no version name, no notes, no labels). Versions are run one per call in a shuffled order.

| Item | LF- | Type | Test (pass when…) | Aggregate / target |
|---|---|---|---|---|
| lesson / singleLesson | SPINE | judge | the judge can state one lesson in ≤20 words and the chapter teaches one lesson | reported |
| OPENER-hook | OPENER, INTEREST | judge | the hook makes a beginner curious and points to the lesson; no plain author fact or dated scene | must pass |
| OPENER-<tier> | OPENER | judge | the same for the first 1–2 sentences of fastRead / deepRead / fullRead | 3/3 |
| ARC-<tier> | ARC | judge | opener → problem widened → story as evidence in plain words → lesson stated plainly near the end | 3/3 |
| END-<tier> | INTEREST, ARC | judge | the tier ends on the lesson with a payoff, not a flat recap or a story detail | 3/3 |
| PLAIN-summary / PLAIN-rest | PLAIN | judge | everyday words, short clear sentences, hard words only when needed and explained | both |
| D-READ-summary | PLAIN | det | Flesch–Kincaid grade of each tier in band **5.0–8.5** | reported band |
| D-READ-rest | PLAIN | det | FK grade of examples + quiz + cards + tryThisNow ≤ 8.5 | reported band |
| COUNTER | SPINE | judge | counterintuition names a common wrong belief the lesson corrects | pass |
| TRY | TRY | judge | one small concrete action today that applies the lesson, nothing else (no retelling, no moral, no standing rule) | pass |
| LINES-1 | LINES | judge | memorable line 1 is the lesson as one memorable, useful sentence | pass |
| EX-<ex> | EXAMPLES | judge | short simple modern everyday situation, one idea, lesson clearly applies | AGG-EX: ≥ 2/3 of examples (target 3/3) |
| EXFIT-<ex> | EXAMPLES | judge | whatToDo and whyItMatters speak to that example's own situation | AGG-EXFIT: ≥ 2/3 (target 3/3) |
| D-EX-LEN | EXAMPLES, SIMPLE | det | every example scenario ≤ 75 words | target |
| QUIZ-<q> | QUIZ | judge | tests understanding or use of the lesson; not answerable by story recall | AGG-QUIZ: ≥ 80% (target 7/7) |
| no-chapter solver | QUIZ | solver | Sonnet 5 sees only q1–q5 (no chapter); more than 3/5 right = too obvious | reported; target ≤ 3/5 |
| blind key solver | QUIZ (BRIEF §4.2) | solver | the new-reader solver picks every key | **blocking** |
| CARD-<rc> | CARDS | judge | tests the lesson or its use, not story trivia | AGG-CARDS: ≥ 80% (target 5/5) |
| PRACTICE | PRACTICE | judge | implementationPlan applies the lesson in Y's form | pass |
| SPINE | SPINE | judge | every part serves the same lesson, the parts connect, each adds something | pass |
| D-LESSON-LEN | lesson | det | keyTakeaway is 1–20 words | pass |
| D-REPEATS | SPINE | det | fields that repeat the keyTakeaway near-verbatim (≥ 50% of its word 4-grams): **≤ 2** | pass |
| facts + lesson grounding | FAITHFUL | judge (fact check) | story claims and the lesson's support verified against the source span (BRIEF §4.1) | **blocking** |
| verbatim quotes, validator, walls, chatter | FAITHFUL, render | det | BRIEF §4.1/§4.3 | **blocking** |
| curiosity, wanting the next chapter, overall "would publish" | INTEREST | owner | the owner's reading at R1c | final |

A test chapter is "done" only when every blocking item passes and every judge/det target passes; anything else is reported as FAIL with evidence.
Single-run judge noise: about 5% of items flip between identical runs (calibration below), so a single-item gain or loss is treated as noise until it repeats.
