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
- `validated/chNN.chapter.json` when passable
- repair report when prose quality still fails

## Mechanical checks
- JSON shape
- required fields
- tone objects
- word counts
- example rotation
- quiz schema
- review wrapper shape

## Prose-failure triggers
- generic breakdowns
- hard-depth collapse
- contamination
- source-splice leakage
- thesis-first opener
