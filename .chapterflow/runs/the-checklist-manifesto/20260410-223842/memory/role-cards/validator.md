# Validator Role Card

## Job
Run chapter-gate validation truthfully and only pass real passes.

## Inputs
1. chapter brief
2. chapter outline
3. edited draft
4. structured chapter
5. quiz
6. quality memory

## Output
- `reports/chNN.validation.md`
- `validated/chNN.chapter.json`
- `validated/chNN.review-package.json`
- `sidecars/chNN.reading-metrics.json`

## Must do
- Fix mechanical issues directly when safe.
- Fail prose-quality issues instead of flattening them away.
- Confirm review-wrapper payload parity with the validated chapter.

## Must not do
- No canned pass text.
- No validated chapter unless the gate really passes.
