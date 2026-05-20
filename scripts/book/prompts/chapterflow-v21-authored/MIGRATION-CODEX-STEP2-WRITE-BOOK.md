# ChapterFlow v21 Codex Step 2, Full-Book Writing With Checkpoints

You are the writer for one complete ChapterFlow v21 book, but you must write it one chapter at a time from persisted plans.

This is one Codex session if possible, but not one continuous draft. The checkpoint script is the guardrail. After each chapter, run it. If it fails, rewrite before moving on.

## Inputs from the user

The user will provide:

```text
Target book:
- bookId: <bookId>
- title: <Title>
- author: <Author>
- source package: book-packages/<bookId>.modern.json
- chapter index: scripts/book/prompts/chapterflow-v21-authored/state/indexes/<bookId>.json
- output package: book-packages/<bookId>.v21.json
- categories: ...
- tags: ...
```

## Forbidden in Step 2

- Do not use helper scripts to generate prose.
- Do not loop through arrays of names, cities, domains, or objects to create examples.
- Do not write multiple chapters from one reusable frame.
- Do not promote the book.
- Do not call Anthropic CLI.
- Do not call OpenAI API.
- Do not set `CHAPTERFLOW_PROVIDER`.
- Do not call model-backed generation scripts.
- Do not use the categorizer.

## Required reading before writing

```bash
cat scripts/book/prompts/chapterflow-v21-authored/MIGRATION-CODEX-3STEP-PROMPT.md
cat scripts/book/prompts/chapterflow-v21-authored/state/briefs/<bookId>.manual-brief.json
cat scripts/book/prompts/chapterflow-v21-authored/state/books/<bookId>.chapter-core-map.json
cat scripts/book/prompts/chapterflow-v21-authored/state/books/<bookId>.manual-generation-ledger.json
cat scripts/book/prompts/chapterflow-v21-authored/state/indexes/<bookId>.json
cat scripts/book/prompts/chapterflow-v21-authored/src/types.ts | sed -n '305,390p'
cat scripts/book/prompts/chapterflow-v21-authored/prompts/writer-example.system.md
```

Inspect current status:

```bash
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/scratch/codex-book-status.ts <bookId>
```

## Main loop

For each missing chapter, in chapter-number order:

1. Read the chapter's manual plan.
2. Read the source sidecar if present.
3. Write exactly one `ChapterV21` JSON file.
4. Save it to `state/chapters/<chapterId>.v21-native.chapter.json`.
5. Run the checkpoint script.
6. If the checkpoint fails, rewrite the chapter structurally and rerun it.
7. Update the manual ledger with names, domains, frames, anchors, rejected frames, and checkpoint status.
8. Move to the next chapter only after the checkpoint passes.

Manual plan path:

```text
scripts/book/prompts/chapterflow-v21-authored/state/plans/<chapterId>.manual-plan.json
```

Source sidecar path when present:

```bash
LATEST_RUN=$(ls -t .chapterflow/runs/<bookId> 2>/dev/null | head -1)
sed -n '1,260p' .chapterflow/runs/<bookId>/$LATEST_RUN/sidecars/source/chNN.source.txt 2>/dev/null
```

Chapter save path:

```text
scripts/book/prompts/chapterflow-v21-authored/state/chapters/<chapterId>.v21-native.chapter.json
```

Checkpoint command after every chapter:

```bash
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/scratch/codex-qc-chapter.ts <bookId> <chapterId>
```

Progress command after every 3 chapters and at the end:

```bash
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/scratch/codex-book-status.ts <bookId> --gates
```

## Chapter field standards

### hook

60 to 140 characters. Concrete image or sharp chapter-specific tension. Do not use `<chapter title>:`. Do not reuse any hook skeleton from the ledger.

### counterintuition

80 to 400 characters. Name the actual mistaken move for this chapter and the better move. Do not use a reusable `Most people assume... but actually...` frame.

### tryThisNow

80 to 220 characters. One specific 30 to 90 second action, unique to this chapter. Do not start with a generic timer prompt unless the source is literally about a timed drill and the ledger has not used that frame.

### breakdown tiers

- `fastRead`: 400 to 700 chars, scene plus rule.
- `deepRead`: 1200 to 1800 chars, mechanism plus second scene plus limit.
- `fullRead`: 2500 to 3500 chars, depth plus counter-objection plus source-specific nuance.

Use plain words. A grade 10 to 12 reader should move easily. Depth means more useful detail, not harder vocabulary.

At least 60% of paragraphs should open with a concrete anchor: a person doing something, a direct second-person situation, an imperative, or a specific time/place.

### Source fidelity inside the breakdown (top-of-category requirement)

The plan ships with `sourceAnchors`. Land at least one anchor in either `deepRead` or `fullRead` for every chapter that has anchors, exactly as the `phrasingHint` suggests. This is the single most important quality differentiator versus Blinkist, Headway, Lucid, and Shortform — they keep the book's famous anecdotes; if we strip them out and replace them with fictional protagonists only, a reader who knows the book will feel the substitution.

Rules:

- The `name` and `detail` must come from the actual source. Do not invent figures, studies, dates, or places. If the plan has no anchors for this chapter, that is fine — write fictional only.
- The anchor must read like prose, not like a citation. Aim for the rhythm "Carl Jung built a stone tower at Bollingen for the same reason — a body learns where deep thinking is allowed to live." Avoid "The author cites Jung's tower as an example" — that breaks the B1 meta-reference rule.
- Do not name the author. Do not say "the book," "this chapter," or "the author." Land the real figure or study inside the prose as a natural reference, the way a magazine essay would.
- A single chapter can hold one or two anchors comfortably. Do not stack four or more — at that point the chapter becomes a list of names instead of a teaching.

### Rhythm variety inside the breakdown

Honor the plan's `rhythmVariety` block on every chapter. Concretely:

- `deepRead` must contain a paragraph of 3 sentences or fewer, a paragraph of 5 sentences or more, and at least one one-sentence punch line that stands on its own.
- `fullRead` must contain at least one paragraph that breaks the standard "concrete scene -> abstract rule -> elaboration" loop. Acceptable interludes: a direct question to the reader, a brief research aside built around the chapter's source anchor, a second-person "you" passage, or a short historical reference.
- Do not let every paragraph follow the rhythm "concrete anchor sentence -> abstract rule sentence -> elaboration sentence." That is the rhythm a careful reader feels as repetition even when the words vary.

### examples

Use the six planned `exampleSpecs`. Each scenario opens on a concrete image in the first 80 characters, includes time/place/role detail, and forces the required beat.

#### Protagonist names — target audience Canada, US, Europe

The app's readers are mostly Canadian, American, and European. Pick protagonist names that read naturally to that audience: common Anglophone names (Sarah, Emily, Daniel, James, Owen, Claire, Hannah, Ryan), French/Québécois (Camille, Mathieu, Léa, Antoine), German/Dutch/Scandinavian (Lukas, Felix, Ingrid, Lena, Anders), Italian/Spanish/Portuguese (Marco, Luca, Sofia, Giulia, Diego, Catarina), Eastern European (Anya, Tomasz, Marta, Petra), or diaspora names that read naturally in those cities (Aanya, Kiran, Yusuf, Lin) used sparingly when the scene domain supports them (e.g., a Toronto tech team, a London hospital).

Mix rule per chapter (6 protagonists): roughly 4 from the common Anglophone / Western European pool, 1 to 2 from less-common European or diaspora names. Avoid clustering six unusual names in one chapter — one or two land, six in a row breaks immersion for the target reader.

Hard avoids:

- The C7 banned-pool list at [src/agents/writer-example.ts](src/agents/writer-example.ts) (Priya, Omar, Maya, Marcus, Elena, Lena, Victor, Theo, Jonah, Mateo, Tessa, Owen, Mira, Malik, Nadia, Felix, Caleb, Talia, Elise, Naomi) — exhausted from v13, will trip the gate.
- Cross-book ledger names — the librarian flags names used in adjacent recent books; pick from the wider palette.
- Within one chapter, no two examples share the same first name.
- Names that look invented or that a North American or European reader will stumble over silently. If you have to think about how to pronounce it, the reader will too.

Use the plan's `usedProtagonistNames` ledger to avoid duplicates inside the book.

Examples are the teaching engine. They must not be six decorations around the same abstract lesson.

Each example must be independently conceived. If two scenarios would still look similar after removing names and times, rewrite one from the ground up.

Known failure guardrail: every non-retrospective example format (`scene`, `vignette`, `dialogue`, `decision_point`, `predict_reveal`, `thought_experiment`) must include an explicit decision cue in the scenario, such as `must decide`, `has to choose`, `is about to decide`, `hovers over`, or `before <event>, she/he must decide`. Do not rely on an implied tension. Only `postmortem`, `reflection`, and `before_after` can pass without a forward decision cue.

#### Opening-device diversity (the hidden template trap)

The plan locks each example's `openingDevice`. Honor it. At most 2 of the 6 examples may open with the pattern `At HH:MM <day>, <Name> <verb>s…`. The C8 critic does not catch this — readers do.

The seven opening devices and how each one should read in the first sentence:

- `timestamp_named`: `At 8:21 a.m. Tuesday, Sarah opens her laptop…` — the default; cap at 2 per chapter.
- `dialogue_first`: `"Can we do a daily status call?" the client asks before Daniel has poured his coffee.` — speech leads.
- `sensory_first`: `The brake pedal sticks half a centimeter low for the third morning in a row.` — a detail before any person.
- `second_person`: `You have forty minutes before the standup and three open browser tabs that all want to be read.` — direct address.
- `retrospective`: `It took Emily three weeks to notice that the daily status call was costing her the analysis.` — looks back from after the decision.
- `question_hook`: `Which costs more, an hour of meetings or an hour of focus you never get back?` — a question first; the named scene follows in sentence two.
- `environmental`: `The newsroom at 6:48 p.m. is louder than the deadline allows.` — place before person.

Mix these so a reader hitting example 4 does not feel they have already read examples 1, 2, and 3.

### quiz

9 questions. Every prompt is a new scenario. Every explanation is unique and specific to the prompt and answer choices. The explanation should mention why the correct choice fits the chapter move and why at least one tempting wrong choice fails.

Balance `correctIndex` across 0, 1, and 2. No single position above 45%.

### reviewCards

3 to 5 cards. Fronts are retrieval-framed: a small situation plus a question. Backs teach the move.

### implementationPlan

4 if-then plans across different contexts. Each plan should be a concrete trigger and response. The 24-hour challenge must be specific to this chapter.

### memorableLines

Exactly 3. Each `.text` must appear verbatim in one of the three breakdown tiers.

## Pre-check polish pass

Before running the checkpoint for a chapter, do a quick local pass for issues the gate/scorer commonly finds:

- No breakdown tier should repeat the same paragraph opener twice, especially `At the`, `This is`, `There is`, `Boredom is`, or `A deep`.
- Do not repeat a 4- to 6-word thesis phrase across `fastRead`, `deepRead`, and `fullRead`; restate the idea with chapter-specific wording instead.
- `counterintuition` should contain a clear paradox or contrast signal while still avoiding reusable `Most people assume... but actually...` framing.
- Quiz prompts should average about 150+ characters and include concrete scene detail, not only a generic role plus choice.
- Count opening devices across your 6 examples. If 3 or more begin `At HH:MM…<Name>…`, rewrite the openings of all but two of them.
- If the chapter plan lists any `sourceAnchors`, verify the named figure or study actually appears in `deepRead` or `fullRead` before saving. A missing anchor means a missed differentiator; rewrite the affected tier to land it naturally.
- Read `deepRead` aloud for rhythm. If every paragraph has the shape "scene anchor sentence -> abstract rule -> elaboration," rewrite one paragraph to break the loop with a short punch line, a research aside, or a direct second-person passage.

## Stop conditions

Stop writing and rewrite the current or previous chapter before continuing if:

- checkpoint fails
- pattern audit blocks
- two quiz explanations sound interchangeable
- two examples share the same scene choreography after names/times are stripped
- three or more examples in one chapter open with the timestamp-and-name pattern
- the chapter plan lists source anchors and none of them appear in the breakdown
- the chapter uses the book's general theme but not the chapter's specific source pressure
- every paragraph in `deepRead` or `fullRead` follows the same scene-then-rule rhythm
- you find yourself saying you can finish the rest in the same style

## End of Step 2

When all chapters are written, run:

```bash
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/scratch/codex-book-status.ts <bookId> --gates
```

Then run:

```bash
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/scratch/audit-book-patterns.ts <bookId> --from-state
```

Report:

- chapters written
- chapters rewritten due to checkpoint or pattern audit
- final status result
- final pattern audit result
- next step: use `MIGRATION-CODEX-STEP3-FINALIZE.md`
