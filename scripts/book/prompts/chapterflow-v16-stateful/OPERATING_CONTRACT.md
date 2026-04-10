
# Operating Contract

This file outranks every other file in the pack except:
1. `RUN_ROOT/manifests/run-manifest.json`
2. `RUN_ROOT/state/current-ticket.md`

If a lower-priority file conflicts with this contract, this contract wins.

## 1) Filesystem is memory

Do not try to carry the full run in chat memory.

At the start of every ticket:
- reread `RUN_ROOT/state/current-ticket.md`
- reread `RUN_ROOT/state/book-state.json`
- reread `RUN_ROOT/continuity/continuity-state.json`
- reread `RUN_ROOT/state/calibration-lock.json` after Chapter 2
- reread the role cards listed in the ticket

Treat those files as the live memory.
Treat your chat memory as unreliable over long runs.

## 2) The current ticket is the only active task

Do only the work requested in the current ticket.

Do not:
- pre-generate future chapters
- sketch later waves in prose
- create hidden generator plans
- create bulk content scripts
- synthesize future reader-facing text “for efficiency”

## 3) No content generator scripts

Scripts may:
- create folders
- write manifests
- freeze sources
- write sidecars
- write tickets
- run guards and linters
- assemble release from validated chapters
- update state

Scripts may not:
- write breakdown prose
- write takeaways
- write scenario text
- write quiz explanations
- write review cards
- write implementation prose
- synthesize reader-facing content from seed fields or builder functions

Forbidden patterns include:
- `CHAPTER_SEEDS = [...]`
- `buildDraft(...)`
- `buildEasyBreakdown(...)`
- `buildMediumBreakdown(...)`
- `buildHardBreakdown(...)`
- `buildQuiz(...)`
- any code path that authors reader-facing strings from stored seed prose

## 4) Every chapter uses the full chapter loop

Every chapter ticket must produce:
- brief
- outline
- quiz blueprint
- canonical draft
- edited draft
- critic report
- structured chapter JSON
- quiz JSON
- validation report
- validated chapter JSON
- review wrapper
- continuity update

No later chapter may skip the loop.

## 5) No human approval gate

There is no manual Chapter 1 stop.
There is no manual wave stop.

The only allowed user question is a single edition / translation clarification when the ambiguity would materially change the book contract and cannot be safely resolved from available sources.

## 6) Chapters 1 and 2 are calibration chapters

They do not pause the run.
They set the quality floor.

After Chapter 2 validates:
- create `state/calibration-lock.json`
- use it as a mandatory read before every later chapter ticket

## 7) Release is assembled from validated chapters only

Release must be built only from:
- `validated/chXX.chapter.json`

Never assemble release from:
- structured drafts
- temporary objects
- chapter seeds
- review wrappers
- reports
- in-memory generated chapter objects

## 8) Reader-facing contamination is a hard fail

Reader-facing output must not contain:
- internal instructions
- seed notes
- “keep the prose…” style scaffolding
- raw source pasted into breakdowns without explicit quote permission
- validation prose
- code-like phrasing
- builder-function residue

## 9) Tone objects and quizzes are real requirements

Unless the manifest explicitly changes policy:
- `examples[].scenario` is a tone object
- `examples[].whatToDo` is a tone object
- `examples[].whyItMatters` is a tone object
- `quiz.questions` is non-empty by chapter gate
- identical tone variants fail

## 10) No cover generation

Do not generate a cover.
Do not wire a placeholder cover.
Only use `manualCoverPath` if the manifest explicitly provides one.
