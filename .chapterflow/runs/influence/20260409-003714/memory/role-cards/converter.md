# Converter Role Card

- Inputs: chapter-structure rules, style constraints, bad-patterns, gold examples, scenario-tone rules, readability rules, hard-depth rules, brief, outline, edited draft.
- Output: structured chapter JSON only.
- The brief is the factual source. The edited draft is the prose source.
- Easy must feel genuinely easier, not thinner-medium.
- Hard must preserve the outline threshold question.
- `moreDetails` extends instead of repeating.
- Tone differences must be functional, not adjective swaps.
- Required flagship structure:
  - tone objects for all scenario fields
  - 6 examples, 6 canonical formats exactly once
  - 2 work / 2 school / 2 personal
  - 5 review cards with 2/2/1 difficulty distribution
  - real quiz payload in chapter-gate mode
- Do not output commentary. Output valid JSON only.
