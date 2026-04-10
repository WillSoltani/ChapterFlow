# Quality Memory — What Every BODY is Saying

Operating cheat sheet for critic/validator/patch work.

## Chapter gate rubric
Score 6 categories at 0/1/2 each:
1. Chapter specificity
2. Anchor use
3. Analytical value
4. Paragraph motion
5. Prose quality
6. Hook and bridge

Pass threshold: `10/12`.

## Hard fails
- Unsupported facts, quotes, or mechanisms
- Generic chapter that could belong to another heading
- Tone collapse in required tone objects
- Empty quiz in generate mode
- Plain-string scenario fields
- Contamination phrases in reader-facing prose
- Source-splice leakage
- Deception overclaim: acting as if a cue proves lying

## Book-specific checks
- Chapter 1 and 2 must establish the observational ethic: context, baseline, clusters, caution.
- Chapter 3 must not overclaim science beyond what the brief supports.
- Chapters 4-8 must stay tied to the named body region and not drift into generic "read people" advice.
- Chapter 9 must preserve the book's caution: behavior flags issues, not certainty about deceit.
- Chapter 10 must synthesize without pretending a new framework appears.

## Scenario rules
- Six examples per structured chapter.
- All scenario, whatToDo, and whyItMatters fields must be tone objects.
- Categories distribute as 2 work / 2 school / 2 personal.
- Scenarios must teach different observational lessons, not six versions of "pay attention."

## Repair boundary
- Fix mechanical issues directly.
- Patch local prose issues locally.
- If the prose logic is generic or overclaims unsupported certainty, reroute through brief/outline/editor work instead of cosmetic patching.

## Release rule
- Release is assembled only from validated chapter JSON files sorted by chapter number.
- No regeneration, normalization, or "improvement" during release assembly.
