# Redo the-let-them-theory (ROUND 2) — Step-2 assembly is still word-salad

**Source is now GOOD. Do NOT re-run Step 1. Do NOT touch the sidecars.** The
round-1 rewrite fixed the empty-source root cause — the run
`.chapterflow/runs/the-let-them-theory/20260603-053527/` has real, structured
notes per chapter (focus, coreClaim, centralConcept, keyClaims, namedExamples,
voiceCues, paraphraseNotes). The problem now is entirely in how Step 2 turns that
good source into chapter fields: it is slot-filling a rigid template instead of
writing prose. This is a full re-author of the 20 chapter JSONs, source untouched.

## ⚠️ The gate passes this. Reading is the only check that works.
`book-gate the-let-them-theory` reports **PASS — 0 blockers, 0 majors, no
findings**, and every `gate-chapter` is 0 blockers. The content is still
word-salad. The detectors are defeated because a *unique real-source fragment* is
spliced into each templated field, diluting cross-chapter n-gram overlap below
the AS5/AS6/BP thresholds. **Do not report this fixed on gate output. Read it.**

## The four corruption patterns that are STILL present (all 20 chapters)

**1. `breakdown` template loop (every tier, worst in fullRead).** After 1–3 real
sentences, each tier emits a rotating loop with truncated source clauses:
> "Full layer returns to the rainy sendoff so trying to keep everyone satisfied
> usually makes the. Full reading keeps the rainy sendoff near oakley's prom-night
> taco shows the fastest path back. Full limit checks the rainy sendoff against the
> easy misreading is permissiveness: let everyone do."
(ch10: "Full layer returns to the desire map so most desired outcomes, such as
fitness, friendship, business." ch20: "Full layer returns to the Ending case
ending so strong relationships need both people to want the.") Every chapter has
7–9 of these "<tier> layer returns to the …" lines. **Delete this construction
entirely.** Each breakdown tier must be original explanatory prose; the three
tiers must be progressive (fast = gist, deep = mechanism, full = nuance/limits),
not three reshuffles of the same fragments. No sentence may end mid-clause.

**2. `keyTakeaway` is grammatically broken in every chapter** — missing subject
after "because", and truncated:
> ch01: "Control separation matters here because asks where attention is leaking:
> Other people's behavior, thoughts, and feelings are outside personal control;
> peace returns when attention."
> ch10: "Comparison as teacher matters here because treats envy as a recipe clue:
> … comparison should."
> ch20: "Deal breaker decision matters here because honors deal breakers without
> contempt: … want to work on."
Rewrite as one complete sentence stating the chapter's takeaway in plain English.

**3. `examples[]` use the scene-label as a physical object, in random ungrounded
domains.** Same skeleton every chapter, names/domains rotated:
> ch01: "Asha studies the taco plan notes beside the taco plan note at the clinic
> station." (domain "clinic station founder")
> ch10: "Esti studies the renovated house notes beside the renovated house note at
> the jobsite trailer." ch20: "Opal studies the ADHD chaos notes beside the ADHD
> chaos note at the soundstage."
The labels ("taco plan", "renovated house", "ADHD chaos") are this chapter's real
anecdotes — but they're being treated as inert nouns ("the X note", "X keeps
<truncated source claim>"), and the protagonists/settings are invented filler
unrelated to the book. Write real scenarios grounded in the chapter's
`namedExamples`: a named person in a concrete, relevant situation makes a decision
that demonstrates the concept. The concept/anecdote is something you *narrate*,
never a noun you slot in. `whatToDo`/`whyItMatters` must be complete sentences,
not a label glued to a truncated source claim.

**4. `quiz` is one skeleton across all 20 chapters; prompts truncate mid-sentence;
choices contain truncated-fragment nouns.** Verbatim:
> prompt (ch01 q1): "Taco plan: Let Them is not indifference; it. Asha is in the
> clinic station; what answer protects the attention leak."
> choices repeat across chapters: "<Name> chooses an <X> response after naming the
> <Y> limit." / "<Name> hides behind <X> and leaves the <Y> boundary unnamed." /
> "<Name> waits around the <X> for certainty before acting."
> choice (ch01 q3): "Wren converts oakley's prom-night taco shows the fastest into
> pressure about rainy sendoff." ← a truncated source fragment used as a noun.
Each `prompt` must be one coherent question (no mid-sentence cut, no bare label
prefix). Each `choice` must be a complete, standalone proposition — distractors
plausible-but-wrong, not the same three templates with nouns swapped. `explanation`
must justify the keyed choice, not restate it. Vary the question stems across
questions and across chapters. `correctIndex` must point at the genuinely correct
choice (right now the "good behavior" choice is structurally guessable — fix the
content, not just the index).

Also fix the **splice-seams** in `reviewCards[].back` and `implementationPlan`
("…the most powerful The distortion is…", "use oakley's prom-night taco shows the
fastest path back to peace is to let other. as the first filter") — truncated
source fragment + label jammed together. Every back/plan field must be complete
sentences.

## What you do NOT change
- The source sidecars and `state/indexes/the-let-them-theory.json`.
- `hook` and `counterintuition` — these are already clean; preserve their quality.

## Why a redo, not another field-shuffle
This is the SECOND time the writer produced fragment-assembly word-salad that
passed a GREEN gate (round 1 was blamed on empty source; source is now good and
the same templating recurs). The writer agent is defaulting to a slot-filling
assembler regardless of source. **Recommendation to the user:** if a third pass
with the same writer/model reproduces the "<tier> layer returns to the …" loop or
the cross-chapter quiz skeleton, change the writer model rather than re-prompting.

## Procedure
1. Re-author all 20 chapter JSONs from the existing good source. Original prose in
   every field — no template loops, no label-as-noun, no truncated fragments.
2. Per chapter: `npx tsx src/cli.ts gate-chapter state/chapters/the-let-them-theory-ch{NN}.v21-native.chapter.json` → 0 blockers.
3. `npx tsx src/cli.ts book-gate the-let-them-theory` → 0 blockers.
4. **Then READ ch01 + ch10 + ch20 end to end yourself.** Confirm: no "layer
   returns to the" lines anywhere (`grep -c 'layer returns to the'` must be 0 in
   every chapter), keyTakeaway is a complete sentence, examples are coherent and
   grounded, every quiz prompt/choice is a complete sentence, every quiz key
   matches its explanation.

## Done condition
- `grep -l 'layer returns to the' state/chapters/the-let-them-theory-ch*.json` → no matches.
- No field ends mid-clause; no scene-label used as a noun-object.
- Per-chapter gate-chapter: 0 blockers. Book gate: 0 blockers.
- Your own read of ch01/ch10/ch20 confirms coherence + correct quiz keys.
- Report: per-chapter blocker counts, book-gate count, and 2–3 sentences on what
  you verified by reading (not gate output).
