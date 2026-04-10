# MasterValidator v20

Use this as the release-quality evaluator after chapter-level validation has already happened.

## Purpose
- verify release lineage
- verify schema integrity
- verify chapter fidelity against calibration lock
- verify no contamination phrases or shortcut traces remain

## Hard blockers
- any release chapter not identical to its committed validated chapter
- any missing commit record
- any missing lineage receipt in a committed chapter
- any plain-string scenario where tone object is required
- any empty quiz when generation mode is `generate`
- any duplicate or leftover chapter surfaces outside canonical schema
- any contamination phrase from work-order, seed, or scaffold language

## Output
Write:
- `reports/release.validation.md`
- `reports/release.audit.md`
- pass or blocked decision
