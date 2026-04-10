# Quality Memory — How to Talk to Anyone

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
- Unsupported facts, quotes, research claims, or named anecdotes
- Generic people-skills prose that could fit any self-help communication book
- Tone collapse in required tone objects
- Empty quiz in generate mode
- Plain-string scenario fields
- Contamination phrases in reader-facing prose
- Source-splice leakage

## Book-specific checks
- Part 1 must prove that first impressions are built from visible signals, not inner confidence slogans.
- Part 2 must move through conversational entry, follow-up, and listening without becoming generic small-talk filler.
- Part 3 must keep status, polish, and verbal framing visible.
- Part 4 must preserve insider-language judgment without pretending expertise the reader does not have.
- Part 5 must preserve rapport-building similarity without endorsing fake identity theft or manipulative mirroring.
- Part 6 must distinguish sincere praise from flattery and show where praise backfires.
- Part 7 must stay specific to voice-only communication and not drift into general friendliness tips.
- Part 8 must stay about room-reading, approach choices, and social follow-through.
- Part 9 must preserve tact under social danger, embarrassment, favors, and high-status personalities.

## Scenario rules
- Six examples per structured chapter.
- All scenario, whatToDo, and whyItMatters fields must be tone objects.
- Categories distribute as 2 work / 2 school / 2 personal.
- Scenarios must teach different lessons instead of six copies of "be warm" or "make them feel special."

## Repair boundary
- Fix mechanical issues directly.
- Patch local prose issues locally.
- If a chapter collapses into generic charisma advice or manipulative overclaim, reroute through the brief and outline instead of cosmetic edits.

## Release rule
- Release is assembled only from validated chapter JSON files sorted by chapter number.
- No regeneration, normalization, or improvement during release assembly.
