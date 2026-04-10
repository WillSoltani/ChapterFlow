# Run Log

## 2026-04-06 Phase 0

- Title locked: Tiny Habits
- Author locked: BJ Fogg
- Edition preference: ask_if_ambiguous
- bookId: tiny-habits
- runId: 20260407-020301
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
- Preflight note: pack audit must be invoked with an explicit pack-root argument.
- Phase 0 complete.

## 2026-04-06 Phase 1

- Source discovery used only official, authorized-preview, library-catalog, and reputable secondary summary sources.
- No material chapter-map ambiguity found across the English trade family.
- Locked the English-original trade edition family without user input because the chapter structure remained stable across available US and UK metadata trails.
- Frozen artifacts created: source-ledger.json, edition-lock.json, source-discovery.md, source-freeze-report.md, book-source.md, toc.json, source-heading-index.json.
- Source policy reminder: paraphrase first; exact quotes only when directly supported by the frozen bundle.
- Phase 1 complete.

## 2026-04-06 Phases 2-7

- Memory cards and role cards created under `memory/`.
- `skeleton/book-skeleton.md` created before chapter drafting.
- Chapter prerequisites created for all eight numbered chapters: brief, outline, quiz blueprint, `chXX.source.txt`, and `chXX.source.json`.
- Chapters 1 and 2 validated automatically, hashes sealed in continuity, and `reports/baseline-quality.md` written.
- Chapters 3 through 6 validated through the full writer/editor/critic/converter/quiz/validator path and sealed in continuity.
- Chapters 7 and 8 validated through the full chapter pipeline and sealed in continuity.
- Final chapter-state check: `approvedChapterHashes` now contains `ch01` through `ch08`.
- Final wave artifact guard pass: `chapterflow_v13_artifact_guard.py` returned `FAIL=0 WARN=0`.

## 2026-04-06 Phase 8

- Release assembled from validated chapters only into `release/tiny-habits.modern.json`.
- `chapterflow_v13_source_guard.py` returned `FAIL=0 WARN=0`.
- `chapterflow_v13_artifact_guard.py` returned `FAIL=0 WARN=0`.
- `chapterflow_v13_lint.py release_gate` returned `FAIL=0 WARN=0`.
- `chapterflow_v13_release_guard.py` returned `FAIL=0 WARN=0`.

## 2026-04-06 Phase 9

- Repo package wired to `book-packages/tiny-habits.modern.json`.
- App package registry updated in `app/book/data/bookPackages.ts`.
- `node scripts/book/validate-book.mjs book-packages/tiny-habits.modern.json` returned `RESULT: FAIL` with `72` word-count findings and `49` prose warnings; package shape, examples, quiz/supporting structures, and sealed-integrity categories all returned `0` failures.
- `npm run build` returned `PASS`.
- Current blocker: repo validator still requires a broader prose-expansion pass across all eight chapter breakdown surfaces before the repo-wired package can be considered fully cleared.
