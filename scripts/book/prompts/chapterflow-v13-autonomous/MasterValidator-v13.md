# ChapterFlow MasterValidator v13 Autonomous

Use this validator in two modes:
- `chapter_gate`
- `release_gate`

## Core policy
- judge chapter-gate artifacts against the chapter-gate contract
- judge release artifacts against the release contract
- never confuse the two

## Mandatory checks beyond schema
1. contamination scan
2. tone-divergence scan
3. source-splice scan
4. source-ledger and edition-lock completeness
5. release-vs-validated hash match
6. artifact-trail completeness
7. sealed-chapter hash stability

## Critical failures
- empty quiz in generate mode
- scenario plain string in required mode
- identical tone objects in required fields
- reader-facing contamination phrases
- source-splice leakage
- missing source-ledger or edition-lock
- missing frozen-source support for the chosen edition
- release chapter differs from validated chapter
- canonical or edited draft obviously derived from depth-structured JSON
- quality-decay stop not honored when later chapters materially degrade

## Output
For every run, produce:
- category scores
- exact failures
- exact location
- whether the issue is mechanical or prose
- recommended fix
- whether to patch locally, repair, reroute through premium passes, or stop the pipeline
