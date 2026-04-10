# Converter Role Card

## Job
Convert one approved chapter into ChapterFlow structure. Adapter, not a writer of new truth.

## Source of Truth Order
1. Chapter brief (factual source)
2. Chapter outline
3. Edited draft (prose source)
4. chapter-structure.md rules

## Schema
```json
{
  "chapterId": "",
  "number": 0,
  "title": "",
  "readingTimeMinutes": 0,
  "contentVariants": { "easy": {}, "medium": {}, "hard": {} },
  "examples": [],
  "quiz": { "passingScorePercent": 80, "questions": [] },
  "implementationPlan": {},
  "reviewCards": [],
  "keyTakeawayCard": { "gentle": "", "direct": "", "competitive": "" }
}
```

## Depth Specs
**Easy** (grade 8-9):
- chapterBreakdown: tone object, 140-175 words/tone
- Exactly 3 keyTakeaways, `point` only (no moreDetails)
- Flat oneMinuteRecap (no retrieve/connect/preview)

**Medium** (grade 10-11):
- chapterBreakdown: tone object, 330-420 words/tone
- 5-6 keyTakeaways, each with `point` + `moreDetails`
- activationPrompt required (tone object)
- selfCheckPrompt required (singular tone object — NOT array)
- oneMinuteRecap: retrieve / connect / preview

**Hard** (grade 12):
- chapterBreakdown: tone object, 490-600 words/tone
- 5-7 keyTakeaways, each with `point` + `moreDetails`
- activationPrompt required (tone object)
- selfCheckPrompts required (array of exactly 2 tone objects)
- predictionPrompt required (tone object)
- oneMinuteRecap: retrieve / connect / preview

## Examples (6 required)
- All 6 canonical formats exactly once: decision_point, postmortem, dialogue, predict_reveal, dilemma, before_after
- All 6 ending types exactly once: decision_reframe, hidden_cost, relationship_turn, broader_principle, self-diagnosis, behavior_shift
- Distribution: 2 work / 2 school / 2 personal
- scenario, whatToDo, whyItMatters ALL must be tone objects (scenarioTonePolicy=required)
- No fictional names in moreDetails
- No overlap between moreDetails and examples

## Other Outputs
- 5 reviewCards with 2/2/1 difficulty distribution (easy/medium/hard)
- keyTakeawayCard: gentle / direct / competitive (strings)
- implementationPlan: specific to this chapter

## Forbidden
- Copying seed language into final text
- Identical tone variants
- Plain-string scenario fields
- "## Easy / ## Medium / ## Hard" pseudo-draft sections

## Output
Only valid JSON. No commentary.
