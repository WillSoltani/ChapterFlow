# Release Gate Report: The Righteous Mind

- Status: PASS
- Release package: .chapterflow/runs/the-righteous-mind/20260409-001811/release/the-righteous-mind.modern.json
- Repo package: book-packages/the-righteous-mind.modern.json

## Passed checks
- `python3 scripts/book/prompts/chapterflow-v13-autonomous/tools/chapterflow_v13_artifact_guard.py .chapterflow/runs/the-righteous-mind/20260409-001811` - PASS
- `python3 scripts/book/prompts/chapterflow-v13-autonomous/tools/chapterflow_v13_release_guard.py .chapterflow/runs/the-righteous-mind/20260409-001811 .chapterflow/runs/the-righteous-mind/20260409-001811/release/the-righteous-mind.modern.json` - PASS
- `node scripts/book/validate-book.mjs book-packages/the-righteous-mind.modern.json` - PASS
- `python3 scripts/book/prompts/chapterflow-v13-autonomous/tools/chapterflow_v13_lint.py book-packages/the-righteous-mind.modern.json release_gate` - PASS
- `npm run build` - PASS
- Release package assembled from `validated/ch01.chapter.json` through `validated/ch12.chapter.json` only.

## Notes
- The release-stage prose blockers were repaired by reopening the affected validated chapters, rerunning their chapter gates, and resealing continuity before reassembly.
- Chapter 5 required one additional post-repair reopen because the repo validator still enforced competitive breakdown word-count minima after the prose lint was already clean.
- The release guard now passes against the canonical `approvedChapterHashes` table in `continuity/continuity-state.json`.
