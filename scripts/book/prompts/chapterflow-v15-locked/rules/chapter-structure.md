# Chapter Structure Rules

The converter adapts approved prose into ChapterFlow structure.
It is not a writer of new truth.

Source of truth order:
1. chapter brief
2. chapter outline
3. edited draft
4. these rules

## Core rule
If the approved prose or brief does not support a field, stay narrow instead of inventing.

## Chapter JSON shape
Each chapter must include:
- chapterId
- number
- title
- readingTimeMinutes
- contentVariants.easy
- contentVariants.medium
- contentVariants.hard
- examples
- quiz
- implementationPlan
- reviewCards
- keyTakeawayCard

## Easy
- chapterBreakdown tone object
- 140 to 175 words per tone
- exactly 3 takeaways
- takeaways use `point` only
- no moreDetails
- no activationPrompt
- no selfCheckPrompt
- no selfCheckPrompts
- no predictionPrompt
- oneMinuteRecap is a flat tone object

## Medium
- chapterBreakdown tone object
- 330 to 420 words per tone
- 5 or 6 takeaways
- each takeaway has point + moreDetails
- activationPrompt required
- singular selfCheckPrompt required
- oneMinuteRecap = retrieve / connect / preview tone objects

## Hard
- chapterBreakdown tone object
- 490 to 600 words per tone
- 5 to 7 takeaways
- each takeaway has point + moreDetails
- activationPrompt required
- selfCheckPrompts array of exactly 2 tone objects
- predictionPrompt required
- oneMinuteRecap = retrieve / connect / preview tone objects
- must preserve the hard-edge / threshold question

## Examples
Default mode is 6 examples per chapter:
- 2 work
- 2 school
- 2 personal

Formats exactly once:
- decision_point
- postmortem
- dialogue
- predict_reveal
- dilemma
- before_after

Ending types exactly once:
- broader_principle
- self_directed_question
- surprising_implication
- cross_domain
- common_trap
- perspective_reframe

Each example must include:
- exampleId
- title
- category
- format
- endingType
- contexts
- scenario tone object
- whatToDo tone object
- whyItMatters tone object

Scenario quality:
- 80 to 150 words
- at least 3 concrete details
- at least 1 sensory or emotional cue
- follow assigned names and setting plan
- each scenario teaches a different application

## Quiz
Default final shape:
- passingScorePercent = 80
- 10 questions
- 3 choices each
- correctIndex 0/1/2
- explanation tone object
- bloomsLevel
- depthLevel

## Implementation plan
Must include:
- coreSkill tone object
- 3 ifThenPlans
- twentyFourHourChallenge tone object
- weeklyPractice tone object

Must be chapter-specific.

## Review cards
- exactly 5 cards
- 2 easy
- 2 medium
- 1 hard
- front tone object
- back tone object

## Contamination bans
Do not let:
- internal notes
- reading-calibration phrases
- source-sidecar instructions
- raw source text
- brief scaffolding
appear in any reader-facing field.
