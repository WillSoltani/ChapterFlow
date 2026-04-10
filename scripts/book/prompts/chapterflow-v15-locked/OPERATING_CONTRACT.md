# Operating Contract

This file has higher priority than every other file in the pack except:
1. `prompt-starter.txt`
2. `RUN_ROOT/manifests/run-manifest.json`

If a lower-priority file conflicts with this file, this file wins.

## Highest-priority non-negotiables

### 1) Do not drift to legacy packs or legacy scripts
Use only files under `PACK_ROOT`.

Do not read from or reuse:
- older ChapterFlow packs
- `generate-*.mjs`
- `generate-*.py`
- repo-local “full book generators”
- older continuation scripts

unless the file is a pure utility that never authors reader-facing content.

### 2) No content generator scripts
Scripts may:
- create directories
- write manifests
- freeze sources
- slice sources into sidecars
- run validators and linters
- assemble release packages from validated chapters
- update repo registration files
- clean up nonessential artifacts

Scripts may not:
- write chapterBreakdown text
- write takeaway text
- write scenario text
- write quiz explanations
- write review cards
- write implementation prose
- synthesize reader-facing content from chapter seeds or builder functions

Forbidden script patterns:
- `CHAPTER_SEEDS = [...]`
- `buildDraft(...)`
- `buildEasyBreakdown(...)`
- `buildMediumBreakdown(...)`
- `buildHardBreakdown(...)`
- `buildQuiz(...)`
- `buildReviewCards(...)`
- any code path that emits reader-facing strings from stored seed prose

### 3) Every chapter must use the full chapter loop
No exceptions for later chapters.

Every chapter must pass through:
- brief
- outline
- quiz blueprint
- writer
- editor
- critic
- converter
- quiz
- validator
- patch/repair if needed

### 4) No human approval gates
There is no manual approval stop after Chapter 1.
There is no manual approval stop after any wave.

The only allowed question to the user is:
- a single edition/translation clarification at the start
- only when that ambiguity materially changes the content contract
- and cannot be resolved safely from available sources

### 5) Chapter 1 and Chapter 2 are calibration chapters
They do not pause the run.
They set the quality floor for the rest of the book.

After both are validated:
- create a calibration lock
- compare later chapters against it
- stop and repair drift internally if later chapters fall below the floor

### 6) Release is assembled from validated chapters only
The final book package must be built only from:
- `validated/chXX.chapter.json`

Never assemble release from:
- structured drafts
- temporary objects in a script
- chapter seeds
- review wrappers
- report summaries

### 7) No cover generation
Do not generate a cover.
Do not wire a placeholder cover.
Do not modify cover config unless `manualCoverPath` is explicitly provided in the manifest.
Cover work is outside this pack by default.

### 8) Source truth and source limits
Use frozen sources and chapter sidecars as the factual authority.
If coverage is thin:
- narrow the chapter
- lower the concept budget if needed
- do not invent depth
- do not import unsupported anecdotes or historical mechanisms

### 9) Reader-facing contamination is a hard fail
Reader-facing output must not contain:
- internal instructions
- brief scaffolding
- seed labels
- source-calibration notes
- raw source pasted into breakdowns without quote permission
- validation prose or code-like phrasing

### 10) Tone objects and quizzes are real requirements
By default:
- `scenario` is a tone object
- `quiz.questions` is non-empty and chapter-complete by chapter gate
- identical tone variants fail
