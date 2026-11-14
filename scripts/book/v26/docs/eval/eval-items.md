# W1c lesson-first eval — items

Every item is yes/no. **Type:** `det` = deterministic (0 calls), `judge` = blind Opus 5.5 judge (`judge.md`), `solver` = model solver, `owner` = only the owner can decide.
Judges see only the chapter's reader-visible fields with field ids (no version name, no notes, no labels). Versions are run one per call in a shuffled order.

| Item | LF- | Type | Test (pass when…) | Aggregate / target |
|---|---|---|---|---|
| lesson / singleLesson | SPINE | judge | the judge can state one lesson in ≤20 words and the chapter teaches one lesson | reported |
| OPENER-hook | OPENER, INTEREST | judge | the hook makes a beginner curious and points to the lesson; no plain author fact or dated scene | must pass |
| OPENER-<tier> | OPENER | judge | the same for the first 1–2 sentences of fastRead / deepRead / fullRead | 3/3 |
| ARC-<tier> | ARC | judge | in any natural order: an opening, the problem widened, the book's evidence in plain words (its story, or the author's method in one everyday case), the lesson stated plainly near the end; a real person or case from the book is told so a reader could retell it (who, what they did or what happened, how it ended, and at least one concrete detail: a number, a place, a thing, a line said) and tied to the lesson; a real case told in one vague clause, or left with no link to the lesson, fails (clause added 2026-11-13) | 3/3 |
| END-<tier> | INTEREST, ARC | judge | the tier ends on the lesson with a payoff, not a flat recap or a story detail | 3/3 |
| PLAIN-summary / PLAIN-rest | PLAIN | judge | everyday words, short clear sentences, hard words only when needed and explained; PLAIN-summary also fails on a loose aside that nothing sets up and nothing follows, or on a stilted swap for a common word ("a doctor of the mind") (clause added 2026-11-13) | both |
| D-READ-summary | PLAIN | det | Flesch–Kincaid grade of each tier in band **4.0–8.5** (floor lowered 2026-11-10: short sentences are wanted) | reported band |
| D-READ-rest | PLAIN | det | FK grade of examples + quiz + cards + tryThisNow ≤ 8.5 | reported band |
| COUNTER | SPINE | judge | counterintuition names a common wrong belief the lesson corrects | pass |
| TRY | TRY | judge | one small concrete action today that applies the lesson, nothing else (no retelling, no moral, no standing rule); fails if the reader would have to stage a fake situation to do it, or if it only works for a reader who happens to have something today that many readers do not (a crush, a certain hobby, a quarrel in progress) (clause added 2026-11-13) | pass |
| LINES-1 | LINES | judge | memorable line 1 is the lesson as one memorable, useful sentence | pass |
| EX-<ex> | EXAMPLES | judge | short simple modern everyday situation, one idea, lesson clearly applies | AGG-EX: ≥ 2/3 of examples (target 3/3) |
| EXFIT-<ex> | EXAMPLES | judge | whatToDo and whyItMatters speak to that example's own situation | AGG-EXFIT: ≥ 2/3 (target 3/3) |
| VARY-examples | EXAMPLES | judge | compares what each example has the person do (whatToDo); passes when at least one example calls for a clearly different move, or shows a case where the usual move is not enough or does not fit; fails when every example ends in the same move in new words, even when the settings, the stakes or the mistakes differ (added 2026-11-13 after the six-books reader audit) | counts in the score; holds the book when it fails in half the chapters |
| D-EX-LEN | EXAMPLES, SIMPLE | det | every example scenario ≤ 75 words | target |
| QUIZ-<q> | QUIZ | judge | tests understanding or use of the lesson; not answerable by story recall | AGG-QUIZ: ≥ 80% (target 7/7) |
| TEMPT-<q> | QUIZ | judge | at least one wrong choice is something a sensible person who has not read the chapter might really pick; fails when both wrong choices are silly, extreme or the plain "try harder" kind (added 2026-11-10 after the blind reader comparison) | counts in the score; weak when half fail |
| KEY-<q> | QUIZ | judge | the keyed choice is the only sound answer; the judge first argues for each wrong choice as a careful reader would; fails when a wrong choice can still be defended (sensible advice the chapter gives no reason against in this situation, or the chapter's own advice in other words); the chapter's own move used at the wrong moment, in the wrong order or overdone is a fair wrong choice as long as the question shows why it is wrong here; also fails when a "what most likely happens" or "what follows" question has facts that do not force the keyed outcome, or when the keyed choice or the explanation leans on a fact about the situation that the question never gives (added 2026-11-13 after the six-books reader audit) | counts in the score; weak when half fail |
| TELL-<q> | QUIZ | judge | the right choice cannot be found by its wording alone; fails when the keyed choice is the only one that repeats the chapter's own phrase or slogan (keyTakeaway, a memorable line, the summary), the only one that mentions the lesson's subject at all, the only specific one among vague ones, or clearly the longest, or when the question's own wording hands over the answer (added 2026-11-13 after the six-books reader audit) | counts in the score; weak when half fail |
| VARY-quiz | QUIZ | judge | the questions test different sides of the lesson (when to use it, why it works, what goes wrong without it, a hard case, a case where it does not apply); fails when in most of them the right choice is the same move in new words, so a reader who remembers only the chapter's slogan could pick them all without thinking (added 2026-11-13 after the six-books reader audit) | counts in the score; holds the book when it fails in half the chapters |
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

TEMPT and TELL can both fail on a question whose own wording gives the answer away; that overlap is accepted.

A test chapter is "done" only when every blocking item passes and every judge/det target passes; anything else is reported as FAIL with evidence.
Single-run judge noise (measured 2026-11-13 on two runs of the same 12 chapters, see `calibration.md`): on items whose wording was the same in both runs, 39 of 648 verdicts flipped (6.0%). TELL is the noisiest new item: 13 of 84 flipped (15%); END, an old item, flipped 8 of 36. A chapter's score moved 2.6 points on average, 8.6 at most. So a single-item gain or loss is treated as noise until it repeats.
