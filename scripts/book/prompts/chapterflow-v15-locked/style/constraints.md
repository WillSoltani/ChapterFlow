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


Additional v15 hard rules:
- No internal instruction leakage into reader-facing output.
- Do not echo or paraphrase internal control notes such as:
  - keep the prose narrow and concrete
  - keep this question alive
  - threshold question
  - reading calibration
  - unsupported zones
  - used lazily, the point turns into
  - keep the judgment close to the source
- No raw source splice into breakdowns unless the brief explicitly allows a short quote or near-quote.
- No builder-language in output:
  - keep X visible
  - tie Y to the live constraint
  - the source is short
  - this section should
- No direct chapter/object narration inside learning surfaces.
- Scenarios, whatToDo, whyItMatters, prompts, and quiz explanations must never be plain strings when the schema expects tone objects.
- No synthetic "drafts" that are really structured content dumps. Canonical prose must read like prose, not like depth-block assembly.

Auto-fail additions:
- internal note leakage
- raw source spill pasted into learning prose
- identical or near-identical tone variants
- empty quiz.questions array at chapter gate unless the manifest explicitly defers quiz generation
- release assembly from anything other than validated chapter artifacts
