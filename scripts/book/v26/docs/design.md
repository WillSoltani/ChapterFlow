# v26 lesson-first chapter design

## Decision: a tweak, not a redesign

- **The vote.** Three Opus designs (minimal, lesson step, redesign) were scored by three judges.
  - The simplicity and learning-science judges picked **minimal**, scoring it 4/5/4/4 (gain/simplicity/cost/risk).
  - The owner-proxy judge picked lesson step, scoring it 4/3/4/4 and minimal 3/5/4/3.
  - All three ranked redesign last (4/2/3/2).
- **Why minimal.** Phase 0 traced the failure to W1's *brief*: it framed the story as the product, set the hook as "a scene", had the quiz "test the story" and had no lesson field. All three designs expected the same gain from the same lesson-first field rules, so the one with the fewest new stages wins.
- **The concern I accept from the owner proxy.** Find/replace fixes cannot repair a wrong lesson. A wrong lesson therefore triggers one writer rerun. Lesson step's separate card call is the fallback if the test chapters' lessons are bad.
- Full designs and scores: `~/cf-wt/v26-plan/scratch/W1c/design/`.

## Chapter flow (W1's proven calls, new brief)

| # | Step | Model / effort |
|---|---|---|
| 1 | **Write.** Lesson-first brief + book section + chapter header (earlier chapters' lessons: "teach none of these again") + source span. The JSON is written **lesson first**: `_lesson`, keyTakeaway, counterintuition, hook, tryThisNow, memorableLines, examples, implementationPlan, quiz, reviewCards, then the three tiers and the title. The exercises are fixed by the lesson before any story is told. | Opus 5.5 high |
| 2 | **Code checks** (0 calls). Blocking: BRIEF §4.1/4.3 (validator, verbatim quotes, walls, chatter), keyTakeaway = `_lesson.lesson`, ≤ 20 words. Reported: outside-fact patterns (%, 4-digit years, "study/research shows") in invented fields; `_lesson.storyNames` in quiz and cards; near-verbatim keyTakeaway repeats (≤ 2); FK grade per tier; field lengths; key spread / key-longest; overlap with earlier lessons. | — |
| 3 | **Fact check v3** + **blind key solver** + **cold reader** (fastRead only) + **no-chapter solver** (q1–q5, 3 runs), in parallel | Opus high; Sonnet medium; Sonnet low; Sonnet medium |
| 4 | If the lesson is rated STRETCHED/UNSUPPORTED (or duplicates an earlier lesson): **rerun step 1 once** with the reason. Otherwise **one fix call** on all flags (find/replace + key changes), then steps 2–3 again. | Opus high |
| 5 | Stop after 2 fix rounds and 1 rerun; anything still open goes to the owner as an open issue. | — |

`_lesson` is a sidecar the tool removes before validation and assembly; readers never see it. It holds: `lesson`, `wrongBelief`, `keyPhrase` (2–4 words that other fields reuse instead of repeating the whole sentence), `hookQuestion` (the gap the hook opens; the lesson answers it), `storyNames`, and `evidence` (1–3 verbatim source passages that support the lesson).

## Field contracts

Everywhere: plain words (grade 6–8; sentences average 12–18 words, none over 25; a hard word explained where it first appears; never chopped to pass a score). No outside facts, no "in this chapter" talk. The keyTakeaway's exact wording appears in at most 2 other fields; elsewhere, use `keyPhrase`.

| Field | Job | Shape | Passes when |
|---|---|---|---|
| hook | open the question the lesson answers | ≤ 40 words: everyday scene, puzzle, contrast or question | concrete, about the reader's life; no author, date, statistic or teaser; form varies by chapter |
| counterintuition | correct the wrong belief | ≤ 45 words, "Many people think X. Actually Y, because Z." | X is a belief beginners hold; it ends on Y |
| keyTakeaway | the one lesson | 8–20 words, present tense, no names | fact check: SUPPORTED |
| tryThisNow | one action today | ≤ 40 words, starts with a verb | says when/where plus a short why; no retelling, no moral |
| fastRead / deepRead / fullRead | teach the lesson alone | 150–220 / 350–500 / 800–1,100 words; paragraphs ≤ 140 | opener → problem and why X feels true → story as evidence (plain words, one bridge sentence) → lesson in the last fifth; author quotes 0–1 / 1–2 / 2–4, verbatim |
| memorableLines | the line worth keeping | line 1 ≤ 15 words; lines 2–3 optional | line 1 is the lesson in fresh words; lines 2–3 are the author's verbatim words carrying the same lesson |
| examples ×3 | the same move in three parts of life | scenario 40–75 words; whatToDo ≤ 35; whyItMatters ≤ 30 | one person at one decision where the wrong belief tempts them; work / school / personal; whatToDo and whyItMatters speak to that person (Y's form, shorter) |
| quiz ×7 (3 choices) | use the lesson | stem ≤ 30 words; explanation ≤ 40 | a new modern situation, no story names; one wrong choice acts out the wrong belief, the other is a sensible near-miss; no length tells; keys spread; explanation names the part of the lesson used |
| reviewCards ×5 | recall weeks later | front ≤ 25, back ≤ 30 words | front is a situation or "why does this work?", no names; back is the move plus a reason; at most 1 card asks for the lesson itself |
| implementationPlan | practice (Y's form) | coreSkill ≤ 20; 2 × "When [moment], then I [action]" | cues are specific moments, never "tomorrow"; the 24-hour challenge is bigger than tryThisNow |
| title | name the problem | ≤ 60 characters | not a caption of a story scene |

## What the fact check covers (v3)

- **Story:** W1's five error hunts (WHO, WHY, WHEN/ORDER, HOW MUCH, WORDS) run over the tiers, quotations and any sentence about the author's world. Bridge sentences that give the author a motive he never states count as errors.
- **Lesson:** keyTakeaway is checked against its evidence passages and the whole span. It is rated SUPPORTED, STRETCHED or UNSUPPORTED by asking whether the author would recognise this as his point. In a memoir, the author's own stated reflection wins.
- **Invented fields** (hook, examples, quiz, cards, plan) are checked only for historical claims and outside facts.
- **Modern quiz keys:** the checker applies the lesson to each situation. It flags a key it would not pick, a second choice the lesson also allows, or a false explanation.

## Solvers

- **Blind key solver (blocking).** It sees, as in W1, the hook, counterintuition, fastRead, lines, tryThisNow and example 1 for q1–q5, and all tiers for q6–q7. Applying the lesson to a new situation counts as "in the text". A wrong pick, a second defensible choice or NOT IN TEXT goes to the fix call.
- **No-chapter solver (reported).** It sees only q1–q5 and runs 3 times, because a pure guesser scores ≥ 3/5 about 21% of the time. Questions right in ≥ 2 runs go to the fix call ("make the wrong belief more tempting"). A median above 3/5 is a missed target.
- **Cold reader (reported).** It sees fastRead only, restates the lesson, and lists every word or reference it could not follow. The list goes to the fix call.

## What blocks a chapter

- **Blocking:**
  - BRIEF §4.3 render checks;
  - §4.1 facts and verbatim quotes (an outside fact in an invented field is a fact not in the source);
  - the lesson not rated SUPPORTED (LF-FAITHFUL);
  - a key disputed by the solver or the fact checker (§4.2).
- **Not blocking:** everything else is an eval target, judged by the calibrated eval (`docs/eval/`) and finally by the owner.
- **The eval judge is not in the fix loop by default.** Phase 5 first tries to meet the LF- bar with prompt changes alone. If an item still fails, a `--review` option sends the judge's failed items to the fix call, and that is reported.

## Cost

Using W1's measured costs:
- **Per chapter:** about 15 calls, 5–6 of them Opus, **$2.0–3.0**, 8–12 minutes.
- **A writer rerun** adds about $1.
- **W2, all 19 chapters:** about $45–55.

## Taken from the other designs, and what was dropped

- **From lesson step:** the lesson code checks, protected lesson fields (a fix may not change keyTakeaway or memorableLines[0] unless the lesson was flagged), and the 2-round cap. Its separate card call stays the fallback.
- **From redesign:** the writer rerun for a bad lesson, the cold reader, the outside-fact screen, exercises written before the tiers, and "never chop sentences".
- **Dropped:**
  - **The rare-word frequency screen** (all three judges asked for it). No word-frequency list is available offline, and installs are off-limits in this checkout. The cold reader covers the same principle (research #9).
  - **The script-appended "next chapter" bridge.** It would edit an already-checked chapter. Each tier ends on its own lesson payoff instead (research #7).
  - **Minimal's "turn it to the reader's week" tier ending.** It repeats tryThisNow.

## Risks Phase 5 watches

1. **The lesson is a caption of the best scene, or a cliché.** Check the judge's and cold reader's restatement against keyTakeaway, and show the owner the lessons.
2. **Rules dropped from a long brief.** Count code-check failures per rule. A rule broken in both test chapters moves into code or is cut.
3. **Guessable quizzes.** If the no-chapter median is above 3/5 in both tuning chapters, strengthen the wrong-belief distractor in the brief.
4. **Ambiguous modern keys, and chapters that sound alike.** Track second-defensible flags and repeated openings.
5. **Preachy repetition.** D-REPEATS ≤ 2, plus keyPhrase reuse instead of the full sentence.

## Revision 1 (after Phase 5 tuning rounds 1–3)

What three rounds on Franklin ch01 and ch13 showed (details: `phase5-rounds.md`):
- **The LF- judge items are met.** Both chapters scored 34–35 of 35 in every round (W1's prototype scored 11/35). The changes that moved items were all prompt changes: the tier ending (END) and the quiz choice form.
- **The no-chapter solver is not a fair proxy for a beginner when the lesson agrees with common morality.**
  - On ch01 ("check the means": a useful plan still needs honest steps), Sonnet scored 5/5 without the chapter in every sample. This held even after the choices were made equal in length (the max/min length ratio fell from about 2.2 to 1.1).
  - The one quiz it could not guess (ch13, round 1) was one where it actually believed the wrong belief.
  - So the measure stays reported, not tuned against. Gaming it (for example a weaker solver) would hide the problem instead of fixing it.
- **Two causes of late blocking leftovers.**
  - (a) A fix call that simplified a fact-bearing word ("sixpence" → "a few pennies") created a HOW MUCH error.
  - (b) Last-round quiz rewrites for guessability created a second defensible answer.
- **The ch01 fullRead kept adding a second episode** (Peter Folger's signed poem) that teaches a nearby virtue, not the lesson. The judge failed SPINE on it in 2 of 3 samples.

Changes:
1. `fix.md`: keep a fact-bearing hard word and explain it; never swap a fact for a vaguer one.
2. `write.md`: fullRead may add a second episode only if it shows exactly the same lesson.
3. `pipeline.ts`: the last allowed fix round sends only the blocking issues when there are any. Reported items stay as owner leftovers instead of risking new blockers.

These are a prompt tweak and a loop rule. No stage was added.
