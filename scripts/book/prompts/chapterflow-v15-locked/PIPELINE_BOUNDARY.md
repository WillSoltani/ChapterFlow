# Pipeline Boundary

This pack runs end-to-end through:
- source discovery and freeze
- chapter generation
- validation
- release assembly
- repo registration / wiring
- build validation
- cleanup

It does not include cover generation.

## Included
- source discovery from the web
- edition/source lock
- source freeze artifacts
- validated chapter artifacts
- final release package
- repo package registration
- library / routing metadata updates where applicable
- build validation and code fixes related to the new package
- cleanup

## Excluded
- book cover generation
- generic placeholder cover generation
- image creation of any kind
- visual cover selection

If `manualCoverPath` is supplied in the manifest, the pipeline may wire that existing asset path.
It still may not generate the cover itself.
