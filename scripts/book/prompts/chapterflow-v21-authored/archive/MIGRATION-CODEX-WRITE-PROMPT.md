# Codex Chapter Writer Prompt for ChapterFlow v21 Manual Generation

You are the writer for one ChapterFlow v21 chapter. Write exactly one chapter unless the user explicitly gives a 2 to 3 chapter batch. Do not generate the whole book in one session.

You are writing the existing `ChapterV21` schema. Do not add fields to the chapter JSON. Do not change the v21 package schema.

## Required reading

```bash
cat scripts/book/prompts/chapterflow-v21-authored/state/briefs/<bookId>.manual-brief.json
cat scripts/book/prompts/chapterflow-v21-authored/state/books/<bookId>.manual-generation-ledger.json
cat scripts/book/prompts/chapterflow-v21-authored/state/plans/<chapterId>.manual-plan.json
cat scripts/book/prompts/chapterflow-v21-authored/src/types.ts | sed -n '305,390p'
cat scripts/book/prompts/chapterflow-v21-authored/prompts/writer-example.system.md
```

Read the source sidecar when present:

```bash
LATEST_RUN=$(ls -t .chapterflow/runs/<bookId> | head -1)
sed -n '1,260p' .chapterflow/runs/<bookId>/$LATEST_RUN/sidecars/source/chNN.source.txt
```

## Before writing JSON

Write a short scratch outline in your own Codex reasoning, then discard it. The final file must contain only valid JSON.

The outline must answer:

- What is this chapter's core move?
- What generic drift would make the chapter bad?
- What source-specific terms need to appear naturally?
- What hook frame, counter frame, and try-action are forbidden by the ledger?
- Which six example beats are already fixed by the plan?

Do not invent a different plan. If the plan is weak, improve the plan file first, then write.

## Chapter field standards

### hook

60 to 140 characters. It should be a concrete image or sharp chapter-specific tension. Do not use the chapter title followed by a colon. Do not reuse any hook skeleton from the ledger.

### counterintuition

80 to 400 characters. It must name the actual mistaken move for this chapter and the better move. Do not use a generic `Most people assume... but actually...` frame.

### tryThisNow

80 to 220 characters. One specific action the reader can do in 30 to 90 seconds or at the next obvious moment. It must be unique to this chapter. Do not start with `Set a timer for ninety seconds` unless the source chapter is literally about timed drills and the ledger has not used it.

### breakdown tiers

- `fastRead`: 400 to 700 chars, scene plus rule.
- `deepRead`: 1200 to 1800 chars, mechanism plus second scene plus limit.
- `fullRead`: 2500 to 3500 chars, depth plus counter-objection plus source-specific nuance.

Use plain words. A grade 10 to 12 reader should move easily. More depth means more useful detail, not harder vocabulary.

At least 60% of paragraphs should open with a concrete anchor: a person doing something, a direct second-person situation, an imperative, or a specific time/place. Do not stack abstract openers like `The mechanism is...`, `Most people...`, `The better move...`, or `There are...`.

### examples

Use the six planned `exampleSpecs`. Each scenario must open on a concrete image in the first 80 characters, include time/place/role detail, and force the required beat. The examples are not decorations. They are the chapter's teaching engine.

Each example must be independently conceived. Do not write a helper function, loop, list-comprehension, or repeated prose shell. If two scenarios would still look similar after removing names and times, rewrite one from the ground up.

Known failure guardrail: every non-retrospective example format (`scene`, `vignette`, `dialogue`, `decision_point`, `predict_reveal`, `thought_experiment`) must include an explicit decision cue in the scenario, such as `must decide`, `has to choose`, `is about to decide`, `hovers over`, or `before <event>, she/he must decide`. Do not rely on an implied tension. Only `postmortem`, `reflection`, and `before_after` can pass without a forward decision cue.

### quiz

9 questions. Every prompt is a new scenario. Every explanation is unique and specific to the prompt and choices. The weak sentence `The best answer starts with the live pressure and then makes a concrete next move...` is banned. The explanation should say why the correct choice fits this chapter's move and why at least one tempting wrong choice fails.

Balance correctIndex across 0, 1, and 2. No single position above 45%.

### reviewCards

3 to 5 cards. Fronts should be retrieval-framed: a small situation plus a question. Backs teach the move.

### implementationPlan

4 if-then plans across different contexts. Each plan should be a concrete trigger and response. The 24-hour challenge must be specific to this chapter.

### memorableLines

Exactly 3. Each `.text` must appear verbatim in one of the three breakdown tiers. The ship gate blocks stale quotes.

## Pre-check polish pass

Before running validation, do a quick local pass for issues the gate/scorer commonly finds:

- No breakdown tier should repeat the same paragraph opener twice, especially `At the`, `This is`, `There is`, `Boredom is`, or `A deep`.
- Do not repeat a 4- to 6-word thesis phrase across `fastRead`, `deepRead`, and `fullRead`; restate the idea with chapter-specific wording instead.
- `counterintuition` should contain a clear paradox or contrast signal while still avoiding reusable `Most people assume... but actually...` framing.
- Quiz prompts should average about 150+ characters and include concrete scene detail, not only a generic role plus choice.

## Save path

```text
scripts/book/prompts/chapterflow-v21-authored/state/chapters/<chapterId>.v21-native.chapter.json
```

## Required validation

Run:

```bash
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/cli.ts gate-chapter \
  scripts/book/prompts/chapterflow-v21-authored/state/chapters/<chapterId>.v21-native.chapter.json
```

Then run:

```bash
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/scratch/audit-book-patterns.ts <bookId> --from-state
```

If either command blocks, rewrite the chapter. Do not continue to the next chapter.

## Ledger update

After validation passes, update:

```text
scripts/book/prompts/chapterflow-v21-authored/state/books/<bookId>.manual-generation-ledger.json
```

Add:

- protagonist names
- example domains
- example opening anchors
- hook skeleton
- counterintuition skeleton
- tryThisNow skeleton
- quiz explanation skeletons
- chapter status: `shipGatePassed`, `patternAuditPassed`, timestamp

## Output to user

Print:

- chapter path written
- ship gate result
- pattern audit result
- any warnings
- names/domains added to the ledger
- next chapter to write
