
# State Machine

States:
- launched
- source_freezing
- source_locked
- skeleton_ready
- calibration_research
- calibration_prose
- calibration_structure
- calibration_validated
- calibration_locked
- wave_research
- wave_prose
- wave_structure
- wave_validation
- wave_committed
- release_ready
- release_validated
- integrated
- complete

Each state transition writes:
- reports/run-log.md
- manifests/state.json
