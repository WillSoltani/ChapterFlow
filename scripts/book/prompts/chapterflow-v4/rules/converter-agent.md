You are converting one approved chapter into ChapterFlow structure.

Read:
- `scripts/book/prompts/chapterflow-v4/rules/chapter-structure.md`
- `scripts/book/prompts/chapterflow-v4/style/constraints.md`
- `scripts/book/prompts/chapterflow-v4/style/bad-patterns.md`
- `scripts/book/prompts/chapterflow-v4/style/gold-examples.md`
- the chapter brief
- the chapter outline
- the edited draft

Write:
- the structured chapter JSON to the path specified in the brief

All structural rules for JSON shape, depth logic, word counts,
example schema, implementation plan, review cards, and field
requirements live in chapter-structure.md. This file adds
quality rules that apply on top of those structural requirements.

## Job

Adapt approved prose into ChapterFlow structure without inventing
new truth.

## Critical Rules

- The brief is the factual source.
- The edited draft is the prose source.
- Examples, implementation plan, and review cards must feel
  derived from the edited draft's real logic.
- Hard depth must add tension, limitation, boundary condition,
  or synthesis. If it only restates medium, it fails.
- Tone must differ in function, not merely volume.
- No fake analytical prestige added during conversion.

## Quality Rules

### moreDetails Must Be Additive

moreDetails must introduce information, mechanism, nuance, or
limitation that the parent point does not contain. If the first
sentence of moreDetails restates the point's core claim, rewrite
it to extend rather than repeat. The reader should learn something
new by opening the expansion.

### Prompt Quality

Activation prompts (medium and hard):
- Must end with a question mark or contain an imperative verb
- Must ask the reader to do, recall, or notice something specific
- Must not merely describe what the chapter covers
- Must be a complete sentence with no truncation

Self-check prompts:
- Must contain question marks
- The two hard self-check prompts must ask genuinely different
  questions, not the same question reworded
- All three tones must ask from different angles

Prediction prompts (hard only):
- Must ask the reader to predict something specific about the
  next chapter
- Must reference a concept from the current chapter the reader
  can use as a prediction framework
- Must not read as a passive preview or teaser
- If it contains no question mark and no imperative, it is a
  teaser and must be rewritten

Recap retrieve sections (medium and hard):
- Must be phrased as recall challenges, not pre-written summaries
- Use questions or imperatives: "From memory, reconstruct..."
  or "Without looking back, name..."
- If the retrieve section contains 3+ declarative sentences
  with no questions or imperatives, it is a summary and must
  be rewritten as a retrieval challenge

### Tone Collapse Prevention

Before writing any tone object, verify that all three variants
differ in framing, vocabulary, and cognitive angle. If two tones
produce near-identical text, stop and rewrite from the distinct
perspective of each tone. Gentle reframes for reflection. Direct
diagnoses mechanism. Competitive frames strategic advantage. If
you cannot articulate what makes each tone different for a
specific field, the field is collapsed.

### Scenario Lesson Diversity

Each scenario's whatToDo must teach a distinct application of the
chapter's principle. If two whatToDo sections give the same core
recommendation, one must be rewritten to cover a different aspect.
Check against the scenario lesson map in the chapter outline.

### Banned Patterns (in addition to constraints.md)

- "The person who" or "The player who" max 3 times per chapter
  in competitive tone fields
- No repeated opening or closing sentence shapes within a
  chapter section

## Takeaway Ranges

- Easy: exactly 3
- Medium: 5 to 6
- Hard: 5 to 7

Use the count locked in the chapter outline. Do not exceed it.

## Final Step

Do not output commentary. Output only valid JSON.