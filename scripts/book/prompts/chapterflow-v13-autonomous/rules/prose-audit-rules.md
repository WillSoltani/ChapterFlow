Prose audit rules

These rules are executable expectations, not soft style preferences.

Auto-fail signals:
- exact repeated sentence inside the same reader-facing surface
- exact repeated sentence anywhere else in the same chapter package when it is not structurally required
- consecutive repeated phrase chunk inside one surface
- near-duplicate sentence reuse inside the same chapterBreakdown tone block
- repeated paragraph job inside the same breakdown
- repeated concluding beat inside one breakdown or recap surface
- repeated content-bearing suffix across sibling takeaways, review cards, recap items, prompts, or implementation-plan surfaces
- repeated review-card scaffold across adjacent cards
- generic `moreDetails` that merely paraphrase the takeaway
- thesis-first breakdown openings
- slogan-first competitive openings
- generic prompt surfaces that could fit multiple chapters unchanged
- generic implementation-plan surfaces that could fit multiple chapters unchanged
- reinforcement surfaces that reuse the same stem, opening claim, or closing tail
- repeated clause scaffold more than once inside one breakdown:
  - that is why
  - the point is
  - what changes is
  - the chapter also
  - there is also
  - the final movement
- hard depth that substantially overlaps medium without adding a new function
- medium and hard support surfaces that substantially overlap without new function
- recap text that restates the breakdown instead of compressing or retrieving
- review-card back that merely echoes the key takeaway card or recap wording
- quiz explanations that sound like recap paraphrases instead of chapter-specific mechanism teaching
- Pitch Anything boilerplate tails when `bookId: pitch-anything` is active
- for `bookId: the-one-thing`, support surfaces that narrate the chapter or book instead of teaching directly
- for `bookId: the-one-thing`, support surfaces that rely on abstract leverage metaphors without a practical anchor
- for `bookId: the-one-thing`, recap retrieval formulas that sound templated instead of chapter-earned
- for `bookId: the-one-thing`, competitive support surfaces that stack combat or arena metaphors instead of staying disciplined
- for `bookId: antifragile`, support surfaces that soften into generic resilience, life-advice, or motivational language
- for `bookId: antifragile`, metadata-dirty wrappers whose title, author, edition, provenance, or chapterRange are visibly incomplete
- for `bookId: antifragile`, bridge surfaces that do not point to the actual next conceptual move
- for `bookId: antifragile`, chapters that lose the argument's proper limit and slide into anti-theory, anti-arithmetic, anti-institution, or anti-intervention caricature

Paragraph-role ledger:
- anchor
- mechanism
- tension
- limit
- implication
- bridge

Rules:
- every paragraph must claim one primary role from the ledger
- reusing a role is allowed only when the new paragraph adds clearly new information
- if the paragraph's main claim has already landed, cut or merge it
- each paragraph should land once
- each section should land once
- if a point is already closed, do not reopen it with a slogan ending

Depth differentiation checks:
- easy must deliver one concrete anchor, one clean model, one usable implication
- medium must add mechanism, friction, and application structure
- hard must add at least two of:
  - boundary condition
  - contradiction
  - hidden structure
  - cost
  - synthesis
  - unresolved threshold
- hard fails if it mainly extends medium with paraphrase
- hard also fails if it reuses medium takeaway stems, recap logic, or prompt logic

Memoir fidelity checks for memoir-driven toughness books:
- keep explanations tied to events, bodily stakes, decisions, or correction costs from the brief
- abstract nouns must stay attached to a chapter-specific anchor
- no conquest-poster language
- no final-victory pose when the brief asks for reflection or uncertainty
- for Can't Hurt Me, chapter-family pressure must remain visible:
  - Ch. 1-3: trauma, humiliation, accountability, identity rebuilding
  - Ch. 4-6: bodily cost, service, team burden, anti-glamour suffering
  - Ch. 7-8: strategy, pacing, planning, anti-fake-science framing
  - Ch. 9-10: leadership burden, standard, anti-legend rhetoric
  - Ch. 11: disease, stillness, repair, reconciliation, open future

Repair behavior:
- replace or trim repeated material
- do not append new sentences onto a repeated tail
- when in doubt, make the prose shorter and more specific
- if a support surface repeats another support surface, rewrite the weaker one to do a different job

The One Thing fidelity checks:
- leverage must stay tied to a concrete choice, sequence, or downstream consequence
- review cards, recaps, prompts, and implementation surfaces should almost never mention `the chapter`, `the book`, or chapter numbers
- avoid abstract compression language built from words like field, blade, winner, shadow, path, or aim when a concrete lever is available
- competitive tone should sound clean and consequential, not loud
- recap retrieve should test recall without sounding like a worksheet formula

The Art of War fidelity checks:
- no breakdown paragraph may exceed 120 words; split at the natural thought boundary
- any breakdown with only 1 paragraph is a wall-of-text auto-fail; must have 4-6 paragraphs
- keyTakeawayCard must not exceed 80 words per tone; compress if longer
- review card backs must not exceed 50 words; tighten if longer
- recap retrieve must ask one focused recall question, not compound lists like "reconstruct the five takeaways"
- hard variants must teach the chapter more deeply, not analyze the framework as a system
- block meta-framework language in hard variants: "the competence the chapter assumes," "the sequential structure has a confidence trap," "the argument has a live tension it does not resolve"
- hard may note limits and boundaries only when directly central to the chapter's argument
- competitive tone must not stack heavy abstractions or escalate every paragraph
- competitive tone must not pile substrate/signal/framework/operational language
- prompts and implementation surfaces must feel like bounded reflective exercises, not strategic planning assignments
- activationPrompt should be one focused question or exercise, not a multi-step compound instruction

Antifragile fidelity checks:
- preserve Taleb's payoff-aware skepticism without collapsing into generic toughness rhetoric
- keep downside, exposure, optionality, asymmetry, intervention risk, nonlinearity, opacity, or survival logic visible when the chapter depends on it
- reject motivational or therapeutic drift in breakdowns and support surfaces
- require a real chapter-specific bridge into the next concept where the chapter is carrying a structural handoff
- require a visible boundary where the chapter could otherwise become caricature
- treat dirty metadata and weak wrappers as production failures, not cosmetic warnings
