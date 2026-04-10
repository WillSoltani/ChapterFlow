# ChapterFlow v17 Director–Workers

ChapterFlow v17 changes the **run strategy**, not the final content contract.

The winning insight from the earlier packs was that quality comes from:
- prose first
- schema later
- one factual source of truth per chapter
- separate writer, editor, critic, converter, quiz, validator, and patch roles
- release assembled from validated chapters only

The failure mode in long books was different:
- one long orchestrator session held too many rules in memory
- later chapters drifted
- continuation sometimes collapsed into generator behavior instead of the real chapter loop

v17 fixes that with a **director + workers + persistent tickets** model.

## Core idea

One long-running chat session is the **Director**.

The Director does not write reader-facing chapter prose and does not author chapter JSON inline.

Instead, the Director:
1. freezes sources
2. builds the book skeleton
3. compiles short memory cards
4. writes chapter tickets and worker work orders to disk
5. spawns workers for the heavy chapter work
6. commits each chapter after validation
7. re-anchors on disk state before every new chapter or wave

Each chapter is handled from a fresh **ticket**:
- ticket + source sidecar + continuity state + calibration lock
- not from decayed chat memory

## What changes from v16

v16 solved drift better than the long one-shot packs by making the filesystem the memory.
v17 keeps that, but adds:
- a dedicated **Director** role
- **worker role cards**
- **chapter work orders**
- **default wave width of 6**
- **calibration lock after Chapters 1 and 2**
- **artifact guard + release guard**
- a hard ban on bulk chapter generators

## What does NOT change

The shipped JSON quality and schema target stay the same:
- EMH content variants
- tone objects where required
- six examples per chapter by default
- real 10-question quiz
- validated chapter artifacts
- final release package assembled from validated chapters only

## No human gates

There is no Chapter 1 approval stop and no wave approval stop.

The only allowed question to the user is a narrow edition / translation clarification when the source ambiguity would materially change the content contract.

## No cover generation

v17 does not generate a cover and does not create a placeholder cover.
If your product requires cover wiring later, do that separately with a real user-supplied asset.

## Entry files

Read these in order at run start:
1. `README.md`
2. `OPERATING_CONTRACT.md`
3. `STATE_MACHINE.md`
4. `MasterDirector-v17.md`
5. `RUN_ROOT/manifests/run-manifest.json`

## Quick run

```bash
python3 scripts/book/prompts/chapterflow-v17-director-worker/tools/chapterflow_v17_pack_audit.py   scripts/book/prompts/chapterflow-v17-director-worker

bash scripts/book/prompts/chapterflow-v17-director-worker/launch.sh   "The Prince"   "Niccolò Machiavelli"
```

Then paste:
`RUN_ROOT/manifests/launch-prompt.txt`

into the orchestrator chat session.
