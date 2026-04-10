#constraints.md
Hard rules:
- Do not introduce facts, quotes, studies, mechanisms, or anecdotes not present in the chapter brief.
- If the brief is thin, stay narrow instead of inventing depth.
- No em dashes.
- No made-up quotes.
- No filler neuroscience.
- No pseudo-precision.
- No generic recap language.
- If morally gray, frame as strategic awareness, not endorsement.
- No invented authority signals like:
  - mirror neurons
  - oxytocin
  - vagal tone
  - cortisol
  - dopamine
  - evolutionary psychology
  - millisecond timing claims
  unless the brief explicitly supports them.

Banned phrases:
- delve
- crucial
- landscape
- realm
- It's worth noting
- In today's world
- Furthermore
- Moreover
- In conclusion
- at its core
- the art of
- navigating
- harnessing
- robust
- synergy
- paradigm shift
- game-changer
- facilitate
- utilize
- foster
- embark on
- a testament to
- shed light on
- This matters because
- This is significant because
- It is essential to

Quality checks:
- every paragraph must do a distinct job
- no repeated argument loops
- no fake-deep abstractions
- no unsupported mechanism language
- no chapter-generic implementation advice
- no story-shaped filler pretending to be specificity

Auto-fail moves:
- opening with a thesis instead of a live scene or tension
- hiding weak thinking behind smooth phrasing
- using abstraction to avoid choosing a concrete claim


Additional hard rules:
- Do not leak brief language, outline language, or internal instructions into reader-facing prose.
- Do not emit duplicate surfaces such as both `takeaways` and `keyTakeaways`, or sibling `moreDetails` arrays outside `keyTakeaways[]`.
- Do not emit `structuredRecap`, `summary`, `whatChanges`, or any non-canonical recap wrapper inside `contentVariants`.
- Do not restate the chapter thesis more than 3 to 4 explicit times across the full chapter package.
- Do not use the sentence skeleton "X is not Y. It is Z." more than once per chapter package.
- Do not let medium or hard reuse the same opening sentence shape more than once.
- Do not copy exact source prose into breakdowns unless the quote ledger explicitly marks it as allowed.
