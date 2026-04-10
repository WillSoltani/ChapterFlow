# ChapterFlow MasterValidator v19

This validator has two jobs:
1. validate artifact quality
2. validate provenance

## Chapter artifact checks
Use the existing schema and craft rules from:
- `rules/chapter-quality-gate.md`
- `rules/chapter-structure.md`
- `rules/quiz-rules.md`
- `rules/validator-rules.md`

Additionally fail if any of these appear in learner-facing content:
- internal instruction phrases like `keep the prose narrow and concrete`
- `used lazily, the point turns into`
- `keep this question alive`
- `reading calibration`
- `threshold question`
- raw source splice that is not an approved quote

Also fail on:
- duplicate or leftover schema surfaces
- identical or near-identical tone variants
- empty quiz
- plain-string scenarios in flagship mode
- conceptual repetition where medium/hard restate rather than deepen

## Provenance checks
A chapter cannot pass without:
- brief
- outline
- canonical draft
- edited draft
- critic report
- structure partial
- scenario partial
- quiz JSON
- assembled structured chapter
- validation report
- valid receipts for all stages
- successful chapter commit

A release cannot pass without:
- committed chapter records for every chapter
- exact release equality to committed validated chapters
