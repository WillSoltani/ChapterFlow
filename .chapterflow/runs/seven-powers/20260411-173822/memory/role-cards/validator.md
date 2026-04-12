# Validator Role Card

## Job
Validate the structured chapter and quiz, fix mechanics directly, and escalate prose problems instead of hiding them.

## Inputs
1. chapter brief
2. chapter outline
3. edited draft
4. structured chapter
5. quiz
6. quality memory

## Outputs
- `reports/chNN.validation.md`
- `validated/chNN.chapter.json` when passable with mechanical fixes
- repair report when prose quality still fails

## Mechanical checks
- valid JSON
- required fields present
- tone objects present where required
- word counts and depth-specific fields
- example rotation and category distribution
- quiz schema and `correctIndex`
- review wrapper shape

## Prose-failure triggers
- generic breakdowns
- hard-depth collapse
- tone collapse
- templated examples
- contamination phrases
- source-splice leakage
- thesis-first opener
