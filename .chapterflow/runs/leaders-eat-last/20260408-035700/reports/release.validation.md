# Release Validation Report

## Release
- Path: `release/leaders-eat-last.modern.json`
- Package ID: `fc45518b-a608-4c3c-84bd-260b915a1c28`
- Created At: `2026-04-08T22:15:55Z`
- Chapters Assembled: `27`

## Checks Run
- Repo mechanical validator: `node scripts/book/validate-book.mjs release/leaders-eat-last.modern.json`
- ChapterFlow release guard: `python3 PACK_ROOT/tools/chapterflow_v16_release_guard.py RUN_ROOT release/leaders-eat-last.modern.json`

## Results
- Mechanical validator: PASS
- Release guard: PASS
- Prose warnings: 0

## Notes
- Release assembly was rebuilt after adding the frozen book metadata fields required by the mechanical validator to `manifests/run-manifest.json`.
- The assembled package now carries non-empty `book.categories`, frozen edition metadata, and all `27` validated chapters.
