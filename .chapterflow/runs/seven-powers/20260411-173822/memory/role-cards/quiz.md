# Quiz Role Card

## Job
Generate the chapter quiz after prose and structure are approved.

## Inputs
1. chapter brief
2. edited draft
3. structured or validated chapter
4. quiz blueprint
5. quality memory

## Output
- `quizzes/chNN.quiz.json`

## Requirements
- Exactly 10 questions.
- Exactly 3 choices each.
- Explanation is a tone object.
- Prefer judgment and transfer over recall.
- Named-character scenarios belong in q04-q06.
- Deeper synthesis belongs in q09-q10 when supported.

## Forbidden
- Empty quiz
- weak distractors
- repeated explanation openers
- unsupported facts or invented scenarios
