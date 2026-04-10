#bad-patterns.md
# Anti-Benchmark: Reject These Patterns

Reject writing that:

- could fit almost any chapter in the book
- repeats the same idea at easy, medium, and hard with only extra words
- uses fake-deep mechanism language to sound smarter than the brief supports
- swaps adjectives to simulate tone variation
- uses abstract workplace or relationship scenarios that could belong anywhere
- turns implementation advice into generic life coaching
- relies on sentence skeletons like:
  - "X is not Y. It is Z."
  - "The real issue is..."
  - "What matters is..."
  - "This changes everything."
  - "The difference is..."
- manufactures authority with:
  - neuroscience references
  - hormone references
  - millisecond timing claims
  - evolutionary explanations
  unless the brief explicitly supports them

## Auto-Reject Signals

- opening paragraph could be pasted into another chapter unchanged
- two paragraphs do the same job
- hard depth is just longer medium depth
- examples feel polished but interchangeable
- implementation plan could apply to any chapter in the book
- quiz distractors are too weak to be tempting
- the chapter sounds like a clever content machine instead of a good writer

## Quick Test

If you can imagine swapping the chapter title and keeping 70 percent of the prose, reject it.



## v15 additional auto-reject signals

Reject any run that:

- creates or uses generator scripts that author reader-facing prose from chapter seeds
- assembles final chapter JSON from builder functions instead of from edited prose
- writes validation reports that claim success without checking the actual artifact
- produces scenario fields as plain strings where tone objects are required
- emits empty quiz arrays and calls the chapter complete
- repeats the same sentence across gentle / direct / competitive
- leaks internal scaffolding such as:
  - keep the prose narrow and concrete
  - keep this question alive
  - threshold question
  - reading calibration
- pastes source text into breakdowns without explicit quote permission

Quick contamination test:
If a reader-facing sentence sounds like it belonged in a brief, outline, seed object, or code comment, reject it.
