#quiz-rules.md
Generate quiz content only after the chapter is approved.

Use only:
- chapter brief
- edited draft
- validated chapter

Do not invent facts for the sake of making a better question.

## Quiz Shape

```json
{
  "passingScorePercent": 80,
  "questions": [10 items]
}
```

Each question must include:
- `questionId`
- `prompt`
- `choices`
- `correctIndex`
- `explanation`
- `bloomsLevel`
- `depthLevel`

## Hard Constraints

- exactly 10 questions
- exactly 3 choices per question
- `correctIndex` must be 0, 1, or 2
- `explanation` must be a tone object

## Distribution

- q01 to q03: simple / remember-understand
- q04 to q08: standard / apply-analyze
- q09 to q10: deeper / evaluate-create
- roughly balanced `correctIndex` across 0, 1, 2

## Prompt Rules

- prefer specific situations over abstract recall
- do not put chapter titles in quotes
- avoid canned phrasings like `best applies`, `best reflects`, `real-world decision tied to`
- q04 to q06 should include named-character scenarios
- q09 to q10 should connect across chapters where the chapter content supports it; if the chapter references or builds on a previous chapter's principle, use that connection
- all 10 prompts should vary their opening shape
- no two questions should test the same core principle; if two prompts could be answered with the same reasoning, rewrite one to test a different aspect of the chapter

## Explanation Rules

- each `direct` explanation should begin differently
- no `The strongest answer...`
- no `The best answer...`
- no `The correct response...`
- no repeated opener patterns
- no two direct explanations should share 4 or more opening words
- explain why the correct answer wins and why the wrong answer tempts

## Correctness Rules

- the choice at `correctIndex` must genuinely sound like the best answer
- if none of the choices are good enough, rewrite the question
- do not let the desire for balance override actual correctness

## Final Checks

- 10 questions
- 3 choices each
- no invented support
- no repeated explanation openers
- correct answers actually sound best
- deeper questions synthesize or transfer, not just recall
- no two questions test the same principle
- at least 1 of q09 to q10 connects to a previous chapter where supported