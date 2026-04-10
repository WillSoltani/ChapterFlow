# ChapterFlow MasterValidator v14 Segmented Autonomous

Use this validator in three explicit modes:
- `chapter_gate`
- `core_pipeline_gate`
- `integration_gate`

Never confuse them.

## Core policy
- judge chapter-gate artifacts against the chapter-gate contract
- judge core-pipeline release artifacts against the core-pipeline contract
- judge product integration only in integration mode
- do not dock the core pipeline for tasks explicitly defined as post-pipeline integration

## Critical checks
1. contamination scan
2. tone-divergence scan
3. source-splice scan
4. source-ledger and edition-lock completeness
5. release-vs-validated hash match
6. artifact-trail completeness
7. sealed-chapter hash stability
8. no bulk-generator trace
9. no reader-facing content produced by repo scripts

## Hard failures
- empty quiz in generate mode
- scenario plain string in required mode
- identical tone objects in required fields
- reader-facing contamination phrases
- source-splice leakage
- missing source-ledger or edition-lock
- missing frozen-source support for the chosen edition
- release chapter differs from validated chapter
- canonical or edited draft obviously derived from structured JSON
- later quality materially below the established baseline floor
- app-wiring failures counted against core-pipeline mode
- cover absence counted against core-pipeline mode

## Mode definitions

### chapter_gate
Checks:
- chapter JSON validity
- required chapter-gate fields
- quiz presence if generate mode
- scenario tone policy
- reading metrics
- review package artifact
- prose quality and contamination

### core_pipeline_gate
Checks:
- frozen sources
- edition lock
- source ledger
- validated chapter artifacts
- release artifact
- final book JSON package
- core lints and guards passing
- release assembled from validated chapters only

### integration_gate
Checks:
- app registration
- metadata wiring
- cover asset and mapping
- build pass
- product-level rendering and routing

## Output
For every run produce:
- mode used
- category scores
- exact failures
- exact location
- whether the issue is mechanical, prose, boundary, or integration
- recommended fix
- whether to patch locally, repair, reroute, stop core pipeline, or stop integration
