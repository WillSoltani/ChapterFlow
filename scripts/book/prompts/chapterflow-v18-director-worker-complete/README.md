
# ChapterFlow v18 Director–Workers Complete

This pack changes the run strategy, not the final schema.

## What it is

One persistent **Director** session orchestrates the run.
Specialist **Workers** do the heavy chapter work from small file-scoped work orders.
The filesystem is the memory:
- source freeze
- skeleton
- chapter tickets
- worker outputs
- validated chapter commits
- release built from commits only

## Why v18 exists

Earlier long-book runs drifted after good early chapters because continuation stopped behaving like the real chapter pipeline and started behaving like a generator. v18 removes that failure mode by:
- banning content generator scripts
- forcing one fresh ticket per chapter
- splitting structure/examples/quiz into dedicated workers
- assembling release only from committed validated chapter artifacts
- running a repetition + assembly hygiene guard after every chapter

## Core guarantee

The final JSON package still targets the same ChapterFlow EMH schema and quality contract.

## Startup

Use the launch script with only title and author.
Then paste the generated `RUN_ROOT/manifests/launch-prompt.txt` into one Director chat.

## No cover generation

Cover creation is intentionally out of scope. This pack does not generate or wire book covers.
