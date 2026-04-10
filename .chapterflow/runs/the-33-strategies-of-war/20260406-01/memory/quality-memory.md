# Quality Memory — The 33 Strategies of War

Operating cheat sheet for critic/validator/repair. Distilled from `chapter-quality-gate.md`, `learning-loop.md`, `meta-distance-rules.md`, `readability-rules.md`, `scenario-tone-rules.md`, `hard-depth-rules.md`, `evidence-anchor-rules.md`, `name-ledger-rules.md`, `continuation-guard-rules.md`, `no-bulk-generation-rules.md`, `release-assembly-rules.md`, `chapter-gate-rules.md`, `quiz-lifecycle-rules.md`, `chapter-review-artifact-rules.md`, `source-sidecar-rules.md`.

## Chapter quality gate (rubric, 0/1/2 each, 12 total)
1. **Chapter Specificity** — unmistakably this chapter, not swappable.
2. **Anchor Use** — anchors carry the chapter's thinking, not decorative.
3. **Analytical Value** — gives a real mechanism, distinction, or tension.
4. **Paragraph Motion** — every paragraph earns its place.
5. **Prose Quality** — sharp, readable, vivid, authored.
6. **Hook & Bridge** — opening pulls; ending opens the next question.

**Pass threshold: 10/12.** Auto-fail overrides numeric score.

## Auto-fails
- Invented facts/quotes/studies/mechanisms.
- Generic enough to fit another chapter.
- Paragraph-job repetition.
- Hard depth = medium with more words.
- Pseudo-science / filler neuroscience / fake precision.
- Moral complexity framed as endorsement when brief requires distance.
- First sentence is thesis-first.
- Contamination leakage from brief/outline/seed language.
- Identical tone collapse in required learning surfaces.
- Empty quiz in `generate` mode.
- Plain-string scenarios in `required` mode.
- Within-chapter name reuse (unless intentional callback documented).
- Source-splice contamination.

## Required craft checks (before scoring)
- First sentence creates curiosity (not thesis).
- ≥2 strong anchors from brief used as load-bearing material.
- A real tension / limit / failure mode is present.
- Prose readable, concrete, not inflated.
- Ending opens a next question.
- One genuinely memorable line per 200–300 words.

## Critic report must include
- Score / 12 with one-line rationale per category.
- Weakest paragraph or section.
- Most reusable generic sentence (if any).
- Strongest sentence.
- Decision: approved / revise-and-repeat / reject.
- Local-patch vs. global-reroute call.
- Any contamination phrase or source-splice suspicion flagged.

## Learning loop contract
Prime → Read → Apply → Test → Practice → Review.
- 2–3 prediction/anticipation prompts where appropriate.
- Real concept budget: 3–5 ideas.
- Scenario-based transfer.
- Quiz: 3 choices.
- Implementation intentions.
- Review assets schedulable later.
- Do **not** bloat prose to satisfy learning-science ambition.

## Meta-distance rules
- Zero "the chapter says" in takeaways/moreDetails/explanations/scenarios/prompts/cards/plans.
- Avoid "Chapter N" in reader-facing content (rare exceptions: structurally required recap/preview).
- Author name (Greene) used sparingly in breakdowns only.
- Teach directly; never narrate the source artifact.

## Readability targets
- Easy grade 8–9; pictureable in first 2 sentences.
- Medium grade 10–11; mechanism + application.
- Hard grade 12; tension/limit/synthesis/threshold.
- Preview = real prediction or live question (no full explanation of next chapter).
- Recap retrieve = recall challenge, not summary.

## Scenario tone policy (REQUIRED for this run)
Every `examples[].scenario`, `examples[].whatToDo`, `examples[].whyItMatters` MUST be a tone object `{gentle, direct, competitive}`. Plain string = hard fail. Identical or adjective-swap variants = hard fail.

## Hard depth minimum
Must add ≥1 of: genuine boundary condition / failure mode / threshold question / contradiction / unresolved tension / synthesis across concepts.

## Anchor rules
Each anchor = named person/place/event + concrete detail + friction/turning point + consequence. Load-bearing, not decorative. If source thin, fewer anchors > fake-rich.

## Name-ledger rules
- Use only assigned names from brief.
- No within-chapter name reuse across examples (unless intentional, documented callback).
- No book-wide character reuse by default.
- Continuity state tracks `withinChapterNames` and `nameUsage`.

## Source sidecar rules
- One sidecar per chapter before any writer pass.
- `sidecars/source/chXX.source.txt` (paraphrased excerpt) + `chXX.source.json` (title, heading, approx words, proper nouns, repeated terms).
- Sidecars may support brief; may NOT be pasted into breakdowns except via approved quote ledger.

## Continuation guard
- Continue only in waves after Ch1 approval.
- Every active chapter goes through full loop.
- Stop if any plan/log mentions: "bulk generator", "synthesize the rest", "emit remaining chapters in one pass", "generate to the validator", "preserve chapters 1 and 2, synthesize the rest".

## No-bulk-generation
Repo scripts may **not** author breakdowns, takeaways, moreDetails, examples, quizzes, implementation plans, review cards, recap text, key takeaway cards. They MAY assemble release from validated chapters, slice sources, compare hashes, run validators, wire repo files, build/test.

## Release assembly
Build by reading `validated/ch01.chapter.json`...`chNN.chapter.json`, sort by number, write `release/{bookId}.modern.json`. Forbidden: regenerating chapters during release, calling builders for breakdowns/examples, normalizing approved prose.

## Review wrapper
Must contain: schemaVersion, packageId, createdAt, contentOwner, full `book` object, `chapters` array of exactly one chapter (chapter gate).
