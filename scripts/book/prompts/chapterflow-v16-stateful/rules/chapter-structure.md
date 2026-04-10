
# Chapter Structure

You are converting an approved chapter into ChapterFlow structure.

Source of truth order:
1. chapter brief
2. edited draft
3. these rules

Do not invent new facts beyond the brief and edited draft.

## Core Principle

The converter is an adapter, not a writer of new truth.

## JSON Shape

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

## Depth Logic

### Easy
- chapterBreakdown: tone object
- 140 to 175 words per tone
- exactly 3 keyTakeaways
- each takeaway has `point` only
- no `moreDetails`
- no `activationPrompt`
- no `selfCheckPrompt`
- no `selfCheckPrompts`
- no `predictionPrompt`
- oneMinuteRecap is a flat tone object

### Medium
- chapterBreakdown: tone object
- 330 to 420 words per tone
- 5 to 6 keyTakeaways
- each takeaway has `point` + `moreDetails`
- `activationPrompt` required
- singular `selfCheckPrompt` required
- oneMinuteRecap has `retrieve`, `connect`, `preview`

### Hard
- chapterBreakdown: tone object
- 490 to 600 words per tone
- 5 to 7 keyTakeaways
- each takeaway has `point` + `moreDetails`
- `activationPrompt` required
- `selfCheckPrompts` array of exactly 2 tone objects
- `predictionPrompt` required
- oneMinuteRecap has `retrieve`, `connect`, `preview`

## Functional meaning of depth
- Easy: orient and clarify
- Medium: explain and apply
- Hard: add tension, limit, or synthesis

## Example Rules

Default flagship mode uses 6 examples.
Use formats exactly once:
- decision_point
- postmortem
- dialogue
- predict_reveal
- dilemma
- before_after

Use ending types exactly once:
- broader_principle
- self_directed_question
- surprising_implication
- cross_domain
- common_trap
- perspective_reframe

Category distribution:
- 2 work
- 2 school
- 2 personal

Each example must include:
- exampleId
- title
- category
- format
- endingType
- contexts
- scenario
- whatToDo
- whyItMatters

`scenario`, `whatToDo`, and `whyItMatters` are all tone objects.

## Quiz
Flagship mode expects a real quiz at chapter gate:
- passingScorePercent
- questions array of 10
- 3 choices each
- correctIndex 0/1/2
- explanation tone object
- bloomsLevel
- depthLevel

## Implementation Plan
Must include:
- coreSkill
- 3 ifThenPlans
- twentyFourHourChallenge
- weeklyPractice

## Review Cards
Exactly 5:
- 2 easy
- 2 medium
- 1 hard

## Reading time
Estimate from the actual chapter payload, not from guesswork.
