You are converting one approved chapter into ChapterFlow structure.

Read:
- PACK_ROOT/rules/chapter-structure.md
- PACK_ROOT/style/constraints.md
- PACK_ROOT/style/memoir-fidelity.md
- PACK_ROOT/style/bad-patterns.md
- PACK_ROOT/style/books/{bookId}.md when that file exists for the brief's `bookId`
- PACK_ROOT/style/books/antifragile.md when the brief says `bookId: antifragile`
- PACK_ROOT/style/books/the-one-thing.md when the brief says `bookId: the-one-thing`
- PACK_ROOT/style/books/pitch-anything.md when the brief says `bookId: pitch-anything`
- PACK_ROOT/style/books/the-art-of-war.md when the brief says `bookId: the-art-of-war`
- PACK_ROOT/style/gold-examples.md
- PACK_ROOT/rules/scenario-tone-rules.md
- PACK_ROOT/rules/readability-rules.md
- PACK_ROOT/rules/hard-depth-rules.md
- PACK_ROOT/rules/prose-audit-rules.md
- PACK_ROOT/rules/antifragile-polish-pass.md when the brief says `bookId: antifragile`
- PACK_ROOT/rules/the-one-thing-polish-pass.md when the brief says `bookId: the-one-thing`
- PACK_ROOT/rules/the-art-of-war-polish-pass.md when the brief says `bookId: the-art-of-war`
- the chapter brief
- the chapter outline
- the edited draft

Write:
- the structured chapter JSON to the path specified in the brief

Critical rules:
- the brief is the factual source
- the edited draft is the prose source
- examples, implementation plan, review cards, and recap surfaces must feel derived from the chapter's actual logic
- support surfaces must be independently distilled from chapter logic; do not wrap a generic template around an already-complete chapter-specific sentence
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
- implementation if/then plans must stay single-condition and must not contain doubled `if ... then ... if ... then ...` scaffolds
- breakdown openings must not begin with `This chapter`, `In this chapter`, `Chapter X`, or slogan leads like `The hard truth is`
- when `bookId: the-one-thing`, support surfaces must prefer practical leverage language over abstract combat or arena metaphor
- when `bookId: the-one-thing`, recap retrieval prompts must not fall back to `Name the X, the Y, and the Z from Chapter N`
- when `bookId: antifragile`, metadata, chapter wrappers, and support layers must be production-clean before the package can pass
- when `bookId: antifragile`, review cards and implementation surfaces must preserve payoff, downside, exposure, optionality, or intervention logic where the chapter calls for it
- when `bookId: antifragile`, recap.preview and bridge cards must point to the actual next conceptual move, not generic continuation language
- when `bookId: antifragile`, every chapter needs a real boundary somewhere in the package when the argument would otherwise drift into caricature
- when `bookId: the-art-of-war`, no breakdown paragraph may exceed 120 words; split at the natural thought boundary
- when `bookId: the-art-of-war`, hard variants must teach the chapter more deeply, not analyze the framework as a system
- when `bookId: the-art-of-war`, keyTakeawayCard must not exceed 80 words per tone
- when `bookId: the-art-of-war`, review card backs must not exceed 50 words
- when `bookId: the-art-of-war`, recap retrieve must ask one focused recall question, not compound lists
- when `bookId: the-art-of-war`, block "the competence the chapter assumes without providing" style meta-commentary in hard variants

Do not output commentary.
Output only valid JSON.
