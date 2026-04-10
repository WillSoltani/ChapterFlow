# ChapterFlow v20 Sealed Worker Pack

This pack fixes the failure mode where a long-running Director session manufactures the workflow's outputs instead of executing the workflow.

## Core idea

Use one persistent Director session only for orchestration.
Use fresh worker sessions for chapter-heavy work.
Make the filesystem the memory.
Make chapter commitment dependent on machine-checkable lineage.

## Non-negotiables

- prose first, schema later
- Director may not author reader-facing content
- no content generator scripts
- no seed-to-prose or metadata-to-prose shortcuts
- every committed chapter needs lineage receipts
- release assembled from committed validated chapters only
- no human approval gates mid-run
- no cover generation

## Inputs

Required inputs:
- title
- author

The pipeline may ask only when edition or translation ambiguity materially changes the content contract.
