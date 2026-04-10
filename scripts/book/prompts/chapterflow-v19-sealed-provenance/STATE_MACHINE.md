# State Machine

States:
- launched
- source_locked
- source_sufficient
- skeleton_ready
- calibration_pending
- calibration_locked
- wave_in_progress
- chapter_committed
- release_assembled
- release_validated
- complete
- blocked

Transitions are earned, not declared.
A transition is valid only if the required files and receipts exist and the corresponding guard passes.
