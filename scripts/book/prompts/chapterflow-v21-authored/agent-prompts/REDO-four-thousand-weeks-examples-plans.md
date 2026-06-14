# REDO — four-thousand-weeks — example de-templating + if-then plan cleanup

**Scope:** quality pass (YELLOW / REVISE), not a rewrite. The book is correct and
well-grounded. Do **not** touch quizzes, breakdowns, facts, or character names —
those passed QC. Two fields change: `examples[*].scenario` (and only the prop
detail inside them) and `implementationPlan.ifThenPlans[*].then`.

## Why this redo exists

QC (claude-qc:4kw-20260609) found **no corruption**: 54/54 sampled quiz keys
correct (ch01/02/05/07/12/14), prose coherent, all named frameworks accurate to
source (Mumford, Crowley, Markovits, James Williams, the Soviet *nepreryvka*,
etc.), names consistent. Gates are GREEN (book-gate PASS, 0 blockers). The book
is held at REVISE for **one pervasive GENERATED_DRAFT signature** plus one prose
tic — both gate-invisible.

### Defect 1 — the "cited-source-as-physical-prop" example recipe (the main fix)

In **every chapter**, all 6 example scenes are built from the same recipe:
*plant the chapter's cited source into the scene as a physical/textual prop, then
have the protagonist perform the chapter's single core-move.* One sentence
template describes all six scenes in each chapter. Verbatim props (ch07):

- ex01: "writes **Douglas Hofstadter and Hofstadter's law** on the margin"
- ex02: "The plaque names **Jorn Utzon, the 1959 construction start, and the 1973 opening**"
- ex03: "**David Cain's phrase** about future time"
- ex04: "a note from **Blaise Pascal's Pensees**"
- ex05: "The fridge note **quotes David Cain**"
- ex06: "the projector shows the **Sydney Opera House**. The slide lists **Jorn Utzon**…"

Same in ch01 (Mumford line / Crowley handout / Mumford footnote / Brooklyn-2014
note ×6) and ch14 (Brian Tracy paperback / von Franz in the notes / Joko Beck /
Bobin note / Brian Tracy book / von Franz note ×6). Across 84 vignettes the
reader sees the cited author named as a prop *every single time* — it reads as
machine-assembled and is the reason this is "not publishable yet."

Root cause: the source sidecar's `requiredBeat` literally says "use [namedExample]
to show X," and the writer instantiated that by dropping the namedExample's
`hardSpecifics` into the scene as a prop. Satisfy the beat **thematically**, not
by staging the citation.

**Fix — per chapter, the cited source may appear as an on-screen prop in at most
~2 of the 6 scenes.** For the other ≥4, illustrate the same idea through the
character's *situation and choice* with no book/author/placard/note present. The
breakdown already carries the citations; the examples do not need to re-stage
them. After the pass, **no single sentence may describe all 6 scenes** of a
chapter, and the protagonist's core-move must arise from the scene's own domain,
not from reading the source on the page.

### Defect 2 — if-then plans double the conditional

`ifThenPlans[*]` repeats the condition inside the action, e.g. (ch01):

- IF: "When a calendar block starts to feel like a test of your value"
- THEN: "**If an hour feels like a verdict, then** Audit the Hour Container: name the demand…"

The `then` should be a **direct imperative** that starts with the verb and the
named tool, with no embedded "If…then…". Rewrite to e.g.: "Audit the Hour
Container: name the demand, name who benefits, and decide what will remain
unfinished." Keep the named tool and the concrete steps; just drop the redundant
inner conditional. Apply to all chapters.

## Must NOT change

- Quiz prompts/choices/`correctIndex`/explanations (all verified correct).
- Breakdown prose, `keyTakeaway`, `counterintuition`, `tryThisNow`, hooks.
- Character names and their role mapping (verified consistent, no collisions).
- `reviewCards`, `memorableLines`, factual content, source anchors.
- The `coreSkill`/named tool in each implementationPlan.

## Done-condition

1. `gate-chapter` on every chapter: **0 blockers** (unchanged).
2. `book-gate four-thousand-weeks`: **0 blockers** (F4 "rather than" may persist;
   trim where natural but it is non-blocking).
3. Per chapter: cited source appears as an on-screen prop in ≤2 of 6 scenes; no
   one-sentence template fits all 6 example scenarios.
4. `ifThenPlans[*].then` contain no embedded "if…then"; each is a direct
   imperative using the chapter's named tool.
5. Hand back for re-QC — the prior attestations go STALE on edit (content hash
   changes), so every edited chapter is re-read before promote.
