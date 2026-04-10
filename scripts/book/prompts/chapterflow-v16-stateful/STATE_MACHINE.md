
# State Machine

v16 uses a persistent state machine.

## Stage order

1. `source_discovery`
2. `memory_compile`
3. `book_skeleton`
4. `chapter_01`
5. `chapter_02`
6. `calibration_lock`
7. `chapter_03`
8. `chapter_04`
9. ...
10. `chapter_N`
11. `release_assembly`
12. `release_validation`
13. `complete`

## Core rule

Only one stage is active at a time.
The active stage is stored in:

- `state/current-task.json`
- `state/current-ticket.md`

The agent must read those files and do only that stage.

## Chapter stage contract

A chapter stage is one sealed transaction that includes:
- source sidecar read
- brief
- outline
- quiz blueprint
- writer
- editor
- critic
- local patch if needed
- converter
- quiz
- validator
- repair if needed
- continuity update
- commit

## Commit rule

After finishing a ticket, run:

```bash
python3 PACK_ROOT/tools/chapterflow_v16_commit.py PACK_ROOT RUN_ROOT
```

Commit is the only way to advance state.

If commit fails:
- do not advance
- fix the current chapter only
- rerun commit

## Calibration lock

After Chapters 1 and 2 validate, the current task becomes `calibration_lock`.

The agent writes:
- `state/calibration-lock.json`
- `reports/calibration-lock.md`

Later chapter tickets must read that lock before doing chapter work.

## Release

Release assembly occurs only after all chapters are committed and validated.
Release validation occurs only after assembly.
