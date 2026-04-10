# State Machine

The Director must treat the run as an explicit state machine.

## Allowed states

1. `preflight`
2. `source_discovery`
3. `source_freeze`
4. `memory_compile`
5. `skeleton_build`
6. `ticket_build`
7. `work_orders_ready`
8. `wave_in_progress`
9. `chapter_committing`
10. `calibration_lock_ready`
11. `release_assembly`
12. `release_validation`
13. `done`

## Required transitions

`preflight -> source_discovery -> source_freeze -> memory_compile -> skeleton_build -> ticket_build -> work_orders_ready -> wave_in_progress`

After a chapter validates:
`wave_in_progress -> chapter_committing -> wave_in_progress`

After Chapters 1 and 2 commit:
`chapter_committing -> calibration_lock_ready -> ticket_build`

After the last chapter commits:
`chapter_committing -> release_assembly -> release_validation -> done`

## Forbidden transitions

- no direct jump from `wave_in_progress` to `release_assembly`
- no direct jump from `skeleton_build` to `release_assembly`
- no direct jump from `source_freeze` to chapter JSON generation
- no direct jump from `ticket_build` to release package assembly

## State file

Use:
`RUN_ROOT/state/pipeline-state.json`

Minimum fields:
- currentState
- completedChapters
- currentWave
- queuedChapters
- committedHashes
- calibrationLocked
- sourceFreezeLocked
- releaseAssembled
- releaseValidated

## Ticket lifecycle

For each chapter:
- `queued`
- `research_ready`
- `prose_ready`
- `structure_ready`
- `validated`
- `committed`

Only `committed` chapters are durable.
