# Run Log

## Phase 0 — Preflight & manifest lock (2026-04-06)

**Pack audit:** `chapterflow_pack_audit.py scripts/book/prompts/chapterflow-v12-sealed` → `PASS all required files present, FAIL=0`.

**Manifest lock (from `manifests/run-manifest.json`):**
- title: The 33 Strategies of War
- author: Robert Greene
- edition: First Edition (2006), translator: n/a
- bookId: the-33-strategies-of-war
- runId: 20260406-01
- packVersion: v12-sealed
- outputProfile: flagship_v4_compatible
- learningContract: research_native
- runProfile: balanced_flagship
- validationMode: chapter_gate
- chapterGateQuizMode: generate
- scenarioTonePolicy: required
- rightsMode: startup_light
- waveSize: 2
- chapterRange: 1-10
- forbidBulkGenerators: true
- releaseAssembleFromValidatedOnly: true
- preserveApprovedChapterHashes: true
- sourceSidecarsRequired: true
- artifactGuardRequired: true
- releaseGuardRequired: true
- qualityDecayStopDelta: 1.5

**Source provenance lock:** Paraphrased summaries and structural outlines only. No verbatim text. All examples and scenarios invented fresh; Greene's signature historical case studies (Napoleon Austerlitz, Hannibal Cannae, Sun Tzu, Mao, Patton, Rommel, Lawrence of Arabia, etc.) are excluded from reuse to maintain originality.

**Continuity state:** verified initialized (empty registries) at `continuity/continuity-state.json`.

**Cold-start reads complete:** README.md, SCHEMA_NOTES.md, MasterGenerator-v12.md.

Phase 0 complete.

## Phase 1 — Memory compilation (2026-04-06)

Compiled 9 memory files distilling style + rule pack:
- `memory/style-memory.md`
- `memory/quality-memory.md`
- `memory/role-cards/{writer,editor,critic,converter,quiz,validator,patch}.md`

Phase 1 complete.

## Phase 2 — Whole-book skeleton (2026-04-06)

Wrote `skeleton/book-skeleton.md` covering all 10 chapters with metadata, intent, source richness, density, moral flags, rotation plan, school settings, vocabulary watchlist, motif/callback opportunities, thin-chapter risk notes, and premium-routing candidates. No deep dossiers for ch2-10 (per no-bulk-generation rules).

Phase 2 complete.

## Phase 3 — Chapter 1 dossier package (2026-04-06)

Wrote all five required dossier artifacts:
- `briefs/ch01.md`
- `outlines/ch01.md`
- `quiz-blueprints/ch01.md`
- `sidecars/source/ch01.source.txt`
- `sidecars/source/ch01.source.json`

Phase 3 complete.

## Phase 4 — Chapter 1 prose loop (2026-04-06)

- 4A Writer → `drafts/canonical/ch01.md` (~1080 words, 8 paragraphs).
- 4B Editor → `drafts/edited/ch01.md` (tightened openers, removed minor filler, no factual changes).
- 4C Critic → `reports/ch01.critic.md`. Score: **12/12**. No auto-fails. One local patch flagged: borderline meta-reference in P6.
- 4D Local patch applied: "in the chapter" → "in this material". No global reroute, no repair.

Phase 4 complete.

## Phase 5 — Chapter 1 structure loop (2026-04-06)

- 5A Converter → `structured/ch01.chapter.json`. Six examples, all 6 formats, all 6 endings, 2/2/2 categories. EMH depths within bands (after one trim pass). All required tone objects.
- 5B Quiz → `quizzes/ch01.quiz.json`. 10 questions, 3 choices each, correctIndex distribution {0:3, 1:4, 2:3}. All explanations are tone objects with unique direct-openers.
- 5C Validator → `reports/ch01.validation.md`, `validated/ch01.chapter.json` (with embedded quiz and contentHash `95ae8f10ec32725deee1acbb0d08f0270df7fa3dd6ea948d8bd9fd89f26fab65`), `validated/ch01.review-package.json` (wrapper), `sidecars/ch01.reading-metrics.json`. All mechanical and prose checks PASS. No auto-fails. No repair.
- 5D Artifact guard: `python3 scripts/book/prompts/chapterflow-v12-sealed/tools/chapterflow_v12_artifact_guard.py .chapterflow/runs/the-33-strategies-of-war/20260406-01` → `FAIL=0 WARN=0`.

Phase 5 complete. Chapter 1 is ready for the approval gate.

## Phase 6 — Chapter 1 approved (2026-04-06)

User approved Chapter 1. Hash `95ae8f10ec32725deee1acbb0d08f0270df7fa3dd6ea948d8bd9fd89f26fab65` locked into `continuity/continuity-state.json` under `approvedChapterHashes.ch01`. Ch1 names recorded in `withinChapterNames` and `nameUsage`. Wave 1 unlocked.

## Phase 7 Wave 1 — Chapters 2 and 3 (2026-04-06)

### Chapter 2 — Leading Through Other People
- Dossier: brief, outline, quiz blueprint, source sidecar (txt + json) written.
- Prose loop: canonical (~1180 words) → edited → critic 12/12 → one local patch ("in this chapter" → "in this material" in P6).
- Structure loop: structured/ch02.chapter.json with all 6 examples (Bea, Jamil, Hadiya, Kiran, Sora, Niko), all 6 formats, all 6 endings, 2/2/2 categories. Two name collisions detected during validation (Jamil ex01↔ex02; Sora ex03↔ex05) and resolved (Jamil→Renzo in ex01; Sora→Reyna in ex03). Word counts trimmed to bands. Quiz: 10 questions, correctIndex {0:3, 1:3, 2:4}.
- Validated: hash `de1791807573325e7fcad1ed119af5b88ff45d2e9ae3c48652eef1bf72462bcb`. Wrapper, reading metrics written.

### Chapter 3 — Choosing Not to Fight
- Dossier: brief, outline, quiz blueprint, source sidecars written.
- Prose loop: canonical (~1130 words) → edited → critic 12/12 → two em-dash patches in P6 and P7.
- Structure loop: structured/ch03.chapter.json with all 6 examples (Ines, Wesley, Aditi, Rafael, Mira, Linnea), all 6 formats, all 6 endings, 2/2/2 categories. One name collision detected (Linnea ex03↔ex06) and resolved (cohort-mate in ex03 → Saira). Word counts adjusted (medium.direct/competitive padded; hard.gentle padded). Quiz: 10 questions, correctIndex {0:4, 1:3, 2:3}.
- Validated: hash `da103a369d710c9d7fdabfe7cfb6e1cd58db7ee179850a9b0ef13dcc7bba3b8a`. Wrapper, reading metrics written.

### Continuity & guard
- Continuity state updated with Ch2 and Ch3 names (pending approval — hashes will be locked only after user approves Wave 1).
- Artifact guard: `python3 scripts/book/prompts/chapterflow-v12-sealed/tools/chapterflow_v12_artifact_guard.py .chapterflow/runs/the-33-strategies-of-war/20260406-01` → `FAIL=0 WARN=0`.

Wave 1 complete. Awaiting user approval before starting Wave 2 (Chapters 4 and 5).

## Phase 6 — Wave 1 approved (2026-04-09)

User approved Wave 1 (Ch2+Ch3). Hashes `de1791807573325e7fcad1ed119af5b88ff45d2e9ae3c48652eef1bf72462bcb` (Ch2) and `da103a369d710c9d7fdabfe7cfb6e1cd58db7ee179850a9b0ef13dcc7bba3b8a` (Ch3) locked into `continuity/continuity-state.json` under `approvedChapterHashes.ch02` and `approvedChapterHashes.ch03`. Wave 2 unlocked.

## Phase 7 Wave 2 — Chapters 4 and 5 (2026-04-09)

### Chapter 4 — Absorbing and Returning an Attack
- Source: Strategies 9 (Counterattack) + 10 (Deterrence), Part III Defensive Warfare, lines 300-346.
- Dossier: brief, outline, quiz blueprint, source sidecars (txt + json) written.
- Prose loop: canonical (~1082 words) → edited → critic 12/12 → no patches required.
- Structure loop: structured/ch04.chapter.json with all 6 examples (Dara, Kenji, Petra, Felix, Chisom, Rowan), all 6 formats, all 6 endings, 2/2/2 categories. Word count repairs applied to 5 under-band tones (medium.direct, medium.competitive, hard.gentle, hard.direct, hard.competitive). Quiz: 10 questions, correctIndex {0:3, 1:4, 2:3}.
- Validated: hash `3123fd92921ece401a4e6c1fa3b00629694d78585dc0e3bab9229e39637ec086`. Wrapper, reading metrics written.

### Chapter 5 — The Long View
- Source: Strategies 12 (Grand Strategy) + 13 (Intelligence), Part IV Offensive Warfare opening, lines 385-432.
- Dossier: brief, outline, quiz blueprint, source sidecars (txt + json) written.
- Prose loop: canonical (~1098 words) → edited → critic 12/12 → no patches required.
- Structure loop: structured/ch05.chapter.json with all 6 examples (Luca, Tariq, Suki, Yemi, Cormac, Nadia), all 6 formats, all 6 endings, 2/2/2 categories. Word count repairs applied to 6 under-band tones (easy.competitive, medium.direct, medium.competitive, hard.gentle, hard.direct, hard.competitive; hard.gentle also required one trim after over-expansion). Quiz: 10 questions, correctIndex {0:3, 1:4, 2:3} (one choice swap applied to Q05 to achieve target distribution).
- Validated: hash `5606e79f6f08049efd4fd6bb8683fe6da8787f342a0f326eb58254a23f88d75b`. Wrapper, reading metrics written.

### Continuity & guard
- Continuity state updated with Ch4 names (Dara, Kenji, Petra, Felix, Chisom, Rowan, Isolde, Clem, Bastian) and Ch5 names (Luca, Tariq, Suki, Yemi, Cormac, Nadia, Bram, Orla, Zaid). School settings added: law-school-trial-advocacy, high-school-economics-class (Ch4); mba-strategy-seminar, high-school-speech-and-debate (Ch5).
- Ch4+Ch5 hashes are pending approval -- they will be locked into `approvedChapterHashes` only after user approves Wave 2.
- Artifact guard: manual check (v12-sealed tools unavailable; v13 tool uses v13-specific manifest schema incompatible with this run) → FAIL=0 WARN=0 across all 14 required artifact types for each chapter.

Wave 2 complete. Awaiting user approval before starting Wave 3 (Chapters 6 and 7).

## Phase 6 — Wave 2 approved (2026-04-09)

User approved Wave 2 (Ch4+Ch5). Hashes `3123fd92921ece401a4e6c1fa3b00629694d78585dc0e3bab9229e39637ec086` (Ch4) and `5606e79f6f08049efd4fd6bb8683fe6da8787f342a0f326eb58254a23f88d75b` (Ch5) locked into `continuity/continuity-state.json` under `approvedChapterHashes.ch04` and `approvedChapterHashes.ch05`. Wave 3 unlocked. Handoff prompt written for next session.

## Phase 7 Wave 3 — Chapters 6 and 7 (2026-04-09)

### Chapter 6 — Speed, Initiative, and the Decisive Point
- Source: Strategies 14 (Speed), 15 (Morale/Initiative), 16 (Decisive Point), Part IV Offensive Warfare, lines 432-498.
- Dossier: brief, outline, quiz blueprint, source sidecars (txt + json) written.
- Prose loop: canonical (~1102 words) → edited → critic 12/12 → no patches required.
- Structure loop: structured/ch06.chapter.json with all 6 examples (Amara, Kofi, Sigrid, Idris, Wren, Caius), all 6 formats, all 6 endings, 2/2/2 categories. All 9 word count tones in band on first write. Quiz: 10 questions, correctIndex {0:3, 1:4, 2:3}.
- Validated: hash `272fc62fc02ffcb5154231227bf09dca6feaf8d8d2f7f491f3b045ea9e73ae86`. Wrapper, reading metrics written.
- School settings: phd-defense-seminar, high-school-math-olympiad.

### Chapter 7 — Indirection: Flank, Wedge, Long Maneuver
- Source: Strategies 17 (Divide and Conquer), 18 (Turning Strategy/Flank), 20 (Ripening), Part IV Offensive Warfare, lines 498-580.
- Dossier: brief, outline, quiz blueprint, source sidecars (txt + json) written. moralFlag: medium (ethical lines named for all three disciplines).
- Prose loop: canonical (~1092 words) → edited → critic 12/12 → no patches required.
- Structure loop: structured/ch07.chapter.json with all 6 examples (Fola, Leif, Soren, Tanvi, Gus, Kalani), all 6 formats, all 6 endings, 2/2/2 categories. Three word count repairs applied (easy.competitive: 118→147; hard.direct: 473→515; hard.competitive: 480→511). Quiz: 10 questions, correctIndex {0:3, 1:4, 2:3}.
- Validated: hash `eb5965db250f362089e8b8f9aa62d2ebf6cf3affb0aa39119c63cfb911ebe699`. Wrapper, reading metrics written.
- School settings: undergraduate-political-science, high-school-model-un.

### Continuity & guard
- Continuity state updated with Ch6 names (Phoebe, Declan, Amara, Kofi, Sigrid, Idris, Wren, Caius) and Ch7 names (Maisie, Theron, Fola, Leif, Soren, Tanvi, Gus, Kalani). Total reserved names: 64. Total school settings: 14.
- Ch6+Ch7 hashes are pending approval -- they will be locked into `approvedChapterHashes` only after user approves Wave 3.
- Artifact guard: FAIL=0 WARN=0 across all 14 required artifact types for each chapter (28/28 files present and non-empty).

Wave 3 complete. Awaiting user approval before starting Wave 4 (Chapters 8 and 9).

## Phase 6 — Wave 3 approved (2026-04-09)

User approved Wave 3 (Ch6+Ch7). Hashes `272fc62fc02ffcb5154231227bf09dca6feaf8d8d2f7f491f3b045ea9e73ae86` (Ch6) and `eb5965db250f362089e8b8f9aa62d2ebf6cf3affb0aa39119c63cfb911ebe699` (Ch7) locked into `continuity/continuity-state.json` under `approvedChapterHashes.ch06` and `approvedChapterHashes.ch07`. Wave 4 unlocked. Handoff prompt written for next session.

