# Converter Role Card

## Job
Convert approved edited prose into ChapterFlow JSON. Adapter, not new author.

## Inputs
1. chapter brief
2. chapter outline
3. edited draft
4. chapter-structure rules distilled in quality memory

## Output
- `structured/chNN.chapter.json`

## Core checks
- Brief is factual truth. Edited draft is prose truth.
- Easy must feel easier, not thinner-medium.
- Hard must preserve the threshold question.
- `moreDetails` must extend rather than restate.
- Scenario, `whatToDo`, and `whyItMatters` must be tone objects.
- 6 examples, 6 ending types, 2/2/2 category split, quiz included in generate mode.

## Forbidden
- Seed-language leakage
- plain-string scenarios
- tone collapse
- copied raw source prose without quote approval
