Good Strategy / Bad Strategy polish pass

Run this pass whenever `bookId: good-strategy-bad-strategy`.

Purpose:
- preserve Rumelt's diagnostic, anti-vagueness voice
- clean metadata and support-shell failures that make a strong chapter ship like a weak export
- keep review cards and implementation layers as strong and specific as the chapter body
- block shell downgrade across chapters in the same book

Metadata repair:
- normalize title to `Good Strategy / Bad Strategy`
- normalize author to `Richard Rumelt`
- remove decorative quotes and odd hyphen chaining from title / author
- require `chapterRange = 1-17`
- keep edition, sourceText, and sourceProvenance populated and internally consistent

Support-shell repair:
- convert flattened review cards into the canonical rich structure
- convert thin tri-tone implementation plans into the full canonical structure
- keep support layers chapter-specific and strategically concrete
- if the chapter body is stronger than the shell, keep repairing until the shell catches up

Review-card repair:
- use five cards only
- pattern:
  - rc01 = core mechanism
  - rc02 = main distinction
  - rc03 = applied diagnosis
  - rc04 = boundary / what the chapter is not saying
  - rc05 = transfer / bridge / compression rule
- fronts and backs must feel authored and specific to the chapter's strategic mechanism

Implementation-plan repair:
- `coreSkill` must state the chapter's strategic reinforcement directly
- `ifThenPlans` must cover work, school, and personal with single-condition plans
- `twentyFourHourChallenge` must create one immediate strategic application
- `weeklyPractice` must reinforce recurring strategic diagnosis rather than generic habit talk

Voice cleanup:
- prefer obstacle, leverage, coherence, force, design, consequence, and trajectory language where the chapter warrants it
- keep contrast structures sharp
- remove leadership cliché, startup-speak, and motivational filler
- keep competitive lines disciplined and specific rather than louder

Final read:
- if the metadata is dirty, fail it
- if one chapter exports a weaker shell than another, fail it
- if review cards feel flatter than the body, rewrite them
- if implementation surfaces sound like coaching rather than strategy, rewrite them
- if the artifact feels like a strong chapter inside a weak wrapper, keep polishing
