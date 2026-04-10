# Release-gate rules

Release gate belongs to the core generation pipeline.
It ends when the final book JSON package exists and all required generation guards pass.

## Required outputs
- frozen sources
- edition lock
- source ledger
- validated chapter artifacts
- release artifact
- final book JSON package
- final validation reports

## Release gate must verify
- final package is assembled only from validated chapters
- release chapter hashes match validated chapter hashes
- required lints and validators pass
- no contamination or source-splice leakage remains

## Release gate must not include
- app registration
- library wiring
- cover creation or mapping
- build fixing
- UI verification
Those belong to post-pipeline integration.
