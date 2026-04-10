
# State Machine Rules

The active run state lives in:
- `state/book-state.json`
- `state/current-task.json`
- `state/current-ticket.md`

The agent must not invent its own stage order.

Allowed stages:
- source_discovery
- memory_compile
- book_skeleton
- chapter_01 ... chapter_N
- calibration_lock
- release_assembly
- release_validation
- complete

Only the commit script advances state.
