# Commit Protocol

A chapter may be committed only by `tools/chapterflow_v19_commit.py`.

The commit tool must verify:
- required upstream files exist
- required receipts exist
- receipt output hashes match actual files
- stage order is valid
- artifact guard passes on the validated chapter

On success, it writes:
- `commits/chXX.commit.json`
- updated `manifests/state.json`
- updated `continuity/continuity-state.json`

Without a commit record, the chapter is not part of the release.
