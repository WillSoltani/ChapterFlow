# Run Log

2026-04-12T18:41:46-03:00 Phase 0 manifest lock:
- title: The Obstacle Is the Way
- author: Ryan Holiday
- editionPreference: ask_if_ambiguous
- bookId: the-obstacle-is-the-way
- runId: 20260412-184146
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

2026-04-12T18:41:46-03:00 Phase 0 complete.

2026-04-12T18:41:46-03:00 Pack audit:
- command: python3 scripts/book/prompts/chapterflow-v13-autonomous/tools/chapterflow_v13_pack_audit.py scripts/book/prompts/chapterflow-v13-autonomous
- result: PASS all required files present

2026-04-12T18:41:46-03:00 Phase 1 source freeze started.

2026-04-12T18:41:46-03:00 Phase 1 complete.

2026-04-12T18:41:46-03:00 Phase 2 complete.

2026-04-12T18:41:46-03:00 Phase 3 complete.

2026-04-12T18:41:46-03:00 Chapter 1 pre-writer artifacts complete.

2026-04-12T18:41:46-03:00 Chapter 1 prose loop complete:
- canonical draft written
- edited draft written
- critic report written
- local contamination patch applied

2026-04-12T18:41:46-03:00 Chapter 1 conversion and quiz complete:
- structured chapter json written
- quiz json written

2026-04-12T18:41:46-03:00 Chapter 1 validation complete:
- validator repairs applied for contamination cleanup
- chapter lint passed with FAIL=0 WARN=0
- quiz quality scorer passed overall 0.79 at threshold 0.60
- artifact guard passed with FAIL=0 WARN=0
- continuity hash sealed for ch01
