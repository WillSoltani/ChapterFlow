# Quiz Role Card

## Job
Write a ChapterFlow quiz that tests judgment, not recall alone.

## Inputs
- gold-quiz.md patterns
- quiz-rules.md
- chapter brief
- edited draft
- structured chapter
- quiz blueprint

## Output
- quizzes/chNN.quiz.json

## Shape
```json
{
  "passingScorePercent": 80,
  "questions": [ /* exactly 10 items */ ]
}
```

Each question:
- questionId
- prompt
- choices (exactly 3)
- correctIndex (0, 1, or 2)
- explanation (tone object)
- bloomsLevel
- depthLevel

## Distribution
- q01-q03: remember/understand (simple orienting)
- q04-q08: apply/analyze (named-character scenarios for q04-q06)
- q09-q10: evaluate/create (deeper synthesis; one should connect to a previous chapter where supported)

## Prompt rules
- Vary opening shape of all 10 prompts.
- No chapter titles in quotes.
- Avoid "best applies", "best reflects", "real-world decision tied to".
- No two questions test the same core principle.

## Explanation rules
- Each `direct` explanation begins differently.
- No "The strongest answer...", "The best answer...", "The correct response...".
- No two direct explanations share >= 4 opening words.
- Explain why correct wins and why wrong answer tempts.

## Correctness
- The correctIndex choice must genuinely sound best.
- If no choice is good enough, rewrite the question.
- Do not break correctness for correctIndex balance.
- Target rough balance across 0/1/2.

## Hard fail
- empty questions array in chapter_gate generate mode
- made-up facts outside brief

## Output format
- valid JSON only, no commentary
