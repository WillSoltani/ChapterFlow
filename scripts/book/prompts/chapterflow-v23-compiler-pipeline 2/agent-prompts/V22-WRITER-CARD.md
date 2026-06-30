# ChapterFlow v22 Writer Subagent Prompt

## Role
You are a chapter writer. Produce the assigned ChapterV21 JSON files and nothing from later phases.

## Read first
1. This task card.
2. `agent-prompts/V22-SUBAGENT-CONTRACT.md`.
3. The chapter's source sidecar.
4. The current book plans: name, shape, venue, pedagogy, rhetoric, answer-key, exemplar, and timing plans when present.
5. `agent-prompts/FIELD-PURPOSE-CONTRACTS.md` for field jobs.

## Inputs
The task card names exact input paths. Do not browse or infer from memory. Use the source sidecar for source-specific claims.

## Output
Write each assigned chapter to:
`state/chapters/<chapterId>.v21-native.chapter.json`

## Composition checklist
- Every reader-facing section teaches the assigned `coreMove`.
- Every example is a concrete scene with one lead person, source-grounded logic, and varied format/outcome.
- At least one example carries friction, cost, partial success, or recovery.
- Quiz keys are source-derivable and position-balanced.
- Cards and implementation plan are practical and source-grounded.
- No em dashes, no meta references, no invented precise numbers.


## First-QC readiness contract
Before reporting a chapter done, make it boring for QC. The first QC round is expected to PASS without repair; do not rely on QC to catch writer/research mistakes.

- **Visible factual grounding.** Any hard fact, named framework, quote paraphrase, duration, count, date, institutional scale, or spelled number must be present in the chapter source sidecar's `testableFacts[]`, `namedExamples[].hardSpecifics[]`, or the `.chapterflow/source-verify-<bookId>.md` record. If it is not visible there, remove it or soften it qualitatively. Do not use hidden memory, web memory, or a plausible source detail that the QC pack cannot see.
- **No action theater.** `tryThisNow`, review cards, and implementation steps must be things a real reader can use today. Do not write symbolic rituals such as walking a loop, placing a plan on a counter, rehearsing a peak aloud, or similar performative actions unless the source specifically teaches that behavior and it has a practical payoff.
- **Source-local coherence.** Every sentence in an example must belong to that example's current domain. A clinic scene cannot mention ride departures, rent money, app drivers, boardroom theater, or any other imagery imported from another source unit unless that is genuinely the case being taught.
- **One-time source stamping.** Locations, dates, building names, hospital counts, founding years, and employee counts are anchors, not decoration. Use them once when they orient the case; later mentions should teach a new mechanism, not restamp the same metadata.
- **Pre-QC self-audit.** After deterministic gates pass, reread the chapter as a skeptical QC reviewer looking for `factual_accuracy`, `behavioral_naturalness`, `repeated_unit`, `location_stamping`, `scene_skeleton`, `quiz_key_correctness`, and `review_card_integrity`. Fix these before formal QC sees the file.

## Validation
Run after each chapter:
```bash
npx tsx src/cli.ts gate-chapter state/chapters/<chapterId>.v21-native.chapter.json
```

After all assigned chapters, run:
```bash
npx tsx src/cli.ts qc-converge <bookId> --chapters <comma-list-if-supported>
```

Fix deterministic findings before reporting done.
