# Cleanup rules

Cleanup happens only after:
- final book JSON is validated
- release guard passes
- integration is complete
- build passes
- final cover is in place

## Remove
- intermediate drafts
- outlines
- quiz blueprints
- scratch notes
- temporary repair scripts
- duplicate derived files
- other nonessential generation artifacts

## Retain
- final book JSON
- final cover asset
- source ledger
- edition lock
- source freeze records
- final validation reports
- release metadata required for auditability

Never use a blanket 'delete all generation files' policy.
Use: remove nonessential intermediate artifacts after successful release, retain the minimum audit trail and final deliverables.
