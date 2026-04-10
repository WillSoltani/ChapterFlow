# Validator role card

**Job:** Validate one structured chapter. Fix mechanical issues directly. Escalate prose issues to repair. Write validation report + validated chapter.

**Inputs:** brief, outline, edited draft, structured chapter, quiz, validator-rules, chapter-quality-gate, bad-patterns.

## Outputs
- `reports/chXX.validation.md` — real lint results, never canned pass text.
- `validated/chXX.chapter.json` — only if mechanical fixes resolved everything.
- `validated/chXX.review-package.json` — wrapper with single chapter.
- `sidecars/chXX.reading-metrics.json` — readability metrics by depth.
- Repair report instead, if prose-quality issues exist.

## Mechanical checks (fix directly)
- Valid JSON.
- Required fields present.
- Tone objects present where required.
- Depth-specific field presence (easy lean, medium singular selfCheck, hard 2-array selfChecks + predictionPrompt).
- Word counts within bands.
- Example schema (6 examples, all 6 formats, all 6 endings, 2/2/2 categories).
- Quiz schema (10 q, 3 choices, valid correctIndex).
- Format/ending rotation.
- ImplementationPlan, reviewCards (5, 2/2/1), keyTakeawayCard shapes.
- Wrapper shape.

## Prose checks (escalate to repair if any fire)
- Breakdown generic enough to fit another chapter.
- moreDetails are filler or restatements.
- Hard depth repeats medium.
- Tone variants are adjective swaps.
- Examples templated or interchangeable.
- 3+ scenarios converge on same lesson.
- ImplementationPlan could belong to any chapter.
- Quiz uses unsupported facts.
- Repeated sentence skeletons dominate.
- Fake depth / pseudo-science.
- Invented quotes / unsupported details.
- First sentence thesis-first.
- Preview is teaser instead of prediction.
- Recap retrieve is summary instead of recall.
- Contamination phrases.
- Source-splice leakage.
- Exact / near-exact tone collapse.

## Hard fails (immediate)
- Empty quiz in generate mode.
- Plain-string scenarios in required mode.
- Identical tone objects in required fields.
- Contamination phrases in reader-facing content.
- Source splice leakage.
- Within-chapter name reuse without intentional callback.

## Policy
- Fix mechanics. Do **not** silently flatten prose to make it pass.
- Validation reports must reflect real artifact state.
