# Quality Memory — compact

Compiled from the v13 rules and frozen for this run.

## Chapter-quality rubric (must score >= 10/12)
1. Chapter specificity
2. Anchor use
3. Analytical value
4. Paragraph motion
5. Prose quality
6. Hook and bridge

## Auto-fails
- Invented facts, quotes, stories, or unsupported doctrine.
- Generic prose that could fit any self-help chapter.
- Thesis-first opener or recap-like ending.
- Hard depth that merely stretches medium.
- Empty quiz in generate mode.
- Plain-string scenarios in required mode.
- Tone collapse, source-splice leakage, or unsupported examples.

## Structure contract
- Easy: 140-175 words per tone, exactly 3 takeaways, no `moreDetails`.
- Medium: 330-420 words per tone, 5-6 takeaways, `activationPrompt`, singular `selfCheckPrompt`, recap object.
- Hard: 490-600 words per tone, 5-7 takeaways, `activationPrompt`, exactly 2 `selfCheckPrompts`, `predictionPrompt`, recap object, preserved threshold question.

## Example contract
- 6 examples by default.
- 6 canonical formats exactly once.
- 6 ending types exactly once.
- 2 work / 2 school / 2 personal.
- `scenario`, `whatToDo`, and `whyItMatters` are all tone objects.

## Quiz contract
- Exactly 10 questions, exactly 3 choices each.
- `correctIndex` is 0, 1, or 2.
- Explanation is a tone object.
- q01-q03 remember/understand.
- q04-q08 apply/analyze.
- q09-q10 evaluate/create.
- q04-q06 use named-character scenarios.
- No duplicated principle coverage.

## Source and continuity rules
- Every chapter needs source sidecars before writing.
- Source sidecars must come from the frozen bundle, not memory.
- Quotes are effectively heading-only unless wording is reproduced in the freeze.
- Track names and school settings in continuity.

## Book-specific guardrails
- Because the source bundle is lawful but thin, claims must stay narrow and chapter-local.
- The strongest supported themes are choice, task separation, inferiority, belonging, contribution, and the present moment.
- Reader-facing prose must avoid pop-psych inflation, trauma-denial overclaiming, or moral certainty beyond the frozen support.
