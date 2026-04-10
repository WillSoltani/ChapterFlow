# Quality Memory

## Canonical Order

1. Chapter brief / dossier
2. Chapter outline
3. Edited draft
4. Chapter-structure rules
5. Quiz blueprint
6. Validator and mode rules

## Chapter 1 Gate

- Required artifacts: brief, outline, quiz blueprint, canonical draft, edited draft, critic report, structured chapter, quiz, validation report, validated chapter, review package, reading metrics.
- Chapter gate and release gate are different. Stop after validated Chapter 1 and wait for explicit approval.
- Do not write approved chapter hashes until the user approves Chapter 1.

## Prose Auto-Fails

- Invented facts, quotes, studies, or mechanisms
- Generic prose that could fit another chapter
- Paragraph-job repetition
- Thesis-first opening
- Hard depth that becomes longer medium depth
- Meta-distance or contamination language in reader-facing text
- Raw source splice presented as prose without quote approval

## Structure Contract

- `examples[].scenario`, `whatToDo`, and `whyItMatters` must be tone objects.
- Easy: 3 key takeaways, no `moreDetails`, flat `oneMinuteRecap`.
- Medium: 5-7 key takeaways with `moreDetails`, `activationPrompt`, singular `selfCheckPrompt`, structured recap.
- Hard: repo validator currently expects 7-10 key takeaways with `moreDetails`, `activationPrompt`, exactly 2 `selfCheckPrompts`, `predictionPrompt`, structured recap.
- Use 6 examples with exact format rotation and 6 unique ending types.
- Use 5 review cards with 2 easy / 2 medium / 1 hard distribution.
- Quiz in chapter-gate mode must be real, non-empty, 10 questions, 3 choices each.

## Repair Policy

- Patch only local field or paragraph defects.
- Use repair only when specificity, prose quality, tone divergence, or contamination problems are broad.
- Preserve approved prose. Do not silently normalize or regenerate content later.
