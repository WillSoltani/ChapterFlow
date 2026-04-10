You are converting one approved chapter into ChapterFlow structure.

Read:
- PACK_ROOT/rules/chapter-structure.md
- PACK_ROOT/style/constraints.md
- PACK_ROOT/style/memoir-fidelity.md
- PACK_ROOT/style/bad-patterns.md
- PACK_ROOT/style/books/pitch-anything.md when the brief says `bookId: pitch-anything`
- PACK_ROOT/style/gold-examples.md
- PACK_ROOT/rules/scenario-tone-rules.md
- PACK_ROOT/rules/readability-rules.md
- PACK_ROOT/rules/hard-depth-rules.md
- PACK_ROOT/rules/prose-audit-rules.md
- the chapter brief
- the chapter outline
- the edited draft

Write:
- the structured chapter JSON to the path specified in the brief

Critical rules:
- the brief is the factual source
- the edited draft is the prose source
- examples, implementation plan, review cards, and recap surfaces must feel derived from the chapter's actual logic
- hard depth must preserve the outline's threshold question
- tone must differ in function, not merely volume
- no fake analytical prestige during conversion
- no seed-language leakage
- no reader-facing surface may repeat a sentence or paragraph claim that already landed elsewhere in the same depth
- no reinforcement surface may fall back to reusable template tails or stock suffixes
- if the book is memoir-driven, keep event, body, and cost visible in the breakdown itself
- if a book-specific style contract exists, treat it as binding during breakdown, recap, cards, prompts, quiz-facing logic, and implementation surfaces

Specific quality rules:
- moreDetails must extend, not repeat
- every `moreDetails` field must add one of: mechanism, limit, failure mode, or operational implication
- every surface must justify itself with a distinct job:
  - keyTakeawayCard = distilled thesis
  - reviewCards = retrieval hooks
  - recap.retrieve = memory test
  - recap.connect = mechanism/consequence bridge
  - recap.preview = prediction
  - implementationPlan = concrete application
  - moreDetails = deepening, not retelling
- easy mode must stay readable for grade 8-9
- medium and hard may deepen, but not become reporting on the chapter
- easy must deliver one clean model and one usable implication without a second landing
- medium must add mechanism, friction, and application structure
- hard must add boundary plus synthesis or contradiction, not just more language
- medium and hard must feel separately authored, not like the same stems with expansion
- hard must not share medium's opening claim, threshold answer, or landing sentence
- scenario tone objects are mandatory in flagship mode
- preview must prompt prediction, not narrate the next chapter
- retrieve must ask for recall, not summarize for the reader
- review cards must not echo the key takeaway card
- review card fronts and backs must vary in rhetorical form across the set
- recap surfaces must compress or retrieve, never replay the breakdown
- key takeaways must compress insight instead of restating breakdown logic
- prompts and implementation-plan surfaces must be chapter-specific, not reusable coaching language
- breakdown openings must not begin with `This chapter`, `In this chapter`, `Chapter X`, or slogan leads like `The hard truth is`

Do not output commentary.
Output only valid JSON.
