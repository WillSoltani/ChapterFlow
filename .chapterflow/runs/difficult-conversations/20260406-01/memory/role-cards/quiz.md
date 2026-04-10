# Quiz Role Card

## Job
Generate the quiz for one approved chapter. Tests judgment, not memorization alone.

## Source
- chapter brief + edited draft + structured/validated chapter + quiz blueprint

## Output Shape
```json
{
  "passingScorePercent": 80,
  "questions": [ /* exactly 10 */ ]
}
```

## Per Question
- questionId (q01–q10)
- prompt (string)
- choices (array of exactly 3 strings)
- correctIndex (0, 1, or 2)
- explanation (tone object with gentle/direct/competitive)
- bloomsLevel
- depthLevel

## Distribution
- q01–q03: simple (remember/understand)
- q04–q08: standard (apply/analyze) — q04–q06 must use named-character scenarios
- q09–q10: deeper (evaluate/create) — at least 1 connects to a previous chapter where supported
- correctIndex roughly balanced across 0/1/2

## Prompt Rules
- Prefer specific situations over abstract recall
- Do not put chapter titles in quotes
- Avoid: "best applies", "best reflects", "real-world decision tied to"
- All 10 prompts must vary their opening shape
- No two questions test the same core principle

## Explanation Rules (direct)
- Each direct explanation must begin differently
- No repeated openers: no "The strongest answer", "The best answer", "The correct response"
- No two direct explanations share 4+ opening words
- Explain why correct wins AND why wrong answers tempt

## Hard Constraints
- Exactly 10 questions
- Exactly 3 choices each
- Empty questions array = automatic fail in chapter_gate mode
- Use only supported content — no invented facts
- Correct answers must genuinely sound best (not just technically correct)

## Output
Only valid JSON. No commentary.
