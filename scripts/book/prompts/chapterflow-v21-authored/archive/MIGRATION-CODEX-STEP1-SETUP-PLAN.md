# ChapterFlow v21 Codex Step 1, Setup Plus Full-Book Planning

You are the setup editor and curriculum planner for one ChapterFlow v21 Codex-only migration.

You are allowed to plan the full book in this step because plans are sidecar artifacts, not final reader prose. You are not allowed to write chapter JSON in this step.

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

Use those exact values unless repo metadata proves a typo.

## Forbidden in Step 1

- Do not write chapter JSON.
- Do not promote a package.
- Do not call Anthropic CLI.
- Do not call OpenAI API.
- Do not set `CHAPTERFLOW_PROVIDER`.
- Do not call model-backed generation scripts.
- Do not use the categorizer.

## Read before writing artifacts

From repo root:

```bash
jq '.book | {bookId,title,author}' book-packages/<bookId>.modern.json
jq '.' scripts/book/prompts/chapterflow-v21-authored/state/indexes/<bookId>.json
cat scripts/book/prompts/chapterflow-v21-authored/MIGRATION-CODEX-3STEP-PROMPT.md
cat scripts/book/prompts/chapterflow-v21-authored/src/types.ts | sed -n '305,390p'
cat scripts/book/prompts/chapterflow-v21-authored/FAILURE-MODES.md
```

Inspect the HWF reference:

```bash
jq '.chapters[] | select(.number==15)' book-packages/how-to-win-friends-and-influence-people.v21.json
cat scripts/book/prompts/chapterflow-v21-authored/state/plans/how-to-win-friends-and-influence-people-ch15.plan.json
```

Read source sidecars when they exist:

```bash
LATEST_RUN=$(ls -t .chapterflow/runs/<bookId> 2>/dev/null | head -1)
find .chapterflow/runs/<bookId>/$LATEST_RUN/sidecars/source -maxdepth 1 -name 'ch*.source.txt' -print 2>/dev/null | sort
sed -n '1,220p' .chapterflow/runs/<bookId>/$LATEST_RUN/sidecars/source/ch01.source.txt 2>/dev/null
```

Mine the source for real-world anchors (this is the single biggest differentiator vs Blinkist/Headway/Shortform — they all preserve the named anecdotes; we must too):

```bash
# Pull every proper-noun person, place, study, and date the author cites.
jq -r '.chapters[] | "=== ch\(.number) " + .title + " ===\n" + (.fullText // .text // .body // .content // "")' \
  book-packages/<bookId>.modern.json | head -2000
```

Extract per-chapter:

- **Named figures** from the actual book: people the author profiles (e.g., Cal Newport names Carl Jung, Adam Grant, J.K. Rowling, Bill Gates). Capture 1 to 3 per chapter.
- **Named studies / researchers / institutions**: e.g., Anders Ericsson on deliberate practice, Sophie Leroy on attention residue, the Roy Baumeister ego-depletion experiments.
- **Named places / dates / artifacts** with sensory weight: Carl Jung's stone tower at Bollingen 1922, J.K. Rowling's £1,000-a-night suite at the Balmoral, Theodore Roosevelt's compressed Columbia schedule.

If the source has none of these for a chapter, write that down — that chapter will use only fictional protagonists, but never invent a fake named figure or fake study. Better to omit than to fabricate.

## Create artifact 1, manual brief

Path:

```text
scripts/book/prompts/chapterflow-v21-authored/state/briefs/<bookId>.manual-brief.json
```

Shape:

```json
{
  "bookId": "<bookId>",
  "title": "<Title>",
  "author": "<Author>",
  "thesisParagraph": "One concrete paragraph on the book's actual argument.",
  "coreIdeas": [
    {
      "name": "short idea name",
      "oneSentence": "plain-English claim",
      "mentalMove": "what the reader learns to do",
      "sourceAnchors": ["ch01.source", "ch04.source"]
    }
  ],
  "targetReader": "who this teaches and why they care",
  "voiceCharter": {
    "register": "plainspoken",
    "person": "second",
    "cadence": "medium",
    "signatureMoves": [
      "open ideas in a concrete moment before naming the rule",
      "use plain sentences with one sharp image",
      "teach through choices the reader recognizes"
    ],
    "avoidMoves": [
      "no chapter/book/author meta references",
      "no em dashes",
      "no reusable hook/counter/tryThisNow stems",
      "no generic coaching language"
    ]
  },
  "voiceSpecimens": [
    "Write 5 to 7 original sample sentences that sound like this book but do not copy source text."
  ],
  "voiceAntiSpecimens": [
    "Write 4 to 6 rejected sample sentences that are generic, wordy, meta, or templated."
  ],
  "teachingArc": "how the chapters compound across the book",
  "forbiddenMoves": [
    "book-specific trap to avoid",
    "another book-specific trap to avoid"
  ]
}
```

## Create artifact 2, chapter core map

Path:

```text
scripts/book/prompts/chapterflow-v21-authored/state/books/<bookId>.chapter-core-map.json
```

Shape:

```json
{
  "bookId": "<bookId>",
  "chapters": [
    {
      "number": 1,
      "chapterId": "<bookId>-ch01",
      "title": "<chapter title>",
      "sourcePressure": "what this chapter is specifically about, from source/index",
      "coreMove": "one mental move this chapter teaches",
      "commonMisread": "the generic weak version the writer must avoid",
      "mustUseTerms": ["3 to 8 chapter-specific terms"],
      "mustNotDriftInto": ["nearby generic theme this chapter is not mainly about"]
    }
  ]
}
```

## Create artifact 3, manual generation ledger

Path:

```text
scripts/book/prompts/chapterflow-v21-authored/state/books/<bookId>.manual-generation-ledger.json
```

Initial shape:

```json
{
  "bookId": "<bookId>",
  "updatedAt": "<ISO timestamp>",
  "usedProtagonistNames": [],
  "usedExampleDomains": [],
  "usedExampleAnchors": [],
  "usedHookFrames": [],
  "usedCounterFrames": [],
  "usedTryThisNowFrames": [],
  "usedQuizExplanationFrames": [],
  "rejectedFrames": [],
  "chapterStatuses": {}
}
```

Preserve existing ledger entries if the file already exists and the user is resuming.

## Create artifact 4, manual plans for every chapter

Path for each chapter:

```text
scripts/book/prompts/chapterflow-v21-authored/state/plans/<chapterId>.manual-plan.json
```

Required shape:

```json
{
  "chapterId": "<bookId>-chNN",
  "number": 1,
  "title": "<chapter title>",
  "coreMove": "one precise mental move, not a topic label",
  "sourcePressure": "what the source/index says this chapter is really about",
  "chapterSpecificMisunderstanding": "the wrong generic version the writer must avoid",
  "sourceAlignmentTerms": ["chapter-specific", "terms", "that should appear naturally"],
  "sourceAnchors": [
    {
      "kind": "person | study | place | artifact | event",
      "name": "real name from the source — e.g., 'Carl Jung', 'Anders Ericsson', 'the Bollingen stone tower'",
      "detail": "the specific fact the source gives — e.g., 'cut stone with his own hands at Bollingen from 1922 onward to create a refuge for deep thought'",
      "useIn": "deepRead | fullRead | both",
      "phrasingHint": "one sentence showing how this anchor can land naturally in prose without sounding like a citation"
    }
  ],
  "forbiddenFrames": {
    "hook": ["already used or too generic hook frames"],
    "counterintuition": ["generic counter frames to avoid"],
    "tryThisNow": ["generic try-action frames to avoid"],
    "examples": ["scene shells already used or too easy to repeat"]
  },
  "exampleCount": 6,
  "exampleOpeningDiversity": {
    "rule": "no more than 2 of the 6 examples may open with the pattern 'At HH:MM, <Name> <verb>s'",
    "requiredOpenings": "at least 4 distinct opening devices across the 6 examples, drawn from: timestamp+name+action, dialogue first line, sensory detail first, second-person 'You' direct address, retrospective 'It took her three weeks to see', question-as-hook, environmental detail before any human",
    "rationale": "C8 catches Cartesian repetition of phrases but not the deeper template of 'timestamp + named protagonist + prop + decision' that makes 6 examples feel like 1 example with name swaps"
  },
  "exampleSpecs": [
    {
      "domain": "specific domain with a real context, not work/home generic",
      "audience": "who this case speaks to",
      "stakes": "what is at risk in this exact moment",
      "format": "scene | vignette | dialogue | decision_point | predict_reveal | postmortem | before_after | reflection | thought_experiment",
      "openingDevice": "timestamp_named | dialogue_first | sensory_first | second_person | retrospective | question_hook | environmental",
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

## Plan quality rules

- Every chapter gets a different `coreMove`.
- Every plan must force chapter-specific content. If the title could be swapped with another chapter and the plan still works, rewrite it.
- Each chapter must have six unrelated example domains.
- Adjacent chapters must not share example domains unless the source requires continuity.
- No repeated physical anchors across plans: avoid repeated mugs, markers, dosing cups, bike helmets, radiators, bus depots, classrooms, narrow kitchens, and equivalent shells.
- The `requiredBeat` must show the lesson happening as a visible action, not merely describe the idea.
- Quiz skill targets must be specific enough that explanations cannot all share one sentence.
- Add plan-level rejected frames to the ledger.

### Protagonist name palette (target audience: Canada, US, Europe)

The app's readers are mostly Canadian, American, and European. Fictional protagonist names should land naturally to that audience — recognizable, easy to read silently, and culturally plausible in a North American or European workplace, kitchen, classroom, or commute.

Use names drawn from this kind of palette (illustrative, not exhaustive):

- **Common Anglophone**: Sarah, Emily, Hannah, Megan, Claire, Olivia, Sophie, Grace, Rachel, Laura, Anna, James, David, Michael, Thomas, Daniel, Andrew, Matthew, Ben, Chris, Sam, Ryan, Jack, Luke, Owen
- **French / Québécois**: Camille, Léa, Margaux, Juliette, Chloé, Manon, Étienne, Mathieu, Nicolas, Antoine, Vincent, Julien, Olivier, Hugo
- **German / Dutch / Scandinavian**: Lukas, Felix, Jonas, Niklas, Henrik, Anders, Lars, Mikkel, Ingrid, Hanna, Lena, Frida, Astrid, Maja, Anke, Marit
- **Italian / Spanish / Portuguese**: Marco, Luca, Matteo, Tomás, Diego, Pablo, Javier, Sofia, Giulia, Chiara, Elena, Paula, Isabel, Catarina
- **Eastern European**: Anya, Nina, Kasia, Marta, Lena, Petra, Tomasz, Aleksy, Pavel, Mateusz, Janek
- **Diaspora names that read naturally in Canada/US/Europe**: Aanya, Priya (avoid if banned-pool), Aman, Devon, Kiran, Layla, Hadiya, Yusuf, Adaeze, Chidi, Lin, Min, Hiroshi, Akira — used sparingly and where the scene domain is plausible (a Toronto tech team, a London hospital, a Paris startup).

Steering rules:

- Default mix per chapter (6 protagonists): roughly 4 from the common Anglophone / Western European pool, 1 to 2 from diaspora or less-common European names. This matches the actual demographic mix of Canadian, American, and European cities without flattening to monoculture.
- Avoid names that feel exotic to the target audience and would slow a reader (e.g., the kind of cluster the current Deep Work draft has: Mirek, Safiya, Antonia, Liora, Nikhil, Gita all in one chapter). One unusual name lands; six in a row breaks immersion.
- Surnames are optional. When used, draw from the same regional palette as the given name.
- Respect the banned-pool list at [src/agents/writer-example.ts](src/agents/writer-example.ts) (Priya, Omar, Maya, Marcus, Elena, Lena, Victor, Theo, Jonah, Mateo, Tessa, Owen, Mira, Malik, Nadia, Felix, Caleb, Talia, Elise, Naomi) — these are exhausted from v13 and will trip C7. Skip them.
- Respect the cross-book ledger: the librarian flags names recently used in other v21 books. Pull from the wider palette so adjacent books don't share casts.
- Record every chosen protagonist name in `state/books/<bookId>.manual-generation-ledger.json` under `usedProtagonistNames` so no chapter reuses a name within the book.

### Source-anchor requirements (the top-of-category differentiator)

- **Mandatory unless source genuinely lacks them**: every chapter plan should contain at least one entry in `sourceAnchors`. Mine the book's actual text for it — do not invent. If the source chapter is light on named anecdotes, plan for one anchor at the book level and skip; never fabricate Carl Jung if Carl Jung is not in the book.
- **Real names, real studies, real places**: the anchor's `name` and `detail` must be traceable to the modern.json source. If you cannot quote a sentence from the source that contains the name, the anchor is invalid.
- **`phrasingHint` must read like prose, not a citation**: aim for the rhythm of "Carl Jung built a stone tower at Bollingen for the same reason — a body learns where deep thinking is allowed to live." Avoid the rhythm of "Cal Newport cites Carl Jung's tower as an example…" because that breaks B1 meta-reference rules.
- **Spread anchors across chapters**: try not to load all named figures into ch1 and leave the rest fictional. If the book has 8 famous anecdotes and 30 chapters, distribute them so most chapters carry one named anchor.

### Example opening-device diversity (the under-detected template trap)

- Across each chapter's 6 examples, **at most 2** may open with the `timestamp_named` pattern (`At 8:21 a.m. Tuesday, Sarah …`). The C8 critic does not catch this; readers feel it as monotony.
- At least 4 different `openingDevice` values must appear across the 6 examples. The plan locks these in; the writer in Step 2 must obey them.
- Plan-level rejected device patterns go into the ledger so subsequent chapters cannot repeat the same mix.

### Rhythm-variety plan field (per chapter)

Add to each chapter plan:

```json
  "rhythmVariety": {
    "deepReadParagraphLengthMix": "at least one paragraph 3 sentences or shorter, at least one paragraph 5+ sentences, at least one one-sentence punch line",
    "fullReadInterludeRequirement": "at least one paragraph that breaks the scene-then-rule rhythm — a question to the reader, a research aside, a direct second-person passage, or a brief historical reference",
    "forbiddenRhythm": "every paragraph following the pattern 'concrete anchor sentence -> abstract rule sentence -> elaboration sentence'"
  }
```

## Verification command

After creating setup and plans, run:

```bash
npx tsx scripts/book/prompts/chapterflow-v21-authored/src/scratch/codex-book-status.ts <bookId>
```

Fix missing plans before finishing Step 1.

## Output

Report:

- brief path
- ledger path
- core map path
- number of plan files written
- any source sidecars missing
- strongest 5 chapter-specific example beats
- status command result
- next step: use `MIGRATION-CODEX-STEP2-WRITE-BOOK.md`
