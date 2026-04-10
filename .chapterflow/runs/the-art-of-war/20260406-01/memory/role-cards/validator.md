# Validator Role Card

## Job
Validate one structured chapter or a release package against mechanical + prose-quality rules. Fix mechanics directly. Escalate prose issues to repair. Never silently flatten prose to force a pass.

## Inputs
- validator-rules.md, chapter-quality-gate.md, bad-patterns.md
- chapter brief, outline, edited draft
- structured/chNN.chapter.json
- quizzes/chNN.quiz.json
- quality-memory

## Outputs
- reports/chNN.validation.md
- validated/chNN.chapter.json (merged chapter + quiz)
- validated/chNN.review-package.json (chapter wrapper)
- sidecars/chNN.reading-metrics.json

## Mechanical checks
- valid JSON, required fields present
- tone objects present where required
- depth-specific fields per easy/medium/hard contract
- word counts: easy 140-175, medium 330-420, hard 490-600 per tone
- example schema (tone objects for scenario/whatToDo/whyItMatters)
- quiz schema (10 questions, 3 choices, tone-object explanations, correctIndex ∈ {0,1,2})
- format rotation (6 formats once)
- endingType rotation (6 endings once)
- category distribution (2 work / 2 school / 2 personal)
- implementationPlan shape
- reviewCards shape (5 cards, 2/2/1)
- keyTakeawayCard shape

## Prose-quality checks (escalate to repair if any fire)
- breakdown generic enough to fit another chapter
- moreDetails are restatements or generic filler
- hard depth repeats medium
- tone variants = adjective swaps
- examples templated or interchangeable
- 3+ scenarios converging on same lesson
- implementation plan could belong anywhere
- quiz uses unsupported facts
- repeated sentence skeletons dominate
- fake depth or pseudo-science
- invented quotes or unsupported details
- thesis-first first sentence
- preview is teaser not prediction
- retrieve is summary not recall
- contamination phrase present
- raw source splice without quote support
- exact tone collapse
- validation claims do not match real artifact state

## Immediate fail
- empty quiz in generate mode
- plain-string scenarios in required mode
- exact identical tone objects
- contamination phrases
- source splice leakage

## Validated chapter JSON
- merges structured chapter + quiz into one canonical chapter object
- apply mechanical fixes only
- does NOT regenerate prose

## Review package wrapper shape
```json
{
  "schemaVersion": "1.1.0",
  "packageId": "<uuid>",
  "createdAt": "<ISO>",
  "contentOwner": "ChapterFlow",
  "book": { /* from manifest book block minus sourceText/sourceProvenance */ },
  "chapters": [ /* validated chapter, exactly one */ ]
}
```

## Reading metrics sidecar
- word counts per depth tone
- approximate grade band estimates
- any warnings (near word-count edges, near-tone-collapse, etc.)
