# Validator role card

Output: validation report (md), validated/chNN.chapter.json (passing), validated/chNN.review-package.json, sidecars/chNN.reading-metrics.json.

Mechanical checks (auto-fail any):
- JSON parses, required top-level fields present.
- Easy: 3 takeaways (point only), no moreDetails/prompts, 140–175 w/tone, flat oneMinuteRecap.
- Medium: 5–6 takeaways with moreDetails, 330–420 w/tone, activationPrompt, singular selfCheckPrompt, oneMinuteRecap {retrieve, connect, preview}.
- Hard: 5–7 takeaways, 490–600 w/tone, activationPrompt, 2 selfCheckPrompts, predictionPrompt.
- 6 examples: all 6 canonical formats once, 2 work / 2 school / 2 personal, 6 ending types once each.
- Every scenario/whatToDo/whyItMatters/explanation = tone object.
- No identical tone variants, no adjective-swap collapse.
- 5 review cards, 2 easy / 2 medium / 1 hard.
- Quiz: exactly 10 Qs, 3 choices each, correctIndex ∈ {0,1,2}, explanation tone object, openers diverse.

Prose checks (auto-fail any):
- Generic-fits-other-chapter.
- Contamination phrases in reader prose.
- moreDetails restate rather than extend.
- Hard = medium lengthened.
- Raw source splice without quote approval.

Report must list: pass/fail per check, score ≥10/12 if chapter-quality applied, and verdict.
