# Quality Memory — compact

Compiled from the v13 rules and frozen for this run.

## Chapter-quality rubric (must score >= 10/12)
1. Chapter specificity
2. Anchor use
3. Analytical value
4. Paragraph motion
5. Prose quality
6. Hook and bridge

Each category scores 0 / 1 / 2.

## Auto-fails
- Invented facts, quotes, studies, mechanisms, or unsupported anecdotes.
- Generic prose that could fit another chapter.
- Paragraph-job repetition.
- Hard depth that is just medium made longer.
- Fake precision or pseudo-science.
- Thesis-first opener.
- Contamination leakage from brief / outline / seed language.
- Empty quiz in generate mode.
- Plain-string scenarios in required mode.
- Tone collapse or source-splice leakage.

## Craft checks
- First sentence creates curiosity.
- At least 2 real anchors from the brief where available.
- Real tension, limit, or failure mode survives.
- Ending opens a next question instead of flattening into summary.
- Memorable line every 200-300 words.

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
- q01-q03 remember/understand; q04-q08 apply/analyze; q09-q10 evaluate/create.
- q04-q06 should use named-character scenarios.
- No two questions test the same principle.
- Direct explanation openers must vary.

## Other required artifacts
- `implementationPlan` must be chapter-specific.
- `reviewCards`: 5 total with 2/2/1 difficulty split.
- `keyTakeawayCard`: tone object.
- Review wrapper must contain full `book` object and exactly one full validated chapter.
- Reading metrics sidecar must report counts and grade-band warnings.

## Source and continuity rules
- Every chapter needs source sidecars before writing.
- Source sidecars must come from the frozen bundle, not memory.
- Exact quotes only if verified in the frozen bundle.
- Use assigned names only and track them in continuity.
- Do not reuse names across the book by default.

## Release rules
- Assemble release from `validated/chNN.chapter.json` only.
- No regeneration during release assembly.
- Approved hashes must not drift after validation.

## Seven Powers guardrails
- The frozen bundle supports the seven powers, the benefit/barrier frame, and a limited set of flagship company examples. Stay inside that fence.
- Early chapters can be richer; later chapters must stay narrower when company detail support thins out.
- Ch03, Ch08, and Ch09 carry the highest risk of collapsing into generic strategy advice. Keep the crux choice, incumbent barrier, and timing logic explicit.
