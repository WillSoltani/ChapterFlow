# Quality Memory — Extreme Ownership

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
- Unsupported facts, quotes, or named battlefield details
- Generic leadership prose that could fit any management book
- Tone collapse in required tone objects
- Empty quiz in generate mode
- Plain-string scenario fields
- Contamination phrases in reader-facing prose
- Source-splice leakage

## Book-specific checks
- Intro must keep the combat-leader dilemma and the book's leadership-through-chaos frame visible.
- Chapter 2 must stay on ownership of failure, not drift into blame-the-leader clichés.
- Chapter 3 must prove leadership changes team output and standards.
- Chapter 4 must preserve mission belief and explain why understanding the why matters.
- Chapter 5 must preserve humility and cross-unit coordination rather than generic confidence advice.
- Part II chapters must remain distinct: interdependence, simplicity, triage, delegated command.
- Part III chapters must remain distinct: planning, leading up/down the chain, decisive calls under uncertainty, and the disciplined balance the authors call the dichotomy.

## Scenario rules
- Six examples per structured chapter.
- All scenario, whatToDo, and whyItMatters fields must be tone objects.
- Categories distribute as 2 work / 2 school / 2 personal.
- Scenarios must teach different lessons instead of six copies of "take ownership."

## Repair boundary
- Fix mechanical issues directly.
- Patch local prose issues locally.
- If a chapter collapses into generic leadership advice or overclaims unseen battlefield detail, reroute through the brief and outline instead of cosmetic edits.

## Release rule
- Release is assembled only from validated chapter JSON files sorted by chapter number.
- No regeneration, normalization, or improvement during release assembly.
