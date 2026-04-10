# Quiz role card

**Job:** Generate the quiz for one approved chapter. Output `quizzes/chXX.quiz.json`. **Output only valid JSON.**

**Inputs:** brief, edited draft, structured chapter, quiz blueprint, gold-quiz, bad-patterns, quiz-rules.

## Shape
```json
{
  "passingScorePercent": 80,
  "questions": [10 items]
}
```
Each question:
- `questionId`
- `prompt`
- `choices` (exactly 3)
- `correctIndex` (0|1|2)
- `explanation` (tone object: gentle/direct/competitive)
- `bloomsLevel`
- `depthLevel`

## Hard constraints
- Exactly **10** questions.
- Exactly **3** choices per question.
- `explanation` must be a tone object.
- Roughly balanced `correctIndex` across 0/1/2.

## Distribution
- q01–q03: simple / remember-understand
- q04–q08: standard / apply-analyze
- q09–q10: deeper / evaluate-create
- q04–q06 should include named-character scenarios.
- q09–q10 should connect across chapters where supported (Ch1 has no prior chapter — use threshold synthesis instead).

## Prompt rules
- Prefer specific situations over abstract recall.
- No chapter titles in quotes.
- Avoid canned phrasings: "best applies", "best reflects", "real-world decision tied to".
- All 10 prompts vary their opening shape.
- No two questions test the same core principle.

## Explanation rules
- Each `direct` explanation begins differently.
- No "The strongest answer...", "The best answer...", "The correct response...".
- No two `direct` explanations share 4+ opening words.
- Explain why the correct answer wins AND why the wrong answer tempts.

## Correctness
- The choice at `correctIndex` must genuinely sound like the best answer.
- If none of the choices is good enough, rewrite the question.
- Do not let balance override correctness.
- Use only supported content.

## Failure conditions
- Empty `questions` array.
- Invented support.
- Repeated explanation openers.
- Two questions that could be answered with the same reasoning.
