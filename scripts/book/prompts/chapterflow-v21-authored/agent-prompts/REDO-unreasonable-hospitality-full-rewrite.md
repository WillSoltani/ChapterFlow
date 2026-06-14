# Redo unreasonable-hospitality — FULL STEP-2 REWRITE (all 20 chapters)

This is **not** a surgical patch. `book-gate unreasonable-hospitality` →
PASS, 0 blockers, 0 majors (only 2 B6 voice-drift minors). Every
`gate-chapter` is 0 blockers. **And the book is unshippable:** all 180 quiz
questions, every example, every review card, and every keyTakeaway are
template-assembled word-salad. This is the same failure the **prior** version
of this book hit (caught 20/20 by AS13) — the regeneration did not fix the
generator, it just **evaded AS13** by rotating 9 different skeletons (one per
question slot) so no single 8-word phrase repeats ≥8× inside one chapter.
Delete the chapter JSONs and regenerate.

## Root cause — a broken composition method (NOT missing content)

The source material is real and specific (Jim Betts and the coffee program,
the $29 two-course lunch, the Miles Davis eleven words, the 95/5 rule, the
Deep Breathing Club, the cocktail-napkin vow). The breakdown prose
(`hook`, `fastRead`, `deepRead`) proves the writer can render it coherently.
The defect is that **quiz / examples / reviewCards / keyTakeaway are
mechanically assembled by splicing source-sentence fragments into fixed
Mad-Libs skeletons** instead of being authored as real, coherent items. The
result is structurally valid (so gates pass) and semantically meaningless.

NOTE: `.chapterflow/` is empty, so on-disk source sidecars are gone even
though the chapters embed real book material. Re-run/locate Step 1 source and
confirm `check-source unreasonable-hospitality` before regenerating.

## What was shipped (verbatim broken output)

**1. `quiz` — 180/180 are fill-in-the-blank skeletons, not questions.** Nine
skeletons rotate across all chapters. The "correct" choice is decided purely
by which container noun it ends in (roster / memo / budget note / training
card / complaint log / shift huddle / handoff sheet / praise note / reset
plan); distractors end in "near the <place>" or "before the handoff." It is a
structural tell, not meaning. ch01 Q1:

> Q: "Imani sees 'Eleven Madison Park ranked 50th at the 2010 World's 50 Best
> Restaurants' beside a hotel desk roster; Product is what you sell, service
> is. What follows?"
> [0]* "Use Imani: Product is what you sell, service is in the roster."
> [1] "Shrink Imani: Most operators believe being better at the near the hotel desk."
> [2] "Repeat Imani: From that scene the argument widens into before the handoff."

None of the three choices is a coherent proposition; several truncate
mid-clause ("being better at the").

**2. `examples[].scenario` — concept-label-as-object Mad-Libs.** ch01-ex01:

> "Imani works the hotel desk at 7:07 morning, with hospitality economy
> written on a hospitality economy guest note. 'Eleven Madison Park ranked
> 50th…' supplies the hospitality economy evidence. … Before Service is black
> and white, doing becomes the default, Imani must pick the hotel desk's next
> service move."

"hospitality economy" is a concept, not an object written on a note; "supplies
the … evidence" and "[time] morning" are template seams. Every chapter's
examples follow this exact frame with names/places swapped.

**3. `examples[].whatToDo` — truncated fragment splice.**

> "Imani should apply Eleven Madison Park ranked 50th… through hospitality
> economy: Most operators believe being better at the product or more
> efficient at service is. Change one hotel desk handoff today."

**4. `reviewCards` — front AND back are word-salad, often starting mid-sentence.**

> front: "Of grinding harder on cuisine, where they: which standard follows?"
> back: "Operators believe being better at the product… is the path to. Use
> The cocktail napkin as the source cue; grinding harder on cuisine, where
> they were already excellent, the two end the night back at."

`Use <source detail> as the source cue` leaks pipeline-internal vocabulary;
fragments truncate ("the path to.").

**5. `keyTakeaway` — 20/20 identical template that leaks pipeline vocabulary.**

> "<Concept> becomes practical when a leader uses a real source cue, chooses
> the feeling to create, and changes the work to support it."

Readers must never see "a real source cue." Each takeaway must state the
chapter's actual lesson in plain language.

**6. `breakdown.fullRead` tail seams (milder).** Coherent until the end, then:
"… names prep for The hospitality economy … travels through The hospitality
economy … closes on design the feeling." Remove these source-title-as-subject
scaffolding sentences.

## What is salvageable (preserve the quality, regenerate cleanly)
- `hook` — genuinely good across chapters; keep this quality.
- `breakdown.fastRead` / `deepRead` — mostly coherent, real teaching prose;
  only fix the "<source title> sets <Concept> in motion" subject seams.

## What MUST be true after the rewrite (per field)
- **quiz** — each question is a real, answerable scenario or concept check with
  three coherent, complete-sentence choices; `correctIndex` points at the
  genuinely correct one; `explanation` says why it is right (not a restatement).
  No question may be solvable by spotting a container noun. No mid-clause
  truncations.
- **examples[].scenario** — a concrete human moment; a concept may be
  *referenced* but never "written on a note," "supplies evidence," etc. No
  "[time] morning" template, no concept-as-object.
- **examples[].whatToDo** — one plain, complete reader instruction.
- **reviewCards** — front is a real question (complete sentence); back is a
  true, complete answer to it. Banned substring: `as the source cue`.
- **keyTakeaway** — the chapter's real lesson in plain prose. Banned substring:
  `uses a real source cue`.
- **breakdown** — remove `names prep for / travels through / closes on
  <Concept>` and `<source title> sets <Concept> in motion` seams.

## Procedure
1. Locate/re-run Step 1 source; confirm `check-source unreasonable-hospitality`
   and read 1–2 sidecars for real named cases.
2. Delete `state/chapters/unreasonable-hospitality-ch{01..20}.v21-native.chapter.json`
   and regenerate all 20 with the current `STEP-2-WRITE-CHAPTERS.md`. The quiz,
   example, and card generators must AUTHOR items, not splice source fragments
   into skeletons.
3. Per chapter: `npx tsx src/cli.ts gate-chapter state/chapters/unreasonable-hospitality-ch{NN}.v21-native.chapter.json` → 0 blockers.
4. `npx tsx src/cli.ts book-gate unreasonable-hospitality` → 0 blockers.

## Done condition (gates are necessary but NOT sufficient)
- Per-chapter gate-chapter: 0 blockers. Book gate: 0 blockers.
- **AND** a human/QC read confirms: no quiz question is answerable by container
  noun; quiz choices and explanations are coherent; no example uses a concept
  as an object or "[time] morning"; no card or takeaway contains
  `as the source cue` / `uses a real source cue`; ch01 Q1's three choices are
  coherent propositions with a correct key.

Report back: per-chapter blocker count, book-gate blocker count, and quote one
rewritten ch01 quiz question (with choices + key + explanation) and one
rewritten ch01 example to demonstrate the fix.

## Escalation
This generator has now produced Mad-Libs assembly for this book **twice**
(AS13-caught, then AS13-evading). If the next regeneration still splices
fragments, change the writer model/approach rather than regenerating again —
the deterministic gates cannot catch this class, so it will keep shipping GREEN.
