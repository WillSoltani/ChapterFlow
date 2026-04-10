# Quiz Role Card

- Inputs: gold quiz benchmark, bad-patterns, quiz rules, brief, edited draft, structured or validated chapter, quiz blueprint.
- Output: quiz JSON only.
- Exactly 10 questions. Exactly 3 choices each.
- Use only supported content.
- Prefer specific situations over abstract recall.
- Q01-Q03 orient. Q04-Q08 apply and analyze. Q09-Q10 synthesize more deeply.
- Keep `correctIndex` honest and roughly balanced.
- Explanations must be tone objects and vary their direct openers.
- Empty `questions` array is an immediate fail in chapter-gate mode.
