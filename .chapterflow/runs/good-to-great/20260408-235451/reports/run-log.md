# Run Log

## 2026-04-08 Phase 0

- Title locked: Good to Great
- Author locked: Jim Collins
- Edition preference: ask_if_ambiguous
- bookId: good-to-great
- runId: 20260408-235451
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
- Preflight repair: corrected the manifest author from an unsupported mixed-author value to the dominant canonical author, Jim Collins.
- Phase 0 complete.

## 2026-04-08 Phase 1

- Source discovery used official Jim Collins concept pages, authorized metadata, and one secondary chapter-by-chapter summary for the chapter map.
- No material edition ambiguity was found for the English trade family at the chapter level, so the run auto-locked without user input.
- Frozen artifacts created: source-ledger.json, edition-lock.json, source-discovery.md, source-freeze-report.md, book-source.md, toc.json, source-heading-index.json.
- Source policy reminder: paraphrase first; exact quotes stay disallowed unless supported directly by the frozen authorized bundle.
- Phase 1 complete.

## 2026-04-08 Phases 2-3

- Memory cards and role cards created under `memory/`.
- `skeleton/book-skeleton.md` created before any chapter pre-writer artifacts.
- Chapter routing locked to baseline chapters 1-2, then waves 3-4, 5-6, 7-8, and a final residual chapter 9 after the prior wave clears.
- Phase 2 complete.
- Phase 3 complete.

## 2026-04-08 Phase 4A-Prewriter

- Chapter 1 pre-writer artifacts created: brief, outline, quiz blueprint, `ch01.source.txt`, and `ch01.source.json`.
- Writer may start for Chapter 1.

## 2026-04-09 Phase 4 Complete

- Chapter 1 completed through writer, editor, critic, local prose patch, converter, quiz, validator, review wrapper, reading metrics, and continuity seal.
- `chapterflow_v13_lint.py` returned `FAIL=0 WARN=0` for both `validated/ch01.chapter.json` and `validated/ch01.review-package.json`.
- `chapterflow_v13_artifact_guard.py` returned `FAIL=0 WARN=0` with the Chapter 1 bundle present on disk.
- Chapter 1 passed the automatic chapter gate.

## 2026-04-09 Phase 5A-Prewriter

- Chapter 2 pre-writer artifacts created: brief, outline, quiz blueprint, `ch02.source.txt`, and `ch02.source.json`.
- Writer may start for Chapter 2.

## 2026-04-09 Phase 5 Complete

- Chapter 2 completed through writer, editor, critic, converter, quiz, validator, review wrapper, reading metrics, and continuity seal.
- `chapterflow_v13_lint.py` returned `FAIL=0 WARN=0` for both `validated/ch02.chapter.json` and `validated/ch02.review-package.json`.
- `chapterflow_v13_artifact_guard.py` returned `FAIL=0 WARN=0` with the Chapter 1 and Chapter 2 bundles present on disk.
- Baseline quality floor established from Chapters 1 and 2.

## 2026-04-09 Phase 6 Wave 2 Prewriter

- Wave 2 activated for Chapters 3 and 4.
- Pre-writer artifacts created for Chapters 3 and 4: briefs, outlines, quiz blueprints, and source sidecars.

## 2026-04-09 Phase 6 Wave 2 Complete

- Chapters 3 and 4 completed through writer, editor, critic, converter, quiz, validator, review wrappers, reading metrics, and continuity seals.
- `chapterflow_v13_lint.py` returned `FAIL=0 WARN=0` for `validated/ch03.chapter.json`, `validated/ch03.review-package.json`, `validated/ch04.chapter.json`, and `validated/ch04.review-package.json`.
- `chapterflow_v13_artifact_guard.py` returned `FAIL=0 WARN=0` after the wave.

## 2026-04-09 Phase 6 Wave 3 Prewriter

- Wave 3 activated for Chapters 5 and 6.
- Pre-writer artifacts created for Chapters 5 and 6: briefs, outlines, quiz blueprints, and source sidecars.

## 2026-04-09 Phase 6 Wave 3 Complete

- Chapters 5 and 6 completed through writer, editor, critic, converter, quiz, validator, review wrappers, reading metrics, and continuity seals.
- `chapterflow_v13_lint.py` returned `FAIL=0 WARN=0` for `validated/ch05.chapter.json`, `validated/ch05.review-package.json`, `validated/ch06.chapter.json`, and `validated/ch06.review-package.json`.
- `chapterflow_v13_artifact_guard.py` returned `FAIL=0 WARN=0` after the wave.

## 2026-04-09 Phase 6 Wave 4 Prewriter

- Wave 4 activated for Chapters 7 and 8.
- Pre-writer artifacts created for Chapters 7 and 8: briefs, outlines, quiz blueprints, and source sidecars.

## 2026-04-09 Phase 6 Wave 4 Complete

- Chapters 7 and 8 completed through writer, editor, critic, converter, quiz, validator, review wrappers, reading metrics, and continuity seals.
- `chapterflow_v13_lint.py` returned `FAIL=0 WARN=0` for `validated/ch07.chapter.json`, `validated/ch07.review-package.json`, `validated/ch08.chapter.json`, and `validated/ch08.review-package.json`.
- `chapterflow_v13_artifact_guard.py` returned `FAIL=0 WARN=0` after the wave.

## 2026-04-09 Phase 6 Residual Chapter 9 Prewriter

- Residual Chapter 9 activated after Wave 4 cleared.
- Pre-writer artifacts created for Chapter 9: brief, outline, quiz blueprint, and source sidecars.

## 2026-04-09 Phase 6 Residual Chapter 9 Complete

- Chapter 9 completed through writer, editor, critic, converter, quiz, validator, review wrapper, reading metrics, and continuity seal.
- `chapterflow_v13_lint.py` returned `FAIL=0 WARN=0` for `validated/ch09.chapter.json` and `validated/ch09.review-package.json`.
- `chapterflow_v13_artifact_guard.py` returned `FAIL=0 WARN=0` on the full nine-chapter run state.

## 2026-04-09 Release

- Release package assembled strictly from `validated/ch*.chapter.json` into `release/good-to-great.release.json`.
- Release-step deviation detected and repaired: continuity seals had been written as raw file hashes rather than the release guard's canonical JSON hashes.
- Repair action: recomputed all `approvedChapterHashes` from canonical validated chapter payloads and rewrote `continuity/continuity-state.json`.
- `chapterflow_v13_release_guard.py` returned `FAIL=0 WARN=0` after the seal repair.
- Release package was rebuilt into `release/good-to-great.modern.json` from `validated/ch*.chapter.json` only.
- `chapterflow_v13_source_guard.py` returned `FAIL=0 WARN=0`.
- `chapterflow_v13_lint.py release/good-to-great.modern.json release_gate` returned `FAIL=0 WARN=0`.
- `node scripts/book/validate-book.mjs release/good-to-great.modern.json` returned `RESULT: PASS`.
- `reports/release.validation.md` and `reports/release.audit.md` written.

## 2026-04-09 Phase 8 Repair and Repo Wiring

- Deviation detected: converter-stage depth repairs had been applied to `structured/ch*.chapter.json` while `validated/ch*.chapter.json`, `validated/ch*.review-package.json`, `release/good-to-great.modern.json`, `book-packages/good-to-great.modern.json`, and `continuity/continuity-state.json` still reflected the older validated payloads.
- Repair action: promoted the repaired structured chapter JSONs into the validated layer for Chapters 1-9, rewrote all validated review wrappers so each wrapped the full validated chapter payload, refreshed reading metrics sidecars, recomputed canonical chapter seals, and rebuilt the release and repo packages from validated chapters only.
- Wrapper parity verification passed for all nine chapters.
- `chapterflow_v13_artifact_guard.py` returned `FAIL=0 WARN=0` on the repaired run.
- `node scripts/book/validate-book.mjs book-packages/good-to-great.modern.json` returned `RESULT: PASS`.
- `chapterflow_v13_lint.py book-packages/good-to-great.modern.json release_gate` returned `FAIL=0 WARN=0`.
- `chapterflow_v13_pack_audit.py` returned `PASS all required files present`.
- `npm run build` returned exit code `0`.
- Phase 7 complete.
- Phase 8 complete.
