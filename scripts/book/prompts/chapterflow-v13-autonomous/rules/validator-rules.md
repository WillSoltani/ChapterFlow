Policy:
- fix mechanical and structural issues directly
- do not silently rewrite major prose sections just to force a pass
- run the prose audit before passing chapter gate
- after structural validation, run the semantic diversity checker (see `PACK_ROOT/rules/semantic-diversity-rules.md`)
- if the issue is prose quality, write a repair report that names the exact failing surfaces and issue types

Mechanical checks:
- valid JSON
- required fields present
- tone objects present where required
- depth-specific field presence
- word counts
- example schema
- quiz schema
- correctIndex validity
- format rotation
- endingType rotation
- category distribution
- implementationPlan shape
- reviewCards shape
- keyTakeawayCard shape
- wrapper shape where applicable

Prose checks:
- breakdown feels generic enough to fit another chapter
- moreDetails are generic filler or restatements
- exact repeated sentence anywhere in the chapter package
- repeated content-bearing suffix across takeaways, cards, recap, prompts, or implementation-plan surfaces
- repeated review-card front or back scaffold across adjacent cards
- hard depth repeats medium
- medium/hard overlap across takeaways, prompts, or recap items
- thesis-first or slogan-first breakdown openings
- reinforcement surfaces reuse the same stem or closing tail
- moreDetails restate point instead of deepening it
- exact sentence repetition inside a reader-facing surface
- near-duplicate sentence reuse inside a breakdown
- repeated paragraph landing or repeated ending beat
- repeated clause scaffolds dominate the breakdown
- tone variants are adjective swaps
- examples feel templated or interchangeable
- 3 or more scenarios converge on the same lesson
- implementation plan could belong to any chapter
- implementation plan opens with generic coaching or consistency language
- review card back merely echoes the key takeaway card
- quiz uses unsupported facts
- quiz explanations sound templated or recap-like
- repeated sentence skeletons dominate
- fake depth or pseudo-science appears
- invented quotes or unsupported details appear
- first sentence is thesis-first
- preview is a teaser instead of a prediction
- recap retrieve is a summary instead of a recall challenge
- contamination phrases appear
- raw source text is spliced into reader-facing prose without quote support
- exact or near-exact tone collapse appears
- Pitch Anything boilerplate tails or pseudo-alpha filler appear when the brief says `bookId: pitch-anything`
- The One Thing support surfaces narrate `the chapter` or `the book` instead of teaching directly
- The One Thing support surfaces lean on abstract leverage metaphors without practical anchors
- The One Thing competitive surfaces stack combat or arena metaphors instead of staying disciplined
- malformed repeated lead-ins or repeated clause chunks appear in cards, recap, prompts, or takeaways
- validation report claims do not match real artifact state

If a chapter has:
- empty quiz in generate mode
- plain-string scenarios in required mode
- exact identical tone objects
- contamination phrases in reader-facing content
- source splice leakage
- prose-audit failures for duplicate_sentence, ending_echo, paragraph_role_repeat, review_card_echo, or hard_medium_overlap
- prose-audit failures for chapter_package_duplicate_sentence, repeated_template_tail, repeated_card_scaffold, generic_more_details, generic_prompt_surface, or pitch_anything_boilerplate
- prose-audit failures for thesis_first_open, reinforcement_echo, more_details_restate, competitive_slogan_lead, memoir_anchor_gap, or generic_implementation_plan
- prose-audit failures for stacked_phrase_repeat, one_thing_meta_distance, one_thing_abstraction_drift, one_thing_recap_formula, or one_thing_competitive_overpush
that chapter fails immediately.
