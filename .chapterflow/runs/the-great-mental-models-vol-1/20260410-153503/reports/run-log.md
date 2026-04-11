# Run Log

## Phase 0

- 2026-04-10T15:35:03-03:00 run manifest loaded and locked.
- title: The Great Mental Models, Volume 1
- author: Shane Parrish
- editionPreference: ask_if_ambiguous
- bookId: the-great-mental-models-vol-1
- runId: 20260410-153503
- outputProfile: flagship_v4_compatible
- learningContract: research_native
- runProfile: balanced_flagship
- validationMode: chapter_gate
- chapterGateMode: automatic_continue
- chapterGateQuizMode: generate
- scenarioTonePolicy: required
- sourceDiscoveryMode: web_bundle
- editionSelectionMode: ask_if_ambiguous
- sourcePolicy: public_or_authorized_plus_secondary
- forbidBulkGenerators: true
- releaseAssembleFromValidatedOnly: true
- preserveApprovedChapterHashes: true
- strict pack audit: pass
- note: no prior chapter artifacts detected in this run root
- Phase 0 complete.

## Phase 1

- source discovery initialized from official Farnam Street, Penguin Random House, Google Books metadata, and reputable library/catalog support
- dominant edition auto-locked to 2024 Portfolio / Penguin Random House release because the current official publisher metadata aligns with the Farnam Street series page and preserves the same Volume 1 nine-model structure
- source freeze bundle written before skeleton or chapter work

## Deviation Repair

- detected deviation before Chapter 3 writer start: `quiz-blueprints/ch03.md` was missing while other Chapter 3 pre-writer artifacts already existed
- repair action: create missing quiz blueprint before any Chapter 3 draft work
- validation action: re-check Chapter 3 pre-writer completeness before writer pass
