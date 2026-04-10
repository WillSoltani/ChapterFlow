# Quiz Rules

Quiz shape:
{
  "passingScorePercent": 80,
  "questions": [10 items]
}

Each question must include:
- questionId
- prompt
- choices
- correctIndex
- explanation tone object
- bloomsLevel
- depthLevel

## Hard constraints
- exactly 10 questions
- exactly 3 choices each
- correctIndex in 0..2
- explanations are tone objects
- questions array may not be empty in the default path

## Distribution
- q01-q03: remember / understand
- q04-q08: apply / analyze
- q09-q10: evaluate / create

## Content rules
- vary opening shapes
- no two questions test the same core principle
- at least one deeper question should synthesize or transfer
- use named scenarios where helpful
- explanations should say why the right answer wins and why the tempting wrong answer fails

## Balance rules
- roughly balance correctIndex across 0 / 1 / 2
- do not sacrifice correctness for cosmetic balance
