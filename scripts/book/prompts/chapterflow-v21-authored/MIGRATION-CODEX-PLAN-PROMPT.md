# Codex Chapter Planning Prompt for ChapterFlow v21 Manual Generation

You are the curriculum planner for a ChapterFlow v21 migration. You are not writing chapter JSON. Your job is to create persisted per-chapter plans that are strong enough for a later writer to produce HWF-level content without inventing a new structure.

Plan only 3 to 5 chapters in one session. Never plan the whole book unless the book has 5 or fewer chapters.

## Inputs to read

```bash
cat scripts/book/prompts/chapterflow-v21-authored/state/briefs/<bookId>.manual-brief.json
cat scripts/book/prompts/chapterflow-v21-authored/state/books/<bookId>.chapter-core-map.json
cat scripts/book/prompts/chapterflow-v21-authored/state/books/<bookId>.manual-generation-ledger.json
cat scripts/book/prompts/chapterflow-v21-authored/state/indexes/<bookId>.json
```

Read source sidecars for the chapters being planned:

```bash
LATEST_RUN=$(ls -t .chapterflow/runs/<bookId> | head -1)
sed -n '1,220p' .chapterflow/runs/<bookId>/$LATEST_RUN/sidecars/source/chNN.source.txt
```

Read the HWF planning reference again if your examples start feeling generic:

```bash
cat scripts/book/prompts/chapterflow-v21-authored/state/plans/how-to-win-friends-and-influence-people-ch15.plan.json
```

## Plan file path

For each chapter:

```text
scripts/book/prompts/chapterflow-v21-authored/state/plans/<chapterId>.manual-plan.json
```

## Required shape

Use the existing `ChapterDesignDoc` fields so the plan is familiar to the v21 pipeline, plus manual-only QA fields. Do not change the v21 chapter/package schema. These plans are sidecar artifacts.

```json
{
  "chapterId": "<bookId>-chNN",
  "number": 1,
  "title": "<chapter title>",
  "coreMove": "one precise mental move, not a topic label",
  "sourcePressure": "what the source sidecar says this chapter is really about",
  "chapterSpecificMisunderstanding": "the wrong generic version the writer must avoid",
  "sourceAlignmentTerms": ["chapter-specific", "terms", "that should appear naturally"],
  "forbiddenFrames": {
    "hook": ["any hook frame already used or too generic"],
    "counterintuition": ["most people assume... but actually..."],
    "tryThisNow": ["set a timer for ninety seconds..."],
    "examples": ["any scene shell already used in prior chapters"]
  },
  "exampleCount": 6,
  "exampleSpecs": [
    {
      "domain": "specific domain with a real context, not work/home generic",
      "audience": "who this case speaks to",
      "stakes": "what is at risk in this exact moment",
      "format": "scene | vignette | dialogue | decision_point | predict_reveal | postmortem | before_after | reflection | thought_experiment",
      "requiredBeat": "the exact visible beat that makes the chapter's core move happen",
      "firstImage": "the concrete first image the scenario should open on",
      "mustInclude": ["1 to 3 concrete objects or constraints"],
      "mustAvoid": ["nearby generic version or already-used shell"]
    }
  ],
  "quizFocus": {
    "count": 9,
    "bloomsMix": { "understand": 1, "apply": 4, "analyze": 3, "evaluate": 1 },
    "transferEmphasis": 0.8,
    "skillTargets": ["what the quiz should test, in scenario terms"]
  },
  "cardFocus": { "count": 5, "retrievalPractice": true },
  "tryThisNowSpec": "one chapter-specific 30 to 90 second action, not a reusable timer prompt",
  "readingTimeMinutes": 12
}
```

## Planning rules

- Every chapter must have a different `coreMove`.
- Every example spec must be tied to the chapter's source pressure.
- The six example domains in one chapter must be unrelated. Do not write six workplace variations.
- Adjacent chapters must not share domains unless the book absolutely requires it.
- Do not use the same physical anchor across chapters: no repeated chipped mugs, blue markers, dosing cups, bike helmets, radiators, bus depots, classrooms, narrow kitchens, or equivalent shells.
- Make `requiredBeat` visual. HWF-quality examples let the reader see the lesson happen.
- Include forbidden frames from the ledger so the writer sees what not to repeat.

## Before saving each plan

Ask these checks and revise until they pass:

1. Could a writer swap chapter titles and still use this plan? If yes, it is too generic.
2. Does each example spec force the chapter's specific move, or merely provide a setting?
3. Is there a visible object/action that teaches the idea without an explanatory lecture?
4. Do any examples resemble previous chapter examples after names and times are stripped?
5. Are quiz skill targets specific enough that explanations cannot all be the same sentence?

## After saving plans

Run the pattern audit against existing chapters and plan artifacts. It will not score unwritten chapters, but it will confirm the brief/plan sidecars exist for written chapters:

```bash
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/scratch/audit-book-patterns.ts <bookId> --from-state
```

Update the manual ledger with planned domains and rejected frames.

## Output

Print:

- chapters planned
- plan paths written
- any source sidecars missing
- three strongest example beats
- any frames added to the rejected list
- the next session should use `MIGRATION-CODEX-WRITE-PROMPT.md` for one chapter
