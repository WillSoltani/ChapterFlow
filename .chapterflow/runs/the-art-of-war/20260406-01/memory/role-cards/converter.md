# Converter Role Card

## Job
Convert approved edited draft into ChapterFlow structured JSON. Adapter, not a writer of new truth.

## Inputs (source-of-truth order)
1. chapter brief (factual)
2. chapter outline
3. drafts/edited/chNN.md (prose truth)
4. rules/chapter-structure.md
5. scenario-tone-rules.md, readability-rules.md, hard-depth-rules.md

## Output
- structured/chNN.chapter.json

## JSON shape
```json
{
  "chapterId": "chNN",
  "number": N,
  "title": "",
  "readingTimeMinutes": 0,
  "contentVariants": {
    "easy": { "chapterBreakdown": {tone}, "keyTakeaways": [...], "oneMinuteRecap": "flat" },
    "medium": { "chapterBreakdown": {tone}, "keyTakeaways": [...], "activationPrompt": {tone}, "selfCheckPrompt": {tone}, "oneMinuteRecap": { retrieve, connect, preview } },
    "hard": { "chapterBreakdown": {tone}, "keyTakeaways": [...], "activationPrompt": {tone}, "selfCheckPrompts": [{tone}, {tone}], "predictionPrompt": {tone}, "oneMinuteRecap": { retrieve, connect, preview } }
  },
  "examples": [ /* 6 total, see below */ ],
  "quiz": { "passingScorePercent": 80, "questions": [] },
  "implementationPlan": { ... },
  "reviewCards": [ /* 5 cards, 2/2/1 difficulty */ ],
  "keyTakeawayCard": { "gentle": "", "direct": "", "competitive": "" }
}
```

## Depth word counts (per tone)
- easy: 140-175 words
- medium: 330-420 words
- hard: 490-600 words

## Examples rules
- 6 by default
- all 6 canonical formats exactly once (decision_point, dialogue, dilemma, inner_monologue, contrast, vignette — or whatever format set the brief assigns)
- all 6 ending types exactly once
- 2 work / 2 school / 2 personal
- scenario, whatToDo, whyItMatters are tone objects (gentle/direct/competitive)

## Review cards
- 5 cards total, distribution 2 easy / 2 medium / 1 hard

## Forbidden
- copying seed/outline language into final text
- copying raw source excerpt into breakdown without quote ledger approval
- writing identical tone variants (auto-fail)
- plain-string scenario fields
- using pseudo-draft "## Easy / ## Medium / ## Hard" text as source prose
- inventing facts not in brief

## moreDetails discipline
- Must extend the point, not restate it.
- No overlap with examples.
- No fictional names in moreDetails.

## Tone differentiation checklist
- gentle/direct/competitive must differ in function (reassure vs mechanism vs stakes), not just adjectives
- lowercased + whitespace-normalized values must be 3 unique strings

## Output format
- valid JSON only, no commentary
