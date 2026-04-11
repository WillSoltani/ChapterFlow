# Quality Memory — The Mole People

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
- Unsupported facts, quotes, or named tunnel details
- Generic poverty prose that could fit another nonfiction book
- Tone collapse in required tone objects
- Empty quiz in generate mode
- Plain-string scenario fields
- Contamination phrases in reader-facing prose
- Source-splice leakage

## Book-specific checks
- Chapters must keep physical environment, social danger, and human cost visible.
- Character chapters must stay tied to the named person or community in the brief.
- Systems chapters must not replace lived reporting with abstract policy talk.
- Later chapters cannot treat disputed stories as settled fact if the frozen bundle only supports them weakly.

## Scenario rules
- Six examples per structured chapter.
- All scenario, whatToDo, and whyItMatters fields must be tone objects.
- Categories distribute as 2 work / 2 school / 2 personal.
- Scenarios must teach different lessons instead of six copies of "be compassionate."

## Repair boundary
- Fix mechanical issues directly.
- Patch local prose issues locally.
- If a chapter overreaches the lawful source bundle, reroute to source and brief repair instead of cosmetic edits.

## Release rule
- Release is assembled only from validated chapter JSON files sorted by chapter number.
- No regeneration, normalization, or improvement during release assembly.
