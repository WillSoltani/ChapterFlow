Prose audit rules

These rules are executable expectations, not soft style preferences.

Auto-fail signals:
- exact repeated sentence inside the same reader-facing surface
- exact repeated sentence anywhere else in the same chapter package when it is not structurally required
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
