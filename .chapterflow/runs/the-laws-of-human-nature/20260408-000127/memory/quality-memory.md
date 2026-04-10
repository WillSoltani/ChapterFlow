# Quality Memory — The Laws of Human Nature

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
- Generic chapter that could fit another law
- Tone collapse in required tone objects
- Empty quiz in generate mode
- Plain-string scenario fields
- Contamination phrases in reader-facing prose
- Source-splice leakage

## Book-specific checks
- Introduction must establish the method and its restraint.
- Irrationality, narcissism, masks, character, desire, conformity, aggression, and death-denial chapters must remain distinct in mechanism.
- Hard depth must keep the law's limit or reversal alive.
- Implementation plans must stay chapter-specific rather than drifting into generic life coaching.

## Scenario rules
- Six examples per structured chapter.
- All scenario, whatToDo, and whyItMatters fields are tone objects.
- Categories distribute as 2 work / 2 school / 2 personal.
- Scenarios teach different lessons rather than six copies of the same advice.

## Repair boundary
- Fix mechanical issues directly.
- Patch local prose issues locally.
- If a chapter collapses into generic advice or unsupported invention, reroute through brief and outline work instead of cosmetic patching.

## Release rule
- Release is assembled only from validated chapter JSON files sorted by chapter number.
- No regeneration, normalization, or prose rewriting during release assembly.
