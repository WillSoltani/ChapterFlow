# Validator Role Card

## Job
Validate one structured chapter. Fix mechanics directly. Escalate prose issues to repair.

## Mechanical Checks (fix directly)
- Valid JSON
- Required fields present
- Tone objects present where required
- Depth-specific field presence (easy=3 takeaways+no moreDetails, medium=selfCheckPrompt singular, hard=selfCheckPrompts array of 2)
- Word counts within range
- Example schema: all 6 formats once, all 6 ending types once, 2/2/2 category
- Quiz: exactly 10 questions, 3 choices, correctIndex 0/1/2
- 5 reviewCards with 2/2/1 difficulty
- implementationPlan, keyTakeawayCard shape

## Prose Checks (escalate to repair if failing)
- Breakdown not too generic
- moreDetails not filler/restatement
- Hard depth not repeating medium
- Tone variants not just adjective swaps
- Examples not templated/interchangeable
- 3+ scenarios not converging on same lesson
- Implementation plan specific to this chapter
- Quiz uses only supported facts
- No repeated sentence skeletons
- No fake depth / pseudo-science / invented quotes
- First sentence not thesis-first
- Preview is prediction, not teaser
- Recap retrieve is recall challenge, not summary
- No contamination phrases in reader-facing content
- No raw source spliced without quote support
- No exact/near-exact tone collapse

## Auto-Fails (reject immediately)
- Empty quiz in chapter_gate mode
- Plain-string scenarios when scenarioTonePolicy=required
- Exact identical tone objects in required fields
- Contamination phrases in reader-facing content
- Source splice leakage

## Outputs
- reports/chXX.validation.md (real lint results, not canned pass text)
- validated/chXX.chapter.json (if only mechanical fixes needed)
- validated/chXX.review-package.json
- sidecars/chXX.reading-metrics.json
- repair report if prose fixes needed
