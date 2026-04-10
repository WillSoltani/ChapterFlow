# Quality Memory — Deep Work

Operating cheat sheet for critic, validator, and patch work.

## Chapter gate rubric
Score 6 categories at 0/1/2 each:
1. Chapter specificity
2. Source-anchor fidelity
3. Analytical value
4. Paragraph motion
5. Prose quality
6. Hook and bridge

Pass threshold: `10/12`.

## Hard fails
- Unsupported facts, quotes, or named examples
- Generic chapter that could belong to any productivity book
- Tone collapse in required tone objects
- Empty quiz in generate mode
- Plain-string scenario fields
- Contamination phrases in reader-facing prose
- Source-splice leakage

## Book-specific checks
- Introduction must set up the deep-work hypothesis and the deep/shallow distinction.
- Chapter 2 must stay on learning and high-quality output, not drift into generic discipline talk.
- Chapter 3 must keep the organizational and cultural reasons depth is rare.
- Chapter 4 must preserve the meaning claim rather than reusing the value claim.
- Rule chapters must stay distinct: scheduling depth, training concentration, using a craftsman tool filter, and reducing shallow obligations.
- Conclusion must synthesize and narrow rather than introduce new doctrine.

## Scenario rules
- Six examples per structured chapter.
- All scenario, whatToDo, and whyItMatters fields must be tone objects.
- Categories distribute as 2 work / 2 school / 2 personal.
- Scenarios must teach different lessons rather than six copies of "focus harder."

## Repair boundary
- Fix mechanical issues directly.
- Patch local prose issues locally.
- If a chapter collapses into generic productivity advice or overclaims unsupported evidence, reroute through brief and outline work instead of cosmetic patching.

## Release rule
- Release is assembled only from validated chapter JSON files sorted by chapter number.
- No regeneration, normalization, or "improvement" during release assembly.
