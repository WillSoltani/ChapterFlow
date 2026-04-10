
# ChapterFlow v16 Stateful Pack

ChapterFlow v16 keeps the same ChapterFlow content contract and fixes the execution model.

The schema stays the same.
The prose-first architecture stays the same.
The learning-science loop stays the same.

What changes is **how the agent runs**.

## Why v16 exists

Earlier runs showed a repeated pattern:

- Chapter 1 and often Chapter 2 were strong.
- Later chapters drifted.
- The drift came from long-run memory loss and shortcut temptation, not from the core style pack itself.

The strongest evidence was the later *The Prince* continuation, where the run moved from the true ChapterFlow loop into generator-style scripts and started leaking seed notes, raw source text, and scaffolding into reader-facing content. The later output contained lines like “Keep the prose narrow and concrete” inside chapter text, which is exactly the class of contamination the real pipeline was meant to prevent. fileciteturn70file4 fileciteturn70file5

## The new strategy

v16 makes the filesystem the memory.

Instead of giving the agent one huge instruction load at the start and hoping it remembers it for 20+ chapters, v16 runs the book as a sequence of **fresh chapter tickets**.

After every committed chapter:
1. the run writes the next ticket to disk
2. the agent rereads that fresh ticket
3. the agent executes only that chapter's full loop
4. the run commits and advances

This keeps the agent aligned by **rehydrating instructions from persistent storage** rather than chat memory.

## What stays the same

- prose first, schema later
- brief / dossier is factual truth
- edited draft is prose truth
- writer → editor → critic → converter → quiz → validator → repair
- no downstream invention beyond the brief and source freeze
- release assembled from validated chapters only
- same flagship EMH schema

## What changes

- no long-run dependence on prompt memory
- no bulk chapter generators
- no content-writing script shortcuts
- one fresh chapter ticket per chapter
- commit + guard after every chapter
- calibration lock after Chapters 1 and 2, but no human approval stop

## Read next

- `QUICKSTART.md`
- `OPERATING_CONTRACT.md`
- `STATE_MACHINE.md`
- `REPO_RUNBOOK.md`
