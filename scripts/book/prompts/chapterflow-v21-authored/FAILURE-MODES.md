# v21 Failure-Mode Catalog

The single source of truth for what v21 must catch before any chapter ships. Each entry lists the v13 failure mode, the v21 enforcement mechanism, the severity tier, and the specific code location.

Severity tiers:
- **BLOCKER** — chapter cannot ship; final gate hard-fails.
- **MAJOR** — chapter ships only if voice-pass / writer can't fix after retries; logged.
- **MINOR** — advisory; logged but never blocks ship.

Anything not in this catalog is not a known v13 failure mode. If a new failure mode is identified later, add it here first, then add the enforcement.

---

## A. Schema integrity

| ID | v13 failure | v21 enforcement | Severity | Code |
|----|-------------|-----------------|----------|------|
| A1 | Bloom's level used hyphenated/underscored compound tokens (`apply-analyze`, `apply_analyze`) | Quiz writer prompt restricts to canonical 6 verbs; validator `validateQuiz` rejects non-canonical | BLOCKER | [agents/writer-quiz.ts](src/agents/writer-quiz.ts), [critics/schema.ts](src/critics/schema.ts) |
| A2 | depthLevel used inconsistent values (`medium`/`standard`/`hard`/`deeper`/`deep`) | Quiz writer prompt restricts to `simple/standard/deep`; validator rejects others | BLOCKER | [agents/writer-quiz.ts](src/agents/writer-quiz.ts) |
| A3 | bloomsLevel missing on 10.8% of questions | Validator requires non-empty bloomsLevel | BLOCKER | [agents/writer-quiz.ts](src/agents/writer-quiz.ts) |
| A4 | Quiz answer-position bias (TFS had 100% in idx 0; AH 80%) | Validator: max 50% in any single position; book-level gate enforces uniform distribution across chapters | MAJOR | [agents/writer-quiz.ts](src/agents/writer-quiz.ts), [critics/schema.ts](src/critics/schema.ts) |
| A5 | Quiz inconsistent choice count (some 3, some 4) | Validator requires exactly 3 choices | BLOCKER | [agents/writer-quiz.ts](src/agents/writer-quiz.ts) |
| A6 | Tone matrix duplication (3 voices = 3× content storage) | v21 schema is single canonical voice; v21 schema `BookPackageV21` has no tone keys | RESOLVED-BY-DESIGN | [src/types.ts](src/types.ts) |
| A7 | `keyTakeaways[]` arrays were always empty in v13 | v21 schema drops the field; replaced with single `keyTakeaway` string | RESOLVED-BY-DESIGN | [src/types.ts](src/types.ts) |
| A8 | `oneMinuteRecap` duplicated `keyTakeawayCard` | v21 schema drops `oneMinuteRecap` | RESOLVED-BY-DESIGN | [src/types.ts](src/types.ts) |
| A9 | `contexts` field overloaded (sometimes 3 short tags, sometimes 150-char planner specs) | v21 splits: `tags` for short display strings, `planSpec` for full planner data | RESOLVED-BY-DESIGN | [src/assembler.ts](src/assembler.ts) |
| A10 | Cache-skip regressions silently ship books with structurally inconsistent chapters (memorable-lines added later but Ch1–3 from earlier run never got re-touched, etc.) | Book gate `schemaInconsistencies` check: if a field is present on ≥80% of chapters but absent on others, fails as a BLOCKER. Forces operator to backfill the stale chapters before promotion. | BLOCKER | [src/critics/bookGate.ts](src/critics/bookGate.ts) |

## B. Voice and register

| ID | v13 failure | v21 enforcement | Severity | Code |
|----|-------------|-----------------|----------|------|
| B1 | Meta-references: 85.3% of breakdowns said "the chapter" / "this chapter" / "the author" | Writer prompts forbid; critic `checkNoMetaReference` regex-blocks | BLOCKER | [critics/register.ts](src/critics/register.ts), [config/meta-patterns.json](config/meta-patterns.json) |
| B2 | Literal "Chapter N" in prose (394 occurrences in TFS alone) | Writer prompts forbid; critic `checkNoChapterNumberLiteral` regex-blocks | BLOCKER | [critics/register.ts](src/critics/register.ts) |
| B3 | Author-surname-verb constructions ("Clear argues...", "Kahneman writes...") | Meta-pattern regex catches; critic blocks | MAJOR | [config/meta-patterns.json](config/meta-patterns.json) |
| B4 | Stock phrases across books (`boundary condition` 201 hits across 46 books, etc.) | Hard-banned list in config; critic blocks each | MAJOR | [critics/register.ts](src/critics/register.ts), [config/banned-phrases.json](config/banned-phrases.json) |
| B5 | Em dashes (37 per chapter on average) — model voice tell | Writer prompts forbid; critic `checkNoEmDash` blocks | BLOCKER | [critics/register.ts](src/critics/register.ts) |
| B6 | Voice was generic "smart magazine" register, not author-specific | Editor-in-chief produces voice specimens + anti-specimens; voice-pass agent rewrites toward specimens | MAJOR | [agents/editor-in-chief.ts](src/agents/editor-in-chief.ts), [agents/voice-pass.ts](src/agents/voice-pass.ts) |
| B7 | Generic closing lines ("be careful", "think carefully") | Critic `checkClosingLineLandings` flags | MINOR | [critics/prose.ts](src/critics/prose.ts) |
| B8 | Cross-tier verbatim phrase repetition | Critic `checkCrossTierPhraseUniqueness` flags 4+ word verbatim shares | MINOR | [critics/prose.ts](src/critics/prose.ts) |
| B9 | Reverse-priming: writer prompts that name a forbidden phrase ("don't say 'the chapter'") cause the model to emit it. Naming the bad token plants it in attention. | Brief-sanitizer strips literal forbidden phrases from `voiceCharter.avoidMoves` before the brief reaches a writer. Retry messages must be phrased structurally ("address the reader directly"), never as "don't say X". | BLOCKER (design rule, enforced at brief assembly) | [src/lib/brief-sanitizer.ts](src/lib/brief-sanitizer.ts), [src/agents/editor-in-chief.ts](src/agents/editor-in-chief.ts) |
| B10 | Source-freeze sidecars contain meta-tells ("the chapter should…", "the author argues…"). When fed into a writer as context, those tells leak into output and trip B1/B2/B3 downstream. | `source-loader.ts` strips meta lines at read time before content reaches any agent. If everything strips out, the loader returns null instead of an empty string. | BLOCKER (prevention; ship gate still catches escapes) | [src/source-loader.ts](src/source-loader.ts) |

## C. Examples (scenes)

| ID | v13 failure | v21 enforcement | Severity | Code |
|----|-------------|-----------------|----------|------|
| C1 | Scenarios were thesis-paraphrase, not scenes ("A work decision is moving quickly because...") | Writer prompt demands named protagonist + scene; validator rejects scenarios <200 chars or without proper noun | BLOCKER | [agents/writer-example.ts](src/agents/writer-example.ts), [critics/narrative.ts](src/critics/narrative.ts) |
| C2 | Examples lacked specific setting (time/place/role) | Critic `checkSpecificScene` requires anchor (clock time, specific location, specific role) | MAJOR | [critics/narrative.ts](src/critics/narrative.ts) |
| C3 | Examples had no decision point | Critic `checkDecisionPoint` requires decision cue (skipped for postmortem/reflection formats by design) | MAJOR | [critics/narrative.ts](src/critics/narrative.ts) |
| C4 | Format rotation locked to `decision_point/postmortem/dialogue/predict_reveal/dilemma/before_after` (49% of chapters used identical sequence) | Curriculum planner prompt demands ≥3 distinct formats; over-generation curator picks variety | MAJOR | [prompts/curriculum-planner.system.md](prompts/curriculum-planner.system.md) |
| C5 | Category locked to `work/school/personal` (66% of chapters used identical rotation) | Curriculum planner prompt forbids the rotation; chooses domains specific to chapter | MAJOR | [prompts/curriculum-planner.system.md](prompts/curriculum-planner.system.md) |
| C6 | Same context-tuple used across unrelated books (`(meetings, forecasting, evaluation)` 68 times) | Per-example planSpec has unique domain/audience/stakes; tags are short and book-specific | RESOLVED-BY-DESIGN | [src/assembler.ts](src/assembler.ts) |
| C7 | Protagonist name pool tiny (Priya in 50 books, Omar in 47) | Banned-pool list of 20 v13-overused names; cross-book ledger tracks recent names; writers receive forbidden list | BLOCKER | [agents/writer-example.ts](src/agents/writer-example.ts), [librarian/libraryState.ts](src/librarian/libraryState.ts) |
| C8 | Examples competent but safe (one accepted candidate per slot) | Over-generation: 3 candidates per slot; curator picks best by rubric | QUALITY-LIFT | [generateChapter.ts](src/generateChapter.ts), [curator/exampleSelector.ts](src/curator/exampleSelector.ts) |

## D. Pedagogy

| ID | v13 failure | v21 enforcement | Severity | Code |
|----|-------------|-----------------|----------|------|
| D1 | Quiz tested recall ("What does Chapter 6 say about...") in 44.2% of prompts | Writer prompt demands application stems; critic `checkQuizTestsApplication` blocks recall openers | MAJOR | [agents/writer-quiz.ts](src/agents/writer-quiz.ts), [critics/pedagogy.ts](src/critics/pedagogy.ts) |
| D2 | Cards were comprehension checks not retrieval prompts | Writer prompt demands retrieval; critic `checkCardTestsRetrieval` flags recall openers | MINOR | [critics/pedagogy.ts](src/critics/pedagogy.ts) |
| D3 | Quiz Bloom's mix not aligned with curriculum | Curriculum planner sets `bloomsMix`; writer must match within ±1 per level | MAJOR | [agents/writer-quiz.ts](src/agents/writer-quiz.ts) |
| D4 | No transfer-emphasis: questions used the same scenarios as the chapter | Curriculum planner sets `transferEmphasis ≥ 0.7`; writer demands novel scenarios per question | MAJOR | [prompts/writer-quiz.system.md](prompts/writer-quiz.system.md) |
| D5 | Implementation plan generic ("be consistent", "track progress") | Writer prompt requires concrete trigger + concrete response in if-then plans; 24-hr challenge must be specific | MAJOR | [prompts/writer-implementation-plan.system.md](prompts/writer-implementation-plan.system.md) |

## E. Reading level

| ID | v13 failure | v21 enforcement | Severity | Code |
|----|-------------|-----------------|----------|------|
| E1 | All tiers wrote at same FK grade (~grade 9), too academic for easy tier | Tier-specific reading-level constraints in writer prompt; critic `checkReadingLevel` enforces ceilings (fastRead ≤9.5, deepRead ≤12.5) | MAJOR | [critics/readingLevel.ts](src/critics/readingLevel.ts), [prompts/writer-breakdown.system.md](prompts/writer-breakdown.system.md) |
| E2 | Tiers were redundant (easy = shorter medium, medium = shorter hard) | Writer prompt requires progressive tiers; critic `checkTiersProgressive` blocks identical first sentences | MAJOR | [critics/prose.ts](src/critics/prose.ts) |
| E3 | Easy tier opened with abstractions/definitions | Critic `checkOpeningConcreteness` flags definitional openers | MINOR | [critics/prose.ts](src/critics/prose.ts) |

## F. Cross-book state

| ID | v13 failure | v21 enforcement | Severity | Code |
|----|-------------|-----------------|----------|------|
| F1 | Same protagonist names recurred across 50+ books | Library state ledger tracks names per book; writers receive forbidden list of last-10-books names. Within-book duplication is now also a BLOCKER in the book gate, restricted to **recurring** names (a token that appears 2+ times in a single chapter's examples) so one-off capitalized words like "Nobody", "Third", or "Street" don't false-flag. | BLOCKER (within-book) / MAJOR (cross-book) | [librarian/libraryState.ts](src/librarian/libraryState.ts), [src/critics/bookGate.ts](src/critics/bookGate.ts) |
| F2 | Stock phrases recurred across books with no library-wide accounting | Library state ledger tracks signature phrases | MINOR | [librarian/libraryState.ts](src/librarian/libraryState.ts) |
| F3 | Library-wide answer-position drift | Library state ledger tracks cumulative position counts | MINOR (advisory; book-level gate could enforce) | [librarian/libraryState.ts](src/librarian/libraryState.ts) |

## G. Process and resilience

| ID | v13 failure | v21 enforcement | Severity | Code |
|----|-------------|-----------------|----------|------|
| G1 | Single-shot generation; if any unit failed, chapter was lost | Resume capability: existing chapter outputs are skipped; generateChapter is idempotent per chapter | RESOLVED-BY-DESIGN | [generateChapter.ts](src/generateChapter.ts) |
| G2 | Per-book repair scripts proliferated as one-offs | All repairs go through the same critic suite; no per-book tooling | RESOLVED-BY-DESIGN | (architecture) |
| G3 | No structured failure logging when an example failed | Writer-example errors logged with reason; orchestrator surfaces batch-1 failures before retry | RESOLVED | [generateChapter.ts](src/generateChapter.ts) |
| G4 | Pronoun false-positives cascaded into validation rejections | Validator filters pronouns from usedNames before enforcing | RESOLVED | [agents/writer-example.ts](src/agents/writer-example.ts) |

## Final gate

A chapter cannot ship to `state/chapters/` unless it passes the **chapter ship gate**, which runs every check above and fails closed on any BLOCKER. The gate lives at [src/critics/finalGate.ts](src/critics/finalGate.ts) and is called from [src/generateChapter.ts](src/generateChapter.ts) immediately before `writeFileSync`.

A book cannot be considered complete unless every chapter ship-gates AND the book-level gate passes (cumulative answer-position balance, no within-book name duplication, voice consistency).

## Adding a new failure mode

1. Add a row to the appropriate section above with ID (continuing the alphabetical sequence) and severity.
2. Implement the check (regex, heuristic, or model-backed).
3. Wire the check into [src/critics/finalGate.ts](src/critics/finalGate.ts) so the ship gate enforces it.
4. If the failure was found in shipped chapters, regenerate the affected ones.

This catalog should be the first thing a new engineer or new agent reads. If it isn't here, it isn't enforced.
