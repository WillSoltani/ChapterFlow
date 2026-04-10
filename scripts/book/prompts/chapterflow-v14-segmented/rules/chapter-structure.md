#chapter-structure.md
You are converting an approved chapter into ChapterFlow structure.

Source of truth order:
1. chapter brief
2. edited draft
3. these rules

Do not invent new facts beyond the brief and edited draft.

## Core Principle

The converter is an adapter, not a writer of new truth.

- The edited draft is the approved prose source.
- The brief is the approved factual source.
- If the approved prose does not support a field, stay narrow rather than inventing.

## JSON Shape

```json
{
  "chapterId": "",
  "number": 0,
  "title": "",
  "readingTimeMinutes": 0,
  "contentVariants": { "easy": {}, "medium": {}, "hard": {} },
  "examples": [],
  "quiz": null,
  "implementationPlan": {},
  "reviewCards": [],
  "keyTakeawayCard": { "gentle": "", "direct": "", "competitive": "" }
}
```

## Depth Logic

### Easy

- chapterBreakdown: tone object
- 140 to 175 words per tone
- 2 paragraphs
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
- 3 to 4 paragraphs
- 5 to 6 keyTakeaways
- each has `point` + `moreDetails`
- `activationPrompt` required
- `selfCheckPrompt` singular tone object required
- oneMinuteRecap has `retrieve`, `connect`, `preview`

### Hard

- chapterBreakdown: tone object
- 490 to 600 words per tone
- 4 to 5 paragraphs
- 5 to 7 keyTakeaways
- each has `point` + `moreDetails`
- `activationPrompt` required
- `selfCheckPrompts` array of exactly 2 tone objects required
- `predictionPrompt` required
- oneMinuteRecap has `retrieve`, `connect`, `preview`

## Functional Meaning Of Depth

Easy:
- orient and clarify
- give the cleanest version of the idea

Medium:
- explain and apply
- show how and why it works

Hard:
- add tension, limitation, edge case, and synthesis
- must not be medium with extra words
- must include at least one genuine boundary condition, failure mode, or unresolved tension

## Breakdown Architecture

Across all depths, chapterBreakdowns should move like this:

- Hook: curiosity-first opening, never thesis-first
- Build: named people, concrete details, and tension. Place the chapter's hardest material here, not at the end
- Deliver: a clear insight at peak curiosity
- Bridge: close the current loop with a satisfying payoff, then open the next one. The reader should feel rewarded before being pulled forward

Every major section should contain:
- story
- evidence
- practical implication

## Functional Meaning Of Tone

Gentle:
- lowers resistance
- reflective, humane, calm

Direct:
- diagnoses clearly
- efficient and precise

Competitive:
- frames stakes, advantage, leverage, edge
- strategic, but not cartoonishly aggressive

Tone variation must be functional, not adjective swapping.

## Takeaway Rules

- takeaway `point` = insight, not practice
- `moreDetails` = conceptual expansion, not a vignette
- no fictional names in `moreDetails`
- no overlap between `moreDetails` and examples
- easy takeaways must not include `moreDetails`
- if two takeaways could be merged without loss, the set is too repetitive
- `moreDetails` should explain mechanism, nuance, or limitation, not tell a tiny story

## Example Rules

Default mode is 6 examples per chapter.
If the orchestrator deliberately chooses a reduced long-book mode, validator expectations must be kept in sync. Otherwise use 6.

Use formats exactly once:
- `decision_point`
- `postmortem`
- `dialogue`
- `predict_reveal`
- `dilemma`
- `before_after`

Use ending types exactly once:
- `broader_principle`
- `self_directed_question`
- `surprising_implication`
- `cross_domain`
- `common_trap`
- `perspective_reframe`

Category distribution:
- 2 `work`
- 2 `school`
- 2 `personal`

Each example must include:
- `exampleId`
- `title`
- `category`
- `format`
- `endingType`
- `contexts`
- `scenario`
- `whatToDo`
- `whyItMatters`

`scenario`, `whatToDo`, and `whyItMatters` must all be tone objects.

Dialogue rule:
- `scenario` must include at least 3 quoted exchanges

Scenario quality:
- 80 to 150 words
- at least 3 concrete details
- at least 1 sensory or emotional cue
- use assigned names only
- use assigned school setting, not generic defaults
- at least 1 imperfect or messy outcome somewhere in the chapter
- examples must not all share the same polished texture or emotional arc
- follow the chapter brief's format/category assignments exactly

## Implementation Plan

Must include:
- `coreSkill`
- 3 `ifThenPlans` for work / school / personal
- `twentyFourHourChallenge`
- `weeklyPractice`

All applicable fields are tone objects.
Must be specific to this chapter, not generic advice.

## Review Cards

Default mode is 5 review cards:
- 2 easy
- 2 medium
- 1 hard

Each card includes:
- `cardId`
- `front`
- `back`
- `difficulty`

`front` and `back` are tone objects.
Cards test application, not trivia.

## Key Takeaway Card

Summarize the chapter's central value in 2 to 3 sentences per tone.

## Cross-Chapter Rules

- Chapter 2+ should connect back to the previous chapter in medium and hard
- later chapters should synthesize earlier ideas where appropriate
- the final chapter should loop back to Chapter 1 when appropriate
- morally gray books should use strategic-awareness framing

## Banned Output Patterns

- no em dashes
- no banned filler phrases from `style/constraints.md`
- no generic filler
- no invented facts
- no tone collapse
- no depth collapse
- no chapter-generic implementation plans
- no fake analytical prestige added during conversion
- no repeated opening or closing sentence shapes within a chapter section
- no short closing sentence beginning with `It is`, `This is`, or `That is`

## Final Checks

Before writing JSON, verify:

- all required fields exist
- no field leakage between depths
- word counts are in range
- examples obey format and ending-type rotation
- dialogue example has quoted exchanges
- takeaways are insights, not instructions
- moreDetails are conceptual, not mini-stories
- moreDetails do not overlap with examples
- implementation plan is chapter-specific
- output is valid JSON
