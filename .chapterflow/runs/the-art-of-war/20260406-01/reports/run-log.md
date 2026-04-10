# Run Log — The Art of War (the-art-of-war / 20260406-01)

## Phase 0 — Preflight and manifest lock

### Manifest confirmation
- title: The Art of War
- author: Sunzi
- edition: Project Gutenberg / Lionel Giles translation (1910)
- translator: Lionel Giles
- sourceText: .chapterflow/sources/the-art-of-war/the-art-of-war.txt (Project Gutenberg eBook #17405)
- bookId: the-art-of-war
- runId: 20260406-01
- packVersion: v12-sealed
- outputProfile: flagship_v4_compatible
- learningContract: research_native
- runProfile: apex_flagship
- validationMode: chapter_gate
- chapterGateQuizMode: generate
- scenarioTonePolicy: required
- forbidBulkGenerators: true
- releaseAssembleFromValidatedOnly: true
- preserveApprovedChapterHashes: true
- sourceSidecarsRequired: true
- artifactGuardRequired: true
- releaseGuardRequired: true
- waveSize: 2
- qualityDecayStopDelta: 1.5
- variantFamily: EMH
- chapterRange: Chapters I-XIII (1-13)

### Preflight checks
- pack audit: PASS (`FAIL=0`)
- run directory tree: created via bootstrap.sh
- source file: `.chapterflow/sources/the-art-of-war/the-art-of-war.txt` present (renamed from full-text.txt)
- supporting dossier files present: chapter-map.md, historical-context.md, key-quotes.md, modern-applications.md, criticism-and-limits.md
- continuity/continuity-state.json: initialized empty
- reports/run-log.md: this file

### Operating notes
- This run mirrors the-prince apex_flagship workflow.
- Ch11 "The Nine Situations" (longest/densest) and Ch12 "The Attack by Fire" (limited source richness) are premium-routing candidates; consider solo waves.
- The text is a strategic classic. Ethical framing: present deception, espionage, and ruthlessness as strategic awareness inside a broader system of planning, economy, timing, and restraint. Do not sanitize into clean leadership pablum. Do not glamorize into amoral genius. Respect the book's own anti-waste, anti-vanity, anti-rage cautions.

Phase 0 complete.

## Phase 1 — Memory compilation

Compiling compact memory files from style/, rules/, and the gold-pattern files read in cold-start. Wrote `memory/style-memory.md`, `memory/quality-memory.md`, and seven role cards under `memory/role-cards/`. Phase 1 complete.

## Phase 2 — Whole-book skeleton

Wrote `skeleton/book-skeleton.md` covering all 13 chapters with one-line intent, source richness, concept density, moral flags, motif/callback opportunities, format and ending rotation per chapter, school-setting plan, vocabulary watchlist, thin-chapter risk notes (Ch12 limited richness, Ch11 dense), premium-routing candidates (Ch3, Ch11, Ch13), cross-chapter tensions, wave plan. Phase 2 complete.

## Phase 3 — Chapter 1 dossier

Wrote `briefs/ch01.md` (full brief with anchors, quote ledger, scenario assignments), `outlines/ch01.md` (paragraph job map, hard-depth tension, threshold question, scenario lesson map), `quiz-blueprints/ch01.md`, `sidecars/source/ch01.source.txt`, and `sidecars/source/ch01.source.json`. Phase 3 complete.

## Phase 4 — Chapter 1 prose loop

- Phase 4A (writer): wrote `drafts/canonical/ch01.md` (900 words)
- Phase 4B (editor): wrote `drafts/edited/ch01.md` (897 words) — removed em dash, removed banned skeleton, removed meta-distance leakage, tightened opening
- Phase 4C (critic): wrote `reports/ch01.critic.md` — score 11/12, decision: approve for conversion. No global reroute, no local patch needed.

## Phase 5 — Chapter 1 structure loop

- Phase 5A (converter): wrote `structured/ch01.chapter.json`. Initial draft had 40+ "the chapter" meta-distance leaks, 3 "this chapter", 11 "the book", 21 instances of the banned "X is not Y. It is Z." sentence skeleton, and 5 em dashes in `implementationPlan.ifThenPlans`. All cleaned via targeted Edit calls. Final state: zero meta-distance leaks, zero banned skeletons, zero em dashes, all word counts within target (easy 140-175, medium 330-420, hard 490-600), no tone collapses, examples have 6 unique formats / 6 unique endings / 2/2/2 categories, 5 review cards 2/2/1, key takeaway card present.
- Phase 5B (quiz agent): wrote `quizzes/ch01.quiz.json` with 10 questions, 3 choices each, distribution q01-q03 understand/remember/apply easy, q04-q06 apply medium, q07-q08 analyze medium/hard, q09-q10 evaluate hard. correctIndex distribution A=4 B=3 C=3. All direct explanation openers unique (no two share 4+ opening words). No banned openers. Fixed one "best reflects" in q04 prompt.
- Phase 5C (validator): merged structured + quiz into `validated/ch01.chapter.json`, computed canonical SHA-256 = `0fe4bf62313aff10ff623b731f8c50f89c1abef404f490a3c9bf01c99beb78c6`. Wrote `validated/ch01.review-package.json` (schemaVersion 1.1.0, packageId UUID, contentOwner ChapterFlow, full book block, single-chapter wrapper). Wrote `sidecars/ch01.reading-metrics.json` with word counts and Flesch-Kincaid estimates per depth-tone. Wrote `reports/ch01.validation.md` with full mechanical and prose-quality check log.

Phase 5 complete. Artifact guard: `FAIL=0 WARN=0`. Chapter-gate lint: `FAIL=0 WARN=0`.

## Phase 6 — Chapter 1 approval gate

Presented Ch1 to user for review at 2026-04-06 16:XX. **User approved.** Wrote `approvedChapterHashes.ch01 = 0fe4bf62313aff10ff623b731f8c50f89c1abef404f490a3c9bf01c99beb78c6` into `continuity/continuity-state.json`. Ch1 is now hash-locked for the rest of the run; any future edit to `validated/ch01.chapter.json` will fail the release guard.

## Phase 7 — Wave 1 (Ch2 + Ch3)

Beginning Wave 1: Chapters 2 (Waging War) and 3 (Attack by Stratagem). Both rich/high source-density. Running artifact guard before wave start.
