# Quality Memory — *Indistractable* v13 Run

## Chapter gate floor
- score at least 10/12 on the chapter-quality rubric
- no contamination phrases
- no plain-string scenario fields
- no identical tone objects
- no empty quiz in generate mode
- source sidecar must exist and stay traceable to the frozen source bundle

## Scored categories
1. Chapter specificity
2. Anchor use
3. Analytical value
4. Paragraph motion
5. Prose quality
6. Hook and bridge

## Auto-fail signals
- invented facts or unsupported details
- prose generic enough to fit another chapter
- hard depth = medium made longer
- source-splice leakage
- templated or interchangeable examples
- implementation plan that could fit almost any chapter
- quiz distractors so weak they are not tempting

## Schema reminders
- easy = exactly 3 takeaways, no moreDetails
- medium.selfCheckPrompt is singular
- hard.selfCheckPrompts is an array of exactly 2 tone objects
- all takeaway points and moreDetails are tone objects
- examples use the six canonical formats exactly once each
- review cards must be 2 easy / 2 medium / 1 hard
