# ChapterFlow v14 Segmented Autonomous

ChapterFlow v14 keeps the high-quality prose-first spine, but makes the operating boundary explicit.

## The big change
v14 separates four things that had been getting blurred:

1. **Core autonomous content-generation pipeline**
2. **Autonomous post-pipeline product integration**
3. **Manual / recovery work**
4. **Post-release cleanup**

That boundary now controls the launcher, generator, validator, runbook, and cleanup policy.

## Core pipeline ends here
The core pipeline ends when these exist and pass:
- frozen sources
- edition lock and source ledger
- validated chapter artifacts
- release artifact
- final book JSON package
- required guards, lints, and validators

## What is now outside the core pipeline
Still useful, still optionally autonomous, but explicitly separate:
- app registration
- package exports
- library metadata wiring
- cover creation and cover mapping
- build and integration fixes
- UI-level verification

## What stays the same
- prose first, schema later
- chapter dossier is factual truth
- edited draft is prose truth
- writer -> editor -> critic -> converter -> quiz -> validator -> patch / repair
- no downstream invention beyond the brief
- no bulk content generators
- release assembled from validated chapters only

## Startup model
Required inputs:
- book title
- author

The run discovers sources online and asks only if edition or translation ambiguity materially changes the content contract.

## Main files
- `MasterGenerator-v14.md`
- `MasterValidator-v14.md`
- `QUICKSTART.md`
- `INSTALL.md`
- `REPO_RUNBOOK.md`
- `PIPELINE_BOUNDARY.md`
- `POST_PIPELINE_INTEGRATION.md`
- `CLEANUP_POLICY.md`
- `SCHEMA_NOTES.md`
